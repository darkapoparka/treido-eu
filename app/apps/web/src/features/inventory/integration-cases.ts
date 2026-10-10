import { changeStockBatch } from "./batch.server";
import { exportInventoryPage } from "./export.server";
import { expireOffers } from "../offers/expiry.server";
import { readAcceptedOfferQuoteSource } from "../offers/checkout-source.server";
import { readDiscoveryInput } from "../catalog/discovery-input";
import {
  readPublishedListing,
  readPublishedPhoto,
} from "../catalog/published.server";
import { readPublicSeller } from "../catalog/public-discovery.server";
import { readSellerContext } from "../sellers/persistence.server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout as pause } from "node:timers/promises";
import { Pool } from "pg";
import { createDatabase, inTransaction } from "../../server/db/database";
import {
  authorizeHuman,
  revokeSellerMembership,
} from "../sellers/persistence.server";
import {
  createPublicationFixture,
  type PublicationFixtureContext,
} from "../../../tests/fixtures/publication-flow";
import { publishListing } from "../selling/publish.server";
import { withdrawListing } from "../selling/publication.server";
import { changeInventory } from "./commands.server";
import { readInventory, readPublicInventory } from "./queries.server";
import {
  allocateInventory,
  expireInventoryAllocations,
  releaseAllocation,
  settleAllocation,
} from "./allocations.server";
import { changeBuyerCart, readBuyerCart } from "../buyer-cart/cart.server";
import {
  readOffers,
  changeOffer,
  recoverOfferRequest,
} from "../offers/offers.server";
import { parseOfferMutation } from "../offers/recovery-model";
import { libraryActorKey } from "../library/cursor.server";
import { openListingConversation } from "../messaging/participants.server";
import { readConversation, readInbox } from "../messaging/inbox.server";
import { readPublicDiscovery } from "../catalog/public-discovery.server";
import type { InventoryOperation } from "./model";
export function defineInventoryIntegrationCases(
  get: () => PublicationFixtureContext,
) {
  describe("stock, cart and offers through actual PostgreSQL transactions", () => {
    const actors = Array.from({ length: 4 }, (_, i) => ({
      subject: `user_t42_${i}_${randomUUID().replaceAll("-", "")}`,
    }));
    const userIds: string[] = [];
    let oldKey: string | undefined;
    let originalPolicy: {
      state: string;
      enabled: boolean;
      reference: string | null;
      reviewed: Date | null;
    };
    beforeAll(async () => {
      const ctx = get();
      oldKey = process.env.TREIDO_DISCOVERY_CURSOR_KEY;
      process.env.TREIDO_DISCOVERY_CURSOR_KEY = randomBytes(32).toString("hex");
      originalPolicy = (
        await ctx.admin.query(
          "SELECT state,enabled_for_publish AS enabled,review_reference AS reference,reviewed_at AS reviewed FROM treido.category_policies WHERE category_id='cat:electronics/phones' AND version=1",
        )
      ).rows[0];
      await ctx.admin.query(
        "UPDATE treido.category_policies SET state='reviewed',enabled_for_publish=true,review_reference='SYNTHETIC STOCK TEST ONLY',reviewed_at=clock_timestamp() WHERE category_id='cat:electronics/phones' AND version=1",
      );
      for (const actor of actors)
        userIds.push(
          (
            await inTransaction(ctx.database, (tx) =>
              authorizeHuman(tx, actor, true),
            )
          ).id,
        );
    });
    afterAll(async () => {
      if (oldKey === undefined) delete process.env.TREIDO_DISCOVERY_CURSOR_KEY;
      else process.env.TREIDO_DISCOVERY_CURSOR_KEY = oldKey;
      if (originalPolicy)
        await get().admin.query(
          "UPDATE treido.category_policies SET state=$1,enabled_for_publish=$2,review_reference=$3,reviewed_at=$4 WHERE category_id='cat:electronics/phones' AND version=1",
          [
            originalPolicy.state,
            originalPolicy.enabled,
            originalPolicy.reference,
            originalPolicy.reviewed,
          ],
        );
    });
    const prepare = async (
      mode: "unique" | "stocked" = "unique",
      quantity = 1,
      existingSeller?: string,
    ) => {
      const ctx = get(),
        f = await createPublicationFixture(ctx, "business", existingSeller);
      const stock = await changeInventory(ctx.database, ctx.owner, {
        sellerId: f.sellerId,
        listingId: f.draft.id,
        expectedRevision: 0,
        requestId: randomUUID(),
        operation: { kind: "setup", mode, onHand: quantity, sellerSku: "" },
      });
      return { ...f, skuId: stock.skuId };
    };
    const publish = async (f: Awaited<ReturnType<typeof prepare>>) => {
      const ctx = get(),
        view = await readInventory(ctx.database, ctx.owner, {
          sellerId: f.sellerId,
          listingId: f.draft.id,
        });
      return publishListing(ctx.database, ctx.owner, {
        ...f.input,
        expectedRevision: view.listingRevision,
        requestId: randomUUID(),
      });
    };
    const edit = async (
      f: Awaited<ReturnType<typeof prepare>>,
      operation: InventoryOperation,
    ) => {
      const ctx = get(),
        view = await readInventory(ctx.database, ctx.owner, {
          sellerId: f.sellerId,
          listingId: f.draft.id,
        });
      return changeInventory(ctx.database, ctx.owner, {
        sellerId: f.sellerId,
        listingId: f.draft.id,
        expectedRevision: view.revision,
        requestId: randomUUID(),
        operation,
      });
    };
    const reserve = async (
      f: Awaited<ReturnType<typeof prepare>>,
      revision: number,
      buyer = 0,
      quantity = 1,
    ) =>
      inTransaction(get().database, (tx) =>
        allocateInventory(tx, {
          sellerId: f.sellerId,
          buyerId: userIds[buyer],
          actorId: userIds[buyer],
          sourceId: randomUUID(),
          purpose: "checkout",
          lines: [
            {
              listingId: f.draft.id,
              skuId: f.skuId,
              publicationRevision: revision,
              quantity,
              unitPriceMinor: 12900,
            },
          ],
        }),
      );
    async function compete<T>(
      listingId: string,
      work: () => Promise<PromiseSettledResult<T>[]>,
    ) {
      const admin = get().admin;
      await admin.query("BEGIN");
      await admin.query(
        "SELECT id FROM treido.listings WHERE id=$1 FOR UPDATE",
        [listingId],
      );
      const pending = work();
      let waiting = 0;
      try {
        for (let i = 0; i < 100; i++) {
          await admin.query("SELECT pg_stat_clear_snapshot()");
          waiting = (
            await admin.query<{ count: number }>(
              "SELECT count(*)::int AS count FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE '%treido.listings%'",
            )
          ).rows[0].count;
          if (waiting >= 2) break;
          await pause(20);
        }
      } finally {
        await admin.query("COMMIT");
      }
      const results = await pending;
      expect(waiting).toBeGreaterThanOrEqual(2);
      return results;
    }
    it("atomically adjusts explicit stock rows and preserves idempotency after reload", async () => {
      const ctx = get(),
        first = await prepare("stocked", 5),
        second = await prepare("stocked", 7, first.sellerId);
      const command = {
        sellerId: first.sellerId,
        requestId: randomUUID(),
        reason: "Warehouse recount",
        reasonKind: "adjustment",
        lines: [
          {
            listingId: first.draft.id,
            skuId: first.skuId,
            expectedRevision: 1,
            onHand: 8,
          },
          {
            listingId: second.draft.id,
            skuId: second.skuId,
            expectedRevision: 1,
            onHand: 9,
          },
        ],
      };
      const [one, two] = await Promise.all([
        changeStockBatch(ctx.database, ctx.owner, command),
        changeStockBatch(ctx.database, ctx.owner, command),
      ]);
      expect(one).toEqual(two);
      for (const f of [first, second])
        expect(
          (
            await readInventory(ctx.database, ctx.owner, {
              sellerId: f.sellerId,
              listingId: f.draft.id,
            })
          ).revision,
        ).toBe(2);
      await expect(
        changeStockBatch(ctx.database, actors[0], command),
      ).rejects.toBeTruthy();
      await expect(
        changeStockBatch(ctx.database, ctx.owner, {
          ...command,
          reason: "Other reason",
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      const csv = await exportInventoryPage(
        ctx.database,
        ctx.owner,
        first.sellerId,
        { q: "", status: "all" },
      );
      expect(csv.count).toBe(2);
      expect(csv.csv).toContain(first.skuId);
      expect(csv.csv).not.toContain("clerk");
      await expect(
        ctx.database.pool.query(
          "UPDATE treido.inventory_batch_receipts SET result='{}'",
        ),
      ).rejects.toMatchObject({ code: "42501" });
    });
    it("rolls back the whole stock batch when one selected SKU is reserved or stale", async () => {
      const ctx = get(),
        one = await prepare("stocked", 5),
        two = await prepare("stocked", 5, one.sellerId),
        ordered = [one, two].sort((a, b) =>
          a.draft.id.localeCompare(b.draft.id),
        );
      const publication = await publish(ordered[1]);
      await reserve(ordered[1], publication.revision, 0, 2);
      const stock = await readInventory(ctx.database, ctx.owner, {
        sellerId: one.sellerId,
        listingId: ordered[1].draft.id,
      });
      const command = {
        sellerId: one.sellerId,
        requestId: randomUUID(),
        reason: "Recount with hold",
        reasonKind: "adjustment",
        lines: ordered.map((f, index) => ({
          listingId: f.draft.id,
          skuId: f.skuId,
          expectedRevision: index ? stock.revision : 1,
          onHand: index ? 0 : 8,
        })),
      };
      await expect(
        changeStockBatch(ctx.database, ctx.owner, command),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(
        (
          await readInventory(ctx.database, ctx.owner, {
            sellerId: one.sellerId,
            listingId: ordered[0].draft.id,
          })
        ).skus[0].onHand,
      ).toBe(5);
      expect(
        (
          await ctx.admin.query(
            "SELECT count(*)::int AS n FROM treido.inventory_batch_receipts WHERE request_id=$1",
            [command.requestId],
          )
        ).rows[0].n,
      ).toBe(0);
    });
    it("records pending-offer and accepted-hold expiry durably without inventing a payment or human message", async () => {
      const ctx = get(),
        f = await prepare("stocked", 4),
        published = await publish(f),
        thread = await openListingConversation(
          ctx.database,
          actors[0],
          f.draft.id,
        );
      const query = { threadId: thread.id, sellerId: null };
      const first = await changeOffer(ctx.database, actors[0], {
        ...query,
        requestId: randomUUID(),
        expectedRevision: 0,
        operation: {
          kind: "propose",
          parentId: null,
          skuId: f.skuId,
          publicationRevision: published.revision,
          quantity: 1,
          unitPriceMinor: 10000,
          expiresHours: 1,
        },
      });
      await ctx.admin.query(
        "UPDATE treido.listing_offers SET created_at=clock_timestamp()-interval '3 hours',expires_at=clock_timestamp()-interval '2 hours' WHERE id=$1",
        [first.offerId],
      );
      await Promise.all([
        expireOffers(ctx.database),
        expireOffers(ctx.database),
      ]);
      let view = await readOffers(ctx.database, actors[0], query);
      expect(view.items[0]).toMatchObject({
        state: "expired",
        timerHistory: [{ kind: "expired" }],
      });
      expect(
        (await readConversation(ctx.database, actors[0], query)).messages,
      ).toHaveLength(1);
      const second = await changeOffer(ctx.database, actors[0], {
        ...query,
        requestId: randomUUID(),
        expectedRevision: view.revision,
        operation: {
          kind: "propose",
          parentId: null,
          skuId: f.skuId,
          publicationRevision: published.revision,
          quantity: 2,
          unitPriceMinor: 10000,
          expiresHours: 1,
        },
      });
      view = await readOffers(ctx.database, ctx.owner, {
        ...query,
        sellerId: f.sellerId,
      });
      await changeOffer(ctx.database, ctx.owner, {
        threadId: thread.id,
        sellerId: f.sellerId,
        requestId: randomUUID(),
        expectedRevision: view.revision,
        operation: { kind: "accept", offerId: second.offerId },
      });
      await ctx.admin.query(
        "UPDATE treido.inventory_allocations SET created_at=clock_timestamp()-interval '3 hours',expires_at=clock_timestamp()-interval '2 hours' WHERE source_id=$1",
        [second.offerId],
      );
      await Promise.all([
        expireOffers(ctx.database),
        expireOffers(ctx.database),
      ]);
      view = await readOffers(ctx.database, actors[0], query);
      expect(view.items[0]).toMatchObject({
        state: "accepted",
        holdState: "expired",
        timerHistory: [{ kind: "hold_expired" }],
      });
      expect(
        (await readPublicInventory(ctx.database, f.draft.id))?.skus[0]
          .available,
      ).toBe(4);
      expect(
        (
          await ctx.admin.query(
            "SELECT count(*)::int AS n FROM treido.offer_events WHERE offer_id=ANY($1::uuid[]) AND actor_id IS NULL",
            [[first.offerId, second.offerId]],
          )
        ).rows[0].n,
      ).toBe(2);
    });
    it("keeps inventory opt-in, binds personal quantity one, and invalidates stale publication reviews", async () => {
      const ctx = get(),
        freshOwner = {
          subject: `user_t42_personal_${randomUUID().replaceAll("-", "")}`,
        },
        f = await createPublicationFixture(
          { ...ctx, owner: freshOwner },
          "personal",
        );
      const scope = { sellerId: f.sellerId, listingId: f.draft.id };
      const before = (
        await ctx.admin.query(
          "SELECT count(*) FROM treido.inventory_catalogues",
        )
      ).rows[0].count;
      expect(
        (await readInventory(ctx.database, freshOwner, scope)).mode,
      ).toBeNull();
      expect(
        (
          await ctx.admin.query(
            "SELECT count(*) FROM treido.inventory_catalogues",
          )
        ).rows[0].count,
      ).toBe(before);
      await expect(
        changeInventory(ctx.database, freshOwner, {
          ...scope,
          expectedRevision: 0,
          requestId: randomUUID(),
          operation: {
            kind: "setup",
            mode: "stocked",
            onHand: 5,
            sellerSku: "",
          },
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      const command = {
        ...scope,
        expectedRevision: 0,
        requestId: randomUUID(),
        operation: {
          kind: "setup",
          mode: "unique",
          onHand: 1,
          sellerSku: "personal",
        },
      };
      const result = await changeInventory(ctx.database, freshOwner, command);
      expect(await changeInventory(ctx.database, freshOwner, command)).toEqual(
        result,
      );
      await expect(
        publishListing(ctx.database, freshOwner, f.input),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(
        readInventory(ctx.database, actors[0], scope),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      const publication = await publishListing(ctx.database, freshOwner, {
        ...f.input,
        requestId: randomUUID(),
        expectedRevision: result.listingRevision,
      });
      expect(
        await readPublicInventory(
          ctx.database,
          f.draft.id,
          publication.revision,
        ),
      ).toMatchObject({
        mode: "unique",
        state: "available",
        skus: [{ available: 1 }],
      });
    });
    it("publishes real variant definitions and starting prices without trusting later private edits", async () => {
      const ctx = get(),
        f = await prepare("stocked", 3);
      await edit(f, {
        kind: "variant",
        skuId: f.skuId,
        sellerSku: "red-" + randomUUID(),
        options: { Color: "Red" },
        priceMinor: 12000,
      });
      const second = await edit(f, {
        kind: "variant",
        skuId: null,
        sellerSku: "blue-" + randomUUID(),
        options: { Color: "Blue" },
        priceMinor: 14000,
        onHand: 2,
      });
      await expect(
        edit(f, {
          kind: "variant",
          skuId: null,
          sellerSku: "",
          options: { color: "RED" },
          priceMinor: null,
          onHand: 1,
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      const accepted = await publish(f),
        view = await readPublicInventory(
          ctx.database,
          f.draft.id,
          accepted.revision,
        );
      expect(view?.skus.map((sku) => sku.priceMinor).sort()).toEqual([
        12000, 14000,
      ]);
      const discovery = await readPublicDiscovery(
        ctx.database,
        {},
        { sellerId: f.sellerId, key: randomBytes(32) },
      );
      expect(discovery.items[0]).toMatchObject({
        price: { amount: 12000 },
        priceFrom: true,
        stockState: "available",
      });
      await expect(
        edit(f, {
          kind: "variant",
          skuId: second.skuId,
          sellerSku: "changed",
          options: { Color: "Green" },
          priceMinor: 1,
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await edit(f, {
        kind: "stock",
        skuId: f.skuId,
        onHand: 0,
        reason: "Sold outside Treido",
        reasonKind: "reported_sale",
      });
      expect(
        (await readPublicInventory(ctx.database, f.draft.id))?.skus.find(
          (sku) => sku.id === f.skuId,
        ),
      ).toMatchObject({
        available: 0,
        priceMinor: 12000,
        options: { Color: "Red" },
      });
    });
    it("persists a grouped account cart, retries once and never reserves on add or read", async () => {
      const ctx = get(),
        a = await prepare("stocked", 5),
        b = await prepare(),
        ap = await publish(a),
        bp = await publish(b);
      const initial = await readBuyerCart(ctx.database, actors[0]);
      const first = {
        actorKey: initial.actorKey,
        requestId: randomUUID(),
        expectedRevision: initial.revision,
        operation: {
          kind: "add",
          listingId: a.draft.id,
          skuId: a.skuId,
          publicationRevision: ap.revision,
          quantity: 2,
        },
      };
      const before = (
        await ctx.admin.query(
          "SELECT count(*) FROM treido.inventory_allocations",
        )
      ).rows[0].count;
      const result = await changeBuyerCart(ctx.database, actors[0], first);
      expect(await changeBuyerCart(ctx.database, actors[0], first)).toEqual(
        result,
      );
      await changeBuyerCart(ctx.database, actors[0], {
        actorKey: initial.actorKey,
        requestId: randomUUID(),
        expectedRevision: result.revision,
        operation: {
          kind: "add",
          listingId: b.draft.id,
          skuId: b.skuId,
          publicationRevision: bp.revision,
          quantity: 1,
        },
      });
      const fresh = createDatabase(new Pool(ctx.database.pool.options));
      try {
        const view = await readBuyerCart(fresh, actors[0]);
        expect(view.lines).toHaveLength(2);
        expect(
          new Set(view.lines.map((line) => line.item?.sellerId)).size,
        ).toBe(2);
      } finally {
        await fresh.pool.end();
      }
      expect(
        (
          await ctx.admin.query(
            "SELECT count(*) FROM treido.inventory_allocations",
          )
        ).rows[0].count,
      ).toBe(before);
      expect((await readBuyerCart(ctx.database, actors[1])).lines).toHaveLength(
        0,
      );
      await expect(
        changeBuyerCart(ctx.database, actors[1], first),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        changeBuyerCart(ctx.database, actors[0], first),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });
    it("requires cart reconfirmation after republication and reports physical shortages", async () => {
      const ctx = get(),
        f = await prepare("stocked", 3),
        original = await publish(f);
      const initial = await readBuyerCart(ctx.database, actors[1]);
      await changeBuyerCart(ctx.database, actors[1], {
        actorKey: initial.actorKey,
        expectedRevision: initial.revision,
        requestId: randomUUID(),
        operation: {
          kind: "add",
          listingId: f.draft.id,
          skuId: f.skuId,
          publicationRevision: original.revision,
          quantity: 2,
        },
      });
      await withdrawListing(ctx.database, ctx.owner, {
        sellerId: f.sellerId,
        listingId: f.draft.id,
        expectedRevision: original.revision,
        requestId: randomUUID(),
      });
      await edit(f, {
        kind: "variant",
        skuId: f.skuId,
        sellerSku: "",
        options: {},
        priceMinor: 13900,
      });
      const replacement = await publish(f),
        changed = await readBuyerCart(ctx.database, actors[1]);
      expect(
        changed.lines.find((line) => line.skuId === f.skuId),
      ).toMatchObject({
        state: "changed",
        quantity: 2,
        item: { priceMinor: 13900 },
      });
      await expect(
        changeBuyerCart(ctx.database, actors[1], {
          actorKey: initial.actorKey,
          expectedRevision: changed.revision,
          requestId: randomUUID(),
          operation: {
            kind: "set",
            listingId: f.draft.id,
            skuId: f.skuId,
            publicationRevision: original.revision,
            quantity: 2,
          },
        }),
      ).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
      await changeBuyerCart(ctx.database, actors[1], {
        actorKey: initial.actorKey,
        expectedRevision: changed.revision,
        requestId: randomUUID(),
        operation: {
          kind: "set",
          listingId: f.draft.id,
          skuId: f.skuId,
          publicationRevision: replacement.revision,
          quantity: 2,
        },
      });
      expect(
        (await readBuyerCart(ctx.database, actors[1])).lines.find(
          (line) => line.skuId === f.skuId,
        )?.state,
      ).toBe("ready");
      await edit(f, {
        kind: "stock",
        skuId: f.skuId,
        onHand: 1,
        reason: "Physical count correction",
        reasonKind: "adjustment",
      });
      expect(
        (await readBuyerCart(ctx.database, actors[1])).lines.find(
          (line) => line.skuId === f.skuId,
        )?.state,
      ).toBe("shortage");
    });
    it("allows only one concurrent claimant of a unique item and protects held quantity from edits", async () => {
      const ctx = get(),
        f = await prepare(),
        p = await publish(f);
      const results = await compete(f.draft.id, () =>
        Promise.allSettled([
          reserve(f, p.revision, 0),
          reserve(f, p.revision, 1),
        ]),
      );
      const winners = results.filter((result) => result.status === "fulfilled");
      expect(winners).toHaveLength(1);
      expect((await readPublicInventory(ctx.database, f.draft.id))?.state).toBe(
        "reserved",
      );
      await expect(
        edit(f, {
          kind: "stock",
          skuId: f.skuId,
          onHand: 0,
          reason: "Cannot steal a reservation",
          reasonKind: "reported_sale",
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(
        results
          .filter((result) => result.status === "rejected")
          .map((result) => result.reason.code),
      ).toEqual(["CONFLICT"]);
      const allocation = winners[0].value;
      await inTransaction(ctx.database, (tx) =>
        releaseAllocation(tx, allocation.id, allocation.buyerId, "cancelled"),
      );
      expect((await readPublicInventory(ctx.database, f.draft.id))?.state).toBe(
        "available",
      );
    });
    it("bounds stocked reservations and rolls back every line when any SKU is unavailable", async () => {
      const ctx = get(),
        f = await prepare("stocked", 2),
        p = await publish(f);
      const results = await Promise.allSettled([
        reserve(f, p.revision, 0),
        reserve(f, p.revision, 1),
        reserve(f, p.revision, 2),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(2);
      const empty = await prepare("stocked", 0, f.sellerId),
        ep = await publish(empty);
      const available = await prepare("stocked", 3, f.sellerId),
        avp = await publish(available);
      const before = (
        await ctx.admin.query(
          "SELECT count(*) FROM treido.inventory_allocations",
        )
      ).rows[0].count;
      await expect(
        inTransaction(ctx.database, (tx) =>
          allocateInventory(tx, {
            sellerId: f.sellerId,
            buyerId: userIds[3],
            actorId: userIds[3],
            purpose: "checkout",
            sourceId: randomUUID(),
            lines: [
              {
                listingId: available.draft.id,
                skuId: available.skuId,
                publicationRevision: avp.revision,
                unitPriceMinor: 12900,
                quantity: 1,
              },
              {
                listingId: empty.draft.id,
                skuId: empty.skuId,
                publicationRevision: ep.revision,
                unitPriceMinor: 12900,
                quantity: 1,
              },
            ],
          }),
        ),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(
        (
          await ctx.admin.query(
            "SELECT count(*) FROM treido.inventory_allocations",
          )
        ).rows[0].count,
      ).toBe(before);
      expect(
        (await readPublicInventory(ctx.database, available.draft.id))?.skus[0]
          .available,
      ).toBe(3);
    });
    it("expires holds on database time and quarantines late settlement without taking new stock", async () => {
      const ctx = get(),
        f = await prepare(),
        p = await publish(f),
        old = await reserve(f, p.revision);
      await ctx.admin.query(
        "UPDATE treido.inventory_allocations SET created_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
        [old.id],
      );
      expect((await readPublicInventory(ctx.database, f.draft.id))?.state).toBe(
        "available",
      );
      const newer = await reserve(f, p.revision, 1);
      expect(
        (await expireInventoryAllocations(ctx.database)).expired,
      ).toBeGreaterThan(0);
      expect(
        await inTransaction(ctx.database, (tx) =>
          settleAllocation(tx, old.id, "test:late-payment"),
        ),
      ).toBe("reconciliation");
      expect(
        (
          await readInventory(ctx.database, ctx.owner, {
            sellerId: f.sellerId,
            listingId: f.draft.id,
          })
        ).skus[0],
      ).toMatchObject({ onHand: 1, reserved: 1 });
      const beforeSettlement = await readInventory(ctx.database, ctx.owner, {
        sellerId: f.sellerId,
        listingId: f.draft.id,
      });
      expect(
        await inTransaction(ctx.database, (tx) =>
          settleAllocation(tx, newer.id, "test:on-time"),
        ),
      ).toBe("consumed");
      expect(
        await inTransaction(ctx.database, (tx) =>
          settleAllocation(tx, newer.id, "test:on-time"),
        ),
      ).toBe("consumed");
      await expect(
        changeInventory(ctx.database, ctx.owner, {
          sellerId: f.sellerId,
          listingId: f.draft.id,
          requestId: randomUUID(),
          expectedRevision: beforeSettlement.revision,
          operation: {
            kind: "stock",
            skuId: f.skuId,
            onHand: 1,
            reason: "Stale stock screen",
            reasonKind: "restock",
          },
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect((await readPublicInventory(ctx.database, f.draft.id))?.state).toBe(
        "out_of_stock",
      );
      await expect(
        inTransaction(ctx.database, (tx) =>
          settleAllocation(tx, newer.id, "test:other-payment"),
        ),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });
    it("keeps counter terms immutable, accepts exactly once and renders durable offer messages", async () => {
      const ctx = get(),
        f = await prepare("stocked", 4),
        p = await publish(f);
      const thread = await openListingConversation(
        ctx.database,
        actors[2],
        f.draft.id,
      );
      const proposal = await changeOffer(ctx.database, actors[2], {
        sellerId: null,
        threadId: thread.id,
        expectedRevision: 0,
        requestId: randomUUID(),
        operation: {
          kind: "propose",
          parentId: null,
          skuId: f.skuId,
          publicationRevision: p.revision,
          quantity: 2,
          unitPriceMinor: 11000,
          expiresHours: 24,
        },
      });
      const counter = await changeOffer(ctx.database, ctx.owner, {
        sellerId: f.sellerId,
        threadId: thread.id,
        expectedRevision: proposal.revision,
        requestId: randomUUID(),
        operation: {
          kind: "propose",
          parentId: proposal.offerId,
          skuId: f.skuId,
          publicationRevision: p.revision,
          quantity: 2,
          unitPriceMinor: 11500,
          expiresHours: 1,
        },
      });
      const accept = {
        sellerId: null,
        threadId: thread.id,
        expectedRevision: counter.revision,
        requestId: randomUUID(),
        operation: { kind: "accept", offerId: counter.offerId },
      };
      const result = await changeOffer(ctx.database, actors[2], accept);
      expect(await changeOffer(ctx.database, actors[2], accept)).toEqual(
        result,
      );
      const history = await readOffers(ctx.database, actors[2], {
        sellerId: null,
        threadId: thread.id,
      });
      expect(history.items).toHaveLength(2);
      expect(history.items[0]).toMatchObject({
        state: "accepted",
        unitPriceMinor: 11500,
        quantity: 2,
        holdState: "active",
      });
      expect(history.items[1]).toMatchObject({
        state: "superseded",
        unitPriceMinor: 11000,
      });
      const conversation = await readConversation(ctx.database, actors[2], {
        sellerId: null,
        threadId: thread.id,
      });
      expect(conversation.messages).toHaveLength(3);
      expect(conversation.messages.at(-1)?.offer).toMatchObject({
        kind: "accepted",
        unitPriceMinor: 11500,
        quantity: 2,
      });
      const inbox = await readInbox(ctx.database, actors[2], {
        sellerId: null,
      });
      expect(inbox.items.find((item) => item.id === thread.id)?.lastOffer).toBe(
        true,
      );
      expect(
        (await readPublicInventory(ctx.database, f.draft.id))?.skus[0]
          .available,
      ).toBe(2);
      const allocation = (
        await ctx.admin.query(
          "SELECT id FROM treido.inventory_allocations WHERE source_id=$1 AND purpose='offer'",
          [counter.offerId],
        )
      ).rows;
      expect(allocation).toHaveLength(1);
      const quoteSource = await inTransaction(ctx.database, (tx) =>
        readAcceptedOfferQuoteSource(tx, actors[2], {
          threadId: thread.id,
          offerId: counter.offerId,
        }),
      );
      expect(quoteSource).toMatchObject({
        allocationId: allocation[0].id,
        unitPriceMinor: 11500,
        quantity: 2,
        currency: "EUR",
      });
      expect(quoteSource.expiresAt).toBe(history.items[0].holdUntil);
      await expect(
        inTransaction(ctx.database, (tx) =>
          readAcceptedOfferQuoteSource(tx, actors[1], {
            threadId: thread.id,
            offerId: counter.offerId,
          }),
        ),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        ctx.database.pool.query(
          "UPDATE treido.listing_offers SET unit_price_minor=1 WHERE id=$1",
          [counter.offerId],
        ),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        ctx.database.pool.query(
          "UPDATE treido.offer_events SET kind='created'",
        ),
      ).rejects.toMatchObject({ code: "42501" });
    });
    it("recovers immutable original offer receipts after later transitions without reallocating or guessing network absence", async () => {
      const ctx = get(),
        f = await prepare("stocked", 3),
        publication = await publish(f);
      const thread = await openListingConversation(
        ctx.database,
        actors[2],
        f.draft.id,
      );
      const command = {
        sellerId: null,
        threadId: thread.id,
        expectedRevision: 0,
        requestId: randomUUID(),
        operation: {
          kind: "propose",
          parentId: null,
          skuId: f.skuId,
          publicationRevision: publication.revision,
          quantity: 2,
          unitPriceMinor: 11200,
          expiresHours: 24,
        },
      };
      const actorKey = libraryActorKey(actors[2]);
      const proposal = await changeOffer(ctx.database, actors[2], command);
      const accepted = await changeOffer(ctx.database, ctx.owner, {
        sellerId: f.sellerId,
        threadId: thread.id,
        expectedRevision: proposal.revision,
        requestId: randomUUID(),
        operation: { kind: "accept", offerId: proposal.offerId },
      });
      const stock = await readInventory(ctx.database, ctx.owner, {
        sellerId: f.sellerId,
        listingId: f.draft.id,
      });
      const count = (
        await ctx.admin.query(
          "SELECT count(*)::int AS n FROM treido.inventory_allocations WHERE source_id=$1",
          [proposal.offerId],
        )
      ).rows[0].n;
      await expect(
        changeOffer(ctx.database, actors[2], command),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      for (let repeat = 0; repeat < 2; repeat++)
        expect(
          await recoverOfferRequest(ctx.database, actors[2], {
            actorKey,
            command,
          }),
        ).toMatchObject({
          state: "recorded",
          acceptedRevision: proposal.revision,
          currentRevision: accepted.revision,
          offerId: proposal.offerId,
        });
      expect(
        await recoverOfferRequest(ctx.database, actors[2], {
          actorKey,
          command: { ...command, requestId: randomUUID() },
        }),
      ).toMatchObject({ state: "not_applied", offerId: null });
      expect(
        await recoverOfferRequest(ctx.database, actors[2], {
          actorKey,
          command: {
            ...command,
            requestId: randomUUID(),
            expectedRevision: accepted.revision,
          },
        }),
      ).toMatchObject({ state: "unrecorded", offerId: null });
      await expect(
        recoverOfferRequest(ctx.database, actors[1], { actorKey, command }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        recoverOfferRequest(ctx.database, actors[2], {
          actorKey,
          command: {
            ...command,
            operation: { ...command.operation, unitPriceMinor: 1 },
          },
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(
        await readInventory(ctx.database, ctx.owner, {
          sellerId: f.sellerId,
          listingId: f.draft.id,
        }),
      ).toEqual(stock);
      expect(
        (
          await ctx.admin.query(
            "SELECT count(*)::int AS n FROM treido.inventory_allocations WHERE source_id=$1",
            [proposal.offerId],
          )
        ).rows[0].n,
      ).toBe(count);
    });
    it("offers and checkout compete through the same allocation lock instead of overselling", async () => {
      const ctx = get(),
        f = await prepare(),
        p = await publish(f),
        thread = await openListingConversation(
          ctx.database,
          actors[0],
          f.draft.id,
        );
      const offer = await changeOffer(ctx.database, actors[0], {
        sellerId: null,
        threadId: thread.id,
        expectedRevision: 0,
        requestId: randomUUID(),
        operation: {
          kind: "propose",
          parentId: null,
          skuId: f.skuId,
          publicationRevision: p.revision,
          quantity: 1,
          unitPriceMinor: 10000,
          expiresHours: 24,
        },
      });
      const results = await compete<unknown>(f.draft.id, () =>
        Promise.allSettled([
          changeOffer(ctx.database, ctx.owner, {
            sellerId: f.sellerId,
            threadId: thread.id,
            expectedRevision: offer.revision,
            requestId: randomUUID(),
            operation: { kind: "accept", offerId: offer.offerId },
          }),
          reserve(f, p.revision, 1),
        ]),
      );
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        results
          .filter((result) => result.status === "rejected")
          .map((result) => result.reason.code),
      ).toEqual(["CONFLICT"]);
      expect((await readPublicInventory(ctx.database, f.draft.id))?.state).toBe(
        "reserved",
      );
      expect(
        (
          await ctx.admin.query(
            "SELECT count(*)::int AS count FROM treido.inventory_allocation_lines l JOIN treido.inventory_allocations a ON a.id=l.allocation_id WHERE l.listing_id=$1 AND a.state='active'",
            [f.draft.id],
          )
        ).rows[0].count,
      ).toBe(1);
    });
    it("shows expiry honestly, permits a replacement proposal and denies wrong-party decisions", async () => {
      const ctx = get(),
        f = await prepare(),
        p = await publish(f),
        thread = await openListingConversation(
          ctx.database,
          actors[3],
          f.draft.id,
        );
      const offer = await changeOffer(ctx.database, actors[3], {
        sellerId: null,
        threadId: thread.id,
        expectedRevision: 0,
        requestId: randomUUID(),
        operation: {
          kind: "propose",
          parentId: null,
          skuId: f.skuId,
          publicationRevision: p.revision,
          quantity: 1,
          unitPriceMinor: 9000,
          expiresHours: 1,
        },
      });
      await expect(
        changeOffer(ctx.database, actors[3], {
          sellerId: null,
          threadId: thread.id,
          expectedRevision: offer.revision,
          requestId: randomUUID(),
          operation: { kind: "accept", offerId: offer.offerId },
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await ctx.admin.query(
        "UPDATE treido.listing_offers SET created_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
        [offer.offerId],
      );
      expect(
        (
          await readOffers(ctx.database, actors[3], {
            threadId: thread.id,
            sellerId: null,
          })
        ).items[0].state,
      ).toBe("expired");
      await expect(
        changeOffer(ctx.database, ctx.owner, {
          sellerId: f.sellerId,
          threadId: thread.id,
          expectedRevision: offer.revision,
          requestId: randomUUID(),
          operation: { kind: "accept", offerId: offer.offerId },
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      const replacement = await changeOffer(ctx.database, actors[3], {
        sellerId: null,
        threadId: thread.id,
        expectedRevision: offer.revision,
        requestId: randomUUID(),
        operation: {
          kind: "propose",
          parentId: null,
          skuId: f.skuId,
          publicationRevision: p.revision,
          quantity: 1,
          unitPriceMinor: 9500,
          expiresHours: 24,
        },
      });
      await changeOffer(ctx.database, actors[3], {
        sellerId: null,
        threadId: thread.id,
        expectedRevision: replacement.revision,
        requestId: randomUUID(),
        operation: { kind: "withdraw", offerId: replacement.offerId },
      });
      await expect(
        readOffers(ctx.database, actors[1], {
          threadId: thread.id,
          sellerId: null,
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
    it("rechecks current staff access on inventory and offer retries", async () => {
      const ctx = get(),
        f = await prepare(),
        p = await publish(f),
        staff = actors[1];
      await ctx.admin.query(
        "INSERT INTO treido.seller_memberships(seller_id,user_id,role,grants) VALUES($1,$2,'manager','[]')",
        [f.sellerId, userIds[1]],
      );
      const thread = await openListingConversation(
        ctx.database,
        actors[0],
        f.draft.id,
      );
      const proposed = await changeOffer(ctx.database, actors[0], {
        sellerId: null,
        threadId: thread.id,
        expectedRevision: 0,
        requestId: randomUUID(),
        operation: {
          kind: "propose",
          parentId: null,
          skuId: f.skuId,
          publicationRevision: p.revision,
          quantity: 1,
          unitPriceMinor: 12000,
          expiresHours: 24,
        },
      });
      const command = {
        sellerId: f.sellerId,
        threadId: thread.id,
        expectedRevision: proposed.revision,
        requestId: randomUUID(),
        operation: { kind: "reject", offerId: proposed.offerId },
      };
      await changeOffer(ctx.database, staff, command);
      await revokeSellerMembership(ctx.database, ctx.owner, {
        sellerId: f.sellerId,
        userId: userIds[1],
      });
      await expect(
        changeOffer(ctx.database, staff, command),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        readInventory(ctx.database, staff, {
          sellerId: f.sellerId,
          listingId: f.draft.id,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it("retains a redacted cart and offer history after withdrawal while allowing reservation cancellation", async () => {
      const ctx = get(),
        f = await prepare(),
        p = await publish(f),
        cart = await readBuyerCart(ctx.database, actors[3]);
      await changeBuyerCart(ctx.database, actors[3], {
        actorKey: cart.actorKey,
        expectedRevision: cart.revision,
        requestId: randomUUID(),
        operation: {
          kind: "add",
          listingId: f.draft.id,
          skuId: f.skuId,
          publicationRevision: p.revision,
          quantity: 1,
        },
      });
      const thread = await openListingConversation(
        ctx.database,
        actors[3],
        f.draft.id,
      );
      const proposal = await changeOffer(ctx.database, actors[3], {
        sellerId: null,
        threadId: thread.id,
        expectedRevision: 0,
        requestId: randomUUID(),
        operation: {
          kind: "propose",
          parentId: null,
          skuId: f.skuId,
          publicationRevision: p.revision,
          quantity: 1,
          unitPriceMinor: 12000,
          expiresHours: 24,
        },
      });
      const accepted = await changeOffer(ctx.database, ctx.owner, {
        sellerId: f.sellerId,
        threadId: thread.id,
        expectedRevision: proposal.revision,
        requestId: randomUUID(),
        operation: { kind: "accept", offerId: proposal.offerId },
      });
      await withdrawListing(ctx.database, ctx.owner, {
        sellerId: f.sellerId,
        listingId: f.draft.id,
        expectedRevision: p.revision,
        requestId: randomUUID(),
      });
      expect(await readPublicInventory(ctx.database, f.draft.id)).toBeNull();
      const withdrawnCart = await readBuyerCart(ctx.database, actors[3]);
      expect(
        withdrawnCart.lines.find((line) => line.skuId === f.skuId),
      ).toMatchObject({ item: null, state: "unavailable" });
      await changeOffer(ctx.database, actors[3], {
        sellerId: null,
        threadId: thread.id,
        expectedRevision: accepted.revision,
        requestId: randomUUID(),
        operation: { kind: "cancel", offerId: proposal.offerId },
      });
      expect(
        (
          await readOffers(ctx.database, actors[3], {
            sellerId: null,
            threadId: thread.id,
          })
        ).items[0],
      ).toMatchObject({ state: "cancelled", holdState: "released" });
      await changeBuyerCart(ctx.database, actors[3], {
        actorKey: withdrawnCart.actorKey,
        expectedRevision: withdrawnCart.revision,
        requestId: randomUUID(),
        operation: { kind: "remove", skuId: f.skuId },
      });
      expect(
        (await readBuyerCart(ctx.database, actors[3])).lines.some(
          (line) => line.skuId === f.skuId,
        ),
      ).toBe(false);
    });
    it.skipIf(process.env.TREIDO_STOCK_BROWSER !== "1")(
      "runs the connected stock, cart and offers browser journey",
      async () => {
        const ctx = get(),
          fixture = await createPublicationFixture(ctx, "business");
        const buyer = {
          subject: `user_stock_browser_${randomUUID().replaceAll("-", "")}`,
        };
        await inTransaction(ctx.database, (tx) =>
          authorizeHuman(tx, buyer, true),
        );
        const { runInventoryBrowser } =
          await import("../../../../../tests/inventory-flow-browser.mjs");
        await runInventoryBrowser({
          database: ctx.database,
          fixture,
          owner: ctx.owner,
          buyer,
          api: {
            readInventory,
            changeInventory,
            readPublicInventory,
            readBuyerCart,
            changeBuyerCart,
            readOffers,
            changeOffer,
            recoverOfferRequest,
            parseOfferMutation,
            libraryActorKey,
            readDiscoveryInput,
            readPublicDiscovery,
            readPublicSeller,
            readPublishedListing,
            readPublishedPhoto,
            readSellerContext,
            publishListing,
            openListingConversation,
            readConversation,
          },
        });
      },
      180000,
    );
    it("prevents runtime rewriting ownership, accepted variants, deadlines and stock audit", async () => {
      const db = get().database;
      for (const sql of [
        "UPDATE treido.inventory_skus SET seller_id=gen_random_uuid()",
        "UPDATE treido.inventory_allocations SET expires_at=clock_timestamp()+interval '1 year'",
        "UPDATE treido.inventory_publication_skus SET price_minor=1",
        "UPDATE treido.inventory_events SET quantity=0",
        "UPDATE treido.buyer_cart_receipts SET accepted_revision=100",
        "UPDATE treido.buyer_cart_lines SET user_id=gen_random_uuid()",
        "UPDATE treido.offer_command_receipts SET accepted_revision=100",
      ])
        await expect(db.pool.query(sql)).rejects.toMatchObject({
          code: "42501",
        });
    });
  });
}
