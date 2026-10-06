import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { URL } from "node:url";
import process from "node:process";
import console from "node:console";
import { randomUUID } from "node:crypto";

/** Interactive CUA acceptance harness over actual components/native PostgreSQL.
 * No production auth bypass, fixture fallback, or public listener. */
export async function runAdminBrowserChecks({ database, admin, owner, api }) {
  const app = process.cwd(),
    output = resolve(
      process.env.TREIDO_DATABASE_EVIDENCE_ROOT,
      "..",
      "admin-browser",
    );
  await mkdir(output, { recursive: true });
  const require = createRequire(join(app, "package.json")),
    webRequire = createRequire(join(app, "apps/web/package.json"));
  const viteRequire = createRequire(require.resolve("vitest/config"));
  const { build } = await import(
    pathToFileURL(viteRequire.resolve("vite")).href
  );
  const actions = `export async function persistDraftAction(input){return(await fetch('/__save',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)})).json()}`;
  const navigation = `let navigating=false;export const useParams=()=>({sellerId:window.__initial.seller?.sellerId});export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({replace:path=>history.replaceState(null,'',path),push:path=>{navigating=true;location.assign(path)},refresh:()=>{if(!navigating)void window.__refreshAdmin?.()}});`;
  const clerk = `export const useAuth=()=>({isLoaded:true,isSignedIn:true,userId:window.__initial.actor});export const useClerk=()=>({user:{id:window.__initial.actor}});export const useUser=()=>({isLoaded:true,user:{id:window.__initial.actor}});`;
  const media = `export const listMediaAction=async()=>({ok:true,data:[]});export const createMediaIntentAction=async()=>({ok:false,code:'NOT_AVAILABLE'});export const completeMediaAction=createMediaIntentAction;export const changeMediaAction=createMediaIntentAction;`;
  const management = `const call=async(path,input)=>(await fetch(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(input)})).json();export const duplicateProductAction=input=>call("/__duplicate",input);export const withdrawProductsAction=input=>call("/__withdraw",input);export const duplicateProductsAction=input=>call("/__duplicate-many",input);`;
  const rebuild = () =>
    build({
      configFile: false,
      root: app,
      logLevel: "warn",
      define: { "process.env.NODE_ENV": JSON.stringify("development") },
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
          name: "isolated-admin-transport",
          enforce: "pre",
          resolveId(id, importer) {
            if (
              id === "./admin-product-management-actions" &&
              (importer?.endsWith("admin-product-table.tsx") ||
                importer?.endsWith("bulk-duplicate-products.tsx"))
            )
              return "\0review:management";
            if (
              [
                "next/link",
                "next/image",
                "next/navigation",
                "@clerk/nextjs",
              ].includes(id)
            )
              return "\0review:" + id;
            if (
              id === "../sellers/actions" &&
              importer?.endsWith("draft-editor.tsx")
            )
              return "\0review:actions";
            if (
              id === "./media-actions" &&
              importer?.endsWith("media-picker.tsx")
            )
              return "\0review:media";
          },
          load(id) {
            if (id === "\0review:management") return management;
            if (id === "\0review:next/link")
              return `import React from 'react';export default function Link(props){return React.createElement('a',props)}`;
            if (id === "\0review:next/image")
              return `import React from 'react';export default function Image(props){return React.createElement('img',props)}`;
            if (id === "\0review:next/navigation") return navigation;
            if (id === "\0review:@clerk/nextjs") return clerk;
            if (id === "\0review:actions") return actions;
            if (id === "\0review:media") return media;
          },
        },
      ],
      build: {
        outDir: output,
        emptyOutDir: false,
        minify: false,
        lib: {
          entry: join(app, "tests/merchant-admin-entry.tsx"),
          formats: ["es"],
          fileName: () => "admin-ui.js",
          cssFileName: "admin-ui",
        },
      },
    });
  await rebuild();
  const globals = await readFile(
      join(app, "apps/web/src/app/globals.css"),
      "utf8",
    ),
    account = await readFile(
      join(app, "apps/web/src/features/account/account.css"),
      "utf8",
    );
  const theme = globals.slice(
    globals.indexOf("@theme {") + 8,
    globals.indexOf("}", globals.indexOf("@theme {")),
  );
  const baseCss =
    `:root{${theme}}` +
    globals.slice(globals.indexOf(":root"), globals.indexOf(".shop-page")) +
    account;
  let css = await readFile(join(output, "admin-ui.css"), "utf8");
  const assets = new Map(
    await Promise.all(
      (await readdir(output))
        .filter((name) => name.endsWith(".js"))
        .map(async (name) => ["/" + name, await readFile(join(output, name))]),
    ),
  );
  const font = await readFile(
    join(app, "apps/web/public/fonts/admin/InterVariable.woff2"),
  );
  // The isolated component transport serves only these owned decorative assets.
  // Next image optimization is verified on the actual application preview.
  const artwork = new Map(
    await Promise.all(
      ["products", "store", "review"].map(async (kind) => {
        const path = `/images/admin/onboarding-${kind}-v1.webp`;
        return [path, await readFile(join(app, "apps/web/public", path))];
      }),
    ),
  );
  const sellerId = await api.createBusinessSeller(database, owner, {
    name: "My Treido Store",
    requestId: randomUUID(),
  });
  const emptyId = await api.createBusinessSeller(database, owner, {
    name: "Empty Test Store",
    requestId: randomUUID(),
  });
  for (const title of [
    "Blue jacket",
    "Телефон за преглед",
    "100%_ literal product",
  ])
    await api.createListingDraft(database, owner, {
      sellerId,
      requestId: randomUUID(),
      payload: {
        ...api.emptyDraft,
        title,
        priceMinor: title === "Blue jacket" ? 4900 : null,
      },
    });
  if (process.env.TREIDO_ADMIN_BROWSER_AUTOMATION) {
    // Synthetic published row exists only inside this owned native test database.
    const published = await api.createListingDraft(database, owner, {
      sellerId,
      requestId: randomUUID(),
      payload: {
        ...api.emptyDraft,
        title: "Published acceptance product",
        priceMinor: 1995,
      },
    });
    await admin.query(
      "UPDATE treido.listings SET publication='published' WHERE id=$1",
      [published.id],
    );
  }
  const sellers = (await api.listOwnedSellers(database, owner)).filter((item) =>
    [sellerId, emptyId].includes(item.sellerId),
  );
  let finish;
  const completion = new Promise((done) => {
    finish = done;
  });
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      // Rebuild only this isolated component bundle while reviewing CSS changes.
      // No arbitrary paths, identities or application-provider configuration.
      if (url.pathname === "/__refresh" && req.method === "POST") {
        await rebuild();
        css = await readFile(join(output, "admin-ui.css"), "utf8");
        for (const name of await readdir(output)) {
          if (name.endsWith(".js"))
            assets.set("/" + name, await readFile(join(output, name)));
        }
        res.end("Component bundle refreshed");
        return;
      }
      if (assets.has(url.pathname)) {
        res.setHeader("content-type", "text/javascript");
        res.end(assets.get(url.pathname));
        return;
      }
      if (url.pathname === "/fonts/admin/InterVariable.woff2") {
        res.setHeader("content-type", "font/woff2");
        res.end(font);
        return;
      }
      if (artwork.has(url.pathname)) {
        res.setHeader("content-type", "image/webp");
        res.end(artwork.get(url.pathname));
        return;
      }
      if (url.pathname === "/__finish" && req.method === "POST") {
        let raw = "";
        for await (const chunk of req) raw += chunk;
        const check = JSON.parse(raw);
        await writeFile(
          join(output, "verification.json"),
          JSON.stringify(check, null, 2),
        );
        res.end("Saved verification");
        finish({ checks: check.checks.length });
        return;
      }
      if (
        ["/__duplicate", "/__duplicate-many", "/__withdraw"].includes(
          url.pathname,
        ) &&
        req.method === "POST"
      ) {
        let raw = "";
        for await (const chunk of req) {
          raw += chunk;
          if (raw.length > 32768) throw new Error("Input too large");
        }
        let result;
        try {
          const execute =
            url.pathname === "/__duplicate-many"
              ? api.duplicateSellerProducts
              : url.pathname === "/__duplicate"
                ? api.duplicateSellerProduct
                : api.withdrawSellerProducts;
          result = {
            ok: true,
            data: await execute(database, owner, JSON.parse(raw)),
          };
        } catch (error) {
          result = { ok: false, code: error.code ?? "NOT_AVAILABLE" };
        }
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(result));
        return;
      }
      if (url.pathname === "/__save" && req.method === "POST") {
        let raw = "";
        for await (const chunk of req) raw += chunk;
        const input = JSON.parse(raw);
        let result;
        try {
          result = {
            ok: true,
            data: input.draftId
              ? await api.saveListingDraft(database, owner, input)
              : await api.createListingDraft(database, owner, input),
          };
        } catch (error) {
          result = { ok: false, code: error.code ?? "NOT_AVAILABLE" };
        }
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(result));
        return;
      }
      const operating =
        /\/sellers\/([^/]+)/.exec(url.pathname)?.[1] ?? sellerId;
      const seller = sellers.find((item) => item.sellerId === operating);
      if (!seller) {
        res.statusCode = 404;
        res.end("Seller unavailable");
        return;
      }
      const language = url.searchParams.get("lang") === "bg" ? "bg" : "en";
      const view = url.pathname.includes("/listings/")
        ? "editor"
        : url.pathname.endsWith("/listings")
          ? "products"
          : "home";
      const unavailable = url.searchParams.get("test-unavailable") === "1";
      const draftId = /\/listings\/([^/]+)\/edit/.exec(url.pathname)?.[1];
      const filters = Object.fromEntries(url.searchParams);
      delete filters["test-unavailable"];
      delete filters["test-text"];
      const text200 = url.searchParams.get("test-text") === "200";
      const renderedCss = text200
        ? (baseCss + css).replace(
            /font-size:\s*([\d.]+)px/g,
            (_match, size) => `font-size:${Number(size) * 2}px`,
          )
        : baseCss + css;
      const data =
        view === "products" && !unavailable
          ? await api.readAdminProducts(database, owner, operating, filters)
          : undefined;
      const draft = draftId
        ? await api.readListingDraft(database, owner, operating, draftId)
        : api.emptyDraft;
      const initial = {
        seller,
        sellers,
        data,
        draft,
        actor: owner.subject,
        requestId: randomUUID(),
        view,
        unavailable,
        language,
      };
      if (req.headers["x-admin-review-data"] === "1") {
        res.setHeader("content-type", "application/json");
        res.setHeader("cache-control", "no-store");
        res.end(JSON.stringify(initial));
        return;
      }
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.setHeader("cache-control", "no-store");
      res.end(
        `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${renderedCss}</style></head><body><div id="root"></div><script>window.__initial=${JSON.stringify(initial).replaceAll("<", "\\u003c")}</script><script type="module" src="/admin-ui.js"></script></body></html>`,
      );
    } catch (error) {
      res.statusCode = 503;
      res.end(
        "Local component review unavailable: " +
          (error.code ?? "NOT_AVAILABLE"),
      );
    }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const origin = `http://127.0.0.1:${server.address().port}`;
  await writeFile(
    join(output, "review.json"),
    JSON.stringify(
      {
        origin,
        sellerId,
        emptyId,
        scope:
          "Actual components and native PostgreSQL; synthetic verified identity and isolated action transport; uploads unavailable. Not live Clerk or Next route qualification.",
      },
      null,
      2,
    ),
  );
  console.log("Admin component review ready:", origin);
  try {
    if (process.env.TREIDO_ADMIN_BROWSER_AUTOMATION) {
      const runner = await import(process.env.TREIDO_ADMIN_BROWSER_AUTOMATION);
      return await runner.runProductManagementChecks({
        origin,
        sellerId,
        emptyId,
        output,
      });
    }
    return await completion;
  } finally {
    await new Promise((done) => server.close(done));
  }
}
