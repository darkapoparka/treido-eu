import fs from 'node:fs/promises';
import { statfsSync } from 'node:fs';
import os from 'node:os';
import process from 'node:process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { randomBytes, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { applyReviewedMigration } from '../../apps/web/scripts/identity-draft-migration.mjs';
import { applyRuntimeGrants } from '../../apps/web/scripts/runtime-grants.mjs';
import { loadVerifiedRemediationFreeze } from './remediation-freeze.mjs';
const root = path.resolve(import.meta.dirname, '../../..');
const defaultEvidence = path.join(root, '.qa/t61');
const requireWeb = createRequire(path.join(root, 'app/apps/web/package.json'));
const { Pool } = requireWeb('pg');
const embeddedRequire = createRequire(requireWeb.resolve('embedded-postgres'));
const binaries = await import(pathToFileURL(embeddedRequire.resolve('@embedded-postgres/windows-x64')).href);
const { default: EmbeddedPostgres } = await import(pathToFileURL(requireWeb.resolve('embedded-postgres')).href);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const pgctl = args => new Promise((resolve, reject) => {
  const child = spawn(binaries.pg_ctl, args, { stdio: 'ignore', windowsHide: true });
  child.once('error', reject);
  child.once('exit', code => code === 0 ? resolve() : reject(Error('Owned pg_ctl failed: ' + code)));
});
export async function startNativeCluster(options = {}) {
  if (process.version !== 'v24.20.0') throw Error('Pinned Node required');
  const evidence = options.evidenceDirectory ? path.resolve(options.evidenceDirectory) : defaultEvidence;
  if (evidence === path.parse(evidence).root) throw Error('Ambiguous native evidence target');
  const qualification = await loadVerifiedRemediationFreeze();
  if (options.reviewedAdditionalMigrations &&
      JSON.stringify(options.reviewedAdditionalMigrations) !== JSON.stringify(qualification.reviewedAdditionalMigrations))
    throw Error('Caller migration additions differ from actual verified combined freeze');
  const stat = statfsSync(root);
  if (stat.bavail * stat.bsize < 1073741824 || os.freemem() < 1610612736)
    throw Error('Insufficient current headroom');
  await fs.mkdir(evidence, { recursive: true });
  const directory = await fs.mkdtemp(path.join(evidence, 'postgres-'));
  const resolved = await fs.realpath(directory);
  if (path.relative(await fs.realpath(evidence), resolved).startsWith('..') ||
      resolved === path.parse(resolved).root) throw Error('Ambiguous cluster target');
  const temp = path.join(evidence, 'temp');
  await fs.mkdir(temp, { recursive: true });
  process.env.TEMP = temp;
  process.env.TMP = temp;
  process.env.TREIDO_DISCOVERY_CURSOR_KEY = randomBytes(32).toString('hex');
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  if ([6412, 6413, 6418, 6419].includes(port)) throw Error('Protected port selected');
  const password = randomBytes(24).toString('hex');
  const cluster = new EmbeddedPostgres({ databaseDir: directory, port, user: 'postgres',
    password, persistent: true, authMethod: 'scram-sha-256',
    onLog: () => {}, onError: () => {} });
  /** @type {Array<{ file: string, sha256: string }>} */
  const migrations = [];
  const state = { directory: resolved, port, host: '127.0.0.1', database: 't61_isolated',
    fixtureScope: 'synthetic local database only', started: false, stopped: false,
    migrations, originalHelpers: {}, freezeCheckpoint: qualification.checkpoint, freezeSha256: qualification.sha256,
    expectedMigrations: [...qualification.historicalMigrations, ...qualification.reviewedAdditionalMigrations] };
  const persist = async () => {
    const body = JSON.stringify(state, null, 2);
    await fs.writeFile(path.join(directory, 't61-cluster-state.json'), body);
    await fs.writeFile(path.join(evidence, 'cluster-state.json'), body);
  };
  let admin, runtime, bootstrap;
  const stop = async () => {
    await runtime?.end(); await admin?.end(); await bootstrap?.end();
    if (state.started && !state.stopped) {
      await pgctl(['stop', '-D', directory, '-m', 'fast', '-w', '-t', '30']);
      state.stopped = true; await persist();
    }
  };
  try {
    for (const name of ['identity-draft-migration.mjs', 'runtime-grants.mjs'])
      state.originalHelpers[name] = hash(await fs.readFile(path.join(root, 'app/apps/web/scripts', name)));
    await cluster.initialise();
    await pgctl(['start', '-D', directory, '-l', path.join(evidence, 'native-postgres.log'),
      '-o', `-h 127.0.0.1 -p ${port} -c max_connections=20 -c shared_buffers=32MB`, '-w', '-t', '30']);
    state.started = true; await persist();
    bootstrap = new Pool({ host: '127.0.0.1', port, user: 'postgres', password, database: 'postgres', max: 1 });
    await bootstrap.query("CREATE DATABASE t61_isolated WITH ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C' LC_CTYPE 'C'");
    admin = new Pool({ host: '127.0.0.1', port, user: 'postgres', password, database: state.database, max: 3 });
    state.version = (await admin.query('SELECT version() AS version')).rows[0].version;
    const files = (await fs.readdir(path.join(root, 'app/apps/web/migrations')))
      .filter(name => /^00(?:0[1-9]|1\d|2\d|3[0-3])_[a-z_]+\.sql$/.test(name)).sort();
    if (files.length !== 33) throw Error('Reviewed 0001-0033 snapshot missing');
    const client = await admin.connect();
    try {
      for (const file of files.slice(0, 29)) {
        const source = await fs.readFile(path.join(root, 'app/apps/web/migrations', file), 'utf8');
        await applyReviewedMigration(client, file.slice(0, -4), source);
        state.migrations.push({ file, sha256: hash(source) });
      }
      // Optional owned isolated-fixture/projection capture on the genuine29-
      // migration schema. Reviewed additions go only after this point; no shared
      // connection or fixture path is supplied by this harness.
      if (options.afterBaseMigrations) await options.afterBaseMigrations(client);
      for (const file of files.slice(29)) {
        const source = await fs.readFile(path.join(root, 'app/apps/web/migrations', file), 'utf8');
        await applyReviewedMigration(client, file.slice(0, -4), source);
        state.migrations.push({ file, sha256: hash(source) });
      }
      // Optional NEW-wave additions come only from the verified combined freeze.
      // Both original30 and new-wave callers use the same qualified additions.
      // Original29 pre-Gift capture and exact original33 application stay intact.
      for (const addition of qualification.reviewedAdditionalMigrations) {
        if (!/^\d{4}_[a-z_]+\.sql$/.test(addition.file) || Number(addition.file.slice(0, 4)) <= 33 ||
            state.migrations.some(item => item.file === addition.file)) throw Error('Invalid reviewed native addition');
        const source = await fs.readFile(path.join(root, 'app/apps/web/migrations', addition.file), 'utf8');
        if (hash(source) !== addition.sha256) throw Error('Frozen canonical native addition changed: ' + addition.file);
        await applyReviewedMigration(client, addition.file.slice(0, -4), source);
        state.migrations.push({ file: addition.file, sha256: hash(source) });
      }
      const runtimePassword = randomBytes(24).toString('hex');
      await client.query(`CREATE ROLE treido_runtime LOGIN PASSWORD '${runtimePassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`);
      await applyRuntimeGrants(client, 'treido_runtime');
      runtime = new Pool({ host: '127.0.0.1', port, user: 'treido_runtime', password: runtimePassword,
        database: state.database, max: 6, connectionTimeoutMillis: 3000,
        statement_timeout: 12000, idle_in_transaction_session_timeout: 12000 });
    } finally { client.release(); }
    for (const [name, before] of Object.entries(state.originalHelpers))
      if (hash(await fs.readFile(path.join(root, 'app/apps/web/scripts', name))) !== before)
        throw Error('Original helper changed during bootstrap: ' + name);
    await persist();
    return { admin, runtime, stop, state };
  } catch (error) { await stop(); throw error; }
}
