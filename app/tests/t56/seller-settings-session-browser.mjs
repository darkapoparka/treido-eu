/* global window: readonly, document: readonly, location: readonly */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { pathToFileURL, URL } from "node:url";
import path from "node:path";
import process from "node:process";
import console from "node:console";

// Actual settings presenters and shared read hook; synthetic deferred resources
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
export const useSearchParams=()=>new URLSearchParams(useSyncExternalStore(subscribe,()=>location.search));
window.__route=path=>{history.pushState({},'',path);flushSync(()=>{listeners.forEach(listener=>listener());window.dispatchEvent(new Event('popstate'));});};
`;
const actions = `
window.__requests=[];let sequence=0;
window.__request=(kind,args)=>{const auth=window.__auth.current();return new Promise((resolve,reject)=>window.__requests.push({id:++sequence,kind,args:JSON.parse(JSON.stringify(args)),sessionId:auth.session?.id,subject:auth.user?.id,done:false,resolve,reject}));};
window.__resolve=(id,result)=>{const item=window.__requests.find(value=>value.id===id);if(!item||item.done)throw Error('Missing request '+id);item.done=true;item.resolve(result);};
window.__reject=id=>{const item=window.__requests.find(value=>value.id===id);if(!item||item.done)throw Error('Missing request '+id);item.done=true;item.reject(Error('Synthetic uncertain transport'));};
export const readServiceSettingsAction=(sellerId,section)=>window.__request('read',[sellerId,section]);
export const saveServiceSettingsAction=command=>window.__request('save',[command]);
export const readPersonalProfileAction=sellerId=>window.__request('read',[sellerId]);
export const savePersonalProfileAction=command=>window.__request('save',[command]);
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
      name: "seller-settings-deferred-fixture",
      enforce: "pre",
      resolveId(id, importer) {
        if (id === "@clerk/nextjs") return "\0settings:clerk";
        if (id === "next/navigation") return "\0settings:navigation";
        if (id === "next/link") return "\0settings:link";
        if (id === "next-intl") return "\0settings:intl";
        if (
          id === "./use-settings-session" &&
          importer?.replaceAll("\\", "/").includes("/seller-settings/")
        )
          return "\0settings:session-observer";
        if (
          (id === "./actions" &&
            importer
              ?.replaceAll("\\", "/")
              .endsWith("/seller-settings/form.tsx")) ||
          (id === "./personal-profile-actions" &&
            importer
              ?.replaceAll("\\", "/")
              .endsWith("/seller-settings/personal-profile-form.tsx"))
        )
          return "\0settings:actions";
      },
      load(id) {
        if (id === "\0settings:clerk") return clerk;
        if (id === "\0settings:navigation") return navigation;
        if (id === "\0settings:actions") return actions;
        if (id === "\0settings:session-observer")
          return `import {useSettingsSession as actual} from ${JSON.stringify(path.join(app, "apps/web/src/features/seller-settings/use-settings-session.ts"))};
export function useSettingsSession(...args){const value=actual(...args);(window.__settingsRefreshes??=[]).push(value.refresh);(window.__settingsSessions??=[]).push(value);return value;}`;
        if (id === "\0settings:intl")
          return "export {useTranslations,useFormatter,IntlProvider as NextIntlClientProvider} from 'use-intl';";
        if (id === "\0settings:link")
          return "import {createElement} from 'react';export default function Link(props){return createElement('a',props)}";
      },
    },
  ],
  build: {
    write: false,
    minify: false,
    lib: {
      entry: path.join(app, "tests/t56/seller-settings-session-entry.tsx"),
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
const sellerA = "a0000000-0000-4000-8000-000000000001",
  sellerB = "b0000000-0000-4000-8000-000000000001",
  outcomes = [],
  failures = [],
  errors = [];
let browser;
let mode = "service";
const selector = () =>
  mode === "profile" ? "[data-personal-profile]" : "[data-service-settings]";
const input = (page) =>
  page.locator(
    mode === "profile" ? "input[name=name]" : "input[name=publicEmail]",
  );
const save = (page) =>
  page.getByRole("button", {
    name: mode === "profile" ? "Save profile" : "Save settings",
    exact: true,
  });
const markerValue = (marker) =>
  mode === "profile" ? marker : marker.toLowerCase() + "@example.test";
function result(marker = "CURRENT-PRIVATE", sellerId = sellerA, revision = 4) {
  const shared = { sellerId, revision };
  return {
    ok: true,
    data:
      mode === "profile"
        ? {
            ...shared,
            profile: {
              name: markerValue(marker),
              locality: "PRIVATE-LOCALITY",
              description: "PRIVATE-DESCRIPTION",
            },
          }
        : {
            ...shared,
            name: marker,
            section: "contact",
            savedAt: null,
            payload: {
              published: false,
              publicEmail: markerValue(marker),
              publicPhone: "",
              contactNote: "PRIVATE-DESCRIPTION",
            },
          },
  };
}
async function pending(page, kind, after = 0) {
  await page.waitForFunction(
    (wanted) =>
      window.__requests.some(
        (item) =>
          item.kind === wanted.kind && item.id > wanted.after && !item.done,
      ),
    { kind, after },
  );
  return page.evaluate(
    (wanted) => {
      const item = window.__requests
        .filter(
          (value) =>
            value.kind === wanted.kind &&
            value.id > wanted.after &&
            !value.done,
        )
        .at(-1);
      return { id: item.id, args: item.args, sessionId: item.sessionId };
    },
    { kind, after },
  );
}
async function resolve(page, item, value) {
  await page.evaluate(
    async ([id, data]) => {
      window.__resolve(id, data);
      await Promise.resolve();
    },
    [item.id, value],
  );
}
async function hidden(page) {
  await page.waitForFunction(
    (target) => !document.querySelector(target),
    selector(),
    { timeout: 2000 },
  );
  assert.equal(
    await page.locator(selector()).count(),
    0,
    "private projection must be absent, including hidden DOM",
  );
}
async function ready(
  page,
  marker = "CURRENT-PRIVATE",
  sellerId = sellerA,
  after = 0,
) {
  for (let index = 0; index < 6; index++) {
    const read = await pending(page, "read", after);
    after = read.id;
    await resolve(page, read, result(marker, sellerId));
    await page.waitForFunction(
      (target) => {
        const field = document.querySelector(target);
        return (
          (field && !field.closest("[hidden]")) ||
          window.__requests.some((item) => item.kind === "read" && !item.done)
        );
      },
      mode === "profile" ? "input[name=name]" : "input[name=publicEmail]",
    );
    if (await input(page).isVisible()) return read;
  }
  throw Error("Current settings read did not settle");
}
async function open(page, checkInitial = false) {
  await page.goto(
    `http://127.0.0.1:${server.address().port}/app/sellers/${sellerA}/settings/${mode}?lang=en&fixture=${mode}`,
  );
  await pending(page, "read");
  if (checkInitial) await hidden(page);
  await ready(page);
}
async function begin(page, text = "ORIGINAL-DRAFT") {
  await input(page).fill(markerValue(text));
  await save(page).click();
  return pending(page, "save");
}
const count = (page) =>
  page.evaluate(
    () => window.__requests.filter((item) => item.kind === "save").length,
  );
async function retry(page, original) {
  assert.equal(
    await input(page).inputValue(),
    mode === "profile"
      ? original.args[0].profile.name
      : original.args[0].payload.publicEmail,
  );
  assert.equal(
    await count(page),
    1,
    "restoration must never automatically resend",
  );
  await save(page).click();
  const retried = await pending(page, "save", original.id);
  assert.deepEqual(
    retried.args,
    original.args,
    "retry preserves original UUID, revision and fields",
  );
  return retried;
}
async function scenario(name, run) {
  try {
    await run();
    outcomes.push(mode + ": " + name);
  } catch (error) {
    failures.push({ scenario: mode + ": " + name, error: error.message });
  }
}
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
  for (mode of ["service", "profile"]) {
    await scenario(
      "retained old editing callbacks cannot erase or dispatch under newer resources",
      async () => {
        await open(page);
        await page.evaluate(() => {
          window.__oldSettings = window.__settingsSessions.at(-1);
        });
        const original = await begin(page);
        await page.evaluate(() => window.__auth.set());
        await hidden(page);
        await ready(page, "CALLBACK-CURRENT", sellerA, original.id);
        const rejected = await page.evaluate(async (command) => {
          const edit = window.__oldSettings.edit(),
            clear = window.__oldSettings.clearAttempt();
          await window.__oldSettings.submit(command, () => {
            throw Error("Obsolete callback accepted");
          });
          return { edit, clear };
        }, original.args[0]);
        assert.deepEqual(rejected, { edit: false, clear: false });
        assert.equal(await count(page), 1);
        assert.equal(await input(page).isVisible(), true);
        await retry(page, original);
      },
    );
    await scenario(
      "retained prior-query refresh cannot conceal current qualified data",
      async () => {
        await open(page);
        await page.evaluate((fixture) => {
          window.__oldRefresh = window.__settingsRefreshes.at(-1);
          window.__route(
            location.pathname + `?lang=en&fixture=${fixture}&view=next`,
          );
        }, mode);
        await hidden(page);
        await ready(page, "QUERY-READ-CURRENT");
        const reads = await page.evaluate(
          () => window.__requests.filter((item) => item.kind === "read").length,
        );
        await page.evaluate(() => window.__oldRefresh());
        assert.equal(await input(page).isVisible(), true);
        assert.equal(
          await page.evaluate(
            () =>
              window.__requests.filter((item) => item.kind === "read").length,
          ),
          reads,
        );
      },
    );
    await scenario(
      "retained prior-frame refresh cannot conceal current qualified data",
      async () => {
        await open(page);
        await page.evaluate(() => {
          window.__oldRefresh = window.__settingsRefreshes.at(-1);
          window.__replaceInitial();
        });
        await hidden(page);
        await ready(page, "FRAME-READ-CURRENT");
        const reads = await page.evaluate(
          () => window.__requests.filter((item) => item.kind === "read").length,
        );
        await page.evaluate(() => window.__oldRefresh());
        assert.equal(await input(page).isVisible(), true);
        assert.equal(
          await page.evaluate(
            () =>
              window.__requests.filter((item) => item.kind === "read").length,
          ),
          reads,
        );
      },
    );
    await scenario("initial private DOM waits for current read", async () => {
      await open(page, true);
      assert.equal(
        await input(page).inputValue(),
        markerValue("CURRENT-PRIVATE"),
      );
    });
    await scenario(
      "session replacement fences stale success and permits exact explicit retry",
      async () => {
        await open(page);
        const old = await begin(page);
        await page.evaluate(() =>
          window.__auth.set("synthetic-human-A", "session-B"),
        );
        await hidden(page);
        await resolve(page, old, result("OBSOLETE-ACK", sellerA, 9));
        await hidden(page);
        await ready(page, "SESSION-B-CURRENT", sellerA, old.id);
        const current = await retry(page, old);
        await resolve(page, current, result("SAVED-CURRENT", sellerA, 5));
        await page
          .getByRole("status")
          .filter({
            hasText:
              mode === "profile" ? "Seller profile saved." : "Settings saved.",
          })
          .waitFor();
        assert.equal(
          (await page.locator("body").textContent()).includes("OBSOLETE-ACK"),
          false,
        );
      },
    );
    await scenario(
      "batched A-B-A resources fence success/finally of an older operation",
      async () => {
        await open(page);
        const old = await begin(page);
        await page.evaluate(() => window.__auth.batchRoundTrip());
        await hidden(page);
        await ready(page, "ROUNDTRIP-CURRENT", sellerA, old.id);
        const current = await retry(page, old);
        await resolve(page, old, result("OBSOLETE-ACK", sellerA, 9));
        assert.equal(
          await page
            .getByRole("button", { name: "Saving…", exact: true })
            .isDisabled(),
          true,
        );
        await resolve(page, current, result("SAVED-CURRENT", sellerA, 5));
      },
    );
    await scenario(
      "identical resource IDs still require fresh authority",
      async () => {
        await open(page);
        const old = await begin(page);
        await page.evaluate(() => window.__auth.set());
        await hidden(page);
        await resolve(page, old, result("RESOURCE-OBSOLETE", sellerA, 9));
        await ready(page, "RESOURCE-CURRENT", sellerA, old.id);
        await retry(page, old);
      },
    );
    await scenario(
      "stale catch/finally cannot add errors or unlock newer work",
      async () => {
        await open(page);
        const old = await begin(page);
        await page.evaluate(() =>
          window.__auth.set("synthetic-human-A", "session-B"),
        );
        await hidden(page);
        await ready(page, "NEWER-CURRENT", sellerA, old.id);
        const current = await retry(page, old);
        await page.evaluate((id) => window.__reject(id), old.id);
        assert.equal(
          await page
            .getByRole("button", { name: "Saving…", exact: true })
            .isDisabled(),
          true,
        );
        assert.equal(await page.getByRole("alert").count(), 0);
        await resolve(page, current, result("SAVED-CURRENT", sellerA, 5));
      },
    );
    await scenario(
      "hidden completion stays absent and requires read before deliberate retry",
      async () => {
        await open(page);
        const old = await begin(page);
        await page.evaluate(() => window.__visibility("hidden"));
        await hidden(page);
        await resolve(page, old, result("HIDDEN-ACK", sellerA, 9));
        await hidden(page);
        await page.evaluate(() => window.__visibility("visible"));
        await ready(page, "VISIBLE-CURRENT", sellerA, old.id);
        await retry(page, old);
      },
    );
    await scenario(
      "uncertain transport reads only before exact deliberate retry",
      async () => {
        await open(page);
        const old = await begin(page);
        await page.evaluate((id) => window.__reject(id), old.id);
        await hidden(page);
        await ready(page, "UNCERTAIN-CURRENT", sellerA, old.id);
        const retried = await retry(page, old);
        await resolve(page, retried, { ok: false, code: "FORBIDDEN" });
        await hidden(page);
        await ready(page, "RETRY-REAUTHORIZED", sellerA, retried.id);
        assert.equal(await count(page), 2, "access recovery must not resend");
        assert.equal(
          await input(page).evaluate((field) => field.readOnly),
          true,
        );
        await save(page).click();
        const again = await pending(page, "save", retried.id);
        assert.deepEqual(
          again.args,
          old.args,
          "a denied retry preserves the original uncertain command",
        );
      },
    );
    await scenario(
      "same-seller frame replacement rejects obsolete denial",
      async () => {
        await open(page);
        const old = await begin(page);
        await page.evaluate(() => window.__replaceInitial());
        await hidden(page);
        await resolve(page, old, { ok: false, code: "FORBIDDEN" });
        await ready(page, "FRAME-CURRENT", sellerA, old.id);
        await retry(page, old);
      },
    );
    await scenario(
      "another seller never receives prior draft; original command can return",
      async () => {
        await open(page);
        const old = await begin(page);
        await page.evaluate(
          ([seller, fixture]) => {
            window.__route(
              `/app/sellers/${seller}/settings/${fixture}?lang=en&fixture=${fixture}`,
            );
            window.__replaceInitial(seller);
          },
          [sellerB, mode],
        );
        await hidden(page);
        await ready(page, "SELLER-B-CURRENT", sellerB, old.id);
        assert.equal(
          await input(page).inputValue(),
          markerValue("SELLER-B-CURRENT"),
        );
        await resolve(page, old, result("SELLER-A-OBSOLETE", sellerA, 9));
        await page.evaluate(
          ([seller, fixture]) => {
            window.__route(
              `/app/sellers/${seller}/settings/${fixture}?lang=en&fixture=${fixture}`,
            );
            window.__replaceInitial(seller);
          },
          [sellerA, mode],
        );
        await hidden(page);
        await ready(page, "SELLER-A-CURRENT", sellerA, old.id);
        await retry(page, old);
      },
    );
    await scenario(
      "different human removes draft including later return",
      async () => {
        await open(page);
        const old = await begin(page);
        await page.evaluate(() =>
          window.__auth.set("synthetic-human-B", "human-B-session"),
        );
        await hidden(page);
        await page.evaluate(() =>
          window.__auth.set("synthetic-human-A", "new-human-A-session"),
        );
        await resolve(page, old, result("OTHER-HUMAN-OBSOLETE", sellerA, 9));
        await ready(page, "RETURNED-HUMAN-CURRENT", sellerA, old.id);
        assert.equal(
          await input(page).inputValue(),
          markerValue("RETURNED-HUMAN-CURRENT"),
        );
        assert.equal(await count(page), 1);
      },
    );
    await scenario(
      "late comparison cannot expose private old revision",
      async () => {
        await open(page);
        const old = await begin(page);
        await resolve(page, old, { ok: false, code: "CONFLICT" });
        await page
          .getByRole("button", { name: "Compare saved version", exact: true })
          .click();
        const comparison = await pending(page, "read", old.id);
        await page.evaluate(() =>
          window.__auth.set("synthetic-human-A", "session-B"),
        );
        await hidden(page);
        await resolve(
          page,
          comparison,
          result("PRIVATE-OLD-COMPARISON", sellerA, 99),
        );
        await ready(page, "COMPARISON-CURRENT", sellerA, comparison.id);
        assert.equal(
          (await page.locator("body").textContent()).includes(
            "Saved revision 99",
          ),
          false,
        );
      },
    );
    await scenario(
      "silent expired session cannot dispatch a write",
      async () => {
        await open(page);
        await input(page).fill(markerValue("UNSENT-DRAFT"));
        await page.evaluate(() =>
          window.__auth.silent("synthetic-human-A", "session-A", "ended"),
        );
        await save(page).click();
        assert.equal(await count(page), 0);
      },
    );
    await scenario(
      "query navigation invalidates current operation",
      async () => {
        await open(page);
        const old = await begin(page);
        await page.evaluate(
          (fixture) =>
            window.__route(
              location.pathname + `?lang=en&fixture=${fixture}&view=other`,
            ),
          mode,
        );
        await hidden(page);
        await resolve(page, old, result("QUERY-OBSOLETE", sellerA, 9));
        await ready(page, "QUERY-CURRENT", sellerA, old.id);
        await retry(page, old);
      },
    );
    await scenario(
      "current authority denial removes private DOM until current read",
      async () => {
        await open(page);
        const old = await begin(page);
        await resolve(page, old, { ok: false, code: "FORBIDDEN" });
        await hidden(page);
        await page
          .getByRole("button", { name: "Refresh access", exact: true })
          .click();
        await ready(page, "REAUTHORIZED-CURRENT", sellerA, old.id);
        assert.equal(await count(page), 1);
      },
    );
    await scenario(
      "unmounted presenter ignores delayed acknowledgment",
      async () => {
        await open(page);
        const old = await begin(page);
        await page.evaluate(() => window.__unmount());
        await resolve(page, old, result("UNMOUNTED-ACK"));
        assert.equal(await page.locator("#root").textContent(), "");
      },
    );
  }
  console.log(
    JSON.stringify(
      {
        status: failures.length || errors.length ? "FAIL" : "PASS",
        scenarios: outcomes.length,
        outcomes,
        failures,
        pageErrors: errors,
      },
      null,
      2,
    ),
  );
  assert.deepEqual(failures, []);
  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
