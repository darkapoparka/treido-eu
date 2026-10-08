"use client";
/* eslint-disable @next/next/no-img-element -- Actual published category listing photos. */
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { getCategory } from "@treido/contracts/categories";
import type { Store } from "../catalog/types";
import { discoverySearchParams } from "../catalog/discovery-input";
import { LibraryProvider, useBuyerLibrary } from "../library/provider";
import { ListingSaveButton } from "../library/controls";
import { PublicServiceInfo } from "../seller-settings/public-info";
import type { PublicStoreView } from "./public-store-model";
import {
  MerchantShell,
  MerchantHeader,
  MerchantIdentity,
  MerchantAvatar,
} from "./native-merchant-chrome";
import { MerchantFollowIcon } from "./merchant-follow-icon";
import { NativeIcon } from "./native-icons";
import { SourceLink, ContextualCloseLink } from "./return-navigation";
import { useSearchDraft } from "./search-draft";
import { useDiscovery } from "./state";
import { FloatingNav, IconButton, ProductCard, Sheet } from "./components";
import { PublicListingGrid } from "./public-listing-grid";
import { PublicSearchFilters } from "./public-search-filters";
import { BuyerAvailability } from "./buyer-availability";
import { PurchaseFeedback } from "./purchase-feedback";
import { publicSearchQuery } from "./public-search-model";
import type { PromotionPlacement } from "../promotions/placement";
import { useSponsoredObservation } from "./use-sponsored-observation";
import { ShopSurface } from "./hydration-boundary";
import "./buyer-surface.css";
import "./public-search-store.css";

export function PublicStore({
  view,
  kind,
}: {
  view: PublicStoreView;
  kind: "store" | "info" | "search";
}) {
  const ids = view.page?.items.map((item) => item.id) ?? [];
  return (
    <LibraryProvider
      query={{
        listingIds: ids,
        sellerIds: view.seller ? [view.seller.id] : [],
      }}
    >
      <PublishedMerchant view={view} kind={kind} />
    </LibraryProvider>
  );
}

/** Genuine seller facts use the existing native merchant owners and geometry.
 * No captured theme/artwork/rating/collection/policy or Catalog is supplied. */
