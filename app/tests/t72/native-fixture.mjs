import process from "node:process";
import fs from "node:fs/promises";
import { statfsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { trackPoolDisconnects } from "./pool-disconnects.mjs";
import { applyReviewedMigration } from "../../apps/web/scripts/identity-draft-migration.mjs";
import { applyRuntimeGrants } from "../../apps/web/scripts/runtime-grants.mjs";
const root = path.resolve(import.meta.dirname, "../../..");
const requireWeb = createRequire(path.join(root, "app/apps/web/package.json"));
const { Pool } = requireWeb("pg");
const embeddedRequire = createRequire(requireWeb.resolve("embedded-postgres"));
if (process.arch !== "x64" || !["win32", "linux"].includes(process.platform))
  throw Error("This isolated PostgreSQL packet requires Windows or Linux x64");
const binaries = await import(
  pathToFileURL(
    embeddedRequire.resolve(
      "@embedded-postgres/" +
        (process.platform === "win32" ? "windows-x64" : "linux-x64"),
    ),
  ).href
);
const { default: EmbeddedPostgres } = await import(
  pathToFileURL(requireWeb.resolve("embedded-postgres")).href
);
const pgctl = (args) =>
  new Promise((resolve, reject) => {
    const child = spawn(binaries.pg_ctl, args, {
      stdio: "ignore",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(Error("Owned pg_ctl failed: " + code)),
    );
  });
export async function startLaunchCluster({
  messageLifecycle = false,
  messageImageDispatch = false,
  privacyEvidence = false,
  evidenceDirectory,
} = {}) {
  const evidence = evidenceDirectory
    ? path.resolve(evidenceDirectory)
    : path.join(
        root,
        messageImageDispatch || privacyEvidence
          ? ".qa/launch-privacy-20261005/native"
          : ".qa/t72/native",
      );
  if (process.version !== "v24.20.0") throw Error("Pinned Node required");
  const stat = statfsSync(root);
  if (stat.bavail * stat.bsize < 1073741824 || os.freemem() < 1610612736)
    throw Error("Insufficient headroom");
  await fs.mkdir(evidence, { recursive: true });
  const directory = await fs.mkdtemp(path.join(evidence, "postgres-"));
  const exact = await fs.realpath(directory);
  if (
    path.relative(await fs.realpath(evidence), exact).startsWith("..") ||
    exact === path.parse(exact).root
  )
    throw Error("Unsafe cluster path");
  const temp = path.join(evidence, "temp");
  await fs.mkdir(temp, { recursive: true });
  process.env.TEMP = temp;
  process.env.TMP = temp;
  process.env.TREIDO_DISCOVERY_CURSOR_KEY = randomBytes(32).toString("hex");
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  if ([6412, 6413, 6418, 6419].includes(port)) throw Error("Protected port");
  const password = randomBytes(24).toString("hex");
  const cluster = new EmbeddedPostgres({
    databaseDir: directory,
    port,
    user: "postgres",
    password,
    persistent: true,
    authMethod: "scram-sha-256",
    onLog: () => {},
    onError: () => {},
  });
  let bootstrap, admin, runtime;
  const disconnects = new Map();
  const fixturePool = (options) => {
    const pool = new Pool(options);
    disconnects.set(pool, trackPoolDisconnects(pool));
    return pool;
  };
  const state = {
    directory: exact,
    port,
    started: false,
    stopped: false,
    migrations: [],
  };
  const persist = () =>
    fs.writeFile(
      path.join(directory, "state.json"),
      JSON.stringify(state, null, 2),
    );
  const stop = async () => {
    for (const pool of [runtime, admin, bootstrap]) {
      if (pool) await disconnects.get(pool)();
    }
    if (state.started && !state.stopped) {
      // The measured Windows shutdown checkpoint can exceed30s on this
      // shared disk. Keep a finite cleanup wait without changing test or
      // startup deadlines, assertions, persistence or shutdown mode.
      await pgctl(["stop", "-D", directory, "-m", "fast", "-w", "-t", "60"]);
      state.stopped = true;
      await persist();
    }
  };
  try {
    await cluster.initialise();
    await pgctl([
      "start",
      "-D",
      directory,
      "-l",
      path.join(directory, "postgres.log"),
      "-o",
      `-h 127.0.0.1 -p ${port} -c max_connections=20 -c shared_buffers=32MB`,
      "-w",
      "-t",
      "30",
    ]);
    state.started = true;
    await persist();
    bootstrap = fixturePool({
      host: "127.0.0.1",
      port,
      user: "postgres",
      password,
      database: "postgres",
      max: 1,
    });
    await bootstrap.query(
      "CREATE DATABASE t72_isolated WITH ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C'",
    );
    admin = fixturePool({
      host: "127.0.0.1",
      port,
      user: "postgres",
      password,
      database: "t72_isolated",
      max: 3,
    });
    const files = (await fs.readdir(path.join(root, "app/apps/web/migrations")))
      .filter(
        (f) =>
          /^\d{4}_[a-z_]+\.sql$/.test(f) &&
          Number(f.slice(0, 4)) <=
            (messageImageDispatch ? 50 : messageLifecycle ? 49 : 47),
      )
      .sort();
    if (
      files.length !==
        (messageImageDispatch ? 50 : messageLifecycle ? 49 : 47) ||
      files.at(-1) !==
        (messageImageDispatch
          ? "0050_message_image_dispatch_barrier.sql"
          : messageLifecycle
            ? "0049_message_image_executor_fence.sql"
            : "0047_billing_change_recovery.sql")
    )
      throw Error("Unexpected migration inventory");
    const client = await admin.connect();
    try {
      for (const file of files) {
        await applyReviewedMigration(
          client,
          file.slice(0, -4),
          await fs.readFile(
            path.join(root, "app/apps/web/migrations", file),
            "utf8",
          ),
        );
        state.migrations.push(file);
      }
      const runtimePassword = randomBytes(24).toString("hex");
      await client.query(
        `CREATE ROLE treido_runtime LOGIN PASSWORD '${runtimePassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`,
      );
      await applyRuntimeGrants(client, "treido_runtime");
      runtime = fixturePool({
        host: "127.0.0.1",
        port,
        user: "treido_runtime",
        password: runtimePassword,
        database: "t72_isolated",
        max: 6,
        statement_timeout: 12000,
        idle_in_transaction_session_timeout: 12000,
      });
    } finally {
      client.release();
    }
    await persist();
    return { admin, runtime, stop, state };
  } catch (error) {
    await stop();
    throw error;
  }
}
