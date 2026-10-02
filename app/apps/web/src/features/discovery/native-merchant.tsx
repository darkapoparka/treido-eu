"use client";
import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import type { MerchantCollection } from "../catalog/merchant-types";
import { NativeMerchantRecent } from "./native-merchant-recent";
import type { Catalog, Store } from "../catalog/types";
import { merchantPresentation } from "../catalog/seller-presentation";
import {
  MerchantShell,
  MerchantPhoto,
  MerchantHeader,
  MerchantIdentity,
  MerchantAvatar,
} from "./native-merchant-chrome";
import {
  MerchantCapturedListings,
  merchantCapturedListings,
} from "./merchant-captured-listings";
import { MerchantCatalogPreview } from "./merchant-product-ratings";
import { MerchantReviewOverview } from "./native-merchant-reviews";
import { SourceLink } from "./return-navigation";
import { DecorativeVideo } from "./decorative-video";
import { FloatingNav, Sheet, ProductCard } from "./components";
import { NativeIcon } from "./native-icons";
import { useDiscovery } from "./state";
import { CartOverlay } from "../commerce/checkout";
import { merchantProducts } from "../catalog/reference/merchant-catalog-model";
import { StoreGrid } from "./store-grid";
function destination(store: Store, c: MerchantCollection) {
  return (
    c.url ??
    (c.slug === "shop-all"
      ? `/stores/${store.id}#all-products`
      : `/stores/${store.id}/collections/${c.slug}`)
  );
}
function CollectionLink({
  store,
  collection,
  chip = false,
}: {
  store: Store;
  collection: MerchantCollection;
  chip?: boolean;
}) {
  const c = collection;
  return (
    <SourceLink
      data-wide={!chip && c.profileWide ? "true" : undefined}
      className={
        chip ? "native-merchant-category" : "native-merchant-collection-tile"
      }
      href={destination(store, c)}
      startAtTop={!chip && c.slug !== "shop-all"}
      {...(c.url ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      <MerchantPhoto src={c.image} />
      <span>{c.title}</span>
    </SourceLink>
  );
}
export function NativeStorefront({
  store,
  catalog,
}: {
  store: Store;
  catalog: Catalog;
}) {
  const ui = useTranslations("discoveryUI");
  const [cartOpen, setCartOpen] = useState(false);
  const { viewStore } = useDiscovery();
  useEffect(() => viewStore(store.id), [store.id, viewStore]);
  const p = merchantPresentation(store),
    products = merchantProducts(store, catalog);
  const ownProducts = new Map(products.map((product) => [product.id, product]));
  return (
    <MerchantShell store={store} kind="store">
      {p.cover && (
        <div className="native-merchant-cover" aria-hidden="true">
          <MerchantPhoto src={p.cover} />
          {p.coverVideo && (
            <DecorativeVideo
              clips={[
                { key: p.coverVideo, className: "native-merchant-cover-video" },
              ]}
              loop
            />
          )}
        </div>
      )}
      <MerchantHeader store={store} />
      <section className="native-merchant-brand">
        {p.wordmark && <h1 className="sr-only">{store.name}</h1>}
        {p.wordmark ? (
          <MerchantPhoto
            className="native-merchant-wordmark"
            src={p.wordmark}
            alt={store.name}
          />
        ) : (
          <h1>
            <MerchantAvatar store={store} />
            <span>{store.name}</span>
          </h1>
        )}
        {(p.rating ?? store.rating) !== undefined && (
          <SourceLink
            className="native-merchant-rating"
            href={`/stores/${store.id}/reviews`}
          >
            {p.rating ?? store.rating} ★ ({p.ratingCount ?? store.ratingCount})
          </SourceLink>
        )}
      </section>
      <nav
        className="native-merchant-categories"
        aria-label={ui("storeCategories")}
        data-ui-label="storeCategories"
      >
        {p.categories
          ?.slice()
          .sort(
            (a, b) =>
              Number(b.slug === "shop-all") - Number(a.slug === "shop-all"),
          )
          .map((c) => (
            <CollectionLink key={c.slug} store={store} collection={c} chip />
          )) ?? (
          <a className="native-merchant-category" href="#all-products">
            <NativeIcon name="storefront" />
            <span>{ui("shopAll")}</span>
          </a>
        )}
      </nav>
      <NativeMerchantRecent store={store} catalog={catalog} />
      {!!p.featuredProductIds?.length && (
        <section className="native-merchant-panel native-merchant-featured">
          <h2>{ui("forYou")}</h2>
          <div className="product-rail">
            {p.featuredProductIds.flatMap((id) => {
              const product = ownProducts.get(id);
              return product
                ? [
                    <ProductCard
                      key={id}
                      nativeIcons
                      product={{ ...product, referenceStyle: "android" }}
                    />,
                  ]
                : [];
            })}
          </div>
        </section>
      )}
      {p.featureCollections?.map((collection) => (
        <SourceLink
          key={collection.slug}
          className="native-merchant-feature-collection"
          href={destination(store, collection)}
          startAtTop
        >
          <MerchantPhoto src={collection.image} />
          <h2>{collection.title}</h2>
          <NativeIcon name="arrow" />
        </SourceLink>
      ))}
      {!!p.collections?.length && (
        <section className="native-merchant-collections native-merchant-panel">
          <h2>{ui("collections")}</h2>
          <div className="native-merchant-collection-rail">
            {p.collections.map((c) => (
              <CollectionLink key={c.slug} store={store} collection={c} />
            ))}
          </div>
        </section>
      )}
      <section id="all-products" className="native-merchant-products">
        {(products.length > 0 ||
          !merchantCapturedListings(store, catalog).length) && (
          <StoreGrid products={products} native />
        )}
        <MerchantCapturedListings store={store} catalog={catalog} />
      </section>
      <FloatingNav
        android
        nativeIcons
        back
        fade
        cart={() => setCartOpen(true)}
      />
      <CartOverlay
        catalog={catalog}
        open={cartOpen}
        onClose={() => setCartOpen(false)}
      />
    </MerchantShell>
  );
}
export function NativeStoreInfo({
  store,
  catalog,
}: {
  store: Store;
  catalog: Catalog;
}) {
  const ui = useTranslations("discoveryUI");
  const p = merchantPresentation(store),
    [more, setMore] = useState(false),
    [report, setReport] = useState(false);
  const categories = [
    ...(p.categories?.filter((c) => c.slug !== "shop-all") ?? []),
    ...(p.categories?.filter((c) => c.slug === "shop-all") ?? []),
  ];
  const policies =
    p.policies ??
    Object.entries(store.referencePolicies ?? {}).map(([key, value]) => ({
      label: value.title,
      url: `/stores/${store.id}/policies/${key}`,
    }));
  return (
    <MerchantShell store={store} kind="info">
      <MerchantHeader store={store} profile />
      <MerchantIdentity store={store} />
      {(p.description || store.description) && (
        <>
          <p className="native-merchant-description" data-expanded={more}>
            {p.description || store.description}
          </p>
          {(p.descriptionExpandable ||
            (p.description || store.description).length > 220) && (
            <button
              className="native-merchant-more"
              aria-expanded={more}
              onClick={() => setMore(!more)}
            >
              {more ? ui("less") : ui("more_d47d7c")}
            </button>
          )}
        </>
      )}
      {!!categories.length && (
        <nav
          className="native-merchant-profile-categories"
          aria-label={ui("storeCollections")}
          data-ui-label="storeCollections"
        >
          {categories.map((c) => (
            <CollectionLink key={c.slug} store={store} collection={c} />
          ))}
        </nav>
      )}
      <MerchantCatalogPreview store={store} catalog={catalog} />
      <MerchantReviewOverview store={store} />
      {!!p.locations?.length && (
        <section className="native-merchant-panel native-merchant-links">
          <h2>{ui("locations")}</h2>
          {p.locations.map((place) => (
            <a
              key={place.address}
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.address)}`}
              target="_blank"
              rel="noreferrer"
            >
              <span>
                <b>{place.name}</b>
                <br />
                {place.address}
              </span>
              <NativeIcon name="external-link" />
            </a>
          ))}
        </section>
      )}
      {!!policies.length && (
        <section className="native-merchant-panel native-merchant-links">
          <h2>{ui("policies")}</h2>
          {policies.map((p) => (
            <SourceLink
              key={p.label}
              href={p.url}
              {...(p.url.startsWith("https:")
                ? { target: "_blank", rel: "noreferrer" }
                : {})}
            >
              {p.label}
              <NativeIcon name="external-link" />
            </SourceLink>
          ))}
        </section>
      )}{" "}
      {!!p.contacts?.length && (
        <section className="native-merchant-panel native-merchant-links">
          <h2>{ui("contact")}</h2>
          {p.contacts.map((c) => (
            <a
              key={c.label}
              href={c.url}
              target={c.url.startsWith("https:") ? "_blank" : undefined}
              rel="noreferrer"
            >
              {c.label}
              <NativeIcon name={c.icon} />
            </a>
          ))}
        </section>
      )}
      {(p.website || store.referenceWebsite) && (
        <a
          className="native-merchant-panel native-merchant-external"
          href={p.website || store.referenceWebsite}
          target="_blank"
          rel="noreferrer"
        >
          {ui("visitOnlineStore")}
          <NativeIcon name="external-link" />
        </a>
      )}
      <button
        className="native-merchant-panel native-merchant-external"
        onClick={() => setReport(true)}
      >
        {ui("report")}
        <NativeIcon name="alert" />
      </button>
      <Sheet
        open={report}
        title={ui("reportStore")}
        onClose={() => setReport(false)}
      >
        <p className="sheet-copy">
          {ui("reportingIsNotConnectedInThisLocalPreviewNoReport")}
        </p>
        <textarea
          aria-label={ui("reportDetails")}
          data-ui-label="reportDetails"
        />
        <button className="primary" onClick={() => setReport(false)}>
          {ui("close")}
        </button>
      </Sheet>
    </MerchantShell>
  );
}
export { NativeStoreCollection } from "./native-merchant-collection";
