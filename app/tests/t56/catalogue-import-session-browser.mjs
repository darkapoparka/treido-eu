/* global window: readonly, document: readonly, location: readonly */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { pathToFileURL, URL } from "node:url";
import path from "node:path";
import process from "node:process";
import console from "node:console";

// Actual import presenter and shared read hook; synthetic deferred resources
// and actions test browser fencing, never database/provider/visual acceptance.
const app = process.cwd(),
  req = createRequire(path.join(app, "package.json")),
  web = createRequire(path.join(app, "apps/web/package.json")),
  intl = createRequire(web.resolve("next-intl")),
  vite = createRequire(req.resolve("vitest/config"));
const { build } = await import(pathToFileURL(vite.resolve("vite")).href);
const clerk = `
import {useSyncExternalStore} from 'react';import {flushSync} from 'react-dom';
const resources=new Set(),listeners=new Set();
let state={loaded:true,user:{id:'synthetic-human-A'},session:{id:'session-A',status:'active'}};
const clerk={get user(){return state.user},get session(){return state.session},addListener(listener){resources.add(listener);listener(state);return()=>resources.delete(listener)}};
const update=(subject,id,status)=>{state={loaded:true,user:subject?{id:subject}:null,session:id?{id,status}:null};resources.forEach(listener=>listener(state));listeners.forEach(listener=>listener());};
window.__auth={set(subject='synthetic-human-A',id='session-A',status='active'){flushSync(()=>update(subject,id,status));},batchRoundTrip(){flushSync(()=>{update('synthetic-human-A','session-B','active');update('synthetic-human-A','session-A','active');});},silent(subject,id,status='active'){state={loaded:true,user:subject?{id:subject}:null,session:id?{id,status}:null};},current:()=>state};
export const useClerk=()=>clerk;
export function useAuth(){const current=useSyncExternalStore(listener=>{listeners.add(listener);return()=>listeners.delete(listener);},()=>state);return {isLoaded:current.loaded,userId:current.user?.id??null,sessionId:current.session?.id??null,isSignedIn:!!current.user&&current.session?.status==='active'};}
let visibility='visible';Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>visibility});
window.__visibility=(value,emit=true)=>{visibility=value;if(emit)flushSync(()=>document.dispatchEvent(new Event('visibilitychange')));};
`;
const navigation = `
import {useSyncExternalStore} from 'react';import {flushSync} from 'react-dom';
const listeners=new Set();const subscribe=listener=>{listeners.add(listener);return()=>listeners.delete(listener)};
export const usePathname=()=>useSyncExternalStore(subscribe,()=>location.pathname);
export const useSearchParams=()=>new URLSearchParams(useSyncExternalStore(subscribe,()=>location.search));export const useRouter=()=>({push:path=>window.__route(path)});
window.__route=path=>{history.pushState({},'',path);flushSync(()=>{listeners.forEach(listener=>listener());window.dispatchEvent(new Event('popstate'));});};
`;
const actions = `
window.__requests=[];let sequence=0;
window.__request=(kind,args)=>{const auth=window.__auth.current();return new Promise((resolve,reject)=>window.__requests.push({id:++sequence,kind,args:JSON.parse(JSON.stringify(args)),sessionId:auth.session?.id,subject:auth.user?.id,done:false,resolve,reject}));};
window.__resolve=(id,result)=>{const item=window.__requests.find(value=>value.id===id);if(!item||item.done)throw Error('Missing request '+id);item.done=true;item.resolve(result);};
window.__reject=id=>{const item=window.__requests.find(value=>value.id===id);if(!item||item.done)throw Error('Missing request '+id);item.done=true;item.reject(Error('Synthetic uncertain transport'));};
export const readCatalogueImportAction=input=>window.__request('read',[input]);
export const changeCatalogueImportAction=command=>window.__request('save',[command]);
export const exportImportReportAction=input=>window.__request('report',[input]);
export const createImportUploadAction=()=>{throw Error('Upload outside this packet')};export const appendImportChunkAction=createImportUploadAction;export const finishImportUploadAction=createImportUploadAction;
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
      "use-intl",
    ].map((name) => ({
      find: new RegExp("^" + name + "$"),
      replacement: name === "use-intl" ? intl.resolve(name) : web.resolve(name),
    })),
  },
  plugins: [
    {
      name: "catalogue-import-deferred-fixture",
      enforce: "pre",
      resolveId(id, importer) {
        if (id === "@clerk/nextjs") return "\0settings:clerk";
        if (id === "next/navigation") return "\0settings:navigation";
        if (id === "next/link") return "\0settings:link";
        if (id === "next-intl") return "\0settings:intl";
        if (
          id === "./actions" &&
          importer?.replaceAll("\\", "/").includes("/catalogue-import/")
        )
          return "\0settings:actions";
        if (
          id === "./download" &&
          importer?.replaceAll("\\", "/").includes("/catalogue-import/")
        )
          return "\0import:download";
      },
      load(id) {
        if (id === "\0settings:clerk") return clerk;
        if (id === "\0settings:navigation") return navigation;
        if (id === "\0settings:actions") return actions;
        if (id === "\0import:download")
          return "window.__downloads=[];export const downloadCsv=(...args)=>window.__downloads.push(args);export const downloadTemplate=()=>{};export const downloadCategoryGuide=()=>{};";
        if (id === "\0settings:intl")
          return "export {useTranslations,useFormatter,useLocale,IntlProvider as NextIntlClientProvider} from 'use-intl';";
        if (id === "\0settings:link")
          return "import {createElement} from 'react';export default function Link(props){return createElement('a',props)}";
      },
    },
  ],
  build: {
    write: false,
    minify: false,
    lib: {
      entry: path.join(app, "tests/t56/catalogue-import-session-entry.tsx"),
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
  if (request.url === "/fixture.js") {
    response.setHeader("Content-Type", "text/javascript");
    response.end(code);
  } else {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(
      `<!doctype html><html><head><style>${css}</style></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>`,
    );
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { chromium } = req("@playwright/test");
const sellerId = "a0000000-0000-4000-8000-000000000001",
  importId = "a0000000-0000-4000-8000-000000000002";
const outcomes = [],
  failures = [],
  errors = [];
function result(marker = "CURRENT-PRIVATE", revision = 4, updates = {}) {
  return {
    ok: true,
    data: {
      id: importId,
      sellerId,
      name: marker + ".csv",
      state: "review",
      revision,
      total: 1,
      created: 0,
      ready: 1,
      invalid: 0,
      selected: 1,
      error: null,
      createdAt: "2026-10-10T00:00:00.000Z",
      after: 0,
      nextAfter: null,
      rowLimit: 1000,
      draftsRemaining: 10,
      canManage: true,
      uploaded: [0],
      sourceBytes: 100,
      sourceHash: "a".repeat(64),
      rows: [
        {
          number: 1,
          externalId: "PRIVATE-EXTERNAL",
          raw: { title: marker, price: "129.50" },
          payload: null,
          inventory: null,
          errors: [],
          selected: true,
          state: "ready",
          listingId: null,
        },
      ],
      ...updates,
    },
  };
}
async function request(page, kind, after = 0) {
  await page.waitForFunction(
    (w) =>
      window.__requests.some(
        (x) => x.kind === w.kind && x.id > w.after && !x.done,
      ),
    { kind, after },
  );
  return page.evaluate(
    (w) => {
      const x = window.__requests
        .filter((x) => x.kind === w.kind && x.id > w.after && !x.done)
        .at(-1);
      return { id: x.id, args: x.args };
    },
    { kind, after },
  );
}
async function resolve(page, item, value) {
  await page.evaluate(
    ([id, value]) => window.__resolve(id, value),
    [item.id, value],
  );
}
async function read(page, after = 0, value = result()) {
  const item = await request(page, "read", after);
  await resolve(page, item, value);
  await page.locator("[data-catalogue-import]").waitFor({ state: "visible" });
  return item;
}
async function open(page) {
  await page.goto(
    `http://127.0.0.1:${server.address().port}/app/sellers/${sellerId}/imports/${importId}?lang=en`,
  );
  await read(page);
}
const button = (page, name) => page.getByRole("button", { name, exact: true });
const count = (page) =>
  page.evaluate(
    () => window.__requests.filter((x) => x.kind === "save").length,
  );
