import "server-only";
import Stripe from "stripe";
import { randomUUID } from "node:crypto";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman, inputHash } from "../sellers/persistence.server";
import { libraryActorKey } from "../library/cursor.server";
import { SellerError } from "../sellers/errors";
import { lockAllocation } from "../inventory/allocations.server";
import {
  requireCollection,
  verifiedStripe,
  type PaymentBindings,
} from "./bindings.server";
import {
  approvedListing,
  approvedPolicy,
  accountReadiness,
  sellerBinding,
} from "./registry.server";
import { quoteLines } from "./quotes.server";
import { parseResource, type AttemptState } from "./model";
import { enqueueJob } from "../../server/jobs/outbox.server";
import { requireJobBindings } from "../../server/jobs/config.server";

export type AttemptRow = {
  id: string;
  quoteId: string;
  sellerId: string;
  buyerId: string;
  allocationId: string;
  policyId: string;
  bindingId: string;
  platformAccount: string;
  livemode: boolean;
  connectedAccount: string;
  totalMinor: number;
  applicationFeeMinor: number;
  expiresAt: Date;
  state: AttemptState;
  providerId: string | null;
  operationKey: string;
  cancelKey: string;
  cancelRequested: boolean;
  firstAttemptAt: Date | null;
  parameters: Stripe.PaymentIntentCreateParams;
  parameterHash: string;
  apiVersion: string;
  terms: {
    settlementMerchant: "platform" | "seller";
    refundPolicy: "full_fee_and_transfer_reversal";
  };
};
export const attemptColumns = `a.id,a.quote_id AS "quoteId",a.seller_id AS "sellerId",q.buyer_id AS "buyerId",q.allocation_id AS "allocationId",q.policy_id AS "policyId",q.binding_id AS "bindingId",
  a.platform_account AS "platformAccount",a.livemode,q.connected_account AS "connectedAccount",q.total_minor AS "totalMinor",q.application_fee_minor AS "applicationFeeMinor",q.expires_at AS "expiresAt",
  a.state,a.provider_id AS "providerId",a.operation_key AS "operationKey",a.cancel_key AS "cancelKey",a.cancel_requested AS "cancelRequested",a.first_attempt_at AS "firstAttemptAt",a.parameters,a.parameter_hash AS "parameterHash",a.api_version AS "apiVersion",q.terms_snapshot AS terms`;
