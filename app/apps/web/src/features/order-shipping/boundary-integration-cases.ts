import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { libraryActorKey } from "../library/cursor.server";
import {
  executeShippingCommand,
  recoverShippingRequest,
  stopUnrecordedShippingRequest,
} from "./commands.server";
import { readShippingContext, readShippingReview } from "./queries.server";
import {
  readOrderShippingRecipient,
  readShippingOwnExport,
} from "./recipient.server";
import {
  expireUnboundShippingInput,
  readShippingLifecycleFacts,
  type ShippingExpiryContext,
} from "./lifecycle.server";
import {
  lockShippingChoiceForQuote,
  type ShippingQuoteScope,
} from "./bridge.server";
import type { PrepareShipping, ShippingChoice } from "./model";
export type ShippingFixtureName =
  | "missing-policy"
  | "unsupported-tax"
  | "buyer-fee"
  | "view-only"
  | "replay"
  | "foreign"
  | "stale"
  | "revoked"
  | "abandon"
  | "own-hold"
  | "tariff-deadline"
  | "wrong-language"
  | "wrong-lease"
  | "expiry"
  | "bound-evidence"
  | "removed-member"
  | "unknown-refund"
  | "cleared-evidence"
  | "export";
export type ShippingNativeFixture = {
  database: SellerDatabase;
  admin: Pool;
  buyer: VerifiedIdentity;
  foreign: VerifiedIdentity;
  merchant: VerifiedIdentity;
  buyerId: string;
  sellerId: string;
  choiceId: string;
  orderId: string;
  command: PrepareShipping;
  acceptedChoice: ShippingChoice;
  quoteScope: ShippingQuoteScope;
  expiryJob: ShippingExpiryContext;
  revokePolicy: () => Promise<void>;
  removeMerchant: () => Promise<void>;
};
/** T61 supplies fresh isolated native fixtures with ACTUAL existing publication,
 * cart/offer/allocation authority, restricted runtime role and registered local
 * synthetic recent session/expiry lease. No shared approval seed/provider effect.
 * Definitions are unregistered and NOT RUN until the expanded combined freeze. */
