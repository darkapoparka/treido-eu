"use client";
/* eslint-disable @next/next/no-img-element -- Allowlisted local reference media. */
import Link from "next/link";
import type { Catalog } from "../catalog/types";
import { ProductCard } from "../discovery/components";
import { Icon } from "../discovery/icons";
import { KitschWordmark } from "../discovery/kitsch-wordmark";
import { findMini, miniHref } from "../discovery/mini-model";
import { useDiscovery } from "../discovery/state";
import { recentStoreCover } from "../discovery/recent-store-media";

export function ProfileRecent({ catalog }: { catalog: Catalog }) {
  const state = useDiscovery();
  const miniIds = state.recentActivity === "minis" ? state.visitedMinis : [];
  // Recent Minis precede, rather than erase, the earlier product/store history.
  const items = state.viewedItems;
  if (!miniIds.length && !items.length) return null;
  return (
    <>
      <h2 className="profile-recent-heading">
        <Link href="/search?view=recent">
          Recently viewed{" "}
          <span aria-hidden="true">
            <Icon name="back" />
          </span>
        </Link>
      </h2>
      <div className="profile-recent-rail">
        {miniIds.map((id) => {
          const mini = findMini(id);
          return mini ? (
            <Link
              className="profile-recent-mini"
              href={miniHref(id)}
              key={id}
              aria-label={mini.name}
            >
              <img src={`/api/reference-media/mini-${id}-icon`} alt="" />
            </Link>
          ) : null;
        })}
        {items.map((item) => {
          if (item.kind === "product") {
            const product = catalog.products.find((p) => p.id === item.id);
            return product ? (
              <ProductCard
                key={`product-${item.id}`}
                compact
                product={{
                  ...product,
                  promotion: item.promotion ?? product.promotion,
                }}
              />
            ) : null;
          }
          const store = catalog.stores.find((s) => s.id === item.id);
          if (!store) return null;
          const capturedCover = recentStoreCover(store.id, "profile");
          const image = capturedCover
            ? `/api/reference-media/${capturedCover}`
            : (store.coverImage ??
              catalog.products.find((p) => p.storeId === store.id)?.images[0]);
          return (
            <Link
              key={`store-${item.id}`}
              href={`/stores/${store.id}`}
              className="profile-recent-store"
              data-captured-cover={capturedCover || undefined}
              aria-label={`Visit ${store.name}`}
            >
              {image && <img src={image} alt="" />}
              {!capturedCover && (
                <span>
                  {store.id === "kitsch" ? <KitschWordmark /> : store.name}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </>
  );
}
