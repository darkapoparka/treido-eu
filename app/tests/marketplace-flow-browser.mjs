import { createImportBrowserTransport } from "./import-browser-transport.mjs";
import { createInventoryBrowserTransport } from "./inventory-browser-transport.mjs";
import { createLibraryBrowserTransport } from "./library-browser-transport.mjs";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL, URL } from "node:url";
import process from "node:process";
import console from "node:console";
/** Actual public components and SQL against an isolated database; no production auth override. */
export async function runMarketplaceBrowser({
  database,
  fixtures,
  key,
  marker,
  api,
  library = undefined,
  inventory = undefined,
  catalogue = undefined,
  scenario = undefined,
  evidenceName = "t40-marketplace",
}) {
  const app = process.cwd(),
    out = resolve(app, ".qa", evidenceName);
  const libraryTransport = createLibraryBrowserTransport(library);
  const inventoryTransport = createInventoryBrowserTransport(inventory);
  const importTransport = createImportBrowserTransport(catalogue);
  await mkdir(out, { recursive: true });
  const req = createRequire(join(app, "package.json")),
    web = createRequire(join(app, "apps/web/package.json"));
  const vite = createRequire(req.resolve("vitest/config"));
  const typescript = req("typescript");
  const { build } = await import(pathToFileURL(vite.resolve("vite")).href);
  const clerk = `
import {useSyncExternalStore} from 'react';
const resources=new Set(),observers=new Set(),observed=new WeakSet();
const subject=()=>current.actorSubject??null;
const sessionId=()=>subject()?'synthetic-marketplace-session:'+subject():null;
let resourceActor,user=null,session=null;
function currentResources(){const actor=subject();if(actor!==resourceActor){resourceActor=actor;user=actor?{id:actor}:null;session=actor?{id:sessionId(),status:'active'}:null}}
const clerk={get user(){currentResources();return user},get session(){currentResources();return session},addListener(listener){resources.add(listener);listener({user:clerk.user,session:clerk.session});return()=>resources.delete(listener)}};
function notify(){[...resources].forEach(listener=>listener({user:clerk.user,session:clerk.session}));[...observers].forEach(listener=>listener())}
function observe(value){if(observed.has(value))return value;const proxy=new Proxy(value,{set(target,key,value){const before=subject();Reflect.set(target,key,value);if(key==='actorSubject'&&before!==subject())notify();return true}});observed.add(proxy);return proxy}
let current=observe(window.__marketplace);
Object.defineProperty(window,'__marketplace',{configurable:true,get:()=>current,set(value){const before=subject();current=observe(value);if(before!==subject())notify()}});
export const useClerk=()=>clerk;
export function useAuth(){const actor=useSyncExternalStore(listener=>{observers.add(listener);return()=>observers.delete(listener)},subject);return {isLoaded:true,isSignedIn:!!actor,userId:actor,sessionId:actor?'synthetic-marketplace-session:'+actor:null}}
export function useUser(){const auth=useAuth();return {isLoaded:auth.isLoaded,isSignedIn:auth.isSignedIn,user:clerk.user}}
export const ClerkProvider=({children})=>children;
`;
  const unusedActions = {
    // Explicit Server Action boundaries: the isolated client bundle must not
    // pull server-only Clerk/database modules through Studio's real shell.
    "assistant-tools/actions": [
      "readCompatibilityAction",
      "changeCompatibilityAction",
      "readAssistantListingAction",
      "readHelperSellersAction",
      "readHelperDraftsAction",
      "readHelperDraftAction",
      "readSellHelperAction",
      "changeSellHelperAction",
    ],
    "assistant-tools/helper-history-actions": ["readHelperHistoryAction"],
    "sellers/studio-search-actions": ["searchStudioAction"],
    "purchase-reviews/actions": ["createPurchaseReviewAction"],
    "promotions/metric-actions": ["recordPromotionMetricAction"],
  };
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
      libraryTransport.plugin,
      inventoryTransport.plugin,
      importTransport.plugin,
      {
        name: "isolated-marketplace-navigation",
        enforce: "pre",
        // Next compiles every top-level "use server" module to RPC references.
        // Plain Vite does not. Keep that boundary for unrelated actions instead
        // of bundling private database/configuration modules into the browser.
        // The configured SQL-backed inventory/import/library plugins above take
        // precedence. An unconfigured action always fails visibly, never succeeds.
        transform(code, id) {
          if (!id.replaceAll("\\", "/").includes("/apps/web/src/") || !/^\s*["']use server["'];?/.test(code)) return;
          const module = typescript.createSourceFile(id, code, typescript.ScriptTarget.Latest, true);
          const names = module.statements.filter(statement => typescript.isFunctionDeclaration(statement) && statement.name && statement.modifiers?.some(modifier => modifier.kind === typescript.SyntaxKind.ExportKeyword)).map(statement => statement.name.text);
          if (!names.length) throw new Error("Unconfigured Server Action module requires an explicit browser transport: " + id);
          return { code: names.map(name => "export const " + name + "=async()=>({ok:false,code:'NOT_AVAILABLE'});").join("\n"), map: null };
        },
        resolveId(id, importer) {
          if (
            [
              "next/link",
              "next/navigation",
              "next/image",
              "@clerk/nextjs",
            ].includes(id)
          )
            return "\0market:" + id;
          const path = (
            id.startsWith(".") && importer ? resolve(dirname(importer), id) : id
          ).replaceAll("\\", "/");
          const actionModule = Object.keys(unusedActions).find(
            (name) =>
              path.endsWith("/features/" + name) ||
              path.endsWith("/features/" + name + ".ts"),
          );
          if (actionModule) return "\0market:unused-actions:" + actionModule;
        },
        load(id) {
          if (id.startsWith("\0market:unused-actions:"))
            return unusedActions[id.slice("\0market:unused-actions:".length)]
              .map(
                (name) =>
                  "export const " +
                  name +
                  "=async()=>({ok:false,code:'NOT_AVAILABLE'});",
              )
              .join("\n");
          if (id === "\0market:next/navigation")
            return "const router={push:p=>location.assign(p),replace:p=>location.replace(p),back:()=>history.back(),refresh:()=>location.reload()};export const useRouter=()=>router;export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useParams=()=>({sellerId:(window.__marketplace.inventoryEditor?.sellerId??window.__marketplace.adminSeller?.sellerId)});";
          if (id === "\0market:next/link")
            return "import React from 'react';export default function Link({prefetch,onNavigate,onClick,href,...props}){return React.createElement('a',{...props,href,onClick:event=>{onClick?.(event);if(!event.defaultPrevented)onNavigate?.({preventDefault:()=>event.preventDefault()});}});}";
          if (id === "\0market:next/image")
            return "import React from 'react';export function getImageProps({priority,fill,quality,loader,unoptimized,placeholder,blurDataURL,onLoadingComplete,...props}){return {props};}export default function Image(input){return React.createElement('img',getImageProps(input).props);}";
          if (id === "\0market:@clerk/nextjs") return clerk;
        },
      },
    ],
    build: {
      outDir: out,
      emptyOutDir: false,
      minify: false,
      lib: {
        entry: join(app, "tests/marketplace-flow-entry.tsx"),
        formats: ["es"],
        fileName: () => "marketplace-ui.js",
        cssFileName: "marketplace-ui",
      },
    },
  });
  const assets = new Map(
    await Promise.all(
      (await readdir(out))
        .filter((name) => name.endsWith(".js"))
        .map(async (name) => ["/" + name, await readFile(join(out, name))]),
    ),
  );
  const globalCss = await readFile(
    join(app, "apps/web/src/app/globals.css"),
    "utf8",
  );
  const css =
    globalCss.replace(/@import[^;]+;/g, "").replace("@theme {", ":root {") +
    ".sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border-width:0}" +
    (await readFile(join(out, "marketplace-ui.css"), "utf8"));
  const server = createServer(async (request, response) => {
    const send = (status, data, type = "text/html") => {
      response.writeHead(status, {
        "content-type": type,
        "cache-control": "no-store",
      });
      response.end(data);
    };
    try {
      const url = new URL(request.url, "http://localhost");
      if (await libraryTransport.handle(request, response, url)) return;
      if (await inventoryTransport.handle(request, response, url)) return;
      if (await importTransport.handle(request, response, url)) return;
      if (url.pathname === "/fonts/admin/InterVariable.woff2")
        return send(
          200,
          await readFile(
            join(app, "apps/web/public/fonts/admin/InterVariable.woff2"),
          ),
          "font/woff2",
        );
      if (url.pathname === "/favicon.ico") return send(204, "");
      if (url.pathname === "/ui.css") return send(200, css, "text/css");
      if (assets.has(url.pathname))
        return send(200, assets.get(url.pathname), "text/javascript");
      if (url.pathname.startsWith("/api/listing-media/")) {
        const parts = url.pathname.split("/"),
          fixture = fixtures.find((f) => f.draft.id === parts[3]);
        return send(
          200,
          await api.readPublishedPhoto(
            database,
            fixture.storage,
            parts[3],
            parts[4],
            Number(url.searchParams.get("v")),
          ),
          "image/webp",
        );
      }
      const locale = url.searchParams.get("lang") === "en" ? "en" : "bg";
      const sellerId = url.pathname.startsWith("/stores/")
        ? url.pathname.split("/")[2]
        : undefined;
      const initial = {
        locale,
        home: url.pathname === "/",
        info: url.pathname.endsWith("/info"),
        library: url.pathname === "/saved" || url.pathname === "/following",
      };
      url.searchParams.set("lang", locale);
      if (sellerId) url.searchParams.set("seller", "all");
      if (initial.home && !url.searchParams.has("sort"))
        url.searchParams.set("sort", "newest");
      initial.input = api.readDiscoveryInput(url.searchParams).input;
      const stockInitial =
        (inventory ? await inventory.readInitial(request, url) : null) ??
        (catalogue ? await catalogue.readInitial(request, url) : null);
      if (stockInitial) Object.assign(initial, stockInitial);
      if (!stockInitial && url.pathname.startsWith("/products/"))
        initial.listing = await api.readPublishedListing(
          database,
          url.pathname.split("/")[2],
        );
      else if (!stockInitial && !initial.library) {
        initial.page = await api.readPublicDiscovery(
          database,
          url.searchParams,
          { key, sellerId },
        );
        if (sellerId)
          initial.seller = await api.readPublicSeller(database, sellerId);
      }
      return send(
        200,
        '<!doctype html><html lang="' +
          locale +
          '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/ui.css"></head><body><div id="root"></div><script>window.__marketplace=' +
          JSON.stringify(initial).replaceAll("<", "\\u003c") +
          '</script><script type="module" src="/marketplace-ui.js"></script></body></html>',
      );
    } catch {
      return send(503, "Catalogue unavailable");
    }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const origin = "http://127.0.0.1:" + server.address().port;
  const { chromium, expect } = req("@playwright/test");
  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const context = await browser.newContext({
      viewport: { width: 393, height: 850 },
      locale: "bg-BG",
    });
    const page = await context.newPage(),
      errors = [];
    page.setDefaultTimeout(8000);
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    if (scenario) {
      try {
        await scenario({ browser, context, page, origin, out, expect, errors });
      } catch (error) {
        await page.screenshot({
          path: join(out, "failure.png"),
          fullPage: true,
        });
        await writeFile(
          join(out, "failure.json"),
          JSON.stringify(
            {
              url: page.url(),
              body: await page.locator("body").innerText(),
              headings: await page.getByRole("heading").allTextContents(),
              errors,
              failure: error.message,
            },
            null,
            2,
          ),
        );
        throw error;
      }
      return;
    }
    await page.goto(origin + "/?q=" + marker + "&lang=bg");
    await expect(page.locator(".product-card")).toHaveCount(24);
    await expect
      .poll(() =>
        page
          .locator(".product-card img")
          .first()
          .evaluate((image) => image.complete && image.naturalWidth > 0),
      )
      .toBe(true);
    await page
      .getByRole("link", { name: "Следваща страница", exact: true })
      .click();
    await expect(page.locator(".product-card")).toHaveCount(3);
    await page
      .getByRole("link", { name: "Към първата страница", exact: true })
      .click();
    await expect(page.locator(".product-card")).toHaveCount(24);
    await page.getByRole("button", { name: "Филтри", exact: true }).click();
    await expect(page.locator("dialog[open]")).toBeVisible();
    await page.screenshot({ path: join(out, "marketplace-filters.png") });
    await page
      .getByLabel("Категория", { exact: true })
      .selectOption("cat:electronics/phones");
    await page.getByLabel("Минимална цена (€)", { exact: true }).fill("100");
    await page.getByLabel("Максимална цена (€)", { exact: true }).fill("102");
    await page.getByLabel("Град или район", { exact: true }).fill("Sofia");
    await page
      .getByRole("button", { name: "Покажи резултатите", exact: true })
      .click();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await expect
      .poll(() => page.locator(".product-card").count())
      .toBeGreaterThan(0);
    const selected = await page.evaluate(() => globalThis.__marketplace.page);
    expect(
      selected.items.every(
        (item) => item.locality === "София" && item.price.amount <= 10200,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Филтри", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    for (const width of [320, 393, 1440]) {
      await page.setViewportSize({ width, height: 850 });
      expect(
        await page.evaluate(
          () =>
            globalThis.document.documentElement.scrollWidth <=
            globalThis.innerWidth,
        ),
      ).toBe(true);
      if (width !== 320)
        await page.screenshot({
          path: join(out, "marketplace-" + width + ".png"),
          fullPage: true,
        });
    }
    await page.goto(origin + "/stores/" + fixtures[0].sellerId + "?lang=en");
    await expect(page.locator(".product-card")).toHaveCount(2);
    await page
      .getByRole("link", { name: "About this seller", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "About this seller", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Browse all listings", exact: true })
      .click();
    await page.locator(".product-copy").first().click();
    await expect(page.locator(".product-gallery img")).toBeVisible();
    await page.locator(".store-row-identity").click();
    await expect(page.locator(".product-card")).toHaveCount(2);
    await page.getByRole("searchbox").fill("no-matching-item");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Nothing here just yet", exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
    console.log(
      "Marketplace browser: published photos, paging, combined filters, sheet dismissal, 320/393/1440 layouts, BG/EN, seller info, product-to-seller navigation and empty search passed.",
    );
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }
}
