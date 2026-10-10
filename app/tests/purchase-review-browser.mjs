/* global window, document, innerWidth, getComputedStyle -- Callbacks run in the loopback browser. */
import process from "node:process";
import { URL } from "node:url";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
export async function runPurchaseBrowserChecks({
  database,
  admin,
  buyer,
  owner,
  reviewId,
  sellerId,
  source,
  api,
}) {
  const app = process.cwd(),
    out = resolve(
      process.env.TREIDO_DATABASE_EVIDENCE_ROOT,
      "..",
      "purchase-browser",
    );
  await mkdir(out, { recursive: true });
  const require = createRequire(join(app, "package.json")),
    webRequire = createRequire(join(app, "apps/web/package.json")),
    viteRequire = createRequire(require.resolve("vitest/config"));
  const { build } = await import(
    pathToFileURL(viteRequire.resolve("vite")).href
  );
  const actions = `const call=async(path,input)=>{const response=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)});if(!response.ok)throw Error('Unconfirmed response');return response.json()};export const createPurchaseReviewAction=input=>call('/__create',input);export const editPurchaseReviewAction=input=>call('/__edit',input);export const sendPurchaseReviewAction=(reviewId,actorKey)=>call('/__send',{reviewId,actorKey});export const cancelReservationAction=input=>call('/__cancel',input);`;
  const typescript = require("typescript");
  const clerk = "\nimport {useSyncExternalStore} from 'react';\nconst resources=new Set(),observers=new Set(),observed=new WeakSet();\nlet overrideActor=window.__purchaseActor;\nconst subject=()=>overrideActor??current.actor??null;\nconst sessionId=()=>subject()?'synthetic-purchase-session:'+subject():null;\nlet resourceActor,user=null,session=null;\nfunction currentResources(){const actor=subject();if(actor!==resourceActor){resourceActor=actor;user=actor?{id:actor}:null;session=actor?{id:sessionId(),status:'active'}:null}}\nconst clerk={get user(){currentResources();return user},get session(){currentResources();return session},addListener(listener){resources.add(listener);listener({user:clerk.user,session:clerk.session});return()=>resources.delete(listener)}};\nfunction notify(){[...resources].forEach(listener=>listener({user:clerk.user,session:clerk.session}));[...observers].forEach(listener=>listener())}\nfunction observe(value){if(observed.has(value))return value;const proxy=new Proxy(value,{set(target,key,value){const before=subject();Reflect.set(target,key,value);if(key==='actor'&&before!==subject())notify();return true}});observed.add(proxy);return proxy}\nlet current=observe(window.__purchaseInitial);\nObject.defineProperty(window,'__purchaseInitial',{configurable:true,get:()=>current,set(value){const before=subject();current=observe(value);if(before!==subject())notify()}});\nexport const useClerk=()=>clerk;\nexport function useAuth(){const actor=useSyncExternalStore(listener=>{observers.add(listener);return()=>observers.delete(listener)},subject);return {isLoaded:true,isSignedIn:!!actor,userId:actor,sessionId:actor?'synthetic-purchase-session:'+actor:null}}\nexport function useUser(){const auth=useAuth();return {isLoaded:auth.isLoaded,isSignedIn:auth.isSignedIn,user:clerk.user}}\nexport const ClerkProvider=({children})=>children;\n\nObject.defineProperty(window,'__purchaseActor',{configurable:true,get:()=>overrideActor,set(value){const before=subject();overrideActor=value;if(before!==subject())notify()}});\n";
  await build({
    configFile: false,
    root: app,
    logLevel: "error",
    define: {
      "process.env.NODE_ENV": JSON.stringify("development"),
      "process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY": JSON.stringify("pk_test_isolated_purchase_only"),
    },
    resolve: {
      alias: [
        { find: /^@\//, replacement: resolve(app, "apps/web/src") + "/" },
        ...[
          "next-intl",
          "react",
          "react/jsx-runtime",
          "react/jsx-dev-runtime",
          "react-dom",
          "react-dom/client",
        ].map((name) => ({
          find: new RegExp("^" + name.replaceAll("/", "\\/") + "$"),
          replacement: webRequire.resolve(name),
        })),
      ],
    },
    css: { postcss: { plugins: [] } },
    plugins: [
      {
        name: "isolated-purchase-transport",
        enforce: "pre",
        // Keep Next's Server Action boundary: only the four finite transports
        // below can reach the isolated SQL fixture. Unrelated actions are
        // unavailable, never synthetic success or a client-bundled server SDK.
        transform(code, id) {
          if (!id.replaceAll("\\", "/").includes("/apps/web/src/") || !/^\s*["']use server["'];?/.test(code)) return;
          const module = typescript.createSourceFile(id, code, typescript.ScriptTarget.Latest, true);
          const names = module.statements.filter(statement => typescript.isFunctionDeclaration(statement) && statement.name && statement.modifiers?.some(modifier => modifier.kind === typescript.SyntaxKind.ExportKeyword)).map(statement => statement.name.text);
          if (!names.length) throw new Error("Unconfigured Server Action module requires an explicit purchase transport: " + id);
          return { code: names.map(name => "export const " + name + "=async()=>({ok:false,code:'NOT_AVAILABLE'});").join("\n"), map: null };
        },
        resolveId(id, importer) {
          if (id === "./actions" && importer?.includes("purchase-reviews"))
            return "\0purchase:actions";
          if (["next/link", "next/navigation", "@clerk/nextjs"].includes(id))
            return "\0purchase:" + id;
        },
        load(id) {
          if (id === "\0purchase:actions") return actions;
          if (id === "\0purchase:next/link")
            return `import React from 'react';export default props=>React.createElement('a',props)`;
          if (id === "\0purchase:next/navigation")
            return `const router={refresh:()=>void window.__purchaseRefresh?.(),push:path=>location.assign(path),replace:path=>location.replace(path)};export const useRouter=()=>router;`;
          if (id === "\0purchase:@clerk/nextjs")
            return clerk;
        },
      },
    ],
    build: {
      outDir: out,
      emptyOutDir: false,
      minify: false,
      lib: {
        entry: join(app, "tests/purchase-review-entry.tsx"),
        formats: ["es"],
        fileName: () => "purchase-ui.js",
        cssFileName: "purchase-ui",
      },
    },
  });
  const css = await readFile(join(out, "purchase-ui.css"), "utf8"),
    assets = new Map(
      await Promise.all(
        (await readdir(out))
          .filter((n) => n.endsWith(".js"))
          .map(async (n) => ["/" + n, await readFile(join(out, n))]),
      ),
    );
  const font = await readFile(
    join(app, "apps/web/public/fonts/admin/InterVariable.woff2"),
  );
  let dropEdit = false,
    dropCreate = false;
  const requests = { create: [], edit: [] };
  const readInitial = async (url) => {
    const language = url.searchParams.get("lang") === "bg" ? "bg" : "en",
      merchant =
        url.pathname.includes("merchant") ||
        url.pathname.startsWith("/app/sellers/"),
      view = merchant
        ? "merchant"
        : url.pathname === "/create"
          ? "create"
          : "review",
      actor = merchant ? owner : buyer,
      id = /\/reviews\/([^/]+)/.exec(url.pathname)?.[1] ?? reviewId;
    return {
      language,
      view,
      actor: actor.subject,
      actorKey: api.libraryActorKey(actor),
      source,
      history: url.searchParams.get("view") === "history",
      review:
        view === "review"
          ? await api.readPurchaseReview(database, buyer, id)
          : null,
      queue:
        view === "merchant"
          ? await api.readReservationQueue(database, owner, {
              sellerId,
              view:
                url.searchParams.get("view") === "history"
                  ? "history"
                  : "active",
            })
          : null,
    };
  };
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      res.setHeader("cache-control", "no-store");
      if (assets.has(url.pathname)) {
        res.setHeader("content-type", "text/javascript");
        res.end(assets.get(url.pathname));
        return;
      }
      if (url.pathname === "/font.woff2") {
        res.setHeader("content-type", "font/woff2");
        res.end(font);
        return;
      }
      if (req.method === "POST" && url.pathname.startsWith("/__")) {
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 16000) throw Error("Input too large");
        }
        const input = JSON.parse(body);
        let result;
        try {
          let data;
          if (url.pathname === "/__edit") {
            requests.edit.push(input.requestId);
            data = await api.editPurchaseReview(database, buyer, input);
            if (dropEdit) {
              dropEdit = false;
              res.writeHead(503);
              res.end("Unconfirmed response");
              return;
            }
          } else if (url.pathname === "/__create") {
            requests.create.push(input.requestId);
            data = await api.createPurchaseReview(database, buyer, input);
            if (dropCreate) {
              dropCreate = false;
              res.writeHead(503);
              res.end("Unconfirmed response");
              return;
            }
          } else if (url.pathname === "/__send")
            data = await api.sendPurchaseReview(
              database,
              buyer,
              input.reviewId,
              input.actorKey,
            );
          else if (url.pathname === "/__cancel") {
            if (input.actorKey !== api.libraryActorKey(owner))
              throw Error("Wrong actor");
            data = await api.changeOffer(database, owner, {
              sellerId: input.sellerId,
              threadId: input.threadId,
              expectedRevision: input.expectedRevision,
              requestId: input.requestId,
              operation: { kind: "cancel", offerId: input.offerId },
            });
          } else throw Error("Unknown action");
          result = { ok: true, data };
        } catch (error) {
          result = { ok: false, code: error.code ?? "NOT_AVAILABLE" };
        }
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(result));
        return;
      }
      const data = await readInitial(url);
      if (req.headers["x-purchase-data"] === "1") {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(data));
        return;
      }
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.end(
        `<!doctype html><html lang="${data.language}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>@font-face{font-family:Inter;src:url('/font.woff2')}*{box-sizing:border-box}body{margin:0;background:#fafafa;color:#202020;font-family:Inter,Arial,sans-serif}button,input,textarea,select{font:inherit}a{color:inherit}h1{font-size:28px;letter-spacing:-.7px}dialog{border:1px solid #ddd;border-radius:18px;padding:24px;width:min(480px,calc(100% - 32px))}${css}</style></head><body><div id="root"></div><script>window.__purchaseInitial=${JSON.stringify(data).replaceAll("<", "\\u003c")}</script><script type="module" src="/purchase-ui.js"></script></body></html>`,
      );
    } catch (error) {
      res.writeHead(503);
      res.end(
        "Isolated purchase harness error " + (error.code ?? error.message),
      );
    }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const origin = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch({ channel: "chrome", headless: true }),
    context = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
      reducedMotion: "reduce",
    }),
    page = await context.newPage();
  page.setDefaultTimeout(12000);
  const checks = [],
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const check = async (name, run) => {
    try {
      await run();
      checks.push({ name, result: "PASS" });
    } catch (error) {
      checks.push({ name, result: "FAIL", error: error.message });
      throw error;
    }
  };
  try {
    await page.goto(origin + "/review?lang=en");
    await page.locator("[data-purchase-review]").waitFor();
    await check(
      "real saved review renders agreed price and disabled online payment",
      async () => {
        await expect(
          page.getByRole("button", {
            name: "Pay online — unavailable",
            exact: true,
          }),
        ).toBeDisabled();
        await expect(
          page.getByText(
            "This is a saved inquiry, not a payable quote or an order. No payment has been made.",
            { exact: true },
          ),
        ).toBeVisible();
        await page.screenshot({
          path: join(out, "review-desktop.png"),
          fullPage: true,
        });
      },
    );
    await check(
      "unsaved private note survives a full browser reload",
      async () => {
        await page
          .getByRole("textbox", { name: "Private note", exact: true })
          .fill("Keep this private after reload");
        await page.reload();
        await expect(
          page.getByRole("textbox", { name: "Private note", exact: true }),
        ).toHaveValue("Keep this private after reload");
      },
    );
    await check(
      "lost save acknowledgement reuses the same persisted retry identity after reload",
      async () => {
        dropEdit = true;
        await page
          .getByRole("button", { name: "Save note", exact: true })
          .click();
        await expect(page.getByRole("alert")).toContainText(
          "could not be confirmed",
        );
        await page.reload();
        await page
          .getByRole("button", { name: "Save note", exact: true })
          .click();
        await expect(
          page.getByRole("status").filter({ hasText: /^Saved$/ }),
        ).toBeVisible();
        expect(requests.edit).toHaveLength(2);
        expect(new Set(requests.edit).size).toBe(1);
        expect(
          (await api.readPurchaseReview(database, buyer, reviewId)).note,
        ).toBe("Keep this private after reload");
      },
    );
    await check(
      "server revision conflict preserves input and offers deliberate rebase",
      async () => {
        await page
          .getByRole("textbox", { name: "Private note", exact: true })
          .fill("My unsaved revision");
        const current = await api.readPurchaseReview(database, buyer, reviewId);
        await api.editPurchaseReview(database, buyer, {
          reviewId,
          actorKey: api.libraryActorKey(buyer),
          requestId: randomUUID(),
          expectedRevision: current.revision,
          note: "Different tab note",
          archived: false,
        });
        await page
          .getByRole("button", { name: "Refresh status", exact: true })
          .click();
        await expect(
          page.getByRole("textbox", { name: "Private note", exact: true }),
        ).toHaveValue("My unsaved revision");
        await page
          .getByRole("button", {
            name: "Use latest revision, keep my note",
            exact: true,
          })
          .click();
        await page
          .getByRole("button", { name: "Save note", exact: true })
          .click();
        await expect(
          page.getByRole("status").filter({ hasText: /^Saved$/ }),
        ).toBeVisible();
        expect(
          (await api.readPurchaseReview(database, buyer, reviewId)).note,
        ).toBe("My unsaved revision");
      },
    );
    await check(
      "explicit inquiry writes one real message and excludes private notes",
      async () => {
        await page
          .getByRole("button", { name: "Send inquiry to seller", exact: true })
          .click();
        await expect(
          page.getByRole("link", { name: "Open conversation", exact: true }),
        ).toBeVisible();
        const saved = await api.readPurchaseReview(database, buyer, reviewId);
        expect(saved.contactThreadId).toBeTruthy();
        const rows = await admin.query(
          "SELECT body FROM treido.messages WHERE request_id=$1",
          [reviewId],
        );
        expect(rows.rows).toHaveLength(1);
        expect(rows.rows[0].body).not.toContain("My unsaved revision");
        await page.reload();
        await expect(
          page.getByRole("link", { name: "Open conversation", exact: true }),
        ).toBeVisible();
      },
    );
    await check(
      "BG mobile review stays within 320 pixels with doubled text",
      async () => {
        await page.setViewportSize({ width: 320, height: 900 });
        await page.goto(origin + "/review?lang=bg");
        await page.locator("[data-purchase-review]").waitFor();
        await expect(
          page.getByRole("textbox", { name: "Лична бележка", exact: true }),
        ).toBeVisible();
        await page.screenshot({
          path: join(out, "review-bg-mobile.png"),
          fullPage: true,
        });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
        await page.evaluate(() => {
          for (const element of document.querySelectorAll(
            "h1,h2,p,label,button,a,small,dt,dd",
          ))
            element.style.fontSize =
              parseFloat(getComputedStyle(element).fontSize) * 2 + "px";
        });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
        await page.screenshot({
          path: join(out, "review-bg-text200.png"),
          fullPage: true,
        });
      },
    );
    await check(
      "review creation recovers an uncertain result without another review or stock hold",
      async () => {
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto(origin + "/create?lang=en");
        const before = (
          await admin.query(
            "SELECT count(*)::int AS n FROM treido.inventory_allocations",
          )
        ).rows[0].n;
        dropCreate = true;
        await page
          .getByRole("button", { name: "Review these items", exact: true })
          .click();
        await expect(page.getByRole("alert")).toContainText(
          "could not be confirmed",
        );
        await page.reload();
        await page
          .getByRole("button", { name: "Review these items", exact: true })
          .click();
        await page.waitForURL(/\/checkout\/reviews\//);
        await page.locator("[data-purchase-review]").waitFor();
        expect(new Set(requests.create).size).toBe(1);
        expect(
          (
            await admin.query(
              "SELECT count(*)::int AS n FROM treido.inventory_allocations",
            )
          ).rows[0].n,
        ).toBe(before);
      },
    );
    await check(
      "merchant confirmation releases the actual accepted hold and updates history",
      async () => {
        await page.goto(origin + "/merchant?lang=en");
        await page.locator("[data-reservations]").waitFor();
        await page.screenshot({
          path: join(out, "reservations-studio.png"),
          fullPage: true,
        });
        await page
          .getByRole("button", { name: "Cancel reservation", exact: true })
          .click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await page
          .getByRole("button", { name: "Keep reservation", exact: true })
          .click();
        expect(
          (
            await api.readReservationQueue(database, owner, {
              sellerId,
              view: "active",
            })
          ).activeCount,
        ).toBe(1);
        await page
          .getByRole("button", { name: "Cancel reservation", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Release reservation", exact: true })
          .click();
        await expect(
          page.getByText("Reservation cancelled", { exact: true }),
        ).toBeVisible();
        expect(
          (
            await api.readReservationQueue(database, owner, {
              sellerId,
              view: "active",
            })
          ).activeCount,
        ).toBe(0);
        await page.getByRole("link", { name: "History", exact: true }).click();
        await expect(page.getByText("Released", { exact: true })).toBeVisible();
      },
    );
    await check(
      "account switching hides private data and no client exception is recorded",
      async () => {
        await page.goto(origin + "/review?lang=en");
        await page.locator("[data-purchase-review]").waitFor();
        await page.evaluate(async () => {
          window.__purchaseActor = "user_different_test_account";
          await window.__purchaseRefresh();
        });
        await expect(page.locator("[data-purchase-review]")).toHaveCount(0);
        await expect(
          page.getByText(
            "Your account or access changed. Sign in again to continue.",
            { exact: true },
          ),
        ).toBeVisible();
        expect(errors).toEqual([]);
      },
    );
    return { checks: checks.length };
  } finally {
    await writeFile(
      join(out, "verification.json"),
      JSON.stringify(
        {
          scope:
            "Actual purchase/merchant components with isolated native PostgreSQL and synthetic identities; not live Clerk or provider qualification.",
          checks,
          errors,
          requests,
        },
        null,
        2,
      ),
    );
    await browser.close();
    await new Promise((done) => server.close(done));
  }
}
