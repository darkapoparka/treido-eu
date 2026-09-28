"use client";
import { ShopSurface } from "./hydration-boundary";
import { DecorativeVideo } from "./decorative-video";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatMoney } from "../catalog/types";
import { kitschPolicies } from "../catalog/reference/store-policies";
import type { Catalog, Store, Product } from "../catalog/types";
import {
  FloatingNav,
  IconButton,
  ProductCard,
  Sheet,
  commitSheetQuery,
} from "./components";
import { StoreFilter, openStoreFilter } from "./store-filter";
import { Icon } from "./icons";
import { KitschWordmark } from "./kitsch-wordmark";
import { ReviewStars } from "./rating-stars";
import {
  ContextualCloseLink,
  SourceLink,
  useContextualClose,
} from "./return-navigation";
import { useSearchDraft } from "./search-draft";
import { Cart } from "./product";
import { useDiscovery } from "./state";
import styles from "./store.module.css";
import {
  readStoreFilters,
  selectStoreProducts,
  matchStoreProducts,
  normalizeStoreQuery,
  hasStoreFilters,
} from "./store-model";

const collectionMedia = [
  {
    slug: "whats-new",
    name: "What's New",
    media: "collection-new",
    tileMedia: "collection-new-tile",
  },
  {
    slug: "best-sellers",
    name: "Best Sellers",
    media: "collection-best",
    tileMedia: "collection-best-tile",
  },
  {
    slug: "coastal-cottage",
    name: "Coastal Cottage",
    media: "collection-coastal",
  },
];
function StoreActions({
  store,
  close = false,
  compact = false,
}: {
  store: Store;
  close?: boolean;
  compact?: boolean;
}) {
  const state = useDiscovery();
  const [notice, setNotice] = useState("");
  return (
    <>
      <div className="store-actions" data-compact={compact}>
        {close ? (
          <ContextualCloseLink
            className="icon-button"
            href={`/stores/${store.id}`}
            aria-label="Close store information"
          >
            <Icon name="close" />
          </ContextualCloseLink>
        ) : (
          <SourceLink
            className="icon-button"
            href={`/stores/${store.id}/info`}
            aria-label="Store information"
          >
            <Icon name="menu" />
          </SourceLink>
        )}
        {!close && (
          <SourceLink
            className={
              store.referenceStyle === "android"
                ? "android-store-search"
                : "icon-button"
            }
            href={`/stores/${store.id}/search`}
            aria-label="Search store"
          >
            <Icon name="search" />
            {store.referenceStyle === "android" && (
              <span>Search this store</span>
            )}
          </SourceLink>
        )}
        {!compact && (
          <button
            className="pill follow"
            aria-pressed={state.followed.includes(store.id)}
            onClick={() => state.toggleFollow(store.id)}
          >
            {state.followed.includes(store.id) ? "Following" : "Follow"}
          </button>
        )}
        {!compact && store.referenceStyle !== "android" && (
          <IconButton
            icon="share"
            label="Share store"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  new URL(`/stores/${store.id}`, window.location.origin).href,
                );
                setNotice("Local preview link copied");
              } catch {
                setNotice("Clipboard unavailable");
              }
            }}
          />
        )}
      </div>
      {notice && (
        <button className="local-toast" onClick={() => setNotice("")}>
          {notice}
        </button>
      )}
    </>
  );
}
function StoreNavigation({ store }: { store: Store }) {
  const anchor = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);
  const [offers, setOffers] = useState(false);
  // Campaign presentation comes from the store snapshot, not Follow state.
  const compactOffer = store.promotionSavings !== 15;
  useEffect(() => {
    const element = anchor.current;
    if (!element) return;
    const syncPinned = () =>
      setPinned(element.getBoundingClientRect().top < 80);
    // Partial intersection starts when the anchor's top crosses the header
    // boundary. Also read live geometry after restored/programmatic scroll;
    // an observer entry can describe the position before history restoration.
    const observer = new IntersectionObserver(syncPinned, {
      threshold: [0, 1],
      rootMargin: "-80px 0px 0px 0px",
    });
    observer.observe(element);
    const frame = requestAnimationFrame(syncPinned);
    window.addEventListener("scroll", syncPinned, { passive: true });
    window.addEventListener("resize", syncPinned);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", syncPinned);
      window.removeEventListener("resize", syncPinned);
    };
  }, []);
  return (
    <div className="store-category-anchor" ref={anchor}>
      <div
        className={`store-category-navigation ${pinned ? "is-pinned" : ""}`}
        data-compact-offer={compactOffer}
      >
        {pinned && compactOffer && (
          <button
            className="store-compact-promotion"
            onClick={() => setOffers(true)}
          >
            20% off your order <span>spring20orde…</span>
            <span aria-hidden="true">⌄</span>
          </button>
        )}
        <div className="category-rail">
          {pinned && (
            <div className="store-compact-actions">
              <SourceLink
                href={`/stores/${store.id}/info`}
                className="store-compact-menu"
                aria-label="Store information"
              >
                <img src={store.logo} alt="" />
                <Icon name="menu" />
              </SourceLink>
              <SourceLink
                href={`/stores/${store.id}/search`}
                className="icon-button"
                aria-label="Search store"
              >
                <Icon name="search" />
              </SourceLink>
            </div>
          )}
          {store.categories.map((category) => (
            <Link
              className="pill"
              key={category}
              href={
                category === "Shop all"
                  ? `/stores/${store.id}#all-products`
                  : `/stores/${store.id}/collections/${category === "What's New" ? "whats-new" : category.toLowerCase().replaceAll(" ", "-")}`
              }
            >
              <img
                src={`/api/reference-media/${category === "Shop all" ? "home-air-dry-cream" : category === "Cleanse" ? "category-cleanse" : "category-heatless"}`}
                alt=""
              />
              {category}
            </Link>
          ))}
        </div>
      </div>
      <Sheet
        open={offers}
        title="Offer details"
        onClose={() => setOffers(false)}
      >
        <p className="sheet-copy">
          20% off your order — the label shown in the captured storefront.
        </p>
        <p className="form-note">
          The captured coupon label is truncated. This preview cannot validate a
          coupon or apply a live discount.
        </p>
      </Sheet>
    </div>
  );
}

