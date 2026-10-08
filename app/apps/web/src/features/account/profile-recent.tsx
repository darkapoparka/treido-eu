"use client";
import { useTranslations } from "next-intl";
/* eslint-disable @next/next/no-img-element -- Allowlisted local reference media. */
import Link from "next/link";
import type { Catalog } from "../catalog/types";
import { ProductCard } from "../discovery/components";
import { Icon } from "../discovery/icons";
import { KitschWordmark } from "../discovery/kitsch-wordmark";
import { findMini, miniHref } from "../discovery/mini-model";
import { useDiscovery } from "../discovery/state";
import { recentStoreCover } from "../discovery/recent-store-media";
import type { SearchCatalog } from "../catalog/search-catalog";
import { ListingSaveButton } from "../library/controls";

export function ProfileRecent({
  catalog,
  publicData = false,
}: {
  catalog: Catalog | SearchCatalog;
  publicData?: boolean;
}) {
  const t = useTranslations("account");
  const state = useDiscovery();
  const miniIds =
    !publicData && state.recentActivity === "minis" ? state.visitedMinis : [];
  // Recent Minis precede, rather than erase, the earlier product/store history.
  const items = state.viewedItems.filter(
    (item) =>
      !publicData ||
      (item.kind === "product"
        ? catalog.products.some((product) => product.id === item.id)
        : catalog.stores.some((store) => store.id === item.id)),
  );
  if (!miniIds.length && !items.length) return null;
  return (
    <>
      <h2 className="profile-recent-heading">
        <Link href="/search?view=recent">
          {t("recentlyViewed")}{" "}
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
                  promotion: publicData
                    ? undefined
                    : (item.promotion ?? product.promotion),
                }}
                saveControl={
                  publicData ? (
                    <ListingSaveButton id={product.id} title={product.title} />
                  ) : undefined
                }
              />
            ) : null;
          }
          const store = catalog.stores.find((s) => s.id === item.id);
          if (!store) return null;
          const capturedCover = publicData
            ? null
            : recentStoreCover(store.id, "profile");
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
              aria-label={t("visitStore", { store: store.name })}
            >
              {image && <img src={image} alt="" />}
              {!capturedCover && (
                <span>
                  {!publicData && store.id === "kitsch" ? (
                    <KitschWordmark />
                  ) : (
                    store.name
                  )}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </>
  );
}
