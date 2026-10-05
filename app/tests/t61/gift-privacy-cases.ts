import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { SellerDatabase } from "../../apps/web/src/server/db/database";
import type { VerifiedIdentity } from "../../apps/web/src/server/identity/clerk.server";
import { PRIVACY_LIMITS, type PersonalSnapshot } from "../../apps/web/src/features/account-privacy/model";
import { projectExport } from "../../apps/web/src/features/account-privacy/projections.server";
import { buildSnapshot } from "../../apps/web/src/features/account-privacy/snapshot";
import { changePrivacy } from "../../apps/web/src/features/account-privacy/commands.server";
import { readPrivacy, readPrivateDownload } from "../../apps/web/src/features/account-privacy/queries.server";
import { readGift, changeGift } from "../../apps/web/src/features/gift-finder/commands.server";
import { parseGiftBrief } from "../../apps/web/src/features/gift-finder/model";
import type { ToolListing } from "../../apps/web/src/features/shopping-tools/model";
import { reviewedCriteria } from "../../apps/web/src/features/saved-searches/model";
import { parseToolIntent } from "../../apps/web/src/features/shopping-tools/intent";
import { inputHash } from "../../apps/web/src/features/sellers/persistence.server";

/** Called in the SAME isolated bootstrap after exactly0001–0029 and before0030.
 * Actual SQL/projection on its privileged fixture client, not runtime-grant or
 * Clerk acceptance. It must never run on a shared development connection.
 */
export async function capturePreGiftPrivacyExport(client: PoolClient) {
  const ledger = (await client.query("SELECT count(*)::int AS n FROM public.treido_schema_migrations")).rows[0].n;
  const gift = (await client.query("SELECT to_regclass('treido.buyer_gift_workspaces') AS workspace,to_regclass('treido.buyer_gift_observations') AS observations,to_regclass('treido.buyer_gift_receipts') AS receipts")).rows[0];
  const measurement = (await client.query("SELECT to_regclass('treido.promotion_measurement_choices') AS relation")).rows[0].relation;
  if (ledger !== 29 || Object.values(gift).some(value => value !== null) || measurement !== null) throw Error("Pre-Gift evidence requires actual29-migration schema and absent optional Gift/measurement relations");
  const userId = randomUUID();
  await client.query("INSERT INTO treido.users(id,clerk_subject) VALUES($1,'user_t61_before_gift_export')", [userId]);
  const foreignId = randomUUID(), searchId = randomUUID(), foreignSearchId = randomUUID();
  await client.query("INSERT INTO treido.users(id,clerk_subject) VALUES($1,'user_t61_before_gift_foreign')", [foreignId]);
  const criteria = reviewedCriteria(parseToolIntent("q=T61legacyOwn&seller=business", "find-for-me"), "find-for-me");
  for (const [human, search, name] of [[userId, searchId, "T61 legacy own"], [foreignId, foreignSearchId, "T61 legacy foreign"]]) {
    await client.query("INSERT INTO treido.buyer_saved_searches(id,user_id,name,status,criteria_version,frequency_minutes) VALUES($1,$2,$3,'paused',1,60)", [search, human, name]);
    await client.query("INSERT INTO treido.buyer_saved_search_versions(user_id,search_id,version,criteria) VALUES($1,$2,1,$3::jsonb)", [human, search, JSON.stringify(criteria)]);
  }
  const sections = await projectExport(client, userId, ["account", "searches"]);
  const snapshot = buildSnapshot(userId, new Date().toISOString(), sections);
  return { ledger, gift, measurement, userId, snapshot, searchId, foreignId, foreignSearchId, criteria };
}
type AbsenceEvidence = Awaited<ReturnType<typeof capturePreGiftPrivacyExport>>;
/** Prepared only; register after root's actual optional-export contract and all
 * original owner/storage freeze. Known fixture identity refs receive synthetic
 * recent-auth evidence from the caller, never a real session claim.
 */
