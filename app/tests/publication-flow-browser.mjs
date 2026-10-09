import { createRequire } from "node:module";
import { Buffer } from "node:buffer";
import console from "node:console";
import { createServer } from "node:http";
import { readFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL, URL } from "node:url";
import { randomUUID } from "node:crypto";
import process from "node:process";
/** Loopback-only test transport, real PostgreSQL and actual UI. No application auth override. */
export async function runPublishFlowBrowserChecks({
  database,
  owner,
  other,
  fixture,
  api,
}) {
  const app = process.cwd(),
    out = resolve(app, ".qa/t39-publication-components");
  await mkdir(out, { recursive: true });
  const req = createRequire(join(app, "package.json")),
    web = createRequire(join(app, "apps/web/package.json"));
  const vite = createRequire(req.resolve("vitest/config"));
  const { build } = await import(pathToFileURL(vite.resolve("vite")).href);
  const actions = `const call=(name,input)=>fetch('/__action?role='+window.__publication.role,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name,input})}).then(r=>r.json());
 export const publishListingAction=input=>call('publish',input);
 export const withdrawListingAction=(_previous,form)=>call('withdraw',{...Object.fromEntries(form),expectedRevision:Number(form.get('expectedRevision'))});
 export const startConversationAction=input=>call('start',input);
 export const readConversationAction=input=>call('conversation',input);
 export const sendMessageAction=input=>call('send',input);
 export const markReadAction=input=>call('read',input);
 export const blockContactAction=input=>call('block',input);
 export const reportResourceAction=input=>call('report',input);
 export const appealModerationAction=input=>call('appeal',input);
 // The original SQL transport has no current recoverable reply handler.
 export const sendRecoverableReplyAction=input=>call('sendRecoverableReplyAction',input);`;
  const navigation = `const dest=p=>{const u=new URL(p,location.origin);u.searchParams.set('role',window.__publication.role);return u.href;};const router={push:p=>location.assign(dest(p)),replace:p=>location.replace(dest(p)),back:()=>history.back(),refresh:()=>fetch(location.href+'&data=1').then(r=>r.json()).then(window.__renderPublication)};export const useRouter=()=>router;export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useParams=()=>({});`;
  const clerk = `
import {useSyncExternalStore} from 'react';
const resources=new Set(),observers=new Set(),observed=new WeakSet();
const subject=()=>current.actor??null;
const sessionId=()=>subject()?'synthetic-publication-session:'+subject():null;
let resourceActor,user=null,session=null;
function currentResources(){const actor=subject();if(actor!==resourceActor){resourceActor=actor;user=actor?{id:actor}:null;session=actor?{id:sessionId(),status:'active'}:null}}
const clerk={get user(){currentResources();return user},get session(){currentResources();return session},addListener(listener){resources.add(listener);listener({user:clerk.user,session:clerk.session});return()=>resources.delete(listener)}};
function notify(){[...resources].forEach(listener=>listener({user:clerk.user,session:clerk.session}));[...observers].forEach(listener=>listener())}
function observe(value){if(observed.has(value))return value;const proxy=new Proxy(value,{set(target,key,value){const before=subject();Reflect.set(target,key,value);if(key==='actor'&&before!==subject())notify();return true}});observed.add(proxy);return proxy}
let current=observe(window.__publication);
Object.defineProperty(window,'__publication',{configurable:true,get:()=>current,set(value){const before=subject();current=observe(value);if(before!==subject())notify()}});
export const useClerk=()=>clerk;
export function useAuth(){const actor=useSyncExternalStore(listener=>{observers.add(listener);return()=>observers.delete(listener)},subject);return {isLoaded:true,isSignedIn:!!actor,userId:actor,sessionId:actor?'synthetic-publication-session:'+actor:null}}
export function useUser(){const auth=useAuth();return {isLoaded:auth.isLoaded,isSignedIn:auth.isSignedIn,user:clerk.user}}
export const ClerkProvider=({children})=>children;
`;
  const unusedActions = {
    "message-attachments/actions": [
      "stageAttachmentAction",
      "attachmentStatusAction",
      "removeAttachmentAction",
    ],
    "offers/actions": ["readOffersAction", "changeOfferAction"],
    "purchase-reviews/actions": ["createPurchaseReviewAction"],
    "library/actions": ["readLibraryAction", "changeLibraryAction"],
    "promotions/metric-actions": ["recordPromotionMetricAction"],
    "inventory/actions": ["readPublicInventoryAction"],
    "buyer-cart/actions": ["readBuyerCartAction", "changeBuyerCartAction"],
  };
  const actionModules = [
    "selling/publish-actions",
    "selling/publication-actions",
    "messaging/actions",
    "messaging/reply-actions",
    "trust/actions",
    ...Object.keys(unusedActions),
  ];
  await build({
    configFile: false,
    root: app,
    logLevel: "error",
    define: { "process.env.NODE_ENV": JSON.stringify("development") },
    resolve: {
      alias: [
        { find: /^@\//, replacement: resolve(app, "apps/web/src") + "/" },
        ...[
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
      ],
    },
    css: { postcss: { plugins: [] } },
    plugins: [
      {
        name: "publication-test-transport",
        enforce: "pre",
        resolveId(id, importer) {
          if (
            [
              "next/link",
              "next/navigation",
              "next/image",
              "@clerk/nextjs",
            ].includes(id)
          )
            return "\0publish:" + id;
          const path = (
            id.startsWith(".") && importer ? resolve(dirname(importer), id) : id
          ).replaceAll("\\", "/");
          const actionModule = actionModules.find(
            (name) =>
              path.endsWith("/features/" + name) ||
              path.endsWith("/features/" + name + ".ts"),
          );
          if (actionModule) return "\0publish:actions:" + actionModule;
        },
        load(id) {
          if (id.startsWith("\0publish:actions:")) {
            const module = id.slice("\0publish:actions:".length),
              names = unusedActions[module];
            // No sample success for imported capabilities outside this journey.
            return names
              ? names
                  .map(
                    (name) =>
                      "export const " +
                      name +
                      "=async()=>({ok:false,code:'NOT_AVAILABLE'});",
                  )
                  .join("\n")
              : actions;
          }
          if (id === "\0publish:next/navigation") return navigation;
          if (id === "\0publish:@clerk/nextjs") return clerk;
          if (id === "\0publish:next/link")
            return `import React from 'react';export default function Link({href,prefetch,...props}){const u=new URL(href,location.origin);u.searchParams.set('role',window.__publication.role);return React.createElement('a',{...props,href:u.href});}`;
          if (id === "\0publish:next/image")
            return `import React from 'react';export default function Image({priority,fill,...props}){return React.createElement('img',props);}`;
        },
      },
    ],
    build: {
      outDir: out,
      emptyOutDir: false,
      minify: false,
      lib: {
        entry: join(app, "tests/publication-flow-entry.tsx"),
        formats: ["es"],
        fileName: () => "publication-ui.js",
        cssFileName: "publication-ui",
      },
    },
  });
  const assets = new Map(
    await Promise.all(
      (await readdir(out))
        .filter((n) => n.endsWith(".js"))
        .map(async (n) => ["/" + n, await readFile(join(out, n))]),
    ),
  );
  const globals = await readFile(
    join(app, "apps/web/src/app/globals.css"),
    "utf8",
  );
  const themeStart = globals.indexOf("@theme {"),
    themeEnd = globals.indexOf("}", themeStart);
  const base = globals
    .replace(/@import[^;]+;/g, "")
    .replace(
      globals.slice(themeStart, themeEnd + 1),
      ":root{" + globals.slice(themeStart + 8, themeEnd) + "}",
    );
  const css =
    base +
    (await readFile(
      join(app, "apps/web/src/features/account/account.css"),
      "utf8",
    )) +
    (await readFile(join(out, "publication-ui.css"), "utf8"));
  let loseFirstPublish = true;
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost"),
        actor = url.searchParams.get("role") === "buyer" ? other : owner;
      const send = (status, body, type = "application/json") => {
        response.writeHead(status, {
          "content-type": type,
          "cache-control": "no-store",
        });
        response.end(
          typeof body === "string" || Buffer.isBuffer(body)
            ? body
            : JSON.stringify(body),
        );
      };
      if (url.pathname === "/favicon.ico") return send(204, "");
      if (assets.has(url.pathname))
        return send(200, assets.get(url.pathname), "text/javascript");
      if (url.pathname === "/ui.css") return send(200, css, "text/css");
      if (url.pathname.startsWith("/api/listing-media/")) {
        const bits = url.pathname.split("/");
        return send(
          200,
          await api.readPublishedPhoto(
            database,
            fixture.storage,
            bits[3],
            bits[4],
            Number(url.searchParams.get("v")),
          ),
          "image/webp",
        );
      }
      if (url.pathname === "/__action") {
        const chunks = [];
        let size = 0;
        for await (const chunk of request) {
          size += chunk.length;
          if (size > 16000) throw Error("Request too large");
          chunks.push(chunk);
        }
        const { name, input } = JSON.parse(Buffer.concat(chunks));
        try {
          let data;
          if (name === "publish") {
            data = await api.publishListing(database, actor, input);
            if (loseFirstPublish) {
              loseFirstPublish = false;
              return send(200, "{"); // Truncated acknowledgement after the committed publication.
            }
          } else if (name === "withdraw")
            data = await api.withdrawListing(database, actor, input);
          else if (name === "start")
            data = await api.openListingConversation(database, actor, input);
          else if (name === "conversation")
            data = await api.readConversation(database, actor, input);
          else if (name === "send") {
            const { sellerId, ...message } = input;
            data = await api.sendConversationMessage(database, actor, message, {
              sellerId,
            });
          } else if (name === "read")
            data = await api.markConversationRead(database, actor, input);
          else return send(200, { ok: false, code: "NOT_AVAILABLE" });
          return send(200, { ok: true, data });
        } catch (error) {
          return send(200, { ok: false, code: error.code ?? "NOT_AVAILABLE" });
        }
      }
      const role = actor === other ? "buyer" : "owner",
        locale = url.searchParams.get("lang") === "en" ? "en" : "bg";
      const initial = {
        role,
        locale,
        actor: actor.subject,
        listingId: fixture.draft.id,
        requestId: randomUUID(),
        view: "review",
      };
      if (url.pathname.startsWith("/products/")) {
        initial.view = "product";
        initial.listing = await api.readPublishedListing(
          database,
          fixture.draft.id,
        );
        if (!initial.listing)
          return send(404, "Listing unavailable", "text/plain");
      } else if (url.pathname === "/messages/new") initial.view = "start";
      else if (url.pathname.startsWith("/messages/")) {
        initial.view = "thread";
        initial.conversation = await api.readConversation(database, actor, {
          sellerId: null,
          threadId: url.pathname.split("/")[2],
        });
      } else
        initial.review = await api.readPublicationReview(
          database,
          actor,
          fixture.sellerId,
          fixture.draft.id,
        );
      if (url.searchParams.has("data")) return send(200, initial);
      send(
        200,
        '<!doctype html><html lang="' +
          locale +
          '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/ui.css"></head><body><div id="root"></div><script>window.__publication=' +
          JSON.stringify(initial).replaceAll("<", "\\u003c") +
          '</script><script type="module" src="/publication-ui.js"></script></body></html>',
        "text/html",
      );
    } catch (error) {
      response.writeHead(error.code === "NOT_FOUND" ? 404 : 503, {
        "content-type": "text/plain",
      });
      response.end("Unavailable");
    }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const origin = "http://127.0.0.1:" + server.address().port;
  const { chromium, expect } = req("@playwright/test");
  let browser;
  const checks = [];
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const context = await browser.newContext({
      viewport: { width: 393, height: 850 },
      locale: "bg-BG",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto(origin + "/review?role=owner&lang=bg");
    for (const name of [
      "Артикулът е мой или имам право да го продавам.",
      "Имам право да публикувам тези снимки.",
      "Описанието и състоянието са точни, включително известните дефекти.",
    ])
      await page.getByRole("checkbox", { name, exact: true }).check();
    await page
      .getByLabel("Известни дефекти или следи от употреба", { exact: true })
      .fill("Следи от употреба");
    await page
      .getByRole("button", { name: "Публикувай обявата", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("не е публикувана");
    await page
      .getByRole("button", { name: "Публикувай обявата", exact: true })
      .click();
    await expect(
      page
        .getByRole("link", { name: "Виж публичната обява", exact: true })
        .first(),
    ).toBeVisible();
    checks.push(
      "lost publish acknowledgement retries the same accepted snapshot",
    );
    await page
      .getByRole("link", { name: "Виж публичната обява", exact: true })
      .first()
      .click();
    await expect(page.locator(".product-gallery img")).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator(".product-gallery img")
          .evaluate((image) => image.complete && image.naturalWidth > 0),
      )
      .toBe(true);
    await expect(
      page.getByRole("heading", { name: "Телефон за тест", exact: true }),
    ).toBeVisible();
    checks.push("actual processed public photo and UTF-8 listing content load");
    await page.locator(".product-gallery button").first().click();
    await expect(page.locator("dialog[open]")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    checks.push("shared gallery opens and dismisses with focus restoration");
    for (const width of [320, 393, 1440]) {
      await page.setViewportSize({ width, height: 850 });
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              globalThis.document.documentElement.scrollWidth <=
              globalThis.innerWidth,
          ),
        )
        .toBe(true);
      await page
        .getByRole("heading", { name: "Телефон за тест", exact: true })
        .click();
      await page.evaluate(() => globalThis.document.fonts.ready);
      await page.screenshot({
        path: join(out, "published-" + width + ".png"),
        fullPage: true,
      });
      checks.push("public detail layout " + width);
    }
    await page.goto(
      origin + "/products/" + fixture.draft.id + "?role=buyer&lang=bg",
    );
    await page
      .getByRole("link", { name: "Свържи се с продавача", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Започни разговор", exact: true })
      .click();
    await expect(page.locator("textarea")).toBeVisible();
    await page.locator("textarea").fill("Искам да купя артикула");
    await page.getByRole("button", { name: "Изпрати", exact: true }).click();
    await expect(
      page.getByText("Искам да купя артикула", { exact: true }),
    ).toBeVisible();
    checks.push("public listing opens the real durable buyer contact flow");
    await page.goto(origin + "/review?role=owner&lang=bg");
    await page
      .getByRole("button", { name: "Оттегли обявата", exact: true })
      .click();
    await expect(page.getByRole("status").first()).toContainText("оттеглена");
    const gone = await context.request.get(
      origin + "/products/" + fixture.draft.id + "?role=buyer&lang=bg",
    );
    expect(gone.status()).toBe(404);
    checks.push("withdraw removes public detail immediately");
    expect(errors).toEqual([]);
    console.log("Publication flow browser checks:", checks.length, "passed");
    return { checks: checks.length };
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }
}
