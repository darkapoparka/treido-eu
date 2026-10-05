"use server";
import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { SellerError } from "../sellers/errors";
import { submitOrderFeedback, recoverOrderFeedback } from "./commands.server";
function failure(error: unknown) {
  return {
    ok: false,
    code: error instanceof SellerError ? error.code : "NOT_AVAILABLE",
  } as const;
}
export async function submitFeedbackAction(raw: unknown) {
  try {
    return {
      ok: true,
      data: await submitOrderFeedback(
        getDatabase(),
        await requireVerifiedIdentity(),
        raw,
      ),
    } as const;
  } catch (error) {
    return failure(error);
  }
}
export async function recoverFeedbackAction(raw: unknown) {
  try {
    return {
      ok: true,
      data: await recoverOrderFeedback(
        getDatabase(),
        await requireVerifiedIdentity(),
        raw,
      ),
    } as const;
  } catch (error) {
    return failure(error);
  }
}
