"use server";
import { getDatabase, inTransaction } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman, authorizeSeller } from "../sellers/persistence.server";
import { SellerError, type SellerResult } from "../sellers/errors";
import { libraryActorKey } from "../library/cursor.server";
import { validId } from "../selling/draft-model";
import { object } from "./model";
import { cancelReservationBatch } from "./bulk.server";
import type { CancellationResult } from "./bulk-model";
export async function cancelReservationBatchAction(
  input: unknown,
): Promise<SellerResult<CancellationResult[]>> {
  try {
    const identity = await requireVerifiedIdentity();
    return {
      ok: true,
      data: await cancelReservationBatch(getDatabase(), identity, input),
    };
  } catch (error) {
    if (!(error instanceof SellerError))
      console.error("Treido reservation batch unavailable.");
    return {
      ok: false,
      code: error instanceof SellerError ? error.code : "NOT_AVAILABLE",
    };
  }
}
/** Read-only capability refresh. The row transaction still checks the participant,
 * seller and exact offer/allocation under locks, including on receipt replay. */
export async function readCancellationAccessAction(
  input: unknown,
): Promise<SellerResult<{ canManage: boolean }>> {
  try {
    if (
      !object(input) ||
      Object.keys(input).some(
        (key) => !["actorKey", "sellerId"].includes(key),
      ) ||
      (input.sellerId !== null && !validId(input.sellerId))
    )
      throw new SellerError("INVALID_INPUT");
    const identity = await requireVerifiedIdentity();
    if (input.actorKey !== libraryActorKey(identity))
      throw new SellerError("FORBIDDEN");
    const sellerId = input.sellerId as string | null;
    const data = await inTransaction(getDatabase(), async (tx) => {
      if (sellerId === null) {
        try {
          await authorizeHuman(tx, identity, false);
        } catch (error) {
          if (error instanceof SellerError && error.code === "NOT_FOUND")
            return { canManage: false };
          throw error;
        }
        return { canManage: true };
      }
      const access = await authorizeSeller(
        tx,
        identity,
        sellerId,
        "inbox.read",
      );
      await authorizeSeller(tx, identity, sellerId, "listing.read");
      return {
        canManage:
          access.context.capabilities.includes("inbox.reply") &&
          access.context.capabilities.includes("listing.publish") &&
          (access.seller.kind === "personal" ||
            access.context.capabilities.includes("inventory.manage")),
      };
    });
    return { ok: true, data };
  } catch (error) {
    if (!(error instanceof SellerError))
      console.error("Treido reservation access unavailable.");
    return {
      ok: false,
      code: error instanceof SellerError ? error.code : "NOT_AVAILABLE",
    };
  }
}
