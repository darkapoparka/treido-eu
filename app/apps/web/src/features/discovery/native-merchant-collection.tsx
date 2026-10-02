"use client";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Catalog, Store } from "../catalog/types";
import { merchantProducts } from "../catalog/reference/merchant-catalog-model";
import { merchantPresentation } from "../catalog/seller-presentation";
import { MerchantShell, MerchantPhoto } from "./native-merchant-chrome";
import { SourceLink } from "./return-navigation";
import {
  FloatingNav,
  IconButton,
  Sheet,
  ProductCard,
  commitSheetQuery,
} from "./components";
import { SourceShareFields } from "./source-share-fields";
import { NativeIcon } from "./native-icons";
import { StoreGrid } from "./store-grid";
import { openStoreFilter } from "./store-filter";
import { readStoreFilters } from "./store-model";

export function NativeStoreCollection({
  store,
  catalog,
  slug,
}: {
  store: Store;
  catalog: Catalog;
  slug: string;
}) {
  const ui = useTranslations("discoveryUI");
  const p = merchantPresentation(store);
  const collection = [
    ...(p.categories ?? []),
    ...(p.collections ?? []),
    ...(p.featureCollections ?? []),
  ].find((c) => c.slug === slug);
  const byId = new Map(
    catalog.products.map((product) => [product.id, product]),
  );
  const ownProducts = merchantProducts(store, catalog);
  const ownIds = new Set(ownProducts.map((product) => product.id));
  const products =
    slug === "shop-all"
      ? ownProducts
      : (collection?.productIds ?? []).flatMap((id) => {
          const product = byId.get(id);
          if (!product || !ownIds.has(id)) return [];
          const listing = collection?.listings?.find(
            (item) => item.productId === id,
          );
          if (!listing) return [product];
          return [
            {
              ...product,
              price: listing.price ?? product.price,
              compareAt:
                listing.compareAt === undefined
                  ? product.compareAt
                  : (listing.compareAt ?? undefined),
              rating: listing.rating ?? product.rating,
              ratingCount: listing.ratingCount ?? product.ratingCount,
              ...(listing.image
                ? {
                    images: [listing.image],
                    referenceThumbnails: {
                      shelf: listing.image,
                      grid: listing.image,
                    },
                    referenceImageTreatment: undefined,
                  }
                : {}),
            },
          ];
        });
  const params = useSearchParams();
  const initialStock = collection?.defaultInStockOnly ?? false;
  const filters = readStoreFilters(params, initialStock);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [status, setStatus] = useState("");
  const title = collection?.title ?? store.name;
  return (
    <MerchantShell
      store={store}
      kind="collection"
      catalogLayout={collection?.listings ? "native-listings" : undefined}
    >
      <header
        className="native-merchant-collection-hero"
        data-has-photo={!!collection?.image}
      >
        {collection?.image && (
          <MerchantPhoto
            className="native-merchant-collection-cover"
            src={collection.image}
          />
        )}
        <div className="native-merchant-collection-caption">
          <div>
            <h1>{title}</h1>
            <IconButton
              native
              icon="share-android"
              label={ui("shareValue1", { value1: title ?? "" })}
              onClick={() => {
                setShareUrl(location.href);
                setStatus("");
                setSharing(true);
              }}
              data-ui-label="shareValue1"
            />
          </div>
          <SourceLink href={`/stores/${store.id}`} startAtTop>
            {(p.avatar || store.logo) && (
              <MerchantPhoto src={p.avatar || store.logo} />
            )}
            {store.name}
          </SourceLink>
        </div>
      </header>
      <nav
        className="native-merchant-product-filters"
        aria-label={ui("collectionFilters")}
        data-ui-label="collectionFilters"
      >
        <IconButton
          native
          icon="filter-circles"
          label={ui("filterCollectionProducts")}
          onClick={() => openStoreFilter("all", initialStock)}
          data-ui-label="filterCollectionProducts"
        />
        <button onClick={() => openStoreFilter("sort", initialStock)}>
          {ui("sortBy")} <NativeIcon name="back" />
        </button>
        {collection?.showSaleFilter && (
          <button
            aria-pressed={filters.sale}
            onClick={() => {
              const next = new URLSearchParams(params.toString());
              if (filters.sale) next.delete("sale");
              else next.set("sale", "1");
              commitSheetQuery(next);
            }}
          >
            {ui("onSale")}
          </button>
        )}
        <button
          aria-pressed={filters.stock}
          onClick={() => {
            const next = new URLSearchParams(params.toString());
            next.set("stock", filters.stock ? "0" : "1");
            commitSheetQuery(next);
          }}
        >
          {ui("inStock")}
        </button>
        <button onClick={() => openStoreFilter("price", initialStock)}>
          {ui("price")} <NativeIcon name="back" />
        </button>
      </nav>
      <StoreGrid
        products={products}
        native
        defaultInStockOnly={initialStock}
        inStockProductIds={collection?.inStockProductIds}
        heading={false}
      />
      {products.length === 0 && (
        <p className="native-merchant-capture-note">
          {ui("thisCollectionSRemainingCatalogHasNotBeenCapturedIn")}
          {(collection?.url || p.website || store.referenceWebsite) && (
            <>
              {" "}
              <a
                href={collection?.url || p.website || store.referenceWebsite}
                target="_blank"
                rel="noreferrer"
              >
                {ui("openTheMerchantSOnlineStore")}
              </a>
            </>
          )}
        </p>
      )}
      {!products.length && merchantProducts(store, catalog).length > 0 && (
        <section className="native-merchant-product-recovery">
          <h2>
            {ui("moreFrom")} {store.name}
          </h2>
          <div className="product-grid">
            {merchantProducts(store, catalog)
              .slice(0, 6)
              .map((product) => (
                <ProductCard
                  key={product.id}
                  nativeIcons
                  product={{ ...product, referenceStyle: "android" }}
                />
              ))}
          </div>
        </section>
      )}
      <FloatingNav android nativeIcons back fade />
      <Sheet
        open={sharing}
        title={ui("sharingLink")}
        onClose={() => setSharing(false)}
      >
        <SourceShareFields
          id={`merchant-collection-${slug}`}
          label={ui("linkToThisCollection")}
          url={shareUrl}
          status={status}
          onStatus={setStatus}
        />
      </Sheet>
    </MerchantShell>
  );
}
