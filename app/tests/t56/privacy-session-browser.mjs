/* global window: readonly, document: readonly, Event: readonly, PageTransitionEvent: readonly */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import path from "node:path";
import process from "node:process";
import console from "node:console";

// Real usePrivacy hook, synthetic Clerk and deferred actions. This packet does
// not qualify real identities, recent-authentication UI, providers or layout.
const app = process.cwd(),
  req = createRequire(path.join(app, "package.json")),
  web = createRequire(path.join(app, "apps/web/package.json")),
  vite = createRequire(req.resolve("vitest/config"));
const { build } = await import(pathToFileURL(vite.resolve("vite")).href);
const clerk = `
const listeners=new Set();
let state={user:{id:'human-A'},session:{id:'session-A',status:'active'}};
const clerk={get user(){return state.user},get session(){return state.session},
addListener(listener){listeners.add(listener);listener(state);return()=>listeners.delete(listener)}};
window.__auth={set(subject='human-A',id='session-A',status='active'){
state={user:subject?{id:subject}:null,session:id?{id,status}:null};
listeners.forEach(listener=>listener(state));}};
export const useClerk=()=>clerk;
export const useReverification=action=>action;
`;
const actions = `
window.__requests=[];let sequence=0;
function request(kind,args){return new Promise((resolve,reject)=>window.__requests.push({id:++sequence,kind,args,resolve,reject,done:false}))}
window.__resolve=(id,result)=>{const request=window.__requests.find(item=>item.id===id);if(!request||request.done)throw Error('Missing request '+id);request.done=true;request.resolve(result)};
window.__reject=id=>{const request=window.__requests.find(item=>item.id===id);if(!request||request.done)throw Error('Missing request '+id);request.done=true;request.reject(Error('Synthetic unavailable'))};
export const readPrivacyAction=prompt=>request('read',[prompt]);
export const changePrivacyAction=input=>request('change',[input]);
export const downloadPrivacyAction=input=>request('download',[input]);
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
      name: "privacy-session-deferred-fixture",
      enforce: "pre",
      resolveId(id, importer) {
        if (id === "@clerk/nextjs") return "\0privacy:clerk";
        if (
          id === "./actions" &&
          importer
            ?.replaceAll("\\", "/")
            .endsWith("/account-privacy/use-privacy.ts")
        )
          return "\0privacy:actions";
      },
      load(id) {
        if (id === "\0privacy:clerk") return clerk;
        if (id === "\0privacy:actions") return actions;
      },
    },
  ],
  build: {
    write: false,
    minify: false,
    lib: {
      entry: path.join(app, "tests/t56/privacy-session-entry.tsx"),
      formats: ["es"],
      fileName: "fixture",
    },
  },
});
const output = Array.isArray(generated)
    ? generated[0].output
    : generated.output,
  code = output.find((item) => item.type === "chunk").code;
const server = createServer((request, response) => {
  response.setHeader("Cache-Control", "no-store");
  if (request.url === "/fixture.js") {
    response.setHeader("Content-Type", "text/javascript");
    response.end(code);
  } else {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(
      '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>',
    );
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { chromium } = req("@playwright/test");
let browser;
const outcomes = [],
  errors = [];
const actorKey = "a".repeat(64);
function readResult(marker, revision = 1) {
  return {
    ok: true,
    data: {
      subject: "human-A",
      view: {
        actorKey,
        revision,
        checkedAt: marker,
        registrationNeeded: false,
        facts: null,
        exports: [],
        reviews: [],
        closures: [],
        historyLimited: false,
      },
    },
  };
}
function changeResult() {
  return {
    ok: true,
    data: {
      subject: "human-A",
      change: {
        acknowledgment: {
          revision: 2,
          kind: "review",
          resourceId: "a0000000-0000-4000-8000-000000000001",
          acceptedState: "review",
          expiresAt: null,
        },
      },
    },
  };
}
async function request(page, kind) {
  await page.waitForFunction(
    (wanted) =>
      window.__requests.some((item) => item.kind === wanted && !item.done),
    kind,
  );
  return page.evaluate((wanted) => {
    const item = window.__requests.find(
      (value) => value.kind === wanted && !value.done,
    );
    return { id: item.id, args: item.args };
  }, kind);
}
async function resolve(page, pending, result) {
  await page.evaluate(
    ([id, response]) => window.__resolve(id, response),
    [pending.id, result],
  );
}
async function shown(page, marker) {
  await page.waitForFunction(
    (text) => document.querySelector("#private-facts")?.textContent === text,
    marker,
  );
}
async function open(page) {
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  // A pageshow dispatched after hook mount may supersede the initial read.
  for (let attempt = 0; attempt < 3; attempt++) {
    await resolve(
      page,
      await request(page, "read"),
      readResult("A-private-current"),
    );
    await page.waitForFunction(
      () =>
        document.querySelector("#private-facts")?.textContent ===
          "A-private-current" ||
        window.__requests.some((item) => item.kind === "read" && !item.done),
    );
    if (
      (await page.locator("#private-facts").innerText()) === "A-private-current"
    )
      return;
  }
  throw new Error("Initial current privacy read did not settle");
}
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on("pageerror", (error) => errors.push(error.message));

  await open(page);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await shown(page, "concealed");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await resolve(
    page,
    await request(page, "read"),
    readResult("EXPLICIT-CURRENT"),
  );
  await shown(page, "EXPLICIT-CURRENT");
  outcomes.push(
    "Visible explicit Refresh recovers after blur without a focus event",
  );

  await page.evaluate(() => window.__auth.set("human-A", "session-A", "ended"));
  await shown(page, "concealed");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  assert.equal(
    await page.evaluate(
      () => window.__requests.filter((item) => !item.done).length,
    ),
    0,
  );
  await shown(page, "concealed");
  outcomes.push("Explicit Refresh cannot revive an ended current session");

  await open(page);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await shown(page, "concealed");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await resolve(page, await request(page, "read"), {
    ok: false,
    code: "UNAUTHENTICATED",
  });
  await page.waitForFunction(
    () => document.querySelector("#error")?.textContent === "UNAUTHENTICATED",
  );
  await shown(page, "concealed");
  outcomes.push(
    "Blur conceals facts; restored revoked-session read stays concealed",
  );

  await open(page);
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  const oldRead = await request(page, "read");
  await page.evaluate(() => window.__auth.set("human-A", "session-B"));
  await resolve(page, oldRead, readResult("OLD-SESSION-PRIVATE"));
  await shown(page, "concealed");
  await resolve(
    page,
    await request(page, "read"),
    readResult("NEW-SESSION-PRIVATE"),
  );
  await shown(page, "NEW-SESSION-PRIVATE");
  outcomes.push(
    "Same-human session replacement rejects old delayed read and revalidates",
  );

  await open(page);
  await page.getByRole("button", { name: "Review", exact: true }).click();
  const oldChange = await request(page, "change"),
    exact = oldChange.args[0];
  await page.evaluate(() => window.__auth.set("human-A", "session-B"));
  await resolve(page, oldChange, changeResult());
  await resolve(
    page,
    await request(page, "read"),
    readResult("CURRENT-AFTER-UNKNOWN", 2),
  );
  await shown(page, "CURRENT-AFTER-UNKNOWN");
  assert.equal(await page.locator("#acknowledgment").innerText(), "null");
  assert.deepEqual(
    JSON.parse(await page.locator("#pending").innerText()),
    exact,
  );
  await page.getByRole("button", { name: "Retry exact", exact: true }).click();
  const retry = await request(page, "change");
  assert.deepEqual(retry.args[0], exact);
  await resolve(page, retry, changeResult());
  await resolve(
    page,
    await request(page, "read"),
    readResult("CONFIRMED-AFTER-RETRY", 2),
  );
  await shown(page, "CONFIRMED-AFTER-RETRY");
  assert.equal(await page.locator("#pending").innerText(), "null");
  outcomes.push(
    "Old-session mutation acknowledgment is concealed; authorized retry retains exact command",
  );

  await open(page);
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    ),
  );
  await shown(page, "concealed");
  const restoreRead = await request(page, "read");
  await page.evaluate((id) => window.__reject(id), restoreRead.id);
  await page.waitForFunction(
    () => document.querySelector("#error")?.textContent === "NOT_AVAILABLE",
  );
  await shown(page, "concealed");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await resolve(
    page,
    await request(page, "read"),
    readResult("RESTORE-RETRY-CURRENT"),
  );
  await shown(page, "RESTORE-RETRY-CURRENT");
  outcomes.push(
    "Persisted pageshow revalidates; service failure stays concealed and retry recovers",
  );

  await open(page);
  await page.getByRole("button", { name: "Download", exact: true }).click();
  const oldDownload = await request(page, "download"),
    downloads = [];
  page.on("download", (download) =>
    downloads.push(download.suggestedFilename()),
  );
  await page.evaluate(() => window.__auth.set("human-A", "session-B"));
  await resolve(page, oldDownload, {
    ok: true,
    data: { subject: "human-A", body: '{"private":"old-session"}' },
  });
  await resolve(
    page,
    await request(page, "read"),
    readResult("CURRENT-AFTER-DOWNLOAD"),
  );
  await shown(page, "CURRENT-AFTER-DOWNLOAD");
  assert.deepEqual(downloads, []);
  outcomes.push("Download result from superseded session cannot create a file");

  await open(page);
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  const foreignRead = await request(page, "read");
  await page.evaluate(() => window.__auth.set("human-B", "session-B"));
  await resolve(page, foreignRead, readResult("FOREIGN-OLD-A-PRIVATE"));
  await shown(page, "concealed");
  assert.equal(
    await page.evaluate(
      () => window.__requests.filter((item) => !item.done).length,
    ),
    0,
  );
  outcomes.push(
    "Actor change conceals old facts and cannot resume that actor's read",
  );

  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: outcomes.length,
      outcomes,
      errors,
      fixtureOnly: true,
      realProvider: false,
      visualAcceptance: false,
    }),
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
