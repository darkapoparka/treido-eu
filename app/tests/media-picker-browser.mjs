/* global window: readonly */
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";
import console from "node:console";

const app = process.cwd();
const phase = process.argv.includes("--before") ? "before" : "after";
const output = path.resolve(
  app,
  "../.qa/launch-auth-20261006/media-picker-regression",
  phase,
);
await fs.mkdir(output, { recursive: true });
const require = createRequire(path.join(app, "package.json"));
const web = createRequire(path.join(app, "apps/web/package.json"));
const vite = createRequire(require.resolve("vitest/config"));
const { build } = await import(pathToFileURL(vite.resolve("vite")).href);
const auth = `import React from 'react';import {flushSync} from 'react-dom';const listeners=new Set();let state=window.__mediaInitial??{isLoaded:false,subject:null};const clerk={get user(){return state.isLoaded&&state.subject?{id:state.subject}:null}};window.__mediaAuth=(subject,isLoaded=true)=>{state={subject,isLoaded};flushSync(()=>listeners.forEach(listener=>listener()))};export const useClerk=()=>clerk;export const useUser=()=>{const current=React.useSyncExternalStore(listener=>{listeners.add(listener);return()=>listeners.delete(listener)},()=>state);return {isLoaded:current.isLoaded,user:current.isLoaded&&current.subject?{id:current.subject}:null}};`;
const actions = `window.__mediaRequests=[];window.__mediaMutations=[];let sequence=0;window.__mediaSettle=(id,result)=>{const request=window.__mediaRequests.find(item=>item.id===id&&!item.done);if(!request)throw Error('Unknown fixture request');request.done=true;request.resolve(result)};export const listMediaAction=input=>new Promise(resolve=>window.__mediaRequests.push({id:++sequence,input,resolve,done:false}));const mutation=(...args)=>{window.__mediaMutations.push(args);throw Error('Unexpected fixture mutation')};export const createMediaIntentAction=mutation;export const completeMediaAction=mutation;export const changeMediaAction=mutation;`;
await build({
  configFile: false,
  envDir: false,
  root: app,
  logLevel: "error",
  define: { "process.env.NODE_ENV": JSON.stringify("development") },
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
      name: "isolated-media-hydration-fixture",
      enforce: "pre",
      resolveId(id, importer) {
        if (id === "@clerk/nextjs") return "\0media-auth";
        if (id === "./media-actions" && importer?.endsWith("media-picker.tsx"))
          return "\0media-actions";
      },
      load(id) {
        if (id === "\0media-auth") return auth;
        if (id === "\0media-actions") return actions;
      },
    },
  ],
  build: {
    outDir: output,
    emptyOutDir: false,
    minify: false,
    lib: {
      entry: path.join(app, "tests/media-picker-browser-entry.tsx"),
      formats: ["es"],
      fileName: () => "fixture.js",
      cssFileName: "fixture",
    },
  },
});
const script = await fs.readFile(path.join(output, "fixture.js"));
const css = await fs.readFile(path.join(output, "fixture.css"));
const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j/1sAAAAASUVORK5CYII=",
  "base64",
);
const server = createServer((request, response) => {
  response.setHeader("Cache-Control", "no-store");
  if (request.url === "/fixture.js") {
    response.setHeader("Content-Type", "text/javascript");
    response.end(script);
  } else if (request.url === "/fixture.css") {
    response.setHeader("Content-Type", "text/css");
    response.end(css);
  } else if (request.url?.startsWith("/api/seller-media/")) {
    response.setHeader("Content-Type", "image/png");
    response.end(pixel);
  } else {
    response.setHeader("Content-Type", "text/html");
    response.end(
      '<html><head><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>',
    );
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = "http://127.0.0.1:" + server.address().port;
const { chromium } = require("@playwright/test");
const outcomes = [],
  errors = [];
let browser;
try {
  browser = await chromium.launch({ headless: true });
  async function run(name, initial, check) {
    const page = await browser.newPage();
    page.setDefaultTimeout(1800);
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", (route) =>
      route
        .request()
        .url()
        .startsWith(origin + "/")
        ? route.continue()
        : route.abort(),
    );
    if (initial)
      await page.addInitScript((state) => {
        window.__mediaInitial = state;
      }, initial);
    try {
      await page.goto(origin);
      await page
        .getByRole("heading", { name: "Photos", exact: true })
        .waitFor();
      await check(page);
      assert.equal(
        await page.evaluate(() => window.__mediaMutations.length),
        0,
      );
      outcomes.push({ name, pass: true });
    } catch (error) {
      outcomes.push({ name, pass: false, error: error.message.split("\n")[0] });
    } finally {
      await page.close();
    }
  }
  async function next(page, draft = "draft-A", afterId = 0) {
    await page.waitForFunction(
      ([draft, after]) =>
        window.__mediaRequests.some(
          (request) =>
            !request.done &&
            request.input.draftId === draft &&
            request.id > after,
        ),
      [draft, afterId],
      { timeout: 1800 },
    );
    return page.evaluate(
      ([draft, after]) =>
        window.__mediaRequests.find(
          (request) =>
            !request.done &&
            request.input.draftId === draft &&
            request.id > after,
        ).id,
      [draft, afterId],
    );
  }
  const ready = (id) => ({
    ok: true,
    data: [
      {
        id,
        state: "ready",
        position: 0,
        width: 1,
        height: 1,
        revision: 1,
        error: null,
      },
    ],
  });
  async function settle(page, id, result) {
    await page.evaluate(
      ([id, result]) => window.__mediaSettle(id, result),
      [id, result],
    );
    await page.waitForTimeout(50);
  }
  const signedIn = { isLoaded: true, subject: "A" };
  await run(
    "delayed Clerk hydration automatically lists saved photos",
    null,
    async (page) => {
      assert.equal(await page.evaluate(() => window.__mediaRequests.length), 0);
      await page.evaluate(() => window.__mediaAuth("A"));
      await settle(page, await next(page), ready("hydrated-photo"));
      await page.getByRole("img", { name: "Photo 1" }).waitFor();
    },
  );
  await run(
    "mismatched or logged-out identity cannot list; matching readiness recovers",
    { isLoaded: true, subject: "B" },
    async (page) => {
      assert.equal(await page.evaluate(() => window.__mediaRequests.length), 0);
      await page.evaluate(() => window.__mediaAuth(null));
      assert.equal(await page.evaluate(() => window.__mediaRequests.length), 0);
      await page.evaluate(() => window.__mediaAuth("A"));
      await settle(page, await next(page), ready("matching-photo"));
      await page.getByRole("img", { name: "Photo 1" }).waitFor();
    },
  );
  await run(
    "late prior hydration success cannot replace current photos",
    signedIn,
    async (page) => {
      const old = await next(page);
      await page.evaluate(() => window.__mediaAuth("A", false));
      await page.evaluate(() => window.__mediaAuth("A", true));
      const current = await next(page, "draft-A", old);
      await settle(page, current, ready("current-photo"));
      await settle(page, old, ready("obsolete-photo"));
      assert(
        (await page.getByRole("img").getAttribute("src")).includes(
          "current-photo",
        ),
      );
    },
  );
  await run(
    "late prior hydration denial cannot clear or block current photos",
    signedIn,
    async (page) => {
      const old = await next(page);
      await page.evaluate(() => window.__mediaAuth("A", false));
      await page.evaluate(() => window.__mediaAuth("A", true));
      await settle(
        page,
        await next(page, "draft-A", old),
        ready("current-photo"),
      );
      await settle(page, old, { ok: false, code: "FORBIDDEN" });
      await page.getByRole("img", { name: "Photo 1" }).waitFor();
      assert.equal(await page.getByRole("alert").count(), 0);
      assert.equal(
        await page.getByRole("button", { name: "Refresh photos" }).count(),
        1,
      );
    },
  );
  await run(
    "keyed draft/seller remount ignores old list success",
    signedIn,
    async (page) => {
      const old = await next(page);
      await page.evaluate(() =>
        window.__mediaScope({
          sellerId: "seller-B",
          draftId: "draft-B",
          actorSubject: "A",
        }),
      );
      await settle(page, await next(page, "draft-B"), ready("new-draft-photo"));
      await settle(page, old, ready("old-draft-photo"));
      const src = await page.getByRole("img").getAttribute("src");
      assert(
        src.includes("new-draft-photo") && src.includes("sellerId=seller-B"),
      );
    },
  );
  await run(
    "keyed account remount ignores old denial and logout hides photos",
    signedIn,
    async (page) => {
      const old = await next(page);
      await page.evaluate(() => {
        window.__mediaAuth("B");
        window.__mediaScope({
          sellerId: "seller-B",
          draftId: "draft-B",
          actorSubject: "B",
        });
      });
      await settle(page, await next(page, "draft-B"), ready("B-photo"));
      await settle(page, old, { ok: false, code: "FORBIDDEN" });
      await page.getByRole("img", { name: "Photo 1" }).waitFor();
      assert.equal(await page.getByRole("alert").count(), 0);
      await page.evaluate(() => window.__mediaAuth(null));
      assert.equal(await page.getByRole("img").count(), 0);
    },
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  const source = await fs.readFile(
    path.join(app, "apps/web/src/features/selling/media-picker.tsx"),
  );
  const receipt = {
    phase,
    sourceSha256: createHash("sha256").update(source).digest("hex"),
    outcomes,
    errors,
    isolatedComponentFixture: true,
    actualClerk: false,
    actualDatabase: false,
    actualProviderStorage: false,
    cssUnchanged: true,
    fixtureListenerStopped: true,
  };
  await fs.writeFile(
    path.join(output, "result.json"),
    JSON.stringify(receipt, null, 2) + "\n",
  );
  console.log(JSON.stringify(receipt));
}
if (
  errors.length ||
  outcomes.length !== 6 ||
  outcomes.some((outcome) => !outcome.pass)
)
  process.exitCode = 1;
