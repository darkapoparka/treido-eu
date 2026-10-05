"use server";
import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { SellerError, type SellerResult } from "../sellers/errors";
import { libraryActorKey } from "../library/cursor.server";
import { changeOffer } from "../offers/offers.server";
import {
  createPurchaseReview,
  editPurchaseReview,
  sendPurchaseReview,
} from "./persistence.server";
import { object } from "./model";
function failure(error: unknown) {
  if (!(error instanceof SellerError))
    console.error("Treido purchase review unavailable.");
  return {
    ok: false,
    code: error instanceof SellerError ? error.code : "NOT_AVAILABLE",
  } as const;
}
export async function createPurchaseReviewAction(
  input: unknown,
): Promise<SellerResult<{ id: string }>> {
  try {
    return {
      ok: true,
      data: await createPurchaseReview(
        getDatabase(),
        await requireVerifiedIdentity(),
        input,
      ),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function editPurchaseReviewAction(
  input: unknown,
): Promise<SellerResult<{ revision: number }>> {
  try {
    return {
      ok: true,
      data: await editPurchaseReview(
        getDatabase(),
        await requireVerifiedIdentity(),
        input,
      ),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function sendPurchaseReviewAction(
  reviewId: string,
  actorKey: string,
): Promise<SellerResult<{ threadId: string }>> {
  try {
    return {
      ok: true,
      data: await sendPurchaseReview(
        getDatabase(),
        await requireVerifiedIdentity(),
        reviewId,
        actorKey,
      ),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function cancelReservationAction(
  input: unknown,
): Promise<SellerResult<{ revision: number; offerId: string }>> {
  try {
    const identity = await requireVerifiedIdentity();
    if (
      !object(input) ||
      Object.keys(input).some(
        (k) =>
          ![
            "actorKey",
            "sellerId",
            "threadId",
            "offerId",
            "expectedRevision",
            "requestId",
          ].includes(k),
      )
    )
      throw new SellerError("INVALID_INPUT");
    if (input.actorKey !== libraryActorKey(identity))
      throw new SellerError("FORBIDDEN");
    const { sellerId, threadId, offerId, expectedRevision, requestId } = input;
    return {
      ok: true,
      data: await changeOffer(getDatabase(), identity, {
        sellerId,
        threadId,
        expectedRevision,
        requestId,
        operation: { kind: "cancel", offerId },
      }),
    };
  } catch (error) {
    return failure(error);
  }
}
