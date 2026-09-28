"use client";
/* eslint-disable @next/next/no-img-element -- Existing catalog artwork only. */
import Link from "next/link";
import { SourceLink } from "./return-navigation";
import { useRef } from "react";
import type { Catalog } from "../catalog/types";
import { IconButton, ProductCard } from "./components";
import { KitschWordmark } from "./kitsch-wordmark";
import { useDiscovery } from "./state";
import { recentStoreCover } from "./recent-store-media";
import styles from "./search-entry.module.css";
import photoStyles from "./search-photo.module.css";

export function RecentSearchItems({
  catalog,
  expanded = false,
  limit,
  capturedContinuation,
  surface = "search",
}: {
  catalog: Catalog;
  expanded?: boolean;
  limit?: number;
  capturedContinuation?: "photo" | null;
  surface?: "search" | "home";
}) {
  const state = useDiscovery();
  const grid = useRef<HTMLDivElement>(null);
  const items = state.viewedItems.flatMap((item) => {
    const product =
      item.kind === "product"
        ? catalog.products.find((value) => value.id === item.id)
        : undefined;
    const store =
      item.kind === "store"
        ? catalog.stores.find((value) => value.id === item.id)
        : undefined;
    // A stale history ID is not an empty card or a "Remove undefined" control.
    return product || store ? [{ item, product, store }] : [];
  });
  if (!items.length)
    return (
      <div ref={grid} className={styles.empty} role="status">
        <p>No recently viewed items</p>
        <Link href="/">Browse products</Link>
      </div>
    );
  return (
    <div
      ref={grid}
      className={
        expanded
          ? `product-grid recent-history-grid ${styles.history}`
          : `product-rail ${styles.recent}`
      }
    >
      {items.slice(0, limit).map(({ item, product, store }) => (
        <div
          key={`${item.kind}:${item.id}`}
          className={styles.item}
          data-recent-kind={item.kind}
          data-recent-id={item.id}
        >
          {product ? (
            <ProductCard
              product={{
                ...product,
                promotion: item.promotion,
                images:
                  product.id === "terracotta"
                    ? ["/api/reference-media/recent-terracotta-photo"]
                    : product.images,
              }}
              compact
            />
          ) : store ? (
            <SourceLink
              className={`${styles.store} ${recentStoreCover(store.id, surface) ? styles.capturedStore : ""} ${store.id === "loaded-tea" ? styles.logoStore : ""} ${store.id === "drmtlgy" && surface !== "home" ? styles.partialStore : ""}`}
              data-recent-store={store.id}
              href={`/stores/${store.id}`}
              aria-label={`Visit ${store.name}`}
            >
              {(recentStoreCover(store.id, surface) ||
                store.coverImage ||
                store.logo) && (
                <img
                  src={
                    recentStoreCover(store.id, surface)
                      ? `/api/reference-media/${recentStoreCover(store.id, surface)}`
                      : store.coverImage || store.logo
                  }
                  alt=""
                />
              )}
              {(!recentStoreCover(store.id, surface) ||
                (store.id === "drmtlgy" && surface !== "home")) && (
                <span className={styles.wordmark} aria-hidden="true">
                  {store.id === "kitsch" ? <KitschWordmark /> : store.name}
                </span>
              )}
              {!expanded && item.promotion && (
                <span className="price-badge deal">{item.promotion}</span>
              )}
            </SourceLink>
          ) : null}
          {expanded && (
            <IconButton
              icon="close"
              label={`Remove ${product?.title ?? store?.name} from recently viewed`}
              className={styles.remove}
              onClick={() => {
                const visible = items.slice(0, limit);
                const index = visible.findIndex((entry) => entry.item === item);
                const remaining = visible.filter(
                  (entry) => entry.item !== item,
                );
                const next =
                  remaining[Math.min(index, remaining.length - 1)]?.item;
                state.removeViewed(item.kind, item.id);
                requestAnimationFrame(() => {
                  const selector = next
                    ? `[data-recent-kind="${CSS.escape(next.kind)}"][data-recent-id="${CSS.escape(next.id)}"] button[aria-label^="Remove "]`
                    : 'a[href="/"]';
                  grid.current
                    ?.querySelector<HTMLElement>(selector)
                    ?.focus({ preventScroll: true });
                });
              }}
            />
          )}
        </div>
      ))}
      {!expanded && capturedContinuation === "photo" && (
        <div
          className={`${styles.item} ${photoStyles.recentFragment}`}
          data-captured-search-continuation="photo"
          aria-hidden="true"
        >
          <span className={photoStyles.recentFragmentMedia}>
            <img
              src="/api/reference-media/search-photo-recent-fragment"
              alt=""
            />
          </span>
        </div>
      )}
    </div>
  );
}
