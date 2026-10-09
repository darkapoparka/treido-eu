/* global window: readonly, document: readonly */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import path from "node:path";
import process from "node:process";
import console from "node:console";

// Actual Inbox/Notification presenters and shared hook. Only synthetic Clerk
// resources and deferred action transport are supplied; no account/provider API.
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
const notify=()=>{resources.forEach(listener=>listener(state));listeners.forEach(listener=>listener());};
window.__auth={set(subject='synthetic-human-A',id='session-A',status='active'){state={loaded:true,user:subject?{id:subject}:null,session:id?{id,status}:null};flushSync(notify);},setLoaded(loaded){state={...state,loaded};flushSync(notify);},setAuthView(authView){state={...state,authView};flushSync(notify);},batchRoundTrip(){flushSync(()=>{for(const id of ['session-B','session-A']){state={loaded:true,user:{id:'synthetic-human-A'},session:{id,status:'active'}};notify();}});},current:()=>state,listeners:()=>resources.size};
export const useClerk=()=>clerk;
export function useAuth(){const current=useSyncExternalStore(listener=>{listeners.add(listener);return()=>listeners.delete(listener);},()=>state);return {isLoaded:current.loaded,userId:current.user?.id??null,sessionId:current.session?.id??null,isSignedIn:!!current.user&&current.session?.status==='active',...current.authView};}
let visibility='visible';Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>visibility});
window.__visibility=(value,emit=true)=>{visibility=value;if(emit)flushSync(()=>document.dispatchEvent(new Event('visibilitychange')));};
window.__event=name=>flushSync(()=>window.dispatchEvent(name==='pageshow'?new PageTransitionEvent(name,{persisted:true}):new Event(name)));
window.__requests=[];let sequence=0;
window.__request=(feature,kind,args)=>{const auth=window.__auth.current();return new Promise((resolve,reject)=>window.__requests.push({id:++sequence,feature,kind,args,sessionId:auth.session?.id,subject:auth.user?.id,done:false,resolve,reject}));};
window.__resolve=(id,result)=>{const item=window.__requests.find(value=>value.id===id);if(!item||item.done)throw Error('Missing request '+id);item.done=true;item.resolve(result);};
window.__reject=id=>{const item=window.__requests.find(value=>value.id===id);if(!item||item.done)throw Error('Missing request '+id);item.done=true;item.reject(Error('Synthetic unavailable transport'));};
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
      name: "inbox-session-deferred-fixture",
      enforce: "pre",
      resolveId(id, importer) {
        const owner = importer?.replaceAll("\\", "/");
        if (id === "@clerk/nextjs") return "\0inbox:clerk";
        if (id === "next-intl") return "\0inbox:intl";
        if (id === "next/link") return "\0inbox:link";
        if (id === "./actions" && owner?.endsWith("/messaging/inbox.tsx"))
          return "\0inbox:actions";
        if (
          id === "./actions" &&
          (owner?.endsWith("/notifications/panel.tsx") ||
            owner?.endsWith("/notifications/use-read-selection.ts"))
        )
          return "\0inbox:notifications";
        // These branches are not selected by this fixture. The actual private
        // rows, filters, selection recovery and shared session hook stay real.
        if (id === "./conversation" && owner?.endsWith("/messaging/inbox.tsx"))
          return "\0inbox:conversation";
        if (
          id === "../saved-searches/updates" &&
          owner?.endsWith("/notifications/panel.tsx")
        )
          return "\0inbox:updates";
        if (
          id === "../discovery/notifications" &&
          owner?.endsWith("/notifications/panel.tsx")
        )
          return "\0inbox:empty";
      },
      load(id) {
        if (id === "\0inbox:clerk") return clerk;
        if (id === "\0inbox:intl")
          return "export {useTranslations,useFormatter,useLocale} from 'use-intl';";
        if (id === "\0inbox:link")
          return "import React from 'react';export default function Link({href,children,prefetch,...props}){return React.createElement('a',{...props,href},children)}";
        if (id === "\0inbox:actions")
          return "export const readInboxAction=query=>window.__request('inbox','read',[query]);";
        if (id === "\0inbox:notifications")
          return "export const readNotificationsAction=(query,actorKey)=>window.__request('notifications','read',[query,actorKey]);export const markNotificationsReadAction=command=>window.__request('notifications','change',[command]);";
        if (id === "\0inbox:conversation")
          return "export function Conversation(){throw Error('Unexpected conversation branch')}";
        if (id === "\0inbox:updates")
          return "export function SearchMatchFeedPanel(){throw Error('Unexpected saved-search branch')}";
        if (id === "\0inbox:empty")
          return "export function NotificationsEmpty(){throw Error('Unexpected Shop empty branch')}";
      },
    },
  ],
  build: {
    write: false,
    minify: false,
    lib: {
      entry: path.join(app, "tests/t56/inbox-session-entry.tsx"),
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
  } else if (request.url === "/fixture.css") {
    response.setHeader("Content-Type", "text/css");
    response.end(css);
  } else {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(
      '<!doctype html><html><head><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>',
    );
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { chromium } = req("@playwright/test"),
  features = ["inbox", "notifications"],
  outcomes = [],
  errors = [];
let browser;
const itemId = "a0000000-0000-4000-8000-000000000001",
  threadId = "a0000000-0000-4000-8000-000000000002";
function result(item, marker = "CURRENT") {
  if (item.feature === "probe") return { ok: true, data: { marker } };
  const query = item.args[0];
  return {
    ok: true,
    data:
      item.feature === "inbox"
        ? {
            query,
            items: [
              {
                id: threadId,
                listingId: itemId,
                title: marker,
                sellerName: "Synthetic seller",
                sellerKind: "personal",
                lastBody: "Synthetic private preview",
                lastAt: "2026-10-09T00:00:00Z",
                unread: 1,
                blocked: false,
              },
            ],
            nextCursor: null,
          }
        : {
            actorKey: item.args[1],
            sellerId: query.sellerId,
            query,
            items: [
              {
                id: itemId,
                threadId,
                title: marker,
                sellerName: "Synthetic seller",
                body: "Synthetic private update",
                at: "2026-10-09T00:00:00Z",
                sequence: 1,
                unread: true,
                offerKind: null,
              },
            ],
            nextBefore: null,
            unreadCount: 1,
          },
  };
}
async function watermark(page) {
  return page.evaluate(() => window.__requests.at(-1)?.id ?? 0);
}
async function pending(page, feature, afterId = 0) {
  await page.waitForFunction(
    (wanted) =>
      window.__requests.some(
        (item) =>
          item.feature === wanted.feature &&
          item.kind === "read" &&
          !item.done &&
          item.id > wanted.afterId,
      ),
    { feature, afterId },
  );
  return page.evaluate(
    (wanted) => {
      const item = window.__requests
        .filter(
          (value) =>
            value.feature === wanted.feature &&
            value.kind === "read" &&
            !value.done &&
            value.id > wanted.afterId,
        )
        .at(-1);
      return {
        id: item.id,
        feature: item.feature,
        args: item.args,
        sessionId: item.sessionId,
        subject: item.subject,
      };
    },
    { feature, afterId },
  );
}
async function reads(page, afterId = 0) {
  return Promise.all(
    features.map((feature) => pending(page, feature, afterId)),
  );
}
async function resolve(page, item, value = result(item)) {
  await page.evaluate(
    async ([id, response]) => {
      window.__resolve(id, response);
      await Promise.resolve();
    },
    [item.id, value],
  );
}
async function resolveAll(page, items, marker = "CURRENT") {
  for (const item of items) await resolve(page, item, result(item, marker));
}
async function ready(page, marker = "CURRENT") {
  await page.waitForFunction(
    (wanted) =>
      document.querySelector("#inbox aside a strong")?.firstChild
        ?.textContent === wanted &&
      document.querySelector("#notifications [data-notification-id] h2")
        ?.textContent === wanted,
    marker,
  );
}
async function concealed(page, { filters = true } = {}) {
  assert.equal(
    await page.locator("#inbox aside a strong").count(),
    0,
    "Inbox private rows concealed",
  );
  assert.equal(
    await page.locator("#notifications [data-notification-id]").count(),
    0,
    "Notification private rows concealed",
  );
  assert.equal(
    await page.locator("#notifications input[type=checkbox]").count(),
    0,
    "Private selection concealed",
  );
  assert.equal(
    await page
      .locator("#notifications")
      .getByText("1 unread update", { exact: true })
      .count(),
    0,
    "Accepted private unread count concealed",
  );
  assert.equal(
    await page
      .locator("#notifications")
      .getByRole("button", { name: "Mark selected as read", exact: true })
      .count(),
    0,
    "Acknowledgment control concealed",
  );
  if (!filters) {
    for (const feature of features)
      assert.equal(
        await page.locator(`#${feature} input[type=search]`).count(),
        0,
        "Prior human filter concealed",
      );
  }
}
async function open(page) {
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await reads(page);
  await concealed(page);
  // Settle all genuine initial reads, including browser pageshow restoration.
  for (let round = 0; round < 4; round++) {
    const items = await page.evaluate(() =>
      window.__requests
        .filter((item) => item.kind === "read" && !item.done)
        .map(({ id, feature, args, sessionId, subject }) => ({
          id,
          feature,
          args,
          sessionId,
          subject,
        })),
    );
    await resolveAll(page, items);
    await page.waitForFunction(
      () =>
        (document.querySelector("#inbox aside a strong") &&
          document.querySelector("#notifications [data-notification-id]")) ||
        window.__requests.some((item) => item.kind === "read" && !item.done),
    );
    if (
      (await page.locator("#inbox aside a strong").count()) &&
      (await page.locator("#notifications [data-notification-id]").count())
    )
      return;
  }
  throw Error("Initial current reads did not settle");
}
async function trigger(page, event) {
  const before = await watermark(page);
  await event();
  return reads(page, before);
}
async function reload(page) {
  return trigger(page, () => page.evaluate(() => window.__event("focus")));
}
async function setSession(
  page,
  id = "session-B",
  subject = "synthetic-human-A",
  status = "active",
) {
  return trigger(page, () =>
    page.evaluate(
      ([human, session, state]) => window.__auth.set(human, session, state),
      [subject, id, status],
    ),
  );
}
async function recordInputs(page, focused = "inbox") {
  await page
    .locator("#inbox input[type=search]")
    .fill("Private unsent inbox query");
  await page
    .locator("#notifications input[type=search]")
    .fill("Private unsent notifications query");
  await page.locator(`#${focused} input[type=search]`).focus();
  await page.evaluate(() => {
    window.__inputNodes = [
      document.querySelector("#inbox input[type=search]"),
      document.querySelector("#notifications input[type=search]"),
    ];
  });
}
async function retainedInputs(page, focused = "inbox") {
  assert.deepEqual(
    await page.evaluate(() =>
      window.__inputNodes.map((node, index) => ({
        same:
          node ===
          document.querySelector(
            index
              ? "#notifications input[type=search]"
              : "#inbox input[type=search]",
          ),
        value: node.value,
        disabled: node.disabled,
      })),
    ),
    [
      { same: true, value: "Private unsent inbox query", disabled: false },
      {
        same: true,
        value: "Private unsent notifications query",
        disabled: false,
      },
    ],
  );
  assert.equal(
    await page
      .locator(`#${focused} input[type=search]`)
      .evaluate((node) => document.activeElement === node),
    true,
    "Focused same-human filter stays mounted",
  );
}
async function noWrites(page) {
  assert.equal(
    await page.evaluate(
      () => window.__requests.filter((item) => item.kind === "change").length,
    ),
    0,
    "No automatic write or retry",
  );
}
async function scenario(page, name, run) {
  await open(page);
  await run();
  await noWrites(page);
  outcomes.push({ name, result: "PASS" });
  console.log("PASS " + name);
}
async function pendingChange(page, afterId = 0) {
  await page.waitForFunction(
    (after) =>
      window.__requests.some(
        (item) =>
          item.feature === "notifications" &&
          item.kind === "change" &&
          item.id > after &&
          !item.done,
      ),
    afterId,
  );
  return page.evaluate((after) => {
    const item = window.__requests
      .filter(
        (item) =>
          item.feature === "notifications" &&
          item.kind === "change" &&
          item.id > after &&
          !item.done,
      )
      .at(-1);
    return {
      id: item.id,
      feature: item.feature,
      args: item.args,
      sessionId: item.sessionId,
    };
  }, afterId);
}
async function changeCount(page) {
  return page.evaluate(
    () => window.__requests.filter((item) => item.kind === "change").length,
  );
}
async function reject(page, item) {
  await page.evaluate(async (id) => {
    window.__reject(id);
    await Promise.resolve();
  }, item.id);
}
async function noAcknowledgment(page) {
  assert.equal(
    await page
      .locator("#notifications")
      .getByText("Read state acknowledged", { exact: true })
      .count(),
    0,
  );
}
async function acknowledgeCurrent(page, item) {
  const before = await watermark(page);
  await resolve(page, item, acknowledged(item));
  const refreshed = await pending(page, "notifications", before);
  assert.equal(
    await page.locator("#notifications [data-notification-id]").count(),
    0,
    "Current mutation completion requires a new current read before private presenter returns",
  );
  await resolve(page, refreshed, result(refreshed, "AFTER-CURRENT-ACK"));
  await page
    .locator("#notifications")
    .getByText("Read state acknowledged", { exact: true })
    .waitFor();
  const recovered = Object.values(await journal(page)).map((raw) =>
    JSON.parse(raw),
  );
  assert.equal(
    recovered
      .flatMap((draft) => draft.entries)
      .find((entry) => entry.row.requestId === item.args[0].rows[0].requestId)
      ?.result.state,
    "read",
  );
}
async function journal(page) {
  return page.evaluate(() =>
    Object.fromEntries(Object.entries(window.sessionStorage)),
  );
}
async function submitSelection(page, retry = false) {
  if (!retry) await page.locator("#notifications input[type=checkbox]").check();
  await page
    .locator("#notifications")
    .getByRole("button", {
      name: retry ? "Retry unresolved updates" : "Mark selected as read",
      exact: true,
    })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm read selection", exact: true })
    .click();
  return pendingChange(page);
}
function acknowledged(item) {
  return {
    ok: true,
    data: item.args[0].rows.map((row) => ({
      ...row,
      state: "read",
      acknowledgedThrough: row.sequence,
    })),
  };
}
async function mutationScenario(page, name, run) {
  await page.evaluate(() => window.sessionStorage.clear());
  await open(page);
  await run();
  outcomes.push({ name, result: "PASS" });
  console.log("PASS " + name);
}
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (error) => errors.push(error.message));
  await scenario(
    page,
    "initial private projections require current server read",
    async () => {
      await ready(page);
      assert.equal(
        await page.locator("#notifications [data-notification-feed]").count(),
        1,
      );
    },
  );
  for (const focused of features)
    await scenario(
      page,
      `same-human session replacement preserves ${focused} filter node/value/focus`,
      async () => {
        await recordInputs(page, focused);
        const current = await setSession(page);
        await concealed(page);
        await retainedInputs(page, focused);
        for (const item of current) assert.equal(item.sessionId, "session-B");
        await resolveAll(page, current, "SESSION-B");
        await ready(page, "SESSION-B");
        await retainedInputs(page, focused);
      },
    );
  await scenario(
    page,
    "same-human auth settling preserves mounted filters while concealing private read data",
    async () => {
      await page.locator("#notifications input[type=checkbox]").check();
      await recordInputs(page);
      const originalJournal = await journal(page),
        before = await watermark(page);
      await page.evaluate(() => window.__auth.setLoaded(false));
      await concealed(page);
      await retainedInputs(page);
      assert.deepEqual(await journal(page), originalJournal);
      assert.equal(
        await watermark(page),
        before,
        "Settling does not read using unqualified auth",
      );
      const current = await trigger(page, () =>
        page.evaluate(() => window.__auth.setLoaded(true)),
      );
      await concealed(page);
      await retainedInputs(page);
      await resolveAll(page, current, "AUTH-SETTLED-CURRENT");
      await ready(page, "AUTH-SETTLED-CURRENT");
      await retainedInputs(page);
      assert.deepEqual(await journal(page), originalJournal);
    },
  );
  for (const [name, authView] of [
    ["signed-out auth", { isSignedIn: false }],
    ["mismatched auth human", { userId: "synthetic-human-B" }],
    ["mismatched auth session", { sessionId: "other-auth-session" }],
  ])
    await scenario(
      page,
      `loaded ${name} cannot retain private filters from active Clerk resources`,
      async () => {
        await recordInputs(page);
        const old = await reload(page);
        await page.evaluate(
          (view) => window.__auth.setAuthView(view),
          authView,
        );
        await concealed(page, { filters: false });
        await resolveAll(page, old, "AUTH-DISAGREEMENT-OBSOLETE");
        await concealed(page, { filters: false });
        const current = await trigger(page, () =>
          page.evaluate(() => window.__auth.setAuthView(null)),
        );
        await concealed(page);
        await resolveAll(page, current, "AUTH-AGREEMENT-CURRENT");
        await ready(page, "AUTH-AGREEMENT-CURRENT");
      },
    );
  await scenario(
    page,
    "same-ID active resource replacement requires a fresh read",
    async () => {
      const old = await reload(page),
        current = await setSession(page, "session-A");
      await concealed(page);
      await resolveAll(page, old, "OLD-RESOURCE");
      await concealed(page);
      await resolveAll(page, current, "CURRENT-RESOURCE");
      await ready(page, "CURRENT-RESOURCE");
    },
  );
  await scenario(
    page,
    "obsolete session success cannot restore rows or settle current read",
    async () => {
      const old = await reload(page),
        current = await setSession(page);
      await concealed(page);
      await resolveAll(page, old, "OBSOLETE-A");
      await concealed(page);
      await resolveAll(page, current, "CURRENT-B");
      await ready(page, "CURRENT-B");
    },
  );
  await scenario(
    page,
    "A to B to A rejects B denial and old A success",
    async () => {
      const old = await reload(page),
        middle = await setSession(page),
        current = await setSession(page, "session-A");
      await resolveAll(page, old, "OBSOLETE-A");
      for (const item of middle)
        await resolve(page, item, { ok: false, code: "FORBIDDEN" });
      await concealed(page);
      await resolveAll(page, current, "RETURNED-A");
      await ready(page, "RETURNED-A");
    },
  );
  await scenario(
    page,
    "batched A to B to A resource events invalidate an old A read",
    async () => {
      const old = await reload(page),
        before = await watermark(page);
      await page.evaluate(() => window.__auth.batchRoundTrip());
      const current = await reads(page, before);
      await resolveAll(page, old, "BATCH-OBSOLETE-A");
      await concealed(page);
      await resolveAll(page, current, "BATCH-CURRENT-A");
      await ready(page, "BATCH-CURRENT-A");
    },
  );
  await scenario(
    page,
    "different human immediately loses prior private filter input and rows",
    async () => {
      await recordInputs(page);
      const old = await reload(page);
      await page.evaluate(() =>
        window.__auth.set("synthetic-human-B", "other-human-session"),
      );
      await concealed(page, { filters: false });
      await resolveAll(page, old, "OTHER-HUMAN-OBSOLETE");
      await concealed(page, { filters: false });
      const current = await setSession(page, "returned-human-session");
      await concealed(page);
      for (const feature of features)
        assert.equal(
          await page.locator(`#${feature} input[type=search]`).inputValue(),
          "",
        );
      await resolveAll(page, current, "RETURNED-HUMAN");
      await ready(page, "RETURNED-HUMAN");
    },
  );
  await scenario(
    page,
    "hidden result cannot reveal rows before visible current restoration",
    async () => {
      const old = await reload(page);
      await page.evaluate(() => window.__visibility("hidden"));
      await concealed(page);
      await resolveAll(page, old, "HIDDEN-RESULT");
      await concealed(page);
      const current = await trigger(page, () =>
        page.evaluate(() => window.__visibility("visible")),
      );
      await resolveAll(page, current, "VISIBLE-CURRENT");
      await ready(page, "VISIBLE-CURRENT");
    },
  );
  await scenario(
    page,
    "explicit visible reload recovers after blur without focus event",
    async () => {
      const old = await reload(page);
      await page.evaluate(() => window.__event("blur"));
      await concealed(page);
      await resolveAll(page, old, "BLURRED-RESULT");
      await concealed(page);
      const before = await watermark(page);
      await page
        .locator("#notifications")
        .getByRole("button", { name: "Reload current state", exact: true })
        .last()
        .click();
      const notification = await pending(page, "notifications", before);
      await resolve(
        page,
        notification,
        result(notification, "EXPLICIT-RECOVERY"),
      );
      await page.waitForFunction(
        () =>
          document.querySelector("#notifications [data-notification-id] h2")
            ?.textContent === "EXPLICIT-RECOVERY",
      );
      assert.equal(
        await page.locator("#inbox aside a strong").count(),
        0,
        "Other hidden reader does not receive authority from sibling retry",
      );
      const restored = await trigger(page, () =>
        page.evaluate(() => window.__event("focus")),
      );
      await resolveAll(page, restored, "FOCUSED-CURRENT");
      await ready(page, "FOCUSED-CURRENT");
    },
  );
  await scenario(
    page,
    "pageshow restoration fences an earlier failure",
    async () => {
      const old = await reload(page),
        current = await trigger(page, () =>
          page.evaluate(() => window.__event("pageshow")),
        );
      for (const item of old)
        await page.evaluate(async (id) => {
          window.__reject(id);
          await Promise.resolve();
        }, item.id);
      await concealed(page);
      await resolveAll(page, current, "RESTORED");
      await ready(page, "RESTORED");
    },
  );
  for (const [name, id, status] of [
    ["ended session", "session-A", "ended"],
    ["missing active session", null, "active"],
  ])
    await scenario(
      page,
      `${name} conceals private filters and old results`,
      async () => {
        const old = await reload(page);
        await page.evaluate(
          ([session, state]) =>
            window.__auth.set("synthetic-human-A", session, state),
          [id, status],
        );
        await concealed(page, { filters: false });
        await resolveAll(page, old, "ENDED-OBSOLETE");
        await concealed(page, { filters: false });
        const current = await setSession(page, "restored-active-session");
        await resolveAll(page, current, "ACTIVE-RESTORED");
        await ready(page, "ACTIVE-RESTORED");
      },
    );
  await scenario(
    page,
    "current denial hides filters and cannot be overwritten by obsolete success",
    async () => {
      const old = await reload(page),
        current = await reload(page);
      for (const item of current)
        await resolve(page, item, { ok: false, code: "FORBIDDEN" });
      await page.waitForFunction(
        () =>
          document
            .querySelector("#inbox [role=status]")
            ?.textContent.includes("Your access has changed") &&
          document
            .querySelector("#notifications [role=status]")
            ?.textContent.includes("no longer has access"),
      );
      await concealed(page, { filters: false });
      await resolveAll(page, old, "AFTER-DENIAL-OBSOLETE");
      await concealed(page, { filters: false });
    },
  );
  await scenario(
    page,
    "private read selection stays concealed through same-human requalification",
    async () => {
      await page.locator("#notifications input[type=checkbox]").check();
      const selection = page
        .locator("#notifications")
        .getByRole("heading", { name: "1 selected update", exact: true });
      await selection.waitFor();
      const journal = await page.evaluate(() =>
        Object.fromEntries(Object.entries(window.sessionStorage)),
      );
      assert.equal(Object.keys(journal).length, 1);
      const current = await setSession(page);
      await concealed(page);
      assert.equal(await selection.count(), 0);
      assert.equal(
        await page
          .locator("#notifications")
          .getByText("Synthetic seller: CURRENT", { exact: true })
          .count(),
        0,
      );
      assert.deepEqual(
        await page.evaluate(() =>
          Object.fromEntries(Object.entries(window.sessionStorage)),
        ),
        journal,
        "Read requalification preserves the original private selection journal",
      );
      await resolveAll(page, current, "SELECTION-CURRENT");
      await ready(page, "SELECTION-CURRENT");
      await selection.waitFor();
    },
  );
  await scenario(
    page,
    "new server initial props are concealed until their own fresh read",
    async () => {
      await recordInputs(page);
      const old = await reload(page),
        before = await watermark(page);
      await page.evaluate(() =>
        window.__replaceInitial("NEW-SERVER-PROJECTION"),
      );
      await concealed(page);
      await retainedInputs(page);
      const current = await reads(page, before);
      await resolveAll(page, old, "OLD-PROP-RESULT");
      await concealed(page);
      await resolveAll(page, current, "NEW-SERVER-CURRENT");
      await ready(page, "NEW-SERVER-CURRENT");
      await retainedInputs(page);
    },
  );
  await scenario(
    page,
    "retained refresh cannot enqueue an old committed frame during or after replacement",
    async () => {
      await page.evaluate(() => window.__captureRefresh());
      const before = await watermark(page);
      await page.evaluate(() =>
        window.__replaceInitial("CURRENT-COMMITTED-FRAME", true),
      );
      const current = await reads(page, before),
        probe = await pending(page, "probe", before);
      assert.deepEqual(
        await page.evaluate(
          (after) =>
            window.__requests
              .filter((item) => item.feature === "probe" && item.id > after)
              .map((item) => item.args[0].marker),
          before,
        ),
        ["CURRENT-COMMITTED-FRAME"],
        "A later layout effect cannot start the retained obsolete loader",
      );
      await resolveAll(page, current, "COMMITTED-CURRENT");
      await resolve(page, probe, result(probe, "COMMITTED-PROBE"));
      await ready(page, "COMMITTED-CURRENT");
      await page
        .locator("#probe .private")
        .getByText("COMMITTED-PROBE", { exact: true })
        .waitFor();
      const after = await watermark(page);
      await page.evaluate(() => window.__retainedRefresh());
      assert.equal(
        await watermark(page),
        after,
        "Retained callback cannot enqueue a read in the current frame",
      );
      await ready(page, "COMMITTED-CURRENT");
      assert.equal(await page.locator("#probe .status").textContent(), "ready");
      assert.equal(
        await page.locator("#probe .private").textContent(),
        "COMMITTED-PROBE",
      );
    },
  );
  await scenario(
    page,
    "same-path query props fence the previous reader and preserve current criteria",
    async () => {
      const old = await reload(page),
        before = await watermark(page);
      await page.evaluate(() => window.__replaceQuery("Current query"));
      await concealed(page);
      const current = await reads(page, before);
      for (const item of current) assert.equal(item.args[0].q, "Current query");
      await resolveAll(page, old, "OLD-QUERY");
      await concealed(page);
      await resolveAll(page, current, "CURRENT-QUERY");
      await ready(page, "CURRENT-QUERY");
    },
  );
  await scenario(
    page,
    "unmount unsubscribes and obsolete read results have no presenter",
    async () => {
      const old = await reload(page);
      await page.evaluate(() => window.__unmount());
      assert.equal(await page.evaluate(() => window.__auth.listeners()), 0);
      await resolveAll(page, old, "AFTER-UNMOUNT");
      assert.equal(await page.locator("#root").textContent(), "");
    },
  );
  await mutationScenario(
    page,
    "old notification acknowledgment cannot merge into a freshly qualified replacement session",
    async () => {
      const old = await submitSelection(page),
        originalJournal = await journal(page),
        current = await setSession(page);
      await concealed(page);
      await resolveAll(page, current, "MUTATION-CURRENT-B");
      await ready(page, "MUTATION-CURRENT-B");
      await resolve(page, old, acknowledged(old));
      assert.deepEqual(
        await journal(page),
        originalJournal,
        "Obsolete acknowledgment must not alter original submitted tuples/results",
      );
      await noAcknowledgment(page);
      assert.equal(
        await changeCount(page),
        1,
        "Replacement read does not resend the uncertain mutation",
      );
      const retry = await submitSelection(page, true);
      assert.deepEqual(
        retry.args,
        old.args,
        "Explicit current retry preserves exact actor/seller/message/sequence/request tuples",
      );
      assert.equal(retry.sessionId, "session-B");
      await acknowledgeCurrent(page, retry);
    },
  );
  for (const obsoleteOutcome of ["success", "exception"])
    await mutationScenario(
      page,
      `obsolete ${obsoleteOutcome} finally cannot unlock or overwrite a newer notification attempt`,
      async () => {
        const old = await submitSelection(page),
          current = await setSession(page);
        await resolveAll(page, current, "NEWER-ATTEMPT-READY");
        await ready(page, "NEWER-ATTEMPT-READY");
        const retry = await submitSelection(page, true),
          originalJournal = await journal(page);
        assert.deepEqual(retry.args, old.args);
        if (obsoleteOutcome === "success")
          await resolve(page, old, acknowledged(old));
        else await reject(page, old);
        assert.deepEqual(
          await journal(page),
          originalJournal,
          "Obsolete success/catch must leave newer attempt journal unchanged",
        );
        await noAcknowledgment(page);
        assert.equal(
          await page
            .locator("#notifications")
            .getByRole("button", { name: "Saving…", exact: true })
            .isDisabled(),
          true,
          "Obsolete finally cannot enable retry during current write",
        );
        assert.equal(
          await page
            .locator("#notifications")
            .getByRole("button", { name: "Reload current state", exact: true })
            .isDisabled(),
          true,
          "Newer operation retains its busy ownership",
        );
        assert.equal(
          await changeCount(page),
          2,
          "Only the two explicit writes were submitted",
        );
        await acknowledgeCurrent(page, retry);
      },
    );
  for (const obsoleteOutcome of ["success", "exception"])
    await mutationScenario(
      page,
      `hidden notification ${obsoleteOutcome} remains unresolved until visible current read and explicit retry`,
      async () => {
        const old = await submitSelection(page),
          originalJournal = await journal(page);
        await page.evaluate(() => window.__visibility("hidden"));
        await concealed(page);
        if (obsoleteOutcome === "success")
          await resolve(page, old, acknowledged(old));
        else await reject(page, old);
        assert.deepEqual(
          await journal(page),
          originalJournal,
          "Hidden completion cannot rewrite uncertain tuples/results",
        );
        const current = await trigger(page, () =>
          page.evaluate(() => window.__visibility("visible")),
        );
        await concealed(page);
        assert.equal(await changeCount(page), 1);
        await resolveAll(page, current, "VISIBLE-RETRY-READY");
        await ready(page, "VISIBLE-RETRY-READY");
        await noAcknowledgment(page);
        const retry = await submitSelection(page, true);
        assert.deepEqual(retry.args, old.args);
        await acknowledgeCurrent(page, retry);
      },
    );
  await mutationScenario(
    page,
    "same-ID active resource replacement invalidates a pending notification acknowledgment",
    async () => {
      const old = await submitSelection(page),
        originalJournal = await journal(page),
        current = await setSession(page, "session-A");
      await resolveAll(page, current, "SAME-ID-CURRENT-RESOURCE");
      await ready(page, "SAME-ID-CURRENT-RESOURCE");
      await resolve(page, old, acknowledged(old));
      assert.deepEqual(await journal(page), originalJournal);
      await noAcknowledgment(page);
      assert.equal(await changeCount(page), 1);
      const retry = await submitSelection(page, true);
      assert.deepEqual(retry.args, old.args);
      await acknowledgeCurrent(page, retry);
    },
  );
  await mutationScenario(
    page,
    "batched session A to B to A events fence the original notification mutation",
    async () => {
      const old = await submitSelection(page),
        originalJournal = await journal(page),
        before = await watermark(page);
      await page.evaluate(() => window.__auth.batchRoundTrip());
      const current = await reads(page, before);
      await resolveAll(page, current, "BATCHED-MUTATION-CURRENT");
      await ready(page, "BATCHED-MUTATION-CURRENT");
      await resolve(page, old, acknowledged(old));
      assert.deepEqual(await journal(page), originalJournal);
      await noAcknowledgment(page);
      assert.equal(await changeCount(page), 1);
      const retry = await submitSelection(page, true);
      assert.deepEqual(retry.args, old.args);
      await acknowledgeCurrent(page, retry);
    },
  );
  await mutationScenario(
    page,
    "auth readiness loss keeps pending notification unresolved through same-resource requalification",
    async () => {
      const old = await submitSelection(page),
        originalJournal = await journal(page);
      await page.evaluate(() => window.__auth.setLoaded(false));
      await concealed(page);
      await resolve(page, old, acknowledged(old));
      assert.deepEqual(await journal(page), originalJournal);
      assert.equal(await changeCount(page), 1);
      const current = await trigger(page, () =>
        page.evaluate(() => window.__auth.setLoaded(true)),
      );
      await concealed(page);
      await resolveAll(page, current, "AUTH-MUTATION-CURRENT");
      await ready(page, "AUTH-MUTATION-CURRENT");
      await noAcknowledgment(page);
      const retry = await submitSelection(page, true);
      assert.deepEqual(retry.args, old.args);
      await acknowledgeCurrent(page, retry);
    },
  );
  await mutationScenario(
    page,
    "different human cannot receive or retry another human's pending notification result",
    async () => {
      const old = await submitSelection(page),
        originalJournal = await journal(page);
      await page.evaluate(() =>
        window.__auth.set("synthetic-human-B", "other-human-session"),
      );
      await concealed(page, { filters: false });
      await resolve(page, old, acknowledged(old));
      assert.deepEqual(await journal(page), originalJournal);
      await concealed(page, { filters: false });
      assert.equal(await changeCount(page), 1);
      const current = await setSession(page, "returned-original-human-session");
      await resolveAll(page, current, "RETURNED-MUTATION-OWNER");
      await ready(page, "RETURNED-MUTATION-OWNER");
      await noAcknowledgment(page);
      const retry = await submitSelection(page, true);
      assert.deepEqual(retry.args, old.args);
      await acknowledgeCurrent(page, retry);
    },
  );
  await mutationScenario(
    page,
    "current read denial invalidates mutation acknowledgment and requires fresh authority before retry",
    async () => {
      const old = await submitSelection(page),
        originalJournal = await journal(page),
        current = await reload(page);
      for (const item of current)
        await resolve(page, item, { ok: false, code: "FORBIDDEN" });
      await concealed(page, { filters: false });
      await resolve(page, old, acknowledged(old));
      assert.deepEqual(await journal(page), originalJournal);
      assert.equal(await changeCount(page), 1);
      const restored = await reload(page);
      await resolveAll(page, restored, "CURRENT-AUTHORITY-RESTORED");
      await ready(page, "CURRENT-AUTHORITY-RESTORED");
      const retry = await submitSelection(page, true);
      assert.deepEqual(retry.args, old.args);
      await acknowledgeCurrent(page, retry);
    },
  );
  await mutationScenario(
    page,
    "pathname and query replacement reject the previous notification mutation",
    async () => {
      const old = await submitSelection(page),
        originalJournal = await journal(page),
        before = await watermark(page);
      await page.evaluate(() => {
        window.history.replaceState(
          null,
          "",
          "/notifications?filter=unread&lang=en",
        );
        window.__replaceQuery("Current mutation criteria");
      });
      const current = await reads(page, before);
      await resolveAll(page, current, "CURRENT-PATH-READ");
      await ready(page, "CURRENT-PATH-READ");
      await resolve(page, old, acknowledged(old));
      assert.deepEqual(await journal(page), originalJournal);
      await noAcknowledgment(page);
      assert.equal(await changeCount(page), 1);
      const retry = await submitSelection(page, true);
      assert.deepEqual(retry.args, old.args);
      await acknowledgeCurrent(page, retry);
    },
  );
  for (const [name, actorKey, sellerId] of [
    ["seller", "a".repeat(64), "a0000000-0000-4000-8000-000000000003"],
    ["actor scope", "b".repeat(64), null],
  ])
    await mutationScenario(
      page,
      `${name} replacement isolates the original pending notification journal`,
      async () => {
        const old = await submitSelection(page),
          originalJournal = await journal(page),
          before = await watermark(page);
        await page.evaluate(
          ([actor, seller]) => window.__replaceNotificationScope(actor, seller),
          [actorKey, sellerId],
        );
        const current = await pending(page, "notifications", before);
        await resolve(page, current, result(current, "CURRENT-SCOPE"));
        await page.waitForFunction(
          () =>
            document.querySelector("#notifications [data-notification-id] h2")
              ?.textContent === "CURRENT-SCOPE",
        );
        assert.equal(
          await page
            .locator("#notifications")
            .getByRole("heading", { name: "1 selected update", exact: true })
            .count(),
          0,
          "Old private draft does not render in new scope",
        );
        const newer = await submitSelection(page),
          beforeOld = await journal(page);
        assert.equal(newer.args[0].actorKey, actorKey);
        assert.equal(newer.args[0].sellerId, sellerId);
        assert.notEqual(
          newer.args[0].rows[0].requestId,
          old.args[0].rows[0].requestId,
        );
        await resolve(page, old, acknowledged(old));
        assert.deepEqual(
          await journal(page),
          beforeOld,
          "Old completion cannot change either original or newer scope journal",
        );
        for (const [key, raw] of Object.entries(originalJournal))
          assert.equal((await journal(page))[key], raw);
        assert.equal(
          await page
            .locator("#notifications")
            .getByRole("button", { name: "Saving…", exact: true })
            .isDisabled(),
          true,
        );
        await noAcknowledgment(page);
        await acknowledgeCurrent(page, newer);
      },
    );
  for (const outcome of ["transport exception", "whole-request unavailable"])
    await mutationScenario(
      page,
      `current ${outcome} requires fresh current read before exact explicit retry`,
      async () => {
        const obsoleteReads = await reload(page),
          baseline = await reload(page);
        await resolveAll(page, baseline);
        await ready(page);
        const oldRead = obsoleteReads.find(
            (item) => item.feature === "notifications",
          ),
          old = await submitSelection(page),
          before = await watermark(page);
        if (outcome === "transport exception") await reject(page, old);
        else await resolve(page, old, { ok: false, code: "NOT_AVAILABLE" });
        const current = await pending(page, "notifications", before);
        assert.equal(
          await page.locator("#notifications [data-notification-id]").count(),
          0,
        );
        assert.equal(
          await page
            .locator("#notifications")
            .getByRole("button", {
              name: "Retry unresolved updates",
              exact: true,
            })
            .count(),
          0,
          "Unknown outcome cannot retry against pre-fault authority",
        );
        await noAcknowledgment(page);
        const saved = Object.values(await journal(page)).map((raw) =>
          JSON.parse(raw),
        );
        assert.equal(saved[0].entries[0].result.state, "unresolved");
        assert.equal(saved[0].entries[0].result.code, "NOT_AVAILABLE");
        assert.equal(await changeCount(page), 1);
        await resolve(page, oldRead, result(oldRead, "PRE-FAULT-OBSOLETE"));
        assert.equal(
          await page.locator("#notifications [data-notification-id]").count(),
          0,
          "Pre-fault read cannot restore authority",
        );
        assert.equal(await changeCount(page), 1);
        await resolve(page, current, { ok: false, code: "NOT_AVAILABLE" });
        await page
          .locator("#notifications")
          .getByText(
            "Notifications could not be loaded. Your saved read selection is retained.",
            { exact: true },
          )
          .waitFor();
        assert.equal(
          await page
            .locator("#notifications")
            .getByRole("button", {
              name: "Retry unresolved updates",
              exact: true,
            })
            .count(),
          0,
        );
        assert.equal(
          await changeCount(page),
          1,
          "Failed current read does not replay uncertain command",
        );
        const beforeRetryRead = await watermark(page);
        await page
          .locator("#notifications")
          .getByRole("button", { name: "Reload current state", exact: true })
          .last()
          .click();
        const qualified = await pending(page, "notifications", beforeRetryRead);
        assert.equal(await changeCount(page), 1);
        await resolve(page, qualified, result(qualified, "POST-FAULT-CURRENT"));
        await page
          .locator("#notifications")
          .getByRole("button", {
            name: "Retry unresolved updates",
            exact: true,
          })
          .waitFor();
        const retry = await submitSelection(page, true);
        assert.deepEqual(retry.args, old.args);
        await acknowledgeCurrent(page, retry);
      },
    );
  await mutationScenario(
    page,
    "unmount prevents late notification completion from rewriting recovery",
    async () => {
      const old = await submitSelection(page),
        originalJournal = await journal(page);
      await page.evaluate(() => window.__unmount());
      assert.equal(await page.evaluate(() => window.__auth.listeners()), 0);
      await resolve(page, old, acknowledged(old));
      assert.deepEqual(await journal(page), originalJournal);
      assert.equal(await page.locator("#root").textContent(), "");
    },
  );
  assert.deepEqual(errors, [], "No page errors");
  console.log(JSON.stringify({ cases: outcomes.length, outcomes }, null, 2));
} finally {
  await browser?.close();
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
