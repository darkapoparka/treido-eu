"use client";
import { PublicServiceInfo } from "../seller-settings/public-info";
import { LibraryProvider } from "../library/provider";
import { SellerFollowButton } from "../library/controls";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useLocale as useNavigationLocale } from "../locale/provider";
import {
  browseCategoryRoots,
  getBrowseCategory,
  getBrowseAncestry,
  getBrowseChildren,
  getBrowseLeafIds,
} from "@treido/contracts/categories";
import {
  discoverySearchParams,
  discoverySorts,
  readDiscoveryInput,
  type DiscoveryInput,
} from "../catalog/discovery-input";
import type {
  PublicDiscoveryPage,
  PublicSeller,
} from "../catalog/public-discovery-model";
import { ShopSurface } from "./hydration-boundary";
import { BrowseScopeControl } from "./browse-scope";
import { FloatingNav, IconButton, consumeSheetHistory } from "./components";
import { ContextualCloseLink, SourceLink } from "./return-navigation";
import {
  HomeShortcuts,
  SearchComposer,
  SearchFilterStrip,
} from "./buyer-chrome";
import { Icon } from "./icons";
import { optionLabel } from "../selling/copy";
import { PublicListingGrid } from "./public-listing-grid";
import { PublicHome } from "./public-home";
import {
  PurchaseFeedback,
  type PurchaseFeedbackData,
} from "./purchase-feedback";
import { MarketplaceFilters } from "./marketplace-filters";
import {
  marketplaceHref,
  withoutDiscoveryFilters,
} from "./marketplace-navigation";
import s from "./marketplace.module.css";
import chrome from "./buyer-chrome.module.css";