const promotionEvent = "shop-store-promotion";
function subscribePromotion(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener(promotionEvent, listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener(promotionEvent, listener);
  };
}
function promotionExpanded() {
  const entry = window.history.state?.shopStorePromotion;
  return entry?.path === location.pathname && entry.expanded === true;
}

function StorePromotion({
  savings = 20,
  compact = false,
}: {
  savings?: number;
  compact?: boolean;
}) {
  const expanded = useSyncExternalStore(
    subscribePromotion,
    promotionExpanded,
    () => false,
  );
  function toggle() {
    // The disclosure belongs to this history entry, including native reload.
    // New visits start collapsed; neither another store nor the URL inherits it.
    window.history.replaceState(
      {
        ...window.history.state,
        shopStorePromotion: {
          path: location.pathname,
          expanded: !promotionExpanded(),
        },
      },
      "",
      location.href,
    );
    window.dispatchEvent(new Event(promotionEvent));
  }
  return (
    <div className={`promotion-owner ${expanded ? "expanded" : ""}`}>
      <button
        className={compact ? "collection-promotion" : "store-promotion"}
        aria-expanded={expanded}
        onClick={toggle}
      >
        <span>
          <b>Save ${expanded ? 15 : savings}</b> on orders over $50
          <Icon
            name="chevron"
            style={{ transform: `rotate(${expanded ? -90 : 90}deg)` }}
          />
        </span>
        {!expanded && !compact && <small>+ 1 more promotion</small>}
      </button>
      {expanded && (
        <div className="promotion-offers">
          <div>
            <b>Save $15</b>
            <p>On orders over $50. Eligible products only.</p>
          </div>
          <div>
            <b>20% off your order</b>
            <span> spring20orderdis…</span>
            <p>Automatically applied at checkout</p>
          </div>
        </div>
      )}
    </div>
  );
}
function ordered(catalog: Catalog, ids: string[]) {
  return ids.flatMap((id) => {
    const p = catalog.products.find((p) => p.id === id);
    return p ? [p] : [];
  });
}
function UnidentifiedStorePhoto({ source }: { source: string }) {
  return (
    <figure
      className={styles.unidentifiedGridPhoto}
      data-source-boundary="unidentified-store-product"
    >
      <img src={source} alt="Partially captured product photograph" />
      <figcaption className="sr-only">
        The product identity and remaining photograph were not captured. No
        price, inventory or product link is inferred.
      </figcaption>
    </figure>
  );
}
function StoreGrid({
  products,
  heading = true,
  promotions = false,
  sourceTail = false,
  unidentifiedPhotos = [],
}: {
  products: Product[];
  heading?: boolean;
  promotions?: boolean;
  sourceTail?: boolean;
  unidentifiedPhotos?: readonly string[];
}) {
  const params = useSearchParams();
  const filters = readStoreFilters(params);
  const filtered = selectStoreProducts(products, filters);
  const capturedFilterTail =
    filters.sale &&
    filters.stock &&
    filters.min === 0 &&
    filters.max === 380 &&
    filters.sort === "Best selling";
  const capturedTail = sourceTail || capturedFilterTail;
  return (
    <>
      {heading && (
        <div className="store-grid-heading">
          <h2>All products</h2>
          <IconButton
            icon="filter-circles"
            label="Filter store products"
            onClick={() => openStoreFilter()}
          />
        </div>
      )}
      <div className="product-grid">
        {filtered.map((p) =>
          capturedTail && ["shampoo-bag", "terracotta"].includes(p.id) ? (
            <UnidentifiedStorePhoto
              key={`source-fragment-${p.id === "shampoo-bag" ? "left" : "right"}`}
              source={`/api/reference-media/store-arrival-tail-${p.id === "shampoo-bag" ? "left" : "right"}`}
            />
          ) : (
            <ProductCard
              key={p.id}
              product={
                sourceTail && p.id === "shea-butter"
                  ? {
                      ...p,
                      images: [
                        "/api/reference-media/store-source-reported-shea",
                      ],
                    }
                  : p
              }
              showPromotion={promotions}
            />
          ),
        )}
        {!hasStoreFilters(filters) &&
          unidentifiedPhotos.map((source) => (
            <UnidentifiedStorePhoto key={source} source={source} />
          ))}
      </div>
      {!filtered.length && (
        <div className="empty-state" role="status">
          <p>No matching products in this reference.</p>
          {hasStoreFilters(filters) && (
            <button
              className="pill store-search-recovery"
              onClick={() => {
                const next = new URLSearchParams(params.toString());
                for (const key of ["min", "max", "sale", "stock", "sort"])
                  next.delete(key);
                commitSheetQuery(next);
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}
      <StoreFilter />
    </>
  );
}

const chemicalCategoryMedia: Record<string, string> = {
  "Shop all": "shop",
  Kits: "kits",
  Exterior: "exterior",
  Interior: "interior",
};
function StoreCategoryRail({ store }: { store: Store }) {
  return (
    <div className="category-rail">
      {store.categories.map((category) => (
        <Link
          className="pill"
          key={category}
          href={
            category === "Shop all"
              ? `/stores/${store.id}#all-products`
              : `/stores/${store.id}/collections/${category === "What's New" ? "whats-new" : category.toLowerCase().replaceAll(" ", "-")}`
          }
        >
          {store.id === "chemical-guys" && chemicalCategoryMedia[category] && (
            <img
              src={`/api/reference-media/chemical-category-${chemicalCategoryMedia[category]}`}
              alt=""
            />
          )}
          {store.id === "chemical-guys" ? (
            <span className={styles.chemicalCategoryLabel}>{category}</span>
          ) : (
            category
          )}
        </Link>
      ))}
    </div>
  );
}
function ChemicalMediaShelves() {
  const [notice, setNotice] = useState(false);
  const videoClipNames = ["one", "two", "three", "four-partial"];
  const featuredClipNames = ["one", "two", "three"];
  return (
    <>
      <div className="store-video-rail">
        {videoClipNames.map((name, index) => {
          const contents = (
            <>
              <img
                src={`/api/reference-media/chemical-store-clip-${name}`}
                alt=""
              />
              <span>{index === 0 ? "3d" : "4d"} ago</span>
            </>
          );
          return index === 0 ? (
            <SourceLink
              startAtTop
              key={name}
              href="/stores/chemical-guys/video"
              aria-label="Open Tire and Trim video"
            >
              {contents}
            </SourceLink>
          ) : (
            <button
              key={name}
              aria-label={`Open Chemical Guys clip ${index + 1}`}
              onClick={() => setNotice(true)}
            >
              {contents}
            </button>
          );
        })}
      </div>
      <section className={`store-recommendations ${styles.chemicalFeatured}`}>
        <h2>Featured</h2>
        <div className="product-rail">
          {featuredClipNames.map((name, index) => (
            <button
              key={name}
              aria-label={`Open Chemical Guys featured video ${index + 1}`}
              onClick={() => setNotice(true)}
            >
              <img
                src={`/api/reference-media/chemical-featured-${name}-partial`}
                alt=""
              />
            </button>
          ))}
        </div>
      </section>
      <Sheet
        open={notice}
        title="Video preview"
        onClose={() => setNotice(false)}
      >
        <p className="sheet-copy">
          Only this video thumbnail was captured. Its full video and audio are
          unavailable.
        </p>
      </Sheet>
    </>
  );
}

export function Storefront({
  store,
  catalog,
}: {
  store: Store;
  catalog: Catalog;
}) {
  const [cart, setCart] = useState(false);
  const expandedPromotion = useSyncExternalStore(
    subscribePromotion,
    promotionExpanded,
    () => false,
  );
  const { viewStore, reportedProducts, followed } = useDiscovery();
  const params = useSearchParams();
  const reported = params.get("reported");
  const [dismissedReport, setDismissedReport] = useState<string | null>(null);
  const collectionRail = useRef<HTMLDivElement>(null);
  useEffect(() => {
    viewStore(store.id);
  }, [store.id, viewStore]);
  useEffect(() => {
    const saved: unknown = window.history.state?.shopStoreCollectionReturn;
    if (
      !saved ||
      typeof saved !== "object" ||
      !("storeId" in saved) ||
      saved.storeId !== store.id ||
      !("slug" in saved) ||
      typeof saved.slug !== "string" ||
      !("top" in saved) ||
      typeof saved.top !== "number" ||
      !Number.isFinite(saved.top)
    )
      return;
    const { slug, top } = saved;
    let secondFrame = 0;
    let focusFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        const link = collectionRail.current?.querySelector<HTMLAnchorElement>(
          `[data-store-collection="${CSS.escape(slug)}"]`,
        );
        if (!link) return;
        const align = () => {
          const delta = link.getBoundingClientRect().top - top;
          if (Math.abs(delta) > 0.5)
            window.scrollBy({ top: delta, behavior: "instant" });
        };
        align();
        focusFrame = requestAnimationFrame(() => {
          align();
          link.focus({ preventScroll: true });
          const state = { ...window.history.state };
          delete state.shopStoreCollectionReturn;
          window.history.replaceState(state, "", window.location.href);
        });
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      cancelAnimationFrame(focusFrame);
    };
  }, [store.id]);
  function openCollection(slug: string) {
    const link = collectionRail.current?.querySelector<HTMLAnchorElement>(
      `[data-store-collection="${CSS.escape(slug)}"]`,
    );
    if (!link) return;
    window.history.replaceState(
      {
        ...window.history.state,
        shopStoreCollectionReturn: {
          storeId: store.id,
          slug,
          top: link.getBoundingClientRect().top,
        },
      },
      "",
      window.location.href,
    );
    // Next may retain the shelf's scroll while the collection still intersects
    // the viewport. The owned source entry restores its anchor on Back.
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  const isKitsch = store.id === "kitsch",
    chemical = store.id === "chemical-guys",
    followedKitsch = isKitsch && followed.includes(store.id);
  const recommendationsAnchor = useRef<HTMLElement>(null);
  const [chemicalPinned, setChemicalPinned] = useState(false);
  useEffect(() => {
    const element = recommendationsAnchor.current;
    if (!chemical || !element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) setChemicalPinned(entry.boundingClientRect.top < 154);
      },
      { threshold: [0, 1], rootMargin: "-154px 0px 0px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [chemical]);
  const all = catalog.products.filter((p) => p.storeId === store.id);
  const recommendations =
    store.recommendations ??
    (isKitsch
      ? [
          { productId: "shampoo-bag", ratingCount: "3.3K" },
          { productId: "shea-butter", ratingCount: "2.1K" },
          { productId: "terracotta" },
          { productId: "rice-shampoo" },
        ]
      : chemical
        ? [
            "chemical-clean-trim",
            "chemical-easy-clean",
            "chemical-deep-partial",
          ].map((productId) => ({ productId }))
        : all.map((product) => ({ productId: product.id })));
  const products = recommendations.flatMap((item) => {
    const product = all.find((product) => product.id === item.productId);
    return product
      ? [
          {
            ...product,
            images:
              isKitsch && product.id === "terracotta"
                ? [
                    "/api/reference-media/store-kitsch-terracotta-recommendation",
                  ]
                : chemical && product.id === "chemical-clean-trim"
                  ? ["/api/reference-media/chemical-store-trim-photo"]
                  : chemical && product.id === "chemical-easy-clean"
                    ? ["/api/reference-media/chemical-store-protect-photo"]
                    : product.images,
            ratingCount:
              "ratingCount" in item && item.ratingCount !== undefined
                ? item.ratingCount
                : product.ratingCount,
          },
        ]
      : [];
  });
  const reportedVisible =
    reported !== null &&
    reported !== dismissedReport &&
    reportedProducts.includes(reported) &&
    all.some((product) => product.id === reported);
  return (
    <ShopSurface
      className={`shop-page store-page ${styles.page} ${styles.store} ${chemical ? "chemical-store" : ""} ${store.referenceStyle === "android" ? "android-live android-store" : ""}`}
    >
      {isKitsch && <StorePromotion savings={store.promotionSavings} />}
      {chemical && chemicalPinned && (
        <div className={styles.chemicalPinned}>
          <StoreActions store={store} compact />
          <StoreCategoryRail store={store} />
        </div>
      )}
      <section
        className={`store-hero${isKitsch ? " store-hero-kitsch" : ""}${followedKitsch ? " store-hero-followed" : ""}`}
      >
        {isKitsch && (
          <span className={styles.kitschMotion} aria-hidden="true">
            <DecorativeVideo
              enabled={params.get("reference") !== "captured"}
              clips={[{ key: "kitsch-hero", className: styles.kitschVideo }]}
              initialTime={followedKitsch ? 2.9 : 7.5}
              loop
            />
          </span>
        )}
        <div
          className={styles.storeHeader}
          inert={chemical && chemicalPinned}
          aria-hidden={chemical && chemicalPinned ? true : undefined}
        >
          <StoreActions store={store} />
          <div className="store-brand">
            <span role={isKitsch ? "img" : undefined} aria-label={store.name}>
              {isKitsch ? <KitschWordmark /> : store.name}
            </span>
            {store.rating && (
              <SourceLink href={`/stores/${store.id}/reviews`}>
                {store.rating} ★ ({store.ratingCount})
              </SourceLink>
            )}
          </div>
          {isKitsch ? (
            <StoreNavigation store={store} />
          ) : store.referenceStyle !== "android" ? (
            <StoreCategoryRail store={store} />
          ) : null}
        </div>
        {store.referenceStyle !== "android" && (
          <section
            className="store-recommendations"
            ref={recommendationsAnchor}
          >
            <h1>For you</h1>
            <div className="product-rail">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  showPromotion={chemical}
                  ratingStars={
                    isKitsch &&
                    product.id === "terracotta" &&
                    product.ratingCount === "2.1K"
                      ? 4.5
                      : undefined
                  }
                  partialRatingStars={
                    isKitsch && product.id === "sugar-scrub" ? 4 : undefined
                  }
                />
              ))}
            </div>
          </section>
        )}
        {chemical && <ChemicalMediaShelves />}
        {isKitsch && (
          <section className="store-recommendations">
            <h2>Collections</h2>
            <div className="store-collection-rail" ref={collectionRail}>
              {collectionMedia.map((c) => (
                <Link
                  key={c.slug}
                  href={`/stores/${store.id}/collections/${c.slug}`}
                  data-store-collection={c.slug}
                  onNavigate={() => openCollection(c.slug)}
                >
                  <img
                    src={`/api/reference-media/${c.tileMedia ?? c.media}`}
                    alt=""
                  />
                  <span>{c.name}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
        <section id="all-products" className="store-all-products">
          <StoreGrid
            sourceTail={reported === "shea-butter"}
            unidentifiedPhotos={store.capturedGrid?.unidentifiedPhotos}
            products={
              isKitsch
                ? ordered(catalog, [
                    ...(store.capturedGrid?.productIds ?? [
                      "rice-shampoo",
                      "rice-conditioner",
                      "rice-bundle",
                      "shea-butter",
                      "shampoo-bag",
                      "terracotta",
                      "summer-mystery-box",
                      "beachy-gelato",
                    ]),
                  ])
                : all
            }
          />
        </section>
      </section>
      {reportedVisible && (
        <button
          className="local-toast report-confirmation-toast"
          role="status"
          onClick={() => setDismissedReport(reported)}
        >
          This item has been reported
        </button>
      )}
      <FloatingNav
        android={store.referenceStyle === "android"}
        back
        fade={isKitsch}
        cart={reported ? undefined : () => setCart(true)}
        showCartWhenEmpty={
          !reported &&
          isKitsch &&
          !expandedPromotion &&
          store.promotionSavings !== 15
        }
      />
      <Cart catalog={catalog} open={cart} onClose={() => setCart(false)} />
    </ShopSurface>
  );
}
function StoreCriteria() {
  const params = useSearchParams();
  const filters = readStoreFilters(params);
  function toggle(key: "sale" | "stock") {
    const next = new URLSearchParams(params.toString());
    next.set(key, filters[key] ? "0" : "1");
    commitSheetQuery(next);
  }
  return (
    <div className="category-rail store-criteria">
      <IconButton
        icon="filter-circles"
        label="Filter collection"
        onClick={() => openStoreFilter()}
      />
      <button className="pill" onClick={() => openStoreFilter("sort")}>
        Sort by <Icon name="chevron" />
      </button>
      <button
        className={`pill ${filters.sale ? "selected" : ""}`}
        aria-pressed={filters.sale}
        onClick={() => toggle("sale")}
      >
        On sale
      </button>
      <button
        className={`pill ${filters.stock ? "selected" : ""}`}
        aria-pressed={filters.stock}
        onClick={() => toggle("stock")}
      >
        In-stock
      </button>
      <button className="pill" onClick={() => openStoreFilter("price")}>
        Price <Icon name="chevron" />
      </button>
    </div>
  );
}
export function StoreCollection({
  store,
  catalog,
  slug,
}: {
  store: Store;
  catalog: Catalog;
  slug: string;
}) {
  const collection = collectionMedia.find((c) => c.slug === slug);
  const title = collection?.name ?? slug.replaceAll("-", " ");
  const products =
    slug === "whats-new"
      ? ordered(catalog, ["summer-mystery-box", "beachy-gelato"])
      : slug === "best-sellers"
        ? ordered(catalog, [
            "rice-bundle",
            "idea-rosemary-liquid",
            "rice-shampoo",
            "rice-conditioner",
            "shea-butter",
          ])
        : slug === "cleanse"
          ? catalog.products.filter(
              (p) => p.storeId === store.id && p.category === "Cleanse",
            )
          : slug === "shampoo-conditioner-combo-packs"
            ? ordered(catalog, ["rice-bundle"])
            : [];
  const presentedProducts = products.map((product) =>
    slug === "whats-new" && product.id === "summer-mystery-box"
      ? {
          ...product,
          images: ["/api/reference-media/collection-new-summer-card"],
        }
      : slug === "whats-new" && product.id === "beachy-gelato"
        ? {
            ...product,
            images: ["/api/reference-media/collection-new-gelato-card"],
          }
        : product,
  );
  const [notice, setNotice] = useState("");
  return (
    <ShopSurface
      className={`shop-page store-collection-page ${styles.page} ${styles.collection}`}
      data-collection={slug}
    >
      {slug !== "best-sellers" && <StorePromotion savings={15} compact />}
      <div className="store-collection-hero">
        {collection && (
          <img
            src={`/api/reference-media/${slug === "whats-new" ? "collection-new-hero" : collection.media}`}
            alt=""
          />
        )}
        <div>
          <h1>{title}</h1>
          <SourceLink
            startAtTop
            className="collection-store"
            href={`/stores/${store.id}`}
          >
            {store.logo && <img src={store.logo} alt="" />}
            {store.name}
          </SourceLink>
        </div>
        <IconButton
          icon="share"
          label="Share collection"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
              setNotice("Local preview link copied");
            } catch {
              setNotice("Clipboard unavailable");
            }
          }}
        />
      </div>
      <StoreCriteria />
      <StoreGrid products={presentedProducts} heading={false} promotions />
      {slug === "whats-new" && (
        <div
          className="collection-partial-products"
          aria-label="Additional captured products; details not recorded"
        >
          {["yellow", "coffee"].map((key) => (
            <img
              key={key}
              src={`/api/reference-media/collection-${key}-partial`}
              alt="Additional product, partially captured"
            />
          ))}
        </div>
      )}
      {notice && (
        <button className="local-toast" onClick={() => setNotice("")}>
          {notice}
        </button>
      )}
      <FloatingNav back fade />
    </ShopSurface>
  );
}
const storeCategories = [
  { name: "Cleanse", media: "category-cleanse", slug: "cleanse" },
  { name: "Heatless Hair", media: "category-heatless", slug: "heatless-hair" },
  { name: "What's New", media: "collection-new", slug: "whats-new" },
  {
    name: "Shower Caps & Hair Towels",
    media: "category-caps",
    slug: "shower-caps",
  },
];
export function StoreInfo({ store }: { store: Store; catalog: Catalog }) {
  const [detail, setDetail] = useState("");
  const [more, setMore] = useState(false);
  const kitsch = store.id === "kitsch";
  const policies = kitschPolicies;
  const contacts = [
    ["Website", "https://www.mykitsch.com", "website"],
    ["kitsch@mykitsch.com", "mailto:kitsch@mykitsch.com", "mail"],
    ["4242405551", "tel:+14242405551", "phone"],
    ["Instagram", "https://instagram.com/mykitsch", "instagram"],
    ["Facebook", "https://facebook.com/mykitsch", "facebook-circle"],
  ] as const;
  return (
    <ShopSurface
      className={`shop-page store-info-page ${styles.page} ${styles.information}`}
    >
      <StoreActions store={store} close />
      <div className="store-info-brand">
        {store.logo && <img src={store.logo} alt="" />}
        <div>
          <b>{store.name}</b>
          {store.rating && (
            <small>
              {store.rating} ★ ({store.ratingCount})
            </small>
          )}
        </div>
      </div>
      <p className="store-description">
        {kitsch
          ? "Evolving your everyday essentials, KITSCH is a US designed brand worn & loved by your favorite celebrities. Shop online for free shipping on orders"
          : store.description ||
            "No additional brand description was captured."}
        {more && (
          <span>
            {" "}
            —{" "}
            <a href="https://www.mykitsch.com" target="_blank" rel="noreferrer">
              Read the full brand description online
            </a>
          </span>
        )}
      </p>
      {kitsch && (
        <button
          className="store-description-more"
          aria-expanded={more}
          onClick={() => setMore(!more)}
        >
          {more ? "Less" : "More"}
        </button>
      )}
      {kitsch && (
        <>
          <div className="store-info-categories">
            {storeCategories.map((c) => (
              <SourceLink
                startAtTop
                href={`/stores/${store.id}/collections/${c.slug}`}
                key={c.slug}
              >
                <img src={`/api/reference-media/${c.media}`} alt="" />
                <span>{c.name}</span>
              </SourceLink>
            ))}
            <SourceLink
              startAtTop
              href={`/stores/${store.id}/collections/shampoo-conditioner-combo-packs`}
            >
              <img
                src="/api/reference-media/category-combo-partial"
                alt="Shampoo and conditioner combo packs, partially captured"
              />
              <span>Shampoo &amp; Conditioner Combo Packs</span>
            </SourceLink>
            <div>
              <img
                src="/api/reference-media/category-hair-partial"
                alt="Hair category, partially captured"
              />
              <span>Hair…</span>
            </div>
          </div>
          <SourceLink
            className="store-shop-all"
            href={`/stores/${store.id}#all-products`}
          >
            <img src="/api/reference-media/store-shop-all" alt="" />
            <span>Shop all</span>
          </SourceLink>
        </>
      )}
      <section className="store-info-panel store-info-reviews">
        <SourceLink className="detail-row" href={`/stores/${store.id}/reviews`}>
          <h2>Reviews</h2>
          <Icon name="arrow" />
        </SourceLink>
        {store.rating && (
          <>
            <div className="store-info-rating">
              <b>{store.rating}</b>
              <ReviewStars rating={store.rating} />
            </div>
            <p>{store.ratingCount} ratings</p>
          </>
        )}
        {kitsch && (
          <div className="store-review-previews">
            {[
              ["Best shampoo set ever", "Anne"],
              ["Pleasant Surprise", "Jamie"],
              ["Love Everything Kitsch", "Morgan"],
            ].map(([title, name]) => (
              <SourceLink
                href={`/stores/${store.id}/reviews`}
                className="store-review-preview"
                key={title}
              >
                <ReviewStars rating={5} />
                <b>{title}</b>
                <small>
                  <i>{name[0]}</i>
                  {name} · Yesterday
                </small>
              </SourceLink>
            ))}
          </div>
        )}
      </section>
      <section className="store-info-panel store-info-links">
        <h2>Policies</h2>
        {kitsch ? (
          policies.map(([label, href, icon]) => (
            <a
              className="detail-row"
              key={label}
              href={href}
              target="_blank"
              rel="noreferrer"
            >
              {label}
              <Icon name={icon} />
            </a>
          ))
        ) : (
          <p>No policies were captured.</p>
        )}
      </section>
      <section className="store-info-panel store-info-links">
        <h2>Contact</h2>
        {kitsch ? (
          contacts.map(([label, href, icon]) => (
            <a
              className="detail-row"
              key={label}
              href={href}
              target={href.startsWith("https") ? "_blank" : undefined}
              rel="noreferrer"
            >
              {label}
              <Icon name={icon} />
            </a>
          ))
        ) : (
          <p>No contact information was captured.</p>
        )}
      </section>
      {kitsch && (
        <a
          className="store-info-panel detail-row"
          href="https://www.mykitsch.com"
          target="_blank"
          rel="noreferrer"
        >
          Visit Online Store <Icon name="external-link" />
        </a>
      )}
      <button
        className="store-info-panel detail-row"
        onClick={() => setDetail("Report")}
      >
        Report <Icon name="alert" />
      </button>
      <Sheet open={!!detail} title={detail} onClose={() => setDetail("")}>
        <p className="sheet-copy">
          Reporting a store requires a connected service. No report will be sent
          from this local preview.
        </p>
        <textarea aria-label="Report details" placeholder="Tell us more" />
      </Sheet>
    </ShopSurface>
  );
}
export function StoreSearch({
  store,
  catalog,
}: {
  store: Store;
  catalog: Catalog;
}) {
  const closeToSource = useContextualClose();
  const params = useSearchParams(),
    router = useRouter(),
    state = useDiscovery();
  const filters = readStoreFilters(params);
  const q = params.get("q") || "";
  const editor = useSearchDraft(`store-search:${store.id}`, q);
  const draftEntry = JSON.stringify([
    store.id,
    q,
    editor.draft,
    editor.editing,
  ]);
  const [activeDraftEntry, setActiveDraftEntry] = useState(draftEntry);
  const [draft, setDraft] = useState<string | null>(
    editor.editing ? editor.draft : null,
  );
  if (activeDraftEntry !== draftEntry) {
    setActiveDraftEntry(draftEntry);
    setDraft(editor.editing ? editor.draft : null);
  }
  const input = useRef<HTMLInputElement>(null);
  const searchForm = useRef<HTMLFormElement>(null);
  const value = draft ?? q,
    editing = draft !== null || !q;
  const query = normalizeStoreQuery(value),
    kitsch = store.id === "kitsch";
  const path = `/stores/${encodeURIComponent(store.id)}/search`;
  function submit(text: string) {
    editor.update({ draft: q, editing: false });
    const next = new URLSearchParams(params.toString());
    if (text.trim()) next.set("q", text.trim());
    else next.delete("q");
    const url = `${path}${next.size ? `?${next}` : ""}`;
    if (url !== `${window.location.pathname}${window.location.search}`)
      window.history.pushState(null, "", url);
    setDraft(null);
    input.current?.blur();
  }
  function cancel() {
    editor.update({ draft: q, editing: false });
    if (q) {
      setDraft(null);
      input.current?.blur();
      requestAnimationFrame(() =>
        searchForm.current?.focus({ preventScroll: true }),
      );
    } else if (!closeToSource()) router.push(`/stores/${store.id}`);
  }
  function clear() {
    editor.update({ draft: "", editing: true });
    setDraft("");
    input.current?.focus();
  }
  const capturedResults = kitsch && normalizeStoreQuery(q) === "shampoo";
  const products = capturedResults
    ? ordered(catalog, [
        "rice-shampoo",
        "rosemary-liquid",
        "rice-liquid",
        "detox-shampoo",
      ]).map((product) => ({
        ...product,
        images: [`/api/reference-media/store-search-${product.id}-photo`],
      }))
    : matchStoreProducts(catalog.products, store.id, q);
  const count = selectStoreProducts(products, filters).length;
  const suggestions = (
    kitsch && query === "shampoo"
      ? ordered(catalog, ["rice-shampoo", "detox-shampoo", "rosemary-bar"])
      : matchStoreProducts(catalog.products, store.id, value)
  ).slice(0, 3);
  const phrases = kitsch
    ? [
        "dry shampoo",
        "shampoo and conditioner bar bags",
        "shampoo bar",
        "rice water shampoo and conditioner",
        "shampoo and conditioner",
        "purple toning biotin shampoo bundle",
        "rosemary and biotin shampoo set",
        "shampoo conditioner for curly hair",
      ]
    : [];
  const recent = ordered(catalog, [
    ...new Set([...state.viewedProducts, ...(kitsch ? ["shea-butter"] : [])]),
  ])
    .filter((product) => product.storeId === store.id)
    .slice(0, 8);
  const best = kitsch
    ? ordered(catalog, [
        "rice-shampoo",
        "rice-conditioner",
        "rice-bundle",
        "shea-butter",
      ])
    : catalog.products
        .filter((product) => product.storeId === store.id)
        .slice(0, 8);
  const categories = kitsch
    ? storeCategories
    : store.categories.map((name) => ({
        name,
        slug: name.toLowerCase().replaceAll(" ", "-"),
      }));
  function phrase(label: string) {
    const index = normalizeStoreQuery(label).indexOf(query);
    return index < 0 ? (
      label
    ) : (
      <>
        {label.slice(0, index)}
        <mark>{label.slice(index, index + query.length)}</mark>
        {label.slice(index + query.length)}
      </>
    );
  }
  return (
    <ShopSurface
      className={`shop-page store-search-page ${styles.page} ${styles.search} ${editing ? "store-search-editing" : "store-search-results"}`}
    >
      <div className="store-search-toolbar">
        <form
          ref={searchForm}
          className="search-form"
          role="search"
          aria-label={`Search ${store.name}`}
          tabIndex={-1}
          onSubmit={(event) => {
            event.preventDefault();
            submit(value);
          }}
        >
          <Icon name="search" />
          <input
            ref={input}
            name="q"
            aria-label={`Search ${store.name}`}
            placeholder={`Search ${store.name}...`}
            value={value}
            enterKeyHint="search"
            onFocus={() => setDraft((current) => current ?? q)}
            onChange={(event) => {
              setDraft(event.target.value);
              editor.update({ draft: event.target.value, editing: true });
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                cancel();
              }
            }}
          />
          {value && (
            <button
              type="button"
              className="sr-only"
              aria-label="Clear search"
              onClick={clear}
            >
              Clear search
            </button>
          )}
        </form>
        {editing && (
          <button
            type="button"
            className="store-search-cancel"
            onClick={cancel}
          >
            Cancel
          </button>
        )}
      </div>
      {editing ? (
        query ? (
          <div className="store-search-suggestions">
            <button type="button" onClick={() => submit(value)}>
              <Icon name="search" />
              <span>{value}</span>
            </button>
            {suggestions.map((product) => (
              <SourceLink
                href={`/products/${product.id}`}
                key={product.id}
                onNavigate={() =>
                  editor.update({ draft: value, editing: true })
                }
              >
                <img src={product.images[0]} alt="" />
                <span>
                  {product.title}
                  <small>{formatMoney(product.price)}</small>
                </span>
              </SourceLink>
            ))}
            {phrases
              .filter(
                (label) =>
                  label !== query &&
                  query
                    .split(" ")
                    .every((word) => normalizeStoreQuery(label).includes(word)),
              )
              .map((label) => (
                <button type="button" key={label} onClick={() => submit(label)}>
                  <Icon name="search" />
                  <span className="store-suggestion-phrase">
                    {phrase(label)}
                  </span>
                </button>
              ))}
          </div>
        ) : (
          <>
            {categories.length > 0 && (
              <>
                <h2>Shop by</h2>
                <div className="store-search-categories">
                  {categories.map((category) => (
                    <Link
                      key={category.slug}
                      href={
                        category.name === "Shop all"
                          ? `/stores/${store.id}#all-products`
                          : `/stores/${store.id}/collections/${category.slug}`
                      }
                    >
                      {category.name}
                    </Link>
                  ))}
                </div>
              </>
            )}
            {recent.length > 0 && (
              <>
                <h2>Recently viewed</h2>
                <div className="store-search-products">
                  {recent.map((product) => (
                    <ProductCard key={product.id} product={product} mediaOnly />
                  ))}
                </div>
              </>
            )}
            <h2>{kitsch ? "Best sellers" : "Products"}</h2>
            <div className="store-search-products">
              {best.map((product) => (
                <ProductCard key={product.id} product={product} mediaOnly />
              ))}
            </div>
          </>
        )
      ) : (
        <>
          <StoreCriteria />
          <p
            className="store-search-count"
            title={
              capturedResults && !hasStoreFilters(filters)
                ? "Captured count; only the four identified reference products are available in this preview."
                : "Matching products in the local reference sample"
            }
          >
            {capturedResults && !hasStoreFilters(filters) ? "270" : count}{" "}
            results from {store.name}
          </p>
          <StoreGrid products={products} heading={false} />
          {capturedResults && !hasStoreFilters(filters) && (
            <div className="store-search-source-tail" aria-hidden="true">
              {[
                "store-search-shampoo-tail-left",
                "store-search-shampoo-tail-right",
              ].map((media) => (
                <span className="store-search-source-card" key={media}>
                  <img src={`/api/reference-media/${media}`} alt="" />
                </span>
              ))}
            </div>
          )}
          {!products.length && (
            <button className="pill store-search-recovery" onClick={clear}>
              Clear search
            </button>
          )}
        </>
      )}
      <FloatingNav
        back
        onBack={() => {
          if (draft !== null && q) cancel();
          else if (window.history.length > 1) router.back();
          else router.push(`/stores/${store.id}`);
        }}
      />
    </ShopSurface>
  );
}

export function StoreVideo() {
  const [notice, setNotice] = useState(false);
  return (
    <ShopSurface className={`store-video-page ${styles.page} ${styles.video}`}>
      <img
        className="video-poster"
        src="/api/reference-media/chemical-video-photo"
        alt="Chemical Guys Tire and Trim Gel in front of a GMC tailgate"
      />
      <div className="video-top">
        <ContextualCloseLink
          className="icon-button"
          href="/stores/chemical-guys"
          aria-label="Close video"
        >
          <Icon name="close" />
        </ContextualCloseLink>
        <IconButton
          icon="more"
          label="Video options"
          onClick={() => setNotice(true)}
        />
      </div>
      <button
        className={`icon-button ${styles.videoAudio}`}
        aria-label="Video audio unavailable"
        onClick={() => setNotice(true)}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <path
            d="M4 9h4l5-4v14l-5-4H4zM17 10l4 4m0-4-4 4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div className="video-bottom">
        <SourceLink
          startAtTop
          className={styles.videoStore}
          href="/stores/chemical-guys"
        >
          <span className={styles.videoStoreLogo}>
            <img src="/api/reference-media/chemical-video-logo" alt="" />
          </span>
          <span>
            <b>Chemical Guys</b>
            <small>3d ago</small>
          </span>
        </SourceLink>
        <SourceLink
          startAtTop
          className={styles.videoProduct}
          href="/products/order-tire-trim"
        >
          <span className={styles.videoProductPhoto}>
            <img src="/api/reference-media/chemical-video-item-photo" alt="" />
          </span>
          <span>
            <b>Tire+Trim Gel Plastic and Rubber High-Glo…</b>
            <small>$24.99</small>
          </span>
          <Icon name="chevron" />
        </SourceLink>
        <div className={styles.videoTimeline}>
          <button
            className="icon-button"
            aria-label="Video playback unavailable"
            onClick={() => setNotice(true)}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="4" y="3" width="6" height="18" rx=".5" />
              <rect x="14" y="3" width="6" height="18" rx=".5" />
            </svg>
          </button>
          <span className={styles.videoTrack} aria-hidden="true" />
        </div>
      </div>
      <Sheet
        open={notice}
        title="Video preview"
        onClose={() => setNotice(false)}
      >
        <p className="sheet-copy">
          This captured video frame is available. The matching motion and audio
          asset is not available.
        </p>
      </Sheet>
    </ShopSurface>
  );
}