async function begin(page) {
  await button(page, "Select the first 1 valid rows").click();
  return request(page, "save");
}
async function hidden(page) {
  await page.waitForFunction(
    () =>
      !document.querySelector("[data-catalogue-import]") &&
      !document.querySelector("dialog"),
  );
}
async function scenario(name, run) {
  try {
    await run();
    outcomes.push(name);
  } catch (error) {
    failures.push({ scenario: name, error: error.message });
  }
}
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(4000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue()
      : route.abort(),
  );
  await scenario("unknown command survives later CONFLICT", async () => {
    await open(page);
    const original = await begin(page);
    await page.evaluate((id) => window.__reject(id), original.id);
    await hidden(page);
    await read(page, original.id, result("CURRENT-AFTER-UNKNOWN", 5));
    await button(page, "Retry original change").click();
    const retry = await request(page, "save", original.id);
    assert.deepEqual(
      retry.args,
      original.args,
      "retry must preserve original revision and UUID",
    );
    await resolve(page, retry, { ok: false, code: "CONFLICT" });
    await hidden(page);
    await read(page, retry.id, result("CURRENT-AFTER-CONFLICT", 6));
    await button(page, "Retry original change").click();
    const again = await request(page, "save", retry.id);
    assert.deepEqual(
      again.args,
      original.args,
      "CONFLICT cannot erase uncertain original command",
    );
  });
  await scenario(
    "initial private rows are absent until a current read",
    async () => {
      await page.goto(
        `http://127.0.0.1:${server.address().port}/app/sellers/${sellerId}/imports/${importId}?lang=en`,
      );
      await request(page, "read");
      await hidden(page);
      await read(page);
    },
  );
  await scenario(
    "access-denied retry keeps uncertainty through current recovery",
    async () => {
      await open(page);
      const original = await begin(page);
      await page.evaluate((id) => window.__reject(id), original.id);
      await hidden(page);
      await read(page, original.id);
      await button(page, "Retry original change").click();
      const retry = await request(page, "save", original.id);
      await resolve(page, retry, { ok: false, code: "FORBIDDEN" });
      await hidden(page);
      await read(page, retry.id, result("REAUTHORIZED", 7));
      assert.equal(await count(page), 2);
      await button(page, "Retry original change").click();
      assert.deepEqual(
        (await request(page, "save", retry.id)).args,
        original.args,
      );
    },
  );
  await scenario(
    "deliberate adoption enables only a later new command",
    async () => {
      await open(page);
      const original = await begin(page);
      await page.evaluate((id) => window.__reject(id), original.id);
      await hidden(page);
      await read(page, original.id, result("CURRENT-TO-ADOPT", 8));
      assert.equal(await count(page), 1);
      assert.equal(
        await button(page, "Select the first 1 valid rows").isDisabled(),
        true,
      );
      await button(page, "Use current import").click();
      assert.equal(await count(page), 1);
      const next = await begin(page);
      assert.notEqual(next.args[0].requestId, original.args[0].requestId);
      assert.equal(next.args[0].expectedRevision, 8);
    },
  );
  await scenario(
    "same-ID resources reject stale success and cannot unlock newer retry",
    async () => {
      await open(page);
      const original = await begin(page);
      await page.evaluate(() => window.__auth.set());
      await hidden(page);
      await read(page, original.id, result("CURRENT-RESOURCE", 5));
      await button(page, "Retry original change").click();
      const retry = await request(page, "save", original.id);
      await resolve(page, original, {
        ok: true,
        data: { id: importId, revision: 5 },
      });
      assert.equal(await button(page, "Refresh").isDisabled(), true);
      assert.equal(
        await page.getByText("Changes saved.", { exact: true }).count(),
        0,
      );
      await resolve(page, retry, {
        ok: true,
        data: { id: importId, revision: 6 },
      });
      await read(page, retry.id, result("ACK-CURRENT", 6));
    },
  );
  await scenario(
    "stale exception and finally cannot change newer operation",
    async () => {
      await open(page);
      const original = await begin(page);
      await page.evaluate(() =>
        window.__auth.set("synthetic-human-A", "session-B"),
      );
      await hidden(page);
      await read(page, original.id);
      await button(page, "Retry original change").click();
      const retry = await request(page, "save", original.id);
      await page.evaluate((id) => window.__reject(id), original.id);
      assert.equal(await button(page, "Refresh").isDisabled(), true);
      assert.equal(await page.getByRole("alert").count(), 0);
      await resolve(page, retry, {
        ok: true,
        data: { id: importId, revision: 5 },
      });
      await read(page, retry.id, result("CURRENT-SAVED", 5));
    },
  );
  await scenario(
    "hidden acknowledgement stays absent and never auto writes",
    async () => {
      await open(page);
      const original = await begin(page);
      await page.evaluate(() => window.__visibility("hidden"));
      await hidden(page);
      await resolve(page, original, {
        ok: true,
        data: { id: importId, revision: 5 },
      });
      await hidden(page);
      await page.evaluate(() => window.__visibility("visible"));
      await read(page, original.id, result("VISIBLE-CURRENT", 5));
      assert.equal(await count(page), 1);
      await button(page, "Retry original change").click();
      assert.deepEqual(
        (await request(page, "save", original.id)).args,
        original.args,
      );
    },
  );
  await scenario(
    "query and pagination changes retain exact resource journal",
    async () => {
      await open(page);
      const original = await begin(page);
      await page.evaluate(() => {
        window.__route(location.pathname + "?lang=en&after=1");
        window.__replaceInitial({ after: 1 });
      });
      await hidden(page);
      await resolve(page, original, { ok: false, code: "FORBIDDEN" });
      await read(page, original.id, result("PAGE-CURRENT", 5, { after: 1 }));
      await button(page, "Retry original change").click();
      assert.deepEqual(
        (await request(page, "save", original.id)).args,
        original.args,
      );
    },
  );
  await scenario(
    "another human cannot recover former command or row draft",
    async () => {
      await open(page);
      await button(page, "Edit row").click();
      await page
        .locator("dialog[open] input[name=title]")
        .fill("HUMAN-A-DRAFT");
      await page.evaluate(() => {
        window.__auth.set("synthetic-human-B", "session-B");
        window.__replaceActor("synthetic-human-B");
      });
      await hidden(page);
      await read(page, 0, result("HUMAN-B-CURRENT"));
      assert.equal(await page.locator("dialog").count(), 0);
      assert.equal(
        await page.getByText("HUMAN-A-DRAFT", { exact: true }).count(),
        0,
      );
      await page.evaluate(() => {
        window.__auth.set();
        window.__replaceActor("synthetic-human-A");
      });
      await hidden(page);
      await read(page, 0, result("RETURNED-A-CURRENT"));
      assert.equal(await page.locator("dialog").count(), 0);
    },
  );
  await scenario(
    "same-human row draft survives qualification without private hidden DOM",
    async () => {
      await open(page);
      await button(page, "Edit row").click();
      await page
        .locator("dialog[open] input[name=title]")
        .fill("SAME-HUMAN-DRAFT");
      await page.evaluate(() => window.__auth.set());
      await hidden(page);
      await read(page, 0, result("FRESH-RESOURCE"));
      assert.equal(
        await page.locator("dialog[open] input[name=title]").inputValue(),
        "SAME-HUMAN-DRAFT",
      );
    },
  );
  await scenario(
    "report download rejects obsolete resource acknowledgement",
    async () => {
      await open(page);
      await button(page, "Download row report").click();
      const old = await request(page, "report");
      await page.evaluate(() => window.__auth.set());
      await hidden(page);
      await read(page, old.id);
      await resolve(page, old, {
        ok: true,
        data: { name: "PRIVATE.csv", csv: "private contents" },
      });
      assert.equal(await page.evaluate(() => window.__downloads.length), 0);
    },
  );
  await scenario("wrong-import acknowledgement remains uncertain", async () => {
    await open(page);
    const original = await begin(page);
    await resolve(page, original, {
      ok: true,
      data: { id: "b0000000-0000-4000-8000-000000000002", revision: 5 },
    });
    await hidden(page);
    await read(page, original.id, result("CORRECT-IMPORT", 5));
    assert.equal(
      await page.getByText("Changes saved.", { exact: true }).count(),
      0,
    );
    await button(page, "Retry original change").click();
    assert.deepEqual(
      (await request(page, "save", original.id)).args,
      original.args,
    );
  });
  await scenario(
    "silent expired session cannot dispatch a mutation or report",
    async () => {
      await open(page);
      await page.evaluate(() =>
        window.__auth.silent("synthetic-human-A", "session-A", "ended"),
      );
      await button(page, "Select the first 1 valid rows").click();
      await button(page, "Download row report").click();
      assert.equal(await count(page), 0);
      assert.equal(
        await page.evaluate(
          () => window.__requests.filter((x) => x.kind === "report").length,
        ),
        0,
      );
    },
  );
  await scenario(
    "terminal current state still offers exact retry and deliberate adoption",
    async () => {
      await open(page);
      const original = await begin(page);
      await page.evaluate((id) => window.__reject(id), original.id);
      await hidden(page);
      await read(
        page,
        original.id,
        result("TERMINAL-CURRENT", 8, {
          state: "completed",
          selected: 0,
          ready: 0,
          created: 1,
        }),
      );
      assert.equal(
        await button(page, "Retry original change").isVisible(),
        true,
      );
      await button(page, "Retry original change").click();
      assert.deepEqual(
        (await request(page, "save", original.id)).args,
        original.args,
      );
    },
  );
  await scenario(
    "unmounted presenter ignores late acknowledgement",
    async () => {
      await open(page);
      const original = await begin(page);
      await page.evaluate(() => window.__unmount());
      await resolve(page, original, {
        ok: true,
        data: { id: importId, revision: 5 },
      });
      assert.equal(await page.locator("#root").textContent(), "");
    },
  );
  await scenario(
    "unknown row edit stays concealed during report comparison",
    async () => {
      await open(page);
      await button(page, "Edit row").click();
      await page
        .locator("dialog[open] input[name=title]")
        .fill("ORIGINAL-ROW-DRAFT");
      await button(page, "Save row").click();
      const original = await request(page, "save");
      await page.evaluate((id) => window.__reject(id), original.id);
      await hidden(page);
      await read(page, original.id, result("CURRENT-ROW-TO-COMPARE", 5));
      assert.equal(await page.locator("dialog").count(), 0);
      await button(page, "Download row report").click();
      const report = await request(page, "report", original.id);
      assert.equal(await page.locator("dialog").count(), 0);
      assert.equal(
        await button(page, "Retry original change").isDisabled(),
        true,
      );
      await resolve(page, report, {
        ok: true,
        data: { name: "CURRENT.csv", csv: "current row data" },
      });
      assert.equal(await page.evaluate(() => window.__downloads.length), 1);
      await button(page, "Retry original change").click();
      const retry = await request(page, "save", report.id);
      assert.deepEqual(retry.args, original.args);
      assert.equal(await page.locator("dialog").count(), 0);
    },
  );
  await scenario(
    "batched blur and focus requires and accepts a fresh read",
    async () => {
      await open(page);
      await page.evaluate(() => {
        window.dispatchEvent(new window.Event("blur"));
        window.dispatchEvent(new window.Event("focus"));
      });
      await hidden(page);
      await read(page, 0, result("FOREGROUND-CURRENT"));
      assert.equal(await count(page), 0);
    },
  );
  await scenario(
    "accepted uppercase UUID route qualifies current import",
    async () => {
      await page.goto(
        `http://127.0.0.1:${server.address().port}/app/sellers/${sellerId.toUpperCase()}/imports/${importId.toUpperCase()}?lang=en`,
      );
      await hidden(page);
      await read(page, 0, result("NORMALIZED-OWNER"));
      assert.equal(await count(page), 0);
    },
  );
  await scenario(
    "current report denial conceals rows until a fresh read",
    async () => {
      await open(page);
      await button(page, "Download row report").click();
      const item = await request(page, "report");
      await resolve(page, item, { ok: false, code: "FORBIDDEN" });
      await hidden(page);
      assert.equal(await page.evaluate(() => window.__downloads.length), 0);
      await read(page, item.id, result("REPORT-REAUTHORIZED"));
      assert.equal(await count(page), 0);
    },
  );
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
console.log(
  JSON.stringify({ outcomes, failures, pageErrors: errors }, null, 2),
);
assert.equal(failures.length, 0);
assert.equal(errors.length, 0);
