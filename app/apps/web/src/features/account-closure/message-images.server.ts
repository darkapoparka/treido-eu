import "server-only";
import type { SellerTransaction } from "../../server/db/database";
import { ClosureError } from "./model";
import type { CleanupResource } from "./acceptance-resources.server";
import type { FrozenTarget } from "./storage.server";

export type MessageImageReview = {
  version: "message-image-lifecycle-v1";
  rule: {
    id: string;
    handling: "retain" | "remove";
    delay_seconds: number | null;
    description: { bg: string; en: string };
  };
  resources: (CleanupResource & { retentionReason: string | null })[];
};
/** The separate immutable registry binds the exact original policy and binding.
 * No existing personal-listing policy is interpreted as communication authority. */
export async function reviewMessageImages(
  tx: SellerTransaction,
  userId: string,
  policyId: string,
  bindingId: string,
): Promise<MessageImageReview | null> {
  const ready = (
    await tx.client.query<{ ready: boolean }>(
      "SELECT to_regprocedure('treido.account_message_image_review(uuid,uuid,uuid)') IS NOT NULL AS ready",
    )
  ).rows[0]?.ready;
  if (!ready) {
    // Historical local fixtures can lack 0048, but never claim linked image cleanup.
    const affected = await tx.client.query(
      "SELECT id FROM treido.message_attachments WHERE created_by=$1 LIMIT 1",
      [userId],
    );
    if (affected.rowCount) throw new ClosureError("POLICY_REQUIRED");
    return null;
  }
  try {
    return (
      await tx.client.query<{ review: MessageImageReview | null }>(
        "SELECT treido.account_message_image_review($1::uuid,$2::uuid,$3::uuid) AS review",
        [userId, policyId, bindingId],
      )
    ).rows[0].review;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "55000")
      throw new ClosureError("POLICY_REQUIRED");
    throw error;
  }
}
export function messageImageTargets(
  review: MessageImageReview | null,
): FrozenTarget[] {
  if (!review || review.rule.handling === "retain") return [];
  if (
    !Number.isSafeInteger(review.rule.delay_seconds) ||
    review.rule.delay_seconds! < 0
  )
    throw new ClosureError("POLICY_REQUIRED");
  return review.resources
    .filter((resource) => resource.retentionReason === null)
    .map((resource) => ({
      kind: "media.delete",
      target: resource.target,
      dueSeconds: review.rule.delay_seconds!,
    }));
}
