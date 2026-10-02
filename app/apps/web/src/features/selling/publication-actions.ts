"use server";
import { revalidatePath } from "next/cache";
import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { SellerError, type SellerResult } from "../sellers/errors";
import { withdrawListing } from "./publication.server";
export async function withdrawListingAction(
  _previous: SellerResult<{ revision: number }> | null,
  form: FormData,
): Promise<SellerResult<{ revision: number }>> {
  try {
    const identity = await requireVerifiedIdentity();
    const data = await withdrawListing(getDatabase(), identity, {
      sellerId: form.get("sellerId"),
      listingId: form.get("listingId"),
      requestId: form.get("requestId"),
      expectedRevision: Number(form.get("expectedRevision")),
    });
    revalidatePath("/products/" + String(form.get("listingId")));
    revalidatePath("/app", "layout");
    return { ok: true, data };
  } catch (error) {
    if (!(error instanceof SellerError))
      console.error("Treido withdrawal unavailable.");
    return {
      ok: false,
      code: error instanceof SellerError ? error.code : "NOT_AVAILABLE",
    };
  }
}