export function assertAttemptScope(row: AttemptRow, binding: PaymentBindings) {
  if (
    row.platformAccount !== binding.platformAccount ||
    row.livemode !== binding.livemode ||
    row.parameterHash !== inputHash(row.parameters) ||
    row.parameters.metadata?.application_id !== binding.applicationId ||
    row.parameters.metadata?.environment !== binding.environment
  )
    throw new SellerError("NOT_AVAILABLE");
}
export async function enqueuePaymentObservation(
  tx: SellerTransaction,
  attemptId: string,
  sellerId: string,
  operationKey: string = randomUUID(),
) {
  return enqueueJob(tx, {
    kind: "payment.reconcile",
    sellerId,
    resourceId: attemptId,
    operationKey,
    actorId: null,
    authority: "service",
  });
}
export async function beginPayment(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  const command = parseResource(raw);
  if (command.actorKey !== libraryActorKey(identity))
    throw new SellerError("FORBIDDEN");
  const binding = requireCollection(),
    jobs = requireJobBindings();
  if (jobs.applicationId !== binding.applicationId)
    throw new SellerError("NOT_AVAILABLE");
  const preliminary = await inTransaction(database, async (tx) => {
    const user = await authorizeHuman(tx, identity, false);
    const row = (
      await tx.client.query<{ sellerId: string; allocationId: string }>(
        `SELECT seller_id AS "sellerId",allocation_id AS "allocationId" FROM treido.payable_quotes WHERE id=$1 AND buyer_id=$2`,
        [command.id, user.id],
      )
    ).rows[0];
    if (!row) throw new SellerError("NOT_FOUND");
    return { ...row, mapping: await sellerBinding(tx, row.sellerId, binding) };
  });
  const stripe = await verifiedStripe(binding, true);
  const account = await stripe.accounts.retrieve(
    preliminary.mapping.connectedAccount,
  );
  if (!accountReadiness(account).ready) throw new SellerError("NOT_AVAILABLE");
  const prepared = await inTransaction(database, async (tx) => {
    const user = await authorizeHuman(tx, identity, false);
    const { allocation } = await lockAllocation(tx, preliminary.allocationId);
    const quote = (
      await tx.client.query<{
        policyId: string;
        bindingId: string;
        totalMinor: number;
        applicationFeeMinor: number;
        terms: { settlementMerchant: "seller" | "platform" };
        expiresAt: Date;
      }>(
        `SELECT policy_id AS "policyId",binding_id AS "bindingId",total_minor AS "totalMinor",application_fee_minor AS "applicationFeeMinor",terms_snapshot AS terms,expires_at AS "expiresAt" FROM treido.payable_quotes WHERE id=$1 AND buyer_id=$2`,
        [command.id, user.id],
      )
    ).rows[0];
    if (!quote) throw new SellerError("NOT_FOUND");
    const prior = (
      await tx.client.query<AttemptRow>(
        `SELECT ${attemptColumns} FROM treido.payment_attempts a JOIN treido.payable_quotes q ON q.id=a.quote_id WHERE q.id=$1 FOR UPDATE OF a`,
        [command.id],
      )
    ).rows[0];
    if (prior) {
      assertAttemptScope(prior, binding);
      return { row: prior, create: false };
    }
    const policy = await approvedPolicy(tx, quote.policyId, binding),
      mapping = await sellerBinding(tx, preliminary.sellerId, binding);
    if (
      mapping.id !== quote.bindingId ||
      mapping.connectedAccount !== account.id ||
      policy.settlementMerchant !== quote.terms.settlementMerchant ||
      allocation.buyerId !== user.id ||
      allocation.state !== "active"
    )
      throw new SellerError("CONFLICT");
    const live = await tx.client.query(
      `SELECT id FROM treido.inventory_allocations WHERE id=$1 AND expires_at>clock_timestamp()`,
      [allocation.id],
    );
    if (live.rowCount !== 1) throw new SellerError("CONFLICT");
    const self = await tx.client.query(
      `SELECT user_id FROM treido.personal_seller_owners WHERE seller_id=$1 AND user_id=$2 UNION ALL SELECT user_id FROM treido.seller_memberships WHERE seller_id=$1 AND user_id=$2 AND status='active'`,
      [mapping.sellerId, user.id],
    );
    if (self.rowCount) throw new SellerError("FORBIDDEN");
    for (const line of await quoteLines(tx, command.id))
      await approvedListing(tx, mapping.sellerId, line, policy.id);
    const id = randomUUID();
    const parameters: Stripe.PaymentIntentCreateParams = {
      amount: quote.totalMinor,
      currency: "eur",
      allowed_payment_method_types: ["card"],
      capture_method: "automatic",
      confirmation_method: "automatic",
      application_fee_amount: quote.applicationFeeMinor,
      transfer_data: { destination: mapping.connectedAccount },
      ...(policy.settlementMerchant === "seller"
        ? { on_behalf_of: mapping.connectedAccount }
        : {}),
      metadata: {
        attempt_id: id,
        quote_id: command.id,
        seller_id: mapping.sellerId,
        application_id: binding.applicationId,
        environment: binding.environment,
      },
    };
    await tx.client.query(
      `INSERT INTO treido.payment_attempts(id,quote_id,seller_id,platform_account,livemode,operation_key,cancel_key,api_version,parameters,parameter_hash,state,first_attempt_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'creating',clock_timestamp())`,
      [
        id,
        command.id,
        mapping.sellerId,
        binding.platformAccount,
        binding.livemode,
        `treido:payment:v1:${id}`,
        `treido:cancel:v1:${id}`,
        Stripe.API_VERSION,
        parameters,
        inputHash(parameters),
      ],
    );
    await enqueuePaymentObservation(tx, id, mapping.sellerId);
    const row = (
      await tx.client.query<AttemptRow>(
        `SELECT ${attemptColumns} FROM treido.payment_attempts a JOIN treido.payable_quotes q ON q.id=a.quote_id WHERE a.id=$1`,
        [id],
      )
    ).rows[0];
    return { row, create: true };
  });
  let intent: Stripe.PaymentIntent | null = null;
  if (prepared.create) {
    try {
      // Exactly one application POST. A crash/timeout is reconciled by metadata;
      // even after Stripe's 24h idempotency retention, this command never reposts.
      intent = await stripe.paymentIntents.create(prepared.row.parameters, {
        idempotencyKey: prepared.row.operationKey,
      });
      await inTransaction(database, async (tx) => {
        await lockAllocation(tx, prepared.row.allocationId);
        const update = await tx.client.query(
          `UPDATE treido.payment_attempts SET provider_id=coalesce(provider_id,$2),updated_at=clock_timestamp() WHERE id=$1 AND (provider_id IS NULL OR provider_id=$2) RETURNING id`,
          [prepared.row.id, intent!.id],
        );
        if (update.rowCount !== 1) throw new SellerError("CONFLICT");
        await enqueuePaymentObservation(
          tx,
          prepared.row.id,
          prepared.row.sellerId,
        );
      });
    } catch {
      await database.pool.query(
        `UPDATE treido.payment_attempts SET state=CASE WHEN state IN ('paid','cancelled','quarantined') THEN state ELSE 'reconciling' END,updated_at=clock_timestamp() WHERE id=$1`,
        [prepared.row.id],
      );
      return { id: prepared.row.id, status: "reconciling" as const };
    }
  } else if (
    prepared.row.providerId &&
    !["paid", "cancelled", "quarantined", "cancelling"].includes(
      prepared.row.state,
    )
  ) {
    try {
      intent = await stripe.paymentIntents.retrieve(prepared.row.providerId);
    } catch {
      return { id: prepared.row.id, status: "reconciling" as const };
    }
  }
  if (!intent) return { id: prepared.row.id, status: prepared.row.state };
  verifyPaymentIntent(prepared.row, intent, binding);
  // Reauthorize after I/O; no client secret is stored in durable intents or logs.
  const permitted = await inTransaction(database, async (tx) => {
    const user = await authorizeHuman(tx, identity, false);
    const { allocation } = await lockAllocation(tx, prepared.row.allocationId);
    const current = (
      await tx.client.query<{ cancelRequested: boolean; live: boolean }>(
        `SELECT a.cancel_requested AS "cancelRequested",q.expires_at>clock_timestamp() AS live FROM treido.payment_attempts a JOIN treido.payable_quotes q ON q.id=a.quote_id WHERE a.id=$1 AND q.buyer_id=$2`,
        [prepared.row.id, user.id],
      )
    ).rows[0];
    if (!current) throw new SellerError("FORBIDDEN");
    await approvedPolicy(tx, prepared.row.policyId, binding);
    const mapping = await sellerBinding(tx, prepared.row.sellerId, binding);
    if (
      mapping.id !== prepared.row.bindingId ||
      mapping.connectedAccount !== prepared.row.connectedAccount
    )
      throw new SellerError("FORBIDDEN");
    for (const line of await quoteLines(tx, prepared.row.quoteId))
      await approvedListing(
        tx,
        prepared.row.sellerId,
        line,
        prepared.row.policyId,
      );
    const self = await tx.client.query(
      `SELECT user_id FROM treido.personal_seller_owners WHERE seller_id=$1 AND user_id=$2 UNION ALL SELECT user_id FROM treido.seller_memberships WHERE seller_id=$1 AND user_id=$2 AND status='active'`,
      [mapping.sellerId, user.id],
    );
    if (self.rowCount) throw new SellerError("FORBIDDEN");
    return (
      allocation.state === "active" && current.live && !current.cancelRequested
    );
  });
  if (
    !permitted ||
    ![
      "requires_payment_method",
      "requires_confirmation",
      "requires_action",
    ].includes(intent.status)
  )
    return { id: prepared.row.id, status: "reconciling" as const };
  if (!intent.client_secret) throw new SellerError("NOT_AVAILABLE");
  return {
    id: prepared.row.id,
    status: "ready" as const,
    clientSecret: intent.client_secret,
    publishableKey: binding.publishableKey,
  };
}
export function verifyPaymentIntent(
  row: AttemptRow,
  intent: Stripe.PaymentIntent,
  binding: PaymentBindings,
) {
  assertAttemptScope(row, binding);
  const destination =
    typeof intent.transfer_data?.destination === "string"
      ? intent.transfer_data.destination
      : intent.transfer_data?.destination?.id;
  const merchant =
    typeof intent.on_behalf_of === "string"
      ? intent.on_behalf_of
      : intent.on_behalf_of?.id;
  if (
    (intent.id !== row.providerId && row.providerId !== null) ||
    intent.livemode !== binding.livemode ||
    intent.amount !== row.totalMinor ||
    intent.currency !== "eur" ||
    intent.application_fee_amount !== row.applicationFeeMinor ||
    destination !== row.connectedAccount ||
    (merchant ?? null) !==
      (row.terms.settlementMerchant === "seller"
        ? row.connectedAccount
        : null) ||
    intent.metadata.attempt_id !== row.id ||
    intent.metadata.quote_id !== row.quoteId ||
    intent.metadata.seller_id !== row.sellerId ||
    intent.metadata.application_id !== binding.applicationId ||
    intent.metadata.environment !== binding.environment ||
    intent.capture_method !== "automatic"
  )
    throw new SellerError("CONFLICT");
}
export async function requestPaymentCancellation(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  const command = parseResource(raw);
  if (command.actorKey !== libraryActorKey(identity))
    throw new SellerError("FORBIDDEN");
  return inTransaction(database, async (tx) => {
    const user = await authorizeHuman(tx, identity, false);
    const row = (
      await tx.client.query<AttemptRow>(
        `SELECT ${attemptColumns} FROM treido.payment_attempts a JOIN treido.payable_quotes q ON q.id=a.quote_id WHERE q.id=$1 AND q.buyer_id=$2`,
        [command.id, user.id],
      )
    ).rows[0];
    if (!row) throw new SellerError("NOT_FOUND");
    await lockAllocation(tx, row.allocationId);
    const current = (
      await tx.client.query<{ state: AttemptState }>(
        `SELECT state FROM treido.payment_attempts WHERE id=$1 FOR UPDATE`,
        [row.id],
      )
    ).rows[0];
    if (!current || ["paid", "quarantined"].includes(current.state))
      throw new SellerError("CONFLICT");
    await tx.client.query(
      `UPDATE treido.payment_attempts SET cancel_requested=true,reconcile_at=clock_timestamp() WHERE id=$1`,
      [row.id],
    );
    await enqueuePaymentObservation(
      tx,
      row.id,
      row.sellerId,
      command.requestId,
    );
    return { id: row.id, status: "reconciling" as const };
  });
}
