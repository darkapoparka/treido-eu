/* global window: readonly, document: readonly */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { pathToFileURL, URL } from "node:url";
import path from "node:path";
import process from "node:process";
import console from "node:console";

// Actual Team and shared read hook. Deferred synthetic Clerk/actions/clipboard
// exercise browser fencing only; no real identity, mail, database or visual claim.
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
window.__auth={set(subject='synthetic-human-A',id='session-A',status='active'){flushSync(()=>update(subject,id,status));},setLoaded(loaded){flushSync(()=>{state={...state,loaded};listeners.forEach(listener=>listener());});},batchRoundTrip(){flushSync(()=>{update('synthetic-human-A','session-B','active');update('synthetic-human-A','session-A','active');});},silent(subject,id,status='active'){state={loaded:true,user:subject?{id:subject}:null,session:id?{id,status}:null};},current:()=>state};
export const useClerk=()=>clerk;
export function useAuth(){const current=useSyncExternalStore(listener=>{listeners.add(listener);return()=>listeners.delete(listener);},()=>state);return {isLoaded:current.loaded,userId:current.user?.id??null,sessionId:current.session?.id??null,isSignedIn:!!current.user&&current.session?.status==='active'};}
let visibility='visible';Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>visibility});
window.__visibility=(value,emit=true)=>{visibility=value;if(emit)flushSync(()=>document.dispatchEvent(new Event('visibilitychange')));};
`;
const navigation = `
import {useSyncExternalStore} from 'react';import {flushSync} from 'react-dom';
const listeners=new Set();
const subscribe=listener=>{listeners.add(listener);return()=>listeners.delete(listener)};
export const usePathname=()=>useSyncExternalStore(subscribe,()=>location.pathname);
export const useSearchParams=()=>new URLSearchParams(useSyncExternalStore(subscribe,()=>location.search));
window.__route=path=>{history.pushState({},'',path);flushSync(()=>{listeners.forEach(listener=>listener());window.dispatchEvent(new Event('popstate'));});};
`;
const actions = `
window.__requests=[];let sequence=0;
window.__request=(kind,args)=>{const auth=window.__auth.current();return new Promise((resolve,reject)=>window.__requests.push({id:++sequence,kind,args:JSON.parse(JSON.stringify(args)),sessionId:auth.session?.id,subject:auth.user?.id,done:false,resolve,reject}));};
window.__resolve=(id,result)=>{const item=window.__requests.find(value=>value.id===id);if(!item||item.done)throw Error('Missing request '+id);item.done=true;item.resolve(result);};
window.__reject=id=>{const item=window.__requests.find(value=>value.id===id);if(!item||item.done)throw Error('Missing request '+id);item.done=true;item.reject(Error('Synthetic uncertain transport'));};
Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:text=>window.__request('copy',[text])}});
export const readTeamAction=sellerId=>window.__request('read',[sellerId]);
export const changeTeamAction=command=>window.__request('change',[command]);
`;
// Record exact callbacks from the unchanged actual presenter's JSX. The facade
// returns each real runtime result without replacing behavior or private data.
const jsxRuntime = `
import {jsx as actualJsx,jsxs as actualJsxs,Fragment} from ${JSON.stringify(web.resolve("react/jsx-runtime").replaceAll("\\", "/"))};
export {Fragment};
window.__teamCallbacks={};
const capture=(type,props)=>{const current=window.__teamCallbacks;
if(type==='button'&&props.children==='Invite member')current.open=props.onClick;
if(type==='button'&&props.children==='Refresh')current.refresh=props.onClick;
if(type==='button'&&props.children==='Cancel')current.cancel=props.onClick;
if(type==='input'&&props.type==='email')current.change=props.onChange;
if(type==='form'&&props.onSubmit)current.submit=props.onSubmit;};
export const jsx=(type,props,key)=>{capture(type,props);return actualJsx(type,props,key);};
export const jsxs=(type,props,key)=>{capture(type,props);return actualJsxs(type,props,key);};
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
      replacement:
        name === "react/jsx-runtime"
          ? "\0team:jsx-runtime"
          : name === "use-intl"
            ? intl.resolve(name)
            : web.resolve(name),
    })),
  },
  plugins: [
    {
      name: "team-session-deferred-fixture",
      enforce: "pre",
      resolveId(id, importer) {
        if (id === "@clerk/nextjs") return "\0team:clerk";
        if (id === "next/navigation") return "\0team:navigation";
        if (id === "next/link") return "\0team:link";
        if (id === "next-intl") return "\0team:intl";
        if (
          id === "./actions" &&
          importer?.replaceAll("\\", "/").endsWith("/team/team.tsx")
        )
          return "\0team:actions";
      },
      load(id) {
        if (id === "\0team:clerk") return clerk;
        if (id === "\0team:navigation") return navigation;
        if (id === "\0team:actions") return actions;
        if (id === "\0team:jsx-runtime") return jsxRuntime;
        if (id === "\0team:intl")
          return "export {useTranslations,useFormatter,IntlProvider as NextIntlClientProvider} from 'use-intl';";
        if (id === "\0team:link")
          return "import {createElement} from 'react';export default function Link(props){return createElement('a',props)}";
      },
    },
  ],
  build: {
    write: false,
    minify: false,
    lib: {
      entry: path.join(app, "tests/t56/team-session-entry.tsx"),
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
  invitation = "a0000000-0000-4000-8000-000000000002",
  outcomes = [],
  errors = [];
let browser;
function result(marker = "CURRENT-PRIVATE", sellerId = sellerA, revision = 4) {
  return {
    ok: true,
    data: {
      sellerId,
      name: marker,
      revision,
      seats: 10,
      usedSeats: 1,
      reservedSeats: 1,
      managerDefaults: ["seller.read", "listing.read"],
      delegable: ["seller.read", "listing.read", "inbox.read"],
      canInviteManager: true,
      members: [],
      invitations: [
        {
          id: invitation,
          recipient: "current-private@example.test",
          role: "member",
          grants: ["seller.read"],
          status: "pending",
          expiresAt: "2026-10-16T00:00:00Z",
          delivery: "pending",
          canManage: true,
          canRetryMail: false,
          canResendMail: true,
        },
      ],
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
          (item) =>
            item.kind === wanted.kind && item.id > wanted.after && !item.done,
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
    () =>
      !document.querySelector("[data-team]") &&
      !document.querySelector("dialog"),
  );
  assert.equal(await page.locator("[data-team]").count(), 0);
  assert.equal(await page.locator("dialog").count(), 0);
  assert.equal(
    (await page.locator("body").textContent()).includes(
      "current-private@example.test",
    ),
    false,
  );
}
async function ready(
  page,
  marker = "CURRENT-PRIVATE",
  sellerId = sellerA,
  after = 0,
  seats = 10,
) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const read = await pending(page, "read", after);
    after = read.id;
    const projection = result(marker, sellerId);
    projection.data.seats = seats;
    await resolve(page, read, projection);
    await page.waitForFunction(
      (text) =>
        document.querySelector("[data-team]")?.textContent.includes(text) ||
        window.__requests.some((item) => item.kind === "read" && !item.done),
      marker,
    );
    if (await page.locator("[data-team]").count()) {
      assert.equal(
        (await page.locator("[data-team]").textContent()).includes(marker),
        true,
      );
      return read;
    }
  }
  throw Error("Current authorized Team read did not settle");
}
async function open(page) {
  await page.goto(
    `http://127.0.0.1:${server.address().port}/app/${sellerA}/team?lang=en`,
  );
  await hidden(page);
  await ready(page);
}
async function invite(page, recipient = "original+draft@example.test") {
  await page
    .getByRole("button", { name: "Invite member", exact: true })
    .first()
    .click();
  await page.getByRole("dialog").waitFor();
  await page.getByLabel("Recipient email", { exact: true }).fill(recipient);
  await page
    .getByRole("button", { name: "Create invitation", exact: true })
    .click();
  return pending(page, "change");
}
async function changes(page) {
  return page.evaluate(
    () => window.__requests.filter((item) => item.kind === "change").length,
  );
}
async function frozenRetry(page, original, after = original.id) {
  assert.equal(
    await page.getByLabel("Recipient email", { exact: true }).inputValue(),
    original.args[0].recipient,
  );
  assert.equal(
    await page.getByLabel("Recipient email", { exact: true }).isDisabled(),
    true,
  );
  await page
    .getByRole("button", { name: "Create invitation", exact: true })
    .click();
  const retry = await pending(page, "change", after);
  assert.deepEqual(retry.args, original.args);
  return retry;
}
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue()
      : route.abort(),
  );

  await open(page);
  const sessionOld = await invite(page);
  await page.evaluate(() =>
    window.__auth.set("synthetic-human-A", "session-B"),
  );
  await hidden(page);
  await resolve(page, sessionOld, result("OBSOLETE-ACK"));
  await hidden(page);
  assert.equal(await changes(page), 1);
  await ready(page, "SESSION-B-CURRENT", sellerA, sessionOld.id);
  const sessionRetry = await frozenRetry(page, sessionOld);
  await resolve(page, sessionRetry, result("ACK", sellerA, 5));
  await page.getByRole("dialog").waitFor({ state: "detached" });
  assert.equal(
    (await page.locator("body").textContent()).includes("OBSOLETE-ACK"),
    false,
  );
  outcomes.push(
    "Same-human A→B session replacement removes private DOM; hidden acknowledgment retains exact frozen command for deliberate retry after fresh read",
  );

  await open(page);
  const roundOld = await invite(page);
  await page.evaluate(() => window.__auth.batchRoundTrip());
  await hidden(page);
  await ready(page, "ROUNDTRIP-CURRENT", sellerA, roundOld.id);
  const roundRetry = await frozenRetry(page, roundOld);
  await resolve(page, roundOld, result("ROUNDTRIP-OBSOLETE"));
  assert.equal(
    await page
      .getByRole("button", { name: "Saving…", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(
    await page.getByLabel("Recipient email", { exact: true }).inputValue(),
    roundOld.args[0].recipient,
  );
  assert.equal(await changes(page), 2);
  await resolve(page, roundRetry, result("ACK", sellerA, 5));
  await page.getByRole("dialog").waitFor({ state: "detached" });
  outcomes.push(
    "A→B→A batched Clerk replacements fence old success/finally and cannot unlock or clear the newer retry",
  );

  await open(page);
  const resourceOld = await invite(page);
  await page.evaluate(() =>
    window.__auth.set("synthetic-human-A", "session-A"),
  );
  await hidden(page);
  await resolve(page, resourceOld, result("RESOURCE-OBSOLETE"));
  await hidden(page);
  await ready(page, "RESOURCE-CURRENT", sellerA, resourceOld.id);
  await frozenRetry(page, resourceOld);
  outcomes.push(
    "Replacing active Clerk resource objects with identical IDs still invalidates the generation and requires fresh authority before exact retry",
  );

  await open(page);
  const staleException = await invite(page);
  await page.evaluate(() =>
    window.__auth.set("synthetic-human-A", "session-B"),
  );
  await hidden(page);
  await ready(page, "NEWER-CURRENT", sellerA, staleException.id);
  const newer = await frozenRetry(page, staleException);
  await page.evaluate((id) => window.__reject(id), staleException.id);
  assert.equal(
    await page
      .getByRole("button", { name: "Saving…", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(await page.getByRole("alert").count(), 0);
  await resolve(page, newer, result("ACK", sellerA, 5));
  outcomes.push(
    "Obsolete mutation exception/finally cannot add an error or release a newer operation",
  );

  await open(page);
  const hiddenOld = await invite(page);
  await page.evaluate(() => window.__visibility("hidden"));
  await hidden(page);
  await resolve(page, hiddenOld, result("HIDDEN-ACK"));
  assert.equal(await changes(page), 1);
  await hidden(page);
  await page.evaluate(() => window.__visibility("visible"));
  await hidden(page);
  await ready(page, "VISIBLE-CURRENT", sellerA, hiddenOld.id);
  await frozenRetry(page, hiddenOld);
  assert.equal(await changes(page), 2);
  outcomes.push(
    "Hidden acknowledgment never reveals old rows/dialog/notices or automatically resends; visible restoration requires read then exact explicit retry",
  );

  await open(page);
  const uncertain = await invite(page);
  await page.evaluate((id) => window.__reject(id), uncertain.id);
  await hidden(page);
  assert.equal(await changes(page), 1);
  await ready(page, "UNCERTAIN-CURRENT", sellerA, uncertain.id);
  assert.equal(await changes(page), 1);
  const explicitRetry = await frozenRetry(page, uncertain);
  await resolve(page, explicitRetry, result("ACK", sellerA, 5));
  outcomes.push(
    "A current uncertain transport preserves the command, automatically reads only, and waits for deliberate exact retry after fresh authorization",
  );

  await open(page);
  const originallyUnknown = await invite(page);
  await page.evaluate((id) => window.__reject(id), originallyUnknown.id);
  await hidden(page);
  await ready(page, "UNKNOWN-RETRY-CURRENT", sellerA, originallyUnknown.id);
  const deniedRetry = await frozenRetry(page, originallyUnknown);
  await resolve(page, deniedRetry, { ok: false, code: "FORBIDDEN" });
  await hidden(page);
  assert.equal(await changes(page), 2);
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await hidden(page);
  await ready(page, "RETRY-REAUTHORIZED", sellerA, deniedRetry.id);
  assert.equal(
    await changes(page),
    2,
    "Authority read must not replay command",
  );
  const afterDenial = await frozenRetry(
    page,
    originallyUnknown,
    deniedRetry.id,
  );
  assert.deepEqual(afterDenial.args, originallyUnknown.args);
  await resolve(page, afterDenial, { ok: false, code: "CONFLICT" });
  await hidden(page);
  await ready(page, "CONFLICT-REAUTHORIZED", sellerA, afterDenial.id);
  assert.equal(await changes(page), 3);
  assert.equal(
    await page.getByLabel("Recipient email", { exact: true }).isDisabled(),
    true,
  );
  await page
    .getByRole("button", { name: "Compare current team", exact: true })
    .click();
  const currentComparison = await pending(page, "read", afterDenial.id);
  await resolve(
    page,
    currentComparison,
    result("CURRENT-COMPARISON", sellerA, 7),
  );
  await page
    .getByRole("button", {
      name: "Keep input and use this team revision",
      exact: true,
    })
    .click();
  assert.equal(
    await changes(page),
    3,
    "Adopting a comparison is local review only",
  );
  assert.equal(
    await page.getByLabel("Recipient email", { exact: true }).isDisabled(),
    false,
  );
  assert.equal(
    await page.getByLabel("Recipient email", { exact: true }).inputValue(),
    originallyUnknown.args[0].recipient,
  );
  await page
    .getByRole("button", { name: "Create invitation", exact: true })
    .click();
  const reviewed = await pending(page, "change", currentComparison.id);
  assert.notEqual(
    reviewed.args[0].requestId,
    originallyUnknown.args[0].requestId,
  );
  assert.equal(reviewed.args[0].expectedRevision, 7);
  assert.equal(reviewed.args[0].recipient, originallyUnknown.args[0].recipient);
  assert.deepEqual(reviewed.args[0].access, originallyUnknown.args[0].access);
  await resolve(page, reviewed, result("ACK", sellerA, 8));
  await page.getByRole("dialog").waitFor({ state: "detached" });
  outcomes.push(
    "Denied/conflicting retries retain the unknown original tuple; only deliberate current comparison adoption permits a newly reviewed revision and UUID",
  );

  await open(page);
  const cancelUnknown = await invite(page);
  await page.evaluate((id) => window.__reject(id), cancelUnknown.id);
  await hidden(page);
  await ready(page, "CANCEL-RECOVERY-CURRENT", sellerA, cancelUnknown.id, 2);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .last()
    .click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  assert.equal(await changes(page), 1);
  assert.equal(
    await page
      .getByRole("button", { name: "Invite member", exact: true })
      .first()
      .isEnabled(),
    true,
  );
  await page
    .getByRole("button", { name: "Invite member", exact: true })
    .first()
    .click();
  await page.getByRole("dialog").waitFor();
  const afterCancel = await frozenRetry(page, cancelUnknown);
  assert.deepEqual(afterCancel.args, cancelUnknown.args);
  const fullCapacityAck = result("ACK", sellerA, 5);
  fullCapacityAck.data.seats = 2;
  await resolve(page, afterCancel, fullCapacityAck);
  await page.getByRole("dialog").waitFor({ state: "detached" });
  assert.equal(
    await page
      .getByRole("button", { name: "Invite member", exact: true })
      .first()
      .isDisabled(),
    true,
  );
  outcomes.push(
    "Cancel closes an uncertain dialog; its exact command can be deliberately reopened/retried at capacity, while acknowledged new invitations remain capacity gated",
  );

  await open(page);
  await page
    .getByRole("button", { name: "Invite member", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Recipient email", { exact: true })
    .fill("earlier+draft@example.test");
  await page.evaluate(() => {
    const callbacks = window.__teamCallbacks;
    if (
      ["open", "refresh", "cancel", "change", "submit"].some(
        (key) => typeof callbacks[key] !== "function",
      )
    )
      throw Error("Actual Team callback capture was incomplete");
    window.__retainedTeam = { ...callbacks };
    window.__auth.setLoaded(false);
  });
  await hidden(page);
  await page.evaluate(() => window.__auth.setLoaded(true));
  const loadedCurrent = await ready(page, "LOADED-CURRENT");
  await page.getByRole("dialog").waitFor();
  await page
    .getByLabel("Recipient email", { exact: true })
    .fill("current+draft@example.test");
  const loadedReadCount = await page.evaluate(
    () => window.__requests.filter((item) => item.kind === "read").length,
  );
  await page.evaluate(async () => {
    const old = window.__retainedTeam;
    old.open();
    old.cancel();
    old.change({ target: { value: "obsolete+draft@example.test" } });
    void old.submit({ preventDefault() {} });
    old.refresh();
    await Promise.resolve();
  });
  assert.equal(await changes(page), 0);
  assert.equal(
    await page.evaluate(
      () => window.__requests.filter((item) => item.kind === "read").length,
    ),
    loadedReadCount,
  );
  assert.equal(
    (await page.locator("[data-team]").textContent()).includes(
      "LOADED-CURRENT",
    ),
    true,
  );
  assert.equal(await page.getByRole("dialog").count(), 1);
  assert.equal(
    await page.getByLabel("Recipient email", { exact: true }).inputValue(),
    "current+draft@example.test",
  );
  await page
    .getByRole("button", { name: "Create invitation", exact: true })
    .click();
  const loadedWrite = await pending(page, "change", loadedCurrent.id);
  assert.equal(loadedWrite.args[0].recipient, "current+draft@example.test");
  await resolve(page, loadedWrite, result("ACK", sellerA, 5));
  outcomes.push(
    "Loaded-only settling keeps the same Clerk resources but rejects retained Open/Cancel/Edit/Submit/Refresh callbacks after fresh qualification; the current draft still submits explicitly",
  );

  await open(page);
  const frameOld = await invite(page);
  await page.evaluate(() => window.__replaceInitial());
  await hidden(page);
  await resolve(page, frameOld, { ok: false, code: "FORBIDDEN" });
  await hidden(page);
  await ready(page, "FRAME-CURRENT", sellerA, frameOld.id);
  await frozenRetry(page, frameOld);
  outcomes.push(
    "Same-seller server frame replacement rejects an obsolete authority denial and preserves original revision/UUID/access/recipient",
  );

  await open(page);
  const sellerOld = await invite(page);
  await page.evaluate((value) => {
    window.__route(`/app/${value}/team?lang=en`);
    window.__replaceInitial(value);
  }, sellerB);
  await hidden(page);
  await ready(page, "SELLER-B-CURRENT", sellerB, sellerOld.id);
  assert.equal(await page.locator("dialog").count(), 0);
  await resolve(page, sellerOld, result("SELLER-A-OBSOLETE"));
  assert.equal(
    (await page.locator("body").textContent()).includes(
      "original+draft@example.test",
    ),
    false,
  );
  await page.evaluate((value) => {
    window.__route(`/app/${value}/team?lang=en`);
    window.__replaceInitial(value);
  }, sellerA);
  await hidden(page);
  await ready(page, "SELLER-A-CURRENT", sellerA, sellerOld.id);
  await frozenRetry(page, sellerOld);
  outcomes.push(
    "Seller/path replacement cannot reveal another seller's dialog; returning to original seller restores only its exact uncertain command after a current read",
  );

  await open(page);
  const otherHuman = await invite(page);
  await page.evaluate(() =>
    window.__auth.set("synthetic-human-B", "human-B-session"),
  );
  await hidden(page);
  await page.evaluate(() =>
    window.__auth.set("synthetic-human-A", "new-human-A-session"),
  );
  await resolve(page, otherHuman, result("OTHER-HUMAN-OBSOLETE"));
  await ready(page, "RETURNED-HUMAN-CURRENT", sellerA, otherHuman.id);
  assert.equal(await page.locator("dialog").count(), 0);
  await page
    .getByRole("button", { name: "Invite member", exact: true })
    .first()
    .click();
  assert.equal(
    await page.getByLabel("Recipient email", { exact: true }).inputValue(),
    "",
  );
  assert.equal(await changes(page), 1);
  outcomes.push(
    "Another human clears private draft and pending command, including an A→B→A human return",
  );

  await open(page);
  const conflict = await invite(page);
  await resolve(page, conflict, { ok: false, code: "CONFLICT" });
  await page
    .getByRole("button", { name: "Compare current team", exact: true })
    .click();
  const comparison = await pending(page, "read", conflict.id);
  await page.evaluate(() =>
    window.__auth.set("synthetic-human-A", "session-B"),
  );
  await hidden(page);
  await resolve(page, comparison, result("OLD-COMPARISON", sellerA, 99));
  await ready(page, "COMPARISON-CURRENT", sellerA, comparison.id);
  assert.equal(
    (await page.locator("body").textContent()).includes("Revision 99"),
    false,
  );
  assert.equal(
    await page
      .getByRole("heading", { name: "Current team", exact: true })
      .count(),
    0,
  );
  outcomes.push(
    "Obsolete compare response cannot expose a former session's latest revision or permission projection",
  );

  await open(page);
  await page
    .getByRole("button", { name: "Copy invitation link", exact: true })
    .click();
  const clipboard = await pending(page, "copy");
  await page.evaluate(() =>
    window.__auth.set("synthetic-human-A", "session-B"),
  );
  await hidden(page);
  await ready(page, "CLIPBOARD-CURRENT", sellerA, clipboard.id);
  const clipboardNewer = await invite(page);
  await resolve(page, clipboard);
  assert.equal(
    await page
      .getByRole("button", { name: "Saving…", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(
    (await page.locator("body").textContent()).includes(
      "Invitation link copied.",
    ),
    false,
  );
  await resolve(page, clipboardNewer, result("ACK", sellerA, 5));
  outcomes.push(
    "Clipboard completion from an obsolete context cannot reveal a copied notice or unlock current work",
  );

  await open(page);
  const denied = await invite(page);
  await resolve(page, denied, { ok: false, code: "FORBIDDEN" });
  await hidden(page);
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await hidden(page);
  await ready(page, "REAUTHORIZED-CURRENT", sellerA, denied.id);
  await frozenRetry(page, denied);
  outcomes.push(
    "Current mutation denial removes all private DOM; fresh authorized read permits only deliberate exact original retry",
  );

  await open(page);
  const blurred = await invite(page);
  await page.evaluate(() => window.dispatchEvent(new window.Event("blur")));
  await hidden(page);
  await resolve(page, blurred, result("BLURRED-ACK"));
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await hidden(page);
  await ready(page, "BLUR-RESTORED-CURRENT", sellerA, blurred.id);
  await frozenRetry(page, blurred);
  outcomes.push(
    "Explicit visible Refresh restores after blur without a focus event and still requires exact deliberate retry",
  );

  await open(page);
  const unmounted = await invite(page);
  await page.evaluate(() => window.__unmount());
  await resolve(page, unmounted, result("UNMOUNTED-ACK"));
  assert.equal(await page.locator("#root").textContent(), "");
  outcomes.push(
    "Unmounted actual Team ignores delayed acknowledgement and releases no newer component operation",
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
