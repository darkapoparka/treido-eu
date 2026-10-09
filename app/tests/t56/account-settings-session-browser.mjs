/* global window: readonly, document: readonly, sessionStorage: readonly, Event: readonly, PageTransitionEvent: readonly, requestAnimationFrame: readonly */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import path from "node:path";
import process from "node:process";
import console from "node:console";
// Real hook + actual parsed/durable original commands, deferred synthetic Clerk
// and action transport. No account API, provider effect, shared DB or bypass.
const app = process.cwd(),
  req = createRequire(path.join(app, "package.json")),
  web = createRequire(path.join(app, "apps/web/package.json")),
  vite = createRequire(req.resolve("vitest/config"));
const { build } = await import(pathToFileURL(vite.resolve("vite")).href);
const clerk = `
import {flushSync} from 'react-dom';const listeners=new Set();
let state={user:{id:'synthetic-human-A'},session:{id:'session-A',status:'active'}};
const clerk={get user(){return state.user},get session(){return state.session},addListener(listener){listeners.add(listener);listener(state);return()=>listeners.delete(listener)}};
window.__auth={set(subject='synthetic-human-A',id='session-A',status='active'){state={user:subject?{id:subject}:null,session:id?{id,status}:null};flushSync(()=>listeners.forEach(listener=>listener(state)));},silent(subject,id,status){state={user:subject?{id:subject}:null,session:id?{id,status}:null};},current:()=>state};
export const useClerk=()=>clerk;export const useReverification=action=>action;
`;
const navigation = `
import {useSyncExternalStore} from 'react';import {flushSync} from 'react-dom';
const listeners=new Set();let entry={pathname:location.pathname,search:location.search};
const subscribe=listener=>{listeners.add(listener);return()=>listeners.delete(listener)},snapshot=()=>entry;
window.__route=target=>{const url=new URL(target,location.origin);history.pushState({},'',url.pathname+url.search);entry={pathname:url.pathname,search:url.search};flushSync(()=>listeners.forEach(listener=>listener()));};
export const usePathname=()=>useSyncExternalStore(subscribe,snapshot).pathname;
export const useSearchParams=()=>new URLSearchParams(useSyncExternalStore(subscribe,snapshot).search);
`;
const actions = `
window.__requests=[];let sequence=0;
function request(kind,input){const authority=window.__auth.current();return new Promise((resolve,reject)=>window.__requests.push({id:++sequence,kind,input,sessionId:authority.session?.id,subject:authority.user?.id,entry:location.pathname+location.search,resolve,reject,done:false}))}
export const readAccountSettingsAction=(mode,prompt)=>request('read',{mode,prompt});
export const changeAccountSettingsAction=command=>request('change',command);
export const recoverAccountSettingsAction=command=>request('recover',command);
export const executeOwnSessionRevocationAction=id=>request('revoke',id);
window.__resolve=(id,result)=>{const target=window.__requests.find(item=>item.id===id);if(!target||target.done)throw Error('Missing request '+id);target.done=true;target.resolve(result)};
window.__reject=id=>{const target=window.__requests.find(item=>item.id===id);if(!target||target.done)throw Error('Missing request '+id);target.done=true;target.reject(Error('Synthetic uncertain transport'));};
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
      name: "account-settings-deferred-fixture",
      enforce: "pre",
      resolveId(id, importer) {
        if (id === "@clerk/nextjs") return "\0settings:clerk";
        if (id === "next/navigation") return "\0settings:navigation";
        if (
          id === "./actions" &&
          importer
            ?.replaceAll("\\", "/")
            .endsWith("/account-closure/use-settings.ts")
        )
          return "\0settings:actions";
      },
      load(id) {
        if (id === "\0settings:clerk") return clerk;
        if (id === "\0settings:navigation") return navigation;
        if (id === "\0settings:actions") return actions;
      },
    },
  ],
  build: {
    write: false,
    minify: false,
    lib: {
      entry: path.join(app, "tests/t56/account-settings-session-entry.tsx"),
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
let browser;
const actor = "a".repeat(64),
  journal = "treido-account-lifecycle-v1:" + actor,
  outcomes = [],
  errors = [];
const readResult = (revision = 0, mode = "preferences") => ({
  ok: true,
  data: {
    subject: "synthetic-human-A",
    view:
      mode === "preferences"
        ? {
            mode,
            preferences: {
              actorKey: actor,
              revision,
              registrationNeeded: false,
              preferences: { locale: "en", browseScope: "all" },
            },
          }
        : {
            mode,
            closure: {
              actorKey: actor,
              revision,
              lifecycle: "active",
              preferences: null,
              policy: null,
              requestedClosures: [],
              obligations: null,
              plans: [],
              sessions: [
                {
                  ref: "b".repeat(64),
                  current: false,
                  lastActiveAt: "2026-10-09T00:00:00.000Z",
                  device: "Synthetic private device",
                },
              ],
              securityEffects: [],
              sessionsLimited: false,
              sessionReadUnavailable: false,
              securityAvailable: true,
              executionAvailable: true,
              historyLimited: false,
            },
          },
  },
});
const acknowledgment = (command) => ({
  ok: true,
  data: {
    subject: "synthetic-human-A",
    change: {
      acknowledgment: {
        revision: command.expectedRevision + 1,
        resourceId: "10000000-0000-4000-8000-000000000001",
        kind: command.operation.kind,
        state: "confirmed",
      },
      replayed: false,
    },
    preferences: null,
  },
});
async function flush(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
}
async function latest(page, kind = "read", after = 0) {
  await page.waitForFunction(
    ([type, id]) =>
      window.__requests.some(
        (item) => item.kind === type && item.id > id && !item.done,
      ),
    [kind, after],
  );
  return page.evaluate(
    ([type, id]) => {
      const item = window.__requests
        .filter((item) => item.kind === type && item.id > id && !item.done)
        .at(-1);
      return {
        id: item.id,
        kind: item.kind,
        input: item.input,
        sessionId: item.sessionId,
        entry: item.entry,
      };
    },
    [kind, after],
  );
}
async function settle(page, request, result) {
  await page.evaluate(
    ([id, value]) => window.__resolve(id, value),
    [request.id, result],
  );
  await flush(page);
}
async function hidden(page) {
  await page.waitForFunction(
    () =>
      document.querySelector("#ready")?.textContent === "false" &&
      document.querySelector("#private-facts")?.textContent === "",
  );
  assert.equal(await page.locator("#ready").innerText(), "false");
  assert.equal(await page.locator("#private-facts").innerText(), "");
}
async function shown(page) {
  await page.waitForFunction(
    () => document.querySelector("#ready")?.textContent === "true",
  );
  assert.notEqual(await page.locator("#private-facts").innerText(), "");
}
async function open(page, mode = "preferences", ready = true) {
  await page.goto(
    `http://127.0.0.1:${server.address().port}/account/privacy/${mode}?lang=en&mode=${mode}`,
  );
  await page.evaluate(() => sessionStorage.clear());
  await flush(page);
  const request = await latest(page);
  await hidden(page);
  if (ready) {
    await settle(page, request, readResult(0, mode));
    await shown(page);
  }
  return request;
}
async function save(page) {
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  return latest(page, "change");
}
async function stored(page) {
  return page.evaluate((key) => sessionStorage.getItem(key), journal);
}
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  const initial = await open(page, "preferences", false);
  await settle(page, initial, readResult());
  await shown(page);
  outcomes.push(
    "Current read is required before private preferences are exposed",
  );

  await open(page);
  const original = await save(page),
    bytes = await stored(page);
  await page.evaluate(() =>
    window.__auth.set("synthetic-human-A", "session-B", "active"),
  );
  await hidden(page);
  const replacement = await latest(page, "read", original.id);
  await settle(page, replacement, readResult());
  await shown(page);
  assert.equal(await stored(page), bytes);
  assert.equal(
    await page.locator("#pending").innerText(),
    original.input.requestId,
  );
  await page
    .getByRole("button", { name: "Retry original request", exact: true })
    .click();
  const exact = await latest(page, "change", original.id);
  assert.deepEqual(exact.input, original.input);
  assert.equal(exact.sessionId, "session-B");
  await settle(page, original, acknowledgment(original.input));
  assert.equal(await stored(page), bytes);
  assert.equal(await page.locator("#busy").innerText(), "true");
  await settle(page, exact, acknowledgment(exact.input));
  const saved = await latest(page, "read", exact.id);
  await settle(page, saved, readResult(1));
  await shown(page);
  assert.equal(await stored(page), null);
  outcomes.push(
    "Same-human session replacement preserves exact original bytes; obsolete completion cannot clear the current retry or its busy state",
  );

  await open(page);
  const oldA = await save(page),
    originalBytes = await stored(page);
  await page.evaluate(() =>
    window.__auth.set("synthetic-human-A", "session-B", "active"),
  );
  const readB = await latest(page, "read", oldA.id);
  await page.evaluate(() =>
    window.__auth.set("synthetic-human-A", "session-A", "active"),
  );
  const restoredA = await latest(page, "read", readB.id);
  await settle(page, restoredA, readResult());
  await shown(page);
  await settle(page, oldA, acknowledgment(oldA.input));
  assert.equal(await stored(page), originalBytes);
  assert.equal(
    await page.locator("#pending").innerText(),
    oldA.input.requestId,
  );
  await settle(page, readB, { ok: false, code: "FORBIDDEN" });
  await shown(page);
  assert.equal(await stored(page), originalBytes);
  outcomes.push(
    "A-B-A session restoration ignores former A mutation and B denial while retaining the current exact recovery command",
  );

  await open(page);
  const blurred = await save(page),
    blurBytes = await stored(page);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await hidden(page);
  await settle(page, blurred, acknowledgment(blurred.input));
  await hidden(page);
  assert.equal(await stored(page), blurBytes);
  const blurredRequests = await page.evaluate(() => window.__requests.length);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await flush(page);
  await hidden(page);
  assert.equal(
    await page.evaluate(() => window.__requests.length),
    blurredRequests,
  );
  await page
    .getByRole("button", { name: "Check current account", exact: true })
    .click();
  const explicit = await latest(page, "read", blurred.id);
  assert.equal(explicit.input.prompt, true);
  await settle(page, explicit, readResult());
  await shown(page);
  assert.equal(await stored(page), blurBytes);
  outcomes.push(
    "Blur conceals private facts and fences mutation completion; explicit visible check restores without a focus event",
  );

  await open(page);
  const uncertain = await save(page);
  await page.evaluate((id) => window.__reject(id), uncertain.id);
  await flush(page);
  await hidden(page);
  assert.equal(await page.locator("#error").innerText(), "UNKNOWN_OUTCOME");
  const uncertainBytes = await stored(page);
  await page.reload();
  await flush(page);
  const reloaded = await latest(page);
  await settle(page, reloaded, readResult());
  await shown(page);
  assert.equal(await stored(page), uncertainBytes);
  await page
    .getByRole("button", { name: "Recover original request", exact: true })
    .click();
  const recover = await latest(page, "recover");
  assert.deepEqual(recover.input, uncertain.input);
  await settle(page, recover, {
    ok: true,
    data: { subject: "synthetic-human-A", change: null, preferences: null },
  });
  assert.equal(await stored(page), uncertainBytes);
  outcomes.push(
    "Unknown transport outcome survives reload and explicit recovery uses the original command without inventing a new request",
  );

  await open(page);
  const beforeHide = await save(page);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    window.__auth.set("synthetic-human-A", "session-hidden", "active");
    window.dispatchEvent(new Event("focus"));
  });
  await settle(page, beforeHide, acknowledgment(beforeHide.input));
  await hidden(page);
  assert.equal(
    await page.evaluate(
      () => window.__requests.filter((item) => item.kind === "read").length,
    ),
    1,
  );
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const visible = await latest(page, "read", beforeHide.id);
  await settle(page, visible, readResult());
  await shown(page);
  assert.equal(
    await page.locator("#pending").innerText(),
    beforeHide.input.requestId,
  );
  outcomes.push(
    "Hidden session changes cannot read or expose private facts; foreground restores current state and original recovery",
  );

  const beforePageshow = await open(page);
  const pageCommand = await save(page);
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    ),
  );
  await hidden(page);
  const resumed = await latest(page, "read", pageCommand.id);
  await settle(page, pageCommand, acknowledgment(pageCommand.input));
  await hidden(page);
  await settle(page, resumed, { ok: false, code: "FORBIDDEN" });
  await hidden(page);
  assert.equal(await stored(page), null);
  assert.equal(await page.locator("#pending").innerText(), "");
  assert.ok(resumed.id > beforePageshow.id);
  outcomes.push(
    "Persisted pageshow invalidates old mutation and current definite denial clears only the owned recovery command",
  );

  await open(page);
  const ended = await save(page),
    endedBytes = await stored(page);
  await page.evaluate(() =>
    window.__auth.set("synthetic-human-A", "session-A", "ended"),
  );
  await hidden(page);
  await settle(page, ended, acknowledgment(ended.input));
  await hidden(page);
  assert.equal(await stored(page), endedBytes);
  await page.evaluate(() =>
    window.__auth.set("synthetic-human-A", "session-after-ended", "active"),
  );
  const active = await latest(page, "read", ended.id);
  await settle(page, active, readResult());
  await shown(page);
  assert.equal(
    await page.locator("#pending").innerText(),
    ended.input.requestId,
  );
  outcomes.push(
    "Ended retained session cannot expose or acknowledge; verified same-human replacement still recovers the uncertain request",
  );

  await open(page);
  const wrongActor = await save(page),
    actorBytes = await stored(page);
  await page.evaluate(() =>
    window.__auth.set("synthetic-human-B", "session-B", "active"),
  );
  await hidden(page);
  assert.equal(await page.locator("#pending").innerText(), "");
  await settle(page, wrongActor, acknowledgment(wrongActor.input));
  await hidden(page);
  assert.equal(await stored(page), actorBytes);
  outcomes.push(
    "Changed human sees no previous private facts or pending command and obsolete work cannot delete another actor's recovery journal",
  );

  await open(page);
  const silentActor = await save(page),
    silentBytes = await stored(page);
  await page.evaluate(() => {
    window.__auth.silent("synthetic-human-B", "session-B", "active");
    window.__rerender();
  });
  await flush(page);
  await hidden(page);
  const silentRender = await page.evaluate(() =>
    window.__renders.filter((item) => item.nonce === 2),
  );
  assert.ok(silentRender.length);
  for (const state of silentRender) {
    assert.equal(state.pending, null);
    assert.equal(state.error, null);
    assert.equal(state.busy, false);
    assert.equal(state.view, null);
    assert.equal(state.ready, false);
  }
  await settle(page, silentActor, acknowledgment(silentActor.input));
  assert.equal(await stored(page), silentBytes);
  outcomes.push(
    "A parent render seeing the next actor before any Clerk listener masks prior pending, error, busy and private view while preserving its journal",
  );

  await open(page);
  const formerError = await save(page);
  await page.evaluate((id) => window.__reject(id), formerError.id);
  await flush(page);
  assert.equal(await page.locator("#error").innerText(), "UNKNOWN_OUTCOME");
  await page.evaluate(() => {
    window.__auth.silent("synthetic-human-A", "session-B", "active");
    window.__rerender();
  });
  await flush(page);
  await hidden(page);
  assert.equal(await page.locator("#error").innerText(), "");
  for (const state of await page.evaluate(() =>
    window.__renders.filter((item) => item.nonce === 2),
  )) {
    assert.equal(state.error, null);
    assert.equal(state.pending, null);
    assert.equal(state.busy, false);
  }
  assert.ok(await stored(page));
  outcomes.push(
    "A render-only same-human session replacement masks former feedback and recovery details until a fresh verified read",
  );

  await open(page);
  const silentA = await save(page),
    silentOriginal = await stored(page);
  await page.evaluate(() => {
    window.__auth.silent("synthetic-human-A", "session-B", "active");
    window.__rerender();
  });
  await flush(page);
  const silentBRead = await latest(page, "read", silentA.id);
  await page.evaluate(() => {
    window.__auth.silent("synthetic-human-A", "session-A", "active");
    window.__rerender();
  });
  await flush(page);
  const silentARead = await latest(page, "read", silentBRead.id);
  await settle(page, silentARead, readResult());
  await shown(page);
  await settle(page, silentA, acknowledgment(silentA.input));
  assert.equal(await stored(page), silentOriginal);
  assert.equal(
    await page.locator("#pending").innerText(),
    silentA.input.requestId,
  );
  outcomes.push(
    "Render-only A-B-A context changes also invalidate the former mutation even before the Clerk listener reports replacement",
  );

  const recent = await open(page, "security", false);
  await settle(page, recent, { ok: false, code: "RECENT_AUTH_REQUIRED" });
  await hidden(page);
  await page
    .getByRole("button", { name: "Check current account", exact: true })
    .click();
  const prompted = await latest(page, "read", recent.id);
  assert.equal(prompted.input.prompt, true);
  await settle(page, prompted, readResult(0, "security"));
  await shown(page);
  await page
    .getByRole("button", { name: "End synthetic session", exact: true })
    .click();
  const authCommand = await latest(page, "change");
  await settle(page, authCommand, { ok: false, code: "RECENT_AUTH_REQUIRED" });
  await hidden(page);
  const authBytes = await stored(page);
  assert.ok(authBytes);
  await page
    .getByRole("button", { name: "Check current account", exact: true })
    .click();
  const reverified = await latest(page, "read", authCommand.id);
  await settle(page, reverified, readResult(0, "security"));
  await shown(page);
  assert.equal(await stored(page), authBytes);
  outcomes.push(
    "Recent-auth failures keep original command identity and explicit verification can reload the current security view",
  );

  await page
    .getByRole("button", { name: "Recover original request", exact: true })
    .click();
  const oldRecover = await latest(page, "recover");
  await page.evaluate(() =>
    window.__auth.set("synthetic-human-A", "session-reverified", "active"),
  );
  const afterRecover = await latest(page, "read", oldRecover.id);
  await settle(page, afterRecover, readResult(0, "security"));
  await shown(page);
  await settle(page, oldRecover, acknowledgment(oldRecover.input));
  assert.equal(await stored(page), authBytes);
  outcomes.push(
    "Obsolete original-request recovery cannot retire the current security recovery after session replacement",
  );

  await open(page, "security");
  await page
    .getByRole("button", { name: "Check synthetic revocation", exact: true })
    .click();
  const revoke = await latest(page, "revoke");
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await hidden(page);
  await settle(page, revoke, {
    ok: true,
    data: { subject: "synthetic-human-A", state: "confirmed" },
  });
  await hidden(page);
  assert.equal(
    await page.evaluate(
      () => window.__requests.filter((item) => item.kind === "read").length,
    ),
    1,
  );
  outcomes.push(
    "Obsolete own-session effect check cannot trigger a restoration read or alter current readiness after blur",
  );

  await open(page, "security");
  const otherJournal = "treido-account-lifecycle-v1:" + "c".repeat(64);
  await page.evaluate(
    (key) => sessionStorage.setItem(key, "other-synthetic-owned-journal"),
    otherJournal,
  );
  await page
    .getByRole("button", { name: "Check synthetic revocation", exact: true })
    .click();
  const deniedRevocation = await latest(page, "revoke");
  await settle(page, deniedRevocation, { ok: false, code: "FORBIDDEN" });
  await hidden(page);
  assert.equal(await page.locator("#error").innerText(), "FORBIDDEN");
  assert.equal(
    await page.evaluate((key) => sessionStorage.getItem(key), otherJournal),
    "other-synthetic-owned-journal",
  );
  outcomes.push(
    "A current revocation authority denial conceals account facts and preserves a different actor's recovery journal",
  );

  const missingSession = await open(page, "preferences", false);
  await page.evaluate(() =>
    window.__auth.set("synthetic-human-A", null, "active"),
  );
  await settle(page, missingSession, readResult());
  await hidden(page);
  assert.equal(
    await page.evaluate(() => window.__requests.at(-1).id),
    missingSession.id,
  );
  outcomes.push(
    "A retained user without an actual active session ID cannot read or expose the old account projection",
  );

  const routeStart = await open(page, "preferences", false);
  await page.evaluate(() =>
    window.__route("/account/privacy/preferences?lang=bg&mode=preferences"),
  );
  const routeRead = await latest(page, "read", routeStart.id);
  await settle(page, routeStart, { ok: false, code: "FORBIDDEN" });
  await hidden(page);
  await settle(page, routeRead, readResult());
  await shown(page);
  outcomes.push(
    "Current entry query and mode fence obsolete route reads before restoring a current account projection",
  );

  await open(page);
  const unmounted = await save(page),
    unmountedBytes = await stored(page);
  await page.evaluate(() => {
    window.__unmount();
    window.__auth.set("synthetic-human-A", "session-unmounted", "active");
    window.dispatchEvent(new Event("focus"));
  });
  await settle(page, unmounted, acknowledgment(unmounted.input));
  assert.equal(await stored(page), unmountedBytes);
  assert.equal(
    await page.evaluate(() => window.__requests.at(-1).id),
    unmounted.id,
  );
  outcomes.push(
    "Unmounted hook unsubscribes and delayed mutation cannot erase durable recovery or start another read",
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        status: "PASS",
        scenarios: outcomes.length,
        outcomes,
        pageErrors: errors.length,
      },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