function PublishedMerchant({
  view,
  kind,
}: {
  view: PublicStoreView;
  kind: "store" | "info" | "search";
}) {
  const locale = useLocale(),
    ui = useTranslations("discoveryUI"),
    t = useTranslations("marketplace"),
    router = useRouter();
  const params = useSearchParams();
  const { viewStore } = useDiscovery();
  const [filters, setFilters] = useState(false),
    [more, setMore] = useState(false),
    [report, setReport] = useState(false);
  const seller = view.seller;
  const editor = useSearchDraft(
    `store-search:${seller?.id ?? "unavailable"}`,
    params.get("q") ?? "",
  );
  useEffect(() => {
    if (seller) viewStore(seller.id);
  }, [seller, viewStore]);
  if (!seller)
    return (
      <ShopSurface
        className={`shop-page android-live native-merchant native-merchant-${kind} buyer-public`}
        data-merchant-source="published"
      >
        <BuyerAvailability unavailable />
        <FloatingNav android nativeIcons back fade />
      </ShopSurface>
    );
  const items = view.page?.items ?? [];
  // This small presentation projection contains actual identity plus absence of
  // optional brand facts; it never carries snapshot commerce/catalogue data.
  const store: Store = {
    id: seller.id,
    name: seller.name,
    logo: "",
    description: seller.description,
    ratingCount: "",
    categories: [],
  };
  const categories = (view.page?.facets.categories ?? []).flatMap((facet) => {
    const category = getCategory(facet.value);
    if (!category) return [];
    const query = discoverySearchParams({
      ...view.input,
      q: "",
      category: category.id,
      attributes: {},
    });
    return [
      {
        id: category.id,
        title: category.labels[locale],
        count: facet.count,
        href: `/stores/${seller.id}/search?${query}`,
        photo: items.find((item) => item.categoryId === category.id)?.images[0],
      },
    ];
  });
  function submit(query: string) {
    editor.update({ draft: query.trim(), editing: false });
    router.push(
      `/stores/${seller!.id}/search?${publicSearchQuery(view.input, query)}`,
    );
  }
  const grid = (
    <>
      {view.unavailable || !items.length ? (
        <BuyerAvailability unavailable={view.unavailable} />
      ) : (
        <div className="product-grid">
          {(
            view.page?.placements ??
            items.map((listing) => ({ listing, sponsored: null }))
          ).map((placement) => (
            <PublishedMerchantListing
              key={placement.listing.id}
              placement={placement}
            />
          ))}
        </div>
      )}
      {view.page?.cursorReset && <p role="status">{t("cursorReset")}</p>}
      {view.page?.nextCursor && (
        <nav aria-label={t("pagination")}>
          <SourceLink
            preserveDiscoveryContext={false}
            className="pill"
            href={`/stores/${seller.id}/${kind === "search" ? "search" : ""}?${discoverySearchParams(view.input, view.page.nextCursor)}`}
          >
            {t("next")}
          </SourceLink>
        </nav>
      )}
    </>
  );
  return (
    <MerchantShell store={store} kind={kind} publicData>
      {kind === "search" ? (
        <>
          <header className="native-merchant-search-header">
            <form
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                submit(editor.draft);
              }}
            >
              <NativeIcon name="search" />
              <input
                type="search"
                maxLength={120}
                aria-label={ui("searchValue1", { value1: seller.name })}
                placeholder={ui("searchThisStore")}
                value={editor.draft}
                onChange={(event) =>
                  editor.update({ draft: event.target.value, editing: true })
                }
              />
              {editor.draft && (
                <button
                  type="button"
                  aria-label={ui("clearSearch")}
                  data-ui-label="clearSearch"
                  onClick={() => submit("")}
                >
                  <NativeIcon name="close" />
                </button>
              )}
            </form>
            <ContextualCloseLink
              href={`/stores/${seller.id}`}
              aria-label={ui("closeStoreSearch")}
              className="icon-button"
              data-ui-label="closeStoreSearch"
            >
              <NativeIcon name="close" />
            </ContextualCloseLink>
          </header>
          <h1 className="native-merchant-search-title">{seller.name}</h1>
          {view.page && (
            <p className="native-merchant-search-count" role="status">
              {t("results", { count: view.page.total })}
            </p>
          )}
          <div className="store-grid-heading">
            <h2>{ui("allProducts")}</h2>
            <IconButton
              icon="filter-circles"
              label={ui("filterStoreProducts")}
              onClick={() => setFilters(true)}
              data-ui-label="filterStoreProducts"
            />
          </div>
          {grid}
        </>
      ) : (
        <>
          <MerchantHeader
            store={store}
            profile={kind === "info"}
            followControl={<PublishedMerchantFollow id={seller.id} />}
          />
          {kind === "info" ? (
            <>
              <MerchantIdentity store={store} />
              {view.unavailable && (
                <div className="native-merchant-panel">
                  <BuyerAvailability unavailable />
                </div>
              )}
              {seller.description && (
                <>
                  <p
                    className="native-merchant-description"
                    data-expanded={more}
                  >
                    {seller.description}
                  </p>
                  {seller.description.length > 220 && (
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
                >
                  {categories.map((category) => (
                    <SourceLink
                      key={category.id}
                      className="native-merchant-collection-tile"
                      href={category.href}
                    >
                      {category.photo && <img src={category.photo} alt="" />}
                      <span>{category.title}</span>
                    </SourceLink>
                  ))}
                </nav>
              )}
              <section className="native-merchant-panel native-merchant-links">
                <h2>{t("about")}</h2>
                <p>
                  {t(seller.kind)}
                  {seller.locality ? ` · ${seller.locality}` : ""}
                  {seller.country ? ` · ${seller.country}` : ""}
                </p>
                <PublicServiceInfo services={seller.services} />
              </section>
              <div className="native-merchant-panel">
                <PurchaseFeedback
                  data={
                    view.purchaseFeedback ?? {
                      available: false,
                      items: [],
                      more: false,
                      page: 0,
                    }
                  }
                  sellerId={seller.id}
                  locale={locale}
                  onRetry={() => {
                    if (params.has("feedbackPage"))
                      router.replace(
                        `/stores/${seller.id}/info?lang=${locale}`,
                      );
                    else router.refresh();
                  }}
                />
              </div>
              <SourceLink
                className="native-merchant-panel native-merchant-external"
                href={`/stores/${seller.id}`}
              >
                {ui("shopAll")}
                <NativeIcon name="arrow" />
              </SourceLink>
              <button
                className="native-merchant-panel native-merchant-external"
                onClick={() => setReport(true)}
              >
                {ui("report")}
                <NativeIcon name="alert" />
              </button>
            </>
          ) : (
            <>
              <section className="native-merchant-brand">
                <h1>
                  <MerchantAvatar store={store} />
                  <span>{seller.name}</span>
                </h1>
              </section>
              <nav
                className="native-merchant-categories"
                aria-label={ui("storeCategories")}
              >
                <a className="native-merchant-category" href="#all-products">
                  <NativeIcon name="storefront" />
                  <span>{ui("shopAll")}</span>
                </a>
                {categories.map((category) => (
                  <SourceLink
                    key={category.id}
                    className="native-merchant-category"
                    href={category.href}
                  >
                    {category.photo ? (
                      <img src={category.photo} alt="" />
                    ) : (
                      <NativeIcon name="storefront" />
                    )}
                    <span>{category.title}</span>
                  </SourceLink>
                ))}
              </nav>
              {!!items.length && (
                <section className="native-merchant-panel native-merchant-featured">
                  <h2>{ui("products")}</h2>
                  <PublicListingGrid
                    items={items}
                    placements={view.page?.placements}
                    rail
                    shelf
                  />
                </section>
              )}
              <section id="all-products" className="native-merchant-products">
                <div className="store-grid-heading">
                  <h2>{ui("allProducts")}</h2>
                  <IconButton
                    icon="filter-circles"
                    label={ui("filterStoreProducts")}
                    onClick={() => setFilters(true)}
                    data-ui-label="filterStoreProducts"
                  />
                </div>
                {grid}
              </section>
            </>
          )}
        </>
      )}
      <FloatingNav android nativeIcons back fade />
      <Sheet
        open={report}
        title={ui("reportStore")}
        onClose={() => setReport(false)}
      >
        <p className="sheet-copy">
          {locale === "bg"
            ? "Сигналите за продавачи още не са свързани. Няма да бъде изпратен сигнал."
            : "Seller reporting is not connected yet. No report will be submitted."}
        </p>
        <button className="primary" onClick={() => setReport(false)}>
          {ui("close")}
        </button>
      </Sheet>
      <PublicSearchFilters
        open={filters}
        onClose={() => setFilters(false)}
        onReopen={() => setFilters(true)}
        input={view.input}
        page={view.page}
        sellerKind={seller.kind}
        onApply={(next) =>
          router.push(
            `/stores/${seller.id}/${kind === "search" ? "search" : ""}?${next}`,
          )
        }
      />
    </MerchantShell>
  );
}
function PublishedMerchantFollow({ id }: { id: string }) {
  const library = useBuyerLibrary(),
    ui = useTranslations("discoveryUI"),
    text = useTranslations("library");
  const following = library.view?.followedIds.includes(id) ?? false,
    known = library.status === "ready" || library.status === "guest";
  return (
    <button
      className="pill native-merchant-follow"
      type="button"
      aria-pressed={known ? following : undefined}
      aria-label={
        known ? ui(following ? "unfollow" : "follow") : text("stateUnavailable")
      }
      data-following={following}
      disabled={!known || library.busy}
      onClick={() =>
        void library.execute({
          kind: "follow",
          sellerId: id,
          followed: !following,
        })
      }
    >
      {following ? <MerchantFollowIcon /> : ui("follow")}
    </button>
  );
}
function PublishedMerchantListing({
  placement,
}: {
  placement: PromotionPlacement;
}) {
  const { listing, sponsored } = placement,
    locale = useLocale();
  const observation = useSponsoredObservation<HTMLElement>(
    sponsored?.token,
    listing.id,
  );
  const product = sponsored
    ? {
        ...listing,
        promotion: locale === "bg" ? sponsored.labelBg : sponsored.label,
      }
    : listing;
  return (
    <ProductCard
      product={product}
      showRating={false}
      showPromotion={!!sponsored}
      observation={observation}
      saveControl={<ListingSaveButton id={listing.id} title={listing.title} />}
    />
  );
}
