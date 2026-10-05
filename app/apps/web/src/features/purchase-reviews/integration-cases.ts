import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { inTransaction } from "../../server/db/database";
import {
  createPublicationFixture,
  type PublicationFixtureContext,
} from "../../../tests/fixtures/publication-flow";
import { authorizeHuman } from "../sellers/persistence.server";
import { changeInventory } from "../inventory/commands.server";
import {
  readInventory,
  readPublicInventory,
} from "../inventory/queries.server";
import { publishListing } from "../selling/publish.server";
import { withdrawListing } from "../selling/publication.server";
import { changeBuyerCart, readBuyerCart } from "../buyer-cart/cart.server";
import { libraryActorKey } from "../library/cursor.server";
import { changeOffer } from "../offers/offers.server";
import {
  openListingConversation,
  readConversationMessages,
} from "../messaging/participants.server";
import {
  createPurchaseReview,
  readPurchaseReview,
  readPurchaseReviews,
  editPurchaseReview,
  sendPurchaseReview,
} from "./persistence.server";
import { readReservationQueue } from "./reservations.server";
export function definePurchaseReviewIntegrationCases(
  get: () => PublicationFixtureContext,
) {
  const human = () => ({
    subject: "user_review_" + randomUUID().replaceAll("-", ""),
  });
  const prepare = async (existingSellerId?: string) => {
    const ctx = get(),
      f = await createPublicationFixture(ctx, "business", existingSellerId);
    const stock = await changeInventory(ctx.database, ctx.owner, {
      sellerId: f.sellerId,
      listingId: f.draft.id,
      expectedRevision: 0,
      requestId: randomUUID(),
      operation: { kind: "setup", mode: "stocked", onHand: 5, sellerSku: "" },
    });
    const publication = await publishListing(ctx.database, ctx.owner, {
      ...f.input,
      expectedRevision: stock.listingRevision,
      requestId: randomUUID(),
    });
    return {
      ...f,
      skuId: stock.skuId,
      publicationRevision: publication.revision,
    };
  };
  const cart = async (
    buyer: ReturnType<typeof human>,
    items: { f: Awaited<ReturnType<typeof prepare>>; quantity: number }[],
  ) => {
    const ctx = get();
    for (const { f, quantity } of items) {
      const previous = await readBuyerCart(ctx.database, buyer);
      await changeBuyerCart(ctx.database, buyer, {
        actorKey: previous.actorKey,
        requestId: randomUUID(),
        expectedRevision: previous.revision,
        operation: {
          kind: "add",
          listingId: f.draft.id,
          skuId: f.skuId,
          publicationRevision: f.publicationRevision,
          quantity,
        },
      });
    }
    const current = await readBuyerCart(ctx.database, buyer);
    return {
      actorKey: current.actorKey,
      requestId: randomUUID(),
      language: "en",
      handover: "pickup",
      source: {
        kind: "cart",
        sellerId: items[0].f.sellerId,
        cartRevision: current.revision,
      },
    };
  };
  const accepted = async () => {
    const ctx = get(),
      f = await prepare(),
      buyer = human(),
      thread = await openListingConversation(ctx.database, buyer, f.draft.id);
    const offer = await changeOffer(ctx.database, buyer, {
      threadId: thread.id,
      sellerId: null,
      expectedRevision: 0,
      requestId: randomUUID(),
      operation: {
        kind: "propose",
        parentId: null,
        skuId: f.skuId,
        publicationRevision: f.publicationRevision,
        quantity: 2,
        unitPriceMinor: 10000,
        expiresHours: 1,
      },
    });
    const acceptance = await changeOffer(ctx.database, ctx.owner, {
      threadId: thread.id,
      sellerId: f.sellerId,
      expectedRevision: offer.revision,
      requestId: randomUUID(),
      operation: { kind: "accept", offerId: offer.offerId },
    });
    return {
      f,
      buyer,
      thread,
      offer,
      acceptance,
      command: {
        actorKey: libraryActorKey(buyer),
        requestId: randomUUID(),
        language: "bg",
        handover: "pickup",
        source: { kind: "offer", threadId: thread.id, offerId: offer.offerId },
      },
    };
  };
  describe("purchase reviews and reservation controls on actual isolated PostgreSQL", () => {
    let oldKey: string | undefined,
      policy: {
        state: string;
        enabled: boolean;
        reference: string | null;
        reviewed: Date | null;
      };
    beforeAll(async () => {
      oldKey = process.env.TREIDO_DISCOVERY_CURSOR_KEY;
      process.env.TREIDO_DISCOVERY_CURSOR_KEY = randomBytes(32).toString("hex");
      policy = (
        await get().admin.query(
          "SELECT state,enabled_for_publish AS enabled,review_reference AS reference,reviewed_at AS reviewed FROM treido.category_policies WHERE category_id='cat:electronics/phones' AND version=1",
        )
      ).rows[0];
      await get().admin.query(
        "UPDATE treido.category_policies SET state='reviewed',enabled_for_publish=true,review_reference='SYNTHETIC T45 LOCAL TEST ONLY',reviewed_at=clock_timestamp() WHERE category_id='cat:electronics/phones' AND version=1",
      );
    });
    afterAll(async () => {
      if (oldKey === undefined) delete process.env.TREIDO_DISCOVERY_CURSOR_KEY;
      else process.env.TREIDO_DISCOVERY_CURSOR_KEY = oldKey;
      if (policy)
        await get().admin.query(
          "UPDATE treido.category_policies SET state=$1,enabled_for_publish=$2,review_reference=$3,reviewed_at=$4 WHERE category_id='cat:electronics/phones' AND version=1",
          [policy.state, policy.enabled, policy.reference, policy.reviewed],
        );
    });
    it("does not create records when a new human reads empty reviews or reservations", async () => {
      const ctx = get(),
        buyer = human(),
        count = () =>
          ctx.admin.query("SELECT count(*)::int AS n FROM treido.users");
      const before = (await count()).rows[0].n;
      expect((await readPurchaseReviews(ctx.database, buyer)).items).toEqual(
        [],
      );
      expect(
        (
          await readReservationQueue(ctx.database, buyer, {
            sellerId: null,
            view: "active",
          })
        ).items,
      ).toEqual([]);
      expect((await count()).rows[0].n).toBe(before);
    });
    it("snapshots every line once using server prices and reserves nothing", async () => {
      const ctx = get(),
        first = await prepare(),
        second = await prepare(first.sellerId),
        buyer = human(),
        command = await cart(buyer, [
          { f: first, quantity: 2 },
          { f: second, quantity: 3 },
        ]);
      const before = (
        await ctx.admin.query(
          "SELECT count(*) FROM treido.inventory_allocations",
        )
      ).rows[0].count;
      const [a, b] = await Promise.all([
        createPurchaseReview(ctx.database, buyer, command),
        createPurchaseReview(ctx.database, buyer, command),
      ]);
      expect(a).toEqual(b);
      const review = await readPurchaseReview(ctx.database, buyer, a.id);
      expect(review.lines).toHaveLength(2);
      expect(review.merchandiseMinor).toBe(64500);
      expect(review.allocationId).toBeNull();
      expect(review.payment).toEqual({
        available: false,
        buyerFeeMinor: null,
        deliveryMinor: null,
        payableMinor: null,
      });
      expect(
        (
          await ctx.admin.query(
            "SELECT count(*) FROM treido.inventory_allocations",
          )
        ).rows[0].count,
      ).toBe(before);
      await expect(
        createPurchaseReview(ctx.database, buyer, {
          ...command,
          payableMinor: 1,
        }),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    });
    it("isolates the selected seller and rejects stale cart revisions and changed retry input", async () => {
      const ctx = get(),
        first = await prepare(),
        other = await prepare(),
        buyer = human(),
        command = await cart(buyer, [
          { f: first, quantity: 1 },
          { f: other, quantity: 2 },
        ]);
      const result = await createPurchaseReview(ctx.database, buyer, command),
        review = await readPurchaseReview(ctx.database, buyer, result.id);
      expect(review.lines.map((l) => l.listingId)).toEqual([first.draft.id]);
      expect(review.merchandiseMinor).toBe(12900);
      await expect(
        createPurchaseReview(ctx.database, buyer, {
          ...command,
          requestId: randomUUID(),
          source: { ...command.source, cartRevision: 1 },
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(
        createPurchaseReview(ctx.database, buyer, {
          ...command,
          language: "bg",
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(await createPurchaseReview(ctx.database, buyer, command)).toEqual(
        result,
      );
    });
    it("rolls back the complete review on one shortage or unsupported delivery term", async () => {
      const ctx = get(),
        first = await prepare(),
        second = await prepare(first.sellerId),
        buyer = human(),
        command = await cart(buyer, [
          { f: first, quantity: 1 },
          { f: second, quantity: 2 },
        ]);
      await expect(
        createPurchaseReview(ctx.database, buyer, {
          ...command,
          handover: "shipping",
        }),
      ).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
      const inventory = await readInventory(ctx.database, ctx.owner, {
        sellerId: second.sellerId,
        listingId: second.draft.id,
      });
      await changeInventory(ctx.database, ctx.owner, {
        sellerId: second.sellerId,
        listingId: second.draft.id,
        expectedRevision: inventory.revision,
        requestId: randomUUID(),
        operation: {
          kind: "stock",
          skuId: second.skuId,
          onHand: 0,
          reason: "Synthetic stock recount",
          reasonKind: "adjustment",
        },
      });
      await expect(
        createPurchaseReview(ctx.database, buyer, command),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(
        (await readPurchaseReviews(ctx.database, buyer)).items,
      ).toHaveLength(0);
      expect(
        (await readPublicInventory(ctx.database, first.draft.id))?.skus[0]
          .available,
      ).toBe(5);
    });
    it("uses only the exact accepted allocation, original deadline and agreed price", async () => {
      const ctx = get(),
        f = await accepted(),
        before = (
          await ctx.admin.query(
            "SELECT count(*) FROM treido.inventory_allocations",
          )
        ).rows[0].count;
      const result = await createPurchaseReview(
          ctx.database,
          f.buyer,
          f.command,
        ),
        review = await readPurchaseReview(ctx.database, f.buyer, result.id),
        allocation = (
          await ctx.admin.query(
            "SELECT id,expires_at FROM treido.inventory_allocations WHERE source_id=$1",
            [f.offer.offerId],
          )
        ).rows[0];
      expect(review).toMatchObject({
        allocationId: allocation.id,
        source: "offer",
        merchandiseMinor: 20000,
        holdState: "active",
      });
      expect(review.lines[0].unitPriceMinor).toBe(10000);
      expect(Date.parse(review.expiresAt)).toBeLessThanOrEqual(
        allocation.expires_at.getTime(),
      );
      expect(
        await createPurchaseReview(ctx.database, f.buyer, f.command),
      ).toEqual(result);
      expect(
        (
          await ctx.admin.query(
            "SELECT count(*) FROM treido.inventory_allocations",
          )
        ).rows[0].count,
      ).toBe(before);
      const foreign = human();
      await inTransaction(ctx.database, (tx) =>
        authorizeHuman(tx, foreign, true),
      );
      await expect(
        createPurchaseReview(ctx.database, foreign, {
          ...f.command,
          actorKey: libraryActorKey(foreign),
        }),
      ).rejects.toBeTruthy();
    });
    it("keeps immutable snapshots and actor-owned notes with optimistic receipt recovery", async () => {
      const ctx = get(),
        f = await accepted(),
        { id } = await createPurchaseReview(ctx.database, f.buyer, f.command);
      const input = {
        reviewId: id,
        actorKey: f.command.actorKey,
        requestId: randomUUID(),
        expectedRevision: 0,
        note: "Private draft note",
        archived: true,
      };
      expect(await editPurchaseReview(ctx.database, f.buyer, input)).toEqual({
        revision: 1,
      });
      expect(await editPurchaseReview(ctx.database, f.buyer, input)).toEqual({
        revision: 1,
      });
      const view = await readPurchaseReview(ctx.database, f.buyer, id);
      expect(view).toMatchObject({
        note: input.note,
        archived: true,
        holdState: "active",
        merchandiseMinor: 20000,
      });
      await editPurchaseReview(ctx.database, f.buyer, {
        ...input,
        requestId: randomUUID(),
        expectedRevision: 1,
        note: "Updated note",
        archived: false,
      });
      await expect(
        editPurchaseReview(ctx.database, f.buyer, input),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(
        (await readPurchaseReviews(ctx.database, f.buyer)).items,
      ).toHaveLength(1);
      expect(
        (await readPurchaseReviews(ctx.database, f.buyer, { archived: true }))
          .items,
      ).toHaveLength(0);
      for (const statement of [
        "UPDATE treido.purchase_reviews SET merchandise_minor=1",
        "UPDATE treido.purchase_review_lines SET unit_price_minor=1",
        "UPDATE treido.purchase_review_receipts SET accepted_revision=999",
        "UPDATE treido.purchase_review_preferences SET review_id=review_id",
      ])
        await expect(ctx.database.pool.query(statement)).rejects.toMatchObject({
          code: "42501",
        });
    });
    it("does not expose another buyer's private review, notes or pagination anchor", async () => {
      const ctx = get(),
        f = await accepted(),
        { id } = await createPurchaseReview(ctx.database, f.buyer, f.command);
      await expect(
        readPurchaseReview(ctx.database, ctx.owner, id),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        editPurchaseReview(ctx.database, ctx.owner, {
          reviewId: id,
          actorKey: libraryActorKey(ctx.owner),
          requestId: randomUUID(),
          expectedRevision: 0,
          note: "Foreign",
          archived: false,
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        readPurchaseReviews(ctx.database, ctx.owner, { before: id }),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
      await expect(
        createPurchaseReview(ctx.database, ctx.owner, f.command),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it("sends one real in-app inquiry and notification while excluding the private note", async () => {
      const ctx = get(),
        first = await prepare(),
        second = await prepare(first.sellerId),
        buyer = human(),
        command = await cart(buyer, [
          { f: first, quantity: 1 },
          { f: second, quantity: 2 },
        ]),
        { id } = await createPurchaseReview(ctx.database, buyer, command);
      await editPurchaseReview(ctx.database, buyer, {
        reviewId: id,
        actorKey: command.actorKey,
        requestId: randomUUID(),
        expectedRevision: 0,
        note: "DO NOT SEND PRIVATE NOTE",
        archived: false,
      });
      const [one, two] = await Promise.all([
        sendPurchaseReview(ctx.database, buyer, id, command.actorKey),
        sendPurchaseReview(ctx.database, buyer, id, command.actorKey),
      ]);
      expect(one).toEqual(two);
      const messages = await readConversationMessages(
        ctx.database,
        buyer,
        one.threadId,
      );
      expect(messages).toHaveLength(1);
      expect(messages[0].body).toContain("387.00 EUR");
      expect(messages[0].body).not.toContain("DO NOT SEND");
      expect(messages[0].body).toContain("not an order");
      expect(
        (
          await ctx.admin.query(
            "SELECT count(*)::int AS n FROM treido.message_notification_intents WHERE message_id=$1",
            [messages[0].id],
          )
        ).rows[0].n,
      ).toBe(1);
      expect(
        (await readPurchaseReview(ctx.database, buyer, id)).contactThreadId,
      ).toBe(one.threadId);
    });
    it("retains saved prices after withdrawal and refuses a new inquiry on stale terms", async () => {
      const ctx = get(),
        f = await prepare(),
        buyer = human(),
        command = await cart(buyer, [{ f, quantity: 1 }]),
        { id } = await createPurchaseReview(ctx.database, buyer, command);
      await withdrawListing(ctx.database, ctx.owner, {
        sellerId: f.sellerId,
        listingId: f.draft.id,
        expectedRevision: f.publicationRevision,
        requestId: randomUUID(),
      });
      const saved = await readPurchaseReview(ctx.database, buyer, id);
      expect(saved.merchandiseMinor).toBe(12900);
      expect(saved.lines[0].current).toBe(false);
      await expect(
        sendPurchaseReview(ctx.database, buyer, id, command.actorKey),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });
    it("recovers the old review without renewing expiry and refuses released offer repricing", async () => {
      const ctx = get(),
        f = await accepted(),
        result = await createPurchaseReview(ctx.database, f.buyer, f.command);
      await ctx.admin.query(
        "UPDATE treido.purchase_reviews SET created_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 hour' WHERE id=$1",
        [result.id],
      );
      expect(
        await createPurchaseReview(ctx.database, f.buyer, f.command),
      ).toEqual(result);
      expect(
        (await readPurchaseReview(ctx.database, f.buyer, result.id)).expired,
      ).toBe(true);
      await changeOffer(ctx.database, ctx.owner, {
        sellerId: f.f.sellerId,
        threadId: f.thread.id,
        requestId: randomUUID(),
        expectedRevision: f.acceptance.revision,
        operation: { kind: "cancel", offerId: f.offer.offerId },
      });
      await expect(
        createPurchaseReview(ctx.database, f.buyer, {
          ...f.command,
          requestId: randomUUID(),
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(
        (await readPurchaseReview(ctx.database, f.buyer, result.id)).holdState,
      ).toBe("released");
    });
    it("projects real buyer and merchant holds, searches titles and follows cancellation into history", async () => {
      const ctx = get(),
        f = await accepted(),
        sellerQuery = { sellerId: f.f.sellerId, view: "active" as const };
      const seller = await readReservationQueue(
          ctx.database,
          ctx.owner,
          sellerQuery,
        ),
        buyer = await readReservationQueue(ctx.database, f.buyer, {
          sellerId: null,
          view: "active",
        });
      expect(seller.activeCount).toBe(1);
      expect(seller.items[0]).toMatchObject({
        merchandiseMinor: 20000,
        canCancel: true,
        offerId: f.offer.offerId,
      });
      expect(buyer.items[0].id).toBe(seller.items[0].id);
      expect(JSON.stringify(seller)).not.toContain(f.buyer.subject);
      expect(
        (
          await readReservationQueue(ctx.database, ctx.owner, {
            ...sellerQuery,
            q: "does-not-match",
          })
        ).items,
      ).toHaveLength(0);
      expect(
        (
          await readReservationQueue(ctx.database, ctx.owner, {
            ...sellerQuery,
            q: "телефон",
          })
        ).items,
      ).toHaveLength(1);
      const cancellation = {
        sellerId: f.f.sellerId,
        threadId: f.thread.id,
        requestId: randomUUID(),
        expectedRevision: seller.items[0].offerRevision,
        operation: { kind: "cancel", offerId: f.offer.offerId },
      };
      const result = await changeOffer(ctx.database, ctx.owner, cancellation);
      expect(await changeOffer(ctx.database, ctx.owner, cancellation)).toEqual(
        result,
      );
      expect(
        (await readReservationQueue(ctx.database, ctx.owner, sellerQuery))
          .activeCount,
      ).toBe(0);
      expect(
        (
          await readReservationQueue(ctx.database, ctx.owner, {
            ...sellerQuery,
            view: "history",
          })
        ).items[0].state,
      ).toBe("released");
      expect(
        (await readPublicInventory(ctx.database, f.f.draft.id))?.skus[0]
          .available,
      ).toBe(5);
      await expect(
        readReservationQueue(ctx.database, f.buyer, sellerQuery),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it("rechecks current human restrictions rather than trusting saved buyer access", async () => {
      const ctx = get(),
        f = await accepted(),
        { id } = await createPurchaseReview(ctx.database, f.buyer, f.command);
      await ctx.admin.query(
        "UPDATE treido.users SET status='restricted' WHERE clerk_subject=$1",
        [f.buyer.subject],
      );
      await expect(
        readPurchaseReview(ctx.database, f.buyer, id),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        readReservationQueue(ctx.database, f.buyer, {
          sellerId: null,
          view: "active",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it("bounds creation and paginates saved reviews without offset gaps or duplicate identities", async () => {
      const ctx = get(),
        f = await prepare(),
        buyer = human(),
        command = await cart(buyer, [{ f, quantity: 1 }]);
      const ids: string[] = [];
      for (let i = 0; i < 20; i++)
        ids.push(
          (
            await createPurchaseReview(ctx.database, buyer, {
              ...command,
              requestId: randomUUID(),
            })
          ).id,
        );
      await expect(
        createPurchaseReview(ctx.database, buyer, {
          ...command,
          requestId: randomUUID(),
        }),
      ).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" });
      await ctx.admin.query(
        "UPDATE treido.purchase_reviews SET created_at=clock_timestamp()-interval '2 hours' WHERE id=$1",
        [ids[0]],
      );
      ids.push(
        (
          await createPurchaseReview(ctx.database, buyer, {
            ...command,
            requestId: randomUUID(),
          })
        ).id,
      );
      const first = await readPurchaseReviews(ctx.database, buyer);
      expect(first.items).toHaveLength(20);
      expect(first.nextBefore).not.toBeNull();
      const second = await readPurchaseReviews(ctx.database, buyer, {
        before: first.nextBefore,
      });
      expect(second.items).toHaveLength(1);
      expect(
        new Set([...first.items, ...second.items].map((r) => r.id)).size,
      ).toBe(21);
    });
    it.skipIf(!process.env.TREIDO_PURCHASE_BROWSER_HELPER)(
      "actual purchase and merchant controls recover and persist through browser interactions",
      async () => {
        const ctx = get(),
          f = await accepted(),
          review = await createPurchaseReview(ctx.database, f.buyer, f.command);
        const helper = await import(
          process.env.TREIDO_PURCHASE_BROWSER_HELPER!
        );
        const result = await helper.runPurchaseBrowserChecks({
          database: ctx.database,
          admin: ctx.admin,
          buyer: f.buyer,
          owner: ctx.owner,
          reviewId: review.id,
          sellerId: f.f.sellerId,
          source: f.command.source,
          api: {
            libraryActorKey,
            readPurchaseReview,
            readPurchaseReviews,
            createPurchaseReview,
            editPurchaseReview,
            sendPurchaseReview,
            readReservationQueue,
            changeOffer,
          },
        });
        expect(result.checks).toBeGreaterThanOrEqual(9);
      },
      180000,
    );
  });
}
