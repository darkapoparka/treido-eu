import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { inTransaction, type SellerDatabase } from "../../apps/web/src/server/db/database";
import type { VerifiedIdentity } from "../../apps/web/src/server/identity/clerk.server";
import { inputHash } from "../../apps/web/src/features/sellers/persistence.server";
import { changeClosure } from "../../apps/web/src/features/account-closure/commands.server";
import { actorKey, approvedBinding, approvedPolicy } from "../../apps/web/src/features/account-closure/storage.server";
import { readObligations } from "../../apps/web/src/features/account-closure/obligations.server";
import { createPublicationFixture } from "../../apps/web/tests/fixtures/publication-flow";
import { changeInventory } from "../../apps/web/src/features/inventory/commands.server";
import { publishListing } from "../../apps/web/src/features/selling/publish.server";
import { allocateInventory } from "../../apps/web/src/features/inventory/allocations.server";
import { createLifecycleActor, createLifecycleRegistry, createLifecyclePlan } from "./lifecycle-fixture";

/** Registered in remediation.integration.ts; execution awaits the actual expanded canonical freeze.
 * Additional actors and approval-shaped registries are synthetic, owned native
 * fixtures. Recent proof is only the caller's known-object test adapter. No real
 * Clerk/session, shared policy, media DELETE or financial/provider call occurs.
 * Missing extension facts must fail; this suite never supplies zero-count stubs. */
