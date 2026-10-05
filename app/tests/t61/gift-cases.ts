import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { SellerDatabase } from "../../apps/web/src/server/db/database";
import { readGift, changeGift } from "../../apps/web/src/features/gift-finder/commands.server";
import { parseGiftBrief } from "../../apps/web/src/features/gift-finder/model";
import { inputHash } from "../../apps/web/src/features/sellers/persistence.server";
import { changeCompatibility, readCompatibility } from "../../apps/web/src/features/assistant-tools/compatibility.server";
import { snapshotCompatibility } from "../../apps/web/src/features/assistant-tools/compatibility-model";
import { ASSISTANT_LIMITS } from "../../apps/web/src/features/assistant-tools/limits";
import type { ToolListing } from "../../apps/web/src/features/shopping-tools/model";

/** Registered only after the original T58 proposal/helper freeze and canonical adoption.
 * No bootstrap, connection, migration, provider or fixture effect occurs on import.
 */
export function defineGiftPersistenceCases(get: () => {
  database: SellerDatabase; admin: Pool; runtime: Pool; facts: ToolListing[];
}) {
  describe("T61 Gift Finder on real isolated PostgreSQL", () => {
    const actor = { subject: "user_t61_gift" };
    const brief = parseGiftBrief({ version: 1, occasion: "birthday", age: "adult", neededBy: null,
      criteria: "category=cat%3Aelectronics%2Fphones&maxPrice=200&currency=EUR" });
    it("unknown-human read does not register, exact race creates one brief and replay after clear restores nothing", async () => {
      const { database, admin } = get();
      const view = await readGift(database, actor);
      expect(view.items).toEqual([]);
      expect((await admin.query("SELECT count(*)::int AS n FROM treido.users WHERE clerk_subject=$1", [actor.subject])).rows[0].n).toBe(0);
      const command = { actorKey: view.actorKey, expectedRevision: view.revision, requestId: randomUUID(), operation: { kind: "find", brief, confirmed: true } };
      const outcomes = await Promise.all([changeGift(database, actor, command), changeGift(database, actor, command)]);
      expect(outcomes.filter(result => result.replayed)).toHaveLength(1);
      const saved = await readGift(database, actor);
      expect(saved.items).toHaveLength(2);
      await changeGift(database, actor, { actorKey: view.actorKey, expectedRevision: saved.revision, requestId: randomUUID(), operation: { kind: "clear", briefHash: saved.briefHash, listingIds: saved.items.map(item => item.listingId) } });
      expect((await changeGift(database, actor, command)).replayed).toBe(true);
      expect((await readGift(database, actor)).items).toEqual([]);
      await expect(changeGift(database, actor, { ...command, operation: { ...command.operation, brief: { ...brief, occasion: "thanks" } } })).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(get().runtime.query("UPDATE treido.buyer_gift_receipts SET accepted_revision=999")).rejects.toMatchObject({ code: "42501" });
    });
    it("a hard arrival date persists as unsupported and produces no current candidates", async () => {
      const { database } = get(), view = await readGift(database, actor);
      await changeGift(database, actor, { actorKey: view.actorKey, expectedRevision: view.revision, requestId: randomUUID(), operation: { kind: "find", brief: { ...brief, neededBy: "2026-12-01" }, confirmed: true } });
      const saved = await readGift(database, actor);
      expect(saved.unsupported).toEqual(["arrival"]);
      expect(saved.items).toEqual([]);
      expect(saved.brief?.neededBy).toBe("2026-12-01");
    });
    it("listing withdrawal hides frozen facts and prevents stale shortlist selection", async () => {
      const { database, admin, facts } = get(), view = await readGift(database, actor);
      await changeGift(database, actor, { actorKey: view.actorKey, expectedRevision: view.revision, requestId: randomUUID(), operation: { kind: "find", brief, confirmed: true } });
      const saved = await readGift(database, actor), id = facts[0].card.id;
      await admin.query("UPDATE treido.listings SET publication='withdrawn' WHERE id=$1", [id]);
      try {
        const current = await readGift(database, actor), item = current.items.find(row => row.listingId === id);
        expect(item).toMatchObject({ current: null, observed: null, changed: true });
        await expect(changeGift(database, actor, { actorKey: view.actorKey, expectedRevision: saved.revision, requestId: randomUUID(), operation: { kind: "choose", listingIds: [id] } })).rejects.toMatchObject({ code: "CONFLICT" });
        expect((await readGift(database, actor)).revision).toBe(saved.revision);
      } finally { await admin.query("UPDATE treido.listings SET publication='published' WHERE id=$1", [id]); }
    });
    it("cross-tool concurrent final daily runs serialize at one shared human budget", async () => {
      const { database, admin, facts } = get(), quotaActor = { subject: "user_t61_gift_budget" };
      const snapshots = [snapshotCompatibility(facts[0])], requirements = { categoryId: "cat:electronics/phones", fields: [{ field: "brand", operator: "equal", value: "Apple" }] };
      const initial = await readGift(database, quotaActor);
      await changeGift(database, quotaActor, { actorKey: initial.actorKey, expectedRevision: 0, requestId: randomUUID(), operation: { kind: "find", brief, confirmed: true } });
      for (let i = 1; i < ASSISTANT_LIMITS.runsPerDay - 1; i++) {
        const view = await readCompatibility(database, quotaActor);
        await changeCompatibility(database, quotaActor, { actorKey: view.actorKey, expectedRevision: view.revision, requestId: randomUUID(), operation: { kind: "check", requirements, snapshots } });
      }
      const gift = await readGift(database, quotaActor), compatibility = await readCompatibility(database, quotaActor);
      const outcomes = await Promise.allSettled([
        changeGift(database, quotaActor, { actorKey: gift.actorKey, expectedRevision: gift.revision, requestId: randomUUID(), operation: { kind: "find", brief, confirmed: true } }),
        changeCompatibility(database, quotaActor, { actorKey: compatibility.actorKey, expectedRevision: compatibility.revision, requestId: randomUUID(), operation: { kind: "check", requirements, snapshots } }),
      ]);
      expect(outcomes.filter(result => result.status === "fulfilled")).toHaveLength(1);
      expect((outcomes.find(result => result.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ code: "QUOTA_EXCEEDED" });
      const total = (await admin.query("SELECT (SELECT count(*)::int FROM treido.buyer_gift_receipts WHERE user_id=u.id)+(SELECT count(*)::int FROM treido.buyer_compatibility_receipts WHERE user_id=u.id) AS n FROM treido.users u WHERE clerk_subject=$1", [quotaActor.subject])).rows[0].n;
      expect(total).toBe(ASSISTANT_LIMITS.runsPerDay);
      expect(inputHash((await readGift(database, quotaActor)).brief)).toBe(inputHash(brief));
    });
  });
}
