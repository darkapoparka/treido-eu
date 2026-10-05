import "server-only";
import { requireBackendBindings } from "../../server/config/backend-bindings.server";
import { requireJobBindings } from "../../server/jobs/config.server";
import {
  publishedJoins,
  publishedEligibility,
} from "../catalog/publication-eligibility.server";
import type { PoolClient } from "pg";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { libraryActorKey } from "../library/cursor.server";
import { validId } from "../selling/draft-model";
import { SellerError } from "../sellers/errors";
import {
  orderContext,
  aftercareStorageAvailable,
} from "../order-aftercare/storage.server";
import {
  feedbackStorageAvailable,
  readFeedbackPolicy,
  feedbackEligible,
} from "./storage.server";
import type {
  FeedbackView,
  FeedbackOwnExport,
  PublicPurchaseFeedback,
} from "./view";
export async function readOrderFeedback(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  orderId: string,
  language: "bg" | "en" = "bg",
): Promise<FeedbackView> {
  if (language !== "bg" && language !== "en")
    throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    const order = await orderContext(tx, identity, {
      actorKey: libraryActorKey(identity),
      orderId,
      sellerId: null,
    });
    const view: FeedbackView = {
      actorKey: libraryActorKey(identity),
      actorSubject: identity.subject,
      orderId,
      sellerName: order.sellerName,
      orderRevision: order.orderRevision,
      available: false,
      eligible: false,
      eligibility: "policy_unavailable",
      policy: null,
      feedback: null,
      language,
    };
    if (
      !(await feedbackStorageAvailable(tx.client)) ||
      !(await aftercareStorageAvailable(tx))
    )
      return view;
    const row = (
      await tx.client.query<{
        id: string;
        rating: number;
        body: string;
        state: "pending" | "published" | "hidden";
        revision: number;
        createdAt: Date;
        reason: string | null;
        policyId: string;
      }>(
        'SELECT id,rating,body,state,revision,created_at AS "createdAt",reason,policy_id AS "policyId" FROM treido.order_purchase_feedback WHERE order_id=$1 AND buyer_id=$2',
        [orderId, order.buyerId],
      )
    ).rows[0];
    if (row) {
      const { policyId, ...own } = row;
      view.feedback = { ...own, createdAt: row.createdAt.toISOString() };
      const p = await readFeedbackPolicy(tx, order, policyId);
      if (p)
        view.policy = {
          id: p.id,
          version: p.version,
          termsHash: p.termsHash,
          terms: p.terms[language],
          retentionDescription: p.retentionDescription[language],
        };
    } else {
      const p = await readFeedbackPolicy(tx, order);
      if (p)
        view.policy = {
          id: p.id,
          version: p.version,
          termsHash: p.termsHash,
          terms: p.terms[language],
          retentionDescription: p.retentionDescription[language],
        };
    }
    view.available = Boolean(view.policy);
    view.eligible =
      view.available && !row && (await feedbackEligible(tx.client, orderId));
    view.eligibility = view.policy
      ? view.eligible
        ? "eligible"
        : "incomplete"
      : "policy_unavailable";
    return view;
  });
}
export async function readPublicOrderFeedback(
  database: SellerDatabase,
  sellerId: string,
  page = 0,
): Promise<{
  available: boolean;
  feedback: PublicPurchaseFeedback[];
  more: boolean;
}> {
  if (!validId(sellerId) || !Number.isSafeInteger(page) || page < 0 || page > 9)
    throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    if (
      !(await feedbackStorageAvailable(tx.client)) ||
      !(await aftercareStorageAvailable(tx))
    )
      return { available: false, feedback: [], more: false };
    const namespace = {
      environment: requireBackendBindings().environment,
      applicationId: requireJobBindings().applicationId,
    };
    const publicSeller = await tx.client.query(
      "SELECT s.id " +
        publishedJoins +
        " WHERE " +
        publishedEligibility +
        " AND s.id=$1 LIMIT 1",
      [sellerId],
    );
    if (publicSeller.rowCount !== 1)
      return { available: true, feedback: [], more: false };
    const rows = (
      await tx.client.query<{
        id: string;
        rating: number;
        body: string;
        publishedAt: Date;
        orderId: string;
      }>(
        'SELECT f.id,f.rating,f.body,f.published_at AS "publishedAt",f.order_id AS "orderId" FROM treido.order_purchase_feedback f JOIN treido.order_feedback_policies p ON p.id=f.policy_id JOIN treido.paid_orders o ON o.id=f.order_id AND o.buyer_id=f.buyer_id AND o.seller_id=f.seller_id JOIN treido.payable_quotes q ON q.id=o.quote_id AND q.policy_id=p.base_policy_id WHERE f.seller_id=$1 AND f.state=$2 AND p.approved_at<=clock_timestamp() AND p.revoked_at IS NULL AND p.platform_account=q.platform_account AND p.livemode=q.livemode AND p.environment=$4 AND p.application_id=$5 AND EXISTS(SELECT 1 FROM treido.payment_policies b WHERE b.id=p.base_policy_id AND b.environment=p.environment AND b.application_id=p.application_id AND b.platform_account=p.platform_account AND b.livemode=p.livemode AND b.approved_at<=clock_timestamp() AND b.revoked_at IS NULL) AND treido.order_feedback_eligible(f.order_id)' +
          " AND EXISTS(SELECT 1 " +
          publishedJoins +
          " WHERE " +
          publishedEligibility +
          " AND s.id=f.seller_id)" +
          " ORDER BY f.published_at DESC,f.id DESC LIMIT 21 OFFSET $3",
        [
          sellerId,
          "published",
          page * 20,
          namespace.environment,
          namespace.applicationId,
        ],
      )
    ).rows;
    const output: PublicPurchaseFeedback[] = [];
    for (const row of rows.slice(0, 20)) {
      output.push({
        id: row.id,
        rating: row.rating,
        body: row.body,
        publishedAt: row.publishedAt.toISOString(),
        verification: "completed_order",
        reviewer: "anonymous_buyer",
      });
    }
    return { available: true, feedback: output, more: rows.length > 20 };
  });
}
export async function readFeedbackOwnExport(
  client: Pick<PoolClient, "query">,
  userId: string,
): Promise<FeedbackOwnExport> {
  if (!validId(userId)) throw new SellerError("INVALID_INPUT");
  if (!(await feedbackStorageAvailable(client)))
    throw new SellerError("NOT_AVAILABLE");
  const feedback = (
    await client.query<{
      id: string;
      orderId: string;
      rating: number;
      state: string;
      revision: number;
      createdAt: Date;
    }>(
      'SELECT id,order_id AS "orderId",rating,state,revision,created_at AS "createdAt" FROM treido.order_purchase_feedback WHERE buyer_id=$1 ORDER BY created_at DESC,id DESC LIMIT 51',
      [userId],
    )
  ).rows;
  const receipts = (
    await client.query<{
      requestId: string;
      feedbackId: string;
      acceptedRevision: number;
      createdAt: Date;
    }>(
      'SELECT request_id AS "requestId",feedback_id AS "feedbackId",accepted_revision AS "acceptedRevision",created_at AS "createdAt" FROM treido.order_feedback_receipts WHERE actor_id=$1 AND action=$2 ORDER BY created_at DESC,request_id DESC LIMIT 51',
      [userId, "submit"],
    )
  ).rows;
  return {
    feedback: feedback
      .slice(0, 50)
      .map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
    receipts: receipts
      .slice(0, 50)
      .map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
    more: feedback.length > 50 || receipts.length > 50,
  };
}
