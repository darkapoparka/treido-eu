/* global window: readonly, sessionStorage: readonly */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import path from "node:path";
import process from "node:process";
import console from "node:console";

// Actual order controls and account boundary with deferred synthetic actions.
// Native receipt ordering is qualified separately; no provider or visual claim.
const app = process.cwd(),
  req = createRequire(path.join(app, "package.json")),
  web = createRequire(path.join(app, "apps/web/package.json")),
  vite = createRequire(req.resolve("vitest/config"));
const { build } = await import(pathToFileURL(vite.resolve("vite")).href);
const clerk = `
import {useSyncExternalStore} from 'react';import {flushSync} from 'react-dom';
let state={user:{id:'synthetic-human-A'},session:{id:'session-A',status:'active'}};
const resources=new Set(),listeners=new Set();
const clerk={get user(){return state.user},get session(){return state.session},addListener(fn){resources.add(fn);fn(state);return()=>resources.delete(fn)}};
const update=(subject,id)=>{state={user:subject?{id:subject}:null,session:id?{id,status:'active'}:null};resources.forEach(fn=>fn(state));listeners.forEach(fn=>fn());};
window.__auth={set(subject='synthetic-human-A',id='session-A'){flushSync(()=>update(subject,id));},replaceWithoutRender(subject,id){state={user:{id:subject},session:{id,status:'active'}};resources.forEach(fn=>fn(state));},roundTrip(){flushSync(()=>{update('synthetic-human-A','session-B');update('synthetic-human-A','session-A');});}};
export const useClerk=()=>clerk;
export const useReverification=action=>action;
export function useUser(){const current=useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn)},()=>state);return {isLoaded:true,user:current.user};}
`;
const actions = `
window.__requests=[];
export const changeOrderAction=args=>new Promise((resolve,reject)=>window.__requests.push({args:JSON.parse(JSON.stringify(args)),resolve,reject}));
window.__resolve=(index,result)=>window.__requests[index].resolve(result);
window.__reject=index=>window.__requests[index].reject(Error('Synthetic uncertain transport'));
export const createQuoteAction=()=>{throw Error('Unexpected quote effect')};
export const startOnboardingAction=()=>{throw Error('Unexpected onboarding effect')};
`;
const entry = `
import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
import {OrderControls,PaymentBoundary} from ${JSON.stringify(path.join(app, "apps/web/src/features/payments/controls.tsx"))};
const root=createRoot(document.getElementById('root'));
const initial={actorKey:'a'.repeat(64),actorSubject:'synthetic-human-A',sellerId:'b0000000-0000-4000-8000-000000000001',canFulfil:true,canRefund:true,language:'en',order:{id:'a0000000-0000-4000-8000-000000000001',revision:1,paymentState:'paid',settlementState:'transferred',fulfilmentState:'pending',refundState:null}};
let props=initial;window.__refreshes=0;
window.__render=update=>{props={...props,...update,order:{...props.order,...update?.order}};flushSync(()=>root.render(React.createElement(PaymentBoundary,{actorSubject:props.actorSubject,language:'en'},React.createElement(OrderControls,props))));};
window.__unmount=()=>flushSync(()=>root.unmount());window.__render({});
`;
const generated = await build({
  configFile: false,
  root: app,
  logLevel: "error",
  define: { "process.env.NODE_ENV": JSON.stringify("development") },
  esbuild: { jsx: "automatic" },
  resolve: {
    preserveSymlinks: true,
    alias: [
      "react",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "react-dom",
      "react-dom/client",
    ].map((name) => ({
      find: new RegExp("^" + name + "$"),
      replacement: web.resolve(name),
    })),
  },
  plugins: [
    {
      name: "payment-order-deferred-fixture",
      enforce: "pre",
      resolveId(id, importer) {
        if (id.replaceAll("\\", "/").endsWith("/payment-order-fixture.tsx"))
          return "\0order:entry";
        if (id === "@clerk/nextjs") return "\0order:clerk";
        if (id === "next/navigation") return "\0order:navigation";
        if (
          id === "./actions" &&
          importer?.replaceAll("\\", "/").endsWith("/payments/controls.tsx")
        )
          return "\0order:actions";
      },
      load(id) {
        if (id === "\0order:entry") return { code: entry, map: null };
        if (id === "\0order:clerk") return clerk;
        if (id === "\0order:actions") return actions;
        if (id === "\0order:navigation")
          return "const router={refresh(){window.__refreshes++}};export const useRouter=()=>router;";
      },
    },
  ],
  build: {
    write: false,
    minify: false,
    lib: {
      entry: path.join(app, "payment-order-fixture.tsx"),
      formats: ["es"],
      fileName: "fixture",
    },
  },
});
const output = Array.isArray(generated)
    ? generated[0].output
    : generated.output,
  code = output.find((item) => item.type === "chunk").code,
  css = output
    .filter((item) => item.type === "asset" && item.fileName.endsWith(".css"))
    .map((item) => item.source)
    .join("\n");
