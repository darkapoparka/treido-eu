import type { CartCatalog } from "../commerce/cart-catalog";

export type ProductContextRequest = Readonly<{
  cartIds: readonly string[];
  coverIds: readonly string[];
}>;
export type ProductContext = Readonly<{
  cart: CartCatalog;
  covers: readonly Readonly<{ id: string; image?: string }>[];
  /** Missing reference IDs are resolved absences, not a reason to fetch forever. */
  resolvedCartIds: readonly string[];
  resolvedCoverIds: readonly string[];
}>;
export const PRODUCT_CONTEXT_BATCH_SIZE = 100;
export function validProductId(value: unknown): value is string {
  return (
    typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value)
  );
}
export function parseProductContextRequest(
  input: unknown,
): ProductContextRequest | undefined {
  if (
    !input ||
    typeof input !== "object" ||
    !("cartIds" in input) ||
    !("coverIds" in input)
  )
    return;
  const { cartIds, coverIds } = input;
  if (!Array.isArray(cartIds) || !Array.isArray(coverIds)) return;
  if (cartIds.length + coverIds.length > PRODUCT_CONTEXT_BATCH_SIZE) return;
  if (!cartIds.every(validProductId) || !coverIds.every(validProductId)) return;
  return { cartIds: [...new Set(cartIds)], coverIds: [...new Set(coverIds)] };
}

export type ProductDetailPageView = Readonly<{
  view: import("./product-detail-model").ProductDetailView;
  context: ProductContext;
}>;

export function mergeProductContext(
  current: ProductContext,
  next: ProductContext,
): ProductContext {
  const merge = <T extends { readonly id: string }>(
    left: readonly T[],
    right: readonly T[],
  ) => [
    ...new Map([...left, ...right].map((item) => [item.id, item])).values(),
  ];
  return {
    cart: {
      products: merge(current.cart.products, next.cart.products),
      stores: merge(current.cart.stores, next.cart.stores),
    },
    covers: merge(current.covers, next.covers),
    resolvedCartIds: [
      ...new Set([...current.resolvedCartIds, ...next.resolvedCartIds]),
    ],
    resolvedCoverIds: [
      ...new Set([...current.resolvedCoverIds, ...next.resolvedCoverIds]),
    ],
  };
}
