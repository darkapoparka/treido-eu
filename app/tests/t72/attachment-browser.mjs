/* global window: readonly, document: readonly */
import { Buffer } from "node:buffer";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import console from "node:console";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { pathToFileURL, URL } from "node:url";
const app = process.cwd(),
  root = path.resolve(app, ".."),
  out = path.join(root, ".qa/t72/attachment-browser");
await fs.mkdir(out, { recursive: true });
const req = createRequire(path.join(app, "package.json")),
  web = createRequire(path.join(app, "apps/web/package.json"));
const vite = createRequire(req.resolve("vitest/config"));
const { build } = await import(pathToFileURL(vite.resolve("vite")).href);
const auth = `import React from 'react';import {flushSync} from 'react-dom';const listeners=new Set();let state={isLoaded:true,isSignedIn:true,userId:'A',sessionId:'session-A'};const clerk={get user(){return state.userId?{id:state.userId}:null},get session(){return state.sessionId?{id:state.sessionId,status:'active'}:null}};window.__auth={set(subject){state={isLoaded:true,isSignedIn:!!subject,userId:subject,sessionId:subject?'session-'+subject:null};flushSync(()=>listeners.forEach(f=>f()))}};export const useAuth=()=>React.useSyncExternalStore(f=>{listeners.add(f);return()=>listeners.delete(f)},()=>state);export const useClerk=()=>clerk;`;
const actions = `window.__requests=[];window.__puts=[];let sequence=0;function call(kind,raw,subject){return new Promise(resolve=>window.__requests.push({id:++sequence,kind,raw,subject,resolve,done:false}))}window.__settle=(id,result)=>{const r=window.__requests.find(r=>r.id===id&&!r.done);if(!r)throw Error('Unknown request');r.done=true;r.resolve(result)};export const stageAttachmentAction=(raw,subject)=>call('stage',raw,subject);export const attachmentStatusAction=(raw,subject)=>call('status',raw,subject);export const removeAttachmentAction=(raw,subject)=>call('remove',raw,subject);const nativeFetch=window.fetch.bind(window);window.fetch=async(url,options)=>{if(options?.method!=='PUT')return nativeFetch(url,options);window.__puts.push({url,subject:options.headers['x-treido-subject']});return {json:async()=>({ok:true,data:{id:new URL(url,location.origin).pathname.split('/').at(-1),revision:3,state:'ready',retryable:false,width:12,height:8}})}};`;
await build({
  configFile: false,
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
      name: "t72-attachment-browser-fixture",
      enforce: "pre",
      resolveId(id, importer) {
        const absolute = (
          id.startsWith(".") && importer
            ? path.resolve(path.dirname(importer), id)
            : id
        ).replaceAll("\\", "/");
        if (id === "@clerk/nextjs") return "\0auth";
        if (id === "next/image") return "\0image";
        if (
          absolute.endsWith("/features/message-attachments/actions") ||
          absolute.endsWith("/features/message-attachments/actions.ts")
        )
          return "\0actions";
      },
      load(id) {
        if (id === "\0auth") return auth;
        if (id === "\0actions") return actions;
        if (id === "\0image")
          return "import React from 'react';export default function Image({unoptimized,...props}){return React.createElement('img',props)}";
      },
    },
  ],
  build: {
    outDir: out,
    emptyOutDir: false,
    minify: false,
    lib: {
      entry: path.join(app, "tests/t72/attachment-browser-entry.tsx"),
      formats: ["es"],
      fileName: () => "fixture.js",
      cssFileName: "fixture",
    },
  },
});
const script = await fs.readFile(path.join(out, "fixture.js")),
  css = await fs.readFile(path.join(out, "fixture.css"));
