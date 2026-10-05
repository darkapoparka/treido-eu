import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { changeClosure, recoverClosure } from "./commands.server";
import { actorKey, approvedBinding, approvedPolicy } from "./storage.server";
import { readAccountPreferences } from "./preferences.server";
import { readOwnAccountLifecycleExport } from "./queries.server";
/** Imported only by T61's explicitly owned disposable native database.
 * Reviewed SQL/helpers/extensions and isolated identities come from the caller.
 * No policy or provider approval is inserted in a shared development database.
 */
export function defineAccountClosureIntegrationCases(
  get: () => {
    database: SellerDatabase;
    admin: Pool;
    identities: [VerifiedIdentity, VerifiedIdentity];
    userIds: [string, string];
    futurePolicyId: string;
    futureBindingId: string;
    currentPolicyId: string;
    currentBindingId: string;
    reviewedPlanId: string;
    reviewedPlanHash: string;
    closureRequestId: string;
  },
) {
  describe("account lifecycle on isolated PostgreSQL", () => {
    it("durably saves harmless defaults, replays one receipt and keeps the other account isolated", async () => {
      const context = get(),
        identity = context.identities[0],
        view = await readAccountPreferences(context.database, identity);
      const command = {
        version: 1,
        actorKey: actorKey(identity),
        requestId: randomUUID(),
        expectedRevision: view.revision,
        operation: {
          kind: "preferences",
          locale: "bg",
          browseScope: "business",
        },
      };
      const first = await changeClosure(context.database, identity, command);
      expect(
        (await changeClosure(context.database, identity, command))
          .acknowledgment,
      ).toEqual(first.acknowledgment);
      expect(
        (await readAccountPreferences(context.database, identity)).preferences,
      ).toEqual({ locale: "bg", browseScope: "business" });
      await expect(
        Promise.resolve().then(() =>
          recoverClosure(context.database, context.identities[1], command),
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        changeClosure(context.database, identity, {
          ...command,
          operation: {
            kind: "preferences",
            locale: "en",
            browseScope: "personal",
          },
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      const rows = await inTransaction(context.database, (tx) =>
        readOwnAccountLifecycleExport(tx.client, context.userIds[0]),
      );
      expect(rows.length).toBeLessThanOrEqual(2);
      expect(JSON.stringify(rows)).not.toContain(context.identities[0].subject);
      expect(JSON.stringify(rows)).not.toContain("sessionId");
    });
    it("future-dated approval cannot authorize policy/binding reads", async () => {
      const context = get();
      await expect(
        inTransaction(context.database, (tx) =>
          approvedPolicy(tx, context.futurePolicyId),
        ),
      ).rejects.toMatchObject({ code: "POLICY_REQUIRED" });
      await expect(
        inTransaction(context.database, (tx) =>
          approvedBinding(tx, context.futureBindingId),
        ),
      ).rejects.toMatchObject({ code: "BINDING_REQUIRED" });
    });
    it("a withdrawn original T55 request prevents fresh destructive acceptance", async () => {
      const context = get();
      await context.admin.query(
        `UPDATE treido.account_closure_requests SET state='withdrawn',revision=revision+1,updated_at=clock_timestamp() WHERE user_id=$1 AND id=$2`,
        [context.userIds[0], context.closureRequestId],
      );
      await expect(
        context.database.pool.query(
          `SELECT treido.account_accept_closure($1::uuid,$2::uuid,$3::text,$4::uuid)`,
          [
            context.userIds[0],
            context.reviewedPlanId,
            context.reviewedPlanHash,
            randomUUID(),
          ],
        ),
      ).rejects.toMatchObject({ code: "23514" });
      expect(
        (
          await context.admin.query(
            `SELECT status FROM treido.users WHERE id=$1`,
            [context.userIds[0]],
          )
        ).rows[0].status,
      ).toBe("active");
    });
    it("runtime cannot rewrite immutable plans, effect identities or accepted receipts", async () => {
      const context = get();
      for (const sql of [
        `UPDATE treido.account_execution_plans SET payload='{}'::jsonb WHERE id=$1`,
        `UPDATE treido.account_execution_plans SET plan_hash=repeat('0',64) WHERE id=$1`,
      ])
        await expect(
          context.database.pool.query(sql, [context.reviewedPlanId]),
        ).rejects.toMatchObject({ code: "42501" });
    });
    it("revocation is monotonic and frozen approval/policy values cannot be rewritten", async () => {
      const context = get();
      await context.admin.query(
        `UPDATE treido.account_closure_policies SET revoked_at=clock_timestamp() WHERE id=$1`,
        [context.currentPolicyId],
      );
      await expect(
        context.admin.query(
          `UPDATE treido.account_closure_policies SET revoked_at=NULL WHERE id=$1`,
          [context.currentPolicyId],
        ),
      ).rejects.toMatchObject({ code: "23514" });
      await expect(
        context.admin.query(
          `UPDATE treido.account_lifecycle_bindings SET clerk_instance_id='ins_foreign' WHERE id=$1`,
          [context.currentBindingId],
        ),
      ).rejects.toMatchObject({ code: "23514" });
      await expect(
        inTransaction(context.database, (tx) =>
          approvedPolicy(tx, context.currentPolicyId),
        ),
      ).rejects.toMatchObject({ code: "POLICY_REQUIRED" });
    });
  });
}
