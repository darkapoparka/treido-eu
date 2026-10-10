/* global window: readonly, document: readonly, Event: readonly, PageTransitionEvent: readonly */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import path from "node:path";
import process from "node:process";
import console from "node:console";

// Real Comparison/SavedSearch providers and parsers with deferred synthetic
// Clerk/action transport. No identity API, database, provider or visual claim.
const app = process.cwd(),
  req = createRequire(path.join(app, "package.json")),
  web = createRequire(path.join(app, "apps/web/package.json")),
  vite = createRequire(req.resolve("vitest/config"));
const { build } = await import(pathToFileURL(vite.resolve("vite")).href);
const clerk = `
import {useSyncExternalStore} from 'react';import {flushSync} from 'react-dom';
const resources=new Set(),listeners=new Set();
let state={loaded:!location.search.includes('unloaded'),user:{id:'synthetic-human-A'},session:{id:'session-A',status:'active'}};
const clerk={get user(){return state.user},get session(){return state.session},addListener(listener){resources.add(listener);listener(state);return()=>resources.delete(listener)}};
window.__auth={set(subject='synthetic-human-A',id='session-A',status='active'){state={loaded:true,user:subject?{id:subject}:null,session:id?{id,status}:null};flushSync(()=>{resources.forEach(listener=>listener(state));listeners.forEach(listener=>listener());});},batchRoundTrip(){flushSync(()=>{for(const id of ['session-B','session-A']){state={loaded:true,user:{id:'synthetic-human-A'},session:{id,status:'active'}};resources.forEach(listener=>listener(state));listeners.forEach(listener=>listener());}});},silent(subject,id,status='active'){state={loaded:true,user:subject?{id:subject}:null,session:id?{id,status}:null};},current:()=>state};
export const useClerk=()=>clerk;
export function useAuth(){const current=useSyncExternalStore(listener=>{listeners.add(listener);return()=>listeners.delete(listener);},()=>state);return {isLoaded:current.loaded,userId:current.user?.id??null,sessionId:current.session?.id??null,isSignedIn:!!current.user&&current.session?.status==='active'};}
let visibility='visible';Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>visibility});
// Commit the simulated lifecycle event just like the simulated Clerk resource event.
window.__visibility=(value,emit=true)=>{visibility=value;if(emit)flushSync(()=>document.dispatchEvent(new Event('visibilitychange')));};
`;
const transport = `
window.__requests=[];let sequence=0;
window.__request=(feature,kind,args)=>{const auth=window.__auth.current();return new Promise((resolve,reject)=>window.__requests.push({id:++sequence,feature,kind,args,sessionId:auth.session?.id,subject:auth.user?.id,done:false,resolve,reject}));};
window.__resolve=(id,result)=>{const item=window.__requests.find(value=>value.id===id);if(!item||item.done)throw Error('Missing request '+id);item.done=true;item.resolve(result);};
window.__reject=id=>{const item=window.__requests.find(value=>value.id===id);if(!item||item.done)throw Error('Missing request '+id);item.done=true;item.reject(Error('Synthetic uncertain transport'));};
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
      name: "shopping-session-deferred-fixture",
      enforce: "pre",
      resolveId(id, importer) {
        if (id === "@clerk/nextjs") return "\0shopping:clerk";
        if (
          id === "./actions" &&
          importer
            ?.replaceAll("\\", "/")
            .endsWith("/shopping-tools/comparison-provider.tsx")
        )
          return "\0shopping:comparison";
        if (
          id === "./actions" &&
          importer
            ?.replaceAll("\\", "/")
            .endsWith("/saved-searches/provider.tsx")
        )
          return "\0shopping:search";
      },
      load(id) {
        if (id === "\0shopping:clerk") return clerk;
        if (id === "\0shopping:comparison")
          return (
            transport +
            "export const readComparisonAction=()=>window.__request('comparison','read',[]);export const changeComparisonAction=command=>window.__request('comparison','change',[command]);"
          );
        if (id === "\0shopping:search")
          return "export const readSavedSearchesAction=()=>window.__request('search','read',[]);export const changeSavedSearchAction=command=>window.__request('search','change',[command]);";
      },
    },
  ],
  build: {
    write: false,
    minify: false,
    lib: {
      entry: path.join(app, "tests/t56/shopping-session-entry.tsx"),
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
      '<!doctype html><html><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>',
    );
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { chromium } = req("@playwright/test");
const actor = "a".repeat(64),
  outcomes = [],
  errors = [];
let browser;
function readResult(feature, marker = "CURRENT", extras = {}) {
  return {
    ok: true,
    data: {
      subject: "synthetic-human-A",
      view: {
        actorKey: actor,
        revision: 1,
        checkedAt: marker,
        ...(feature === "comparison" ? { items: [] } : { searches: [] }),
        ...extras,
      },
    },
  };
}
function changeResult(feature) {
  return {
    ok: true,
    data: {
      subject: "synthetic-human-A",
      change: {
        revision: 2,
        replayed: false,
        ...(feature === "comparison"
          ? { selectionId: null }
          : { searchId: null, version: null }),
      },
    },
  };
}
function journal(feature) {
  return `treido-${feature === "comparison" ? "comparison" : "saved-search"}-recovery-v1:synthetic-human-A`;
}
async function pending(page, feature, kind, sessionId, afterId) {
  await page.waitForFunction(
    (wanted) =>
      window.__requests.some(
        (item) =>
          item.feature === wanted.feature &&
          item.kind === wanted.kind &&
          !item.done &&
          (wanted.afterId === undefined || item.id > wanted.afterId) &&
          (!wanted.sessionId || item.sessionId === wanted.sessionId),
      ),
    { feature, kind, sessionId, afterId },
  );
  return page.evaluate(
    (wanted) => {
      const items = window.__requests.filter(
        (value) =>
          value.feature === wanted.feature &&
          value.kind === wanted.kind &&
          !value.done &&
          (wanted.afterId === undefined || value.id > wanted.afterId) &&
          (!wanted.sessionId || value.sessionId === wanted.sessionId),
      );
      const item = items.at(wanted.afterId === undefined ? 0 : -1);
      return { id: item.id, args: item.args, sessionId: item.sessionId };
    },
    { feature, kind, sessionId, afterId },
  );
}
async function resolve(page, item, result) {
  await page.evaluate(
    async ([id, value]) => {
      window.__resolve(id, value);
      // Let the actual action consumer process the response before inspecting
      // its synchronous journal effects. Rendered outcomes wait on DOM below.
      await Promise.resolve();
    },
    [item.id, result],
  );
}
async function state(page, feature) {
  return page
    .locator("#" + feature)
    .evaluate((element) =>
      Object.fromEntries(
        ["status", "private", "pending", "busy", "feedback", "ack"].map(
          (key) => [key, element.querySelector("." + key).textContent],
        ),
      ),
    );
}
async function ready(page, feature, marker = "CURRENT") {
  await page.waitForFunction(
    (wanted) =>
      document.querySelector(`#${wanted.feature} .status`)?.textContent ===
        "ready" &&
      document.querySelector(`#${wanted.feature} .private`)?.textContent ===
        wanted.marker,
    { feature, marker },
  );
}
async function open(page) {
  if (await page.evaluate(() => !!window.__requests))
    await page.evaluate(() => window.sessionStorage.clear());
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  for (let attempt = 0; attempt < 4; attempt++) {
    for (const feature of ["comparison", "search"]) {
      const reads = await page.evaluate(
        (wanted) =>
          window.__requests
            .filter(
              (item) =>
                item.feature === wanted && item.kind === "read" && !item.done,
            )
            .map((item) => ({ id: item.id })),
        feature,
      );
      if (
        !reads.length &&
        (await page.locator(`#${feature} .status`).innerText()) !== "ready"
      )
        reads.push(await pending(page, feature, "read"));
      for (const item of reads) await resolve(page, item, readResult(feature));
    }
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll(".status")].every(
          (element) => element.textContent === "ready",
        ) ||
        window.__requests.some((item) => item.kind === "read" && !item.done),
    );
    if (
      (await state(page, "comparison")).status === "ready" &&
      (await state(page, "search")).status === "ready"
    )
      return;
  }
  throw Error("Initial current reads did not settle");
}
async function stored(page, feature) {
  return page.evaluate(
    (key) => window.sessionStorage.getItem(key),
    journal(feature),
  );
}
async function change(page, feature) {
  await page
    .getByRole("button", { name: "Change " + feature, exact: true })
    .click();
  const item = await pending(page, feature, "change");
  return { item, command: item.args[0], raw: await stored(page, feature) };
}
async function finishRetry(page, feature, original, marker) {
  await page
    .getByRole("button", { name: "Retry " + feature, exact: true })
    .click();
  const retry = await pending(page, feature, "change");
  assert.deepEqual(retry.args[0], original.command);
  assert.equal(await stored(page, feature), original.raw);
  await resolve(page, retry, changeResult(feature));
  await resolve(
    page,
    await pending(page, feature, "read"),
    readResult(feature, marker, { revision: 2 }),
  );
  await ready(page, feature, marker);
  assert.equal(await stored(page, feature), null);
}
async function countChanges(page, feature) {
  return page.evaluate(
    (wanted) =>
      window.__requests.filter(
        (item) => item.feature === wanted && item.kind === "change",
      ).length,
    feature,
  );
}
async function concealed(page, feature, status = "checking") {
  const current = await state(page, feature);
  assert.equal(current.status, status);
  assert.equal(current.private, "");
  assert.equal(current.pending, "false");
  assert.equal(current.busy, "false");
  assert.equal(current.ack, "null");
}
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  for (const feature of ["comparison", "search"]) {
    await open(page);
    await page
      .getByRole("button", { name: "Change " + feature, exact: true })
      .click();
    const oldChange = await pending(page, feature, "change"),
      original = oldChange.args[0],
      raw = await stored(page, feature);
    await page.evaluate(() =>
      window.__auth.set("synthetic-human-A", "session-B"),
    );
    const concealedSnapshot = await state(page, feature);
    assert.equal(
      concealedSnapshot.status,
      "checking",
      feature + " replacement must conceal current authority",
    );
    assert.equal(concealedSnapshot.private, "");
    assert.equal(concealedSnapshot.pending, "false");
    await page
      .getByRole("button", { name: "Retry " + feature, exact: true })
      .click();
    assert.equal(
      await page.evaluate(
        (wanted) =>
          window.__requests.filter(
            (item) => item.feature === wanted && item.kind === "change",
          ).length,
        feature,
      ),
      1,
    );
    await resolve(
      page,
      await pending(page, feature, "read", "session-B"),
      readResult(feature, "SESSION-B"),
    );
    await ready(page, feature, "SESSION-B");
    await page.evaluate(() =>
      window.__auth.set("synthetic-human-A", "session-A"),
    );
    const roundTripRead = await pending(page, feature, "read", "session-A");
    await resolve(page, oldChange, changeResult(feature));
    assert.equal(await stored(page, feature), raw);
    assert.equal((await state(page, feature)).ack, "null");
    await resolve(page, roundTripRead, readResult(feature, "ROUND-TRIP"));
    await ready(page, feature, "ROUND-TRIP");
    assert.equal((await state(page, feature)).pending, "true");
    await page
      .getByRole("button", { name: "Retry " + feature, exact: true })
      .click();
    const retry = await pending(page, feature, "change");
    assert.deepEqual(retry.args[0], original);
    assert.equal(await stored(page, feature), raw);
    await resolve(page, retry, changeResult(feature));
    await resolve(
      page,
      await pending(page, feature, "read"),
      readResult(feature, "CONFIRMED", { revision: 2 }),
    );
    await ready(page, feature, "CONFIRMED");
    assert.equal(await stored(page, feature), null);
    outcomes.push(
      feature +
        ": same-human A→B→A conceals stale authority, preserves original journal, and requires fresh read plus byte-identical explicit retry",
    );

    await open(page);
    const batched = await change(page, feature);
    await page.evaluate(() => window.__auth.batchRoundTrip());
    await concealed(page, feature);
    await resolve(
      page,
      await pending(page, feature, "read"),
      readResult(feature, "BATCHED"),
    );
    await ready(page, feature, "BATCHED");
    await page
      .getByRole("button", { name: "Retry " + feature, exact: true })
      .click();
    const currentRetry = await page.evaluate((wanted) => {
      const items = window.__requests.filter(
        (item) =>
          item.feature === wanted && item.kind === "change" && !item.done,
      );
      return { id: items.at(-1).id, args: items.at(-1).args };
    }, feature);
    assert.deepEqual(currentRetry.args[0], batched.command);
    await page.evaluate((id) => window.__reject(id), batched.item.id);
    assert.equal(
      (await state(page, feature)).busy,
      "true",
      "obsolete finalizer must not release the current retry",
    );
    assert.equal((await state(page, feature)).ack, "null");
    assert.equal(await stored(page, feature), batched.raw);
    await resolve(page, currentRetry, changeResult(feature));
    await resolve(
      page,
      await pending(page, feature, "read"),
      readResult(feature, "BATCH-CONFIRMED"),
    );
    await ready(page, feature, "BATCH-CONFIRMED");
    assert.equal(await stored(page, feature), null);
    outcomes.push(
      feature +
        ": a batched A→B→A invalidates the old operation even when the final Clerk projection is unchanged; its late exception cannot unlock the live retry",
    );

    await open(page);
    const hidden = await change(page, feature);
    await page.evaluate(() => window.__visibility("hidden"));
    await concealed(page, feature);
    await resolve(page, hidden.item, changeResult(feature));
    await concealed(page, feature);
    assert.equal(await stored(page, feature), hidden.raw);
    // No focus/visibility event: the user's visible Refresh must recover.
    await page.evaluate(() => window.__visibility("visible", false));
    await page
      .getByRole("button", { name: "Refresh " + feature, exact: true })
      .click();
    await resolve(
      page,
      await pending(page, feature, "read"),
      readResult(feature, "VISIBLE"),
    );
    await ready(page, feature, "VISIBLE");
    assert.equal(await countChanges(page, feature), 1);
    await finishRetry(page, feature, hidden, "VISIBLE-CONFIRMED");
    outcomes.push(
      feature +
        ": hidden acknowledgment stays concealed and retains the exact original command until visible explicit read and retry",
    );

    await open(page);
    const actorChange = await change(page, feature);
    const nextRender = await page.evaluate((wanted) => {
      window.__auth.set("synthetic-human-B", "other-session");
      const element = document.querySelector("#" + wanted);
      return Object.fromEntries(
        ["private", "pending", "busy", "feedback", "ack"].map((key) => [
          key,
          element.querySelector("." + key).textContent,
        ]),
      );
    }, feature);
    assert.deepEqual(nextRender, {
      private: "",
      pending: "false",
      busy: "false",
      feedback: "",
      ack: "null",
    });
    const nextActorRead = await pending(page, feature, "read", "other-session");
    const nextActorResult = readResult(feature, "OTHER-HUMAN", {
      actorKey: "b".repeat(64),
    });
    nextActorResult.data.subject = "synthetic-human-B";
    await resolve(page, nextActorRead, nextActorResult);
    await ready(page, feature, "OTHER-HUMAN");
    assert.equal((await state(page, feature)).pending, "false");
    await resolve(page, actorChange.item, changeResult(feature));
    assert.equal(await stored(page, feature), actorChange.raw);
    assert.equal((await state(page, feature)).ack, "null");
    await page.evaluate(() => window.__auth.set());
    await resolve(
      page,
      await pending(page, feature, "read", "session-A"),
      readResult(feature, "NEW-ACTOR-KEY", { actorKey: "c".repeat(64) }),
    );
    await ready(page, feature, "NEW-ACTOR-KEY");
    await page
      .getByRole("button", { name: "Retry " + feature, exact: true })
      .click();
    assert.equal(
      await countChanges(page, feature),
      1,
      "a current session alone cannot authorize the old actorKey",
    );
    assert.equal(await stored(page, feature), actorChange.raw);
    await page
      .getByRole("button", { name: "Refresh " + feature, exact: true })
      .click();
    await resolve(
      page,
      await pending(page, feature, "read"),
      readResult(feature, "ORIGINAL-ACTOR"),
    );
    await ready(page, feature, "ORIGINAL-ACTOR");
    await finishRetry(page, feature, actorChange, "ACTOR-CONFIRMED");
    outcomes.push(
      feature +
        ": another human cannot see or consume the first actor's recovery, and a changed server actorKey blocks its retry",
    );

    await open(page);
    let supersededRead = null;
    if (feature === "search") {
      // A background refresh retains the qualified Saved Search view. The
      // following mutation invalidates this read without settling its transport.
      await page
        .getByRole("button", { name: "Refresh search", exact: true })
        .click();
      supersededRead = await pending(page, feature, "read");
    }
    const denied = await change(page, feature);
    const beforeRefresh = await page.evaluate(
      () => window.__requests.at(-1)?.id ?? 0,
    );
    await page
      .getByRole("button", { name: "Refresh " + feature, exact: true })
      .click();
    const currentDeniedRead = await pending(
      page,
      feature,
      "read",
      undefined,
      beforeRefresh,
    );
    assert.ok(currentDeniedRead.id > beforeRefresh);
    if (supersededRead)
      assert.notEqual(currentDeniedRead.id, supersededRead.id);
    await resolve(page, currentDeniedRead, {
      ok: false,
      code: "FORBIDDEN",
    });
    await page.waitForFunction(
      (wanted) =>
        document.querySelector(`#${wanted} .status`)?.textContent === "denied",
      feature,
    );
    await concealed(page, feature, "denied");
    assert.equal(await stored(page, feature), denied.raw);
    if (supersededRead) {
      await resolve(
        page,
        supersededRead,
        readResult(feature, "STALE-BACKGROUND"),
      );
      await concealed(page, feature, "denied");
      assert.equal(await stored(page, feature), denied.raw);
    }
    await resolve(page, denied.item, changeResult(feature));
    await concealed(page, feature, "denied");
    assert.equal(await stored(page, feature), denied.raw);
    await page
      .getByRole("button", { name: "Refresh " + feature, exact: true })
      .click();
    await resolve(
      page,
      await pending(page, feature, "read"),
      readResult(feature, "RESTORED"),
    );
    await ready(page, feature, "RESTORED");
    await finishRetry(page, feature, denied, "DENIAL-CONFIRMED");
    outcomes.push(
      feature +
        ": current server denial fences an older acknowledgment without losing uncertain recovery",
    );

    await open(page);
    await page
      .getByRole("button", { name: "Refresh " + feature, exact: true })
      .click();
    const oldRead = await pending(page, feature, "read");
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await concealed(page, feature);
    await page.evaluate(() =>
      window.dispatchEvent(
        new PageTransitionEvent("pageshow", { persisted: true }),
      ),
    );
    const restoredRead = await page.evaluate((wanted) => {
      const items = window.__requests.filter(
        (item) => item.feature === wanted && item.kind === "read" && !item.done,
      );
      return { id: items.at(-1).id };
    }, feature);
    assert.notEqual(restoredRead.id, oldRead.id);
    await resolve(page, restoredRead, readResult(feature, "RESTORED-FRAME"));
    await ready(page, feature, "RESTORED-FRAME");
    await resolve(page, oldRead, { ok: false, code: "FORBIDDEN" });
    await ready(page, feature, "RESTORED-FRAME");
    assert.equal(await countChanges(page, feature), 0);
    outcomes.push(
      feature +
        ": blur and restored pages requalify the current view; an obsolete read denial cannot overwrite it",
    );

    await open(page);
    const ended = await change(page, feature);
    await page.evaluate(() =>
      window.__auth.set("synthetic-human-A", "session-A", "ended"),
    );
    await concealed(page, feature, "denied");
    await resolve(page, ended.item, changeResult(feature));
    await concealed(page, feature, "denied");
    assert.equal(await stored(page, feature), ended.raw);
    await page.evaluate(() => window.__auth.set());
    const unmountedRead = await pending(page, feature, "read");
    await page.evaluate(() => window.__unmount());
    await resolve(page, unmountedRead, readResult(feature, "UNMOUNTED"));
    assert.equal(await stored(page, feature), ended.raw);
    assert.equal(await page.locator("#root").innerText(), "");
    outcomes.push(
      feature +
        ": ended sessions and unmount ignore late results while preserving the journal",
    );
  }

  await page.goto(`http://127.0.0.1:${server.address().port}/?unloaded`);
  await page.getByLabel("Public keyword").fill("велосипед с кошница");
  await page.evaluate(
    () => (window.__keywordNode = document.getElementById("public-keyword")),
  );
  const keywordIntact = () =>
    page.evaluate(() => ({
      same: window.__keywordNode === document.getElementById("public-keyword"),
      focus: document.activeElement === window.__keywordNode,
      value: document.getElementById("public-keyword").value,
    }));
  const expectedKeyword = {
    same: true,
    focus: true,
    value: "велосипед с кошница",
  };
  assert.equal(await page.evaluate(() => window.__requests.length), 0);
  await page.evaluate(() => window.__auth.set());
  assert.deepEqual(await keywordIntact(), expectedKeyword);
  for (const feature of ["comparison", "search"]) {
    await resolve(
      page,
      await pending(page, feature, "read"),
      readResult(feature),
    );
    await ready(page, feature);
  }
  assert.deepEqual(await keywordIntact(), expectedKeyword);
  await page.evaluate(() =>
    window.__auth.set("synthetic-human-A", "session-B"),
  );
  for (const feature of ["comparison", "search"])
    await concealed(page, feature);
  assert.deepEqual(await keywordIntact(), expectedKeyword);
  for (const feature of ["comparison", "search"]) {
    await resolve(
      page,
      await pending(page, feature, "read", "session-B"),
      readResult(feature, "PUBLIC-SESSION-B"),
    );
    await ready(page, feature, "PUBLIC-SESSION-B");
  }
  assert.deepEqual(await keywordIntact(), expectedKeyword);
  assert.equal(
    await page.evaluate(
      () => window.__requests.filter((item) => item.kind === "change").length,
    ),
    0,
  );
  outcomes.push(
    "both public providers retain the exact uncontrolled keyword DOM node, typed value and focus through initial authentication settling and same-human session replacement",
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
