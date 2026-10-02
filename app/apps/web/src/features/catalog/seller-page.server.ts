import "server-only";
import { notFound } from "next/navigation";
import { readCatalog } from "./queries.server";

/** Seller presentation stays out of shared product/search catalog records. */
export async function readSellerPage(id: string) {
  const catalog = await readCatalog();
  const store = catalog.stores.find((seller) => seller.id === id);
  if (!store) notFound();
  if (!catalog.liveHomeStoreIds) return { store, catalog };
  const reference =
    process.env.NODE_ENV === "production"
      ? undefined
      : await import("./reference/merchant-catalog");
  if (!reference) notFound();
  const presented = reference
    .projectMerchantCatalog(catalog)
    .stores.find((seller) => seller.id === id);
  if (!presented) notFound();
  return { store: presented, catalog };
}
