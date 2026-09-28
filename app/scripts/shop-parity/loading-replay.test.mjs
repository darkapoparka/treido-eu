import test from "node:test";
import assert from "node:assert/strict";
import { createLoadingReplay } from "./loading-replay.mjs";
import { referenceCatalogDelay } from "../../apps/web/src/features/catalog/reference/replay-delay.ts";

function fakePage() {
  let handler;
  return {
    route: async (_, callback) => (handler = callback),
    unroute: async (_, callback) => assert.equal(callback, handler),
    async request(url, headers = { rsc: "1" }) {
      const calls = [];
      await handler({
        request: () => ({
          url: () => url,
          method: () => "GET",
          headers: () => headers,
        }),
        fallback: async (options) => calls.push(["fallback", options]),
        abort: async () => calls.push(["abort"]),
      });
      return calls;
    },
  };
}

test("holds real matching RSC until release and preserves unrelated routing", async () => {
  const page = fakePage();
  const replay = createLoadingReplay(page, "http://127.0.0.1:6412");
  await replay.install();
  replay.holdRsc("/search?q=Jeans");
  const unrelated = await page.request(
    "http://127.0.0.1:6412/search?q=jeans&_rsc=a",
  );
  assert.equal(unrelated[0][0], "fallback");
  const external = await page.request("https://example.com/search?q=Jeans");
  assert.equal(external[0][0], "fallback");
  const document = await page.request(
    "http://127.0.0.1:6412/search?q=Jeans",
    {},
  );
  assert.equal(document[0][0], "fallback");
  const held = await page.request(
    "http://127.0.0.1:6412/search?_rsc=one&q=Jeans",
  );
  await replay.waitRsc();
  assert.deepEqual(held, []);
  await replay.releaseRsc();
  assert.equal(held[0][0], "fallback");
  await replay.dispose();
});

test("failed capture aborts held requests in cleanup", async () => {
  const page = fakePage();
  const replay = createLoadingReplay(page, "http://127.0.0.1:6412");
  await replay.install();
  replay.holdRsc("/search?q=Jeans");
  const held = await page.request(
    "http://127.0.0.1:6412/search?q=Jeans&_rsc=two",
  );
  await replay.dispose();
  assert.deepEqual(held, [["abort"]]);
});

test("adds bounded catalog latency to one matching request only", async () => {
  const page = fakePage();
  const replay = createLoadingReplay(page, "http://127.0.0.1:6412");
  await replay.install();
  assert.throws(() => replay.holdRsc("//example.com/"));
  assert.throws(() => replay.delayCatalog("/", 10_001));
  replay.delayCatalog("/", 8_000);
  const other = await page.request(
    "http://127.0.0.1:6412/onboarding?step=updates",
  );
  assert.deepEqual(other, [["fallback", undefined]]);
  const delayed = await page.request("http://127.0.0.1:6412/?_rsc=home");
  await replay.waitCatalog();
  assert.equal(
    delayed[0][1].headers["x-shop-reference-catalog-delay-ms"],
    "8000",
  );
  assert.equal(delayed[0][1].headers.rsc, "1");
  const next = await page.request("http://127.0.0.1:6412/?_rsc=next");
  assert.deepEqual(next, [["fallback", undefined]]);
  await replay.dispose();
});

const localHeaders = () =>
  new Headers({
    host: "127.0.0.1:6412",
    "x-forwarded-host": "127.0.0.1:6412",
    "x-forwarded-for": "::ffff:127.0.0.1",
    "x-shop-reference-catalog-delay-ms": "8000",
  });

test("catalog delay needs preview opt-in, loopback headers, and bounded integer", () => {
  assert.equal(referenceCatalogDelay(localHeaders(), true), 8_000);
  assert.equal(referenceCatalogDelay(localHeaders(), false), 0);
  for (const [key, value] of [
    ["host", "example.com"],
    ["host", "127.0.0.1@evil.test"],
    ["x-forwarded-host", "public.example"],
    ["x-forwarded-for", "127.0.0.1, 203.0.113.1"],
    ["x-shop-reference-catalog-delay-ms", "10001"],
    ["x-shop-reference-catalog-delay-ms", "-1"],
    ["x-shop-reference-catalog-delay-ms", "8e3"],
    ["x-shop-reference-catalog-delay-ms", "8.5"],
  ]) {
    const headers = localHeaders();
    headers.set(key, value);
    assert.equal(referenceCatalogDelay(headers, true), 0, `${key}: ${value}`);
  }
  const missingPeer = localHeaders();
  missingPeer.delete("x-forwarded-for");
  assert.equal(referenceCatalogDelay(missingPeer, true), 0);
});
