import { describe, expect, it } from "vitest";
import { inTransaction } from "../../apps/web/src/server/db/database";
import { shippingSource } from "../../apps/web/src/features/order-shipping/source.server";
import type { createShippingSourceFixture } from "./shipping-source-fixture";
type Fixture = Awaited<ReturnType<typeof createShippingSourceFixture>>;

/** Eight prepared original-source cases; UNREGISTERED/UNRUN until the combined
 * freeze. These source assertions do not qualify shipping choices or refunds. */
export function defineShippingSourceCases(get: (kind: "cart" | "offer", pickupOnly?: boolean) => Promise<Fixture>) {
  describe("native original shipping cart and accepted-offer sources", () => {
    it("cart read preserves its exact original lines, total and all commerce rows", async () => {
      const f = await get("cart"), before = await f.commerceSnapshot();
      const result = await inTransaction(f.database, tx => shippingSource(tx, f.buyer.identity, f.source));
      expect(result.lines).toMatchObject([f.line]);
      expect(result.merchandiseMinor).toBe(38700);
      expect(result.allocationId).toBeNull();
      expect(result.originalSourceExpiresAt).toBeNull();
      expect(await f.commerceSnapshot()).toEqual(before);
    });
    it("exact own new cart hold is excluded without an extra hold or expiry extension", async () => {
      const f = await get("cart"), hold = await f.allocateCart(), before = await f.commerceSnapshot();
      await expect(inTransaction(f.database, tx => shippingSource(tx, f.buyer.identity, f.source))).rejects.toMatchObject({ code: "CONFLICT" });
      const result = await inTransaction(f.database, tx => shippingSource(tx, f.buyer.identity, f.source, hold.id));
      expect(result.lines).toMatchObject([f.line]);
      expect(result.merchandiseMinor).toBe(38700);
      expect(await f.commerceSnapshot()).toEqual(before);
    });
    it("foreign hold cannot stand in for the current buyer's exact cart allocation", async () => {
      const f = await get("cart"), hold = await f.allocateCart(f.foreign), before = await f.commerceSnapshot();
      await expect(inTransaction(f.database, tx => shippingSource(tx, f.buyer.identity, f.source, hold.id))).rejects.toMatchObject({ code: "CONFLICT" });
      expect(await f.commerceSnapshot()).toEqual(before);
    });
    it("stale cart revision cannot supply accepted shipping lines", async () => {
      const f = await get("cart"), before = await f.commerceSnapshot();
      if (f.source.kind !== "cart") throw Error("Wrong source fixture");
      const stale = { ...f.source, cartRevision: f.source.cartRevision + 1 };
      await expect(inTransaction(f.database, tx => shippingSource(tx, f.buyer.identity, stale))).rejects.toMatchObject({ code: "CONFLICT" });
      expect(await f.commerceSnapshot()).toEqual(before);
    });
    it("accepted offer uses its negotiated price and original allocation/deadline", async () => {
      const f = await get("offer"), before = await f.commerceSnapshot();
      if (f.source.kind !== "offer") throw Error("Wrong source fixture");
      const original = (await f.admin.query<{ id: string; expires_at: Date }>("SELECT a.id,a.expires_at FROM treido.inventory_allocations a WHERE purpose='offer' AND source_id=$1", [f.source.offerId])).rows[0];
      const result = await inTransaction(f.database, tx => shippingSource(tx, f.buyer.identity, f.source));
      expect(result.lines).toMatchObject([f.line]);
      expect(result.merchandiseMinor).toBe(33000);
      expect(result.allocationId).toBe(original.id);
      expect(result.originalSourceExpiresAt).toBe(original.expires_at.toISOString());
      expect(await f.commerceSnapshot()).toEqual(before);
    });
    it("repeated accepted-offer read preserves original source meaning and never renews stock", async () => {
      const f = await get("offer"), before = await f.commerceSnapshot();
      const first = await inTransaction(f.database, tx => shippingSource(tx, f.buyer.identity, f.source));
      const again = await inTransaction(f.database, tx => shippingSource(tx, f.buyer.identity, f.source));
      expect(again).toEqual(first);
      expect(await f.commerceSnapshot()).toEqual(before);
    });
    it("foreign buyer cannot consume the original accepted-offer source", async () => {
      const f = await get("offer"), before = await f.commerceSnapshot();
      await expect(inTransaction(f.database, tx => shippingSource(tx, f.foreign.identity, f.source))).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(await f.commerceSnapshot()).toEqual(before);
    });
    it("pickup-only publication stays unavailable to shipping without commerce mutation", async () => {
      const f = await get("cart", true), before = await f.commerceSnapshot();
      await expect(inTransaction(f.database, tx => shippingSource(tx, f.buyer.identity, f.source))).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
      expect(await f.commerceSnapshot()).toEqual(before);
    });
  });
}
