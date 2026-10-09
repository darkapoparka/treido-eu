/* global window: readonly, document: readonly, localStorage: readonly, Event: readonly, PageTransitionEvent: readonly, requestAnimationFrame: readonly */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import path from "node:path";
import process from "node:process";
import console from "node:console";

// Actual WorkspaceSession/hook and buffer clearing with deferred access reads.
// Synthetic Clerk/navigation qualify lifecycle, not real identities, membership,
// hosted route authority, current Studio appearance or provider acceptance.
const app = process.cwd(),
  req = createRequire(path.join(app, "package.json")),
  web = createRequire(path.join(app, "apps/web/package.json")),
  vite = createRequire(req.resolve("vitest/config"));
const { build } = await import(pathToFileURL(vite.resolve("vite")).href);
const clerk = `
import {useSyncExternalStore} from 'react';import {flushSync} from 'react-dom';
const listeners=new Set(),resources=new Set();
let state={loaded:true,user:{id:'human-A'},session:{id:'session-A',status:'active'}};
const clerk={get user(){return state.user},get session(){return state.session},addListener(listener){resources.add(listener);listener(state);return()=>resources.delete(listener)}};
window.__auth={set(subject='human-A',id='session-A',status='active',loaded=true){
state={loaded,user:subject?{id:subject}:null,session:id?{id,status}:null};
flushSync(()=>{resources.forEach(listener=>listener(state));listeners.forEach(listener=>listener())});},current:()=>state};
export const useClerk=()=>clerk;
// Keep a retained user/signed-in snapshot even when session ends, so the actual
// current session fence, rather than a convenient mock logout, is exercised.
export function useAuth(){const snapshot=useSyncExternalStore(listener=>{listeners.add(listener);return()=>listeners.delete(listener)},()=>state);return {isLoaded:snapshot.loaded,isSignedIn:!!snapshot.user,userId:snapshot.user?.id??null}}
`;
const navigation = `
import {useSyncExternalStore} from 'react';import {flushSync} from 'react-dom';
const listeners=new Set();let route={pathname:location.pathname,sellerId:location.pathname.split('/')[3]??null,search:location.search};
const subscribe=listener=>{listeners.add(listener);return()=>listeners.delete(listener)};
const snapshot=()=>route;
const router={refresh:()=>{window.__refreshes++;window.__serverRefresh?.()}};window.__refreshes=0;
window.__route={set(sellerId,pathname='/app/sellers/'+sellerId+'/team'){
history.pushState({},'',pathname+route.search);route={...route,pathname,sellerId};flushSync(()=>listeners.forEach(listener=>listener()));}};
window.__query=search=>{history.pushState({},'',route.pathname+search);route={...route,search};flushSync(()=>listeners.forEach(listener=>listener()));};
export const useRouter=()=>router;
export function useParams(){const current=useSyncExternalStore(subscribe,snapshot);return {sellerId:current.sellerId}}
export function usePathname(){return useSyncExternalStore(subscribe,snapshot).pathname}
export function useSearchParams(){return new URLSearchParams(useSyncExternalStore(subscribe,snapshot).search)}
`;
const actions = `
window.__requests=[];let sequence=0;
export function refreshSellerAccessAction(route){const authority=window.__auth.current();return new Promise((resolve,reject)=>window.__requests.push({id:++sequence,route,sellerId:location.pathname.split('/')[3]??null,sessionId:authority.session?.id,subject:authority.user?.id,pathname:location.pathname,resolve,reject,done:false}))}
window.__resolve=(id,result)=>{const request=window.__requests.find(item=>item.id===id);if(!request||request.done)throw Error('Missing request '+id);request.done=true;request.resolve(result)};
window.__reject=id=>{const request=window.__requests.find(item=>item.id===id);if(!request||request.done)throw Error('Missing request '+id);request.done=true;request.reject(Error('Synthetic unavailable'))};
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
      name: "workspace-session-deferred-fixture",
      enforce: "pre",
      resolveId(id, importer) {
        const resolved = (
          id.startsWith(".") && importer
            ? path.resolve(path.dirname(importer), id)
            : id
        ).replaceAll("\\", "/");
        if (id === "@clerk/nextjs") return "\0workspace:clerk";
        if (id === "next/navigation") return "\0workspace:navigation";
        if (id === "next/link") return "\0workspace:link";
        if (resolved.endsWith("/locale/provider")) return "\0workspace:locale";
        if (
          id === "./setup-actions" &&
          importer
            ?.replaceAll("\\", "/")
            .endsWith("/sellers/use-workspace-access.ts")
        )
          return "\0workspace:actions";
      },
      load(id) {
        if (id === "\0workspace:clerk") return clerk;
        if (id === "\0workspace:navigation") return navigation;
        if (id === "\0workspace:actions") return actions;
        if (id === "\0workspace:link")
          return "import React from 'react';export default function Link(props){return React.createElement('a',props)}";
        if (id === "\0workspace:locale")
          return "export const useLocale=()=>({locale:'en'});";
      },
    },
  ],
  build: {
    write: false,
    minify: false,
    lib: {
      entry: path.join(app, "tests/t56/workspace-session-entry.tsx"),
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
      '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>',
    );
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { chromium } = req("@playwright/test");
let browser;
const outcomes = [],
  errors = [];
const success = {
  ok: true,
  data: {
    actorSubject: "human-A",
    sellers: ["business-A", "business-B"].map((sellerId) => ({
      sellerId,
      capabilities: [
        "seller.read",
        "team.manage",
        "declaration.manage",
        "listing.read",
      ],
    })),
  },
};
const bufferA = "treido-draft:" + "a".repeat(64),
  bufferB = "treido-draft:" + "b".repeat(64);
async function settle(
  page,
  pending,
  result = success,
  finishFreshFrame = true,
) {
  const before = await page.evaluate(() => window.__refreshes);
  await page.evaluate(
    async ([id, response]) => {
      const request = window.__requests.find((item) => item.id === id);
      window.__resolve(
        id,
        response.ok
          ? { ...response, data: { ...response.data, route: request.route } }
          : response,
      );
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
    },
    [pending.id, result],
  );
  if (
    finishFreshFrame &&
    result.ok &&
    (await page.evaluate(
      (count) => window.__autoRefresh && window.__refreshes > count,
      before,
    ))
  ) {
    // The successful restoration still conceals retained JSX. A fresh server
    // frame starts a separate authority read that must also be qualified.
    await concealed(page);
    const fresh = await latest(page, pending.id);
    await settle(page, fresh, result, false);
  }
}
async function latest(page, after = 0) {
  await page.waitForFunction(
    (id) =>
      window.__requests.some((request) => request.id > id && !request.done),
    after,
  );
  return page.evaluate((id) => {
    const request = window.__requests
      .filter((item) => item.id > id && !item.done)
      .at(-1);
    return {
      id: request.id,
      sellerId: request.sellerId,
      sessionId: request.sessionId,
      pathname: request.pathname,
      route: request.route,
    };
  }, after);
}
async function flush(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
}
async function open(page, language = "en", ready = true) {
  await page.goto(
    `http://127.0.0.1:${server.address().port}/app/sellers/business-A/team?lang=${language}`,
  );
  await flush(page);
  const pending = await latest(page);
  assert.equal(pending.route, `/app/sellers/business-A/team?lang=${language}`);
  assert.equal(await page.locator("#private-facts").isVisible(), false);
  if (ready) {
    await settle(page, pending);
    await page.waitForFunction(() =>
      document.querySelector("#private-facts")?.checkVisibility(),
    );
  }
  return pending;
}
async function seedBuffers(page) {
  await page.evaluate(
    ([first, second]) => {
      localStorage.setItem(first, "unsaved-A");
      localStorage.setItem(second, "unsaved-B");
      localStorage.setItem(
        "treido-private-buffers:human-A",
        JSON.stringify([
          { key: first, sellerId: "business-A" },
          { key: second, sellerId: "business-B" },
        ]),
      );
    },
    [bufferA, bufferB],
  );
}
async function concealed(page) {
  assert.equal(await page.locator("#private-facts").isVisible(), false);
}
async function shown(page, seller = "business-A") {
  await page.waitForFunction((name) => {
    const node = document.querySelector("#private-facts");
    return node?.checkVisibility() && node.textContent === name + "-private";
  }, seller);
}
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on("pageerror", (error) => errors.push(error.message));

  await open(page);
  await shown(page);
  outcomes.push(
    "Initial private children stay concealed until current access succeeds",
  );

  const endedRead = await open(page, "en", false);
  await seedBuffers(page);
  await page.evaluate(() => window.__auth.set("human-A", "session-A", "ended"));
  await concealed(page);
  await settle(page, endedRead);
  await concealed(page);
  assert.equal(await page.locator("h1").innerText(), "Access has changed");
  assert.equal(await page.evaluate(() => window.__refreshes), 0);
  assert.equal(
    await page.evaluate((key) => localStorage.getItem(key), bufferA),
    null,
  );
  outcomes.push(
    "Ended session with retained human cannot accept its late success",
  );

  const firstSession = await open(page, "en", false);
  await page.evaluate(() =>
    window.__auth.set("human-A", "session-B", "active"),
  );
  const secondSession = await latest(page, firstSession.id);
  assert.equal(secondSession.sessionId, "session-B");
  await settle(page, firstSession);
  await concealed(page);
  await settle(page, secondSession);
  await shown(page);
  outcomes.push(
    "Same-human session switch ignores old success until new session is verified",
  );

  const rapidA = await open(page, "en", false);
  await seedBuffers(page);
  await page.evaluate(() =>
    window.__auth.set("human-A", "session-B", "active"),
  );
  const rapidB = await latest(page, rapidA.id);
  await page.evaluate(() =>
    window.__auth.set("human-A", "session-C", "active"),
  );
  const rapidC = await latest(page, rapidB.id);
  await settle(page, rapidC);
  await shown(page);
  const currentRefreshes = await page.evaluate(() => window.__refreshes);
  await settle(page, rapidB, { ok: false, code: "FORBIDDEN" });
  await settle(page, rapidA, { ok: false, code: "NOT_AVAILABLE" });
  await shown(page);
  assert.equal(await page.evaluate(() => window.__refreshes), currentRefreshes);
  assert.equal(
    await page.evaluate((key) => localStorage.getItem(key), bufferA),
    "unsaved-A",
  );
  outcomes.push(
    "Rapid A-B-C sessions preserve current readiness and buffers after old denials",
  );

  const oldActor = await open(page, "en", false);
  await page.evaluate(() =>
    window.__auth.set("human-B", "session-B", "active"),
  );
  await settle(page, oldActor);
  await concealed(page);
  assert.equal(
    await page.evaluate(() => window.__requests.at(-1).id),
    oldActor.id,
  );
  outcomes.push(
    "Changed human cannot receive prior actor data or start its access read",
  );

  const oldSeller = await open(page, "en", false);
  await seedBuffers(page);
  await page.evaluate(() => window.__route.set("business-B"));
  const newSeller = await latest(page, oldSeller.id);
  assert.equal(newSeller.sellerId, "business-B");
  await settle(page, newSeller);
  await shown(page, "business-B");
  await settle(page, oldSeller, { ok: false, code: "FORBIDDEN" });
  await shown(page, "business-B");
  assert.equal(
    await page.evaluate((key) => localStorage.getItem(key), bufferA),
    "unsaved-A",
  );
  outcomes.push(
    "Seller switch fences old access responses and seller buffer cleanup",
  );

  const oldRoute = await open(page, "en", false);
  await page.evaluate(() =>
    window.__route.set("business-A", "/app/sellers/business-A/onboarding"),
  );
  const newRoute = await latest(page, oldRoute.id);
  assert.equal(newRoute.pathname, "/app/sellers/business-A/onboarding");
  await settle(page, oldRoute);
  await concealed(page);
  await settle(page, newRoute);
  await shown(page);
  outcomes.push(
    "Same-seller route transition waits for its own current entry read",
  );

  const blurred = await open(page, "en", false);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await settle(page, blurred);
  await concealed(page);
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  const explicit = await latest(page, blurred.id);
  await settle(page, explicit);
  await shown(page);
  outcomes.push(
    "Visible explicit Retry recovers after blur without a focus event",
  );

  const hidden = await open(page, "en", false);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
    window.__auth.set("human-A", "session-hidden", "active");
  });
  await settle(page, hidden);
  await concealed(page);
  assert.equal(
    await page.evaluate(() => window.__requests.at(-1).id),
    hidden.id,
  );
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const foreground = await latest(page, hidden.id);
  assert.equal(foreground.sessionId, "session-hidden");
  await settle(page, foreground);
  await shown(page);
  outcomes.push(
    "Hidden session change cannot read or reveal until current foreground restoration",
  );

  const beforeRestore = await open(page);
  await seedBuffers(page);
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    ),
  );
  await concealed(page);
  const restored = await latest(page, beforeRestore.id);
  await settle(page, restored, { ok: false, code: "FORBIDDEN" });
  await concealed(page);
  assert.equal(await page.locator("h1").innerText(), "Access has changed");
  assert.equal(
    await page.evaluate((key) => localStorage.getItem(key), bufferA),
    null,
  );
  assert.equal(
    await page.evaluate((key) => localStorage.getItem(key), bufferB),
    "unsaved-B",
  );
  outcomes.push(
    "Restored revoked membership stays concealed and clears only its seller buffer",
  );

  const failed = await open(page, "bg", false);
  await page.evaluate(async (id) => {
    window.__reject(id);
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  }, failed.id);
  await concealed(page);
  await page
    .getByRole("button", { name: "Опитай отново", exact: true })
    .click();
  const retry = await latest(page, failed.id);
  await settle(page, retry);
  await shown(page);
  outcomes.push(
    "Unavailable access remains concealed and Bulgarian Retry revalidates current session",
  );

  const manager = await open(page);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await concealed(page);
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  const viewerTeam = await latest(page, manager.id);
  assert.equal(viewerTeam.route, "/app/sellers/business-A/team?lang=en");
  await settle(page, viewerTeam, { ok: false, code: "FORBIDDEN" });
  await concealed(page);
  assert.equal(await page.locator("h1").innerText(), "Access has changed");
  outcomes.push(
    "Same-human manager-to-viewer Team restoration is denied before retained team facts can reappear",
  );

  const optional = await open(page);
  await page.evaluate(() => {
    window.__route.set("business-A", "/app/sellers/business-A/onboarding");
  });
  const setup = await latest(page, optional.id);
  await settle(page, setup);
  assert.equal(await page.locator("#optional-facts").isVisible(), true);
  const narrowed = {
    ...success,
    data: {
      ...success.data,
      sellers: success.data.sellers.map((seller) => ({
        ...seller,
        capabilities: seller.capabilities.filter(
          (capability) => capability !== "declaration.manage",
        ),
      })),
    },
  };
  await page.evaluate((sellers) => {
    window.__autoRefresh = false;
    window.__serverSnapshot = sellers;
    window.dispatchEvent(new Event("blur"));
  }, narrowed.data.sellers);
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  const narrower = await latest(page, setup.id);
  await settle(page, narrower, narrowed);
  await concealed(page);
  assert.equal(await page.locator("#optional-facts").isVisible(), false);
  await page.evaluate(() => window.__renderFrame());
  const freshSetup = await latest(page, narrower.id);
  await settle(page, freshSetup, narrowed);
  await shown(page);
  assert.equal(await page.locator("#optional-facts").count(), 0);
  outcomes.push(
    "Removed optional declaration access stays concealed until a fresh server frame removes the retained private reason",
  );

  const shell = await open(page);
  const withoutOther = {
    ...success,
    data: {
      ...success.data,
      sellers: success.data.sellers.filter(
        (seller) => seller.sellerId === "business-A",
      ),
    },
  };
  await page.evaluate((sellers) => {
    window.__serverSnapshot = sellers;
    window.dispatchEvent(new Event("pageshow"));
  }, withoutOther.data.sellers);
  const shellRestore = await latest(page, shell.id);
  await settle(page, shellRestore, withoutOther);
  await shown(page);
  assert.equal(await page.locator("#shell-sellers").innerText(), "business-A");
  outcomes.push(
    "Loss of a non-selected seller refreshes and removes the retained shell seller before revealing it",
  );

  const queryStart = await open(page);
  await seedBuffers(page);
  await page.evaluate(() =>
    window.__route.set("business-A", "/app/sellers/business-A/insights"),
  );
  const firstDataset = await latest(page, queryStart.id);
  await page.evaluate(() => window.__query("?lang=en&dataset=imports"));
  const currentDataset = await latest(page, firstDataset.id);
  assert.equal(
    currentDataset.route,
    "/app/sellers/business-A/insights?lang=en&dataset=imports",
  );
  await settle(page, firstDataset, { ok: false, code: "FORBIDDEN" });
  await concealed(page);
  assert.equal(
    await page.evaluate((key) => localStorage.getItem(key), bufferA),
    "unsaved-A",
  );
  await settle(page, currentDataset);
  await shown(page);
  outcomes.push(
    "Same-path Insights query switch fences previous dataset denial and requires the current query authority read",
  );

  const responseActor = await open(page, "en", false);
  await settle(page, responseActor, {
    ...success,
    data: { ...success.data, actorSubject: "human-B" },
  });
  await concealed(page);
  assert.equal(await page.locator("h1").innerText(), "Access has changed");
  outcomes.push(
    "A response verified as a different server human cannot release retained current-human children",
  );

  for (const change of ["session", "route", "query"]) {
    const originalFrame = await open(page);
    await page.evaluate((kind) => {
      window.__autoRefresh = false;
      if (kind === "session")
        window.__auth.set("human-A", "session-new-frame", "active");
      else if (kind === "route")
        window.__route.set("business-A", "/app/sellers/business-A/onboarding");
      else window.__query("?lang=bg");
    }, change);
    const changedEntry = await latest(page, originalFrame.id);
    await settle(page, changedEntry);
    await concealed(page);
    assert.ok((await page.evaluate(() => window.__refreshes)) > 0);
    await page.evaluate(() => window.__renderFrame());
    const freshEntry = await latest(page, changedEntry.id);
    await settle(page, freshEntry);
    await shown(page);
    outcomes.push(
      `Successful ${change} change cannot reveal the old server frame after effect recreation; a fresh qualified frame is required`,
    );
  }

  const unmounted = await open(page, "en", false);
  await page.evaluate(() => {
    window.__unmount();
    window.__auth.set("human-A", "session-after-unmount", "active");
    window.dispatchEvent(new Event("focus"));
  });
  await settle(page, unmounted);
  assert.equal(
    await page.evaluate(() => window.__requests.at(-1).id),
    unmounted.id,
  );
  assert.equal(await page.evaluate(() => window.__refreshes), 0);
  outcomes.push(
    "Unmounted entry unsubscribes and ignores delayed response without refresh",
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