export function defineShippingBoundaryCases(
  get: (name: ShippingFixtureName) => Promise<ShippingNativeFixture>,
) {
  const commerce = async (f: ShippingNativeFixture) =>
    (
      await f.admin.query<{ value: unknown }>(
        "SELECT jsonb_build_object('cart',(SELECT jsonb_agg(to_jsonb(l) ORDER BY l.sku_id) FROM treido.buyer_cart_lines l WHERE user_id=$1),'allocations',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM treido.inventory_allocations a WHERE buyer_id=$1),'quotes',(SELECT jsonb_agg(to_jsonb(q) ORDER BY q.id) FROM treido.payable_quotes q WHERE buyer_id=$1),'attempts',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM treido.payment_attempts a JOIN treido.payable_quotes q ON q.id=a.quote_id WHERE q.buyer_id=$1)) AS value",
        [f.buyerId],
      )
    ).rows[0].value;
  describe("native original shipping producer", () => {
    it("known tax and positive buyer fee cannot persist input before their exact accepted refund/funds contract exists", async () => {
      for (const name of ["unsupported-tax", "buyer-fee"] as const) {
        const f = await get(name),
          before = await commerce(f);
        expect(
          (
            await readShippingContext(
              f.database,
              f.buyer,
              f.command.source,
              f.command.language,
            )
          ).available,
        ).toBe(false);
        await expect(
          executeShippingCommand(f.database, f.buyer, f.command),
        ).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
        expect(await commerce(f)).toEqual(before);
        expect(
          (
            await f.admin.query(
              "SELECT choice_id FROM treido.order_shipping_recipients WHERE buyer_id=$1",
              [f.buyerId],
            )
          ).rowCount,
        ).toBe(0);
      }
    });
    it("missing real approval is unavailable and a route read writes no recipient/commerce", async () => {
      const f = await get("missing-policy"),
        before = await commerce(f);
      expect(
        (
          await readShippingContext(
            f.database,
            f.buyer,
            f.command.source,
            f.command.language,
          )
        ).available,
      ).toBe(false);
      expect(await commerce(f)).toEqual(before);
      expect(
        (
          await f.admin.query(
            "SELECT choice_id FROM treido.order_shipping_recipients WHERE buyer_id=$1",
            [f.buyerId],
          )
        ).rowCount,
      ).toBe(0);
    });
    it("eligible opening is still read-only; it never accepts recipient purpose", async () => {
      const f = await get("view-only"),
        before = await commerce(f);
      expect(
        (
          await readShippingContext(
            f.database,
            f.buyer,
            f.command.source,
            f.command.language,
          )
        ).available,
      ).toBe(true);
      expect(await commerce(f)).toEqual(before);
      expect(
        (
          await f.admin.query(
            "SELECT id FROM treido.order_shipping_choices WHERE buyer_id=$1",
            [f.buyerId],
          )
        ).rowCount,
      ).toBe(0);
    });
    it("double clicks recover the same original input without a new cost, hold or recipient", async () => {
      const f = await get("replay"),
        before = await commerce(f);
      const [a, b] = await Promise.all([
        executeShippingCommand(f.database, f.buyer, f.command),
        executeShippingCommand(f.database, f.buyer, f.command),
      ]);
      expect(a.id).toBe(b.id);
      expect(await commerce(f)).toEqual(before);
      await f.revokePolicy();
      expect(
        await recoverShippingRequest(f.database, f.buyer, {
          actorKey: f.command.actorKey,
          requestId: f.command.requestId,
        }),
      ).toMatchObject({ found: true, id: a.id });
      await expect(
        executeShippingCommand(f.database, f.buyer, {
          ...f.command,
          recipient: { ...f.command.recipient, name: "Changed" },
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });
    it("foreign buyer cannot read a guessed review or recover another human request", async () => {
      const f = await get("foreign");
      await expect(
        readShippingReview(f.database, f.foreign, f.choiceId),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(
        await recoverShippingRequest(f.database, f.foreign, {
          actorKey: libraryActorKey(f.foreign),
          requestId: f.command.requestId,
        }),
      ).toEqual({ found: false });
    });
    it("stale recipient/terms revision cannot accept and current revocation prevents first acceptance", async () => {
      const f = await get("stale");
      await expect(
        executeShippingCommand(f.database, f.buyer, {
          action: "accept",
          actorKey: f.command.actorKey,
          requestId: randomUUID(),
          choice: { ...f.acceptedChoice, revision: 99 },
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      const r = await get("revoked");
      await r.revokePolicy();
      await expect(
        executeShippingCommand(r.database, r.buyer, {
          action: "accept",
          actorKey: r.command.actorKey,
          requestId: randomUUID(),
          choice: r.acceptedChoice,
        }),
      ).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
    });
    it("explicit stop blocks a late original request rather than treating a missing receipt as proof", async () => {
      const f = await get("abandon");
      expect(
        await stopUnrecordedShippingRequest(f.database, f.buyer, {
          actorKey: f.command.actorKey,
          requestId: f.command.requestId,
        }),
      ).toEqual({ found: true, canceled: true });
      await expect(
        executeShippingCommand(f.database, f.buyer, f.command),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(
        (
          await f.admin.query(
            "SELECT choice_id FROM treido.order_shipping_recipients WHERE buyer_id=$1",
            [f.buyerId],
          )
        ).rowCount,
      ).toBe(0);
    });
    it("the exact buyer's new cart allocation remains usable without repricing or extending it", async () => {
      const f = await get("own-hold"),
        before = await commerce(f);
      const bridge = await inTransaction(f.database, (tx) =>
        lockShippingChoiceForQuote(tx, f.buyer, f.acceptedChoice, f.quoteScope),
      );
      const review = await readShippingReview(f.database, f.buyer, f.choiceId);
      expect(
        new Date(f.quoteScope.originalExpiresAt).getTime(),
      ).toBeGreaterThan(new Date(review.expiresAt).getTime());
      expect(bridge.costs.merchandiseMinor).toBe(f.quoteScope.merchandiseMinor);
      expect(bridge.recipientRef).toBe(f.choiceId);
      expect(await commerce(f)).toEqual(before);
    });
    it("original language and tariff coverage cannot change at quote binding", async () => {
      for (const name of ["wrong-language", "tariff-deadline"] as const) {
        const f = await get(name),
          before = await commerce(f);
        await expect(
          inTransaction(f.database, (tx) =>
            lockShippingChoiceForQuote(
              tx,
              f.buyer,
              f.acceptedChoice,
              f.quoteScope,
            ),
          ),
        ).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
        expect(await commerce(f)).toEqual(before);
      }
    });
    it("wrong/null/stale expiry token cannot clear own private input", async () => {
      const f = await get("wrong-lease");
      for (const executionToken of [randomUUID(), null])
        await expect(
          inTransaction(f.database, (tx) =>
            expireUnboundShippingInput(tx, {
              ...f.expiryJob,
              executionToken: executionToken as unknown as string,
            }),
          ),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(
        (
          await f.admin.query(
            "SELECT value FROM treido.order_shipping_recipients WHERE choice_id=$1",
            [f.choiceId],
          )
        ).rows[0].value,
      ).not.toBeNull();
    });
    it("one exact due original lease clears only unbound input and retains immutable terms/receipts", async () => {
      const f = await get("expiry"),
        before = await commerce(f);
      const original = (
        await f.admin.query(
          "SELECT snapshot,snapshot_hash,expires_at FROM treido.order_shipping_choices WHERE id=$1",
          [f.choiceId],
        )
      ).rows[0];
      expect(
        (
          await f.admin.query(
            "SELECT available_at>clock_timestamp() AS claimed FROM treido.outbox_jobs WHERE id=$1",
            [f.expiryJob.id],
          )
        ).rows[0].claimed,
      ).toBe(true);
      await inTransaction(f.database, (tx) =>
        expireUnboundShippingInput(tx, f.expiryJob),
      );
      expect(
        (
          await f.admin.query(
            "SELECT value FROM treido.order_shipping_recipients WHERE choice_id=$1",
            [f.choiceId],
          )
        ).rows[0].value,
      ).toBeNull();
      expect(
        (
          await f.admin.query(
            "SELECT snapshot,snapshot_hash,expires_at FROM treido.order_shipping_choices WHERE id=$1",
            [f.choiceId],
          )
        ).rows[0],
      ).toEqual(original);
      expect(await commerce(f)).toEqual(before);
    });
    it("completed authoritative shipping with cleared payload keeps history without synthetic closure obligations", async () => {
      const f = await get("cleared-evidence");
      expect(
        await inTransaction(f.database, (tx) =>
          readShippingLifecycleFacts(tx, f.buyerId),
        ),
      ).toMatchObject({
        unconfirmedShipping: 0,
        unresolvedRefunds: 0,
        retainedAcceptedRecipients: 0,
      });
      expect(
        (
          await f.admin.query(
            "SELECT id FROM treido.order_shipping_choices WHERE id=$1 AND state='bound'",
            [f.choiceId],
          )
        ).rowCount,
      ).toBe(1);
    });
    it("accepted paid evidence is retained even when an input-expiry job is presented", async () => {
      const f = await get("bound-evidence");
      await expect(
        inTransaction(f.database, (tx) =>
          expireUnboundShippingInput(tx, f.expiryJob),
        ),
      ).rejects.toBeDefined();
      expect(
        (
          await f.admin.query(
            "SELECT value FROM treido.order_shipping_recipients WHERE choice_id=$1",
            [f.choiceId],
          )
        ).rows[0].value,
      ).not.toBeNull();
    });
    it("removed merchant membership cannot read recipient by a remembered order/seller ID", async () => {
      const f = await get("removed-member");
      await f.removeMerchant();
      await expect(
        readOrderShippingRecipient(f.database, f.merchant, {
          actorKey: libraryActorKey(f.merchant),
          sellerId: f.sellerId,
          orderId: f.orderId,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it("unknown refunds and unconfirmed shipping remain current closure obligations", async () => {
      const f = await get("unknown-refund"),
        facts = await inTransaction(f.database, (tx) =>
          readShippingLifecycleFacts(tx, f.buyerId),
        );
      expect(facts.unresolvedRefunds).toBeGreaterThan(0);
      expect(facts.unconfirmedShipping).toBeGreaterThan(0);
    });
    it("own export exposes allowlisted metadata without recipient/counterpart/provider leakage", async () => {
      const f = await get("export"),
        client = await f.admin.connect();
      try {
        const result = await readShippingOwnExport(client, f.buyerId);
        expect(result.choices.length).toBeLessThanOrEqual(50);
        const serialized = JSON.stringify(result);
        for (const value of Object.values(f.command.recipient))
          expect(serialized).not.toContain(value);
        expect(serialized).not.toMatch(
          /platformAccount|carrierCode|sourceReference|buyerId|sellerId|phone|address/,
        );
      } finally {
        client.release();
      }
    });
  });
}
