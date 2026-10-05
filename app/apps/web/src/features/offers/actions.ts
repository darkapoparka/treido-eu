"use server";
import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { SellerError, type SellerResult } from "../sellers/errors";
import { parseOfferCommand, type OfferView } from "./model";
import { readOffers, changeOffer } from "./offers.server";
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
    return {
      ok: true,
      data: await readOffers(
        getDatabase(),
        await requireVerifiedIdentity(),
        input,
      ),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function changeOfferAction(
  input: unknown,
): Promise<SellerResult<OfferView>> {
  try {
    const identity = await requireVerifiedIdentity(),
      command = parseOfferCommand(input),
      database = getDatabase();
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
