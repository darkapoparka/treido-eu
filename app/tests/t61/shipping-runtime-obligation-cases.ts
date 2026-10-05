import { describe, expect, it } from "vitest";
import { inTransaction, type SellerDatabase } from "../../apps/web/src/server/db/database";
import { readShippingLifecycleFacts } from "../../apps/web/src/features/order-shipping/lifecycle.server";

type Fixture = { database: SellerDatabase; buyerId: string; boundChoiceId: string; unboundChoiceId: string };
/** Prepared-only definition. The pending factory must create one genuine
 * original paid/bound/unfulfilled shipping choice and one original unbound
 * private input for a fresh buyer. No owner connection or fake readiness can
 * satisfy this assertion; the actual T64 canonical fixture is still pending. */
export function defineShippingRuntimeObligationCases(get: () => Promise<Fixture>) {
  describe("native shipping obligations through the restricted runtime", () => {
    it("exact runtime grants execute actual lifecycle facts for bound and unbound original resources", async () => {
      const f = await get();
      await inTransaction(f.database, async tx => {
        const role = (await tx.client.query<{ name: string; superuser: boolean; bypass: boolean }>(
          "SELECT current_user AS name,rolsuper AS superuser,rolbypassrls AS bypass FROM pg_roles WHERE rolname=current_user",
        )).rows[0];
        expect(role).toEqual({ name: "treido_runtime", superuser: false, bypass: false });
        const privileges = (await tx.client.query<{ execute: boolean; owner: boolean; publicExecute: boolean }>(
          "SELECT has_function_privilege(current_user,p.oid,'EXECUTE') AS execute,pg_get_userbyid(p.proowner)=current_user AS owner,EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS \"publicExecute\" FROM pg_proc p WHERE p.oid=to_regprocedure('treido.order_shipping_recipient_obligations_clear(uuid)')",
        )).rows;
        expect(privileges).toEqual([{ execute: true, owner: false, publicExecute: false }]);
        const actual = (await tx.client.query<{ id: string; state: string; quoteId: string | null; hasPrivateValue: boolean; paymentState: string | null }>(
          'SELECT c.id,c.state,c.quote_id AS "quoteId",r.value IS NOT NULL AS "hasPrivateValue",o.payment_state AS "paymentState" FROM treido.order_shipping_choices c JOIN treido.order_shipping_recipients r ON r.choice_id=c.id LEFT JOIN treido.paid_orders o ON o.quote_id=c.quote_id WHERE c.buyer_id=$1 AND c.id=ANY($2::uuid[]) ORDER BY c.id',
          [f.buyerId, [f.boundChoiceId, f.unboundChoiceId]],
        )).rows;
        expect(actual).toHaveLength(2);
        expect(actual.find(row => row.id === f.boundChoiceId)).toMatchObject({ state: "bound", hasPrivateValue: true, paymentState: "paid" });
        expect(actual.find(row => row.id === f.boundChoiceId)?.quoteId).not.toBeNull();
        expect(actual.find(row => row.id === f.unboundChoiceId)).toMatchObject({ quoteId: null, hasPrivateValue: true, paymentState: null });
        // The original public runtime call invokes the revoked-from-PUBLIC
        // predicate itself. No owner retry, permission catch or zero fallback.
        expect(await readShippingLifecycleFacts(tx, f.buyerId)).toEqual({
          unboundPrivateInputs: 1, unconfirmedShipping: 1,
          unresolvedRefunds: 0, retainedAcceptedRecipients: 1,
        });
      });
    });
  });
}
