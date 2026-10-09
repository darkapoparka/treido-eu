/* global window: readonly, document: readonly, Event: readonly, PageTransitionEvent: readonly */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import path from "node:path";
import process from "node:process";
import console from "node:console";

// Real preference panel/hook with synthetic Clerk/actions and a minimal account
// shell. This packet qualifies interaction fences, not buyer appearance,
// persistence, real identities, recipient verification or delivery.
const app = process.cwd(),
  req = createRequire(path.join(app, "package.json")),
  web = createRequire(path.join(app, "apps/web/package.json")),
  vite = createRequire(req.resolve("vitest/config"));
const { build } = await import(pathToFileURL(vite.resolve("vite")).href);
const clerk = `
import {useSyncExternalStore} from 'react';import {flushSync} from 'react-dom';
const listeners=new Set(),resources=new Set();
let state={user:{id:'human-A'},session:{id:'session-A',status:'active'}};
const clerk={get user(){return state.user},get session(){return state.session},addListener(listener){resources.add(listener);listener(state);return()=>resources.delete(listener)}};
window.__auth={set(subject='human-A',id='session-A',status='active'){
state={user:subject?{id:subject}:null,session:id?{id,status}:null};
flushSync(()=>{resources.forEach(listener=>listener(state));listeners.forEach(listener=>listener())});}};
export const useClerk=()=>clerk;
export function useUser(){const snapshot=useSyncExternalStore(listener=>{listeners.add(listener);return()=>listeners.delete(listener)},()=>state);return {isLoaded:true,isSignedIn:!!snapshot.user&&snapshot.session?.status==='active',user:snapshot.user}}
`;
const actions = `
window.__requests=[];let sequence=0;
function request(kind,args){return new Promise((resolve,reject)=>window.__requests.push({id:++sequence,kind,args,resolve,reject,done:false}))}
window.__resolve=(id,result)=>{const request=window.__requests.find(item=>item.id===id);if(!request||request.done)throw Error('Missing request '+id);request.done=true;request.resolve(result)};
window.__reject=id=>{const request=window.__requests.find(item=>item.id===id);if(!request||request.done)throw Error('Missing request '+id);request.done=true;request.reject(Error('Synthetic unavailable'))};
export const readNotificationPreferenceAction=language=>request('read',[language]);
export const notificationPreferenceAction=input=>request('change',[input]);
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
      name: "notification-preferences-deferred-fixture",
      enforce: "pre",
      resolveId(id, importer) {
        const resolved = (
          id.startsWith(".") && importer
            ? path.resolve(path.dirname(importer), id)
            : id
        ).replaceAll("\\", "/");
        if (id === "@clerk/nextjs") return "\0preferences:clerk";
        if (id === "next/navigation") return "\0preferences:navigation";
        if (resolved.endsWith("/account/forms")) return "\0preferences:shell";
        if (resolved.endsWith("/discovery/return-navigation"))
          return "\0preferences:links";
        if (
          id === "./actions" &&
          importer
            ?.replaceAll("\\", "/")
            .endsWith("/notification-delivery/use-preferences.ts")
        )
          return "\0preferences:actions";
      },
      load(id) {
        if (id === "\0preferences:clerk") return clerk;
        if (id === "\0preferences:actions") return actions;
        if (id === "\0preferences:navigation")
          return "const router={refresh:()=>{}};export const useRouter=()=>router;";
        if (id === "\0preferences:shell")
          return "import React from'react';export function AccountPage({title,children,className}){return React.createElement('main',{className},React.createElement('h1',null,title),children)}";
        if (id === "\0preferences:links")
          return "import React from'react';export const SourceLink=props=>React.createElement('a',props);";
      },
    },
  ],
  build: {
    write: false,
    minify: false,
    lib: {
      entry: path.join(app, "tests/t56/notification-preferences-entry.tsx"),
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
const actorKey = "a".repeat(64),
  errors = [],
  outcomes = [];
let browser;
function readResult(
  settings = { savedSearchEmail: false, messageEmail: false },
  extras = {},
) {
  return {
    ok: true,
    data: {
      actorKey,
      actorSubject: "human-A",
      revision: 1,
      language: "en",
      settings,
      recipient: "ready",
      deliveryAvailable: true,
      ...extras,
    },
  };
}
function acknowledgement(command) {
  return {
    ok: true,
    data: {
      actorKey,
      actorSubject: "human-A",
      requestId: command.requestId,
      revision: 2,
      settings: {
        savedSearchEmail: command.savedSearchEmail,
        messageEmail: command.messageEmail,
      },
    },
  };
}
async function pending(page, kind) {
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
async function languageRead(page, language) {
  await page.waitForFunction(
    (wanted) =>
      window.__requests.some(
        (item) => item.kind === "read" && !item.done && item.args[0] === wanted,
      ),
    language,
  );
  return page.evaluate((wanted) => {
    const item = window.__requests.find(
      (value) =>
        value.kind === "read" && !value.done && value.args[0] === wanted,
    );
    return { id: item.id, args: item.args };
  }, language);
}
async function resolve(page, request, result) {
  await page.evaluate(
    ([id, response]) => window.__resolve(id, response),
    [request.id, result],
  );
}
async function ready(page) {
  await page.waitForFunction(
    () =>
      !document.querySelector("button") &&
      document.querySelector('input[name="savedSearchEmail"]')?.disabled ===
        false,
  );
}
async function open(page, result = readResult(), language = "en") {
  await page.goto(
    `http://127.0.0.1:${server.address().port}/?lang=${language}`,
  );
  for (let attempt = 0; attempt < 3; attempt++) {
    await resolve(page, await pending(page, "read"), result);
    await page.waitForFunction(
      () =>
        !window.__requests.some((item) => item.kind === "read" && !item.done) ||
        document.querySelector('input[name="savedSearchEmail"]')?.disabled ===
          false,
    );
    if (
      !(await page.evaluate(() =>
        window.__requests.some((item) => item.kind === "read" && !item.done),
      ))
    )
      return;
  }
  throw new Error("Initial preference read did not settle");
}
async function complete(page, change, settings, extras = {}) {
  await resolve(page, change, acknowledgement(change.args[0]));
  await resolve(
    page,
    await pending(page, "read"),
    readResult(settings, { revision: 2, ...extras }),
  );
}
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on("pageerror", (error) => errors.push(error.message));

  await open(page);
  await ready(page);
  assert.equal(
    await page.evaluate(
      () => window.__requests.filter((item) => item.kind === "change").length,
    ),
    0,
  );
  assert.equal(
    await page.locator('input[name="savedSearchEmail"]').isChecked(),
    false,
  );
  assert.equal(
    await page.locator('input[name="messageEmail"]').isChecked(),
    false,
  );
  assert.equal(await page.getByRole("switch").nth(2).isDisabled(), true);
  outcomes.push(
    "Read/sign-in does not opt in; initial saved flags off; push disabled",
  );

  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.waitForFunction(
    () =>
      document.querySelector('input[name="savedSearchEmail"]')?.disabled ===
      true,
  );
  await page
    .getByRole("button", { name: "Refresh preferences", exact: true })
    .click();
  await resolve(page, await pending(page, "read"), readResult());
  await ready(page);
  outcomes.push(
    "Visible explicit Refresh recovers concealed preferences after blur without a focus event",
  );

  await page.locator('input[name="savedSearchEmail"]').click();
  const explicit = await pending(page, "change"),
    command = explicit.args[0];
  assert.deepEqual(Object.keys(command).sort(), [
    "actorKey",
    "consentVersion",
    "expectedRevision",
    "language",
    "messageEmail",
    "requestId",
    "savedSearchEmail",
  ]);
  assert.equal(command.consentVersion, "email-notifications-v1");
  assert.equal(command.savedSearchEmail, true);
  assert.equal(command.messageEmail, false);
  assert.equal(
    await page.locator('input[name="savedSearchEmail"]').isChecked(),
    false,
  );
  await complete(page, explicit, {
    savedSearchEmail: true,
    messageEmail: false,
  });
  await page.waitForFunction(
    () =>
      document.querySelector('input[name="savedSearchEmail"]')?.checked ===
      true,
  );
  outcomes.push(
    "Explicit opt-in sends narrow consent command; checked state follows matched acknowledgment and reread",
  );

  await page.locator('input[name="savedSearchEmail"]').click();
  const uncertain = await pending(page, "change");
  await page.evaluate((id) => window.__reject(id), uncertain.id);
  await page
    .getByRole("button", { name: "Retry the same request", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Retry the same request", exact: true })
    .click();
  const retry = await pending(page, "change");
  assert.deepEqual(retry.args[0], uncertain.args[0]);
  await complete(page, retry, { savedSearchEmail: false, messageEmail: false });
  await page.waitForFunction(
    () =>
      document.querySelector('input[name="savedSearchEmail"]')?.disabled ===
      false,
  );
  assert.equal(
    await page.locator('input[name="savedSearchEmail"]').isChecked(),
    false,
  );
  outcomes.push(
    "Unknown response keeps exact command; retry neither changes UUID nor consent input",
  );

  await open(page);
  await ready(page);
  await page.locator('input[name="messageEmail"]').click();
  const oldChange = await pending(page, "change");
  await page.evaluate(() => window.__auth.set("human-A", "session-B"));
  await resolve(page, oldChange, acknowledgement(oldChange.args[0]));
  await resolve(page, await pending(page, "read"), readResult());
  await page
    .getByRole("button", { name: "Retry the same request", exact: true })
    .waitFor();
  assert.equal(
    await page.locator('input[name="messageEmail"]').isChecked(),
    false,
  );
  await page
    .getByRole("button", { name: "Retry the same request", exact: true })
    .click();
  const sameSessionRetry = await pending(page, "change");
  assert.deepEqual(sameSessionRetry.args[0], oldChange.args[0]);
  await complete(page, sameSessionRetry, {
    savedSearchEmail: false,
    messageEmail: true,
  });
  await page.waitForFunction(
    () =>
      document.querySelector('input[name="messageEmail"]')?.checked === true,
  );
  outcomes.push(
    "Delayed old-session acknowledgment cannot replace current flags or erase exact pending retry",
  );

  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.waitForFunction(
    () =>
      document.querySelector('input[name="messageEmail"]')?.checked === false,
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await resolve(page, await pending(page, "read"), {
    ok: false,
    code: "UNAUTHENTICATED",
  });
  await page.getByRole("alert").waitFor();
  assert.equal(
    await page.locator('input[name="messageEmail"]').isDisabled(),
    true,
  );
  outcomes.push(
    "Restoration conceals saved flags until fresh access; revoked session remains disabled",
  );

  await open(
    page,
    readResult(
      { savedSearchEmail: true, messageEmail: true },
      { recipient: "unavailable", deliveryAvailable: false },
    ),
  );
  await page.waitForFunction(
    () =>
      document.querySelector('input[name="savedSearchEmail"]')?.checked ===
      true,
  );
  assert.equal(
    await page.locator('input[name="savedSearchEmail"]').isDisabled(),
    false,
  );
  assert.equal(
    await page.locator('input[name="messageEmail"]').isDisabled(),
    false,
  );
  await page.locator('input[name="savedSearchEmail"]').click();
  const optOut = await pending(page, "change");
  assert.equal(optOut.args[0].savedSearchEmail, false);
  assert.equal(optOut.args[0].messageEmail, true);
  await complete(
    page,
    optOut,
    { savedSearchEmail: false, messageEmail: true },
    { recipient: "unavailable", deliveryAvailable: false },
  );
  await page.waitForFunction(
    () =>
      document.querySelector('input[name="savedSearchEmail"]')?.checked ===
      false,
  );
  assert.equal(
    await page.locator('input[name="savedSearchEmail"]').isDisabled(),
    true,
  );
  await page.locator('input[name="messageEmail"]').click();
  const secondOptOut = await pending(page, "change");
  assert.equal(secondOptOut.args[0].savedSearchEmail, false);
  assert.equal(secondOptOut.args[0].messageEmail, false);
  await complete(
    page,
    secondOptOut,
    { savedSearchEmail: false, messageEmail: false },
    { recipient: "unavailable", deliveryAvailable: false },
  );
  await page.waitForFunction(
    () =>
      document.querySelector('input[name="messageEmail"]')?.checked === false,
  );
  outcomes.push(
    "Unavailable recipient/provider blocks new opt-in while preserving explicit opt-out",
  );

  await open(page, readResult({ savedSearchEmail: true, messageEmail: true }));
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    ),
  );
  const restoreRead = await pending(page, "read");
  await page.evaluate(() => window.__auth.set("human-B", "session-B"));
  await resolve(
    page,
    restoreRead,
    readResult({ savedSearchEmail: true, messageEmail: true }),
  );
  await page.waitForFunction(
    () =>
      document.querySelector('input[name="savedSearchEmail"]')?.checked ===
      false,
  );
  assert.equal(
    await page.locator('input[name="messageEmail"]').isChecked(),
    false,
  );
  assert.equal(await page.getByRole("switch").nth(0).isDisabled(), true);
  outcomes.push("Actor switch discards delayed private preference read");

  await open(page, readResult(), "bg");
  await ready(page);
  assert.equal(await page.getByRole("heading").innerText(), "Известия");
  await page.locator('input[name="messageEmail"]').click();
  const bgCommand = await pending(page, "change");
  assert.equal(bgCommand.args[0].language, "bg");
  await complete(
    page,
    bgCommand,
    { savedSearchEmail: false, messageEmail: true },
    { language: "bg" },
  );
  await page
    .getByText("Предпочитанието е запазено.", { exact: true })
    .waitFor();
  outcomes.push(
    "BG labels and command locale stay explicit; no recipient address is rendered",
  );

  await open(page);
  await ready(page);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("blur"));
    window.dispatchEvent(new Event("focus"));
  });
  const oldLanguageRead = await languageRead(page, "en");
  await page.evaluate(() => window.__setLanguage("bg"));
  const currentLanguageRead = await languageRead(page, "bg");
  assert.notEqual(currentLanguageRead.id, oldLanguageRead.id);
  await resolve(
    page,
    oldLanguageRead,
    readResult(
      { savedSearchEmail: true, messageEmail: true },
      { revision: 99 },
    ),
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Обнови предпочитанията", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(
    await page.locator('input[name="savedSearchEmail"]').isChecked(),
    false,
  );
  assert.equal(await page.getByRole("switch").nth(0).isDisabled(), true);
  await resolve(
    page,
    currentLanguageRead,
    readResult(undefined, { language: "bg" }),
  );
  await ready(page);
  assert.equal(await page.getByRole("heading").innerText(), "Известия");
  assert.equal(
    await page.locator('input[name="messageEmail"]').isChecked(),
    false,
  );
  outcomes.push(
    "In-place language switch starts a fresh read before the obsolete read settles; its finalizer cannot release current busy state",
  );

  await open(page);
  await ready(page);
  await page.locator('input[name="messageEmail"]').click();
  const oldLanguageSave = await pending(page, "change"),
    originalCommand = oldLanguageSave.args[0],
    originalJournal = await page.evaluate(
      (actor) =>
        window.sessionStorage.getItem(`treido-email-preference-v1:${actor}`),
      actorKey,
    );
  await page.evaluate(() => window.__setLanguage("bg"));
  const saveLanguageRead = await languageRead(page, "bg");
  await resolve(page, oldLanguageSave, acknowledgement(originalCommand));
  assert.equal(
    await page
      .getByRole("button", { name: "Обнови предпочитанията", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(
    await page.evaluate(
      (actor) =>
        window.sessionStorage.getItem(`treido-email-preference-v1:${actor}`),
      actorKey,
    ),
    originalJournal,
  );
  await resolve(
    page,
    saveLanguageRead,
    readResult(undefined, { language: "bg" }),
  );
  const translatedRetry = page.getByRole("button", {
    name: "Повтори същата заявка",
    exact: true,
  });
  await page.waitForFunction(() =>
    [...document.querySelectorAll("button")].some(
      (button) =>
        button.textContent === "Повтори същата заявка" && !button.disabled,
    ),
  );
  assert.equal(
    await page.locator('input[name="messageEmail"]').isChecked(),
    false,
  );
  await translatedRetry.click();
  const originalLanguageRetry = await pending(page, "change");
  assert.deepEqual(originalLanguageRetry.args[0], originalCommand);
  assert.equal(originalLanguageRetry.args[0].language, "en");
  await resolve(page, originalLanguageRetry, acknowledgement(originalCommand));
  await resolve(
    page,
    await languageRead(page, "bg"),
    readResult(
      { savedSearchEmail: false, messageEmail: true },
      { revision: 2, language: "bg" },
    ),
  );
  await page
    .getByText("Предпочитанието е запазено.", { exact: true })
    .waitFor();
  assert.equal(
    await page.locator('input[name="messageEmail"]').isChecked(),
    true,
  );
  assert.equal(
    await page.evaluate(
      (actor) =>
        window.sessionStorage.getItem(`treido-email-preference-v1:${actor}`),
      actorKey,
    ),
    null,
  );
  outcomes.push(
    "In-place language switch during save preserves the original journal and exact command language; obsolete acknowledgment cannot erase recovery or stall the current read",
  );

  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: outcomes.length,
      outcomes,
      errors,
      fixtureOnly: true,
      realPersistence: false,
      realProvider: false,
      visualAcceptance: false,
    }),
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
