import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile, mkdir, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL, URL } from "node:url";
import { randomUUID } from "node:crypto";
import process from "node:process";
import { exerciseInbox } from "./inbox-browser-checks.mjs";
/** Test-only loopback transport for actual UI/native PostgreSQL. No live identity or app auth override. */
export async function runInboxBrowserChecks({
  database,
  admin,
  owner,
  other,
  api,
}) {
  const app = process.cwd(),
    output = resolve(app, ".qa/t38-inbox-components");
  await mkdir(output, { recursive: true });
  const req = createRequire(join(app, "package.json")),
    web = createRequire(join(app, "apps/web/package.json"));
  const vite = createRequire(req.resolve("vitest/config"));
  const { build } = await import(pathToFileURL(vite.resolve("vite")).href);
  const actionNames = [
    "readInboxAction",
    "readConversationAction",
    "sendMessageAction",
    "markReadAction",
    "blockContactAction",
    "startConversationAction",
    "reportResourceAction",
    "appealModerationAction",
  ];
  const actions = actionNames
    .map(
      (name) =>
        "export const " +
        name +
        '=input=>fetch("/__action?role="+window.__inbox.role,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:' +
        JSON.stringify(name) +
        ",input})}).then(r=>r.json());",
    )
    .join("\n");
  const navigation =
    'export const useParams=()=>({sellerId:window.__inbox.sellerId});export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);const dest=path=>{const u=new URL(path,location.origin);u.searchParams.set("role",window.__inbox.role);return u.href;};const router={push:path=>location.assign(dest(path)),replace:path=>location.replace(dest(path)),refresh:()=>fetch(location.href+"&data=1").then(r=>r.json()).then(window.__renderInbox)};export const useRouter=()=>router;';
  await build({
    configFile: false,
    root: app,
    logLevel: "error",
    define: { "process.env.NODE_ENV": JSON.stringify("development") },
    resolve: {
      alias: [
        {
          find: new RegExp("^@/"),
          replacement: resolve(app, "apps/web/src") + "/",
        },
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
        name: "isolated-inbox-transport",
        enforce: "pre",
        resolveId(id, importer) {
          if (["next/link", "next/navigation", "@clerk/nextjs"].includes(id))
            return "\0inbox:" + id;
          if (
            id === "./actions" &&
            /[/](messaging|trust)[/]/.test(
              (importer ?? "").replaceAll("\\", "/"),
            )
          )
            return "\0inbox:actions";
        },
        load(id) {
          if (id === "\0inbox:actions") return actions;
          if (id === "\0inbox:next/navigation") return navigation;
          if (id === "\0inbox:@clerk/nextjs")
            return "export const useAuth=()=>({isLoaded:true,isSignedIn:true,userId:window.__inbox.actor});";
          if (id === "\0inbox:next/link")
            return 'import React from "react";export default function Link({href,prefetch,...props}){const u=new URL(href,location.origin);u.searchParams.set("role",window.__inbox.role);return React.createElement("a",{...props,href:u.href});}';
        },
      },
    ],
    build: {
      outDir: output,
      emptyOutDir: false,
      minify: false,
      lib: {
        entry: join(app, "tests/inbox-entry.tsx"),
        formats: ["es"],
        fileName: () => "inbox-ui.js",
        cssFileName: "inbox-ui",
      },
    },
  });
  const assets = new Map(
    await Promise.all(
      (await readdir(output))
        .filter((name) => name.endsWith(".js"))
        .map(async (name) => ["/" + name, await readFile(join(output, name))]),
    ),
  );
  const css = await readFile(join(output, "inbox-ui.css"), "utf8"),
    font = await readFile(
      join(app, "apps/web/public/fonts/admin/InterVariable.woff2"),
    );
  const base =
    "*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;font-size:14px;color:#101010;background:#fdfdfd}button,input,select,textarea{font:inherit}button,a{-webkit-tap-highlight-color:transparent}";
  const sellerId = await api.createBusinessSeller(database, owner, {
    name: "Test Treido Store",
    requestId: randomUUID(),
  });
  const listingId = (
    await api.createListingDraft(database, owner, {
      sellerId,
      requestId: randomUUID(),
      payload: {
        ...api.emptyDraft,
        title: "Обява за съобщения",
        categoryId: "cat:electronics/phones",
        condition: "good",
      },
    })
  ).id;
  await admin.query(
    "UPDATE treido.category_policies SET state='reviewed',enabled_for_publish=true,review_reference='SYNTHETIC UI TEST',reviewed_at=now() WHERE category_id='cat:electronics/phones' AND version=1",
  );
  await admin.query(
    "UPDATE treido.listings SET publication='published' WHERE id=$1",
    [listingId],
  );
  const threadId = (
    await api.openListingConversation(database, other, listingId)
  ).id;
  await api.sendConversationMessage(
    database,
    owner,
    { threadId, body: "Здравейте от продавача", requestId: randomUUID() },
    { sellerId },
  );
  let loseAcknowledgement = true;
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1"),
        actor = url.searchParams.get("role") === "seller" ? owner : other,
        role = actor === owner ? "seller" : "buyer";
      response.setHeader("cache-control", "no-store");
      if (assets.has(url.pathname)) {
        response.setHeader("content-type", "text/javascript");
        response.end(assets.get(url.pathname));
        return;
      }
      if (url.pathname === "/fonts/admin/InterVariable.woff2") {
        response.setHeader("content-type", "font/woff2");
        response.end(font);
        return;
      }
      if (url.pathname === "/__action" && request.method === "POST") {
        let raw = "";
        for await (const chunk of request) {
          raw += chunk;
          if (raw.length > 32000) throw Error("oversize");
        }
        const { name, input } = JSON.parse(raw);
        let result;
        try {
          let data;
          if (name === "readInboxAction")
            data = await api.readInbox(database, actor, input);
          else if (name === "readConversationAction")
            data = await api.readConversation(database, actor, input);
          else if (name === "sendMessageAction") {
            const { sellerId, ...command } = input;
            data = await api.sendConversationMessage(database, actor, command, {
              sellerId,
            });
          } else if (name === "markReadAction")
            data = await api.markConversationRead(database, actor, input);
          else if (name === "blockContactAction")
            data = await api.setContactBlocked(database, actor, input);
          else if (name === "reportResourceAction")
            data = await api.createResourceReport(database, actor, input);
          else if (name === "appealModerationAction")
            data = await api.appealModeration(database, actor, input);
          else if (name === "startConversationAction")
            data = await api.openListingConversation(database, actor, input);
          else throw Error("unknown action");
          result = { ok: true, data };
          if (name === "sendMessageAction" && loseAcknowledgement) {
            loseAcknowledgement = false;
            result = { ok: false, code: "NOT_AVAILABLE" };
          }
        } catch (error) {
          result = { ok: false, code: error.code ?? "NOT_AVAILABLE" };
        }
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(result));
        return;
      }
      const language = url.searchParams.get("lang") === "en" ? "en" : "bg",
        operating = url.pathname.startsWith("/app/") ? sellerId : null;
      const report = /^[/]messages[/]reports[/]([^/]+)$/.exec(url.pathname);
      const selected = url.pathname.endsWith("/" + threadId) ? threadId : null;
      const inbox = await api.readInbox(database, actor, {
        sellerId: operating,
        q: url.searchParams.get("q") ?? "",
        filter: url.searchParams.get("filter") ?? "all",
        cursor: url.searchParams.get("cursor"),
      });
      const initial = {
        actor: actor.subject,
        role,
        language,
        sellerId: operating,
        name: "Test Treido Store",
        view: report ? "report" : "inbox",
        inbox,
        conversation: selected
          ? await api.readConversation(database, actor, {
              sellerId: operating,
              threadId: selected,
            })
          : null,
        decisions: [],
      };
      if (report)
        Object.assign(
          initial,
          await api.readReportDetail(database, actor, report[1]),
        );
      if (url.searchParams.get("data") === "1") {
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(initial));
        return;
      }
      response.setHeader("content-type", "text/html;charset=utf-8");
      response.end(
        '<!doctype html><html lang="' +
          language +
          '"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>' +
          base +
          css +
          '</style></head><body><div id="root"></div><script>window.__inbox=' +
          JSON.stringify(initial).replaceAll("<", "\\u003c") +
          '</script><script type="module" src="/inbox-ui.js"></script></body></html>',
      );
    } catch (error) {
      response.statusCode = 500;
      response.end(
        "Isolated inbox test error: " + (error.code ?? error.message),
      );
    }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  try {
    return await exerciseInbox({
      origin: "http://127.0.0.1:" + server.address().port,
      sellerId,
      listingId,
      threadId,
      output,
      database,
      admin,
      owner,
      other,
      api,
      req,
    });
  } finally {
    await new Promise((done) => server.close(done));
    await admin.query(
      "UPDATE treido.category_policies SET state='pending',enabled_for_publish=false,review_reference=NULL,reviewed_at=NULL WHERE category_id='cat:electronics/phones' AND version=1",
    );
  }
}
