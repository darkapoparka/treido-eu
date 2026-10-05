import "server-only";
import { randomUUID } from "node:crypto";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import { SellerError } from "../sellers/errors";
import { authorizeHuman } from "../sellers/persistence.server";
import { authorizeSeller } from "../sellers/persistence.server";
import { authorizePromotion } from "./authority.server";
import {
  hasVerifiedRecentAuthentication,
  type VerifiedIdentity,
} from "../../server/identity/clerk.server";
import {
  UUID,
  HEX,
  deliveryRemedy,
  hasForbiddenControls,
  type CampaignState,
  type StopReason,
  type Terms,
} from "./model";
import {
  approvedProduct,
  approvedPromotionPayment,
  campaign,
  capacity,
  databaseTime,
  lockPublication,
} from "./storage.server";
import { currentEligible, listingStopReason } from "./eligibility.server";
import type {
  PromotionIntent,
  PromotionPaymentBridge,
} from "./payment-bridge.server";

type Attempt = {
  id: string;
  sellerId: string;
  campaignId: string;
  state: string;
  providerId: string | null;
  checkoutSessionId: string | null;
  intent: PromotionIntent;
};
async function attempt(tx: SellerTransaction, id: string) {
  if (!UUID(id)) throw new SellerError("INVALID_INPUT");
  const row = (
    await tx.client.query<Attempt>(
      `SELECT id,seller_id AS "sellerId",campaign_id AS "campaignId",state,provider_id AS "providerId",checkout_session_id AS "checkoutSessionId",intent FROM treido.promotion_attempts WHERE id=$1`,
      [id],
    )
  ).rows[0];
  if (!row) throw new SellerError("NOT_FOUND");
  await tx.client.query(
    `SELECT id FROM treido.seller_accounts WHERE id=$1 FOR UPDATE`,
    [row.sellerId],
  );
  await campaign(tx, row.sellerId, row.campaignId, true);
  return (
    await tx.client.query<Attempt>(
      `SELECT id,seller_id AS "sellerId",campaign_id AS "campaignId",state,provider_id AS "providerId",checkout_session_id AS "checkoutSessionId",intent FROM treido.promotion_attempts WHERE id=$1 FOR UPDATE`,
      [id],
    )
  ).rows[0];
}
function sameBinding(intent: PromotionIntent, bridge: PromotionPaymentBridge) {
  return (
    intent.purpose === "promotion" &&
    Object.entries(bridge.binding).every(
      ([key, value]) => intent[key as keyof PromotionIntent] === value,
    )
  );
}
export function safeCheckoutUrl(raw: string | null) {
  if (raw === null) return null;
  if (raw.length > 2048) throw new SellerError("NOT_AVAILABLE");
  const u = new URL(raw);
  if (
    u.protocol !== "https:" ||
    u.hostname !== "checkout.stripe.com" ||
    u.username ||
    u.password ||
    u.port ||
    u.hash
  )
    throw new SellerError("NOT_AVAILABLE");
  return u.toString();
}
async function transition(
  tx: SellerTransaction,
  row: Attempt,
  state: CampaignState,
  reason: StopReason | null,
  action: "provider" | "start" | "expire" | "bump",
  detail: string,
) {
  const changed = (
    await tx.client.query<{ revision: number }>(
      `UPDATE treido.promotion_campaigns SET state=$2,reason=$3,revision=revision+1,updated_at=clock_timestamp() WHERE id=$1 RETURNING revision`,
      [row.campaignId, state, reason],
    )
  ).rows[0];
  await tx.client.query(
    `INSERT INTO treido.promotion_events(id,campaign_id,source,action,reason,state,revision) VALUES($1,$2,'service',$3,$4,$5,$6)`,
    [randomUUID(), row.campaignId, action, detail, state, changed.revision],
  );
}

