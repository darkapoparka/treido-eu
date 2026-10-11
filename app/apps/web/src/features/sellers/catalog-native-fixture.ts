import { appendFile, mkdir, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { join, relative, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import EmbeddedPostgres from "embedded-postgres";
import { Pool } from "pg";
import { createDatabase } from "../../server/db/database";
import { applyReviewedMigration } from "../../../scripts/identity-draft-migration.mjs";
import { applyRuntimeGrants } from "../../../scripts/runtime-grants.mjs";

const execute = (file: string, args: string[]) => new Promise<void>((done, fail) => {
  const child = spawn(file, args, { stdio: "ignore", windowsHide: true });
  child.on("error", fail);
  child.on("exit", (code) => code === 0 ? done() : fail(new Error(`Owned PostgreSQL command failed (${code}).`)));
});
/** Fresh loopback-only PostgreSQL. No app environment, Clerk or payment provider is used. */
export async function createCatalogNativeFixture() {
  const evidence = resolve(process.env.TREIDO_DATABASE_EVIDENCE_ROOT ?? "../.qa/pro-merchant-catalog-native");
  await mkdir(evidence, { recursive: true });
  const directory = await mkdtemp(join(evidence, "postgres-"));
  if (relative(await realpath(evidence), await realpath(directory)).startsWith("..")) throw new Error("Unsafe fixture directory");
  const temp = join(directory, "temp");
  await mkdir(temp);
  const previousTemp = process.env.TEMP, previousTmp = process.env.TMP;
  process.env.TEMP = temp; process.env.TMP = temp;
  const port = await new Promise<number>((done, fail) => {
    const server = createServer(); server.on("error", fail);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") { server.close(); fail(new Error("No fixture port")); return; }
      server.close(() => done(address.port));
    });
  });
  if ([6412, 6413, 6418, 6419, 6421, 6422].includes(port)) throw new Error("Protected preview port");
  const log = join(evidence, "postgres.log");
  const cluster = new EmbeddedPostgres({ databaseDir: directory, port, user: "postgres", password: randomBytes(24).toString("hex"), persistent: true, authMethod: "scram-sha-256",
    onLog: (message) => { void appendFile(log, `${message}\n`); }, onError: (message) => { void appendFile(log, `${String(message)}\n`); },
  });
  const packageRequire = createRequire(createRequire(import.meta.url).resolve("embedded-postgres"));
  const pgCtl = (packageRequire(`@embedded-postgres/${process.platform === "win32" ? "windows" : process.platform}-${process.arch}`) as { pg_ctl: string }).pg_ctl;
  let started = false, closed = false;
  let admin: ReturnType<typeof cluster.getPgClient> | undefined;
  let pool: Pool | undefined;
  async function close() {
    if (closed) return;
    closed = true;
    try {
      await pool?.end(); await admin?.end();
      if (started) await execute(pgCtl, ["stop", "-D", directory, "-m", "fast", "-w", "-t", "30"]);
      await rm(directory, { recursive: true, force: false });
    } finally {
      if (previousTemp === undefined) delete process.env.TEMP; else process.env.TEMP = previousTemp;
      if (previousTmp === undefined) delete process.env.TMP; else process.env.TMP = previousTmp;
    }
  }
  try {
    // initdb requires an empty data directory; temporary files live beside it.
    const outsideTemp = join(evidence, "temp"); await mkdir(outsideTemp, { recursive: true });
    await rm(temp, { recursive: true }); process.env.TEMP = outsideTemp; process.env.TMP = outsideTemp;
    await cluster.initialise();
    await execute(pgCtl, ["start", "-D", directory, "-l", log, "-o", `-h 127.0.0.1 -p ${port} -c max_connections=20`, "-w", "-t", "30"]);
    started = true;
    const bootstrap = cluster.getPgClient("postgres", "127.0.0.1");
    await bootstrap.connect();
    try { await bootstrap.query("CREATE DATABASE treido_catalog_test WITH ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C'"); }
    finally { await bootstrap.end(); }
    admin = cluster.getPgClient("treido_catalog_test", "127.0.0.1"); await admin.connect();
    const runner = await readFile(resolve("apps/web/scripts/migrate.mjs"), "utf8");
    const literal = runner.match(/for\s*\(const version of\s*(\[[\s\S]*?\])\s*\)/)?.[1];
    if (!literal || literal.slice(1, -1).replace(/"\d{4}_[a-z_]+"/g, "").replace(/[\s,]/g, "")) throw new Error("Invalid canonical migration list");
    for (const match of literal.matchAll(/"(\d{4}_[a-z_]+)"/g)) await applyReviewedMigration(admin, match[1], await readFile(resolve(`apps/web/migrations/${match[1]}.sql`), "utf8"));
    const password = randomBytes(24).toString("hex");
    await admin.query(`CREATE ROLE treido_catalog_runtime LOGIN PASSWORD '${password}'`);
    await applyRuntimeGrants(admin, "treido_catalog_runtime");
    const config = { host: "127.0.0.1", port, database: "treido_catalog_test", user: "treido_catalog_runtime", password, max: 5, connectionTimeoutMillis: 3000, statement_timeout: 12000 };
    pool = new Pool(config);
    return { database: createDatabase(pool), admin, config, close };
  } catch (error) { await close(); throw error; }
}
