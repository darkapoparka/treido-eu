import assert from "node:assert/strict";
import test from "node:test";
import { previewOptions } from "./preview-options.mjs";
test("owns loopback, a dedicated output and an explicit non-donor port", () => {
  const result = previewOptions({});
  assert.deepEqual(result.args, [
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "6418",
  ]);
  assert.equal(result.env.SHOP_PARITY_DIST_DIR, ".qa/treido-preview");
  assert.equal(
    result.env.SHOP_PARITY_TSCONFIG_PATH,
    "tsconfig.treido-preview.json",
  );
  assert.equal(result.env.SHOP_REFERENCE_PREVIEW, "1");
});
test("supports an explicit available port without changing host or output", () => {
  assert.equal(previewOptions({ TREIDO_PREVIEW_PORT: "6420" }).port, 6420);
});
for (const port of [
  "6412",
  "80",
  "0",
  "65536",
  "6418;echo",
  "abc",
  "",
  "06418",
  " 6418",
  "6418.5",
]) {
  test("rejects unsafe port " + JSON.stringify(port), () => {
    assert.throws(() => previewOptions({ TREIDO_PREVIEW_PORT: port }));
  });
}
for (const env of [
  { VERCEL: "1" },
  { VERCEL_ENV: "production" },
  { NODE_ENV: "production" },
]) {
  test("refuses hosted/production environment " + JSON.stringify(env), () => {
    assert.throws(() => previewOptions(env));
  });
}
