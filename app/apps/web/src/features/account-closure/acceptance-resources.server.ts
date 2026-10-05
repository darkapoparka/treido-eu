import "server-only";
import type { SellerTransaction } from "../../server/db/database";
import { ClosureError, type ClosurePolicy } from "./model";
import { removalDelay } from "./policy";
import type { FrozenTarget } from "./storage.server";

export type CleanupResource = {
  target: FrozenTarget["target"];
  [fact: string]: unknown;
};
export async function reviewedCleanupResources(
  tx: SellerTransaction,
  userId: string,
  policy: ClosurePolicy,
): Promise<CleanupResource[]> {
  return (
    await tx.client.query<{ resources: CleanupResource[] }>(
      `SELECT treido.account_closure_cleanup_resources($1::uuid,$2::boolean,$3::boolean) AS resources`,
      [
        userId,
        removalDelay(policy, "personalMedia") !== null,
        removalDelay(policy, "assistantMedia") !== null,
      ],
    )
  ).rows[0].resources;
}
export async function acceptReviewedClosure(
  tx: SellerTransaction,
  userId: string,
  planId: string,
  planHash: string,
  requestId: string,
) {
  try {
    await tx.client.query(
      `SELECT treido.account_accept_closure($1::uuid,$2::uuid,$3::text,$4::uuid)`,
      [userId, planId, planHash, requestId],
    );
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "23514" &&
      (error.message.startsWith("Changed closure cleanup resources") ||
        error.message.startsWith("Changed message image resources"))
    )
      throw new ClosureError("CONFLICT");
    throw error;
  }
}
