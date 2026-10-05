import "server-only";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { backendConfigured } from "../sellers/backend-status.server";
import { referencePreviewEnabled } from "../catalog/queries.server";
import { SellerError } from "../sellers/errors";
export async function assistantInputIdentity() {
  if (referencePreviewEnabled() || !backendConfigured())
    throw new SellerError("NOT_AVAILABLE");
  return requireVerifiedIdentity();
}
export function inputFailure(error: unknown) {
  if (!(error instanceof SellerError))
    console.error("Treido assistant input request unavailable.");
  return {
    ok: false as const,
    code:
      error instanceof SellerError ? error.code : ("NOT_AVAILABLE" as const),
  };
}
