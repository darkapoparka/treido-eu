/* global window: readonly, document: readonly, sessionStorage: readonly, requestAnimationFrame: readonly, getComputedStyle: readonly, Event: readonly */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import process from "node:process";
import console from "node:console";

// Actual AssistantInterpretInput/useAssistantCommand/parser/CSS. Only framework
// rendering, identity, server actions and transport are synthetic boundaries.
// No shared runtime, provider, DB, upload or model execution. Synthetic read
// values qualify presentation branches, not real processing availability.
const app = process.cwd(),
  req = createRequire(path.join(app, "package.json")),
  web = createRequire(path.join(app, "apps/web/package.json")),
  vite = createRequire(req.resolve("vitest/config"));
const { build } = await import(pathToFileURL(vite.resolve("vite")).href);
const clerk = `
import {useSyncExternalStore} from 'react';import {flushSync} from 'react-dom';
const listeners=new Set();let state={isLoaded:true,userId:'synthetic-human-A',isSignedIn:true};
window.__auth={current:()=>state,set(userId){state={isLoaded:true,userId,isSignedIn:!!userId};flushSync(()=>listeners.forEach(listener=>listener()));}};
export function useAuth(){return useSyncExternalStore(listener=>{listeners.add(listener);return()=>listeners.delete(listener)},()=>state)}
export const useClerk=()=>({user:{id:state.userId},session:{id:'synthetic-session',status:'active'},addListener:()=>()=>{}});
export const useUser=()=>({isLoaded:true,user:{id:state.userId}});
export const ClerkProvider=({children})=>children;
`;
const transport = `
window.__requests=[];window.__stops=[];let sequence=0;const inflight=new Map();
function request(kind,input){return new Promise((resolve,reject)=>window.__requests.push({id:++sequence,kind,input,subject:window.__auth.current().userId,resolve,reject,done:false}))}
window.__request=request;
window.__resolve=(id,result)=>{const item=window.__requests.find(item=>item.id===id);if(!item||item.done)throw Error('Missing request '+id);item.done=true;item.resolve(result)};
window.__reject=id=>{const item=window.__requests.find(item=>item.id===id);if(!item||item.done)throw Error('Missing request '+id);item.done=true;item.reject(Error('Synthetic uncertain transport'))};
export function submitAssistantInput(command){const result=request('change',command),item=window.__requests.at(-1),key=command.actorKey+':'+command.mode;if(command.operation.kind==='execute')inflight.set(key,item);return result.finally(()=>{if(inflight.get(key)===item)inflight.delete(key)})}
export function stopInputRequest(actorKey,mode){window.__stops.push({actorKey,mode});const item=inflight.get(actorKey+':'+mode);if(item&&!item.done){item.done=true;item.reject(Error('Synthetic local request abort'));}}
`;
const actionFeatures = new Set([
  "assistant-runs",
  "assistant-tools",
  "shopping-tools",
  "library",
  "buyer-cart",
  "messaging",
  "saved-searches",
]);
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
      "next-intl",
    ].map((name) => ({
      find: new RegExp("^" + name + "$"),
      replacement: web.resolve(name),
    })),
  },
  plugins: [
    {
      name: "assistant-input-deferred-boundaries",
      enforce: "pre",
      resolveId(id, importer) {
        const resolved = (
          id.startsWith(".") && importer
            ? path.resolve(path.dirname(importer), id)
            : id
        ).replaceAll("\\", "/");
        if (id === "@clerk/nextjs") return "\0input:clerk";
        if (id === "next/navigation") return "\0input:navigation";
        if (id === "next/link") return "\0input:link";
        if (id === "next/image") return "\0input:image";
        if (resolved.endsWith("/assistant-runs/transport"))
          return "\0input:transport";
        const feature = /\/features\/([^/]+)\/actions(?:\.ts)?$/.exec(
          resolved,
        )?.[1];
        if (actionFeatures.has(feature)) return "\0input:actions:" + feature;
      },
      load(id) {
        if (id === "\0input:clerk") return clerk;
        if (id === "\0input:transport") return transport;
        if (id === "\0input:navigation")
          return "export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push:()=>{throw Error('Unexpected navigation')},refresh:()=>{throw Error('Unexpected refresh')}});";
        if (id === "\0input:link")
          return "import React from 'react';export default function Link({onNavigate,prefetch,replace,scroll,...props}){return React.createElement('a',props)}";
        if (id === "\0input:image")
          return "import React from 'react';export const getImageProps=props=>({props});export default function Image({unoptimized,priority,fill,...props}){return React.createElement('img',props)}";
        if (id.startsWith("\0input:actions:")) {
          const feature = id.split(":").at(-1),
            source = readFileSync(
              path.join(app, "apps/web/src/features", feature, "actions.ts"),
              "utf8",
            ),
            names = [...source.matchAll(/export async function (\w+)/g)].map(
              (match) => match[1],
            );
          assert.ok(
            names.length,
            "Known action boundary has exports: " + feature,
          );
          return names
            .map((name) =>
              name === "readAssistantInputAction"
                ? `export const ${name}=mode=>window.__request('read',mode);`
                : `export const ${name}=(...args)=>{window.__request('unexpected:${name}',args);throw Error('Unexpected action ${name}')};`,
            )
            .join("\n");
        }
      },
    },
  ],
  build: {
    write: false,
    minify: false,
    lib: {
      entry: path.join(app, "tests/t56/assistant-input-display-entry.tsx"),
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
      '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*,*::before,*::after{box-sizing:border-box}body{margin:0;background:#fff;color:#171717;font-family:Arial,sans-serif}</style><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>',
    );
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { chromium } = req("@playwright/test"),
  origin = "http://127.0.0.1:" + server.address().port,
  actorKey = "a".repeat(64),
  policyId = "10000000-0000-4000-8000-000000000001",
  assetId = "10000000-0000-4000-8000-000000000002",
  runId = "10000000-0000-4000-8000-000000000003",
  outcomes = [],
  errors = [];
let browser;
const view = (mode = "text", extra = {}) => ({
  actorKey,
  revision: 2,
  mode,
  policy: null,
  consent: false,
  consentChoice: null,
  asset: null,
  run: null,
  results: null,
  ...extra,
});
const policy = (modes = ["text"]) => ({
  id: policyId,
  noticeBg: "Синтетична информация за обработка само за теста.",
  noticeEn: "Synthetic processing notice for this test only.",
  expiresSeconds: 3600,
  audioSeconds: 20,
  modes,
  mediaReady: true,
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
      return { id: item.id, input: item.input, subject: item.subject };
    },
    [kind, after],
  );
}
async function settle(page, request, value) {
  await page.evaluate(
    ([id, data]) => window.__resolve(id, data),
    [request.id, { ok: true, data: { subject: request.subject, value } }],
  );
  await flush(page);
}
async function readOnly(page, count = 1) {
  assert.deepEqual(
    await page.evaluate(() => window.__requests.map((item) => item.kind)),
    Array(count).fill("read"),
  );
}
async function open({
  locale = "en",
  mode = "text",
  width = 320,
  pending,
} = {}) {
  const page = await browser.newPage({ viewport: { width, height: 793 } });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (!request.url().startsWith(origin + "/"))
      errors.push("Unexpected external request: " + request.url());
  });
  await page.addInitScript(
    ([key, command]) => {
      sessionStorage.clear();
      if (command) sessionStorage.setItem(key, JSON.stringify(command));
    },
    [
      "treido-f22-recovery-v1:synthetic-human-A:assistant-input:" + mode,
      pending ?? null,
    ],
  );
  await page.goto(origin + "/fixture?lang=" + locale + "&mode=" + mode);
  return { page, request: await latest(page) };
}
async function readable(page) {
  const geometry = await page.evaluate(() => {
    const status = document.querySelector('[role="status"]'),
      button = document.querySelector("button"),
      main = document.querySelector("main"),
      style = getComputedStyle(status);
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      mains: document.querySelectorAll("main").length,
      color: style.color,
      background: getComputedStyle(main).backgroundColor,
      fontSize: parseFloat(style.fontSize),
      lineHeight: parseFloat(style.lineHeight),
      buttonHeight: button.getBoundingClientRect().height,
      buttonRight: button.getBoundingClientRect().right,
      buttonBottom: button.getBoundingClientRect().bottom,
      width: window.innerWidth,
      height: window.innerHeight,
    };
  });
  assert.equal(geometry.overflow, false);
  assert.equal(geometry.mains, 1);
  assert.equal(geometry.color, "rgb(23, 23, 23)");
  assert.equal(geometry.background, "rgb(255, 255, 255)");
  assert.ok(geometry.fontSize >= 14 && geometry.lineHeight >= 20);
  assert.ok(geometry.buttonHeight >= 44);
  assert.ok(geometry.buttonRight <= geometry.width);
  assert.ok(geometry.buttonBottom <= geometry.height);
}
try {
  browser = await chromium.launch({ headless: true });
  for (const locale of ["bg", "en"]) {
    for (const mode of ["text", "photo", "voice"]) {
      const { page, request } = await open({ locale, mode });
      await settle(page, request, view(mode));
      const name = locale === "bg" ? "Провери отново" : "Check again";
      assert.equal(
        await page.locator("textarea,input,select,details").count(),
        0,
      );
      assert.equal(await page.getByRole("button").count(), 1);
      await readable(page);
      await readOnly(page);
      await page.getByRole("button", { name, exact: true }).focus();
      await page.keyboard.press("Enter");
      const refresh = await latest(page, "read", request.id);
      assert.equal(refresh.subject, "synthetic-human-A");
      assert.equal(refresh.input, mode);
      await readOnly(page, 2);
      await settle(page, refresh, view(mode));
      await readable(page);
      outcomes.push(
        `${locale}/${mode}: compact empty unavailable, readable320, current read only`,
      );
      await page.close();
    }
  }

  {
    const { page, request } = await open({ width: 393 });
    await settle(
      page,
      request,
      view("text", {
        policy: policy(["photo"]),
        consentChoice: { policyId, granted: false },
      }),
    );
    assert.equal(await page.locator("textarea,input,details").count(), 0);
    await readable(page);
    await readOnly(page);
    outcomes.push(
      "A policy for another mode and a withdrawn choice keep the empty unavailable display compact",
    );
    await page.close();
  }

  for (const locale of ["bg", "en"]) {
    const { page, request } = await open({ locale });
    await settle(
      page,
      request,
      view("text", { consentChoice: { policyId, granted: true } }),
    );
    const withdraw = page.getByRole("button", {
      name:
        locale === "bg"
          ? "Оттегляне на съгласието"
          : "Withdraw processing consent",
      exact: true,
    });
    assert.equal(await withdraw.isEnabled(), true);
    await withdraw.click();
    assert.equal(await page.getByRole("dialog").isVisible(), true);
    assert.equal(await page.getByRole("checkbox").count(), 1);
    await readOnly(page);
    outcomes.push(
      `${locale}: expired recorded grant preserves deliberate withdrawal review`,
    );
    await page.close();
  }

  for (const resource of ["asset", "run"]) {
    const { page, request } = await open({
      mode: resource === "asset" ? "photo" : "text",
    });
    await settle(
      page,
      request,
      view(resource === "asset" ? "photo" : "text", {
        [resource]:
          resource === "asset"
            ? {
                id: assetId,
                state: "ready",
                expiresAt: "2026-10-09T00:00:00.000Z",
                cleanupAfter: "2026-10-10T00:00:00.000Z",
                preview: null,
                bytes: 128,
                contentType: "image/png",
                checksum: "b".repeat(64),
              }
            : {
                id: runId,
                state: "unknown",
                criteria: null,
                reviewedCriteria: null,
                prompt: "Synthetic private run",
                proposal: null,
                budgetPending: true,
                expiresAt: "2026-10-09T00:00:00.000Z",
              },
      }),
    );
    const cancel = page.getByRole("button", {
      name: "Cancel and clear input",
      exact: true,
    });
    assert.equal(await cancel.isEnabled(), true);
    if (resource === "run") {
      assert.equal(
        await page
          .getByText("The processing charge is pending verification.", {
            exact: true,
          })
          .isVisible(),
        true,
      );
    } else {
      assert.equal(
        await page.getByText(/Private input expiry:/).isVisible(),
        true,
      );
    }
    await cancel.click();
    assert.equal(await page.getByRole("dialog").isVisible(), true);
    await readOnly(page);
    outcomes.push(
      `Unavailable ${resource} retains full cleanup review without automatic writes`,
    );
    await page.close();
  }

  {
    const { page, request } = await open({ pending: {} });
    await settle(page, request, view());
    assert.equal(
      await page
        .getByText(
          "Browser recovery storage is unavailable. A new command cannot be submitted until its original request can be retained.",
          { exact: true },
        )
        .isVisible(),
      true,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Reload current state", exact: true })
        .isEnabled(),
      true,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Check again", exact: true })
        .count(),
      0,
    );
    await readOnly(page);
    outcomes.push(
      "A rejected original journal retains truthful storage feedback and current-read recovery",
    );
    await page.close();
  }

  {
    const original = {
        actorKey,
        expectedRevision: 1,
        requestId: "10000000-0000-4000-8000-000000000004",
        mode: "text",
        operation: { kind: "execute", runId, confirmed: true },
      },
      { page, request } = await open({ pending: original });
    await settle(page, request, view());
    const retry = page.getByRole("button", {
      name: "Retry original request",
      exact: true,
    });
    assert.equal(await retry.isEnabled(), true);
    assert.equal(
      await page
        .getByRole("button", { name: "Check again", exact: true })
        .count(),
      0,
    );
    await readOnly(page);
    await retry.click();
    const change = await latest(page, "change");
    // Transport starts before React commits its pending button. Observe the
    // existing two-frame settled UI, without resolving or weakening the request.
    await flush(page);
    assert.deepEqual(change.input, original);
    assert.equal(
      await page
        .getByRole("button", { name: "Stop this request", exact: true })
        .isVisible(),
      true,
    );
    await page.evaluate((id) => window.__reject(id), change.id);
    await flush(page);
    assert.equal(await retry.isEnabled(), true);
    assert.deepEqual(
      await page.evaluate(() => window.__requests.map((item) => item.kind)),
      ["read", "change"],
    );
    outcomes.push(
      "Original uncertain request remains recoverable and retry sends its exact command once",
    );
    await page.close();
  }

  {
    const { page, request } = await open(),
      available = view("text", {
        policy: policy(),
        consent: true,
        consentChoice: { policyId, granted: true },
      });
    await settle(page, request, available);
    const input = page.getByRole("textbox", {
      name: "What are you looking for?",
      exact: true,
    });
    assert.equal(await input.isEnabled(), true);
    await input.fill("Synthetic private input A");
    assert.equal(
      await page
        .getByRole("button", { name: "Review input", exact: true })
        .isEnabled(),
      true,
    );
    await readOnly(page);
    await page.evaluate(() => window.__auth.set("synthetic-human-B"));
    const next = await latest(page, "read", request.id);
    assert.equal(next.subject, "synthetic-human-B");
    assert.equal(await page.locator("textarea").count(), 0);
    assert.equal(
      await page
        .getByText("Synthetic private input A", { exact: true })
        .count(),
      0,
    );
    await settle(page, next, { ...available, actorKey: "c".repeat(64) });
    assert.equal(await input.inputValue(), "");
    await readOnly(page, 2);
    await page.evaluate(() => {
      window.__unmount();
      window.dispatchEvent(new Event("focus"));
    });
    await flush(page);
    assert.equal(await page.locator("main").count(), 0);
    await readOnly(page, 2);
    outcomes.push(
      "Available text remains usable; actor replacement clears private draft before fresh read; unmount cleans up",
    );
    await page.close();
  }

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
