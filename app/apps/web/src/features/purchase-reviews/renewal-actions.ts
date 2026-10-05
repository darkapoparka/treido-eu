"use server";
import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { SellerError, type SellerResult } from "../sellers/errors";
import { libraryActorKey } from "../library/cursor.server";
import {
  readReviewRenewalContext,
  renewPurchaseReview,
} from "./renewal.server";
import type { ReviewRenewalContext } from "./renewal-model";
function failure(error: unknown) {
  if (!(error instanceof SellerError))
    console.error("Treido review renewal unavailable.");
  return {
    ok: false,
    code: error instanceof SellerError ? error.code : "NOT_AVAILABLE",
  } as const;
}
export async function readReviewRenewalAction(
  reviewId: string,
  actorKey: string,
  handover: "pickup" | "shipping",
): Promise<SellerResult<ReviewRenewalContext>> {
  try {
    const identity = await requireVerifiedIdentity();
    if (actorKey !== libraryActorKey(identity))
      throw new SellerError("FORBIDDEN");
    return {
      ok: true,
      data: await readReviewRenewalContext(
        getDatabase(),
        identity,
        reviewId,
        handover,
      ),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function renewPurchaseReviewAction(
  input: unknown,
): Promise<SellerResult<{ id: string }>> {
  try {
    return {
      ok: true,
      data: await renewPurchaseReview(
        getDatabase(),
        await requireVerifiedIdentity(),
        input,
      ),
    };
  } catch (error) {
    return failure(error);
  }
}
