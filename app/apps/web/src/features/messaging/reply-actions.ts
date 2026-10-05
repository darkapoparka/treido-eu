"use server";
import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { SellerError } from "../sellers/errors";
import { sendRecoverableReply } from "./reply.server";
export async function sendRecoverableReplyAction(raw: unknown) {
  try {
    return {
      ok: true as const,
      data: await sendRecoverableReply(
        getDatabase(),
        await requireVerifiedIdentity(),
        raw,
      ),
    };
  } catch (error) {
    if (!(error instanceof SellerError))
      console.error("Treido conversation reply unavailable.");
    const code = error instanceof SellerError ? error.code : "NOT_AVAILABLE";
    return {
      ok: false as const,
      code,
      outcome: ["INVALID_INPUT", "CONFLICT", "QUOTA_EXCEEDED"].includes(code)
        ? ("rejected" as const)
        : ("unresolved" as const),
    };
  }
}