export function defineClosureBoundaryPersistenceCases(get: () => {
  database: SellerDatabase; admin: Pool;
  identities: [VerifiedIdentity, VerifiedIdentity]; registerRecent: (identity: VerifiedIdentity) => void;
}) {
  const actor = () => createLifecycleActor(get());
  const registry = (futurePolicy = false, futureBinding = false) => createLifecycleRegistry(get(), { futurePolicy, futureBinding });
  type Actor = Awaited<ReturnType<typeof actor>>;
  type Registry = Awaited<ReturnType<typeof registry>>;
  const plan = (owner: Actor, rules: Registry) => createLifecyclePlan(get(), owner, rules);
  const snapshot = async (owner: Actor, planId: string) => (await get().admin.query<{ value: unknown }>(
    "SELECT jsonb_build_object('user',to_jsonb(u),'plan',to_jsonb(p),'request',to_jsonb(r)) AS value FROM treido.users u JOIN treido.account_execution_plans p ON p.user_id=u.id JOIN treido.account_closure_requests r ON r.user_id=u.id AND r.id=p.closure_request_id WHERE u.id=$1 AND p.id=$2", [owner.userId, planId])).rows[0].value;
  const acceptSql = (owner: Actor, prepared: { id: string; hash: string }) => get().database.pool.query(
    "SELECT treido.account_accept_closure($1::uuid,$2::uuid,$3::text,$4::uuid)", [owner.userId, prepared.id, prepared.hash, randomUUID()]);
  describe("T61 native closure ownership, future approvals and obligation boundaries", () => {
    it("future policy is denied by both source registry read and native acceptance with zero account/plan mutation", async () => {
      const owner = await actor(), rules = await registry(true, false), prepared = await plan(owner, rules);
      await expect(inTransaction(get().database, tx => approvedPolicy(tx, rules.policyId))).rejects.toMatchObject({ code: "POLICY_REQUIRED" });
      const before = await snapshot(owner, prepared.id);
      await expect(acceptSql(owner, prepared)).rejects.toMatchObject({ code: "55000" });
      expect(await snapshot(owner, prepared.id)).toEqual(before);
    });
    it("future binding is denied by read, native acceptance and standalone session-effect claim before any attempt", async () => {
      const owner = await actor(), rules = await registry(false, true), prepared = await plan(owner, rules);
      await expect(inTransaction(get().database, tx => approvedBinding(tx, rules.bindingId))).rejects.toMatchObject({ code: "BINDING_REQUIRED" });
      const before = await snapshot(owner, prepared.id);
      await expect(acceptSql(owner, prepared)).rejects.toMatchObject({ code: "55000" });
      expect(await snapshot(owner, prepared.id)).toEqual(before);
      const id = randomUUID(), target = { sessionId: "SYNTHETIC-LOCAL-SESSION" };
      await get().admin.query("INSERT INTO treido.account_lifecycle_effects(id,user_id,binding_id,subject,kind,target,target_hash,operation_key,due_at) VALUES($1,$2,$3,$4,'session.revoke',$5::jsonb,$6,$7,clock_timestamp())",
        [id, owner.userId, rules.bindingId, owner.identity.subject, JSON.stringify(target), inputHash(target), randomUUID()]);
      const effectBefore = (await get().admin.query("SELECT * FROM treido.account_lifecycle_effects WHERE id=$1", [id])).rows[0];
      await expect(get().database.pool.query("SELECT treido.account_claim_effect($1::uuid,$2::uuid,NULL::uuid,NULL::uuid)", [id, randomUUID()])).rejects.toMatchObject({ code: "55000" });
      expect((await get().admin.query("SELECT * FROM treido.account_lifecycle_effects WHERE id=$1", [id])).rows[0]).toEqual(effectBefore);
    });
    it("foreign plan cancellation cannot mutate the owner; exact own cancellation replays only its immutable receipt", async () => {
      const owner = await actor(), foreign = await actor(), rules = await registry(), prepared = await plan(owner, rules);
      const before = await snapshot(owner, prepared.id);
      const command = (who: Actor) => ({ version: 1, actorKey: actorKey(who.identity), expectedRevision: 0, requestId: randomUUID(), operation: { kind: "cancel", planId: prepared.id } });
      await expect(changeClosure(get().database, foreign.identity, command(foreign))).rejects.toMatchObject({ code: "23514" });
      expect(await snapshot(owner, prepared.id)).toEqual(before);
      const ownCommand = command(owner), acknowledgement = await changeClosure(get().database, owner.identity, ownCommand);
      expect(acknowledgement.acknowledgment).toMatchObject({ kind: "cancel", state: "cancelled", resourceId: prepared.id });
      const cancelled = await snapshot(owner, prepared.id);
      expect((await changeClosure(get().database, owner.identity, ownCommand)).replayed).toBe(true);
      expect(await snapshot(owner, prepared.id)).toEqual(cancelled);
      expect((await get().admin.query("SELECT status FROM treido.users WHERE id=$1", [owner.userId])).rows[0].status).toBe("active");
    });
    it("unknown registered assistant media with an active writer remains an actual obligation and prevents a plan", async () => {
      const owner = await actor(), rules = await registry(), assetId = randomUUID(), policyId = randomUUID(), scope = "b".repeat(64);
      // Known bounded local fixture metadata only. No real asset or media effect.
      const config = { version: 1, budgetCurrency: "USD" };
      await get().admin.query("INSERT INTO treido.assistant_runtime_policies(id,application_id,environment,purpose,config,approved_at) VALUES($1,'app_T61ClosureMedia','test','shopping-input-v1',$2::jsonb,clock_timestamp())", [policyId, JSON.stringify(config)]);
      const key = "SYNTHETIC/assistant/" + owner.userId + "/" + assetId;
      await get().admin.query("WITH deadline AS (SELECT clock_timestamp() AS at) INSERT INTO treido.assistant_media_assets(id,user_id,mode,policy_id,input_hash,expected_bytes,content_type,expected_checksum,storage_scope,staging_key,state,expires_at,write_until) SELECT $1,$2,'photo',$3,$4,128,'image/webp',$4,$5,$6,'unknown',at+interval '20 minutes',at+interval '30 minutes' FROM deadline", [assetId, owner.userId, policyId, "b".repeat(64), scope, key]);
      await get().admin.query("INSERT INTO treido.assistant_media_objects(storage_scope,object_key,user_id,asset_id,kind,write_until,retain_until,state) SELECT $1,$2,$3,$4,'staging',write_until,write_until,'tracked' FROM treido.assistant_media_assets WHERE id=$4", [scope, key, owner.userId, assetId]);
      const facts = await inTransaction(get().database, tx => readObligations(tx, owner.userId));
      expect(facts.assistantRuns + facts.mediaWriters).toBeGreaterThan(0);
      await expect(plan(owner, rules)).rejects.toMatchObject({ code: "OBLIGATIONS_HELD" });
      expect((await get().admin.query("SELECT count(*)::int AS n FROM treido.account_execution_plans WHERE user_id=$1", [owner.userId])).rows[0].n).toBe(0);
      expect((await get().admin.query("SELECT state FROM treido.assistant_media_assets WHERE id=$1", [assetId])).rows[0].state).toBe("unknown");
    });
    it("a real inventory allocation appearing after review blocks acceptance and retains immutable financial/allocation evidence", async () => {
      const owner = await actor(), rules = await registry(), prepared = await plan(owner, rules), client = await get().admin.connect();
      let fixture: Awaited<ReturnType<typeof createPublicationFixture>>;
      try { fixture = await createPublicationFixture({ database: get().database, admin: client, owner: get().identities[0] }, "business"); }
      finally { client.release(); }
      const stock = await changeInventory(get().database, get().identities[0], { sellerId: fixture.sellerId, listingId: fixture.draft.id, requestId: randomUUID(), expectedRevision: 0,
        operation: { kind: "setup", mode: "unique", onHand: 1, sellerSku: "T61-closure-financial-hold" } });
      const publication = await publishListing(get().database, get().identities[0], { ...fixture.input, expectedRevision: stock.listingRevision });
      const allocation = await inTransaction(get().database, tx => allocateInventory(tx, { sellerId: fixture.sellerId, buyerId: owner.userId, actorId: owner.userId,
        purpose: "checkout", sourceId: randomUUID(), lines: [{ listingId: fixture.draft.id, skuId: stock.skuId, publicationRevision: publication.revision, quantity: 1, unitPriceMinor: 12900 }] }));
      // This is original internal inventory allocation, not a real payable quote
      // or checkout/payment authorization/provider acceptance.
      expect((await inTransaction(get().database, tx => readObligations(tx, owner.userId))).allocations).toBe(1);
      const before = await snapshot(owner, prepared.id);
      const held = (await get().admin.query("SELECT * FROM treido.inventory_allocations WHERE id=$1", [allocation.id])).rows[0];
      await expect(acceptSql(owner, prepared)).rejects.toMatchObject({ code: "55000" });
      expect(await snapshot(owner, prepared.id)).toEqual(before);
      expect((await get().admin.query("SELECT * FROM treido.inventory_allocations WHERE id=$1", [allocation.id])).rows[0]).toEqual(held);
      expect(held.state).toBe("active");
    });
  });
}
