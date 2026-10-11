"use server";

import { revalidatePath } from "next/cache";
import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { SellerError, type SellerResult } from "./errors";
import { parseCatalogCommand, type CatalogAcknowledgement } from "./catalog-organization-model";
import { executeCatalogCommand } from "./catalog-organization-commands.server";
import { readCatalogCollection, readCatalogCollections, readCatalogProducts, readProductOrganization, type CatalogBrowse } from "./catalog-organization.server";

async function read<T>(operation: (identity: Awaited<ReturnType<typeof requireVerifiedIdentity>>) => Promise<T>): Promise<SellerResult<T>> {
  try {
    return { ok: true, data: await operation(await requireVerifiedIdentity()) };
  } catch (error) {
    return { ok: false, code: error instanceof SellerError ? error.code : "NOT_AVAILABLE" };
  }
}
export async function catalogCollectionsAction(sellerId: string, query: CatalogBrowse = {}) {
  return read((identity) => readCatalogCollections(getDatabase(), identity, sellerId, query));
}
export async function catalogCollectionAction(sellerId: string, collectionId: string) {
  return read((identity) => readCatalogCollection(getDatabase(), identity, sellerId, collectionId));
}
export async function catalogProductsAction(sellerId: string, query: CatalogBrowse = {}) {
  return read((identity) => readCatalogProducts(getDatabase(), identity, sellerId, query));
}
export async function productOrganizationAction(sellerId: string, listingId: string) {
  return read((identity) => readProductOrganization(getDatabase(), identity, sellerId, listingId));
}
export async function changeCatalogAction(input: unknown): Promise<SellerResult<CatalogAcknowledgement>> {
  return read(async (identity) => {
    const command = parseCatalogCommand(input);
    if (!command) throw new SellerError("INVALID_INPUT");
    const result = await executeCatalogCommand(getDatabase(), identity, command);
    const base = `/app/sellers/${command.sellerId}`;
    revalidatePath(`${base}/collections`);
    revalidatePath(`${base}/catalog`);
    revalidatePath(`${base}/listings`);
    revalidatePath(`${base}/settings/store/preview`);
    if (result.collectionId) revalidatePath(`${base}/collections/${result.collectionId}`);
    for (const listingId of result.listingIds ?? []) {
      revalidatePath(`${base}/listings/${listingId}/edit`);
      revalidatePath(`${base}/listings/${listingId}/review`);
    }
    return result;
  });
}
