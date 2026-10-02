"use client";
/* eslint-disable @next/next/no-img-element -- Allowlisted frozen product photographs. */
import { useCaption } from "../locale/use-caption";
import { useTranslations } from "next-intl";
import { SourceLink } from "./return-navigation";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Catalog, Store } from "../catalog/types";
import { CartOverlay } from "../commerce/checkout";
import { FloatingNav, IconButton, ProductCard, Sheet } from "./components";
import { ShopSurface } from "./hydration-boundary";
import { useDiscovery } from "./state";
import "./following.css";

function PostIdentity({ store, added }: { store: Store; added: string }) {
  return (
    <SourceLink
      className="following-post-identity"
      href={`/stores/${store.id}`}
    >
      <span
        className={`following-logo ${store.id === "pura" ? "has-offer" : ""}`}
      >
        {store.logo ? (
          <img src={store.logo} alt="" />
        ) : (
          <span className="following-logo-fallback" aria-hidden="true">
            {store.name[0]}
          </span>
        )}
      </span>
      <span>
        <strong>{store.name}</strong>
        <small>{added}</small>
      </span>
    </SourceLink>
  );
}

function LiveFollowingPosts({ catalog }: { catalog: Catalog }) {
  return (
    <>
      {catalog.liveFollowingPosts?.map((post, index) => {
        const store = catalog.stores.find((item) => item.id === post.storeId);
        if (!store) return null;
        return (
          <section
            className={`following-post ${post.wide ? "following-post-single" : ""}`}
            key={`${post.storeId}-${index}`}
            data-live-following-post={index}
          >
            <PostIdentity store={store} added={post.added} />
            <div className="following-product-grid">
              {post.productIds.map((id) => {
                const product = catalog.products.find((item) => item.id === id);
                return product ? (
                  <ProductCard
                    key={id}
                    product={
                      post.wide
                        ? { ...product, referenceThumbnails: undefined }
                        : product
                    }
                    showRating={false}
                  />
                ) : null;
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}

export function Following({ catalog }: { catalog: Catalog }) {
  const caption = useCaption();
  const ui = useTranslations("discoveryUI");
  const native = !!catalog.liveHomeStoreIds;
  const state = useDiscovery();
  const router = useRouter();
  const manage = useSearchParams().get("manage") === "1";
  const [managedIds, setManagedIds] = useState(() => [...state.followed]);
  const [cartOpen, setCartOpen] = useState(false);
  const [details, setDetails] = useState("");
  const [quiltSaved, setQuiltSaved] = useState(false);
  const manageButton = useRef<HTMLButtonElement>(null);
  const returnScroll = useRef(0);
  const enteredFromFeed = useRef(!manage);
  const wasManaging = useRef(manage);
  const ids = manage
    ? Array.from(new Set([...managedIds, ...state.followed]))
    : state.followed;
  const stores = ids.flatMap((id) => {
    const store = catalog.stores.find((item) => item.id === id);
    return store ? [store] : [];
  });
  const pura = stores.find((store) => store.id === "pura");
  const kitsch = stores.find((store) => store.id === "kitsch");
  const products = (productIds: readonly string[]) =>
    productIds.flatMap((id) => {
      const product = catalog.products.find((item) => item.id === id);
      return product ? [product] : [];
    });

  useEffect(() => {
    const changed = wasManaging.current !== manage;
    wasManaging.current = manage;
    if (!changed) return;
    const frame = requestAnimationFrame(() => {
      window.scrollTo({
        top: manage ? 0 : returnScroll.current,
        behavior: "instant",
      });
      if (!manage) manageButton.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [manage]);

  function openManage() {
    returnScroll.current = window.scrollY;
    enteredFromFeed.current = true;
    setManagedIds([...state.followed]);
    router.push("/following?manage=1", { scroll: false });
  }

  return (
    <ShopSurface
      className={`shop-page following-page ${native ? "android-live android-following" : ""}`}
    >
      <header className="following-heading">
        <h1>{manage ? ui("followingList") : ui("following")}</h1>
        {!manage && stores.length > 0 && (
          <button
            ref={manageButton}
            className="following-manage"
            type="button"
            onClick={openManage}
          >
            {ui("manage")}
          </button>
        )}
      </header>
      {manage ? (
        <div className="following-management">
          {stores.map((store) => {
            const followed = state.followed.includes(store.id);
            return (
              <div className="following-management-row" key={store.id}>
                <SourceLink href={`/stores/${store.id}`}>
                  {store.logo ? (
                    <img src={store.logo} alt="" />
                  ) : (
                    <span
                      className="following-logo-fallback"
                      aria-hidden="true"
                    >
                      {store.name[0]}
                    </span>
                  )}
                  <span>{store.name}</span>
                </SourceLink>
                <button
                  type="button"
                  aria-pressed={followed}
                  onClick={() => state.toggleFollow(store.id)}
                >
                  {followed ? ui("following") : ui("follow")}
                </button>
              </div>
            );
          })}
          {!stores.length && (
            <p className="following-list-empty">
              {ui("youReNotFollowingAnyBrandsYet")}
            </p>
          )}
        </div>
      ) : stores.length === 0 ? (
        <>
          <section className="following-empty">
            <h2>
              {native ? (
                ui("youReNotFollowingAnyBrandsYet_badbe3")
              ) : (
                <>
                  {ui("youReNotFollowing")}
                  <br />
                  {ui("anyBrandsYet")}
                </>
              )}
            </h2>
            <p>
              {native ? (
                ui("hereAreNewProductsFromBrandsYouMightLike")
              ) : (
                <>
                  {ui("hereAreNewProductsFromBrands")}
                  <br />
                  {ui("youMightLike")}
                </>
              )}
            </p>
            <SourceLink
              className="primary"
              href={
                native
                  ? state.viewedProducts.length
                    ? "/?home=recent"
                    : "/"
                  : "/explore"
              }
            >
              {ui("goShopping")}
            </SourceLink>
          </section>
          {native ? (
            <LiveFollowingPosts catalog={catalog} />
          ) : (
            <section
              className="following-post following-recommendation"
              aria-label={ui("recommendedBrand")}
              data-ui-label="recommendedBrand"
            >
              <button
                className="following-post-identity"
                type="button"
                onClick={() =>
                  setDetails("Quilting Books Patterns and Notions")
                }
              >
                <span className="following-logo has-offer">
                  <img src="/api/reference-media/qbp-logo" alt="" />
                </span>
                <span>
                  <strong>Quilting Books Patterns and Notions</strong>
                  <small>{ui("text1ItemAdded10HoursAgo")}</small>
                </span>
              </button>
              <div className="following-recommendation-photo product-media">
                <button
                  type="button"
                  aria-label={ui("viewQuiltPattern")}
                  onClick={() => setDetails("Quilt pattern")}
                  data-ui-label="viewQuiltPattern"
                >
                  <img
                    src="/api/reference-media/following-photo-quilt"
                    alt={ui("purpleAndGreenStarQuilt")}
                  />
                </button>
                <span className="price-badge deal">{ui("save3")}</span>
                <IconButton
                  icon="heart"
                  className="save-button"
                  label={ui("value1QuiltPattern", {
                    value1: quiltSaved ? ui("unsave") : ui("save"),
                  })}
                  pressed={quiltSaved}
                  onClick={() => setQuiltSaved((saved) => !saved)}
                  data-ui-label="value1QuiltPattern"
                />
              </div>
              {quiltSaved && (
                <p className="sr-only" role="status">
                  {ui("patternBookmarkedOnThisPageItsFullCatalogRecordWas")}
                </p>
              )}
            </section>
          )}
        </>
      ) : (
        <>
          <nav
            className="following-brand-rail"
            aria-label={ui("followedBrands")}
            data-ui-label="followedBrands"
          >
            {stores.map((store) => (
              <SourceLink
                key={store.id}
                href={`/stores/${store.id}`}
                aria-label={ui("visitValue1", { value1: store.name ?? "" })}
                className={`following-logo ${store.id === "pura" ? "has-offer" : ""}`}
              >
                {store.logo ? (
                  <img src={store.logo} alt="" />
                ) : (
                  <span className="following-logo-fallback" aria-hidden="true">
                    {store.name[0]}
                  </span>
                )}
              </SourceLink>
            ))}
          </nav>
          {pura && (
            <section
              className="following-post"
              data-following-post="pura-new"
              aria-label={ui("newPuraProducts")}
              data-ui-label="newPuraProducts"
            >
              <PostIdentity store={pura} added="7 items added 4 hours ago" />
              <div className="following-product-grid">
                {products([
                  "following-amber",
                  "following-mandarin",
                  "following-cashmere",
                  "following-charcoal",
                  "following-lemon",
                  "following-santa-fe",
                ]).map((product) => (
                  <div key={product.id} data-following-product={product.id}>
                    <ProductCard product={product} showPromotion />
                  </div>
                ))}
              </div>
            </section>
          )}
          {kitsch && (
            <section
              className="following-post following-post-single"
              data-following-post="kitsch"
              aria-label={ui("newKITSCHProducts")}
              data-ui-label="newKITSCHProducts"
            >
              <PostIdentity store={kitsch} added="1 item added 2 days ago" />
              <div className="following-product-grid">
                {products(["following-black-bow"]).map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          )}
          {pura && (
            <section
              className="following-post following-post-single"
              data-following-post="pura-older"
              aria-label={ui("earlierPuraProduct")}
              data-ui-label="earlierPuraProduct"
            >
              <PostIdentity store={pura} added="1 item added 3 days ago" />
              <div className="following-partial-photo product-media">
                <button
                  type="button"
                  aria-label={ui("viewEarlierPuraItem")}
                  onClick={() => setDetails("Earlier Pura item")}
                  data-ui-label="viewEarlierPuraItem"
                >
                  <img
                    src="/api/reference-media/following-photo-older-pura"
                    alt={ui(
                      "visibleUpperPartOfTheEarlierPuraProductPhotograph",
                    )}
                  />
                </button>
                <span className="price-badge deal">{ui("text30OffOrder")}</span>
              </div>
            </section>
          )}
          {stores
            .filter((store) => !["pura", "kitsch"].includes(store.id))
            .map((store) => (
              <section
                className="following-post"
                key={store.id}
                aria-label={ui("value1Products", { value1: store.name ?? "" })}
              >
                <PostIdentity store={store} added="Products from this brand" />
                <div className="following-product-grid">
                  {catalog.products
                    .filter((product) => product.storeId === store.id)
                    .map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        showPromotion
                      />
                    ))}
                </div>
              </section>
            ))}
        </>
      )}
      <CartOverlay
        catalog={catalog}
        open={cartOpen}
        onClose={() => setCartOpen(false)}
      />
      <FloatingNav
        android={native}
        fade
        back
        cart={manage ? undefined : () => setCartOpen(true)}
        showCartWhenEmpty={!native && !manage && !stores.length}
        onBack={
          manage
            ? () => {
                if (enteredFromFeed.current) router.back();
                else router.replace("/following", { scroll: false });
              }
            : undefined
        }
      />
      <Sheet
        open={!!details}
        title={caption(details)}
        onClose={() => setDetails("")}
      >
        <p className="sheet-copy">
          {ui("theFrozenCaptureShowsThisPostButDoesNotInclude")}
        </p>
        <button
          className="primary form-submit"
          type="button"
          onClick={() => setDetails("")}
        >
          {ui("returnToFollowing")}
        </button>
      </Sheet>
    </ShopSurface>
  );
}