/** Only the canonical provider owner calls this with its approved server bridge. External work is outside locks. */
export async function createPromotionPayment(
  database: SellerDatabase,
  id: string,
  bridge: PromotionPaymentBridge,
  identity?: VerifiedIdentity,
) {
  if (identity && !hasVerifiedRecentAuthentication(identity))
    throw new SellerError("FORBIDDEN");
  const prepared = await inTransaction(database, async (tx) => {
    if (identity) {
      const owned = (
        await tx.client.query<{ sellerId: string }>(
          `SELECT seller_id AS "sellerId" FROM treido.promotion_attempts WHERE id=$1`,
          [id],
        )
      ).rows[0];
      if (!owned) throw new SellerError("NOT_FOUND");
      await authorizePromotion(tx, identity, owned.sellerId, true);
      await authorizeSeller(tx, identity, owned.sellerId, "billing.manage");
    }
    const row = await attempt(tx, id);
    if (!sameBinding(row.intent, bridge)) throw new SellerError("FORBIDDEN");
    // One application POST only. Unknown/crashed effects are searched/retrieved, never recreated after key retention expires.
    if (row.providerId || row.checkoutSessionId || row.state !== "prepared")
      return null;
    const c = await campaign(tx, row.sellerId, row.campaignId);
    if (
      !c ||
      c.reason === "seller_choice" ||
      !["awaiting_payment", "reconciling"].includes(c.state)
    )
      return null;
    if (row.state === "prepared") {
      const reservation = (
        await tx.client.query<{
          capacityId: string;
          expiresAt: Date;
          status: string;
        }>(
          `SELECT capacity_id AS "capacityId",expires_at AS "expiresAt",status FROM treido.promotion_reservations WHERE campaign_id=$1`,
          [c.id],
        )
      ).rows[0];
      const now = await databaseTime(tx);
      await lockPublication(tx, row.sellerId, c.listingId);
      const listing = await currentEligible(tx, row.sellerId, c.listingId);
      const kind = (
        await tx.client.query<{ kind: string }>(
          `SELECT kind FROM treido.seller_accounts WHERE id=$1`,
          [row.sellerId],
        )
      ).rows[0].kind;
      const policy = listing
        ? await approvedProduct(tx, c.productId, { ...listing, kind }, bridge)
        : null;
      const cap =
        policy && reservation?.capacityId === policy.capacityId
          ? await capacity(tx, policy.capacityId, true)
          : null;
      if (
        !reservation ||
        reservation.status !== "reserved" ||
        reservation.expiresAt <= now ||
        reservation.expiresAt.toISOString() !== row.intent.checkoutExpiresAt ||
        !listing ||
        !policy ||
        !cap ||
        cap.reserved > cap.slots
      ) {
        await tx.client.query(
          `UPDATE treido.promotion_attempts SET state='cancelled',updated_at=clock_timestamp() WHERE id=$1`,
          [id],
        );
        await tx.client.query(
          `UPDATE treido.promotion_reservations SET status='released' WHERE campaign_id=$1`,
          [c.id],
        );
        await transition(
          tx,
          row,
          "cancelled",
          "payment_failed",
          "provider",
          "prepared intent expired or became ineligible before external work",
        );
        return null;
      }
    }
    await tx.client.query(
      `UPDATE treido.promotion_attempts SET state='creating',updated_at=clock_timestamp() WHERE id=$1`,
      [id],
    );
    return row;
  });
  if (!prepared) return;
  let result: Awaited<ReturnType<PromotionPaymentBridge["create"]>>;
  try {
    result = await bridge.create(prepared.intent);
  } catch {
    result = { uncertain: true };
  }
  await inTransaction(database, async (tx) => {
    const row = await attempt(tx, id);
    if (!sameBinding(row.intent, bridge)) throw new SellerError("FORBIDDEN");
    if ("uncertain" in result) {
      if (!["paid", "cancelled", "quarantined"].includes(row.state)) {
        await tx.client.query(
          `UPDATE treido.promotion_attempts SET state='reconciling',updated_at=clock_timestamp() WHERE id=$1`,
          [id],
        );
        const c = await campaign(tx, row.sellerId, row.campaignId);
        await transition(
          tx,
          row,
          "reconciling",
          c?.reason === "seller_choice"
            ? "seller_choice"
            : "provider_uncertain",
          "provider",
          "provider outcome uncertain",
        );
      }
      return;
    }
    if (
      (result.providerId !== null &&
        !/^pi_[A-Za-z0-9]+$/.test(result.providerId)) ||
      !/^cs_(test_|live_)?[A-Za-z0-9]+$/.test(result.checkoutSessionId)
    )
      throw new SellerError("NOT_AVAILABLE");
    const url = safeCheckoutUrl(result.checkoutUrl);
    if (row.providerId && row.providerId !== result.providerId)
      throw new SellerError("CONFLICT");
    if (
      row.checkoutSessionId &&
      row.checkoutSessionId !== result.checkoutSessionId
    )
      throw new SellerError("CONFLICT");
    if (["paid", "cancelled", "quarantined"].includes(row.state)) return;
    await tx.client.query(
      `UPDATE treido.promotion_attempts SET provider_id=$2,checkout_url=$3,checkout_session_id=$4,state='pending',updated_at=clock_timestamp() WHERE id=$1`,
      [id, result.providerId, url, result.checkoutSessionId],
    );
  });
}

