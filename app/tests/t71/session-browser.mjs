/* global window: readonly, document: readonly, Event: readonly */
import console from "node:console";
import process from "node:process";
import { createRequire } from "node:module";
import { pathToFileURL, URL } from "node:url";
import { createServer } from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const app = process.cwd(),
  root = path.resolve(app, ".."),
  out = path.join(root, ".qa/t71/session/browser");
await fs.mkdir(out, { recursive: true });
const req = createRequire(path.join(app, "package.json")),
  web = createRequire(path.join(app, "apps/web/package.json"));
const vite = createRequire(req.resolve("vitest/config"));
const { build } = await import(pathToFileURL(vite.resolve("vite")).href);
const clerk = `import React from 'react';import {flushSync} from 'react-dom';const listeners=new Set(),resourceListeners=new Set();let state={isLoaded:true,isSignedIn:true,userId:'A',sessionId:'session-A'};const clerk={addListener(f){resourceListeners.add(f);return()=>resourceListeners.delete(f)},get user(){return state.userId?{id:state.userId}:null},get session(){return state.isSignedIn?{id:state.sessionId,status:'active'}:null}};window.__auth={set(subject,loaded=true,sessionId=subject?'session-'+subject:null){state={isLoaded:loaded,isSignedIn:loaded&&!!subject,userId:subject,sessionId};resourceListeners.forEach(f=>f());flushSync(()=>listeners.forEach(f=>f()))},subject:()=>state.userId};export const useAuth=()=>React.useSyncExternalStore(f=>{listeners.add(f);return()=>listeners.delete(f)},()=>state);export const useClerk=()=>clerk;export function ClerkProvider({children}){return children;}`;
const actions = `window.__requests=[];let sequence=0;export function request(kind,args){return new Promise(resolve=>window.__requests.push({id:++sequence,kind,subject:window.__auth.subject(),args,resolve,done:false}))}window.__resolve=(id,result)=>{const r=window.__requests.find(r=>r.id===id);if(!r||r.done)throw Error('Missing deferred request '+id);r.done=true;r.resolve(result)};`;
await build({
  configFile: false,
  root: app,
  logLevel: "error",
  define: {
    "process.env.NODE_ENV": JSON.stringify("development"),
    "process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY": JSON.stringify(
      "local-fixture-configured",
    ),
  },
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
  css: { postcss: { plugins: [] } },
  plugins: [
    {
      name: "t71-local-fixture",
      enforce: "pre",
      resolveId(id, importer) {
        const p = (
          id.startsWith(".") && importer
            ? path.resolve(path.dirname(importer), id)
            : id
        ).replaceAll("\\", "/");
        if (
          p.endsWith("/features/library/actions") ||
          p.endsWith("/features/library/actions.ts")
        )
          return "\0t71:library";
        if (
          p.endsWith("/features/buyer-cart/actions") ||
          p.endsWith("/features/buyer-cart/actions.ts")
        )
          return "\0t71:cart";
        for (const name of [
          "next/link",
          "next/navigation",
          "next-intl",
          "@clerk/nextjs",
        ])
          if (id === name) return "\0t71:" + name;
        if (p.endsWith("/features/discovery/hydration-boundary"))
          return "\0t71:surface";
        if (p.endsWith("/features/discovery/components"))
          return "\0t71:components";
        if (p.endsWith("/features/discovery/return-navigation"))
          return "\0t71:links";
        if (p.endsWith("/features/purchase-reviews/controls"))
          return "\0t71:reviews";
      },
      load(id) {
        if (id === "\0t71:@clerk/nextjs") return clerk;
        if (id === "\0t71:library")
          return `import{request}from'\0t71:requests';export const readLibraryAction=q=>request('library-read',[q]);export const changeLibraryAction=(...args)=>request('library-change',args);`;
        if (id === "\0t71:cart")
          return `import{request}from'\0t71:requests';export const readBuyerCartAction=()=>request('cart-read',[]);export const changeBuyerCartAction=(...args)=>request('cart-change',args);`;
        if (id === "\0t71:requests") return actions;
        if (id === "\0t71:next/navigation")
          return `const router={push:()=>{},replace:()=>{},refresh:()=>{window.__refreshes=(window.__refreshes??0)+1}};export const useRouter=()=>router;export const useSearchParams=()=>new URLSearchParams();export const usePathname=()=>location.pathname;`;
        if (id === "\0t71:next/link" || id === "\0t71:links")
          return `import React from'react';export function SourceLink({href,prefetch,preserveDiscoveryContext,startAtTop,...p}){return React.createElement('a',{href,...p})}export default SourceLink;export const useSourceReturn=()=>{};`;
        if (id === "\0t71:next-intl")
          return `export const useLocale=()=> 'en';export const useTranslations=()=> (key)=>key;`;
        if (id === "\0t71:surface")
          return `import React from'react';export const ShopSurface=p=>React.createElement('main',p);export const useSurfaceReady=()=>true;`;
        if (id === "\0t71:reviews")
          return `export const CreateReviewButton=()=>null;export const BuyerReviewLinks=()=>null;`;
        if (id === "\0t71:components")
          return `import React from'react';export const FloatingNav=()=>null;export const consumeSheetHistory=()=>false;export const IconButton=({label,onClick,disabled,...p})=>React.createElement('button',{onClick,disabled,'aria-label':label},label);export const Sheet=({children,title})=>React.createElement('section',{},title,children);`;
      },
    },
    {
      name: "deferred-fixture",
      resolveId(id) {
        if (id === "\0t71:requests") return id;
      },
      load(id) {
        if (id === "\0t71:requests") return actions;
      },
    },
  ],
  build: {
    outDir: out,
    emptyOutDir: false,
    minify: false,
    lib: {
      entry: path.join(app, "tests/t71/session-entry.tsx"),
      formats: ["es"],
      fileName: () => "fixture.js",
      cssFileName: "fixture",
    },
  },
});
if (process.argv.includes("--bundle-only")) {
  console.log("T71 session fixture bundle PASS; browser assertions NOT RUN.");
  process.exit(0);
}
const script = await fs.readFile(path.join(out, "fixture.js")),
  css = await fs.readFile(path.join(out, "fixture.css"));