const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j/1sAAAAASUVORK5CYII=",
  "base64",
);
const server = createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  response.setHeader("Cache-Control", "no-store");
  if (url.pathname === "/fixture.js") {
    response.setHeader("Content-Type", "text/javascript");
    response.end(script);
  } else if (url.pathname === "/fixture.css") {
    response.setHeader("Content-Type", "text/css");
    response.end(css);
  } else if (url.pathname.startsWith("/api/message-attachments/")) {
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
const url = "http://127.0.0.1:" + server.address().port;
const { chromium } = req("@playwright/test");
let browser;
const outcomes = [],
  errors = [];
const asset = "00000000-0000-4000-8000-000000000009";
const staged = {
  id: asset,
  revision: 1,
  state: "staged",
  retryable: true,
  width: null,
  height: null,
};
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 793 } });
  page.on("pageerror", (error) => errors.push(String(error)));
  const file = (name) => ({ name, mimeType: "image/png", buffer: pixel });
  async function next(kind, subject) {
    await page.waitForFunction(
      ([kind, subject]) =>
        window.__requests.some(
          (r) => !r.done && r.kind === kind && r.subject === subject,
        ),
      [kind, subject],
    );
    return page.evaluate(
      ([kind, subject]) => {
        const r = window.__requests
          .filter((r) => !r.done && r.kind === kind && r.subject === subject)
          .at(-1);
        return { id: r.id, raw: r.raw, subject: r.subject };
      },
      [kind, subject],
    );
  }
  async function settle(request, data = staged) {
    await page.evaluate(
      ([id, data, subject]) => window.__settle(id, { ok: true, subject, data }),
      [request.id, data, request.subject],
    );
  }
  await page.goto(url);
  await page
    .getByLabel("Add images", { exact: true })
    .setInputFiles(file("A-private.png"));
  const old = await next("stage", "A");
  await page.evaluate(() => window.__auth.set("B"));
  assert(!(await page.locator("#root").innerHTML()).includes("A-private.png"));
  await settle(old);
  assert.equal(await page.evaluate(() => window.__puts.length), 0);
  await page
    .getByLabel("Add images", { exact: true })
    .setInputFiles(file("B-private.png"));
  await settle(await next("stage", "B"));
  await page.getByText("Ready to send", { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.__puts.at(-1).subject), "B");
  await page
    .getByRole("button", { name: "Send fixture message", exact: true })
    .click();
  assert.equal(
    await page.evaluate(() => document.documentElement.dataset.sent),
    asset,
  );
  assert(!(await page.locator("#root").innerHTML()).includes("B-private.png"));
  outcomes.push(
    "A-to-B hides old file and rejects old stage; B upload/send succeeds with B subject",
  );
  await page.goto(url);
  await page
    .getByLabel("Add images", { exact: true })
    .setInputFiles(file("A-private.png"));
  await settle(await next("stage", "A"));
  await page.getByText("Ready to send", { exact: true }).waitFor();
  await page.evaluate(() => window.__auth.set(null));
  const hidden = await page.locator("#root").innerHTML();
  assert(!hidden.includes("A-private.png") && !hidden.includes(asset));
  assert(
    await page
      .getByRole("button", { name: "Send fixture message", exact: true })
      .isDisabled(),
  );
  outcomes.push(
    "Sign-out removes staged private image URLs and disables sending",
  );
  await page.goto(url);
  await page
    .getByLabel("Add images", { exact: true })
    .setInputFiles(file("old-thread.png"));
  const thread = await next("stage", "A");
  await page
    .getByRole("button", { name: "Other conversation", exact: true })
    .click();
  await settle(thread);
  assert.equal(await page.evaluate(() => window.__puts.length), 0);
  assert(!(await page.locator("#root").innerHTML()).includes("old-thread.png"));
  outcomes.push(
    "Late stage from a previous conversation never starts upload in the new one",
  );
  await page.goto(url + "/?lang=bg");
  await page.getByLabel("Добави снимки", { exact: true }).setInputFiles({
    name: "image.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg/>"),
  });
  await page
    .getByText("Избери статична JPEG, PNG или WebP снимка до 3 MiB.", {
      exact: true,
    })
    .waitFor();
  assert.equal(await page.evaluate(() => window.__requests.length), 0);
  for (const width of [320, 390, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    );
  }
  await page.setViewportSize({ width: 390, height: 793 });
  await page.screenshot({
    path: path.join(out, "bulgarian-invalid-image.png"),
  });
  outcomes.push(
    "Unsupported file rejected before server intent; bilingual controls fit 320–1920 pixels",
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
        actualClerk: false,
        actualProviderStorage: false,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: outcomes.length, outcomes, errors }));
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
