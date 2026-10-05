"use server";
import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { SellerError, type SellerResult } from "../sellers/errors";
import { readBuyerCart, changeBuyerCart } from "./cart.server";
import type { BuyerCart } from "./model";
function failure(error: unknown) {
  if (!(error instanceof SellerError))
    console.error("Treido cart unavailable.");
  return {
    ok: false,
    code: error instanceof SellerError ? error.code : "NOT_AVAILABLE",
  } as const;
}
export async function readBuyerCartAction(): Promise<SellerResult<BuyerCart>> {
  try {
    return {
      ok: true,
      data: await readBuyerCart(getDatabase(), await requireVerifiedIdentity()),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function changeBuyerCartAction(
  input: unknown,
): Promise<SellerResult<BuyerCart>> {
  try {
    const identity = await requireVerifiedIdentity(),
      database = getDatabase();
    await changeBuyerCart(database, identity, input);
    return { ok: true, data: await readBuyerCart(database, identity) };
  } catch (error) {
    return failure(error);
  }
}
