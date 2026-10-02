import type { ProductCardData } from "./card-model";
import type { Catalog, Product, ProductVariant, Store } from "./types";

export type SearchProduct = ProductCardData &
  Pick<
    Product,
    | "storeId"
    | "category"
    | "color"
    | "gender"
    | "country"
    | "shippingDestinations"
    | "referenceNewnessRank"
  > & {
    readonly variants: readonly Pick<
      ProductVariant,
      "label" | "availableQuantity"
    >[];
  };
export type SearchStore = Pick<
  Store,
  | "id"
  | "name"
  | "logo"
  | "coverImage"
  | "rating"
  | "ratingCount"
  | "categories"
  | "referenceStyle"
>;
export type SearchCatalog = Readonly<{
  liveHomeStoreIds?: readonly string[];
  products: readonly SearchProduct[];
  stores: readonly SearchStore[];
}>;

/** Explicit allowlist, not a type assertion over the full catalog.
 * All reference rows remain searchable locally until real paginated search exists.
 * Detail bodies, galleries, payment selections and merchant policies stay server-side.
 */
export function toSearchCatalog(catalog: Catalog): SearchCatalog {
  return {
    liveHomeStoreIds: catalog.liveHomeStoreIds?.slice(),
    products: catalog.products.map(toSearchProduct),
    stores: catalog.stores.map(toSearchStore),
  };
}
function toSearchProduct(product: Product): SearchProduct {
  return {
    id: product.id,
    title: product.title,
    storeId: product.storeId,
    category: product.category,
    color: product.color,
    gender: product.gender,
    country: product.country,
    shippingDestinations: product.shippingDestinations?.slice(),
    referenceNewnessRank: product.referenceNewnessRank,
    images: product.images.slice(0, 1),
    price: { amount: product.price.amount, currency: product.price.currency },
    compareAt: product.compareAt
      ? {
          amount: product.compareAt.amount,
          currency: product.compareAt.currency,
        }
      : undefined,
    rating: product.rating,
    ratingCount: product.ratingCount,
    promotion: product.promotion,
    referenceStyle: product.referenceStyle,
    referenceImageTreatment: product.referenceImageTreatment,
    referenceThumbnails: product.referenceThumbnails
      ? {
          shelf: product.referenceThumbnails.shelf,
          grid: product.referenceThumbnails.grid,
        }
      : undefined,
    variants: product.variants.map(({ label, availableQuantity }) => ({
      label,
      availableQuantity,
    })),
  };
}
function toSearchStore(store: Store): SearchStore {
  return {
    id: store.id,
    name: store.name,
    logo: store.logo,
    coverImage: store.coverImage,
    rating: store.rating,
    ratingCount: store.ratingCount,
    categories: store.categories.slice(),
    referenceStyle: store.referenceStyle,
  };
}
