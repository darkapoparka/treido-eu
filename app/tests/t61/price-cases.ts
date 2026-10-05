import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { inTransaction, type SellerDatabase } from "../../apps/web/src/server/db/database";
import type { VerifiedIdentity } from "../../apps/web/src/server/identity/clerk.server";
import { createPublicationFixture } from "../../apps/web/tests/fixtures/publication-flow";
import { publishListing } from "../../apps/web/src/features/selling/publish.server";
import { changeInventory } from "../../apps/web/src/features/inventory/commands.server";
import { allocateInventory, releaseAllocation } from "../../apps/web/src/features/inventory/allocations.server";
import { readPublicInventory } from "../../apps/web/src/features/inventory/queries.server";
import { readPublicDiscovery } from "../../apps/web/src/features/catalog/public-discovery.server";
import { currentEligible } from "../../apps/web/src/features/promotions/eligibility.server";
import { giftCatalogue } from "../../apps/web/src/features/gift-finder/catalogue.server";
import { parseGiftBrief } from "../../apps/web/src/features/gift-finder/model";

type Stock = { color: string; priceMinor: number; onHand: number };
/** Registered in remediation.integration.ts; execution awaits ONE expanded source/canonical freeze. No mocked SQL
 * or administrative stock fabrication. Genuine original native inventory,
 * publication and internal allocation commands operate only the caller's owned
 * test database. Internal checkout source IDs are isolated allocation fixtures,
 * never real quotes, checkout authorization, payment or provider acceptance.
 */
