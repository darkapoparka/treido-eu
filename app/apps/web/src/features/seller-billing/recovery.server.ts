import "server-only";
import { randomUUID } from "node:crypto";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import {
  hasVerifiedRecentAuthentication,
  type VerifiedIdentity,
} from "../../server/identity/clerk.server";
import { authorizeSeller, inputHash } from "../sellers/persistence.server";
import { libraryActorKey } from "../library/cursor.server";
import { SellerError } from "../sellers/errors";
import { paymentBindings, verifiedStripe } from "../payments/bindings.server";
import { approvedCustomer, billingRecoveryReady } from "./storage.server";
import {
  enqueueBillingObservation,
  intentColumns,
  publicIntent,
  type BillingIntent,
} from "./commands.server";
import { matchingChangeInvoice } from "./change-provider.server";
import { parseBillingRecovery, pendingChange } from "./recovery-model";
import { providerId } from "./provider.server";

type Receipt = {
  id: string;
  intentId: string;
  inputHash: string;
  operation: string;
  invoiceId: string | null;
  idempotencyKey: string;
  state: string;
  claimToken: string;
  claimExpired: boolean;
};
// PostgreSQL retains microseconds here; a JS Date would collapse distinct attempts.
// Expiry permits another deliberate cancellation attempt, never money-slot release.
const claimLease = "interval '2 minutes'";
const receiptColumns = `id,intent_id AS "intentId",input_hash AS "inputHash",operation,invoice_id AS "invoiceId",idempotency_key AS "idempotencyKey",state,updated_at::text AS "claimToken",updated_at<=clock_timestamp()-${claimLease} AS "claimExpired"`;
/** Deliberate current-human command. Jobs never issue void/payment/update POSTs. */
export async function manageBillingRecovery(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  const command = parseBillingRecovery(raw);
  if (!command) throw new SellerError("INVALID_INPUT");
  if (
    command.actorKey !== libraryActorKey(identity) ||
    !hasVerifiedRecentAuthentication(identity)
  )
    throw new SellerError("FORBIDDEN");
  const source = await inTransaction(database, async (tx) => {
    const access = await authorizeSeller(
      tx,
      identity,
      command.sellerId,
      "billing.manage",
    );
    await tx.client.query(
      "SELECT seller_id FROM treido.seller_usage WHERE seller_id=$1 FOR UPDATE",
      [command.sellerId],
    );
    if (!(await billingRecoveryReady(tx)))
      throw new SellerError("NOT_AVAILABLE");
    const row = (
      await tx.client.query<BillingIntent>(
        `SELECT ${intentColumns} FROM treido.billing_intents WHERE id=$1 AND seller_id=$2 FOR UPDATE`,
        [command.intentId, command.sellerId],
      )
    ).rows[0];
    if (!row) throw new SellerError("NOT_FOUND");
    const hash = inputHash(command);
    const prior = (
      await tx.client.query<Receipt>(
        `SELECT ${receiptColumns} FROM treido.billing_recovery_requests WHERE seller_id=$1 AND actor_id=$2 AND request_id=$3 FOR UPDATE`,
        [command.sellerId, access.user.id, command.requestId],
      )
    ).rows[0];
    if (prior) {
      if (prior.inputHash !== hash || prior.intentId !== row.id)
        throw new SellerError("CONFLICT");
      if (
        prior.operation === "abandon" &&
        prior.invoiceId &&
        ["creating", "ready", "reconciling"].includes(row.state) &&
        (prior.state === "reconciling" ||
          (prior.state === "creating" && prior.claimExpired))
      ) {
        // Explicit cancellation retry may re-read and void the SAME invoice with
        // the SAME key. It cannot create/update/pay a subscription. Concurrent
        // repeats see an unexpired 'creating' claim and perform no provider I/O.
        // The locked receipt serializes retries; keep its immutable input/key.
        // A monotonic microsecond also protects against equal/backward clock ticks.
        await tx.client.query(
          `UPDATE treido.billing_recovery_requests SET state='creating',updated_at=GREATEST(clock_timestamp(),updated_at+interval '1 microsecond') WHERE id=$1 AND updated_at::text=$2 AND (state='reconciling' OR (state='creating' AND updated_at<=clock_timestamp()-${claimLease}))`,
          [prior.id, prior.claimToken],
        );
        // Read on this same transaction while still holding the receipt lock.
        const receipt = (
          await tx.client.query<Receipt>(
            `SELECT ${receiptColumns} FROM treido.billing_recovery_requests WHERE seller_id=$1 AND actor_id=$2 AND request_id=$3 FOR UPDATE`,
            [command.sellerId, access.user.id, command.requestId],
          )
        ).rows[0];
        return {
          row,
          receipt,
          actorId: access.user.id,
          write: receipt.state === "creating",
        };
      }
      return { row, receipt: prior, actorId: access.user.id, write: false };
    }
    if (row.revision !== command.expectedRevision)
      throw new SellerError("CONFLICT");
    const count = (
      await tx.client.query<{ count: string }>(
        "SELECT count(*) FROM treido.billing_recovery_requests WHERE seller_id=$1 AND actor_id=$2 AND created_at>clock_timestamp()-interval '1 minute'",
        [command.sellerId, access.user.id],
      )
    ).rows[0];
    if (Number(count.count) >= 10) throw new SellerError("QUOTA_EXCEEDED");
    let write = false;
    if (command.operation === "abandon") {
      if (!["prepared", "creating", "ready", "reconciling"].includes(row.state))
        throw new SellerError("CONFLICT");
      if (row.state === "prepared" && !row.firstAttemptAt) {
        // Same seller lock as the original execution claim. No provider call could exist.
        Object.assign(
          row,
          (
            await tx.client.query<BillingIntent>(
              `UPDATE treido.billing_intents SET state='expired',updated_at=clock_timestamp() WHERE id=$1 AND state='prepared' AND first_attempt_at IS NULL RETURNING ${intentColumns}`,
              [row.id],
            )
          ).rows[0],
        );
      } else {
        if (
          row.operation !== "change" ||
          !pendingChange(row.parameters) ||
          !row.changeInvoiceId
        )
          throw new SellerError("NOT_AVAILABLE");
        const pending = await tx.client.query(
          "SELECT id FROM treido.billing_recovery_requests WHERE intent_id=$1 AND operation='abandon' AND state IN ('creating','reconciling')",
          [row.id],
        );
        if (pending.rowCount) throw new SellerError("CONFLICT");
        write = true;
      }
    }
    const id = randomUUID();
    const receipt = (
      await tx.client.query<Receipt>(
        `INSERT INTO treido.billing_recovery_requests(id,intent_id,seller_id,actor_id,request_id,input_hash,operation,expected_revision,invoice_id,idempotency_key,state)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING ${receiptColumns}`,
        [
          id,
          row.id,
          row.sellerId,
          access.user.id,
          command.requestId,
          hash,
          command.operation,
          command.expectedRevision,
          row.changeInvoiceId,
          "seller-billing-recovery:" + id,
          write ? "creating" : "complete",
        ],
      )
    ).rows[0];
    if (command.operation !== "escalate" && row.state !== "expired")
      await enqueueBillingObservation(tx, row, command.requestId);
    return { row, receipt, actorId: access.user.id, write };
  });
  if (source.write) {
    // A claimed cancellation retries only its original invoice and key, after READ.
    // Cancellation never switches to another invoice/key if payment won the race.
    try {
      const binding = paymentBindings();
      const customer = await inTransaction(database, async (tx) => {
        await authorizeSeller(tx, identity, command.sellerId, "billing.manage");
        if (!hasVerifiedRecentAuthentication(identity))
          throw new SellerError("FORBIDDEN");
        const customer = await approvedCustomer(tx, binding, command.sellerId);
        if (customer.id !== source.row.customerBindingId)
          throw new SellerError("CONFLICT");
        await tx.client.query(
          "SELECT treido.lock_billing_registry(NULL,$1,$2,$3,$4,$5,$6)",
          [
            customer.id,
            command.sellerId,
            binding.platformAccount,
            binding.livemode,
            binding.environment,
            binding.applicationId,
          ],
        );
        return customer;
      });
      const stripe = await verifiedStripe(binding, false);
      const invoice = await stripe.invoices.retrieve(source.receipt.invoiceId!);
      const sub = await stripe.subscriptions.retrieve(
        source.row.subscriptionId!,
      );
      if (
        invoice.id !== source.receipt.invoiceId ||
        !matchingChangeInvoice(
          invoice,
          customer.providerId,
          sub.id,
          binding.livemode,
        ) ||
        sub.id !== source.row.subscriptionId ||
        sub.livemode !== binding.livemode ||
        providerId(sub.customer) !== customer.providerId ||
        sub.metadata.purpose !== "seller_subscription" ||
        sub.metadata.seller_id !== command.sellerId ||
        sub.metadata.application_id !== binding.applicationId ||
        sub.metadata.environment !== binding.environment
      )
        throw new SellerError("CONFLICT");
      if (
        invoice.status === "open" &&
        sub.pending_update &&
        providerId(sub.latest_invoice) === invoice.id
      ) {
        if (!hasVerifiedRecentAuthentication(identity))
          throw new SellerError("FORBIDDEN");
        // Membership may have been revoked during the external invoice reads.
        // Recheck current authority immediately before the deliberate void POST.
        await inTransaction(database, async (tx) => {
          await authorizeSeller(
            tx,
            identity,
            command.sellerId,
            "billing.manage",
          );
          if (!hasVerifiedRecentAuthentication(identity))
            throw new SellerError("FORBIDDEN");
          // Serialize with claims/completion in the same seller-first lock order.
          await tx.client.query(
            "SELECT seller_id FROM treido.seller_usage WHERE seller_id=$1 FOR UPDATE",
            [command.sellerId],
          );
          await tx.client.query(
            "SELECT treido.lock_billing_registry(NULL,$1,$2,$3,$4,$5,$6)",
            [
              customer.id,
              command.sellerId,
              binding.platformAccount,
              binding.livemode,
              binding.environment,
              binding.applicationId,
            ],
          );
          const receipt = await tx.client.query(
            `SELECT r.id FROM treido.billing_recovery_requests r JOIN treido.billing_intents i ON i.id=r.intent_id AND i.seller_id=r.seller_id
             WHERE r.id=$1 AND r.intent_id=$2 AND r.seller_id=$3 AND r.invoice_id=$4 AND r.state='creating'
             AND r.updated_at::text=$5 AND r.updated_at>clock_timestamp()-${claimLease}
             AND r.operation='abandon' AND r.input_hash=$6 AND r.idempotency_key=$7
             AND i.state IN ('creating','ready','reconciling') AND i.operation='change' AND i.change_invoice_id=r.invoice_id
             AND i.subscription_id=$8 AND i.customer_binding_id=$9 AND i.parameter_hash=$10 FOR SHARE OF i,r`,
            [
              source.receipt.id,
              source.row.id,
              command.sellerId,
              invoice.id,
              source.receipt.claimToken,
              source.receipt.inputHash,
              source.receipt.idempotencyKey,
              source.row.subscriptionId,
              customer.id,
              source.row.parameterHash,
            ],
          );
          if (receipt.rowCount !== 1) throw new SellerError("CONFLICT");
        });
        if (!hasVerifiedRecentAuthentication(identity))
          throw new SellerError("FORBIDDEN");
        // Stripe's documented cancellation of a pending update. No pay() or update() replay.
        await stripe.invoices.voidInvoice(
          invoice.id,
          {},
          { idempotencyKey: source.receipt.idempotencyKey },
        );
      }
    } catch {
      // Could already be paid, lost permission, or be an unknown provider result.
      // The original intent continues blocking replacement until an authoritative read.
    }
    const current = await inTransaction(database, async (tx) => {
      await tx.client.query(
        "SELECT seller_id FROM treido.seller_usage WHERE seller_id=$1 FOR UPDATE",
        [command.sellerId],
      );
      const row = (
        await tx.client.query<BillingIntent>(
          `SELECT ${intentColumns} FROM treido.billing_intents WHERE id=$1 AND seller_id=$2 FOR UPDATE`,
          [source.row.id, command.sellerId],
        )
      ).rows[0];
      const acknowledged = await tx.client.query(
        `UPDATE treido.billing_recovery_requests SET state='reconciling',updated_at=GREATEST(clock_timestamp(),updated_at+interval '1 microsecond') WHERE id=$1 AND state IN ('creating') AND updated_at::text=$2 AND updated_at>clock_timestamp()-${claimLease} RETURNING id`,
        [source.receipt.id, source.receipt.claimToken],
      );
      // A late attempt must neither overwrite a new claim nor enqueue/retire it.
      if (acknowledged.rowCount === 1) await enqueueBillingObservation(tx, row);
      const receipt = (
        await tx.client.query<Receipt>(
          `SELECT ${receiptColumns} FROM treido.billing_recovery_requests WHERE seller_id=$1 AND actor_id=$2 AND request_id=$3`,
          [command.sellerId, source.actorId, command.requestId],
        )
      ).rows[0];
      return { row, receipt };
    });
    source.row = current.row;
    source.receipt = current.receipt;
  }
  return {
    receiptId: source.receipt.id,
    operation: source.receipt.operation,
    state: source.receipt.state,
    intent: publicIntent(source.row),
  };
}