/** Fetches authoritative facts through the trusted bridge; callers cannot post a paid flag or forged observation. */
export async function reconcilePromotionPayment(
  database: SellerDatabase,
  id: string,
  bridge: PromotionPaymentBridge,
) {
  const initial = await inTransaction(database, async (tx) => {
    const row = await attempt(tx, id);
    if (!sameBinding(row.intent, bridge)) throw new SellerError("FORBIDDEN");
    return row;
  });
  const fact = await bridge.observe({
    ...initial.intent,
    providerId: initial.providerId,
    checkoutSessionId: initial.checkoutSessionId,
  });
  if (
    fact.purpose !== "promotion" ||
    !validObservationProvider(fact) ||
    !/^evt_[A-Za-z0-9]+$/.test(fact.eventId) ||
    !HEX(fact.evidenceHash) ||
    !Number.isFinite(Date.parse(fact.authoritativeAt)) ||
    ![
      "paid",
      "pending",
      "cancelled",
      "failed",
      "refunded",
      "disputed",
    ].includes(fact.state)
  )
    throw new SellerError("INVALID_INPUT");
  return inTransaction(database, (tx) =>
    applyPromotionObservation(tx, id, bridge, fact),
  );
}
export async function applyPromotionObservation(
  tx: SellerTransaction,
  id: string,
  bridge: PromotionPaymentBridge,
  fact: Awaited<ReturnType<PromotionPaymentBridge["observe"]>>,
) {
  if (
    fact.purpose !== "promotion" ||
    !validObservationProvider(fact) ||
    typeof fact.eventId !== "string" ||
    fact.eventId.length > 255 ||
    !/^evt_[A-Za-z0-9]+$/.test(fact.eventId) ||
    !HEX(fact.evidenceHash) ||
    !Number.isFinite(Date.parse(fact.authoritativeAt)) ||
    ![
      "paid",
      "pending",
      "cancelled",
      "failed",
      "refunded",
      "disputed",
    ].includes(fact.state) ||
    typeof fact.checkoutSessionId !== "string" ||
    fact.checkoutSessionId.length > 255 ||
    !/^cs_(test_|live_)?[A-Za-z0-9]+$/.test(fact.checkoutSessionId)
  )
    throw new SellerError("INVALID_INPUT");
  const row = await attempt(tx, id),
    intent = row.intent;
  if (
    row.checkoutSessionId !== null &&
    row.checkoutSessionId !== fact.checkoutSessionId
  )
    throw new SellerError("FORBIDDEN");
  if (
    !sameBinding(intent, bridge) ||
    [
      "sellerId",
      "campaignId",
      "attemptId",
      "productId",
      "totalMinor",
      "currency",
      "platformAccount",
      "environment",
      "applicationId",
      "livemode",
    ].some(
      (key) =>
        fact[key as keyof typeof fact] !== intent[key as keyof PromotionIntent],
    ) ||
    (row.providerId !== null && row.providerId !== fact.providerId)
  )
    throw new SellerError("FORBIDDEN");
  const prior = (
    await tx.client.query<{ hash: string; attemptId: string }>(
      `SELECT evidence_hash AS hash,attempt_id AS "attemptId" FROM treido.promotion_provider_events WHERE platform_account=$1 AND livemode=$2 AND event_id=$3`,
      [intent.platformAccount, intent.livemode, fact.eventId],
    )
  ).rows[0];
  if (prior) {
    if (prior.hash !== fact.evidenceHash || prior.attemptId !== id)
      throw new SellerError("CONFLICT");
    return;
  }
  const latest = (
    await tx.client.query<{ at: Date }>(
      `SELECT authoritative_at AS at FROM treido.promotion_provider_events WHERE attempt_id=$1 ORDER BY authoritative_at DESC,event_id DESC LIMIT 1`,
      [id],
    )
  ).rows[0];
  const now = await databaseTime(tx);
  if (Date.parse(fact.authoritativeAt) > now.getTime() + 30000)
    throw new SellerError("INVALID_INPUT");
  await tx.client.query(
    `INSERT INTO treido.promotion_provider_events(platform_account,livemode,event_id,attempt_id,evidence_hash,authoritative_at,state) VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [
      intent.platformAccount,
      intent.livemode,
      fact.eventId,
      id,
      fact.evidenceHash,
      fact.authoritativeAt,
      fact.state,
    ],
  );
  // The signed trigger has second-resolution event time, while the trusted
  // bridge retrieves current payment/charge state. Never discard restrictive
  // evidence because another distinct event has an equal or later timestamp.
  // attempt() holds the seller/campaign/attempt locks; event identity handles
  // retries, and quarantine cannot be revived by a later paid observation.
  if (fact.state === "refunded" || fact.state === "disputed") {
    const current = await campaign(tx, row.sellerId, row.campaignId);
    if (!current) throw new SellerError("NOT_FOUND");
    await tx.client.query(
      `UPDATE treido.promotion_attempts SET state='quarantined',provider_id=$2,checkout_session_id=$3,checkout_url=NULL,updated_at=clock_timestamp() WHERE id=$1`,
      [id, fact.providerId, fact.checkoutSessionId],
    );
    if (fact.state === "refunded")
      await tx.client.query(
        `UPDATE treido.promotion_reservations SET status='released' WHERE campaign_id=$1`,
        [row.campaignId],
      );
    await transition(
      tx,
      row,
      fact.state === "refunded"
        ? "cancelled"
        : current.state === "cancelled" || current.state === "completed"
          ? current.state
          : "paused",
      "payment_failed",
      "provider",
      fact.state === "refunded"
        ? "authoritative promotion payment reversal"
        : "authoritative promotion dispute; delivery quarantined",
    );
    return;
  }
  if (row.state === "cancelled" && fact.state === "paid") {
    await tx.client.query(
      `UPDATE treido.promotion_attempts SET state='quarantined',provider_id=$2,checkout_session_id=$3,checkout_url=NULL,updated_at=clock_timestamp() WHERE id=$1`,
      [id, fact.providerId, fact.checkoutSessionId],
    );
    await remedy(
      tx,
      row.campaignId,
      intent.totalMinor,
      null,
      null,
      now.getTime(),
    );
    await transition(
      tx,
      row,
      "cancelled",
      "platform_failure",
      "provider",
      "late verified payment after terminal cancellation; full remedy review, no delivery revival",
    );
    return;
  }
  // Stale non-restrictive observations cannot change delivery. Distinct
  // events in the same second remain eligible for the monotonic guards below.
  if (latest && Date.parse(fact.authoritativeAt) < latest.at.getTime()) return;
  if (["paid", "cancelled", "quarantined"].includes(row.state)) return;
  const c = await campaign(tx, row.sellerId, row.campaignId);
  if (!c) throw new SellerError("NOT_FOUND");
  if (fact.state === "pending") {
    await tx.client.query(
      `UPDATE treido.promotion_attempts SET provider_id=$2,checkout_session_id=$3,state='pending',updated_at=clock_timestamp() WHERE id=$1`,
      [id, fact.providerId, fact.checkoutSessionId],
    );
    return;
  }
  if (fact.state === "cancelled" || fact.state === "failed") {
    await tx.client.query(
      `UPDATE treido.promotion_attempts SET provider_id=$2,checkout_session_id=$3,state='cancelled',updated_at=clock_timestamp() WHERE id=$1`,
      [id, fact.providerId, fact.checkoutSessionId],
    );
    await tx.client.query(
      `UPDATE treido.promotion_reservations SET status='released' WHERE campaign_id=$1`,
      [c.id],
    );
    await transition(
      tx,
      row,
      "cancelled",
      "payment_failed",
      "provider",
      "authoritative payment stopped",
    );
    return;
  }
  await tx.client.query(
    `UPDATE treido.promotion_attempts SET provider_id=$2,checkout_session_id=$3,state='paid',checkout_url=NULL,updated_at=clock_timestamp() WHERE id=$1`,
    [id, fact.providerId, fact.checkoutSessionId],
  );
  await lockPublication(tx, row.sellerId, c.listingId);
  const listing = await currentEligible(tx, row.sellerId, c.listingId);
  const seller = (
    await tx.client.query<{ kind: string; status: string }>(
      `SELECT kind,status FROM treido.seller_accounts WHERE id=$1`,
      [row.sellerId],
    )
  ).rows[0];
  const policy = listing
    ? await approvedProduct(
        tx,
        c.productId,
        { ...listing, kind: seller.kind },
        bridge,
      )
    : null;
  const accepted = (
    await tx.client.query<{
      listingRevision: number;
      policyId: string;
      categoryId: string;
      country: string;
    }>(
      `SELECT pr.listing_revision AS "listingRevision",pr.product_policy_id AS "policyId",pr.category_id AS "categoryId",pr.country FROM treido.promotion_purchases pu JOIN treido.promotion_reviews pr ON pr.id=pu.review_id WHERE pu.attempt_id=$1`,
      [id],
    )
  ).rows[0];
  const reservation = (
    await tx.client.query<{
      capacityId: string;
      status: string;
      expiresAt: Date;
    }>(
      `SELECT capacity_id AS "capacityId",status,expires_at AS "expiresAt" FROM treido.promotion_reservations WHERE campaign_id=$1`,
      [c.id],
    )
  ).rows[0];
  if (
    !policy ||
    !(await approvedPromotionPayment(tx, policy.id, row.sellerId, bridge)) ||
    !listing ||
    !accepted ||
    accepted.listingRevision !== listing.revision ||
    accepted.policyId !== policy.id ||
    accepted.categoryId !== listing.categoryId ||
    accepted.country !== listing.country ||
    !reservation ||
    reservation.capacityId !== policy.capacityId ||
    reservation.status !== "reserved" ||
    c.reason === "seller_choice" ||
    ["completed", "cancelled"].includes(c.state)
  ) {
    const reason: StopReason =
      c.reason === "seller_choice"
        ? "seller_choice"
        : seller.status !== "active"
          ? "seller_restricted"
          : !listing
            ? await listingStopReason(tx, row.sellerId, c.listingId)
            : accepted?.listingRevision !== listing.revision
              ? "listing_unavailable"
              : "platform_failure";
    await transition(
      tx,
      row,
      ["completed", "cancelled"].includes(c.state) ? c.state : "paused",
      reason,
      "provider",
      "paid delivery awaits current eligible capacity",
    );
    if (reason === "platform_failure")
      await remedy(
        tx,
        row.campaignId,
        intent.totalMinor,
        null,
        null,
        now.getTime(),
      );
    return;
  }
  const cap = await capacity(tx, reservation.capacityId, true);
  if (cap.reserved > cap.slots) {
    await transition(
      tx,
      row,
      "paused",
      "platform_failure",
      "provider",
      "approved serving capacity unavailable",
    );
    await remedy(tx, c.id, intent.totalMinor, null, null, now.getTime());
    return;
  }
  const terms = (
    await tx.client.query<{ terms: Terms }>(
      `SELECT terms FROM treido.promotion_purchases WHERE campaign_id=$1`,
      [c.id],
    )
  ).rows[0].terms;
  const end = new Date(now.getTime() + terms.durationSeconds * 1000);
  await tx.client.query(
    `INSERT INTO treido.promotion_intervals(campaign_id,starts_at,ends_at) VALUES($1,$2,$3)`,
    [c.id, now, end],
  );
  if (terms.productId === "bump_once_v1") {
    await tx.client.query(
      `INSERT INTO treido.promotion_bump_signals(campaign_id,seller_id,listing_id,publication_revision,promoted_at) VALUES($1,$2,$3,$4,$5)`,
      [c.id, row.sellerId, c.listingId, listing.revision, now],
    );
    await tx.client.query(
      `UPDATE treido.promotion_reservations SET status='released' WHERE campaign_id=$1`,
      [c.id],
    );
    await transition(
      tx,
      row,
      "completed",
      null,
      "bump",
      "one eligible promoted-freshness signal committed; original publication unchanged",
    );
  } else {
    await tx.client.query(
      `UPDATE treido.promotion_reservations SET status='serving' WHERE campaign_id=$1`,
      [c.id],
    );
    await transition(
      tx,
      row,
      "active",
      null,
      "start",
      "confirmed eligible serving interval",
    );
  }
}
async function remedy(
  tx: SellerTransaction,
  id: string,
  total: number,
  start: number | null,
  end: number | null,
  now: number,
) {
  const proposed = deliveryRemedy("platform_failure", start, end, now, total);
  if (proposed)
    await tx.client.query(
      `INSERT INTO treido.promotion_remedy_reviews(campaign_id,kind,maximum_minor,reason) VALUES($1,$2,$3,'platform_failure') ON CONFLICT DO NOTHING`,
      [id, proposed.kind, proposed.maximumMinor],
    );
}
function validObservationProvider(
  fact: Awaited<ReturnType<PromotionPaymentBridge["observe"]>>,
) {
  return fact.providerId === null
    ? fact.state === "cancelled"
    : typeof fact.providerId === "string" &&
        fact.providerId.length <= 255 &&
        /^pi_[A-Za-z0-9]+$/.test(fact.providerId);
}
/** Durable local proof of no provider POST; no fabricated signed event or financial success. Caller holds the seller lock. */
export async function cancelUnattemptedPromotion(
  tx: SellerTransaction,
  id: string,
  bridge: PromotionPaymentBridge,
) {
  const row = await attempt(tx, id),
    now = await databaseTime(tx);
  if (!sameBinding(row.intent, bridge)) throw new SellerError("FORBIDDEN");
  if (
    !["prepared", "creating", "reconciling"].includes(row.state) ||
    row.providerId !== null ||
    row.checkoutSessionId !== null ||
    !Number.isFinite(Date.parse(row.intent.checkoutExpiresAt)) ||
    Date.parse(row.intent.checkoutExpiresAt) > now.getTime()
  )
    return false;
  const receipt = (
    await tx.client.query<{
      firstAttemptAt: Date | null;
      sessionId: string | null;
    }>(
      `SELECT first_attempt_at AS "firstAttemptAt",checkout_session_id AS "sessionId" FROM treido.promotion_checkout_intents WHERE attempt_id=$1 FOR UPDATE`,
      [id],
    )
  ).rows[0];
  if (receipt?.firstAttemptAt || receipt?.sessionId) return false;
  // The only POST path first durably sets first_attempt_at. Missing/null proves it never ran.
  await tx.client.query(
    `UPDATE treido.promotion_attempts SET state='cancelled',checkout_url=NULL,updated_at=clock_timestamp() WHERE id=$1`,
    [id],
  );
  await tx.client.query(
    `UPDATE treido.promotion_reservations SET status='released' WHERE campaign_id=$1`,
    [row.campaignId],
  );
  await transition(
    tx,
    row,
    "cancelled",
    "expired",
    "expire",
    "original Checkout deadline passed; durable no-POST proof",
  );
  return true;
}
/** Existing restricted moderation authority only, reason + immutable audit. No paid-success/refund override. */
export async function operatorPausePromotion(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  id: string,
  reason: string,
) {
  if (
    !UUID(id) ||
    typeof reason !== "string" ||
    !reason.trim() ||
    reason.length > 300 ||
    hasForbiddenControls(reason) ||
    !hasVerifiedRecentAuthentication(identity)
  )
    throw new SellerError("FORBIDDEN");
  return inTransaction(database, async (tx) => {
    const user = await authorizeHuman(tx, identity, false);
    const grant = (
      await tx.client.query<{ allowed: boolean }>(
        `SELECT treido.lock_operator_grant($1,'moderation.write') AS allowed`,
        [user.id],
      )
    ).rows[0];
    if (!grant?.allowed) throw new SellerError("FORBIDDEN");
    const row = (
      await tx.client.query<{ sellerId: string }>(
        `SELECT seller_id AS "sellerId" FROM treido.promotion_campaigns WHERE id=$1`,
        [id],
      )
    ).rows[0];
    if (!row) throw new SellerError("NOT_FOUND");
    await tx.client.query(
      `SELECT id FROM treido.seller_accounts WHERE id=$1 FOR UPDATE`,
      [row.sellerId],
    );
    const c = await campaign(tx, row.sellerId, id, true);
    if (!c || ["completed", "cancelled", "draft"].includes(c.state))
      throw new SellerError("CONFLICT");
    const updated = (
      await tx.client.query<{ revision: number }>(
        `UPDATE treido.promotion_campaigns SET state='paused',reason='operator_safety',revision=revision+1,updated_at=clock_timestamp() WHERE id=$1 RETURNING revision`,
        [id],
      )
    ).rows[0];
    await tx.client.query(
      `INSERT INTO treido.promotion_events(id,campaign_id,actor_id,source,action,reason,state,revision) VALUES($1,$2,$3,'operator','pause',$4,'paused',$5)`,
      [randomUUID(), id, user.id, reason.trim(), updated.revision],
    );
    return updated;
  });
}
