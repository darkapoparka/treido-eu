import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Pool } from "pg";
import { startNativeCluster } from "./native-cluster.mjs";
const auth = vi.hoisted(() => ({ recent: new WeakSet<object>() }));
// Only registered isolated fixture objects receive synthetic recent-auth evidence.
// No Clerk client, session, browser credential or shared environment is used.
vi.mock("../../apps/web/src/server/identity/clerk.server", () => ({
  hasVerifiedRecentAuthentication: (identity: object) => auth.recent.has(identity),
}));
import { createDatabase, inTransaction, type SellerDatabase } from "../../apps/web/src/server/db/database";
import { ensurePersonalSeller, inputHash } from "../../apps/web/src/features/sellers/persistence.server";
import { createListingDraft, readListingDraft } from "../../apps/web/src/features/selling/drafts.server";
import { emptyDraft } from "../../apps/web/src/features/selling/draft-model";
import { createPublicationFixture } from "../../apps/web/tests/fixtures/publication-flow";
import { publishListing } from "../../apps/web/src/features/selling/publish.server";
import { readToolFacts } from "../../apps/web/src/features/shopping-tools/catalogue.server";
import { observe, type ToolListing } from "../../apps/web/src/features/shopping-tools/model";
import { readComparison, changeComparison } from "../../apps/web/src/features/shopping-tools/comparison.server";
import { readSavedSearches } from "../../apps/web/src/features/saved-searches/queries.server";
import { changeSavedSearch } from "../../apps/web/src/features/saved-searches/commands.server";
import { reviewedCriteria } from "../../apps/web/src/features/saved-searches/model";
import { parseToolIntent } from "../../apps/web/src/features/shopping-tools/intent";
import { processSavedSearchJob } from "../../apps/web/src/features/saved-searches/jobs.server";
import { jobColumns, type BuyerJobRow } from "../../apps/web/src/server/jobs/outbox.server";
import { executeJob } from "../../apps/web/src/server/jobs/execution.server";
import { readCompatibility, changeCompatibility } from "../../apps/web/src/features/assistant-tools/compatibility.server";
import { snapshotCompatibility } from "../../apps/web/src/features/assistant-tools/compatibility-model";
import { readSellHelper, changeSellHelper } from "../../apps/web/src/features/assistant-tools/sell-helper.server";
import { editableDraft } from "../../apps/web/src/features/assistant-tools/sell-helper-model";
import { definePrivacyIntegrationCases } from "../../apps/web/src/features/account-privacy/integration-cases";
import { readPrivacy, readPrivateDownload } from "../../apps/web/src/features/account-privacy/queries.server";
import { changePrivacy } from "../../apps/web/src/features/account-privacy/commands.server";
import { applyReviewedMigration } from "../../apps/web/scripts/identity-draft-migration.mjs";
import { defineGiftPersistenceCases } from "./gift-cases";
import { capturePreGiftPrivacyExport, defineGiftPrivacyPersistenceCases } from "./gift-privacy-cases";
import { definePromotionPersistenceCases } from "./promotion-cases";
import { defineBillingPersistenceCases } from "./billing-cases";

