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
let user={id:'A'},session={id:'session-A',status:'active'};
const clerk={get user(){return user},get session(){return session},addListener(listener){listeners.add(listener);listener(state);return()=>listeners.delete(listener)}};
function change(value){state={...state,...value};user=state.userId?{id:state.userId}:null;session=state.sessionId?{id:state.sessionId,status:state.status}:null;listeners.forEach(f=>f(state));observers.forEach(f=>f())}
window.__auth={set(value){flushSync(()=>change(value))},roundTrip(){flushSync(()=>{change({sessionId:'session-other'});change({sessionId:'session-A'})})}};
export const useClerk=()=>clerk;
export const useAuth=()=>useSyncExternalStore(f=>{observers.add(f);return()=>observers.delete(f)},()=>state);
export function useUser(){const value=useAuth();return {isLoaded:value.isLoaded,user:clerk.user}}
window.__requests=[];
window.__settle=(index,result)=>{window.__requests[index].done=true;window.__requests[index].resolve(result)};
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
        const owner = importer?.replaceAll("\\", "/");
        if (id === "@clerk/nextjs") return "\0auth";
        if (id === "next-intl") return "\0intl";
        if (id === "next/link") return "\0link";
        if (owner?.endsWith("/messaging/conversation.tsx")) {
          if (id === "./actions") return "\0conversation-actions";
          if (id === "./reply-composer") return "\0composer";
          if (id === "../offers/panel") return "\0offers";
          if (id === "../trust/report-form") return "\0report";
          if (id === "../message-attachments/controls") return "\0images";
        }
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
        if (id === "\0intl")
          return "export const useTranslations=()=>key=>key;export const useFormatter=()=>({dateTime:()=> 'Synthetic date'});";
        if (id === "\0link")
          return "import React from 'react';export default function Link({href,children,...props}){return React.createElement('a',{...props,href},children)}";
        if (id === "\0conversation-actions")
          return `const request=(kind,command)=>new Promise((resolve,reject)=>window.__requests.push({kind,command,resolve,reject}));export const readConversationAction=command=>request('read',command);export const markReadAction=command=>request('ack',command);export const blockContactAction=command=>request('block',command);`;
        if (id === "\0composer")
          return "export function ReplyComposer(){return null}";
        if (id === "\0offers")
          return "export function OfferPanel(){return null}export function OfferMessageCard(){return null}";
        if (id === "\0report")
          return "export function ReportForm(){return null}";
        if (id === "\0images")
          return "export function PrivateAttachmentImage(){return null}";
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
async function qualifyConversation() {
  await page.waitForFunction(
    () => window.__requests.some((item) => item.kind === "read" && !item.done),
    null,
    { timeout: 1500 },
  );
  await page.evaluate(() => {
    const index = window.__requests.findLastIndex(
      (item) => item.kind === "read" && !item.done,
    );
    window.__settle(index, { ok: true, data: window.__conversation });
  });
  await page
    .getByRole("button", { name: "block", exact: true })
    .waitFor({ timeout: 1500 });
}
async function freshConversation() {
  await page.goto(origin + "/?conversation");
  await qualifyConversation();
  await page.waitForFunction(
    () => window.__requests.some((item) => item.kind === "ack"),
    null,
    { timeout: 1500 },
  );
}
async function startBlock() {
  await page.getByRole("button", { name: "block", exact: true }).click();
  await page.getByRole("button", { name: "confirm", exact: true }).click();
  return page.evaluate(() =>
    window.__requests.findLastIndex((item) => item.kind === "block"),
  );
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
  await check(
    "Renewed session retries an unresolved visible read acknowledgment and ignores its old success",
    async () => {
      await freshConversation();
      const old = await page.evaluate(() =>
        window.__requests.findIndex((item) => item.kind === "ack"),
      );
      await page.evaluate(() =>
        window.__auth.set({ sessionId: "renewed-session" }),
      );
      await qualifyConversation();
      await page.waitForFunction(
        () =>
          window.__requests.filter((item) => item.kind === "ack").length === 2,
        null,
        { timeout: 1500 },
      );
      await page.evaluate(
        (index) => window.__settle(index, { ok: true, data: { sequence: 1 } }),
        old,
      );
      await idle();
      assert.equal(
        await page.locator("output").getAttribute("data-changed"),
        "0",
      );
      const current = await page.evaluate(() =>
        window.__requests.findLastIndex((item) => item.kind === "ack"),
      );
      await page.evaluate(
        (index) => window.__settle(index, { ok: true, data: { sequence: 1 } }),
        current,
      );
      await idle();
      assert.equal(
        await page.locator("output").getAttribute("data-changed"),
        "1",
      );
    },
  );
  for (const rejects of [false, true])
    await check(
      "Obsolete read " +
        (rejects ? "exception" : "denial") +
        " cannot reset the newer acknowledged watermark",
      async () => {
        await freshConversation();
        const old = await page.evaluate(() =>
          window.__requests.findIndex((item) => item.kind === "ack"),
        );
        await page.evaluate(() => window.__auth.roundTrip());
        await qualifyConversation();
        await page.waitForFunction(
          () =>
            window.__requests.filter((item) => item.kind === "ack").length ===
            2,
          null,
          { timeout: 1500 },
        );
        const current = await page.evaluate(() =>
          window.__requests.findLastIndex((item) => item.kind === "ack"),
        );
        await page.evaluate(
          (index) =>
            window.__settle(index, { ok: true, data: { sequence: 1 } }),
          current,
        );
        if (rejects)
          await page.evaluate((index) => window.__reject(index), old);
        else
          await page.evaluate(
            (index) =>
              window.__settle(index, { ok: false, code: "NOT_AVAILABLE" }),
            old,
          );
        await page.evaluate(() =>
          window.dispatchEvent(new window.Event("focus")),
        );
        await qualifyConversation();
        await idle();
        assert.equal(
          await page.evaluate(
            () =>
              window.__requests.filter((item) => item.kind === "ack").length,
          ),
          2,
        );
      },
    );
  for (const result of [
    { ok: true, data: { revision: 2 } },
    { ok: false, code: "CONFLICT" },
    null,
  ])
    await check(
      "Obsolete contact completion preserves a newer confirmation after a batched session round trip: " +
        (result?.ok ? "success" : (result?.code ?? "exception")),
      async () => {
        await freshConversation();
        const old = await startBlock();
        await page.evaluate(() => window.__auth.roundTrip());
        await qualifyConversation();
        await page.getByRole("button", { name: "cancel", exact: true }).click();
        await page.getByRole("button", { name: "block", exact: true }).click();
        if (result)
          await page.evaluate(
            ({ index, value }) => window.__settle(index, value),
            { index: old, value: result },
          );
        else await page.evaluate((index) => window.__reject(index), old);
        await idle();
        assert.equal(await page.getByRole("dialog").count(), 1);
        assert.equal(await page.getByRole("alert").count(), 0);
        assert.equal(
          await page.getByText("contactConflict", { exact: true }).count(),
          0,
        );
        assert.equal(
          await page.locator("output").getAttribute("data-changed"),
          "0",
        );
      },
    );
  await check(
    "Current contact completion refreshes the authoritative conversation and notifies the inbox once",
    async () => {
      await freshConversation();
      const current = await startBlock();
      await page.evaluate(
        (index) => window.__settle(index, { ok: true, data: { revision: 2 } }),
        current,
      );
      await qualifyConversation();
      await idle();
      assert.equal(await page.getByRole("dialog").count(), 0);
      assert.equal(
        await page.locator("output").getAttribute("data-changed"),
        "1",
      );
    },
  );
  await check(
    "Session renewal during contact refresh cannot apply the old inbox notification",
    async () => {
      await freshConversation();
      const old = await startBlock();
      await page.evaluate(
        (index) => window.__settle(index, { ok: true, data: { revision: 2 } }),
        old,
      );
      await page.waitForFunction(
        () =>
          window.__requests.some((item) => item.kind === "read" && !item.done),
        null,
        { timeout: 1500 },
      );
      const oldRead = await page.evaluate(() =>
        window.__requests.findLastIndex((item) => item.kind === "read"),
      );
      await page.evaluate(() =>
        window.__auth.set({ sessionId: "renewed-session" }),
      );
      await qualifyConversation();
      await page.evaluate(
        (index) =>
          window.__settle(index, { ok: true, data: window.__conversation }),
        oldRead,
      );
      await idle();
      assert.equal(
        await page.locator("output").getAttribute("data-changed"),
        "0",
      );
    },
  );
  await check(
    "In-place conversation replacement invalidates the old read and contact completions",
    async () => {
      await freshConversation();
      const oldAck = await page.evaluate(() =>
        window.__requests.findIndex((item) => item.kind === "ack"),
      );
      const oldBlock = await startBlock();
      await page.evaluate(() => window.__replaceConversation());
      await qualifyConversation();
      assert.equal(await page.getByRole("dialog").count(), 0);
      await page.evaluate(
        (index) => window.__settle(index, { ok: true, data: { sequence: 1 } }),
        oldAck,
      );
      await page.evaluate(
        (index) => window.__settle(index, { ok: false, code: "CONFLICT" }),
        oldBlock,
      );
      await idle();
      assert.equal(
        await page.locator("output").getAttribute("data-changed"),
        "0",
      );
      assert.equal(
        await page.getByText("contactConflict", { exact: true }).count(),
        0,
      );
      assert.equal(
        await page.evaluate(
          () => window.__requests.filter((item) => item.kind === "ack").length,
        ),
        2,
      );
    },
  );
  await check(
    "Current uncertain contact retry retains its exact command and conflict still requests current authority",
    async () => {
      await freshConversation();
      const first = await startBlock();
      const command = await page.evaluate(
        (index) => window.__requests[index].command,
        first,
      );
      await page.evaluate((index) => window.__reject(index), first);
      await page.getByRole("alert").waitFor();
      await page.getByRole("button", { name: "confirm", exact: true }).click();
      const retry = await page.evaluate(() =>
        window.__requests.findLastIndex((item) => item.kind === "block"),
      );
      assert.deepEqual(
        await page.evaluate((index) => window.__requests[index].command, retry),
        command,
      );
      await page.evaluate(
        (index) => window.__settle(index, { ok: false, code: "CONFLICT" }),
        retry,
      );
      await qualifyConversation();
      await idle();
      assert.equal(await page.getByRole("dialog").count(), 0);
      assert.equal(
        await page.getByText("contactConflict", { exact: true }).count(),
        1,
      );
    },
  );
  for (const result of [
    { ok: true, data: { revision: 2 } },
    { ok: false, code: "CONFLICT" },
    null,
  ])
    await check(
      "Cancelled contact request cannot alter a new confirmation in the same session: " +
        (result?.ok ? "success" : (result?.code ?? "exception")),
      async () => {
        await freshConversation();
        const old = await startBlock();
        await page.getByRole("button", { name: "cancel", exact: true }).click();
        await page.getByRole("button", { name: "block", exact: true }).click();
        if (result)
          await page.evaluate(
            ({ index, value }) => window.__settle(index, value),
            { index: old, value: result },
          );
        else await page.evaluate((index) => window.__reject(index), old);
        await idle();
        assert.equal(await page.getByRole("dialog").count(), 1);
        assert.equal(await page.getByRole("alert").count(), 0);
        assert.equal(
          await page.getByText("contactConflict", { exact: true }).count(),
          0,
        );
        assert.equal(
          await page.locator("output").getAttribute("data-changed"),
          "0",
        );
      },
    );
  await check(
    "Unmounted conversation cannot apply pending read or contact completions to its parent",
    async () => {
      await freshConversation();
      const ack = await page.evaluate(() =>
        window.__requests.findIndex((item) => item.kind === "ack"),
      );
      const block = await startBlock();
      await page.evaluate(() => window.__unmountConversation());
      await page.evaluate(
        (index) => window.__settle(index, { ok: true, data: { sequence: 1 } }),
        ack,
      );
      await page.evaluate(
        (index) => window.__settle(index, { ok: true, data: { revision: 2 } }),
        block,
      );
      await idle();
      assert.equal(
        await page.locator("output").getAttribute("data-changed"),
        "0",
      );
      assert.equal(await page.getByRole("dialog").count(), 0);
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
    actualConversation: true,
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
