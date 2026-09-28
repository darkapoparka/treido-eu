import "server-only";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cookies, headers } from "next/headers";
import { setTimeout as delay } from "node:timers/promises";
import { referenceCatalogDelay } from "./reference/replay-delay";
import {
  referenceScenarioCookie,
  resolveReferenceScenario,
} from "./reference/scenarios";
import type { Catalog } from "./types";
export function referencePreviewEnabled() {
  return (
    process.env.SHOP_REFERENCE_PREVIEW === "1" &&
    process.env.VERCEL_ENV !== "production"
  );
}
export async function readCatalog(): Promise<Catalog> {
  await connection();
  // No automatic mock fallback: until Task 4, the isolated preview is opt-in.
  if (!referencePreviewEnabled()) notFound();
  const replayDelay = referenceCatalogDelay(
    await headers(),
    referencePreviewEnabled(),
  );
  if (replayDelay) await delay(replayDelay);
  const [
    { referenceCatalog },
    { followingProducts },
    { savedProducts, savedStores, savedListings },
    { storeProducts, storefrontProjection },
    { detailProducts, productDetailProjection },
    { solSavedListings },
    { searchSavedListings },
    { orderProducts, orderStores },
    { dealListings, dealStores },
  ] = await Promise.all([
    import("./reference/catalog"),
    import("./reference/following-fixtures"),
    import("./reference/saved-fixtures"),
    import("./reference/store-fixtures"),
    import("./reference/detail-fixtures"),
    import("./reference/sol-fixtures"),
    import("./reference/search-fixtures"),
    import("./reference/order-fixtures"),
    import("./reference/deal-fixtures"),
  ]);
  const scenarioName = (await cookies()).get(referenceScenarioCookie)?.value;
  const scenario = resolveReferenceScenario(scenarioName);
  const catalog: Catalog = {
    ...referenceCatalog,
    products: productDetailProjection(
      [
        ...referenceCatalog.products,
        ...followingProducts,
        ...savedProducts,
        ...storeProducts,
        ...detailProducts,
        ...orderProducts,
      ],
      scenario ? scenarioName : undefined,
    ),
    stores: storefrontProjection(
      [
        ...referenceCatalog.stores,
        ...savedStores,
        ...orderStores,
        ...dealStores,
      ],
      scenario ? scenarioName : undefined,
    ),
    savedListings: [
      ...savedListings,
      ...solSavedListings,
      ...searchSavedListings,
      ...dealListings,
    ],
  };
  // The frozen scenarios keep their exact catalog and ordering.
  if (!scenario) {
    const { liveShopStores, liveShopProducts, liveFollowingPosts } =
      await import("./reference/live-shop-fixtures");
    const { cozyStores, cozyProducts } =
      await import("./reference/live-cozy-fixtures");
    const { staudStore, staudProducts } =
      await import("./reference/live-staud-fixtures");
    const { liveShelfStores, liveShelfProducts } =
      await import("./reference/live-shelf-fixtures");
    const { livingRoomStores, livingRoomProducts } =
      await import("./reference/live-living-room-fixtures");
    const { liveLowerShelfStores, liveLowerShelfProducts } =
      await import("./reference/live-lower-shelf-fixtures");
    return {
      ...catalog,
      liveHomeStoreIds: liveShopStores.map((store) => store.id),
      liveFollowingPosts,
      stores: [
        ...catalog.stores,
        ...liveShopStores,
        ...cozyStores,
        staudStore,
        ...liveShelfStores,
        ...liveLowerShelfStores,
        ...livingRoomStores,
      ],
      products: [
        ...catalog.products,
        ...liveShopProducts,
        ...cozyProducts,
        ...staudProducts,
        ...liveShelfProducts,
        ...liveLowerShelfProducts,
        ...livingRoomProducts,
      ],
    };
  }
  const unavailable = new Set(scenario?.catalog?.unavailableVariants ?? []);
  if (!unavailable.size) return catalog;
  return {
    ...catalog,
    products: catalog.products.map((product) => ({
      ...product,
      variants: product.variants.map((variant) =>
        unavailable.has(variant.id)
          ? { ...variant, availableQuantity: 0 }
          : variant,
      ),
    })),
  };
}
