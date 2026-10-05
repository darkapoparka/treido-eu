import { randomUUID } from "node:crypto";
import { inTransaction } from "../../apps/web/src/server/db/database";
import { createPublicationFixture } from "../../apps/web/tests/fixtures/publication-flow";
import { changeInventory } from "../../apps/web/src/features/inventory/commands.server";
import { allocateInventory } from "../../apps/web/src/features/inventory/allocations.server";
import { publishListing } from "../../apps/web/src/features/selling/publish.server";
import { changeBuyerCart } from "../../apps/web/src/features/buyer-cart/cart.server";
import { libraryActorKey } from "../../apps/web/src/features/library/cursor.server";
import { openListingConversation } from "../../apps/web/src/features/messaging/participants.server";
import { changeOffer } from "../../apps/web/src/features/offers/offers.server";
import type { ReviewSource } from "../../apps/web/src/features/purchase-reviews/model";
import { aftercareActor, type AftercareNativeContext } from "./aftercare-fixture";

/** Preparation only, unregistered. Fresh original commands create every source
 * and hold. There is no shipping approval/readiness override or provider call.
 * The publication fixture's local bytes/declaration remain synthetic evidence. */
export async function createShippingSourceFixture(
  context: AftercareNativeContext,
  kind: "cart" | "offer",
  pickupOnly = false,
) {
  const { database, admin } = context;
  const merchant = await aftercareActor(context), buyer = await aftercareActor(context), foreign = await aftercareActor(context);
  const client = await admin.connect();
  let published: Awaited<ReturnType<typeof createPublicationFixture>>;
  try { published = await createPublicationFixture({ database, admin: client, owner: merchant.identity }, "business"); }
  finally { client.release(); }
  const stock = await changeInventory(database, merchant.identity, {
    sellerId: published.sellerId, listingId: published.draft.id,
    requestId: randomUUID(), expectedRevision: 0,
    operation: { kind: "setup", mode: "stocked", onHand: 3, sellerSku: "T61-shipping-source" },
  });
  const publication = await publishListing(database, merchant.identity, {
    ...published.input, expectedRevision: stock.listingRevision,
    terms: { ...published.input.terms, handover: pickupOnly ? ["pickup"] : ["pickup", "shipping"],
      deliveryDetails: "Synthetic local shipping arrangement" },
  });
  let source: ReviewSource;
  const line = { listingId: published.draft.id, skuId: stock.skuId,
    publicationRevision: publication.revision, quantity: 3, unitPriceMinor: 12900 };
  if (kind === "cart") {
    const cart = await changeBuyerCart(database, buyer.identity, {
      actorKey: libraryActorKey(buyer.identity), requestId: randomUUID(), expectedRevision: 0,
      operation: { kind: "add", listingId: line.listingId, skuId: line.skuId,
        publicationRevision: line.publicationRevision, quantity: line.quantity },
    });
    source = { kind: "cart", sellerId: published.sellerId, cartRevision: cart.revision };
  } else {
    const thread = await openListingConversation(database, buyer.identity, line.listingId);
    const proposal = await changeOffer(database, buyer.identity, {
      sellerId: null, threadId: thread.id, requestId: randomUUID(), expectedRevision: 0,
      operation: { kind: "propose", parentId: null, skuId: line.skuId,
        publicationRevision: line.publicationRevision, quantity: line.quantity,
        unitPriceMinor: 11000, expiresHours: 1 },
    });
    await changeOffer(database, merchant.identity, {
      sellerId: published.sellerId, threadId: thread.id, requestId: randomUUID(),
      expectedRevision: proposal.revision, operation: { kind: "accept", offerId: proposal.offerId },
    });
    line.unitPriceMinor = 11000;
    source = { kind: "offer", threadId: thread.id, offerId: proposal.offerId };
  }
  const allocateCart = async (actor: typeof buyer = buyer) => {
    if (source.kind !== "cart") throw Error("Cart-only allocation fixture");
    return inTransaction(database, tx => allocateInventory(tx, {
      sellerId: published.sellerId, buyerId: actor.userId, actorId: actor.userId,
      purpose: "checkout", sourceId: randomUUID(), lines: [line],
    }));
  };
  const commerceSnapshot = async () => (await admin.query<{ value: unknown }>(
    "SELECT jsonb_build_object('cart',(SELECT jsonb_agg(to_jsonb(l) ORDER BY l.sku_id) FROM treido.buyer_cart_lines l WHERE user_id=$1),'allocations',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM treido.inventory_allocations a WHERE seller_id=$2),'lines',(SELECT jsonb_agg(to_jsonb(l) ORDER BY l.allocation_id,l.sku_id) FROM treido.inventory_allocation_lines l JOIN treido.inventory_allocations a ON a.id=l.allocation_id WHERE a.seller_id=$2),'quotes',(SELECT jsonb_agg(to_jsonb(q) ORDER BY q.id) FROM treido.payable_quotes q WHERE buyer_id=$1)) AS value",
    [buyer.userId, published.sellerId],
  )).rows[0].value;
  return { database, admin, buyer, foreign, merchant, sellerId: published.sellerId,
    source, line, allocateCart, commerceSnapshot };
}
