import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Pool } from "pg";
import { loadVerifiedRemediationFreeze } from "./remediation-freeze.mjs";
import { createDatabase, inTransaction } from "../../apps/web/src/server/db/database";
import { ensurePersonalSeller, authorizeHuman } from "../../apps/web/src/features/sellers/persistence.server";
import { enqueueJob } from "../../apps/web/src/server/jobs/outbox.server";
import { executeJob } from "../../apps/web/src/server/jobs/execution.server";
export type ShippingFixtureEvidence = {
  sourceManifestHash: string; canonicalLedgerHash: string; nativeReceiptHash: string;
  compilerReceiptHash: string; auditReceiptHash: string; auditPassed: boolean;
  nativeReceiptPath: string; scope: "ISOLATED_CANONICAL_SQL_GRANTS_DENIAL_PREFLIGHT_ONLY";
};
const root = resolve(".."), directory = resolve(root, ".qa/t61");
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
/** Executed bounded preflight, not full positive journey qualification. Actual
 * failed audit remains FAIL; any synthetic accepted-audit branch is fixture-only.
 * No source/helper/trigger/grant override or shared qualification row. */
export async function createShippingQualificationFixture(admin: Pool, runtime: Pool): Promise<ShippingFixtureEvidence> {
  const freeze = await loadVerifiedRemediationFreeze();
  const database = (await admin.query<{ name: string }>("SELECT current_database() AS name")).rows[0].name;
  if (database !== "t61_isolated") throw Error("Synthetic approval forbidden outside owned disposable database");
  const names = await readdir(directory);
  async function receipt(kind: "compiler" | "audit") {
    for (const name of names.filter(name => new RegExp(`^remediation-${kind}-\\d+\\.json$`).test(name)).sort().reverse()) {
      const bytes = await readFile(resolve(directory, name)), row = JSON.parse(bytes.toString("utf8"));
      if (!row.launched || !row.sourceFreezeIntact || row.before?.owners?.[0]?.sha256 !== freeze.sha256 || row.after?.owners?.[0]?.sha256 !== freeze.sha256) continue;
      if (kind === "compiler" && (row.exitCode !== 0 || row.qualifyingExitCode !== 0)) continue;
      if (kind === "audit" && ![0, 1].includes(row.qualifyingExitCode)) continue;
      const output = await readFile(row.output);
      if (kind === "audit" && !output.length) throw Error("Actual unsuppressed audit output is empty");
      return { name, sha256: hash(bytes), outputHash: hash(output), exitCode: row.exitCode, qualifyingExitCode: row.qualifyingExitCode };
    }
    throw Error(`Current frozen ${kind} receipt missing; no placeholder qualification allowed`);
  }
  const compiler = await receipt("compiler"), audit = await receipt("audit");
  const ledger = (await admin.query<{ version: string; checksum: string }>("SELECT version,checksum FROM public.treido_schema_migrations ORDER BY version")).rows;
  const expected = [...freeze.historicalMigrations, ...freeze.reviewedAdditionalMigrations];
  if (ledger.length !== expected.length || ledger.some((row, index) => row.version !== expected[index].file.replace(/\.sql$/, "") || row.checksum !== expected[index].sha256)) throw Error("Actual installed checksum ledger differs from original frozen receipts");
  const canonicalLedgerHash = hash(Buffer.from(ledger.map(row => row.version + ":" + row.checksum).join("\n"), "utf8"));
  const grants = (await runtime.query(`SELECT current_user AS name,r.rolsuper AS superuser,r.rolbypassrls AS bypass,
    has_table_privilege(current_user,'treido.order_shipping_integration_qualifications','INSERT') AS qualification_insert,
    has_table_privilege(current_user,'treido.order_shipping_integration_qualifications','UPDATE') AS qualification_update,
    has_column_privilege(current_user,'treido.order_shipping_recipients','value','UPDATE') AS private_value_update,
    has_function_privilege(current_user,'treido.order_shipping_recipient_obligations_clear(uuid)','EXECUTE') AS obligation_execute,
    treido.order_shipping_retention_ready($1::uuid,'test','treido-t61-isolated') AS unapproved_retention_ready,
    treido.order_shipping_quote_ready($1::uuid,'test','treido-t61-isolated') AS unapproved_quote_ready
    FROM pg_roles r WHERE rolname=current_user`, [randomUUID()])).rows[0];
  if (grants.name !== "treido_runtime" || grants.superuser || grants.bypass || grants.qualification_insert || grants.qualification_update || grants.private_value_update || !grants.obligation_execute || grants.unapproved_retention_ready || grants.unapproved_quote_ready) throw Error("Original restricted grant/readiness preflight failed");
  const helperNames = ["order_shipping_expire_input(uuid,uuid,uuid,integer,uuid,text,text,text,text,text)",
    "order_shipping_validate_recipient_job(uuid,uuid,uuid,integer,uuid,text,text,text,text,text)",
    "order_shipping_clear_accepted_recipient(uuid,uuid,uuid,integer,uuid,text,text,text,text,text)",
    "order_shipping_authorize_job(uuid,uuid,uuid,text,integer,uuid,text,text,text,text,text)",
    "order_shipping_enqueue_maintenance(integer)", "order_shipping_closure_facts(uuid)"];
  const helpers = (await admin.query("SELECT name,to_regprocedure('treido.'||name)::text AS registered FROM unnest($1::text[]) name", [helperNames])).rows;
  if (helpers.some(row => row.registered === null)) throw Error("Original finite helper registration is incomplete");
  const denials: { operation: string; code: string }[] = [];
  for (const [operation, sql, args, code] of [
    ["runtime qualification write", "INSERT INTO treido.order_shipping_integration_qualifications(id) VALUES($1)", [randomUUID()], "42501"],
    ["original authority missing namespace", "SELECT treido.order_shipping_authorize_job($1,$2,$3,'shipping.input-expiry',1,$4,NULL,'test','test','app_T61Native','test')", [randomUUID(), randomUUID(), randomUUID(), randomUUID()], "23514"],
    ["original accepted recipient unknown owner/job/lease", "SELECT treido.order_shipping_validate_recipient_job($1,$2,$3,1,$4,'treido-t61-isolated','test','test','app_T61Native','test')", [randomUUID(), randomUUID(), randomUUID(), randomUUID()], "23514"],
  ] as const) {
    let failure: unknown;
    try { await runtime.query(sql, [...args]); } catch (error) { failure = error; }
    if (!failure || typeof failure !== "object" || !("code" in failure) || failure.code !== code) throw Error("Exact native denial failed: " + operation);
    denials.push({ operation, code });
  }
  const approvals = (await admin.query<{ n: number }>("SELECT count(*)::int AS n FROM treido.order_shipping_integration_qualifications")).rows[0].n;
  if (approvals !== 0) throw Error("Preflight requires zero qualification rows");
  const nativeDatabase = createDatabase(runtime), probeIdentity = { subject: "user_t61_shipping_preflight_" + randomUUID().replaceAll("-", "") };
  const probeSeller = await ensurePersonalSeller(nativeDatabase, probeIdentity);
  const probeOwner = await inTransaction(nativeDatabase, tx => authorizeHuman(tx, probeIdentity, false));
  const probeId = await inTransaction(nativeDatabase, tx => enqueueJob(tx, { kind: "system.probe", sellerId: probeSeller,
    resourceId: probeSeller, operationKey: randomUUID(), actorId: probeOwner.id, authority: "member" }));
  let genuineLeaseDenial: { jobId: string; kind: string; state: string; live: boolean; code: string } | undefined;
  const namespace = { environment: "test", applicationId: "treido-t61-isolated" };
  const probeOutcome = await executeJob(nativeDatabase, { jobId: probeId, sellerId: probeSeller, generation: 1, schemaVersion: 1, ...namespace }, namespace, randomUUID(), {
    "system.probe": async lease => {
      const actual = (await runtime.query<{ state: string; live: boolean }>("SELECT state,execution_token=$2::uuid AND execution_until>clock_timestamp() AS live FROM treido.job_effects WHERE job_id=$1", [lease.id, lease.executionToken])).rows[0];
      if (actual.state !== "running" || !actual.live) throw Error("Original executor must acquire an actual running lease before the denial probe");
      let failure: unknown;
      try { await runtime.query("SELECT treido.order_shipping_authorize_job($1,$2,$3,'shipping.input-expiry',$4,$5,'treido-t61-isolated','test','test','app_T61Native','test')", [lease.id, probeOwner.id, probeSeller, lease.generation, lease.executionToken]); }
      catch (error) { failure = error; }
      if (!failure || typeof failure !== "object" || !("code" in failure) || failure.code !== "55000") throw Error("Actual live original seller lease must not authorize a shipping artifact");
      genuineLeaseDenial = { jobId: lease.id, kind: lease.kind, state: actual.state, live: actual.live, code: "55000" };
      return { resultId: probeSeller };
    },
  });
  if (!genuineLeaseDenial || probeOutcome.status !== "completed") throw Error("Original genuine-lease denial/completion preflight failed");
  const nativeReceiptPath = resolve(directory, "shipping-canonical-preflight-" + randomUUID() + ".json");
  const body = Buffer.from(JSON.stringify({ at: new Date().toISOString(), status: "ISOLATED_CANONICAL_SQL_GRANTS_DENIAL_PREFLIGHT_ONLY",
    database, sourceManifestHash: freeze.sha256, canonicalLedgerHash, ledger, grants, helpers, denials,
    qualificationRows: approvals, compiler, audit: { ...audit, realAuditAcceptance: false, syntheticFixtureDispositionOnly: true },
    shippingPositiveJourneysExecuted: 0, preflightIsFullShippingQualification: false, genuineLiveShippingLeaseExecuted: false, genuineLeaseDenial, probeOutcome,
    liveLeaseProof: "Original live lease/wrong token/rollback/clear is required in final positive journeys; unknown-owner denial above is not a live-lease proof",
    providerEffects: 0, sharedDatabaseEffects: 0 }, null, 2) + "\n");
  await writeFile(nativeReceiptPath, body, { flag: "wx" });
  const after = await loadVerifiedRemediationFreeze();
  if (after.sha256 !== freeze.sha256 || hash(await readFile(resolve(directory, compiler.name))) !== compiler.sha256 || hash(await readFile(resolve(directory, audit.name))) !== audit.sha256) throw Error("Qualification evidence changed during preflight");
  return { sourceManifestHash: freeze.sha256, canonicalLedgerHash, nativeReceiptHash: hash(body), nativeReceiptPath,
    compilerReceiptHash: compiler.sha256, auditReceiptHash: audit.sha256, auditPassed: audit.qualifyingExitCode === 0,
    scope: "ISOLATED_CANONICAL_SQL_GRANTS_DENIAL_PREFLIGHT_ONLY" };
}