const identities = [{ subject: "user_t61_owner" }, { subject: "user_t61_other" }] as const;
let native: Awaited<ReturnType<typeof startNativeCluster>>;
let database: SellerDatabase;
let admin: Pool;
let userIds: [string, string];
let facts: ToolListing[];
let sellerId: string;
let draft: Awaited<ReturnType<typeof readListingDraft>>;
let preGiftEvidence: Awaited<ReturnType<typeof capturePreGiftPrivacyExport>>;
beforeAll(async () => {
  native = await startNativeCluster({ afterBaseMigrations: async (client: Parameters<typeof capturePreGiftPrivacyExport>[0]) => {
    preGiftEvidence = await capturePreGiftPrivacyExport(client);
  } });
  admin = native.admin;
  database = createDatabase(native.runtime);
  for (const actor of identities) {
    auth.recent.add(actor);
    await ensurePersonalSeller(database, actor);
  }
  userIds = await Promise.all(identities.map(async actor =>
    (await admin.query("SELECT id FROM treido.users WHERE clerk_subject=$1", [actor.subject])).rows[0].id,
  )) as [string, string];
  await admin.query("UPDATE treido.category_policies SET state='reviewed',enabled_for_publish=true,review_reference='SYNTHETIC T61 TEST ONLY',reviewed_at=now() WHERE category_id='cat:electronics/phones' AND version=1");
  const client = await admin.connect();
  const ids: string[] = [];
  try {
    for (let i = 0; i < 2; i++) {
      const fixture = await createPublicationFixture({ database, admin: client, owner: identities[0] }, "business", sellerId);
      sellerId = fixture.sellerId;
      await publishListing(database, identities[0], fixture.input);
      ids.push(fixture.draft.id);
    }
  } finally { client.release(); }
  const catalogueClient = await admin.connect();
  try { facts = [...(await readToolFacts({ client: catalogueClient }, ids)).values()]; }
  finally { catalogueClient.release(); }
  expect(facts).toHaveLength(2);
  const created = await createListingDraft(database, identities[0], {
    sellerId, requestId: randomUUID(), payload: { ...emptyDraft, title: "Synthetic seller facts", description: "Test-only facts", categoryId: "cat:electronics/phones", condition: "good", currency: "EUR", priceMinor: 12900, locality: "София", fields: { brand: "Apple", model: "iPhone", storageGB: "128", workingStatus: "working" } },
  });
  draft = await readListingDraft(database, identities[0], sellerId, created.id);
});
afterAll(async () => { await native?.stop(); });