const server = createServer((request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader(
    "Content-Type",
    request.url === "/fixture.js"
      ? "text/javascript"
      : "text/html; charset=utf-8",
  );
  response.end(
    request.url === "/fixture.js"
      ? code
      : `<!doctype html><html><head><style>${css}</style></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>`,
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { chromium, expect } = req("@playwright/test"),
  outcomes = [],
  errors = [];
const actorKey = "a".repeat(64),
  orderId = "a0000000-0000-4000-8000-000000000001",
  scope = `treido-order-command:${actorKey}:${orderId}`;
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  const ready = () =>
    page.getByRole("button", {
      name: "Mark ready for collection",
      exact: true,
    });
  const retry = () =>
    page.getByRole("button", { name: "Retry the saved request", exact: true });
  const reset = async () => {
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
    await expect(ready()).toBeEnabled();
  };
  const command = (index) =>
    page.evaluate((index) => window.__requests[index].args, index);
  const saved = () =>
    page.evaluate((scope) => sessionStorage.getItem(scope), scope);
  const resolve = (index, result) =>
    page.evaluate(({ index, result }) => window.__resolve(index, result), {
      index,
      result,
    });

  await reset();
  await ready().click();
  const rejected = await command(0);
  await resolve(0, { ok: false, code: "CONFLICT" });
  await expect(retry()).toBeDisabled();
  assert.deepEqual(JSON.parse(await saved()), rejected);
  await page.evaluate(() => window.__render({ order: { revision: 1 } }));
  await expect(ready()).toBeDisabled();
  await expect(retry()).toBeDisabled();
  await page.evaluate(() => window.__render({ order: { revision: 2 } }));
  await expect(ready()).toBeEnabled();
  assert.equal(await saved(), null);
  await ready().click();
  const corrected = await command(1);
  assert.notEqual(corrected.requestId, rejected.requestId);
  assert.equal(corrected.expectedRevision, 2);
  await resolve(1, { ok: true, data: { id: orderId, revision: 3 } });
  await expect(retry()).toHaveCount(0);
  outcomes.push("conflict waits for a fresh changed revision before a new ID");

  await reset();
  await ready().click();
  const raced = await command(0);
  await page.evaluate(() => window.__render({ order: { revision: 2 } }));
  await resolve(0, { ok: false, code: "CONFLICT" });
  await expect(retry()).toBeDisabled();
  assert.deepEqual(JSON.parse(await saved()), raced);
  await page.evaluate(() => window.__render({ order: { revision: 2 } }));
  await expect(ready()).toBeEnabled();
  assert.equal(await saved(), null);
  outcomes.push(
    "a view arriving before rejection cannot substitute for its refresh",
  );

  for (const code of [null, "FORBIDDEN", "NOT_AVAILABLE"]) {
    await reset();
    await ready().click();
    const original = await command(0);
    if (code) await resolve(0, { ok: false, code });
    else await page.evaluate(() => window.__reject(0));
    await expect(retry()).toBeEnabled();
    await page.evaluate(() =>
      window.__render({ order: { revision: 9, fulfilmentState: "collected" } }),
    );
    assert.deepEqual(JSON.parse(await saved()), original);
    await retry().click();
    assert.deepEqual(await command(1), original);
    await resolve(1, { ok: true, data: { id: orderId, revision: 2 } });
    await expect(retry()).toHaveCount(0);
    assert.equal(await saved(), null);
    outcomes.push(
      `${code ?? "uncertain transport"} retains exact replay after newer views`,
    );
  }

  await reset();
  await page.getByRole("textbox").fill("SYNTHETIC original refund reason");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Request full refund", exact: true })
    .click();
  const refund = await command(0);
  await resolve(0, { ok: false, code: "CONFLICT" });
  await expect(retry()).toBeDisabled();
  await page.evaluate(() => window.__render({ order: { revision: 2 } }));
  await expect(page.getByRole("textbox")).toBeEnabled();
  await expect(page.getByRole("textbox")).toHaveValue(refund.reason);
  await expect(page.getByRole("checkbox")).toBeChecked();
  await page.getByRole("textbox").fill("SYNTHETIC corrected refund reason");
  await page
    .getByRole("button", { name: "Request full refund", exact: true })
    .click();
  const amended = await command(1);
  assert.notEqual(amended.requestId, refund.requestId);
  assert.equal(amended.expectedRevision, 2);
  assert.equal(amended.reason, "SYNTHETIC corrected refund reason");
  await resolve(1, { ok: true });
  await expect(retry()).toHaveCount(0);
  outcomes.push(
    "refund correction preserves current input and confirmation with a new ID",
  );

  for (const change of ["replacement", "round-trip", "round-trip-conflict"]) {
    await reset();
    await ready().click();
    const original = await command(0);
    await page.evaluate(
      (change) =>
        change === "replacement"
          ? window.__auth.set("synthetic-human-A", "session-B")
          : window.__auth.roundTrip(),
      change,
    );
    await resolve(
      0,
      change === "round-trip-conflict"
        ? { ok: false, code: "CONFLICT" }
        : { ok: true },
    );
    await expect(retry()).toBeEnabled();
    assert.deepEqual(JSON.parse(await saved()), original);
    assert.equal(await page.evaluate(() => window.__refreshes), 0);
    await retry().click();
    assert.deepEqual(await command(1), original);
    await resolve(1, { ok: true });
    await expect(retry()).toHaveCount(0);
    assert.equal(await saved(), null);
    outcomes.push(`same-human session ${change} fences obsolete completion`);
  }

  await reset();
  await ready().click();
  const obsolete = await command(0);
  await page.evaluate(() => {
    window.__auth.set("synthetic-human-B", "session-B");
    window.__render({
      actorSubject: "synthetic-human-B",
      actorKey: "b".repeat(64),
      order: { id: "c0000000-0000-4000-8000-000000000001" },
    });
  });
  await expect(ready()).toBeEnabled();
  await ready().click();
  const current = await command(1);
  await resolve(0, { ok: false, code: "CONFLICT" });
  await expect(ready()).toBeDisabled();
  assert.deepEqual(JSON.parse(await saved()), obsolete);
  assert.deepEqual(
    JSON.parse(
      await page.evaluate(
        ({ actorKey, id }) =>
          sessionStorage.getItem(`treido-order-command:${actorKey}:${id}`),
        { actorKey: current.actorKey, id: current.id },
      ),
    ),
    current,
  );
  await resolve(1, { ok: true });
  await expect(ready()).toBeEnabled();
  await expect(retry()).toHaveCount(0);
  await expect(page.getByRole("textbox")).toHaveValue("");
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  outcomes.push(
    "obsolete actor/resource callbacks preserve both journals and current operation",
  );

  for (const field of ["actor", "actorKey", "sellerId", "orderId"]) {
    await reset();
    await page.getByRole("textbox").fill("PRIVATE original scope reason");
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Request full refund", exact: true })
      .click();
    const old = await command(0);
    // Update the exported component in place without a fixture key or an
    // intervening denied PaymentBoundary render that could unmount its state.
    await page.evaluate((field) => {
      if (field === "actor") {
        window.__auth.replaceWithoutRender("synthetic-human-B", "session-B");
        window.__render({
          actorSubject: "synthetic-human-B",
          actorKey: "b".repeat(64),
        });
      } else if (field === "actorKey")
        window.__render({ actorKey: "b".repeat(64) });
      else if (field === "sellerId")
        window.__render({ sellerId: "c0000000-0000-4000-8000-000000000001" });
      else
        window.__render({
          order: { id: "c0000000-0000-4000-8000-000000000001" },
        });
    }, field);
    await expect(ready()).toBeEnabled();
    await expect(page.getByRole("textbox")).toHaveValue("");
    await expect(page.getByRole("checkbox")).not.toBeChecked();
    await expect(retry()).toHaveCount(0);
    assert.deepEqual(JSON.parse(await saved()), old);
    const beforeCompletion = await page.evaluate(() => window.__refreshes);
    await resolve(0, { ok: true });
    await expect(ready()).toBeEnabled();
    assert.deepEqual(JSON.parse(await saved()), old);
    assert.equal(
      await page.evaluate(() => window.__refreshes),
      beforeCompletion,
    );
    if (field === "sellerId") {
      // Switching operating scopes never discards an uncertain original
      // journal. Only its original matching scope can restore its reason.
      await page.evaluate(() =>
        window.__render({ sellerId: "b0000000-0000-4000-8000-000000000001" }),
      );
      await expect(page.getByRole("textbox")).toHaveValue(old.reason);
      await expect(page.getByRole("checkbox")).toHaveCount(2);
      await expect(page.getByRole("checkbox").first()).not.toBeChecked();
      await expect(page.getByRole("checkbox").last()).not.toBeChecked();
      assert.deepEqual(JSON.parse(await saved()), old);
    }
    outcomes.push(
      `direct in-place ${field} replacement conceals state and fences its old completion`,
    );
  }

  await reset();
  await page.getByRole("textbox").fill("PRIVATE rejected actor reason");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Request full refund", exact: true })
    .click();
  const priorActor = await command(0);
  await resolve(0, { ok: false, code: "CONFLICT" });
  await expect(retry()).toBeDisabled();
  await page.evaluate(() => {
    window.__auth.replaceWithoutRender("synthetic-human-B", "session-B");
    window.__render({
      actorSubject: "synthetic-human-B",
      actorKey: "b".repeat(64),
    });
  });
  await expect(ready()).toBeEnabled();
  await expect(retry()).toHaveCount(0);
  await expect(page.getByRole("textbox")).toHaveValue("");
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  assert.deepEqual(JSON.parse(await saved()), priorActor);
  outcomes.push(
    "same-order actor replacement cannot inherit the previous actor's rejected view",
  );

  await reset();
  await ready().click();
  const unmounted = await command(0);
  await page.evaluate(() => window.__unmount());
  await resolve(0, { ok: true });
  assert.deepEqual(JSON.parse(await saved()), unmounted);
  assert.equal(await page.evaluate(() => window.__refreshes), 0);
  outcomes.push("unmounted completion retains its exact saved request");
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      { passed: outcomes.length, outcomes, pageErrors: errors },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
