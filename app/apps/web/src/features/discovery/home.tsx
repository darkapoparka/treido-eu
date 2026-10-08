"use client";
import { displayCount, displayRating } from "../locale/number-display";
import { useLocale as useIntlLocale } from "next-intl";
import { useTranslations } from "next-intl";
import { BuyerSurface } from "./buyer-surface";
import type { BuyerEntryData } from "../catalog/buyer-entry-model";
import { LibraryProvider } from "../library/provider";
import { PublicHome } from "./public-home";
import { PublicHomeContext } from "./public-home-context";
import { getBrowseCategory } from "@treido/contracts/categories";
import { BuyerAvailability } from "./buyer-availability";
import { marketplaceHref } from "./marketplace-navigation";
import { HomeShortcuts } from "./buyer-chrome";
/* eslint-disable @next/next/no-img-element */
import { rememberSourceReturn, SourceLink } from "./return-navigation";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatMoney } from "../catalog/types";
import { FloatingNav, IconButton, ProductCard, StoreRow } from "./components";
import { HomeCampaigns } from "./home-campaigns";
import { HomeMerchantShelves } from "./home-merchant-shelves";
import { ShopOptionsMenu, type ShopMenuStage } from "./shop-options-menu";
import { RecentSearchItems } from "./search-recent";
import { Icon } from "./icons";
import { useDiscovery } from "./state";
import { useAccount } from "../account/state";
import { CartOverlay } from "../commerce/checkout";
import { readDiscoveryInput } from "../catalog/discovery-input";
import { BrowseScopeControl, BrowseScopeUnavailable } from "./browse-scope";
import { useLocale } from "../locale/provider";
import { localeDestination, parseLocale } from "../locale/locale";
export function Home(props: BuyerEntryData) {
  const items = props.publicView?.page?.items ?? [];
  return props.publicView ? (
    <LibraryProvider
      query={{
        view: "state",
        listingIds: items.map((item) => item.id),
        sellerIds: [...new Set(items.map((item) => item.seller.id))],
      }}
    >
      <HomeContent {...props} />
    </LibraryProvider>
  ) : (
    <HomeContent {...props} />
  );
}
function HomeContent({ catalog, publicView }: BuyerEntryData) {
  const intlLocale = useIntlLocale();
  const ui = useTranslations("discoveryUI");
  const market = useTranslations("marketplace");
  const router = useRouter();
  const params = useSearchParams();
  const { messages } = useLocale();
  const text = messages.navigation;
  const scoped =
    readDiscoveryInput(new URLSearchParams(params)).input.seller !== "all";
  const state = useDiscovery(),
    { profile } = useAccount();
  // Different recorded journeys share these same feed components; only their data/order changes.
  const returning = !publicView && params.get("journey") === "returning";
  const requestedFeed = publicView ? null : params.get("feed");
  const nativeHome =
    !!publicView ||
    (!!catalog?.liveHomeStoreIds?.length &&
      !returning &&
      !requestedFeed &&
      params.get("reference") !== "captured");
  const puraOptionsHistory = requestedFeed === "pura-options";
  const [cartOpen, setCartOpen] = useState(false);
  const recentProducts =
    !nativeHome &&
    !returning &&
    (requestedFeed === "recent-products" ||
      (!requestedFeed && state.recentActivity === "products"));
  const recentStores =
    !nativeHome &&
    !returning &&
    (requestedFeed === "recent-stores" ||
      (!requestedFeed && state.recentActivity === "stores"));
  const showCart = puraOptionsHistory || recentStores;
  const tracking =
    !nativeHome &&
    (returning ||
      requestedFeed === "tracking" ||
      (!!profile.firstName && !!profile.lastName));
  const [hasScrolled, setHasScrolled] = useState(false);
  useEffect(() => {
    const observeScroll = () => {
      if (window.scrollY > 16) setHasScrolled(true);
    };
    observeScroll();
    window.addEventListener("scroll", observeScroll, { passive: true });
    return () => window.removeEventListener("scroll", observeScroll);
  }, []);
  const [shopMenu, setShopMenu] = useState("");
  const lastShopMenu = useRef("");
  const [shopStage, setShopStage] = useState<ShopMenuStage>("menu");
  const [hidden, setHidden] = useState<string[]>([]);
  const menuStore = (catalog?.stores ?? []).find(
    (store) => store.id === shopMenu,
  );
  function closeShopMenu() {
    setShopMenu("");
    setShopStage("menu");
  }
  const recent = state.viewedProducts
    .flatMap((id) => {
      const p = (catalog?.products ?? []).find((p) => p.id === id);
      return p ? [p] : [];
    })
    .slice(0, 3);
  const nativeRecentProducts =
    nativeHome && params.get("home") === "recent" && recent.length > 0;
  return (
    <BuyerSurface
      publicData={!!publicView}
      className={`shop-page home-page ${returning ? "home-returning" : ""} ${nativeHome ? "android-live android-home" : ""}`}
      data-feed={
        returning
          ? "returning"
          : recentProducts
            ? "recent-products"
            : recentStores
              ? "recent-stores"
              : tracking
                ? "tracking"
                : "welcome"
      }
    >
      <HomeShortcuts>
        <SourceLink
          href="/profile"
          aria-label={text.profile}
          className="avatar"
        >
          {nativeHome && (!profile.avatar || !!publicView) ? (
            <svg
              className="android-guest-avatar"
              viewBox="0 0 40 40"
              aria-hidden="true"
            >
              <circle cx="20" cy="14" r="6" fill="white" />
              <path d="M8 32c1-9 23-9 24 0a17 17 0 0 1-24 0Z" fill="white" />
            </svg>
          ) : profile.avatar ? (
            <img src={profile.avatar} alt="" />
          ) : (
            <span>{profile.firstName[0] || "A"}</span>
          )}
        </SourceLink>
        <IconButton
          icon="bell"
          filled
          label={text.notifications}
          onClick={() => {
            const href = localeDestination(
              "/notifications",
              parseLocale(params.get("lang")),
            );
            rememberSourceReturn(href, ".home-shortcuts .icon-button");
            router.push(href);
          }}
        />
        <BrowseScopeControl />
        <SourceLink className="pill" href="/deals">
          <Icon name="tag" filled />
          {text.deals}
        </SourceLink>
        <SourceLink className="pill" href="/following">
          <span className="following-shortcut-icon">
            <Icon name="badge-check" filled />
            {(recentStores || recentProducts || nativeRecentProducts) && (
              <i aria-hidden="true" />
            )}
          </span>
          {text.following}
        </SourceLink>
        <SourceLink className="pill" href="/saved">
          <Icon name="heart" filled />
          {text.saved}
        </SourceLink>
        <SourceLink className="pill" href="/minis">
          <Icon name="minis" filled />
          {text.minis}
        </SourceLink>
      </HomeShortcuts>
      {tracking && catalog && (
        <SourceLink href="/orders" className="delivery-card">
          <img
            src={(catalog?.stores ?? []).find((s) => s.id === "kitsch")!.logo}
            alt=""
          />
          <span>
            <small>KITSCH</small>
            <strong>{ui("orderedJul27")}</strong>
          </span>
          <img
            src="/api/reference-media/shampoo-bag"
            alt={ui("shampooBarBag")}
          />
        </SourceLink>
      )}
      {!nativeHome && (
        <button
          className="email-card"
          onClick={() => {
            rememberSourceReturn(
              "/account/connections",
              ".home-page .email-card",
            );
            router.push("/account/connections");
          }}
        >
          <img src="/api/reference-media/parcel" alt="" />
          <span>
            <strong>{ui("connectEmailToSeeMoreDeliveries")}</strong>
            <span>{ui("trackMoreOfYourPackagesWithShop")}</span>
          </span>
          <Icon name="back" />
        </button>
      )}
      {recentStores && catalog && (
        <section
          className="recent-panel recent-stores-panel"
          aria-label={ui("recentlyViewedShops")}
          data-ui-label="recentlyViewedShops"
        >
          <p>{ui("jumpBackIn")}</p>
          <div className="recent-store-grid">
            <RecentSearchItems catalog={catalog} limit={4} surface="home" />
          </div>
          <SourceLink href="/search?view=recent" className="recent-title">
            <h1>{ui("recentlyViewed")}</h1>
            <Icon name="arrow" />
          </SourceLink>
        </section>
      )}
      {recentProducts && (
        <section
          className="recent-panel"
          aria-label={ui("recentlyViewedProducts")}
          data-ui-label="recentlyViewedProducts"
        >
          <p>{ui("jumpBackIn")}</p>
          <div className="product-rail">
            {recent.map((p) => (
              <ProductCard
                key={p.id}
                product={
                  p.id === "round-sunglasses"
                    ? { ...p, promotion: "Save $20" }
                    : p
                }
                compact
              />
            ))}
          </div>
          <SourceLink href="/search?view=recent" className="recent-title">
            <h1>{ui("recentlyViewed")}</h1>
            <Icon name="arrow" />
          </SourceLink>
        </section>
      )}
      {recentProducts &&
        catalog &&
        (catalog?.stores ?? [])
          .filter((s) => s.id === "vehla")
          .map((store) => (
            <section className="store-feed" key={store.id}>
              <StoreRow
                store={store}
                onMore={() => {
                  lastShopMenu.current = store.id;
                  setShopMenu(store.id);
                  setShopStage("menu");
                }}
              />
              {hidden.includes(store.id) ? (
                <div className="hidden-shop">
                  <Icon name="eye-off" />
                  <p>{ui("weLlShowYouLessLikeThis")}</p>
                  <button
                    onClick={() =>
                      setHidden((v) => v.filter((id) => id !== store.id))
                    }
                  >
                    {ui("undo")}
                  </button>
                </div>
              ) : (
                <div>
                  {(catalog?.products ?? [])
                    .filter((p) => p.storeId === store.id)
                    .slice(0, 1)
                    .map((p) => (
                      <div className="home-product-row" key={p.id}>
                        <ProductCard
                          product={
                            p.id === "round-sunglasses"
                              ? { ...p, promotion: "Save $20" }
                              : p
                          }
                          compact
                        />
                        <SourceLink href={`/products/${p.id}`}>
                          <strong>{p.title}</strong>
                          <p className="rating">
                            <span>★★★★★</span> (
                            {displayCount(p.ratingCount, intlLocale)})
                          </p>
                          <p>{formatMoney(p.price, intlLocale)}</p>
                        </SourceLink>
                      </div>
                    ))}
                </div>
              )}
            </section>
          ))}
      <ShopOptionsMenu
        open={!!shopMenu}
        store={menuStore}
        rating={
          menuStore
            ? `${displayRating(menuStore.rating, intlLocale)} ★ (${displayCount(menuStore.ratingCount, intlLocale)})`
            : undefined
        }
        stage={shopStage}
        onStageChange={setShopStage}
        onClose={closeShopMenu}
        onReopen={() => setShopMenu(lastShopMenu.current)}
        onHide={() => {
          if (shopMenu)
            setHidden((values) => [...new Set([...values, shopMenu])]);
          closeShopMenu();
        }}
      />
      {nativeRecentProducts && (
        <section
          className="android-merchant-card android-recent-panel"
          aria-label={ui("recentlyViewedProducts")}
          data-ui-label="recentlyViewedProducts"
        >
          <p>{ui("jumpBackIn")}</p>
          <div className="product-rail">
            {recent.map((product) => (
              <ProductCard key={product.id} product={product} compact />
            ))}
          </div>
          <SourceLink href="/search?view=recent" className="merchant-shop-all">
            <strong>{ui("recentlyViewed")}</strong>
            <span>
              <Icon name="arrow" />
            </span>
          </SourceLink>
        </section>
      )}
      {publicView && <PublicHomeContext input={publicView.input} />}
      {publicView ? (
        publicView.unavailable || !publicView.page?.items.length ? (
          <BuyerAvailability
            unavailable={publicView.unavailable}
            home
            categoryLabel={
              publicView.input.category
                ? getBrowseCategory(publicView.input.category)?.labels[
                    publicView.input.locale
                  ]
                : undefined
            }
          />
        ) : (
          <>
            <PublicHome page={publicView.page} />
            {publicView.page.nextCursor && (
              <SourceLink
                className="pill"
                preserveDiscoveryContext={false}
                href={marketplaceHref(
                  "/",
                  publicView.input,
                  publicView.page.nextCursor,
                )}
              >
                {market("next")}
              </SourceLink>
            )}
          </>
        )
      ) : scoped ? (
        <BrowseScopeUnavailable />
      ) : nativeHome && catalog ? (
        <HomeMerchantShelves
          catalog={catalog}
          hidden={hidden}
          recommendation={nativeRecentProducts ? recent[0] : undefined}
          onMore={(id) => {
            lastShopMenu.current = id;
            setShopMenu(id);
            setShopStage("menu");
          }}
          onUndo={(id) =>
            setHidden((values) => values.filter((value) => value !== id))
          }
        />
      ) : catalog ? (
        <HomeCampaigns
          catalog={catalog}
          productLayout={returning ? "grid" : "rail"}
          productOrder={tracking ? "tracking" : "welcome"}
          history={
            puraOptionsHistory
              ? "pura-options"
              : tracking && !recentProducts && !recentStores
                ? "tracking"
                : "welcome"
          }
        />
      ) : null}
      {!nativeHome &&
        !scoped &&
        !tracking &&
        !recentProducts &&
        !recentStores &&
        !hasScrolled && (
          <button
            className="home-keep-going"
            onClick={() => {
              setHasScrolled(true);
              const nextCampaign = document.querySelector<HTMLElement>(
                ".home-campaigns > .home-campaign:nth-child(2)",
              );
              if (nextCampaign) {
                window.scrollTo({
                  top:
                    window.scrollY +
                    nextCampaign.getBoundingClientRect().top -
                    56,
                  behavior: window.matchMedia(
                    "(prefers-reduced-motion: reduce)",
                  ).matches
                    ? "instant"
                    : "smooth",
                });
              }
            }}
          >
            {ui("keepGoing")} <Icon name="arrow" />
          </button>
        )}
      {showCart && catalog && (
        <CartOverlay
          catalog={catalog}
          open={cartOpen}
          onClose={() => setCartOpen(false)}
        />
      )}
      <FloatingNav
        android={nativeHome && !publicView}
        sourceNavigation={!!publicView}
        fade
        showExplore={!returning}
        showCartWhenEmpty={showCart}
        cart={showCart ? () => setCartOpen(true) : undefined}
      />
    </BuyerSurface>
  );
}
