import "server-only";
import type { Catalog } from "../types";
import { resolveReferenceScenario } from "./scenarios";

/** Reference-only fixture assembly, never a backend error fallback. */
export async function readReferenceCatalog(
  scenarioName?: string,
): Promise<Catalog> {
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
    import("./catalog"),
    import("./following-fixtures"),
    import("./saved-fixtures"),
    import("./store-fixtures"),
    import("./detail-fixtures"),
    import("./sol-fixtures"),
    import("./search-fixtures"),
    import("./order-fixtures"),
    import("./deal-fixtures"),
  ]);
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
      await import("./live-shop-fixtures");
    const { cozyStores, cozyProducts } = await import("./live-cozy-fixtures");
    const { staudStore, staudProducts } = await import("./live-staud-fixtures");
    const { liveShelfStores, liveShelfProducts } =
      await import("./live-shelf-fixtures");
    const { livingRoomStores, livingRoomProducts } =
      await import("./live-living-room-fixtures");
    const { liveLowerShelfStores, liveLowerShelfProducts } =
      await import("./live-lower-shelf-fixtures");
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
