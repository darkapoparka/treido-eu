import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
const root = path.resolve(import.meta.dirname, '../../..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
/** This receipt will be populated only from ONE actual root/sole canonical-owner
 * source release. Missing/moving input is a hard error, never a skipped test.
 * No provisional SQL, runner/grant replacement or source hash refresh occurs.
 */
export async function loadVerifiedRemediationFreeze() {
  if (process.version !== 'v24.20.0') throw Error('Pinned Node required');
  const file = path.join(root, '.qa/t61/remediation-execution-freeze.json');
  let raw;
  try { raw = await readFile(file); } catch { throw Error('T61 native HOLD: actual combined canonical/source freeze is not released'); }
  const freeze = JSON.parse(raw);
  if (freeze.status !== 'SOURCE_FROZEN_FOR_T61_QUALIFICATION' || !Array.isArray(freeze.files) ||
      freeze.files.length === 0 || !Array.isArray(freeze.canonicalMigrations) || freeze.canonicalMigrations.length === 0)
    throw Error('T61 native HOLD: missing complete owner/canonical freeze');
  for (const row of freeze.files) {
    if (typeof row.path !== 'string' || !/^[a-f0-9]{64}$/.test(row.sha256)) throw Error('Invalid source freeze row');
    const target = path.resolve(root, row.path);
    if (path.relative(root, target).startsWith('..') || path.relative(root, target) === '' || path.isAbsolute(path.relative(root, target)))
      throw Error('Invalid frozen source path');
    const sourceBytes = await readFile(target).catch(error => {
      throw new Error(`Frozen source read failed: ${row.path} (code=${error?.code ?? 'unavailable'})`, { cause: error });
    });
    if (hash(sourceBytes) !== row.sha256) throw Error('Frozen source drift: ' + row.path);
  }
  const seen = new Set();
  for (const row of freeze.canonicalMigrations) {
    if (!/^\d{4}_[a-z_]+\.sql$/.test(row.file) || Number(row.file.slice(0, 4)) <= 33 || seen.has(row.file) ||
        !freeze.files.some(source => source.path === 'app/apps/web/migrations/' + row.file && source.sha256 === row.sha256))
      throw Error('Unadopted canonical migration in native qualification receipt');
    seen.add(row.file);
  }
  // Fixed retained first-wave contract: later source cannot silently refresh an
  // original migration or substitute the observed cluster's newly applied rows.
  const historicalBytes = await readFile(path.join(root, '.qa/t61/original-bootstrap-contract.json'));
  if (hash(historicalBytes) !== '1856169c90230da0e0b260d992eb42ad438e28b287166e56b886426fe3818a44')
    throw Error('Original33 bootstrap contract changed');
  const historical = JSON.parse(historicalBytes);
  if (historical.status !== 'PRESERVED_ORIGINAL_33_NATIVE_BOOTSTRAP_CONTRACT' || historical.migrationCount !== 33 ||
      !Array.isArray(historical.migrations) || historical.migrations.length !== 33)
    throw Error('Original33 bootstrap contract missing');
  /** @type {Array<{file: string, sha256: string}>} */
  const historicalMigrations = historical.migrations;
  for (const [index, row] of historicalMigrations.entries()) {
    if (!/^\d{4}_[a-z_]+\.sql$/.test(row.file) || Number(row.file.slice(0, 4)) !== index + 1 ||
        !/^[a-f0-9]{64}$/.test(row.sha256) || hash(await readFile(path.join(root, 'app/apps/web/migrations', row.file))) !== row.sha256)
      throw Error('Original33 native SQL changed: ' + row.file);
  }
  /** @type {Array<{file: string, sha256: string}>} */
  const reviewedAdditionalMigrations = freeze.canonicalMigrations.map(row => ({ file: row.file, sha256: row.sha256 }));
  const expected = [...historicalMigrations, ...reviewedAdditionalMigrations];
  for (const [index, row] of expected.entries())
    if (Number(row.file.slice(0, 4)) !== index + 1) throw Error('Canonical migration order/number omission: ' + row.file);
  // Three independent sources must agree: owner-frozen receipts, actual SQL
  // directory, and the ORIGINAL runner's literal reviewed application sequence.
  const directoryFiles = (await readdir(path.join(root, 'app/apps/web/migrations')))
    .filter(file => /^\d{4}_[a-z_]+\.sql$/.test(file)).sort();
  const runnerPath = 'app/apps/web/scripts/migrate.mjs';
  for (const required of [runnerPath, 'app/apps/web/scripts/runtime-grants.mjs'])
    if (!freeze.files.some(row => row.path === required)) throw Error('Original canonical helper missing from freeze: ' + required);
  const runner = await readFile(path.join(root, runnerPath), 'utf8');
  const literal = runner.match(/for\s*\(const version of\s*(\[[\s\S]*?\])\s*\)/)?.[1];
  if (!literal || literal.slice(1, -1).replace(/"\d{4}_[a-z_]+"/g, '').replace(/[\s,]/g, '') !== '')
    throw Error('Original migration runner sequence is not the examined literal contract');
  const runnerFiles = [...literal.matchAll(/"(\d{4}_[a-z_]+)"/g)].map(match => match[1] + '.sql');
  const expectedFiles = expected.map(row => row.file);
  if (JSON.stringify(directoryFiles) !== JSON.stringify(expectedFiles) || JSON.stringify(runnerFiles) !== JSON.stringify(expectedFiles))
    throw Error('Frozen SQL/directory/original runner migration omission or mismatch');
  return { checkpoint: '.qa/t61/remediation-execution-freeze.json', sha256: hash(raw),
    historicalMigrations, reviewedAdditionalMigrations, files: freeze.files };
}
