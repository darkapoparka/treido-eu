"use server";
import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { libraryActorKey } from "../library/cursor.server";
import { SellerError, type SellerResult } from "../sellers/errors";
import type { OfferView } from "./model";
import { parseOfferMutation, type OfferRecoveryView } from "./recovery-model";
import { readOffers, changeOffer, recoverOfferRequest } from "./offers.server";
function failure(error: unknown) {
  if (!(error instanceof SellerError))
    console.error("Treido offers unavailable.");
  return {
    ok: false,
    code: error instanceof SellerError ? error.code : "NOT_AVAILABLE",
  } as const;
}
export async function readOffersAction(
  input: unknown,
): Promise<SellerResult<OfferView>> {
  try {
    const identity = await requireVerifiedIdentity();
    return { ok: true, data: await readOffers(getDatabase(), identity, input) };
  } catch (error) {
    return failure(error);
  }
}
export async function changeOfferAction(
  input: unknown,
): Promise<SellerResult<OfferView>> {
  try {
    const identity = await requireVerifiedIdentity(),
      mutation = parseOfferMutation(input);
    if (mutation.actorKey !== libraryActorKey(identity))
      throw new SellerError("FORBIDDEN");
    const database = getDatabase(),
      command = mutation.command;
    await changeOffer(database, identity, command);
    return {
      ok: true,
      data: await readOffers(database, identity, {
        threadId: command.threadId,
        sellerId: command.sellerId,
      }),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function recoverOfferAction(
  input: unknown,
): Promise<SellerResult<OfferRecoveryView>> {
  try {
    const identity = await requireVerifiedIdentity(),
      mutation = parseOfferMutation(input);
    if (mutation.actorKey !== libraryActorKey(identity))
      throw new SellerError("FORBIDDEN");
    return {
      ok: true,
      data: await recoverOfferRequest(getDatabase(), identity, mutation),
    };
  } catch (error) {
    return failure(error);
  }
}
