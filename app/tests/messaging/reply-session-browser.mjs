/* global window: readonly */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";
import console from "node:console";

const app = process.cwd(),
  req = createRequire(path.join(app, "package.json")),
  web = createRequire(path.join(app, "apps/web/package.json")),
  vite = createRequire(req.resolve("vitest/config"));
const { build } = await import(pathToFileURL(vite.resolve("vite")).href);
const auth = `import {useSyncExternalStore} from 'react';import {flushSync} from 'react-dom';
const observers=new Set(), listeners=new Set();
let state={isLoaded:true,isSignedIn:true,userId:'A',sessionId:'session-A',status:'active'};
const clerk={get user(){return state.userId?{id:state.userId}:null},get session(){return state.sessionId?{id:state.sessionId,status:state.status}:null},addListener(listener){listeners.add(listener);listener(state);return()=>listeners.delete(listener)}};
function change(value){state={...state,...value};listeners.forEach(f=>f(state));observers.forEach(f=>f())}
window.__auth={set(value){flushSync(()=>change(value))},roundTrip(){flushSync(()=>{change({sessionId:'session-other'});change({sessionId:'session-A'})})}};
export const useClerk=()=>clerk;
export const useAuth=()=>useSyncExternalStore(f=>{observers.add(f);return()=>observers.delete(f)},()=>state);
export function useUser(){const value=useAuth();return {isLoaded:value.isLoaded,user:clerk.user}}
window.__requests=[];
window.__settle=(index,result)=>window.__requests[index].resolve(result);
window.__reject=index=>window.__requests[index].reject(Error('unavailable fixture transport'));
`;
const built = await build({
  configFile: false,
  root: app,
  logLevel: "error",
  define: { "process.env.NODE_ENV": JSON.stringify("development") },
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
  esbuild: { jsx: "automatic" },
  plugins: [
    {
      name: "reply-session-fixture",
      enforce: "pre",
      resolveId(id, importer) {
        if (id === "@clerk/nextjs") return "\0auth";
        if (
          id === "./reply-actions" &&
          importer
            ?.replaceAll("\\", "/")
            .endsWith("/messaging/use-reply-draft.ts")
        )
          return "\0actions";
      },
      load(id) {
        if (id === "\0auth") return auth;
        if (id === "\0actions")
          return `export const sendRecoverableReplyAction=command=>new Promise((resolve,reject)=>window.__requests.push({command,resolve,reject}));`;
      },
    },
  ],
  build: {
    write: false,
    minify: false,
    lib: {
      entry: path.join(app, "tests/messaging/reply-session-entry.tsx"),
      formats: ["es"],
      fileName: "fixture",
    },
  },
});
const bundle = (Array.isArray(built) ? built[0] : built).output.find(
  (item) => item.type === "chunk",
).code;
const server = createServer((request, response) => {
  response.setHeader("Cache-Control", "no-store");
  if (request.url === "/fixture.js") {
    response.setHeader("Content-Type", "application/javascript");
    response.end(bundle);
  } else {
    response.setHeader("Content-Type", "text/html");
    response.end(
      '<html><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>',
    );
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = "http://127.0.0.1:" + server.address().port;
const { chromium } = req("@playwright/test"),
  browser = await chromium.launch({ headless: true });
const page = await browser.newPage(),
  outcomes = [],
  errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
const receipt = {
  ok: true,
  data: {
    id: "00000000-0000-4000-8000-000000000011",
    sequence: 1,
    recovered: true,
  },
};
async function fresh() {
  await page.goto(origin);
  await page.getByLabel("Reply").fill("Original reply with image");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.waitForFunction(() => window.__requests.length === 1);
  return page.evaluate(() => window.__requests[0].command);
}
async function idle() {
  await page.waitForTimeout(80);
}
async function check(name, operation) {
  try {
    await operation();
    outcomes.push({ name, status: "PASS" });
  } catch (error) {
    outcomes.push({ name, status: "FAIL", error: String(error) });
  }
}
try {
  await check(
    "Transport uncertainty retains exact text, UUID and image IDs through reload and authorized retry",
    async () => {
      const original = await fresh();
      await page.evaluate(() => window.__reject(0));
      await idle();
      await page.reload();
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await page.waitForFunction(() => window.__requests.length === 1);
      assert.deepEqual(
        await page.evaluate(() => window.__requests[0].command),
        original,
      );
      await page.evaluate((value) => window.__settle(0, value), receipt);
      await idle();
      assert.equal(await page.locator("output").getAttribute("data-sent"), "1");
    },
  );
  await check(
    "Same-human renewed session preserves draft and ignores the old success; exact retry acknowledges once",
    async () => {
      const original = await fresh();
      await page.evaluate(() =>
        window.__auth.set({ sessionId: "renewed-session" }),
      );
      await idle();
      await page.evaluate((value) => window.__settle(0, value), receipt);
      await idle();
      assert.equal(await page.locator("output").getAttribute("data-sent"), "0");
      assert.equal(await page.getByLabel("Reply").inputValue(), original.body);
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await page.waitForFunction(() => window.__requests.length === 2);
      assert.deepEqual(
        await page.evaluate(() => window.__requests[1].command),
        original,
      );
      await page.evaluate((value) => window.__settle(1, value), receipt);
      await idle();
      assert.equal(await page.locator("output").getAttribute("data-sent"), "1");
    },
  );
  await check(
    "Batched session round trip cannot apply old failure or release a newer retry",
    async () => {
      const original = await fresh();
      await page.evaluate(() => window.__auth.roundTrip());
      await idle();
      await page
        .getByRole("button", { name: "Send", exact: true })
        .click({ timeout: 1000 });
      await page.waitForFunction(() => window.__requests.length === 2);
      await page.evaluate(() => window.__reject(0));
      await idle();
      assert.equal(
        await page.locator("output").getAttribute("data-busy"),
        "true",
      );
      assert.equal(await page.locator("output").getAttribute("data-code"), "");
      assert.deepEqual(
        await page.evaluate(() => window.__requests[1].command),
        original,
      );
      await page.evaluate((value) => window.__settle(1, value), receipt);
      await idle();
    },
  );
  await check(
    "Old conversation callback cannot acknowledge the new conversation",
    async () => {
      await fresh();
      await page
        .getByRole("button", { name: "Other conversation", exact: true })
        .click();
      await page.getByLabel("Reply").fill("New conversation draft");
      await page.evaluate((value) => window.__settle(0, value), receipt);
      await idle();
      assert.equal(await page.locator("output").getAttribute("data-sent"), "0");
      assert.equal(
        await page.getByLabel("Reply").inputValue(),
        "New conversation draft",
      );
    },
  );
  await check(
    "Inactive session cannot send; restored same-human draft remains recoverable",
    async () => {
      await fresh();
      await page.evaluate(() => window.__auth.set({ status: "ended" }));
      await idle();
      assert.equal(
        await page.locator("output").getAttribute("data-actor"),
        "false",
      );
      await page.evaluate(() =>
        window.__auth.set({ status: "active", sessionId: "new-active" }),
      );
      await idle();
      assert.equal(
        await page.getByLabel("Reply").inputValue(),
        "Original reply with image",
      );
    },
  );
  await check(
    "An exact uncertain attempt remains retryable after contact becomes blocked",
    async () => {
      const original = await fresh();
      await page.evaluate(() => window.__reject(0));
      await idle();
      await page
        .getByRole("button", { name: "Block fixture contact", exact: true })
        .click();
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await page.waitForFunction(() => window.__requests.length === 2);
      assert.deepEqual(
        await page.evaluate(() => window.__requests[1].command),
        original,
      );
    },
  );
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  const output = path.resolve(app, "../.qa/messaging-reply-20261010");
  await mkdir(output, { recursive: true });
  const result = {
    phase: process.argv[2] ?? "after",
    passed: outcomes.filter((row) => row.status === "PASS").length,
    failed: outcomes.filter((row) => row.status === "FAIL").length,
    outcomes,
    errors,
    actualHook: true,
    syntheticClerkAndTransport: true,
    actualProvider: false,
  };
  await writeFile(
    path.join(output, "reply-session-" + result.phase + ".json"),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
  process.exitCode = result.failed || errors.length ? 1 : 0;
}
