import type { Product, Store } from "../catalog/types";
import { projectMoney, projectVariant } from "../catalog/product-detail-model";

/** Display and local selection inputs only; never an authoritative checkout quote. */
export type CartProduct = Pick<
  Product,
  "id" | "title" | "storeId" | "images" | "price" | "compareAt" | "variants"
>;
export type CartSeller = Pick<
  Store,
  "id" | "name" | "logo" | "rating" | "ratingCount"
>;
export type CartCatalog = Readonly<{
  products: readonly CartProduct[];
  stores: readonly CartSeller[];
}>;
export function toCartProduct(product: CartProduct): CartProduct {
  return {
    id: product.id,
    title: product.title,
    storeId: product.storeId,
    images: product.images.slice(0, 1),
    price: projectMoney(product.price),
    compareAt: product.compareAt && projectMoney(product.compareAt),
    variants: product.variants.map((variant) => projectVariant(variant)),
  };
}
export function toCartSeller(store: CartSeller): CartSeller {
  return {
    id: store.id,
    name: store.name,
    logo: store.logo,
    rating: store.rating,
    ratingCount: store.ratingCount,
  };
}
