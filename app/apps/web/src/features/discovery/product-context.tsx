"use client";
import { useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDiscovery } from "./state";
import type { ProductDetailProduct } from "../catalog/product-detail-model";
import { toCartProduct } from "../commerce/cart-catalog";
import {
  mergeProductContext,
  validProductId,
  PRODUCT_CONTEXT_BATCH_SIZE,
  type ProductContext,
} from "../catalog/product-context-model";

/** Browser-persisted cart/collection IDs are resolved separately from public detail. */
export function useProductContext(
  product: ProductDetailProduct,
  initial: ProductContext,
) {
  const productId = product.id;
  const discovery = useDiscovery();
  const [loaded, setLoaded] = useState({ owner: initial, value: initial });
  const [failure, setFailure] = useState<{
    owner: ProductContext;
    key: string;
    attempt: number;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const stored = loaded.owner === initial ? loaded.value : initial;
  // Reuse already-resolved first images when a new collection contains a cart/detail item.
  const products = [
    ...new Map(
      [...stored.cart.products, toCartProduct(product)].map((item) => [
        item.id,
        item,
      ]),
    ).values(),
  ];
  const value: ProductContext = {
    ...stored,
    cart: { ...stored.cart, products },
    covers: [
      ...new Map(
        [
          ...products.map((product) => ({
            id: product.id,
            image: product.images[0],
          })),
          ...stored.covers,
        ].map((cover) => [cover.id, cover]),
      ).values(),
    ],
    resolvedCoverIds: [
      ...new Set([
        ...stored.resolvedCoverIds,
        ...products.map((product) => product.id),
      ]),
    ],
  };
  const cartIds = [
    ...new Set(
      [...discovery.cart, ...discovery.later].map((line) => line.productId),
    ),
  ].filter((id) => validProductId(id) && !value.resolvedCartIds.includes(id));
  const coverIds = [
    ...new Set(
      discovery.collections.flatMap((collection) =>
        collection.productIds.slice(0, 4),
      ),
    ),
  ].filter((id) => validProductId(id) && !value.resolvedCoverIds.includes(id));
  const key = JSON.stringify({ cartIds, coverIds });
  const hasFailure = failure?.owner === initial && failure.key === key;
  const failed = hasFailure && failure.attempt === attempt;
  const pending = (cartIds.length > 0 || coverIds.length > 0) && !failed;
  useEffect(() => {
    const missing: { cartIds: string[]; coverIds: string[] } = JSON.parse(key);
    const entries = [
      ...missing.cartIds.map((id) => ({ kind: "cart", id })),
      ...missing.coverIds.map((id) => ({ kind: "cover", id })),
    ];
    if (!entries.length) return;
    const controller = new AbortController();
    async function load() {
      let result = initial;
      for (
        let offset = 0;
        offset < entries.length;
        offset += PRODUCT_CONTEXT_BATCH_SIZE
      ) {
        const query = new URLSearchParams();
        for (const entry of entries.slice(
          offset,
          offset + PRODUCT_CONTEXT_BATCH_SIZE,
        ))
          query.append(entry.kind, entry.id);
        const response = await fetch(
          `/api/products/${encodeURIComponent(productId)}/context?${query}`,
          { signal: controller.signal, cache: "no-store" },
        );
        if (!response.ok) throw new Error("Product context unavailable");
        const context: ProductContext = await response.json();
        result = mergeProductContext(result, context);
      }
      if (!controller.signal.aborted)
        setLoaded((current) => ({
          owner: initial,
          value: mergeProductContext(
            current.owner === initial ? current.value : initial,
            result,
          ),
        }));
    }
    void load().catch(() => {
      if (!controller.signal.aborted)
        setFailure({ owner: initial, key, attempt });
    });
    return () => controller.abort();
  }, [initial, key, productId, attempt]);
  return {
    value,
    pending,
    error: Boolean(failed),
    retrying: hasFailure && !failed,
    retry: () => {
      setAttempt((current) => current + 1);
    },
  };
}
export function ProductContextStatus({
  context,
}: {
  context: ReturnType<typeof useProductContext>;
}) {
  const ui = useTranslations("discoveryUI");
  const feedback = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = feedback.current;
    const owner = node?.closest("dialog");
    return () => {
      if (!node?.contains(document.activeElement)) return;
      requestAnimationFrame(() => {
        if (owner?.open && !node.isConnected)
          owner
            .querySelector<HTMLElement>(
              'button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]',
            )
            ?.focus({ preventScroll: true });
      });
    };
  }, []);
  return (
    <div className="sheet-copy" ref={feedback}>
      <p role={context.error ? "alert" : "status"}>
        {context.error
          ? ui("unableToLoadTheseItemsPleaseRetry")
          : ui("loadingItems")}
      </p>
      {(context.error || context.retrying) && (
        <button
          className="primary"
          aria-disabled={context.pending}
          onClick={() => {
            if (!context.pending) context.retry();
          }}
        >
          {ui("retry")}
        </button>
      )}
    </div>
  );
}
