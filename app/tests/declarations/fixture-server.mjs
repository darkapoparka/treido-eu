import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import process from "node:process";
import { statfsSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { pathToFileURL, URL } from "node:url";

export async function startDeclarationFixture({ port = 0 } = {}) {
  if (process.version !== "v24.20.0")
    throw Error("Pinned Node24.20.0 required.");
  if (
    !Number.isInteger(port) ||
    port < 0 ||
    port > 65535 ||
    [3100, 6412, 6413, 6418, 6419].includes(port)
  )
    throw Error(
      "Choose an unoccupied fixture port outside the owned app/donor ports.",
    );
  const app = path.resolve(import.meta.dirname, "../..");
  const root = path.resolve(app, "..");
  const output = path.join(root, ".qa/launch-seller-review-20261008/browser");
  const bundle = path.join(output, "bundle");
  const stat = statfsSync(root);
  if (stat.bavail * stat.bsize < 536870912 || os.freemem() < 1073741824)
    throw Error("Insufficient fixture headroom.");
  const req = createRequire(path.join(app, "package.json"));
  const web = createRequire(path.join(app, "apps/web/package.json"));
  const vite = createRequire(req.resolve("vitest/config"));
  const { build } = await import(pathToFileURL(vite.resolve("vite")).href);
  const postcss = web("@tailwindcss/postcss");
  const runtime = path
    .join(app, "tests/declarations/fixture-runtime.ts")
    .replaceAll("\\", "/");
  const importsRuntime = `import {fixture,syntheticClerk,useSyntheticUser} from ${JSON.stringify(runtime)};`;
  await fs.mkdir(bundle, { recursive: true });
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
    css: {
      postcss: { plugins: [postcss({ base: path.join(app, "apps/web") })] },
    },
    plugins: [
      {
        name: "synthetic-declaration-component-boundaries",
        enforce: "pre",
        resolveId(id, importer) {
          const absolute = (
            id.startsWith(".") && importer
              ? path.resolve(path.dirname(importer), id)
              : id
          ).replaceAll("\\", "/");
          if (id === "@clerk/nextjs") return "\0declarations:clerk";
          if (id === "next/navigation") return "\0declarations:navigation";
          if (id === "next/link") return "\0declarations:link";
          if (
            absolute.endsWith("/features/seller-declarations/actions") ||
            absolute.endsWith("/features/seller-declarations/actions.ts")
          )
            return "\0declarations:actions";
        },
        load(id) {
          if (id === "\0declarations:clerk")
            return (
              importsRuntime +
              "export const useClerk=()=>syntheticClerk;export const useUser=useSyntheticUser;"
            );
          if (id === "\0declarations:actions")
            return (
              importsRuntime +
              "export const readDeclarationReviewAction=raw=>fixture.read(raw);export const reviewSellerDeclarationAction=raw=>fixture.write(raw);"
            );
          if (id === "\0declarations:navigation")
            return (
              importsRuntime +
              "const router={refresh:()=>fixture.refresh(),push:url=>location.assign(url),replace:url=>location.replace(url)};export const useRouter=()=>router;"
            );
          if (id === "\0declarations:link")
            return "import React from'react';export default function Link({prefetch,...props}){return React.createElement('a',props)}";
        },
      },
    ],
    build: {
      outDir: bundle,
      emptyOutDir: false,
      minify: false,
      lib: {
        entry: path.join(app, "tests/declarations/fixture-entry.tsx"),
        formats: ["es"],
        fileName: () => "fixture.js",
        cssFileName: "fixture",
      },
    },
  });
  const [script, css] = await Promise.all([
    fs.readFile(path.join(bundle, "fixture.js")),
    fs.readFile(path.join(bundle, "fixture.css")),
  ]);
  const html =
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>SYNTHETIC declaration component fixture</title><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>';
  const server = createServer((request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Robots-Tag", "noindex, nofollow");
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(request.headers.host ?? "")) {
      response.writeHead(421).end("Loopback fixture only");
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405).end("Component fixture has no HTTP write API");
      return;
    }
    const url = new URL(request.url, "http://127.0.0.1");
    response.setHeader(
      "Content-Type",
      url.pathname === "/fixture.js"
        ? "text/javascript"
        : url.pathname === "/fixture.css"
          ? "text/css"
          : "text/html",
    );
    response.end(
      url.pathname === "/fixture.js"
        ? script
        : url.pathname === "/fixture.css"
          ? css
          : html,
    );
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  const url = "http://127.0.0.1:" + server.address().port;
  const metadata = {
    fixtureOnly: true,
    authModelSynthetic: true,
    operatorAuthorityVerified: false,
    providerTransport: false,
    productionReview: false,
    url,
    pid: process.pid,
  };
  await fs.writeFile(
    path.join(output, "server.json"),
    JSON.stringify(metadata, null, 2),
  );
  return {
    url,
    output,
    metadata,
    req,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}
