import "server-only";
import { randomUUID, createHash } from "node:crypto";
import type Stripe from "stripe";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import { enqueueJob } from "../../server/jobs/outbox.server";
import type {
  EffectContext,
  EffectResult,
} from "../../server/jobs/execution.server";
import type { PaymentBindings } from "../payments/bindings.server";
import { SellerError } from "../sellers/errors";
import { UUID, type CampaignState } from "./model";
import {
  promotionPaymentBridge,
  type PromotionIntent,
} from "./payment-bridge.server";
import {
  applyPromotionObservation,
  cancelUnattemptedPromotion,
} from "./provider.server";

/** Called ONLY after the shared raw-body/account/mode/signature receipt. A signal schedules a read; it grants nothing. */
export async function receivePromotionEvent(
  tx: SellerTransaction,
  event: Stripe.Event,
  binding: PaymentBindings,
): Promise<boolean> {
  const raw = event.data.object as {
    id?: unknown;
    metadata?: Record<string, string>;
    payment_intent?: unknown;
  };
  if (raw.metadata?.purpose !== "promotion") {
    // Charge/refund/dispute metadata need not inherit PI purpose. Signed association only schedules retrieval.
    const pi =
      typeof raw.payment_intent === "string" &&
      /^pi_[A-Za-z0-9]+$/.test(raw.payment_intent)
        ? raw.payment_intent
        : null;
    if (
      !pi ||
      ![
        "charge.refunded",
        "charge.dispute.created",
        "charge.dispute.closed",
        "refund.created",
        "refund.updated",
      ].includes(event.type)
    )
      return false;
    if (
      event.account ||
      event.livemode !== binding.livemode ||
      !/^evt_[A-Za-z0-9]+$/.test(event.id) ||
      !Number.isSafeInteger(event.created) ||
      event.created < 0
    )
      throw new SellerError("FORBIDDEN");
    const known = (
      await tx.client.query<{ id: string; sellerId: string }>(
        `SELECT id,seller_id AS "sellerId" FROM treido.promotion_attempts WHERE provider_id=$1 AND platform_account=$2 AND livemode=$3 AND intent->>'environment'=$4 AND intent->>'applicationId'=$5`,
        [
          pi,
          binding.platformAccount,
          binding.livemode,
          binding.environment,
          binding.applicationId,
        ],
      )
    ).rows[0];
    if (!known) return false;
    await insertSignal(tx, event, binding, known.id, known.sellerId, pi);
    return true;
  }
  if (
    !/^evt_[A-Za-z0-9]+$/.test(event.id) ||
    !Number.isSafeInteger(event.created) ||
    event.created < 0
  )
    throw new SellerError("INVALID_INPUT");
  if (
    event.account ||
    event.livemode !== binding.livemode ||
    !UUID(raw.metadata.attempt_id) ||
    !UUID(raw.metadata.seller_id) ||
    !UUID(raw.metadata.campaign_id) ||
    raw.metadata.environment !== binding.environment ||
    raw.metadata.application_id !== binding.applicationId
  )
    throw new SellerError("FORBIDDEN");
  const row = (
    await tx.client.query<{
      id: string;
      sellerId: string;
      campaignId: string;
      providerId: string | null;
      checkoutSessionId: string | null;
      intent: PromotionIntent;
    }>(
      `SELECT id,seller_id AS "sellerId",campaign_id AS "campaignId",provider_id AS "providerId",checkout_session_id AS "checkoutSessionId",intent FROM treido.promotion_attempts WHERE id=$1 AND platform_account=$2 AND livemode=$3`,
      [raw.metadata.attempt_id, binding.platformAccount, binding.livemode],
    )
  ).rows[0];
  if (
    !row ||
    row.sellerId !== raw.metadata.seller_id ||
    row.campaignId !== raw.metadata.campaign_id ||
    row.intent.productId !== raw.metadata.product_id ||
    row.intent.currency !== "EUR" ||
    row.intent.environment !== binding.environment ||
    row.intent.applicationId !== binding.applicationId
  )
    throw new SellerError("FORBIDDEN");
  const provider =
    event.type.startsWith("payment_intent.") ||
    event.type.startsWith("checkout.session.")
      ? raw.id
      : typeof raw.payment_intent === "string"
        ? raw.payment_intent
        : null;
  if (
    typeof provider !== "string" ||
    !/^(pi_|cs_(test_|live_)?)[A-Za-z0-9]+$/.test(provider) ||
    (provider.startsWith("pi_") &&
      row.providerId !== null &&
      provider !== row.providerId) ||
    (provider.startsWith("cs_") &&
      row.checkoutSessionId !== null &&
      provider !== row.checkoutSessionId)
  )
    throw new SellerError("FORBIDDEN");
  await insertSignal(tx, event, binding, row.id, row.sellerId, provider);
  return true;
}
async function insertSignal(
  tx: SellerTransaction,
  event: Stripe.Event,
  binding: PaymentBindings,
  attemptId: string,
  sellerId: string,
  provider: string,
) {
  const digest = createHash("sha256")
    .update(binding.platformAccount + ":" + binding.livemode + ":" + event.id)
    .digest("hex");
  const operationKey = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
  await tx.client.query(
    `INSERT INTO treido.promotion_provider_signals(platform_account,livemode,event_id,attempt_id,provider_id,provider_created_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
    [
      binding.platformAccount,
      binding.livemode,
      event.id,
      attemptId,
      provider,
      new Date(event.created * 1000),
    ],
  );
  await enqueueJob(tx, {
    kind: "promotion.reconcile",
    sellerId,
    resourceId: attemptId,
    operationKey,
    actorId: null,
    authority: "service",
  });
}
/** Existing executor controls lease/completion; current domain locks + application happen in its same apply transaction. */
export async function processPromotionObservation(
  database: SellerDatabase,
  job: EffectContext,
): Promise<EffectResult> {
  if (
    job.kind !== "promotion.reconcile" ||
    job.authority !== "service" ||
    !UUID(job.resourceId) ||
    !UUID(job.sellerId)
  )
    throw new SellerError("FORBIDDEN");
  const bridge = promotionPaymentBridge();
  if (!bridge) throw new SellerError("NOT_AVAILABLE");
  const row = (
    await database.pool.query<{
      intent: PromotionIntent;
      providerId: string | null;
      checkoutSessionId: string | null;
    }>(
      `SELECT intent,provider_id AS "providerId",checkout_session_id AS "checkoutSessionId" FROM treido.promotion_attempts WHERE id=$1 AND seller_id=$2`,
      [job.resourceId, job.sellerId],
    )
  ).rows[0];
  if (
    !row ||
    Object.entries(bridge.binding).some(
      ([key, value]) => row.intent[key as keyof PromotionIntent] !== value,
    )
  )
    throw new SellerError("FORBIDDEN");
  const unused = (
    await database.pool.query(
      `SELECT pa.id FROM treido.promotion_attempts pa LEFT JOIN treido.promotion_checkout_intents ci ON ci.attempt_id=pa.id WHERE pa.id=$1 AND pa.seller_id=$2 AND pa.state IN ('prepared','creating','reconciling') AND pa.provider_id IS NULL AND pa.checkout_session_id IS NULL AND ci.first_attempt_at IS NULL AND ci.checkout_session_id IS NULL AND (pa.intent->>'checkoutExpiresAt')::timestamptz<=clock_timestamp()`,
      [job.resourceId, job.sellerId],
    )
  ).rows[0];
  if (unused)
    return {
      resultId: job.resourceId,
      lock: async (tx) => {
        await tx.client.query(
          `SELECT id FROM treido.seller_accounts WHERE id=$1 FOR UPDATE`,
          [job.sellerId],
        );
      },
      apply: async (tx) => {
        if (!(await cancelUnattemptedPromotion(tx, job.resourceId, bridge)))
          throw new SellerError("CONFLICT");
      },
    };
  const fact = await bridge.observe({
    ...row.intent,
    providerId: row.providerId,
    checkoutSessionId: row.checkoutSessionId,
  });
  return {
    resultId: job.resourceId,
    ...(fact.providerId === null ? {} : { providerObjectId: fact.providerId }),
    lock: async (tx) => {
      await tx.client.query(
        `SELECT id FROM treido.seller_accounts WHERE id=$1 FOR UPDATE`,
        [job.sellerId],
      );
    },
    apply: (tx) => applyPromotionObservation(tx, job.resourceId, bridge, fact),
  };
}
/** Bounded repair of actual unresolved attempts/expired delivery; absent bridge performs no work. */
export async function schedulePromotionRepair(
  database: SellerDatabase,
): Promise<number> {
  if (!promotionPaymentBridge()) return 0;
  return inTransaction(database, async (tx) => {
    await tx.client.query(
      `DELETE FROM treido.promotion_metrics WHERE (campaign_id,placement_id,kind) IN (SELECT campaign_id,placement_id,kind FROM treido.promotion_metrics WHERE expires_at<=clock_timestamp() ORDER BY expires_at,campaign_id,placement_id,kind LIMIT 1000)`,
    );
    const rows = (
      await tx.client.query<{ id: string; sellerId: string }>(
        `SELECT pa.id,pa.seller_id AS "sellerId" FROM treido.promotion_attempts pa JOIN treido.promotion_campaigns pc ON pc.id=pa.campaign_id WHERE (pa.state IN ('creating','reconciling','pending') OR (pa.state='prepared' AND (pa.intent->>'checkoutExpiresAt')::timestamptz<=clock_timestamp())) AND pa.updated_at<clock_timestamp()-interval '5 minutes' AND NOT EXISTS(SELECT 1 FROM treido.outbox_jobs j WHERE j.kind='promotion.reconcile' AND j.resource_id=pa.id AND j.state IN ('pending','accepted')) ORDER BY pa.updated_at,pa.id LIMIT 20`,
        [],
      )
    ).rows;
    for (const row of rows)
      await enqueueJob(tx, {
        kind: "promotion.reconcile",
        sellerId: row.sellerId,
        resourceId: row.id,
        operationKey: randomUUID(),
        actorId: null,
        authority: "service",
      });
    const expired = (
      await tx.client.query<{ id: string; sellerId: string }>(
        `SELECT pc.id,pc.seller_id AS "sellerId" FROM treido.promotion_campaigns pc JOIN treido.promotion_intervals pi ON pi.campaign_id=pc.id WHERE pc.state IN ('active','scheduled','paused') AND pi.ends_at<=clock_timestamp() ORDER BY pi.ends_at,pc.id LIMIT 20`,
      )
    ).rows;
    for (const row of expired) {
      await tx.client.query(
        `SELECT id FROM treido.seller_accounts WHERE id=$1 FOR UPDATE`,
        [row.sellerId],
      );
      const updated = (
        await tx.client.query<{ revision: number; state: CampaignState }>(
          `UPDATE treido.promotion_campaigns pc SET state='completed',reason='expired',revision=revision+1,updated_at=clock_timestamp() WHERE pc.id=$1 AND pc.state IN ('active','scheduled','paused') AND EXISTS(SELECT 1 FROM treido.promotion_intervals pi WHERE pi.campaign_id=pc.id AND pi.ends_at<=clock_timestamp()) RETURNING revision,state`,
          [row.id],
        )
      ).rows[0];
      if (updated) {
        await tx.client.query(
          `UPDATE treido.promotion_reservations SET status='released' WHERE campaign_id=$1`,
          [row.id],
        );
        await tx.client.query(
          `INSERT INTO treido.promotion_events(id,campaign_id,source,action,reason,state,revision) VALUES($1,$2,'service','expire','immutable interval expired','completed',$3)`,
          [randomUUID(), row.id, updated.revision],
        );
      }
    }
    return rows.length + expired.length;
  });
}