describe("T61 actual native PostgreSQL persistence and authority", () => {
  it("comparison/search/compatibility/privacy reads never provision an unknown human", async () => {
    const actor = { subject: "user_t61_read_only" };
    auth.recent.add(actor);
    expect((await readComparison(database, actor)).items).toEqual([]);
    expect((await readSavedSearches(database, actor)).searches).toEqual([]);
    expect((await readCompatibility(database, actor)).items).toEqual([]);
    expect((await readPrivacy(database, actor)).registrationNeeded).toBe(true);
    expect((await admin.query("SELECT count(*)::int AS n FROM treido.users WHERE clerk_subject=$1", [actor.subject])).rows[0].n).toBe(0);
  });
  it("installs exact original33 and frozen additional checksum receipts, replays unchanged SQL, and rolls back invalid DDL", async () => {
    const receipts = async () => (await admin.query<{ version: string; checksum: string }>("SELECT version,checksum FROM public.treido_schema_migrations ORDER BY version")).rows;
    const expected = native.state.expectedMigrations.map(row => ({ version: row.file.slice(0, -4), checksum: row.sha256 }));
    const before = await receipts();
    expect(before.filter(row => Number(row.version.slice(0, 4)) <= 33)).toHaveLength(33);
    expect(before.slice(0, 33)).toEqual(expected.slice(0, 33));
    expect(before).toEqual(expected);
    expect(native.state.migrations).toEqual(native.state.expectedMigrations);
    expect((await admin.query("SELECT count(*)::int AS n FROM public.treido_schema_migrations")).rows[0].n).toBe(expected.length);
    const client = await admin.connect();
    try {
      for (const row of [native.state.migrations[32], ...native.state.migrations.slice(33)]) {
        const source = await readFile(resolve("apps/web/migrations", row.file), "utf8");
        expect(await applyReviewedMigration(client, row.file.slice(0, -4), source)).toBe("already-applied");
        await expect(applyReviewedMigration(client, row.file.slice(0, -4), source + "\n-- changed")).rejects.toThrow("Applied migration checksum differs. Create a new migration.");
      }
      await expect(applyReviewedMigration(client, "9999_t61_rollback", "CREATE TABLE treido.t61_rollback(id int); SELECT definitely_missing_t61();")).rejects.toThrow();
    } finally { client.release(); }
    expect((await admin.query("SELECT to_regclass('treido.t61_rollback') AS relation")).rows[0].relation).toBeNull();
    expect((await admin.query("SELECT count(*)::int AS n FROM public.treido_schema_migrations")).rows[0].n).toBe(expected.length);
    expect(await receipts()).toEqual(before);
  });

  it("comparison duplicate race stores one selection/receipt; replay after removal does not restore it", async () => {
    const actor = identities[0];
    const view = await readComparison(database, actor);
    const command = { actorKey: view.actorKey, expectedRevision: view.revision, requestId: randomUUID(), operation: { kind: "add", observation: observe(facts[0]) } };
    const results = await Promise.all([changeComparison(database, actor, command), changeComparison(database, actor, command)]);
    expect(results.filter(result => result.replayed)).toHaveLength(1);
    expect(new Set(results.map(result => result.selectionId)).size).toBe(1);
    const saved = await readComparison(database, actor);
    expect(saved.items).toHaveLength(1);
    await changeComparison(database, actor, { actorKey: view.actorKey, expectedRevision: saved.revision, requestId: randomUUID(), operation: { kind: "remove", selectionId: saved.items[0].id } });
    expect((await changeComparison(database, actor, command)).replayed).toBe(true);
    expect((await readComparison(database, actor)).items).toHaveLength(0);
    expect((await admin.query("SELECT count(*)::int AS n FROM treido.buyer_comparison_receipts WHERE user_id=$1 AND request_id=$2", [userIds[0], command.requestId])).rows[0].n).toBe(1);
    await expect(changeComparison(database, actor, { ...command, operation: { kind: "add", observation: observe(facts[1]) } })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(changeComparison(database, identities[1], command)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("two different comparison commands at one revision commit only one and leave no partial receipt", async () => {
    const view = await readComparison(database, identities[0]);
    const commands = facts.map(fact => ({ actorKey: view.actorKey, expectedRevision: view.revision, requestId: randomUUID(), operation: { kind: "add", observation: observe(fact) } }));
    const results = await Promise.allSettled(commands.map(command => changeComparison(database, identities[0], command)));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find(result => result.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ code: "CONFLICT" });
    expect((await readComparison(database, identities[0])).revision).toBe(view.revision + 1);
    expect((await admin.query("SELECT count(*)::int AS n FROM treido.buyer_comparison_receipts WHERE user_id=$1 AND request_id=ANY($2::uuid[])", [userIds[0], commands.map(command => command.requestId)])).rows[0].n).toBe(1);
  });

  it("runtime cannot rewrite immutable receipts or the migration ledger", async () => {
    await expect(native.runtime.query("UPDATE treido.buyer_comparison_receipts SET accepted_revision=999 WHERE user_id=$1", [userIds[0]])).rejects.toMatchObject({ code: "42501" });
    await expect(native.runtime.query("UPDATE public.treido_schema_migrations SET checksum=repeat('a',64)")).rejects.toMatchObject({ code: "42501" });
    await expect(native.runtime.query("UPDATE treido.account_privacy_receipts SET accepted_revision=999")).rejects.toMatchObject({ code: "42501" });
  });

  it("saved-search duplicate race creates one version/run/job; pausing revokes queued work", async () => {
    const actor = identities[0], view = await readSavedSearches(database, actor);
    const command = { actorKey: view.actorKey, expectedRevision: view.revision, requestId: randomUUID(), operation: { kind: "save", name: "T61 synthetic phones", criteria: reviewedCriteria(parseToolIntent("category=cat%3Aelectronics%2Fphones", "find-for-me"), "find-for-me"), enable: true, frequency: 60 } };
    const results = await Promise.all([changeSavedSearch(database, actor, command), changeSavedSearch(database, actor, command)]);
    expect(results.filter(result => result.replayed)).toHaveLength(1);
    const saved = await readSavedSearches(database, actor);
    expect(saved.searches).toHaveLength(1);
    const run = (await admin.query("SELECT id FROM treido.buyer_saved_search_runs WHERE user_id=$1", [userIds[0]])).rows[0];
    const job = (await admin.query<BuyerJobRow>(`SELECT ${jobColumns} FROM treido.outbox_jobs WHERE resource_id=$1`, [run.id])).rows[0];
    expect(job.kind).toBe("buyer.saved-search");
    await changeSavedSearch(database, actor, { actorKey: view.actorKey, expectedRevision: saved.revision, requestId: randomUUID(), operation: { kind: "pause", searchId: saved.searches[0].id } });
    const effect = await processSavedSearchJob(database, { ...job, executionToken: randomUUID() });
    await expect(inTransaction(database, async tx => { await effect.lock!(tx); await effect.apply!(tx); })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await admin.query("SELECT count(*)::int AS n FROM treido.buyer_search_notifications WHERE user_id=$1", [userIds[0]])).rows[0].n).toBe(0);
    expect((await changeSavedSearch(database, actor, command)).replayed).toBe(true);
    expect((await readSavedSearches(database, actor)).searches[0].status).toBe("paused");
  });

  it("compatibility concurrent exact retry stores one snapshot, foreign actor and forged facts roll back", async () => {
    const actor = identities[0], view = await readCompatibility(database, actor);
    const command = { actorKey: view.actorKey, expectedRevision: view.revision, requestId: randomUUID(), operation: { kind: "check", requirements: { categoryId: "cat:electronics/phones", fields: [{ field: "brand", operator: "equal", value: "Apple" }] }, snapshots: [snapshotCompatibility(facts[0])] } };
    const results = await Promise.all([changeCompatibility(database, actor, command), changeCompatibility(database, actor, command)]);
    expect(results.filter(result => result.replayed)).toHaveLength(1);
    const saved = await readCompatibility(database, actor);
    expect(saved.items).toHaveLength(1);
    expect(saved.items[0].evidence[0].outcome).toBe("agreement");
    await expect(changeCompatibility(database, identities[1], command)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(changeCompatibility(database, actor, { ...command, expectedRevision: saved.revision, requestId: randomUUID(), operation: { ...command.operation, snapshots: [{ ...snapshotCompatibility(facts[1]), attributes: { ...facts[1].attributes, brand: "Sony" } }] } })).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await readCompatibility(database, actor)).revision).toBe(saved.revision);
  });

  it("saved-search executor persists current observations once and exact completed replay creates no duplicate matches", async () => {
    const actor = identities[1], view = await readSavedSearches(database, actor);
    const result = await changeSavedSearch(database, actor, { actorKey: view.actorKey, expectedRevision: view.revision, requestId: randomUUID(), operation: { kind: "save", name: "T61 worker fixture", criteria: reviewedCriteria(parseToolIntent("category=cat%3Aelectronics%2Fphones", "find-for-me"), "find-for-me"), enable: true, frequency: 60 } });
    const run = (await admin.query("SELECT id FROM treido.buyer_saved_search_runs WHERE user_id=$1 AND search_id=$2", [userIds[1], result.searchId])).rows[0];
    const job = (await admin.query<BuyerJobRow>(`SELECT ${jobColumns} FROM treido.outbox_jobs WHERE resource_id=$1`, [run.id])).rows[0];
    const binding = { applicationId: "treido-t61-isolated", environment: "test" };
    const event = { jobId: job.id, sellerId: null, buyerId: userIds[1], generation: job.generation, schemaVersion: 1, ...binding };
    const handlers = { "buyer.saved-search": (context: Parameters<typeof processSavedSearchJob>[1]) => processSavedSearchJob(database, context) };
    expect((await executeJob(database, event, binding, randomUUID(), handlers)).status).toBe("completed");
    const counts = async () => (await admin.query("SELECT (SELECT count(*)::int FROM treido.buyer_search_observations WHERE user_id=$1) AS observations,(SELECT count(*)::int FROM treido.buyer_search_notifications WHERE user_id=$1) AS notifications", [userIds[1]])).rows[0];
    const before = await counts();
    expect(before.observations).toBe(2);
    expect((await executeJob(database, event, binding, randomUUID(), handlers)).status).toBe("completed");
    expect(await counts()).toEqual(before);
    await changeSavedSearch(database, actor, { actorKey: view.actorKey, expectedRevision: result.revision, requestId: randomUUID(), operation: { kind: "pause", searchId: result.searchId } });
    expect((await executeJob(database, event, binding, randomUUID(), handlers)).status).toBe("cancelled");
    expect(await counts()).toEqual(before);
  });

  it("sell-helper prepare leaves draft untouched; committed ordinary save recovers after receipt failure without reapplying", async () => {
    const actor = identities[0], view = await readSellHelper(database, actor, sellerId);
    const prepare = { actorKey: view.actorKey, sellerId, expectedRevision: view.revision, requestId: randomUUID(), operation: { kind: "prepare", draftId: draft.id, expectedDraftRevision: draft.revision, baseHash: inputHash(draft.payload), edit: { ...editableDraft(draft.payload), title: "Synthetic reviewed seller title" }, confirmFacts: true } };
    await changeSellHelper(database, actor, prepare);
    expect((await readListingDraft(database, actor, sellerId, draft.id)).payload).toEqual(draft.payload);
    const staged = await readSellHelper(database, actor, sellerId), proposal = staged.proposals[0];
    const accept = { actorKey: view.actorKey, sellerId, expectedRevision: staged.revision, requestId: randomUUID(), operation: { kind: "accept", proposalId: proposal.id, proposalHash: proposal.proposalHash, expectedDraftRevision: draft.revision, confirm: true } };
    let injected = false;
    // Actual PostgreSQL connections/transactions remain intact. One transport
    // exception after the independently committed ordinary save simulates a lost acknowledgment.
    const pool = new Proxy(native.runtime, { get(target, key) {
      if (key === "connect") return async () => {
        const client = await target.connect();
        return new Proxy(client, { get(c, property) {
          if (property === "query") return (...args: unknown[]) => {
            if (!injected && typeof args[0] === "string" && args[0].startsWith("INSERT INTO treido.seller_helper_receipts")) {
              injected = true; throw Error("T61 injected acknowledgment transport failure");
            }
            return Reflect.apply(c.query, c, args);
          };
          const value = Reflect.get(c, property, c);
          return typeof value === "function" ? value.bind(c) : value;
        } });
      };
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    } }) as Pool;
    await expect(changeSellHelper(createDatabase(pool), actor, accept)).rejects.toThrow("T61 injected acknowledgment");
    expect(injected).toBe(true);
    const committed = await readListingDraft(database, actor, sellerId, draft.id);
    expect(committed.revision).toBe(draft.revision + 1);
    expect((await readSellHelper(database, actor, sellerId)).pending).toEqual(accept);
    const recovered = await changeSellHelper(database, actor, accept);
    expect(recovered).toMatchObject({ outcome: "applied", replayed: true, draftRevision: committed.revision });
    const current = await readListingDraft(database, actor, sellerId, draft.id);
    expect(current.revision).toBe(committed.revision);
    expect(current.payload).toEqual({ ...draft.payload, title: prepare.operation.edit.title });
    expect((await readSellHelper(database, actor, sellerId)).pending).toBeNull();
    expect((await admin.query("SELECT count(*)::int AS n FROM treido.draft_save_receipts WHERE seller_id=$1 AND request_id=$2", [sellerId, accept.requestId])).rows[0].n).toBe(1);
    await expect(changeSellHelper(database, identities[1], { ...accept, actorKey: (await readCompatibility(database, identities[1])).actorKey })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("an in-flight comparison waits on the current human lock then rejects committed revocation", async () => {
    const actor = identities[1], view = await readComparison(database, actor);
    const blocker = await admin.connect();
    await blocker.query("BEGIN");
    try {
      await blocker.query("UPDATE treido.users SET status='restricted' WHERE id=$1", [userIds[1]]);
      const pending = changeComparison(database, actor, { actorKey: view.actorKey, expectedRevision: view.revision, requestId: randomUUID(), operation: { kind: "add", observation: observe(facts[0]) } });
      // Attach rejection immediately; the assertion still runs after deterministic lock observation.
      const outcome = pending.then(value => ({ value }), error => ({ error }));
      const deadline = Date.now() + 3500;
      let locked = false;
      while (Date.now() < deadline) {
        const rows = await admin.query("SELECT 1 FROM pg_stat_activity WHERE datname='t61_isolated' AND usename='treido_runtime' AND wait_event_type='Lock' AND query ILIKE '%users%'");
        if (rows.rowCount) { locked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 15));
      }
      expect(locked).toBe(true);
      await blocker.query("COMMIT");
      expect(await outcome).toMatchObject({ error: { code: "FORBIDDEN" } });
      expect((await admin.query("SELECT count(*)::int AS n FROM treido.buyer_comparison_receipts WHERE user_id=$1", [userIds[1]])).rows[0].n).toBe(0);
    } finally {
      await blocker.query("ROLLBACK"); blocker.release();
      await admin.query("UPDATE treido.users SET status='active' WHERE id=$1", [userIds[1]]);
    }
  });

  it("seller helper read waits on current membership and denies committed revocation", async () => {
    const blocker = await admin.connect();
    await blocker.query("BEGIN");
    let committed = false;
    try {
      await blocker.query("UPDATE treido.seller_memberships SET status='revoked',revision=revision+1 WHERE seller_id=$1 AND user_id=$2", [sellerId, userIds[0]]);
      const outcome = readSellHelper(database, identities[0], sellerId).then(value => ({ value }), error => ({ error }));
      const deadline = Date.now() + 3500;
      let locked = false;
      while (Date.now() < deadline) {
        const rows = await admin.query("SELECT 1 FROM pg_stat_activity WHERE datname='t61_isolated' AND usename='treido_runtime' AND wait_event_type='Lock' AND query ILIKE '%seller_memberships%'");
        if (rows.rowCount) { locked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 15));
      }
      expect(locked).toBe(true);
      await blocker.query("COMMIT"); committed = true;
      expect(await outcome).toMatchObject({ error: { code: "FORBIDDEN" } });
    } finally {
      if (!committed) await blocker.query("ROLLBACK");
      blocker.release();
      await admin.query("UPDATE treido.seller_memberships SET status='active',revision=revision+1 WHERE seller_id=$1 AND user_id=$2", [sellerId, userIds[0]]);
    }
  });

  it("privacy denies missing synthetic recent evidence and expired exports retain replay only", async () => {
    const actor = identities[1], view = await readPrivacy(database, actor);
    const command = { version: 1, actorKey: view.actorKey, expectedRevision: view.revision, requestId: randomUUID(), operation: { kind: "export", categories: ["account"] } };
    auth.recent.delete(actor);
    try { expect(() => changePrivacy(database, actor, command)).toThrow("RECENT_AUTH_REQUIRED"); }
    finally { auth.recent.add(actor); }
    const exported = await changePrivacy(database, actor, command);
    await admin.query("UPDATE treido.account_privacy_exports SET created_at=clock_timestamp()-interval '15 minutes',expires_at=clock_timestamp()-interval '1 second' WHERE user_id=$1 AND id=$2", [userIds[1], exported.acknowledgment.resourceId]);
    await expect(readPrivateDownload(database, actor, exported.acknowledgment.resourceId, view.actorKey)).rejects.toMatchObject({ code: "EXPIRED" });
    expect((await changePrivacy(database, actor, command)).replayed).toBe(true);
  });
});
definePrivacyIntegrationCases(() => ({ database, admin, identities: [...identities], userIds }));
defineGiftPersistenceCases(() => ({ database, admin, runtime: native.runtime, facts }));
defineGiftPrivacyPersistenceCases(() => ({ database, admin, runtime: native.runtime, facts, identities: [identities[0], identities[1]], userIds, preGiftEvidence }));
definePromotionPersistenceCases(() => ({ database, admin, runtime: native.runtime, facts, identities: [identities[0], identities[1]], userIds, sellerId }));
defineBillingPersistenceCases(() => ({ database, admin, runtime: native.runtime, sellerId, userIds }));