export function definePricePersistenceCases(get: () => {
  database: SellerDatabase; admin: Pool;
  identities: [VerifiedIdentity, VerifiedIdentity]; userIds: [string, string];
}) {
  const key = Buffer.alloc(32, 61); // Synthetic cursor key confined to this fixture.
  const create = async (label: string, definitions: Stock[] | null, existingSellerId?: string) => {
    const { database, admin, identities } = get(), client = await admin.connect();
    try {
      const fixture = await createPublicationFixture({ database, admin: client, owner: identities[0] }, "business", existingSellerId);
      let expectedRevision = fixture.input.expectedRevision, inventoryRevision = 0;
      const skus: { id: string; priceMinor: number; onHand: number }[] = [];
      if (definitions) {
        if (!definitions.length) throw Error("Explicit fixture definitions required");
        const first = definitions[0];
        const setup = await changeInventory(database, identities[0], { sellerId: fixture.sellerId, listingId: fixture.draft.id, requestId: randomUUID(), expectedRevision: 0,
          operation: { kind: "setup", mode: "stocked", onHand: first.onHand, sellerSku: label + ":initial" } });
        const defined = await changeInventory(database, identities[0], { sellerId: fixture.sellerId, listingId: fixture.draft.id, requestId: randomUUID(), expectedRevision: setup.revision,
          operation: { kind: "variant", skuId: setup.skuId, sellerSku: label + ":" + first.color, options: { Color: first.color }, priceMinor: first.priceMinor } });
        inventoryRevision = defined.revision;
        expectedRevision = defined.listingRevision;
        skus.push({ id: setup.skuId, priceMinor: first.priceMinor, onHand: first.onHand });
        for (const definition of definitions.slice(1)) {
          const added = await changeInventory(database, identities[0], { sellerId: fixture.sellerId, listingId: fixture.draft.id, requestId: randomUUID(), expectedRevision: inventoryRevision,
            operation: { kind: "variant", skuId: null, sellerSku: label + ":" + definition.color, options: { Color: definition.color }, priceMinor: definition.priceMinor, onHand: definition.onHand } });
          inventoryRevision = added.revision;
          expectedRevision = added.listingRevision;
          skus.push({ id: added.skuId, priceMinor: definition.priceMinor, onHand: definition.onHand });
        }
      }
      const published = await publishListing(database, identities[0], { ...fixture.input, expectedRevision });
      return { sellerId: fixture.sellerId, id: fixture.draft.id, publicationRevision: published.revision, inventoryRevision, skus };
    } finally { client.release(); }
  };
  type Fixture = Awaited<ReturnType<typeof create>>;
  const browse = (fixture: Fixture, extra: Record<string, string> = {}, limit = 24) => readPublicDiscovery(get().database,
    { category: "cat:electronics/phones", seller: "business", currency: "EUR", ...extra }, { sellerId: fixture.sellerId, key, limit });
  const card = async (fixture: Fixture) => {
    const found = (await browse(fixture)).items.find(item => item.id === fixture.id);
    if (!found) throw Error("Genuinely published fixture missing from organic catalogue");
    return found;
  };
  const strict = (fixture: Fixture, maxPrice: string) => inTransaction(get().database, tx => giftCatalogue(tx, get().userIds[1],
    parseGiftBrief({ version: 1, occasion: "birthday", age: "adult", neededBy: null,
      criteria: "category=cat%3Aelectronics%2Fphones&currency=EUR&maxPrice=" + maxPrice }), null, [fixture.id]));

  describe("T61 actual organic available-variant price and stock regressions", () => {
    it("129 available /99 sold-out cannot satisfy max100 or advertise a false available range", async () => {
      const fixture = await create("T61-price-gap", [
        { color: "Red", priceMinor: 12900, onHand: 1 }, { color: "Blue", priceMinor: 9900, onHand: 0 },
      ]);
      expect(await readPublicInventory(get().database, fixture.id)).toMatchObject({ mode: "stocked", state: "available", publicationRevision: fixture.publicationRevision });
      const current = await card(fixture);
      expect(current).toMatchObject({ stockState: "available", price: { amount: 12900, currency: "EUR" } });
      expect(current.priceFrom ?? false).toBe(false);
      expect((await browse(fixture, { maxPrice: "100" })).items).toEqual([]);
      expect((await browse(fixture, { minPrice: "129" })).items.map(item => item.id)).toEqual([fixture.id]);
      expect((await browse(fixture, { minPrice: "130" })).items).toEqual([]);
      expect((await browse(fixture, { minPrice: "129", maxPrice: "129" })).items.map(item => item.id)).toEqual([fixture.id]);
      expect((await strict(fixture, "100")).items).toEqual([]);
      expect((await strict(fixture, "129")).items).toEqual([
        expect.objectContaining({ card: expect.objectContaining({ id: fixture.id, price: { amount: 12900, currency: "EUR" } }),
          priceBasis: "available_variant", variant: expect.objectContaining({ id: fixture.skus[0].id, priceMinor: 12900, available: 1 }) }),
      ]);
    });
    it("ranges and signed price cursor use available prices, without duplicates or filtered-out cheap SKUs", async () => {
      const range = await create("T61-price-range", [
        { color: "Red", priceMinor: 12900, onHand: 1 }, { color: "Green", priceMinor: 16900, onHand: 1 }, { color: "Blue", priceMinor: 9900, onHand: 0 },
      ]);
      const middle = await create("T61-price-middle", [{ color: "Red", priceMinor: 13900, onHand: 1 }, { color: "Blue", priceMinor: 8000, onHand: 0 }], range.sellerId);
      const highest = await create("T61-price-highest", [{ color: "Red", priceMinor: 15900, onHand: 1 }], range.sellerId);
      expect(await card(range)).toMatchObject({ price: { amount: 12900, currency: "EUR" }, priceFrom: true, stockState: "available" });
      expect((await card(middle)).priceFrom ?? false).toBe(false);
      const first = await browse(range, { sort: "price_asc", maxPrice: "200" }, 1);
      expect(first.total).toBe(3);
      expect(first.items.map(item => item.id)).toEqual([range.id]);
      expect(first.nextCursor).not.toBeNull();
      const second = await browse(range, { sort: "price_asc", maxPrice: "200", cursor: first.nextCursor! }, 1);
      expect(second.cursorReset).toBe(false);
      expect(second.items.map(item => item.id)).toEqual([middle.id]);
      expect(second.nextCursor).not.toBeNull();
      const third = await browse(range, { sort: "price_asc", maxPrice: "200", cursor: second.nextCursor! }, 1);
      expect(third.cursorReset).toBe(false);
      expect(third.items.map(item => item.id)).toEqual([highest.id]);
      expect(third.nextCursor).toBeNull();
      expect((await browse(range, { maxPrice: "100" })).total).toBe(0);
      const budget = await browse(range, { maxPrice: "135" });
      expect(budget.items.map(item => item.id)).toEqual([range.id]);
      expect(budget.facets.categories).toContainEqual({ value: "cat:electronics/phones", count: 1 });
      expect(new Set([...first.items, ...second.items, ...third.items].map(item => item.id)).size).toBe(3);
    });
    it("real reservations remove held cheap price; fully reserved state is honest and exact release restores current prices", async () => {
      const { database, userIds } = get();
      const fixture = await create("T61-price-reserved", [
        { color: "Blue", priceMinor: 9900, onHand: 1 }, { color: "Red", priceMinor: 12900, onHand: 1 },
      ]);
      const reserve = (index: number) => {
        const input = { sellerId: fixture.sellerId, buyerId: userIds[1], actorId: userIds[1], purpose: "checkout" as const, sourceId: randomUUID(),
          lines: [{ listingId: fixture.id, skuId: fixture.skus[index].id, publicationRevision: fixture.publicationRevision, quantity: 1, unitPriceMinor: fixture.skus[index].priceMinor }] };
        return { input, execute: () => inTransaction(database, tx => allocateInventory(tx, input)) };
      };
      const cheap = reserve(0), heldCheap = await cheap.execute();
      expect((await cheap.execute()).expiresAt).toEqual(heldCheap.expiresAt);
      expect(await card(fixture)).toMatchObject({ stockState: "available", price: { amount: 12900, currency: "EUR" } });
      expect((await card(fixture)).priceFrom ?? false).toBe(false);
      expect((await browse(fixture, { maxPrice: "100" })).items).toEqual([]);
      const expensive = reserve(1), heldExpensive = await expensive.execute();
      expect(await readPublicInventory(database, fixture.id)).toMatchObject({ state: "reserved" });
      expect(await card(fixture)).toMatchObject({ stockState: "reserved", price: { amount: 9900, currency: "EUR" }, priceFrom: true });
      expect((await strict(fixture, "200")).items).toEqual([]);
      expect(await inTransaction(database, tx => currentEligible(tx, fixture.sellerId, fixture.id))).toBeNull();
      for (const allocation of [heldCheap, heldExpensive]) {
        expect((await inTransaction(database, tx => releaseAllocation(tx, allocation.id, userIds[1], "cancelled"))).state).toBe("released");
      }
      expect(await card(fixture)).toMatchObject({ stockState: "available", price: { amount: 9900, currency: "EUR" }, priceFrom: true });
      expect((await browse(fixture, { maxPrice: "100" })).items.map(item => item.id)).toEqual([fixture.id]);
    });
    it("domain-reported exhaustion retains accepted price definitions but never advertises available stock or paid eligibility", async () => {
      const { database, identities } = get();
      const fixture = await create("T61-price-exhausted", [
        { color: "Red", priceMinor: 12900, onHand: 1 }, { color: "Blue", priceMinor: 9900, onHand: 1 },
      ]);
      let revision = fixture.inventoryRevision;
      for (const sku of fixture.skus) {
        const changed = await changeInventory(database, identities[0], { sellerId: fixture.sellerId, listingId: fixture.id, requestId: randomUUID(), expectedRevision: revision,
          operation: { kind: "stock", skuId: sku.id, onHand: 0, reasonKind: "reported_sale", reason: "SYNTHETIC T61 owned-database stock report" } });
        revision = changed.revision;
      }
      expect(await readPublicInventory(database, fixture.id)).toMatchObject({ state: "out_of_stock", publicationRevision: fixture.publicationRevision });
      expect(await card(fixture)).toMatchObject({ stockState: "out_of_stock", price: { amount: 9900, currency: "EUR" }, priceFrom: true });
      expect((await strict(fixture, "200")).items).toEqual([]);
      expect(await inTransaction(database, tx => currentEligible(tx, fixture.sellerId, fixture.id))).toBeNull();
    });
    it("unconfigured publication keeps honest unknown stock and original listing price without inventing an available variant", async () => {
      const fixture = await create("T61-price-unknown", null);
      expect(await readPublicInventory(get().database, fixture.id)).toMatchObject({ mode: "unknown", state: "unknown", skus: [] });
      const current = await card(fixture);
      expect(current).toMatchObject({ stockState: "unknown", price: { amount: 12900, currency: "EUR" } });
      expect(current.priceFrom ?? false).toBe(false);
      expect((await browse(fixture, { maxPrice: "100" })).items).toEqual([]);
      expect((await strict(fixture, "130")).items).toEqual([
        expect.objectContaining({ card: expect.objectContaining({ id: fixture.id }), priceBasis: "listing", variant: null,
          inventory: expect.objectContaining({ mode: "unknown", state: "unknown", available: null }) }),
      ]);
      expect(await inTransaction(get().database, tx => currentEligible(tx, fixture.sellerId, fixture.id))).toBeNull();
    });
  });
}
