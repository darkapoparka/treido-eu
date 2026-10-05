/* global document: readonly, innerWidth: readonly */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import path from "node:path";
import process from "node:process";
import console from "node:console";
const app = process.cwd(),
  req = createRequire(path.join(app, "package.json")),
  web = createRequire(path.join(app, "apps/web/package.json"));
const vite = createRequire(req.resolve("vitest/config"));
const { build } = await import(pathToFileURL(vite.resolve("vite")).href);
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
    ].map((name) => ({
      find: new RegExp("^" + name + "$"),
      replacement: web.resolve(name),
    })),
  },
  build: {
    write: false,
    minify: false,
    lib: {
      entry: path.join(app, "tests/t72/message-lifecycle-browser-entry.tsx"),
      formats: ["es"],
      fileName: "fixture",
    },
  },
});
const output = Array.isArray(generated)
  ? generated[0].output
  : generated.output;
const code = output.find((item) => item.type === "chunk").code;
const server = createServer((request, response) => {
  response.setHeader("Cache-Control", "no-store");
  if (request.url === "/fixture.js") {
    response.setHeader("Content-Type", "text/javascript");
    response.end(code);
  } else {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(
      '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:16px;font-family:Arial,sans-serif}main{max-width:720px}p{overflow-wrap:break-word}</style></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>',
    );
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { chromium } = req("@playwright/test");
let browser;
const outcomes = [],
  errors = [];
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  for (const lang of ["en", "bg"]) {
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 793 });
      await page.goto(
        `http://127.0.0.1:${server.address().port}/?lang=${lang}`,
      );
      await page.locator("#privacy-scope").waitFor();
      const before = await page.locator("#privacy-scope").boundingBox();
      await page.getByRole("button").focus();
      await page.keyboard.press("Enter");
      await page.getByText("2 / 4", { exact: false }).waitFor();
      assert.deepEqual(
        await page.locator("#privacy-scope").boundingBox(),
        before,
      );
      assert.match(await page.getByRole("region").innerText(), /17/);
      assert.match(
        await page.locator("#privacy-scope").innerText(),
        /50.*32 KiB.*256 KiB/,
      );
      await page.getByRole("button").press("Enter");
      await page
        .getByText("2 / 4", { exact: false })
        .waitFor({ state: "hidden" });
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "200%";
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      outcomes.push(
        `${lang} ${width}px: reviewed counts/delay, free bounded export, keyboard toggle, matched unchanged scope geometry, 200% text no overflow`,
      );
    }
  }
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: outcomes.length,
      outcomes,
      errors,
      fixtureOnly: true,
      filesystemEvidence: false,
      realProvider: false,
    }),
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