export function Marketplace(props: Parameters<typeof MarketplaceContent>[0]) {
  const items = props.page?.items ?? [];
  return (
    <LibraryProvider
      query={{
        view: "state",
        listingIds: items.map((item) => item.id),
        sellerIds: [
          ...new Set([
            ...items.map((item) => item.seller.id),
            ...(props.seller ? [props.seller.id] : []),
          ]),
        ],
      }}
    >
      <MarketplaceContent {...props} />
    </LibraryProvider>
  );
}
function MarketplaceContent({
  input,
  page,
  home = false,
  seller,
  info = false,
  unavailable = false,
  purchaseFeedback,
}: {
  input: DiscoveryInput;
  page?: PublicDiscoveryPage;
  home?: boolean;
  seller?: PublicSeller;
  info?: boolean;
  unavailable?: boolean;
  purchaseFeedback?: PurchaseFeedbackData;
}) {
  const locale = useLocale(),
    t = useTranslations("marketplace"),
    router = useRouter();
  const libraryCopy = useTranslations("library");
  const { messages: navigationMessages } = useNavigationLocale();
  const cartText = useTranslations("buyerCart");
  const pathname = usePathname(),
    params = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [shareStatus, setShareStatus] = useState("");
  const destination = seller ? "/stores/" + seller.id + "/search" : "/search";
  const sellerHref = seller ? "/stores/" + seller.id + "?lang=" + locale : "";
  const reset = {
    ...withoutDiscoveryFilters(input),
    q: "",
    seller: "all" as const,
  };
  const hasFilters = !!(
    input.seller !== "all" ||
    input.category ||
    input.condition ||
    input.location ||
    input.minPriceMinor !== null ||
    input.maxPriceMinor !== null ||
    Object.keys(input.attributes).length
  );
  const globalSearch = !home && !seller;
  const resultsMode = !!input.q || hasFilters;
  const searchForm = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    const form = searchForm.current;
    if (!globalSearch || resultsMode || !viewport || !form) return;
    const surface = form.closest("[data-marketplace]");
    const sync = () => {
      const inset = form.contains(document.activeElement)
        ? Math.max(0, innerHeight - viewport.height - viewport.offsetTop)
        : 0;
      form.style.setProperty("--search-keyboard-inset", `${inset}px`);
      surface?.toggleAttribute("data-buyer-keyboard", inset > 80);
    };
    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    form.addEventListener("focusin", sync);
    form.addEventListener("focusout", sync);
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
      form.removeEventListener("focusin", sync);
      form.removeEventListener("focusout", sync);
      form.style.removeProperty("--search-keyboard-inset");
      surface?.removeAttribute("data-buyer-keyboard");
    };
  }, [globalSearch, resultsMode]);
  function navigate(next: URLSearchParams) {
    next.delete("cursor");
    next.set("lang", locale);
    const nextInput = readDiscoveryInput(next).input;
    const replace = consumeSheetHistory();
    setFiltersOpen(false);
    startTransition(() =>
      replace
        ? router.replace(marketplaceHref(destination, nextInput))
        : router.push(marketplaceHref(destination, nextInput)),
    );
  }
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = discoverySearchParams(input);
    next.set("q", String(new FormData(event.currentTarget).get("q") ?? ""));
    navigate(next);
  }
  const category = input.category ? getBrowseCategory(input.category) : null;
  const categories =
    category && category.kind !== "leaf"
      ? getBrowseChildren(category.id)
      : category?.kind === "leaf"
        ? []
        : browseCategoryRoots;
  const countFor = (id: string) =>
    (page?.facets.categories ?? []).reduce(
      (sum, facet) =>
        sum +
        (getBrowseLeafIds(id).some((leafId) => leafId === facet.value)
          ? facet.count
          : 0),
      0,
    );
  const remove = (key: string) => {
    const next = discoverySearchParams(input);
    next.delete(key);
    if (key === "category")
      for (const field of [...next.keys()])
        if (field.startsWith("attr.")) next.delete(field);
    if (key === "minPrice" || key === "maxPrice") {
      next.delete("minPrice");
      next.delete("maxPrice");
    }
    navigate(next);
  };
  const chips = [
    ...(home && input.q ? [{ key: "q", label: input.q }] : []),
    ...(category ? [{ key: "category", label: category.labels[locale] }] : []),
    ...(input.condition
      ? [{ key: "condition", label: optionLabel(input.condition, locale) }]
      : []),
    ...(input.location ? [{ key: "location", label: input.location }] : []),
    ...(input.minPriceMinor !== null || input.maxPriceMinor !== null
      ? [{ key: "minPrice", label: t("priceRange") }]
      : []),
    ...Object.keys(input.attributes).map((field) => ({
      key: "attr." + field,
      label:
        category?.kind === "leaf"
          ? (category.profile.fields.find((item) => item.id === field)?.labels[
              locale
            ] ?? field)
          : field,
    })),
  ];
  return (
    <ShopSurface
      className={
        "shop-page " +
        (home
          ? "home-page " + chrome.home + " "
          : globalSearch
            ? "search-page " + chrome.search + " "
            : "") +
        s.page
      }
      data-marketplace
      data-seller-id={seller?.id}
      data-marketplace-search-mode={
        globalSearch ? (resultsMode ? "results" : "root") : undefined
      }
    >
      {home && <h1 className="sr-only">{t("home")}</h1>}
      {home ? (
        <HomeShortcuts>
          <SourceLink
            href={"/profile?lang=" + locale}
            aria-label={navigationMessages.navigation.profile}
            className="avatar"
          >
            <svg
              className="android-guest-avatar"
              viewBox="0 0 40 40"
              aria-hidden="true"
            >
              <circle cx="20" cy="14" r="6" fill="white" />
              <path d="M8 32c1-9 23-9 24 0a17 17 0 0 1-24 0Z" fill="white" />
            </svg>
          </SourceLink>
          <SourceLink
            href={"/notifications?lang=" + locale}
            className="icon-button"
            aria-label={navigationMessages.navigation.notifications}
          >
            <Icon name="bell" filled />
          </SourceLink>
          <BrowseScopeControl />
          <SourceLink className="pill" href={"/deals?lang=" + locale}>
            <Icon name="tag" filled />
            {navigationMessages.navigation.deals}
          </SourceLink>
          <SourceLink
            className="pill"
            href={"/following?lang=" + locale}
            preserveDiscoveryContext={false}
          >
            <span className="following-shortcut-icon">
              <Icon name="badge-check" filled />
            </span>
            {libraryCopy("following")}
          </SourceLink>
          <SourceLink
            className="pill"
            href={"/saved?lang=" + locale}
            preserveDiscoveryContext={false}
          >
            <Icon name="heart" filled />
            {libraryCopy("saved")}
          </SourceLink>
          <SourceLink className="pill" href={"/minis?lang=" + locale}>
            <Icon name="minis" filled />
            {navigationMessages.navigation.minis}
          </SourceLink>
        </HomeShortcuts>
      ) : seller ? (
        <HomeShortcuts className={s.shortcuts}>
          <SourceLink
            href={"/app?lang=" + locale}
            className="avatar"
            aria-label={t("selling")}
          >
            <Icon name="storefront" />
          </SourceLink>
          {!seller && <BrowseScopeControl />}
          {home && (
            <SourceLink className="pill" href={"/deals?lang=" + locale}>
              <Icon name="tag" filled />
              {navigationMessages.navigation.deals}
            </SourceLink>
          )}
          <SourceLink className="pill" href={"/cart?lang=" + locale}>
            {cartText("title")}
          </SourceLink>
          <SourceLink
            className="pill"
            href={"/saved?lang=" + locale}
            preserveDiscoveryContext={false}
          >
            <Icon name="heart" />
            {libraryCopy("saved")}
          </SourceLink>
          <SourceLink
            className="pill"
            href={"/following?lang=" + locale}
            preserveDiscoveryContext={false}
          >
            <Icon name="storefront" />
            {libraryCopy("following")}
          </SourceLink>
          {home && (
            <SourceLink className="pill" href={"/minis?lang=" + locale}>
              <Icon name="minis" filled />
              {navigationMessages.navigation.minis}
            </SourceLink>
          )}
          <SourceLink className="pill" href={"/messages?lang=" + locale}>
            <Icon name="chat-round" />
            {t("messages")}
          </SourceLink>
          <SourceLink className="pill" href={"/app?lang=" + locale}>
            <Icon name="plus" />
            {t("sell")}
          </SourceLink>
          {seller && (
            <IconButton
              icon="share"
              label={t("share")}
              onClick={async () => {
                try {
                  const url = location.origin + sellerHref;
                  if (navigator.share)
                    await navigator.share({ title: seller.name, url });
                  else {
                    await navigator.clipboard.writeText(url);
                    setShareStatus(t("copied"));
                  }
                } catch (error) {
                  if (!(
                    error instanceof DOMException && error.name === "AbortError"
                  ))
                    setShareStatus(t("shareFailed"));
                }
              }}
            />
          )}
        </HomeShortcuts>
      ) : null}
      {seller && (
        <section className={s.sellerHeader}>
          <span
            className={"store-logo-fallback " + s.monogram}
            aria-hidden="true"
          >
            {Array.from(seller.name)[0]}
          </span>
          <h1>{seller.name}</h1>
          <p>
            {t(seller.kind)}
            {seller.locality ? " · " + seller.locality : ""}
          </p>
          {!!seller.description && !info && (
            <p className={s.description}>{seller.description}</p>
          )}
          <SellerFollowButton id={seller.id} />
          <nav className={s.tabs} aria-label={t("viewSeller")}>
            <SourceLink
              href={sellerHref}
              preserveDiscoveryContext={false}
              className="pill"
              aria-current={!info ? "page" : undefined}
            >
              {t("listings")}
            </SourceLink>
            <SourceLink
              href={"/stores/" + seller.id + "/info?lang=" + locale}
              preserveDiscoveryContext={false}
              className="pill"
              aria-current={info ? "page" : undefined}
            >
              {t("about")}
            </SourceLink>
          </nav>
          {shareStatus && <p role="status">{shareStatus}</p>}
        </section>
      )}
      {info && seller ? (
        <section className={s.info}>
          <h2>{t("about")}</h2>
          {seller.description && (
            <p className={s.description}>{seller.description}</p>
          )}
          <dl>
            <div>
              <dt>{t("sellerType")}</dt>
              <dd>{t(seller.kind)}</dd>
            </div>
            {seller.locality && (
              <div>
                <dt>{t("location")}</dt>
                <dd>{seller.locality}</dd>
              </div>
            )}
            <div>
              <dt>{t("country")}</dt>
              <dd>{t("bulgaria")}</dd>
            </div>
          </dl>
          <PublicServiceInfo services={seller.services} />
          <PurchaseFeedback
            data={
              purchaseFeedback ?? {
                available: false,
                items: [],
                more: false,
                page: 0,
              }
            }
            sellerId={seller.id}
            locale={locale === "en" ? "en" : "bg"}
            onRetry={() =>
              startTransition(() => {
                if (params.has("feedbackPage"))
                  router.replace(`/stores/${seller.id}/info?lang=${locale}`);
                else router.refresh();
              })
            }
          />
          <p>{t("sellerNote")}</p>
          <SourceLink
            href={sellerHref}
            preserveDiscoveryContext={false}
            className="primary"
          >
            {t("browseSeller")}
          </SourceLink>
        </section>
      ) : (
        <>
          {globalSearch && !resultsMode && (
            <ContextualCloseLink
              href={"/?lang=" + locale}
              className={chrome.close}
              aria-label={navigationMessages.navigation.back}
            >
              <Icon name="close" />
            </ContextualCloseLink>
          )}
          {!home && (
            <div className={globalSearch ? s.searchToolbar : s.toolbar}>
              <SearchComposer
                ref={searchForm}
                className={
                  "search-form " +
                  (globalSearch
                    ? (resultsMode ? "top-search " : "search-composer ") +
                      chrome.composer
                    : "")
                }
                onSubmit={search}
                role="search"
                action={destination}
              >
                <Icon name="search" />
                <input
                  key={input.q}
                  name="q"
                  type="search"
                  maxLength={120}
                  defaultValue={input.q}
                  placeholder={t(seller ? "searchStore" : "placeholder")}
                  aria-label={t("search")}
                />
                <button
                  type="submit"
                  className="icon-button"
                  aria-label={t("submit")}
                >
                  <Icon name="arrow" />
                </button>
              </SearchComposer>
              {!globalSearch && (
                <IconButton
                  icon="filter-circles"
                  label={t("filters")}
                  onClick={() => setFiltersOpen(true)}
                  aria-expanded={filtersOpen}
                  aria-haspopup="dialog"
                />
              )}
            </div>
          )}
          {globalSearch && !resultsMode && <h1>{t("search")}</h1>}
          {globalSearch && (
            <SearchFilterStrip className={chrome.strip}>
              <button
                type="button"
                className="icon-button"
                aria-label={t("filters")}
                aria-expanded={filtersOpen}
                aria-haspopup="dialog"
                onClick={() => setFiltersOpen(true)}
              >
                <Icon name="filter-circles" />
              </button>
              <BrowseScopeControl />
              {!!categories.length && (
                <nav aria-label={t("browse")}>
                  {categories.map((item) => (
                    <SourceLink
                      key={item.id}
                      className="pill"
                      preserveDiscoveryContext={false}
                      startAtTop
                      href={marketplaceHref(destination, {
                        ...input,
                        category: item.id,
                        attributes: {},
                      })}
                    >
                      {item.labels[locale]}
                      {countFor(item.id) > 0 && (
                        <span className={s.count}>{countFor(item.id)}</span>
                      )}
                    </SourceLink>
                  ))}
                </nav>
              )}
            </SearchFilterStrip>
          )}
          {!home && !globalSearch && !!categories.length && (
            <nav className={s.categories} aria-label={t("browse")}>
              {categories.map((item) => (
                <SourceLink
                  key={item.id}
                  className="pill"
                  preserveDiscoveryContext={false}
                  startAtTop
                  href={marketplaceHref(destination, {
                    ...input,
                    category: item.id,
                    attributes: {},
                  })}
                >
                  {item.labels[locale]}
                  {countFor(item.id) > 0 && (
                    <span className={s.count}>{countFor(item.id)}</span>
                  )}
                </SourceLink>
              ))}
            </nav>
          )}
          {category && (
            <nav className={s.breadcrumbs} aria-label={t("category")}>
              <SourceLink
                href={marketplaceHref(destination, {
                  ...input,
                  category: null,
                  attributes: {},
                })}
                preserveDiscoveryContext={false}
              >
                {t("allCategories")}
              </SourceLink>
              {getBrowseAncestry(category.id).map((item) => (
                <SourceLink
                  key={item.id}
                  href={marketplaceHref(destination, {
                    ...input,
                    category: item.id,
                    attributes: {},
                  })}
                  preserveDiscoveryContext={false}
                >
                  <Icon name="chevron" />
                  {item.labels[locale]}
                </SourceLink>
              ))}
            </nav>
          )}
          {chips.length > 0 && (
            <div className={s.chips}>
              {chips.map((chip) => (
                <button
                  className="pill"
                  key={chip.key}
                  aria-label={t("remove", { filter: chip.label })}
                  onClick={() => remove(chip.key)}
                >
                  {chip.label}
                  <Icon name="close" />
                </button>
              ))}
              <button
                className="pill"
                onClick={() =>
                  navigate(
                    discoverySearchParams(withoutDiscoveryFilters(input)),
                  )
                }
              >
                {t("clear")}
              </button>
            </div>
          )}
          {(!home || chips.length > 0) && (
            <div className={s.resultsHeading}>
              <h2>
                {unavailable
                  ? t("search")
                  : home && !input.q && !hasFilters
                    ? t("latest")
                    : t("results", { count: page?.total ?? 0 })}
              </h2>
              <label className={s.sort}>
                <span className="sr-only">{t("sort")}</span>
                <select
                  value={input.sort}
                  onChange={(event) => {
                    const next = discoverySearchParams(input);
                    next.set("sort", event.target.value);
                    navigate(next);
                  }}
                >
                  {discoverySorts.map((sort) => (
                    <option value={sort} key={sort}>
                      {t(sort)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <div
            role="status"
            aria-live="polite"
            className={pending ? s.status : "sr-only"}
          >
            {pending
              ? t("loading")
              : page
                ? t("results", { count: page.total })
                : ""}
          </div>
          {page?.cursorReset && (
            <p role="status" className={s.status}>
              {t("cursorReset")}
            </p>
          )}
          <section aria-busy={pending} className={s.results}>
            {unavailable ? (
              <div className="empty-state">
                <Icon name="alert" />
                <h2>{t("unavailableTitle")}</h2>
                <p>{t("unavailable")}</p>
                <button
                  className="primary"
                  onClick={() => startTransition(() => router.refresh())}
                >
                  {t("retry")}
                </button>
              </div>
            ) : page?.items.length ? (
              home ? (
                <PublicHome page={page} />
              ) : (
                <PublicListingGrid
                  items={page.items}
                  placements={page.placements}
                />
              )
            ) : (
              <div className="empty-state">
                <Icon name="search" />
                <h2>{t("emptyTitle")}</h2>
                <p>{t(input.q || hasFilters ? "emptySearch" : "emptyHome")}</p>
                {input.q || hasFilters ? (
                  <SourceLink
                    className="pill"
                    href={marketplaceHref(destination, reset)}
                    preserveDiscoveryContext={false}
                    startAtTop
                  >
                    {t("resetSearch")}
                  </SourceLink>
                ) : (
                  <SourceLink className="primary" href={"/app?lang=" + locale}>
                    {t("sell")}
                  </SourceLink>
                )}
              </div>
            )}
          </section>
          {!unavailable && (page?.nextCursor || params.has("cursor")) && (
            <nav className={s.pagination} aria-label={t("pagination")}>
              {params.has("cursor") && (
                <SourceLink
                  className="pill"
                  href={marketplaceHref(pathname, input)}
                  preserveDiscoveryContext={false}
                  startAtTop
                >
                  {t("first")}
                </SourceLink>
              )}
              {page?.nextCursor && (
                <SourceLink
                  className="primary"
                  href={marketplaceHref(pathname, input, page.nextCursor)}
                  preserveDiscoveryContext={false}
                  startAtTop
                >
                  {t("next")}
                  <Icon name="arrow" />
                </SourceLink>
              )}
            </nav>
          )}
          {filtersOpen && (
            <MarketplaceFilters
              sellerKind={seller?.kind}
              input={input}
              onApply={navigate}
              onClose={() => setFiltersOpen(false)}
            />
          )}
        </>
      )}
      <FloatingNav
        back={globalSearch ? resultsMode || pending : !home}
        marketplace
        nativeIcons={!seller}
      />
    </ShopSurface>
  );
}
