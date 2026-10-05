"use server";
import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { SellerError } from "../sellers/errors";
import type { PrivateResult } from "../library/private-session";
import { readBuyerCart, changeBuyerCart } from "./cart.server";
import type { BuyerCart } from "./model";
function failure(error: unknown, subject: string | null) {
  if (!(error instanceof SellerError))
    console.error("Treido cart unavailable.");
  return {
    ok: false,
    subject,
    code: error instanceof SellerError ? error.code : "NOT_AVAILABLE",
  } as const;
}
export async function readBuyerCartAction(): Promise<PrivateResult<BuyerCart>> {
  let subject: string | null = null;
  try {
    const identity = await requireVerifiedIdentity();
    subject = identity.subject;
    return {
      ok: true,
      subject,
      data: await readBuyerCart(getDatabase(), identity),
    };
  } catch (error) {
    return failure(error, subject);
  }
}
export async function changeBuyerCartAction(
  input: unknown,
  expectedSubject: string,
): Promise<PrivateResult<BuyerCart>> {
  let subject: string | null = null;
  try {
    const identity = await requireVerifiedIdentity();
    subject = identity.subject;
    if (subject !== expectedSubject) throw new SellerError("FORBIDDEN");
    const database = getDatabase();
    await changeBuyerCart(database, identity, input);
    return { ok: true, subject, data: await readBuyerCart(database, identity) };
  } catch (error) {
    return failure(error, subject);
  }
}
