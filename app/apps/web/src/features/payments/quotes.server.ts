import "server-only";
import { randomUUID } from "node:crypto";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import {
  hasVerifiedRecentAuthentication,
  type VerifiedIdentity,
} from "../../server/identity/clerk.server";
import { authorizeHuman, inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { libraryActorKey } from "../library/cursor.server";
import {
  allocateInventory,
  lockInventoryListings,
  type AllocationLine,
} from "../inventory/allocations.server";
import { readAcceptedOfferQuoteSource } from "../offers/checkout-source.server";
import { snapshotLine } from "../purchase-reviews/persistence.server";
import { merchandiseTotal, type ReviewLine } from "../purchase-reviews/model";
import { requireCollection, verifiedStripe } from "./bindings.server";
import {
  accountReadiness,
  approvedListing,
  approvedPolicy,
  sellerBinding,
} from "./registry.server";
import {
  feeMinor,
  parseQuoteCommand,
  type QuoteCommand,
  type QuoteView,
} from "./model";
import {
  freezeNewQuoteAftercare,
  persistNewQuoteAftercare,
} from "../order-aftercare/policy.server";
import {
  lockShippingChoiceForQuote,
  persistShippingQuoteChoice,
} from "../order-shipping/bridge.server";
import type { ShippingBridge } from "../order-shipping/view";
import { validId } from "../selling/draft-model";

async function priorQuote(
  tx: SellerTransaction,
  buyerId: string,
  command: QuoteCommand,
) {
  const row = (
    await tx.client.query<{ id: string; hash: string }>(
      `SELECT id,input_hash AS hash FROM treido.payable_quotes WHERE buyer_id=$1 AND request_id=$2`,
      [buyerId, command.requestId],
    )
  ).rows[0];
  if (row && row.hash !== inputHash(command)) throw new SellerError("CONFLICT");
  if (row) return row;
  const source = (
    await tx.client.query<{
      id: string;
      policyId: string;
      choiceHash: string | null;
      shippingChoice: QuoteCommand["shipping"] | null;
      handover: string;
      language: string;
    }>(
      `SELECT id,policy_id AS "policyId",terms_snapshot->'aftercare'->>'choiceHash' AS "choiceHash",terms_snapshot->'shipping'->'choice' AS "shippingChoice",terms_snapshot->>'handover' AS handover,language FROM treido.payable_quotes WHERE buyer_id=$1 AND source=$2::jsonb LIMIT 1`,
      [buyerId, JSON.stringify(command.source)],
    )
  ).rows[0];
  if (
    source &&
    (source.policyId !== command.policyId ||
      source.handover !== command.handover ||
      source.language !== command.language ||
      (source.shippingChoice ? inputHash(source.shippingChoice) : null) !==
        (command.shipping ? inputHash(command.shipping) : null) ||
      source.choiceHash !==
        (command.aftercare ? inputHash(command.aftercare) : null))
  )
    throw new SellerError("CONFLICT");
  return source;
}
export async function createPayableQuote(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  const command = parseQuoteCommand(raw);
  if (command.actorKey !== libraryActorKey(identity))
    throw new SellerError("FORBIDDEN");
  if (
    command.handover === "shipping" &&
    !hasVerifiedRecentAuthentication(identity)
  )
    throw new SellerError("FORBIDDEN");
  const bindings = requireCollection();
  const initial = await inTransaction(database, async (tx) => {
    const user = await authorizeHuman(tx, identity, false);
    const prior = await priorQuote(tx, user.id, command);
    if (prior) return { prior };
    const sellerId =
      command.source.kind === "cart"
        ? command.source.sellerId
        : (await readAcceptedOfferQuoteSource(tx, identity, command.source))
            .sellerId;
    const policy = await approvedPolicy(tx, command.policyId, bindings);
    return {
      sellerId,
      mapping: await sellerBinding(tx, sellerId, bindings),
      settlementMerchant: policy.settlementMerchant,
    };
  });
  if (initial.prior) return { id: initial.prior.id };
  const stripe = await verifiedStripe(bindings, true);
  const account = await stripe.accounts.retrieve(
    initial.mapping!.connectedAccount,
  );
  if (!accountReadiness(account, initial.settlementMerchant).ready)
    throw new SellerError("NOT_AVAILABLE");
  return inTransaction(database, async (tx) => {
    const user = await authorizeHuman(tx, identity, false);
    await tx.client.query(
      `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`,
      ["payable-quote-v1:" + user.id],
    );
    const prior = await priorQuote(tx, user.id, command);
    if (prior) return { id: prior.id };
    const policy = await approvedPolicy(tx, command.policyId, bindings);
    const mapping = await sellerBinding(tx, initial.sellerId!, bindings);
    if (
      mapping.id !== initial.mapping!.id ||
      mapping.connectedAccount !== account.id ||
      policy.settlementMerchant !== initial.settlementMerchant
    )
      throw new SellerError("CONFLICT");
    const pending = await tx.client.query(
      `SELECT a.id FROM treido.payment_attempts a JOIN treido.payable_quotes q ON q.id=a.quote_id WHERE q.buyer_id=$1 AND q.seller_id=$2 AND a.state NOT IN ('paid','cancelled') LIMIT 1`,
      [user.id, mapping.sellerId],
    );
    if (pending.rowCount) throw new SellerError("CONFLICT");
    const quota = await tx.client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM treido.payable_quotes WHERE buyer_id=$1 AND created_at>clock_timestamp()-interval '1 hour'`,
      [user.id],
    );
    if (quota.rows[0].n >= 20) throw new SellerError("QUOTA_EXCEEDED");
    let sourceLines: AllocationLine[],
      allocationId: string | undefined,
      expiresAt: string | undefined;
    if (command.source.kind === "offer") {
      const source = await readAcceptedOfferQuoteSource(
        tx,
        identity,
        command.source,
      );
      if (source.sellerId !== mapping.sellerId)
        throw new SellerError("CONFLICT");
      sourceLines = [source];
      allocationId = source.allocationId;
      expiresAt = source.expiresAt;
      const existing = (
        await tx.client.query<{ id: string }>(
          `SELECT id FROM treido.payable_quotes WHERE allocation_id=$1`,
          [allocationId],
        )
      ).rows[0];
      if (existing) throw new SellerError("CONFLICT");
    } else {
      const cart = (
        await tx.client.query<{ revision: number }>(
          `SELECT revision FROM treido.buyer_carts WHERE user_id=$1 FOR UPDATE`,
          [user.id],
        )
      ).rows[0];
      if (!cart || cart.revision !== command.source.cartRevision)
        throw new SellerError("CONFLICT");
      sourceLines = (
        await tx.client.query<AllocationLine>(
          `SELECT listing_id AS "listingId",sku_id AS "skuId",publication_revision AS "publicationRevision",quantity,seen_price_minor AS "unitPriceMinor" FROM treido.buyer_cart_lines WHERE user_id=$1 AND seller_id=$2 AND active ORDER BY listing_id,sku_id LIMIT 31`,
          [user.id, mapping.sellerId],
        )
      ).rows;
    }
    if (!sourceLines.length || sourceLines.length > 30)
      throw new SellerError("INVALID_INPUT");
    const seller = (
      await tx.client.query<{ name: string }>(
        `SELECT name FROM treido.seller_accounts WHERE id=$1 AND status='active' FOR SHARE`,
        [mapping.sellerId],
      )
    ).rows[0];
    if (!seller) throw new SellerError("NOT_AVAILABLE");
    const self = await tx.client.query(
      `SELECT user_id FROM treido.personal_seller_owners WHERE seller_id=$1 AND user_id=$2 UNION ALL SELECT user_id FROM treido.seller_memberships WHERE seller_id=$1 AND user_id=$2 AND status='active'`,
      [mapping.sellerId, user.id],
    );
    if (self.rowCount) throw new SellerError("FORBIDDEN");
    await lockInventoryListings(
      tx,
      mapping.sellerId,
      sourceLines.map((l) => l.listingId),
    );
    const lines: ReviewLine[] = [];
    for (const line of sourceLines) {
      await approvedListing(tx, mapping.sellerId, line, policy.id);
      lines.push(
        await snapshotLine(
          tx,
          mapping.sellerId,
          line,
          command.source.kind === "offer",
          command.handover,
        ),
      );
    }
    const merchandise = merchandiseTotal(lines);
    if (merchandise < 50 || merchandise > 99999999)
      throw new SellerError("NOT_AVAILABLE");
    const id = randomUUID();
    if (!allocationId) {
      const allocation = await allocateInventory(tx, {
        sellerId: mapping.sellerId,
        buyerId: user.id,
        actorId: user.id,
        purpose: "checkout",
        sourceId: id,
        lines: sourceLines,
      });
      allocationId = allocation.id;
      expiresAt = allocation.expiresAt.toISOString();
    }
    const allocationClock = (
      await tx.client.query<{ expiresAtExact: string }>(
        "SELECT expires_at::text AS \"expiresAtExact\" FROM treido.inventory_allocations WHERE id=$1 AND buyer_id=$2 AND seller_id=$3 AND purpose=$4 AND source_id=$5 AND state='active' AND expires_at>clock_timestamp() FOR SHARE",
        [
          allocationId,
          user.id,
          mapping.sellerId,
          command.source.kind === "offer" ? "offer" : "checkout",
          command.source.kind === "offer" ? command.source.offerId : id,
        ],
      )
    ).rows[0];
    if (!allocationClock) throw new SellerError("CONFLICT");
    let shipping: ShippingBridge | null = null;
    if (command.shipping) {
      shipping = await lockShippingChoiceForQuote(
        tx,
        identity,
        command.shipping,
        {
          buyerId: user.id,
          sellerId: mapping.sellerId,
          basePolicyId: policy.id,
          source: command.source,
          language: command.language,
          allocationId: allocationId!,
          originalExpiresAt: expiresAt!,
          originalExpiresAtExact: allocationClock.expiresAtExact,
          merchandiseMinor: merchandise,
          platformAccount: bindings.platformAccount,
          livemode: bindings.livemode,
          environment: bindings.environment,
          applicationId: bindings.applicationId,
        },
      );
      const accepted = {
        policyId: shipping.aftercare.policyId,
        version: shipping.aftercare.version,
        termsHash: shipping.aftercare.termsHash,
        acknowledged: true,
      };
      if (
        !command.aftercare ||
        inputHash(command.aftercare) !== inputHash(accepted)
      )
        throw new SellerError("CONFLICT");
    }
    const aftercare = await freezeNewQuoteAftercare(
      tx,
      {
        policyId: policy.id,
        platformAccount: bindings.platformAccount,
        livemode: bindings.livemode,
        environment: bindings.environment,
        applicationId: bindings.applicationId,
      },
      command.aftercare,
      command.handover,
      command.language,
    );
    if (
      shipping &&
      (!aftercare ||
        aftercare.terms.buyerTerms !== shipping.aftercare.buyerTerms)
    )
      throw new SellerError("CONFLICT");
    const total = shipping?.costs.totalMinor ?? merchandise;
    const applicationFee =
      shipping?.costs.applicationFeeMinor ??
      feeMinor(total, policy.feeBps, policy.feeFixedMinor);
    if (!Number.isSafeInteger(total) || total < 50 || total > 99999999)
      throw new SellerError("NOT_AVAILABLE");
    const terms = {
      handover: command.handover,
      taxPolicy: "inclusive",
      refundPolicy: "full_fee_and_transfer_reversal",
      settlementMerchant: policy.settlementMerchant,
      approvalReference: policy.approvalReference,
      buyerTerms: policy.buyerTerms[command.language],
      ...(aftercare ? { aftercare: aftercare.terms } : {}),
      ...(shipping ? { shipping } : {}),
    };
    await tx.client.query(
      `INSERT INTO treido.payable_quotes(id,buyer_id,seller_id,request_id,input_hash,allocation_id,policy_id,binding_id,platform_account,livemode,connected_account,currency,total_minor,application_fee_minor,terms_snapshot,seller_name,language,source,expires_at,delivery_minor,buyer_fee_minor)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'EUR',$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [
        id,
        user.id,
        mapping.sellerId,
        command.requestId,
        inputHash(command),
        allocationId,
        policy.id,
        mapping.id,
        bindings.platformAccount,
        bindings.livemode,
        mapping.connectedAccount,
        total,
        applicationFee,
        terms,
        seller.name,
        command.language,
        command.source,
        allocationClock.expiresAtExact,
        shipping?.costs.shippingMinor ?? 0,
        shipping?.costs.buyerFeeMinor ?? 0,
      ],
    );
    for (const [position, line] of lines.entries())
      await tx.client.query(
        `INSERT INTO treido.payable_quote_lines(quote_id,seller_id,listing_id,sku_id,publication_revision,position,title,options,quantity,unit_price_minor,delivery_details) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          id,
          mapping.sellerId,
          line.listingId,
          line.skuId,
          line.publicationRevision,
          position,
          line.title,
          line.options,
          line.quantity,
          line.unitPriceMinor,
          line.deliveryDetails,
        ],
      );
    if (aftercare)
      await persistNewQuoteAftercare(
        tx,
        id,
        user.id,
        mapping.sellerId,
        command.language,
        aftercare,
      );
    if (command.shipping)
      await persistShippingQuoteChoice(tx, identity, command.shipping, id);
    return { id };
  });
}
export async function quoteLines(
  tx: SellerTransaction,
  id: string,
): Promise<ReviewLine[]> {
  return (
    await tx.client.query<ReviewLine>(
      `SELECT listing_id AS "listingId",sku_id AS "skuId",publication_revision AS "publicationRevision",title,options,quantity,unit_price_minor AS "unitPriceMinor",delivery_details AS "deliveryDetails",true AS current,NULL::integer AS available FROM treido.payable_quote_lines WHERE quote_id=$1 ORDER BY position`,
      [id],
    )
  ).rows;
}
export async function readPayableQuote(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  id: string,
): Promise<QuoteView> {
  if (!validId(id)) throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    const user = await authorizeHuman(tx, identity, false);
    const row = (
      await tx.client.query<
        Omit<QuoteView, "lines" | "expiresAt"> & { expiresAt: Date }
      >(
        `SELECT q.id,q.seller_id AS "sellerId",q.seller_name AS "sellerName",q.language,q.total_minor AS "totalMinor",q.total_minor-q.delivery_minor-q.buyer_fee_minor AS "merchandiseMinor",q.delivery_minor AS "shippingMinor",q.buyer_fee_minor AS "buyerFeeMinor",q.application_fee_minor AS "applicationFeeMinor",q.currency,q.expires_at AS "expiresAt",q.expires_at<=clock_timestamp() AS expired,jsonb_build_object('handover',q.terms_snapshot->>'handover','taxPolicy',q.terms_snapshot->>'taxPolicy','refundPolicy',q.terms_snapshot->>'refundPolicy','buyerTerms',q.terms_snapshot->>'buyerTerms','aftercare',q.terms_snapshot->'aftercare','shipping',CASE WHEN q.terms_snapshot->>'handover'='shipping' THEN jsonb_build_object('format','goods-shipping-v1','country',q.terms_snapshot->'shipping'->'country','costs',q.terms_snapshot->'shipping'->'costs','terms',q.terms_snapshot->'shipping'->'terms','rights',q.terms_snapshot->'shipping'->'rights','refundTerms',q.terms_snapshot->'shipping'->'refundTerms','taxDescription',q.terms_snapshot->'shipping'->'taxDescription','recipientPurpose',q.terms_snapshot->'shipping'->'recipientPurpose','retentionDescription',q.terms_snapshot->'shipping'->'retentionDescription') ELSE NULL END) AS terms,
      CASE WHEN a.id IS NOT NULL THEN jsonb_build_object('id',a.id,'state',a.state) ELSE NULL END AS attempt,o.id AS "orderId"
      FROM treido.payable_quotes q LEFT JOIN treido.payment_attempts a ON a.quote_id=q.id LEFT JOIN treido.paid_orders o ON o.quote_id=q.id WHERE q.id=$1 AND q.buyer_id=$2`,
        [id, user.id],
      )
    ).rows[0];
    if (!row) throw new SellerError("NOT_FOUND");
    return {
      ...row,
      expiresAt: row.expiresAt.toISOString(),
      lines: await quoteLines(tx, id),
    };
  });
}
