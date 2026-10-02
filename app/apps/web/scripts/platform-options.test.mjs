import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import {
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { platformOptions } from "./platform-options.mjs";
import { assertPlatformPortFree } from "./platform-process.mjs";

// These values exercise configuration syntax only. No provider is contacted.
const configuration = {
  TREIDO_ENV: "development",
  TREIDO_DATA_MODE: "database",
  TREIDO_APP_ORIGIN: "http://127.0.0.1:6419",
  TREIDO_APP_REGION: "fra1",
  TREIDO_CLERK_APP_ID: "app_LauncherFixture",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_fixture",
  CLERK_SECRET_KEY: "sk_test_fixture",
  TREIDO_NEON_PROJECT_ID: "launcher-fixture",
  TREIDO_NEON_BRANCH_ID: "br-launcher-fixture",
  TREIDO_NEON_BRANCH_PURPOSE: "development",
  TREIDO_DB_REGION: "eu-central-1",
  TREIDO_DB_DATABASE: "neondb",
  TREIDO_DB_ROLE: "treido_runtime",
  DATABASE_URL:
    "postgresql://treido_runtime:fixture-only@ep-fixture.eu-central-1.aws.neon.tech/neondb?sslmode=require",
  MIGRATION_DATABASE_URL: "fixture-migration-secret",
  TREIDO_INNGEST_APP_ID: "treido-fixture",
  INNGEST_ENV: "development",
  TREIDO_INNGEST_PURPOSE: "development",
  INNGEST_EVENT_KEY: "e".repeat(32),
  INNGEST_SIGNING_KEY: "signkey-test-" + "d".repeat(64),
  INNGEST_DEV: "false",
  INNGEST_SERVE_ORIGIN: "https://treido-development.example.com",
  TREIDO_OUTBOX_SERVICE_ID: "fixture-repair",
  CRON_SECRET: "f".repeat(32),
  TREIDO_R2_ACCOUNT_ID: "a".repeat(32),
  TREIDO_R2_BUCKET: "treido-unit-testing",
  TREIDO_R2_JURISDICTION: "eu",
  TREIDO_R2_PURPOSE: "development",
  TREIDO_R2_PREFIX: "development-fixture/",
  R2_ACCESS_KEY_ID: "b".repeat(32),
  R2_SECRET_ACCESS_KEY: "c".repeat(64),
};
test("owns the configured loopback origin and disables reference mode", () => {
  const result = platformOptions(configuration);
  assert.equal(result.port, 6419);
  assert.equal(result.background, false);
  assert.deepEqual(result.args, [
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "6419",
  ]);
  assert.equal(result.env.SHOP_REFERENCE_PREVIEW, "0");
  assert.equal(result.env.INNGEST_DEV, "false");
  assert.equal(result.env.MIGRATION_DATABASE_URL, "");
  assert.equal(result.output, ".qa/treido-platform");
  assert.ok(!JSON.stringify(result).includes("fixture-migration-secret"));
});
test("detached output cannot overwrite the reference or foreground output", () => {
  const result = platformOptions(configuration, ["--background"]);
  assert.equal(result.background, true);
  assert.equal(result.output, ".qa/treido-platform-background");
  assert.equal(result.env.SHOP_PARITY_DIST_DIR, result.output);
});
for (const args of [
  ["--unsafe"],
  ["--background", "--background"],
  ["--background", "--port", "6418"],
])
  test("rejects unsupported arguments " + args.join(" "), () =>
    assert.throws(() => platformOptions(configuration, args)),
  );
for (const origin of [
  "http://127.0.0.1:6412",
  "http://127.0.0.1:6413",
  "http://127.0.0.1:6414",
  "http://127.0.0.1:6418",
  "http://localhost:6419",
  "http://127.0.0.1:80",
  "https://platform.example.com",
])
  test("refuses unsafe or reserved origin " + origin, () =>
    assert.throws(() =>
      platformOptions({ ...configuration, TREIDO_APP_ORIGIN: origin }),
    ),
  );
for (const override of [
  { VERCEL: "1" },
  { NODE_ENV: "production" },
  { TREIDO_ENV: "production" },
  { DATABASE_URL: "" },
  { R2_SECRET_ACCESS_KEY: "" },
  { INNGEST_SIGNING_KEY: "" },
  { INNGEST_SERVE_ORIGIN: "" },
  { INNGEST_DEV: "true" },
])
  test("fails closed for " + Object.keys(override).join(","), () =>
    assert.throws(() => platformOptions({ ...configuration, ...override })),
  );
test("errors name missing variables, never their values", () => {
  assert.throws(
    () =>
      platformOptions({
        ...configuration,
        CLERK_SECRET_KEY: "private-invalid-value",
      }),
    (error) => {
      assert.ok(error.message.includes("CLERK_SECRET_KEY"));
      assert.ok(!error.message.includes("private-invalid-value"));
      assert.ok(!error.message.includes(configuration.DATABASE_URL));
      return true;
    },
  );
});
test("an occupied listener is not taken over", async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  try {
    await assert.rejects(assertPlatformPortFree(port), /unavailable/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  await assertPlatformPortFree(port);
});
test("the actual launcher refuses unbound configuration without starting Next", () => {
  const launch = fileURLToPath(new URL("./dev-platform.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [launch, "--background"], {
    encoding: "utf8",
    timeout: 10000,
    env: { SystemRoot: process.env.SystemRoot, PATH: process.env.PATH },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing or invalid variables/);
  assert.doesNotMatch(result.stdout, /process launched/);
});
test("the actual detached child survives its launcher exiting and keeps privileged env empty", async () => {
  const qa = fileURLToPath(new URL("../.qa/", import.meta.url));
  mkdirSync(qa, { recursive: true });
  const root = mkdtempSync(join(qa, "platform-tooling-"));
  const childFile = join(root, "child.mjs");
  const parentFile = join(root, "parent.mjs");
  const parentExited = join(root, "parent-exited");
  const marker = join(root, "child-alive.json");
  const moduleUrl = new URL("./platform-process.mjs", import.meta.url).href;
  writeFileSync(
    childFile,
    `import {existsSync,writeFileSync} from 'node:fs';
    const timer=setInterval(()=>{if(existsSync(${JSON.stringify(parentExited)})){
      writeFileSync(${JSON.stringify(marker)},JSON.stringify({migration:process.env.MIGRATION_DATABASE_URL,reference:process.env.SHOP_REFERENCE_PREVIEW}));
      clearInterval(timer);process.exit(0);}},50);setTimeout(()=>process.exit(2),7000);`,
  );
  const options = {
    ...platformOptions(configuration, ["--background"]),
    args: [],
  };
  writeFileSync(
    parentFile,
    `import {spawnPlatformRuntime} from ${JSON.stringify(moduleUrl)};
    const {child}=await spawnPlatformRuntime(${JSON.stringify(options)},{root:${JSON.stringify(root)},runtimeFile:${JSON.stringify(childFile)},environment:{MIGRATION_DATABASE_URL:'must-not-reach-child'}});
    console.log(child.pid);`,
  );
  let pid;
  try {
    const result = spawnSync(process.execPath, [parentFile], {
      encoding: "utf8",
      timeout: 10000,
    });
    assert.equal(result.status, 0, result.stderr);
    pid = Number(result.stdout.trim());
    assert.ok(Number.isSafeInteger(pid) && pid > 0);
    writeFileSync(parentExited, "launcher exited");
    for (let i = 0; i < 100 && !existsSync(marker); i++) await delay(50);
    assert.ok(
      existsSync(marker),
      "detached child must observe the parent-exit marker",
    );
    assert.deepEqual(JSON.parse(readFileSync(marker, "utf8")), {
      migration: "",
      reference: "0",
    });
  } finally {
    if (pid) {
      try {
        process.kill(pid);
      } catch {
        /* This test child normally already exited. */
      }
    }
    rmSync(root, { recursive: true, force: true });
  }
});
