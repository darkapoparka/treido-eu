"use server";
import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { SellerError, type SellerResult } from "../sellers/errors";
import { moderateListing, appealModeration } from "./moderation.server";
import { createResourceReport } from "./reports.server";
function failure(error: unknown) {
  if (!(error instanceof SellerError))
    console.error("Treido review operation unavailable.");
  return {
    ok: false,
    code: error instanceof SellerError ? error.code : "NOT_AVAILABLE",
  } as const;
}
export async function moderateListingAction(
  _previous: SellerResult<{ id: string; revision: number }> | null,
  form: FormData,
): Promise<SellerResult<{ id: string; revision: number }>> {
  try {
    const actor = await requireVerifiedIdentity();
    const result = await moderateListing(getDatabase(), actor, {
      listingId: form.get("listingId"),
      reportId: form.get("reportId"),
      requestId: form.get("requestId"),
      expectedRevision: Number(form.get("expectedRevision")),
      state: form.get("state"),
      reason: form.get("reason"),
    });
    return { ok: true, data: result };
  } catch (error) {
    return failure(error);
  }
}
export async function reportResourceAction(
  input: Parameters<typeof createResourceReport>[2],
): Promise<SellerResult<{ id: string }>> {
  try {
    const actor = await requireVerifiedIdentity();
    return {
      ok: true,
      data: await createResourceReport(getDatabase(), actor, input),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function appealModerationAction(
  input: Parameters<typeof appealModeration>[2],
): Promise<SellerResult<{ id: string }>> {
  try {
    const actor = await requireVerifiedIdentity();
    return {
      ok: true,
      data: await appealModeration(getDatabase(), actor, input),
    };
  } catch (error) {
    return failure(error);
  }
}
