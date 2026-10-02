"use server";
import { revalidatePath } from "next/cache";
import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { SellerError, type SellerResult } from "../sellers/errors";
import { publishListing } from "./publish.server";
import type { PublishAcknowledgement } from "./publish-model";
export async function publishListingAction(
  input: unknown,
): Promise<SellerResult<PublishAcknowledgement>> {
  try {
    const identity = await requireVerifiedIdentity();
    const data = await publishListing(getDatabase(), identity, input);
    revalidatePath("/products/" + data.listingId);
    revalidatePath("/app", "layout");
    return { ok: true, data };
  } catch (error) {
    if (!(error instanceof SellerError))
      console.error("Treido publication unavailable.");
    return {
      ok: false,
      code: error instanceof SellerError ? error.code : "NOT_AVAILABLE",
    };
  }
}
