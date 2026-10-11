"use server";
import { revalidatePath } from "next/cache";
import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { SellerError, type SellerResult } from "./errors";
import { parseBulkProductEdits, type BulkProductEditOutcome } from "./bulk-product-edit-model";
import { editBulkProducts, readBulkProductRows } from "./bulk-product-edit.server";

export async function readBulkProductsAction(sellerId: string, ids: string) {
  try { return { ok: true as const, data: await readBulkProductRows(getDatabase(), await requireVerifiedIdentity(), sellerId, ids) }; }
  catch (error) { return { ok: false as const, code: error instanceof SellerError ? error.code : "NOT_AVAILABLE" as const }; }
}
export async function editBulkProductsAction(input: unknown): Promise<SellerResult<BulkProductEditOutcome[]>> {
  try {
    const identity = await requireVerifiedIdentity();
    const command = parseBulkProductEdits(input);
    if (!command) throw new SellerError("INVALID_INPUT");
    const data = await editBulkProducts(getDatabase(), identity, command);
    const base = `/app/sellers/${command.sellerId}`;
    revalidatePath(`${base}/listings`); revalidatePath(`${base}/catalog`);
    for (const item of data) if (item.result.ok) {
      revalidatePath(`${base}/listings/${item.listingId}/edit`);
      revalidatePath(`${base}/listings/${item.listingId}/review`);
    }
    return { ok: true, data };
  } catch (error) { return { ok: false, code: error instanceof SellerError ? error.code : "NOT_AVAILABLE" }; }
}