const server = createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  response.setHeader("Cache-Control", "no-store");
  if (url.pathname === "/fixture.js") {
    response.setHeader("Content-Type", "text/javascript");
    response.end(script);
  } else if (url.pathname === "/fixture.css") {
    response.setHeader("Content-Type", "text/css");
    response.end(css);
  } else if (url.pathname.endsWith(".svg")) {
    response.setHeader("Content-Type", "image/svg+xml");
    response.end(
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="purple"/></svg>',
    );
  } else {
    response.setHeader("Content-Type", "text/html");
    response.end(
      '<html><head><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>',
    );
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = "http://127.0.0.1:" + server.address().port;
const { chromium } = req("@playwright/test");
let browser;
const outcomes = [],
  errors = [];
const id = "00000000-0000-4000-8000-000000000001";
const view = (subject) => ({
  actorKey: subject.repeat(64),
  revision: 1,
  savedIds: [id],
  followedIds: [id],
  collections: [
    {
      id,
      name: subject + "-private-collection",
      count: 1,
      contains: true,
      covers: ["/" + subject + "-private-cover.svg"],
    },
  ],
  items: [{ id, card: null, collectionIds: [id] }],
  follows: [
    {
      id,
      seller: {
        id,
        name: subject + "-private-follow",
        kind: "personal",
        locality: null,
      },
    },
  ],
  savedCount: 1,
  followingCount: 1,
  total: 1,
  nextCursor: null,
});
const cart = (subject) => ({
  actorKey: subject.repeat(64),
  revision: 1,
  lines: [
    {
      skuId: id,
      quantity: 1,
      state: "ready",
      item: {
        listingId: id,
        skuId: id,
        sellerId: id,
        sellerName: subject + "-private-seller",
        title: subject + "-private-cart-line",
        photo: "/" + subject + "-private-cover.svg",
        options: {},
        mode: "unique",
        publicationRevision: 2,
        priceMinor: 500,
        available: 1,
      },
    },
  ],
});
const response = (kind, subject) => ({
  ok: true,
  subject,
  data:
    kind === "library-read"
      ? view(subject)
      : kind === "library-change"
        ? { change: { revision: 2, resultId: null }, view: view(subject) }
        : cart(subject),
});
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 393, height: 793 } });
  page.on("pageerror", (e) => errors.push(String(e)));
  async function requests(kind, subject) {
    return page.evaluate(
      ([kind, subject]) =>
        window.__requests
          .filter(
            (r) =>
              !r.done &&
              r.kind === kind &&
              (subject === undefined || r.subject === subject),
          )
          .map(({ id, kind, subject, args }) => ({ id, kind, subject, args })),
      [kind, subject],
    );
  }
  async function next(kind, subject) {
    await page.waitForFunction(
      ([kind, subject]) =>
        window.__requests?.some(
          (r) => !r.done && r.kind === kind && r.subject === subject,
        ),
      [kind, subject],
    );
    return (await requests(kind, subject)).at(-1);
  }
  async function settle(r, result = response(r.kind, r.subject)) {
    await page.evaluate(
      ([id, result]) => window.__resolve(id, result),
      [r.id, result],
    );
    await page.waitForTimeout(20);
  }
  async function absentA() {
    const dom = await page.locator("#root").innerHTML();
    assert(!dom.includes("A-private-"), dom);
  }
  async function marker(surface, subject) {
    await page
      .getByText(
        subject +
          "-private-" +
          (surface === "saved"
            ? "collection"
            : surface === "following"
              ? "follow"
              : "cart-line"),
        { exact: true },
      )
      .waitFor();
  }
  for (const surface of ["saved", "following", "cart"]) {
    await page.goto(url + "/?surface=" + surface);
    const readKind = surface === "cart" ? "cart-read" : "library-read",
      changeKind = surface === "cart" ? "cart-change" : "library-change";
    await settle(await next(readKind, "A"));
    await marker(surface, "A");
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    const oldRead = await next(readKind, "A");
    if (surface === "cart")
      await page.getByRole("button", { name: "remove", exact: true }).click();
    else if (surface === "following")
      await page.getByRole("button", { name: "unfollow", exact: true }).click();
    else
      await page
        .getByRole("button", { name: "unsave", exact: false })
        .first()
        .click();
    const oldChange = await next(changeKind, "A");
    const immediate = await page.evaluate(() => {
      window.__auth.set("B");
      return document.getElementById("root").innerHTML;
    });
    assert(!immediate.includes("A-private-"));
    const newRead = await next(readKind, "B");
    await absentA();
    await settle(oldRead);
    await settle(oldChange);
    await absentA();
    await settle(newRead, { ok: false, subject: "B", code: "NOT_AVAILABLE" });
    await absentA();
    await page.getByRole("button", { name: "retry", exact: true }).click();
    await settle(await next(readKind, "B"));
    await marker(surface, "B");
    if (surface === "cart")
      await page.getByRole("button", { name: "remove", exact: true }).click();
    else if (surface === "following")
      await page.getByRole("button", { name: "unfollow", exact: true }).click();
    else
      await page
        .getByRole("button", { name: "unsave", exact: false })
        .first()
        .click();
    const b = await next(changeKind, "B");
    assert.equal(b.args.at(-1), "B");
    assert.equal(b.args[0].actorKey, "B".repeat(64));
    await settle(b);
    await marker(surface, "B");
    await page.screenshot({ path: path.join(out, surface + "-B.png") });
    await page.goto(url + "/?surface=" + surface);
    await settle(await next(readKind, "A"));
    await marker(surface, "A");
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    const delayed = await next(readKind, "A");
    if (surface === "cart")
      await page.getByRole("button", { name: "remove", exact: true }).click();
    else if (surface === "following")
      await page.getByRole("button", { name: "unfollow", exact: true }).click();
    else
      await page
        .getByRole("button", { name: "unsave", exact: false })
        .first()
        .click();
    const mutation = await next(changeKind, "A");
    await page.evaluate(() => window.__auth.set(null));
    await absentA();
    await settle(delayed);
    await settle(mutation);
    await absentA();
    assert(
      (
        await page.locator('a[href*="/sign-in"]').first().getAttribute("href")
      ).includes("returnTo="),
    );
    outcomes.push(
      surface +
        ": A->B delayed reads/mutations, failed B refresh, B success; A->signedout deferred responses",
    );
  }
  await page.goto(url + "/?surface=button");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const delayed = await next("cart-read", "A");
  await page.evaluate(() => window.__auth.set("B"));
  await settle(delayed);
  assert.equal((await requests("cart-change")).length, 0);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await settle(await next("cart-read", "B"));
  const command = await next("cart-change", "B");
  await settle(command, { ok: false, subject: "B", code: "NOT_AVAILABLE" });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const recovery = await next("cart-change", "B");
  assert.deepEqual(recovery.args, command.args);
  await settle(recovery);
  await page.getByText("added", { exact: false }).waitFor();
  outcomes.push(
    "Standalone cart: delayed A pre-read never submits; B mutation and same-scope idempotent recovery succeed",
  );
  // Visibility epoch invalidation is synchronous even when Clerk has not yet learned B.
  await page.goto(url + "/?surface=saved");
  await settle(await next("library-read", "A"));
  await marker("saved", "A");
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await absentA();
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    window.__auth.set("B");
  });
  await absentA();
  await settle(await next("library-read", "B"));
  await marker("saved", "B");
  outcomes.push(
    "Hidden/visible invalidation conceals A before delayed session discovery",
  );
  assert.deepEqual(errors, []);
  await fs.writeFile(
    path.join(out, "result.json"),
    JSON.stringify(
      {
        passed: outcomes.length,
        outcomes,
        errors,
        fixtureOnly: true,
        actualClerkVerification: false,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: outcomes.length, outcomes, errors }));
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
