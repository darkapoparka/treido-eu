"use server";
import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { libraryActorKey } from "../library/cursor.server";
import { SellerError, type SellerResult } from "../sellers/errors";
import { object } from "../purchase-reviews/model";
import { validId } from "../selling/draft-model";
import {
  readDecisionUpdates,
  type DecisionUpdates,
} from "./decision-updates.server";
export async function readDecisionUpdatesAction(
  raw: unknown,
): Promise<SellerResult<DecisionUpdates>> {
  try {
    const actor = await requireVerifiedIdentity();
    if (
      !object(raw) ||
      Object.keys(raw).some((k) => !["actorKey", "sellerId"].includes(k)) ||
      (raw.sellerId !== null && !validId(raw.sellerId))
    )
      throw new SellerError("INVALID_INPUT");
    if (raw.actorKey !== libraryActorKey(actor))
      throw new SellerError("FORBIDDEN");
    return {
      ok: true,
      data: await readDecisionUpdates(
        getDatabase(),
        actor,
        raw.sellerId as string | null,
      ),
    };
  } catch (error) {
    if (!(error instanceof SellerError))
      console.error("Treido decision updates unavailable.");
    return {
      ok: false,
      code: error instanceof SellerError ? error.code : "NOT_AVAILABLE",
    };
  }
}
