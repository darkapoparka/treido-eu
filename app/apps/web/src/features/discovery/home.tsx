"use client";
import { ShopSurface } from "./hydration-boundary";
/* eslint-disable @next/next/no-img-element */
import { rememberSourceReturn, SourceLink } from "./return-navigation";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatMoney, type Catalog } from "../catalog/types";
import { FloatingNav, IconButton, ProductCard, StoreRow } from "./components";
import { HomeCampaigns } from "./home-campaigns";
import { HomeMerchantShelves } from "./home-merchant-shelves";
import { ShopOptionsMenu, type ShopMenuStage } from "./shop-options-menu";
import { RecentSearchItems } from "./search-recent";
import { Icon } from "./icons";
import { useDiscovery } from "./state";
import { useAccount } from "../account/state";
import { CartOverlay } from "../commerce/checkout";
export function Home({ catalog }: { catalog: Catalog }) {
  const router = useRouter();
  const params = useSearchParams();
  const state = useDiscovery(),
    { profile } = useAccount();
  // Different recorded journeys share these same feed components; only their data/order changes.
  const returning = params.get("journey") === "returning";
  const requestedFeed = params.get("feed");
  const nativeHome =
    !!catalog.liveHomeStoreIds?.length &&
    !returning &&
    !requestedFeed &&
    params.get("reference") !== "captured";
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
  const menuStore = catalog.stores.find((store) => store.id === shopMenu);
  function closeShopMenu() {
    setShopMenu("");
    setShopStage("menu");
  }
  const recent = state.viewedProducts
    .flatMap((id) => {
      const p = catalog.products.find((p) => p.id === id);
      return p ? [p] : [];
    })
    .slice(0, 3);
  const nativeRecentProducts =
    nativeHome && params.get("home") === "recent" && recent.length > 0;
  return (
    <ShopSurface
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
      <header className="home-shortcuts">
        <SourceLink href="/profile" aria-label="Profile" className="avatar">
          {nativeHome && !profile.avatar ? (
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
          label="Notifications"
          onClick={() => {
            rememberSourceReturn(
              "/notifications",
              '.home-shortcuts button[aria-label="Notifications"]',
            );
            router.push("/notifications");
          }}
        />
        <SourceLink className="pill" href="/deals">
          <Icon name="tag" filled />
          Deals
        </SourceLink>
        <SourceLink className="pill" href="/following">
          <span className="following-shortcut-icon">
            <Icon name="badge-check" filled />
            {(recentStores || recentProducts || nativeRecentProducts) && (
              <i aria-hidden="true" />
            )}
          </span>
          Following
        </SourceLink>
        <SourceLink className="pill" href="/saved">
          <Icon name="heart" filled />
          Saved
        </SourceLink>
        <SourceLink className="pill" href="/minis">
          <Icon name="minis" filled />
          Minis
        </SourceLink>
      </header>
      {tracking && (
        <SourceLink href="/orders" className="delivery-card">
          <img
            src={catalog.stores.find((s) => s.id === "kitsch")!.logo}
            alt=""
          />
          <span>
            <small>KITSCH</small>
            <strong>Ordered Jul 27</strong>
          </span>
          <img src="/api/reference-media/shampoo-bag" alt="Shampoo bar bag" />
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
            <strong>Connect email to see more deliveries</strong>
            <span>Track more of your packages with Shop</span>
          </span>
          <Icon name="back" />
        </button>
      )}
      {recentStores && (
        <section
          className="recent-panel recent-stores-panel"
          aria-label="Recently viewed shops"
        >
          <p>Jump back in</p>
          <div className="recent-store-grid">
            <RecentSearchItems catalog={catalog} limit={4} surface="home" />
          </div>
          <SourceLink href="/search?view=recent" className="recent-title">
            <h1>Recently viewed</h1>
            <Icon name="arrow" />
          </SourceLink>
        </section>
      )}
      {recentProducts && (
        <section className="recent-panel" aria-label="Recently viewed products">
          <p>Jump back in</p>
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
            <h1>Recently viewed</h1>
            <Icon name="arrow" />
          </SourceLink>
        </section>
      )}
      {recentProducts &&
        catalog.stores
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
                  <p>We’ll show you less like this</p>
                  <button
                    onClick={() =>
                      setHidden((v) => v.filter((id) => id !== store.id))
                    }
                  >
                    Undo
                  </button>
                </div>
              ) : (
                <div>
                  {catalog.products
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
                            <span>★★★★★</span> ({p.ratingCount})
                          </p>
                          <p>{formatMoney(p.price)}</p>
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
            ? `${menuStore.rating} ★ (${menuStore.ratingCount})`
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
          aria-label="Recently viewed products"
        >
          <p>Jump back in</p>
          <div className="product-rail">
            {recent.map((product) => (
              <ProductCard key={product.id} product={product} compact />
            ))}
          </div>
          <SourceLink href="/search?view=recent" className="merchant-shop-all">
            <strong>Recently viewed</strong>
            <span>
              <Icon name="arrow" />
            </span>
          </SourceLink>
        </section>
      )}
      {nativeHome ? (
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
      ) : (
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
      )}
      {!nativeHome &&
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
            Keep going <Icon name="arrow" />
          </button>
        )}
      {showCart && (
        <CartOverlay
          catalog={catalog}
          open={cartOpen}
          onClose={() => setCartOpen(false)}
        />
      )}
      <FloatingNav
        android={nativeHome}
        fade
        showExplore={!returning}
        showCartWhenEmpty={showCart}
        cart={showCart ? () => setCartOpen(true) : undefined}
      />
    </ShopSurface>
  );
}