export function defineGiftPrivacyPersistenceCases(get: () => {
  database: SellerDatabase; admin: Pool; runtime: Pool; facts: ToolListing[];
  identities: [VerifiedIdentity, VerifiedIdentity]; userIds: [string, string];
  preGiftEvidence: AbsenceEvidence;
}) {
  describe("T61 own Gift privacy export on real isolated PostgreSQL", () => {
    it("actual pre0030 optional absence preserves bounded legacy account/search export", () => {
      const { ledger, gift, measurement, userId, snapshot, searchId, foreignId, foreignSearchId, criteria } = get().preGiftEvidence;
      expect(ledger).toBe(29);
      expect(gift).toEqual({ workspace: null, observations: null, receipts: null });
      expect(measurement).toBeNull();
      expect(snapshot.accountId).toBe(userId);
      expect(snapshot.sections.find(section => section.category === "account")?.records).toEqual([
        expect.objectContaining({ id: userId, status: "active" }),
      ]);
      expect(snapshot.sections.find(section => section.category === "searches")?.records).toEqual([
        expect.objectContaining({ kind: "savedSearch", id: searchId, name: "T61 legacy own", status: "paused", version: 1, criteriaMode: criteria.mode, criteriaRegistry: criteria.registry, criteriaQuery: criteria.query }),
      ]);
      expect(JSON.stringify(snapshot)).not.toContain("user_t61_before_gift_export");
      expect(JSON.stringify(snapshot)).not.toContain(foreignId);
      expect(JSON.stringify(snapshot)).not.toContain(foreignSearchId);
      expect(JSON.stringify(snapshot)).not.toContain("T61 legacy foreign");
      expect(Buffer.byteLength(JSON.stringify(snapshot))).toBeLessThanOrEqual(PRIVACY_LIMITS.bytes);
      for (const section of snapshot.sections) expect(section.records.length).toBeLessThanOrEqual(PRIVACY_LIMITS.rows);
    });
    it("own Gift and latest measurement-choice fixtures are exported; foreign state and download are excluded", async () => {
      const { database, admin, runtime, identities, userIds, facts } = get();
      // Synthetic isolated policy/choice fixtures qualify the export projection,
      // not a real policy approval, consent UI/command or external measurement.
      const policies = [randomUUID(), randomUUID()];
      const choices: { requestId: string; hash: string; previous: string }[] = [];
      const insertChoice = async (i: number, allowed: boolean, revision: number) => {
        const requestId = randomUUID(), hash = inputHash({ fixture: "T61 export only", userId: userIds[i], policyId: policies[i], allowed, revision });
        await runtime.query("INSERT INTO treido.promotion_measurement_choices(user_id,policy_id,request_id,allowed,revision,input_hash) VALUES($1,$2,$3,$4,$5,$6)", [userIds[i], policies[i], requestId, allowed, revision, hash]);
        return { requestId, hash };
      };
      for (let i = 0; i < 2; i++) {
        await admin.query(`INSERT INTO treido.promotion_measurement_policies
          (id,version,policy_version,environment,application_id,retention_days,consent_rule,event_definition,text,approval_reference,approved_at)
          VALUES($1,$2,'visible-v1','test','app_t61_measurement_fixture',7,'explicit_promotion_measurement_opt_in',
          '{"ratio":0.5,"continuousMilliseconds":1000,"foreground":true,"click":"product_anchor"}'::jsonb,
          '{"bg":"СИНТЕТИЧНА ПОЛИТИКА","en":"SYNTHETIC T61 FIXTURE POLICY"}'::jsonb,
          'T61 ISOLATED FIXTURE ONLY; NO REAL APPROVAL',clock_timestamp())`, [policies[i], i + 1]);
        const previous = (await insertChoice(i, i === 0, 1)).requestId;
        choices.push({ ...await insertChoice(i, i !== 0, 2), previous });
      }
      const requestIds: string[][] = [[], []];
      const briefs = [
        parseGiftBrief({ version: 1, occasion: "birthday", age: "adult", neededBy: null, criteria: "category=cat%3Aelectronics%2Fphones&maxPrice=200&currency=EUR" }),
        parseGiftBrief({ version: 1, occasion: "thanks", age: "teen", neededBy: null, criteria: "category=cat%3Aelectronics%2Fphones&maxPrice=177.11&currency=EUR" }),
      ];
      for (let i = 0; i < 2; i++) {
        const view = await readGift(database, identities[i]);
        requestIds[i].push(randomUUID());
        await changeGift(database, identities[i], { actorKey: view.actorKey, expectedRevision: view.revision, requestId: requestIds[i][0], operation: { kind: "find", brief: briefs[i], confirmed: true } });
        const found = await readGift(database, identities[i]);
        expect(found.items.some(item => item.listingId === facts[i].card.id)).toBe(true);
        requestIds[i].push(randomUUID());
        await changeGift(database, identities[i], { actorKey: view.actorKey, expectedRevision: found.revision, requestId: requestIds[i][1], operation: { kind: "choose", listingIds: [facts[i].card.id] } });
      }
      const exported = [];
      for (let i = 0; i < 2; i++) {
        const view = await readPrivacy(database, identities[i]);
        const command = { version: 1, actorKey: view.actorKey, expectedRevision: view.revision, requestId: randomUUID(), operation: { kind: "export", categories: ["searches"] } };
        const result = await changePrivacy(database, identities[i], command);
        const body = await readPrivateDownload(database, identities[i], result.acknowledgment.resourceId, view.actorKey);
        const snapshot = JSON.parse(body) as PersonalSnapshot;
        expect(snapshot.accountId).toBe(userIds[i]);
        const records = snapshot.sections.find(section => section.category === "searches")!.records;
        const measurement = records.filter(row => row.kind === "promotionMeasurementChoice");
        expect(measurement).toHaveLength(1);
        expect(measurement[0]).toMatchObject({ id: choices[i].requestId, status: i === 0 ? "paused" : "enabled", version: 2, operation: "choice", inputHash: choices[i].hash });
        expect(JSON.parse(String(measurement[0].context))).toEqual({ policyId: policies[i], allowed: i !== 0 });
        expect(Number.isFinite(Date.parse(String(measurement[0].recordedAt)))).toBe(true);
        for (const hidden of [choices[i].previous, choices[1 - i].requestId, choices[1 - i].hash, policies[1 - i], "SYNTHETIC T61 FIXTURE POLICY"]) expect(body).not.toContain(hidden);
        for (const forbidden of ["metrics", "providerPayload", "sellerId", "approvalReference", "policyText"]) expect(measurement[0]).not.toHaveProperty(forbidden);
        const workspace = records.find(row => row.kind === "giftWorkspace")!;
        expect(workspace.id).toBe(userIds[i]);
        expect(JSON.parse(String(workspace.context))).toEqual(briefs[i]);
        expect(workspace.selection).toBe(facts[i].card.id);
        expect(workspace.version).toBe((await readGift(database, identities[i])).revision);
        const observations = records.filter(row => row.kind === "giftObservation");
        expect(observations).toHaveLength(2);
        for (const fact of facts) expect(observations).toContainEqual(expect.objectContaining({ listingId: fact.card.id, publicationRevision: fact.revision, skuId: fact.variant?.id ?? null }));
        const receipts = records.filter(row => row.kind === "giftReceipt");
        expect(receipts.map(row => row.id).sort()).toEqual([...requestIds[i]].sort());
        expect(receipts.map(row => row.operation).sort()).toEqual(["choose", "find"]);
        for (const receipt of receipts) {
          expect(receipt.inputHash).toMatch(/^[a-f0-9]{64}$/);
          expect(receipt.version).toBeGreaterThan(0);
          expect(Number.isFinite(Date.parse(String(receipt.recordedAt)))).toBe(true);
        }
        for (const requestId of requestIds[i]) expect(body).toContain(requestId);
        for (const requestId of requestIds[1 - i]) expect(body).not.toContain(requestId);
        expect(body).not.toContain(userIds[1 - i]);
        expect(body).not.toContain(identities[i].subject);
        expect(body).not.toContain(identities[1 - i].subject);
        expect(body).not.toContain("input_hash");
        expect(body).not.toContain("next_cursor");
        for (const record of records) {
          for (const forbidden of ["title", "snapshot", "media", "derivativeKey", "providerPayload", "nextCursor", "sellerId"]) expect(record).not.toHaveProperty(forbidden);
        }
        expect(Buffer.byteLength(body)).toBeLessThanOrEqual(PRIVACY_LIMITS.bytes);
        for (const section of snapshot.sections) expect(section.records.length).toBeLessThanOrEqual(PRIVACY_LIMITS.rows);
        const changedChoice = await insertChoice(i, i === 0, 3);
        const client = await runtime.connect();
        try {
          const current = (await projectExport(client, userIds[i], ["searches"]))[0].records;
          expect(current.filter(row => row.kind === "promotionMeasurementChoice")).toEqual([
            expect.objectContaining({ id: changedChoice.requestId, status: i === 0 ? "enabled" : "paused", version: 3 }),
          ]);
        } finally { client.release(); }
        const replay = await changePrivacy(database, identities[i], command);
        expect(replay).toMatchObject({ acknowledgment: result.acknowledgment, replayed: true });
        expect(await readPrivateDownload(database, identities[i], result.acknowledgment.resourceId, view.actorKey)).toBe(body);
        exported.push({ body, id: result.acknowledgment.resourceId });
      }
      const foreign = await readPrivacy(database, identities[1]);
      await expect(readPrivateDownload(database, identities[1], exported[0].id, foreign.actorKey)).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(exported[0].body).toContain(facts[0].card.id);
      expect(exported[0].body).not.toContain("177.11");
    });
  });
}
