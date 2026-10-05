import "server-only";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman } from "../sellers/persistence.server";
import { libraryActorKey } from "../library/cursor.server";
import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { parseSource } from "./model";
import { shippingSource } from "./source.server";
import {
  readShippingOption,
  shippingStorageAvailable,
} from "./registry.server";
import {
  ownedShippingRow,
  ownRecipient,
  shippingActor,
  type ShippingRow,
} from "./storage.server";
import type { ShippingContext, ShippingReview } from "./view";

export async function readShippingContext(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  rawSource: unknown,
  rawLanguage: unknown,
): Promise<ShippingContext> {
  const input = parseSource(rawSource, rawLanguage);
  return inTransaction(database, async (tx) => {
    await authorizeHuman(tx, identity, false);
    const context: ShippingContext = {
      actorKey: libraryActorKey(identity),
      actorSubject: identity.subject,
      ...input,
      available: false,
      sourceHash: null,
      sellerId: null,
      sellerName: null,
      lines: [],
      options: [],
    };
    if (!(await shippingStorageAvailable(tx))) return context;
    let supply: Awaited<ReturnType<typeof shippingSource>>;
    try {
      supply = await shippingSource(tx, identity, input.source);
    } catch (error) {
      if (
        error instanceof SellerError &&
        (error.code === "CONFLICT" || error.code === "NOT_AVAILABLE")
      )
        return context;
      throw error;
    }
    context.sourceHash = supply.sourceHash;
    context.sellerId = supply.sellerId;
    context.sellerName = supply.sellerName;
    context.lines = supply.lines;
    const candidates = (
      await tx.client.query<{ policyId: string; rateId: string }>(
        'SELECT DISTINCT ON (p.id,c.id) r.policy_id AS "policyId",r.id AS "rateId" FROM treido.order_shipping_rates r JOIN treido.order_shipping_carriers c ON c.id=r.carrier_binding_id JOIN treido.order_shipping_policies p ON p.id=r.policy_id WHERE c.seller_id=$1 AND p.approved_at<=clock_timestamp() AND p.revoked_at IS NULL AND c.approved_at<=clock_timestamp() AND c.revoked_at IS NULL AND r.approved_at<=clock_timestamp() AND r.revoked_at IS NULL AND r.valid_until>clock_timestamp() ORDER BY p.id,c.id,r.version DESC LIMIT 21',
        [supply.sellerId],
      )
    ).rows;
    if (candidates.length > 20) throw new SellerError("NOT_AVAILABLE");
    for (const candidate of candidates) {
      try {
        context.options.push(
          await readShippingOption(
            tx,
            supply,
            candidate.policyId,
            candidate.rateId,
          ),
        );
      } catch (error) {
        if (!(error instanceof SellerError && error.code === "NOT_AVAILABLE"))
          throw error;
      }
    }
    context.available = context.options.length > 0;
    return context;
  });
}
export async function shippingReviewView(
  tx: SellerTransaction,
  identity: VerifiedIdentity,
  row: ShippingRow,
): Promise<ShippingReview> {
  const recipient = await ownRecipient(tx, row);
  let canAccept = false;
  if (!row.expired && row.state === "reviewed" && recipient.value) {
    try {
      const supply = await shippingSource(tx, identity, row.snapshot.source);
      const option = await readShippingOption(
        tx,
        supply,
        row.snapshot.option.policy.id,
        row.snapshot.option.rate.id,
      );
      canAccept =
        supply.sourceHash === row.snapshot.sourceHash &&
        option.optionHash === row.snapshot.option.optionHash;
    } catch (error) {
      if (!(error instanceof SellerError)) throw error;
    }
  }
  return {
    actorKey: libraryActorKey(identity),
    actorSubject: identity.subject,
    id: row.id,
    revision: row.revision,
    state: row.state,
    snapshotHash: row.snapshotHash,
    snapshot: row.snapshot,
    expiresAt: row.expiresAt.toISOString(),
    expired: row.expired,
    recipient: recipient.value,
    recipientExpiresAt: recipient.expiresAt?.toISOString() ?? null,
    quoteId: row.quoteId,
    canAccept,
  };
}
export async function readShippingReview(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  id: string,
) {
  if (!validId(id)) throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    const user = await shippingActor(tx, identity);
    return shippingReviewView(
      tx,
      identity,
      await ownedShippingRow(tx, user.id, id),
    );
  });
}
