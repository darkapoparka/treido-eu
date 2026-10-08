"use client";
import { useCaption } from "../locale/use-caption";
import { useTranslations } from "next-intl";
import { BuyerSurface } from "./buyer-surface";
import type { BuyerEntryData } from "../catalog/buyer-entry-model";
import { getBrowseCategory } from "@treido/contracts/categories";
import { LibraryProvider } from "../library/provider";
import { PublicExplore } from "./public-explore";
import { publicExploreBackHref } from "./explore-model";
import { ExploreCategoryTiles } from "./explore-category-tiles";
import { ExploreShelf } from "./explore-shelf";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { projectLiveHomeShelf } from "../catalog/reference/live-shelf-fixtures";
import { FloatingNav, ProductCard } from "./components";
import { Icon } from "./icons";
import { BeautySections } from "./beauty";
import { HomeCategoryIntro, HomeCategoryEditorial } from "./home-category";
import { CartOverlay } from "../commerce/checkout";
import {
  miniCatalog,
  miniHref,
  miniIcon,
  liveExploreMiniIds,
} from "./mini-model";
import { useDiscovery } from "./state";
import { SourceLink, useContextualClose } from "./return-navigation";
import styles from "./explore.module.css";
import "./live-explore.css";

const departments = [
  ["Deals", "#1c1162", "explore-deals-art", ""],
  ["Beauty", "#bb405a", "explore-beauty-lip", "explore-beauty-wash"],
  ["Women", "#9fa5ac", "explore-women-shirt", "explore-women-jeans"],
  ["Men", "#013888", "explore-men-shirt", "explore-men-jeans"],
  ["Home", "#cd6001", "explore-home-lamp", "explore-home-pan"],
  [
    "Fitness & nutrition",
    "#9eb898",
    "explore-fitness-tone",
    "explore-fitness-shorts",
  ],
] as const;
const extraDepartments = [
  ["Baby & toddler", "#90a59c", "live-explore-baby", "live-explore-stroller"],
  [
    "Sporting goods",
    "#5d4c98",
    "live-explore-tennis",
    "live-explore-kettlebell",
  ],
  ["Food & drinks", "#af1022", "live-explore-cereal", "live-explore-oil"],
  ["Toys & games", "#006132", "live-explore-beads", "live-explore-bear"],
  ["Pet supplies", "#a97b76", "live-explore-pet-bowl", "live-explore-pet-bed"],
] as const;
const homeShelves = [
  ["Top rated in home", "Home", ["buffy-breeze", "citizenry-linen"]],
  ["Top rated in menswear", "Menswear", ["carbon-crew", "jordan-legend"]],
  ["New in beauty", "Beauty", ["bubble-sunrise", "bare-liquid"]],
] as const;
const beautyShelves = [
  ["Top rated", ["whip-mousse", "hanacure-cleanser"]],
  ["What’s new", ["bubble-sunrise", "bare-liquid"]],
] as const;
const beautyShelfPhotos: Readonly<Record<string, string>> = {
  "whip-mousse": "beauty-whip-card-photo",
  "hanacure-cleanser": "beauty-hanacure-card-photo",
  "bubble-sunrise": "beauty-bubble-card-photo",
  "bare-liquid": "beauty-bare-card-photo",
};
const homeShelfPhotos: Readonly<Record<string, string>> = {
  "buffy-breeze": "explore-home-buffy-card",
  "citizenry-linen": "explore-home-citizenry-card",
  "carbon-crew": "explore-home-carbon-card",
  "jordan-legend": "explore-home-jordan-card",
  "bubble-sunrise": "explore-home-bubble-card",
  "bare-liquid": "explore-home-bare-card",
};

export function Explore(props: BuyerEntryData & { category?: string }) {
  const items = props.publicView?.page?.items ?? [];
  return props.publicView ? (
    <LibraryProvider
      query={{
        view: "state",
        listingIds: items.map((item) => item.id),
        sellerIds: [...new Set(items.map((item) => item.seller.id))],
      }}
    >
      <ExploreContent {...props} />
    </LibraryProvider>
  ) : (
    <ExploreContent {...props} />
  );
}
function ExploreContent({
  catalog,
  publicView,
  category,
}: BuyerEntryData & { category?: string }) {
  const caption = useCaption();
  const ui = useTranslations("discoveryUI");
  const router = useRouter();
  const currentCategory = publicView
    ? (publicView.input.category ?? undefined)
    : category;
  const [cart, setCart] = useState(false);
  const categoriesRef = useRef<HTMLDivElement>(null);
  const [categoriesPassed, setCategoriesPassed] = useState(false);
  const { visitMini } = useDiscovery();
  const beauty = category === "Beauty";
  const androidLive = Boolean(publicView || catalog?.liveHomeStoreIds);
  const nativeHomeCategory = androidLive && category === "Home";
  const searchParams = useSearchParams();
  const close = useContextualClose(
    publicView ? searchParams.toString() : undefined,
  );
  const expandedCategories =
    androidLive && searchParams.get("categories") === "all";
  useEffect(() => {
    const categories = categoriesRef.current;
    if (!categories) return;
    // The empty cart belongs to the category entry. A populated cart remains
    // available through FloatingNav, including while browsing the lower shelves.
    const observer = new IntersectionObserver(([entry]) => {
      setCategoriesPassed(entry.boundingClientRect.bottom <= 0);
    });
    observer.observe(categories);
    return () => observer.disconnect();
  }, [category]);
  const byIds = (ids: readonly string[]) =>
    ids.flatMap((id) => {
      const product = (catalog?.products ?? []).find(
        (value) => value.id === id,
      );
      if (!product) return [];
      const sourcePhoto = beauty ? beautyShelfPhotos[id] : homeShelfPhotos[id];
      // The native shelf and opened PDP have separately observed currencies.
      const snapshot =
        androidLive && id === "live-explore-jordan-legend"
          ? { ...product, price: { amount: 31100, currency: "EUR" as const } }
          : product;
      return [
        sourcePhoto
          ? { ...snapshot, images: [`/api/reference-media/${sourcePhoto}`] }
          : snapshot,
      ];
    });
  const shelves = beauty
    ? beautyShelves.map(([title, ids]) => ({
        title,
        products: byIds(ids),
        href:
          title === "Top rated"
            ? "/search?category=Beauty&ratings=4.5%20stars%20and%20up"
            : "/search?category=Beauty&sort=Newest",
      }))
    : category
      ? [
          {
            title: nativeHomeCategory ? "Top rated" : category,
            href: `/search?q=${encodeURIComponent(category)}`,
            products: nativeHomeCategory
              ? projectLiveHomeShelf(catalog?.products ?? [])
              : (catalog?.products ?? []).filter(
                  (product) =>
                    product.category === category ||
                    (category === "Men" && product.category === "Menswear") ||
                    (category === "Women" && product.category === "Womenswear"),
                ),
          },
        ]
      : homeShelves.map(([title, department, ids]) => ({
          title,
          href:
            androidLive && title === "Top rated in home"
              ? "/explore/Home"
              : `/search?category=${encodeURIComponent(department)}&${title === "New in beauty" ? "sort=Newest" : "ratings=4.5%20stars%20and%20up"}`,
          products:
            androidLive && title === "Top rated in home"
              ? projectLiveHomeShelf(catalog?.products ?? [])
              : androidLive && title === "Top rated in menswear"
                ? byIds([
                    "live-explore-cashmere",
                    "live-explore-jordan-legend",
                    "live-explore-airtag-wallet",
                  ])
                : androidLive && title === "New in beauty"
                  ? byIds([
                      "live-explore-glow-duo",
                      "live-explore-prismatic-gloss",
                      "live-explore-blush-trio",
                    ])
                  : title === "New in beauty"
                    ? byIds(ids)
                    : [
                        ...byIds(ids),
                        ...(catalog?.products ?? []).filter(
                          (product) =>
                            product.category === department &&
                            !(ids as readonly string[]).includes(product.id),
                        ),
                      ],
        }));
  return (
    <BuyerSurface
      publicData={!!publicView}
      className={`shop-page explore-page ${styles.page} ${androidLive ? "android-live android-explore" : ""}`}
      data-category={currentCategory}
      data-native-shelves={
        publicView || (androidLive && (!category || nativeHomeCategory))
          ? true
          : undefined
      }
    >
      <h1>
        {publicView?.input.category
          ? getBrowseCategory(publicView.input.category)?.labels[
              publicView.input.locale
            ]
          : (category ?? ui("explore"))}
      </h1>
      {catalog ? (
        <>
          {nativeHomeCategory && <HomeCategoryIntro />}
          {category && !nativeHomeCategory && (
            <div className="category-rail">
              {(beauty
                ? ["Skin care", "Hair care", "Makeup", "Scent & body"]
                : ["Shop all", "Top rated", "What’s new"]
              ).map((label) => (
                <SourceLink
                  className="pill"
                  key={label}
                  href={`/search?q=${encodeURIComponent(label === "Shop all" ? category : label)}`}
                >
                  {beauty && (
                    <img
                      className="beauty-category-icon"
                      src={`/api/reference-media/beauty-pill-${label === "Skin care" ? "skin" : label === "Hair care" ? "hair" : label === "Makeup" ? "makeup" : "scent"}`}
                      alt=""
                    />
                  )}
                  {caption(label)}
                </SourceLink>
              ))}
            </div>
          )}
          {(!category || beauty) && (
            <div className={beauty ? styles.beautyOpening : styles.openingRail}>
              <SourceLink
                className="editorial-hero"
                href={
                  androidLive && !category
                    ? "/explore/curations/cozy-edit"
                    : `/search?q=${beauty ? "Hair" : "Dresses"}`
                }
              >
                <img
                  src={`/api/reference-media/${beauty ? "beauty-curls-photo" : androidLive ? "live-explore-cozy-room" : "explore-summer-upper"}`}
                  alt={
                    beauty
                      ? ui("wavyHair")
                      : androidLive
                        ? ui("warmLivingRoomPhotographedByChrisMottalini")
                        : ui("summerDress")
                  }
                />
                {androidLive && !category && (
                  <small className="editorial-guest-badge">
                    {ui("guestEditor")}
                  </small>
                )}
                <div>
                  <strong>
                    {beauty
                      ? ui("summerCurlRoutine")
                      : androidLive
                        ? ui("architecturalDigestSCozyEdit_3e1527")
                        : ui("highRotationSummerDresses")}
                  </strong>
                  <p>
                    {beauty
                      ? ui("masksLeaveInsAndShineOils")
                      : androidLive
                        ? ui("makeYourHomeFeelLikeASanctuaryThisFall")
                        : ui("slipDressesShirtDressesAndLinenMidis")}
                  </p>
                  <Icon name="arrow" />
                </div>
              </SourceLink>
              {!category && androidLive && (
                <SourceLink
                  className="editorial-hero staud-hero"
                  href="/explore/curations/staud"
                  startAtTop
                >
                  <img
                    src="/api/reference-media/live-explore-staud-hero"
                    alt={ui("staudFallCampaign")}
                    data-media-state="verified-campaign-alternative"
                  />
                  <div>
                    <strong>{ui("brandSpotlightStaud")}</strong>
                    <p>{ui("timelessPiecesWithAContemporaryTouch")}</p>
                    <Icon name="arrow" />
                  </div>
                </SourceLink>
              )}
              {!category && !androidLive && (
                <SourceLink
                  className={styles.heroContinuation}
                  href="/search?category=Womenswear"
                  aria-label={ui("moreSummerStyles")}
                  data-ui-label="moreSummerStyles"
                >
                  <img
                    src="/api/reference-media/explore-summer-continuation"
                    alt=""
                  />
                </SourceLink>
              )}
            </div>
          )}
          {!category && (
            <>
              <h2>{ui("browseCategories")}</h2>
              <ExploreCategoryTiles
                gridRef={categoriesRef}
                tiles={(expandedCategories
                  ? [...departments, ...extraDepartments]
                  : departments
                ).map(([name, color, first, second]) => ({
                  id: name,
                  title: caption(name),
                  color,
                  href:
                    name === "Deals"
                      ? "/search?deals=1"
                      : "/explore/" + encodeURIComponent(name),
                  photos: [first, ...(second ? [second] : [])].map(
                    (id) => "/api/reference-media/" + id,
                  ),
                }))}
              />
              {androidLive && (
                <button
                  type="button"
                  className="explore-more-categories"
                  aria-expanded={expandedCategories}
                  aria-controls="explore-categories"
                  onClick={() => {
                    const query = new URLSearchParams(searchParams);
                    if (expandedCategories) query.delete("categories");
                    else query.set("categories", "all");
                    // A mounted disclosure must not race the next category visit
                    // with a pending server navigation that replaces its entry.
                    const state = { ...window.history.state };
                    delete state.__NA;
                    delete state._N;
                    window.history.replaceState(
                      state,
                      "",
                      `/explore${query.size ? `?${query}` : ""}`,
                    );
                  }}
                >
                  {expandedCategories ? ui("less") : ui("more_d47d7c")}
                </button>
              )}
              <section className="explore-minis">
                <SourceLink className={styles.miniHeading} href="/minis">
                  <h2>{ui("trySomethingNew")}</h2>
                  <Icon name="chevron" />
                </SourceLink>
                <p>{ui("discoverMoreWaysToShopWithMinis")}</p>
                {(androidLive
                  ? liveExploreMiniIds
                  : (["sol", "skin", "look"] as const)
                ).map((id) => (
                  <SourceLink
                    key={id}
                    className={styles.miniRow}
                    href={miniHref(id)}
                    onClick={() => visitMini(id)}
                  >
                    <img src={miniIcon(id)} alt="" />
                    <span>
                      <strong>{miniCatalog[id].name}</strong>
                      <small>{miniCatalog[id].description}</small>
                    </span>
                  </SourceLink>
                ))}
              </section>
            </>
          )}
          {shelves.map(({ title, href, products }) => (
            <ExploreShelf
              title={caption(title)}
              href={href}
              key={caption(title)}
            >
              {products.length ? (
                <div className="product-rail">
                  {products.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      showPromotion
                      storeName={
                        product.id === "buffy-breeze" && !category
                          ? "Buffy.co"
                          : (catalog.stores.find(
                              (store) => store.id === product.storeId,
                            )?.name ??
                            (product.id === "citizenry-linen"
                              ? "The Citizenry"
                              : undefined))
                      }
                    />
                  ))}
                  {!category &&
                    products.length === 2 &&
                    (title === "Top rated in home" ||
                      title === "Top rated in menswear") && (
                      <SourceLink
                        className={styles.photoContinuation}
                        href={href}
                        aria-label={ui("moreValue1Products", {
                          value1: title.toLowerCase(),
                        })}
                      >
                        <img
                          src={`/api/reference-media/${title === "Top rated in home" ? "explore-home-continuation" : "explore-menswear-continuation"}`}
                          alt=""
                        />
                      </SourceLink>
                    )}
                  {(beauty || !androidLive) &&
                    (title === "What’s new" || title === "New in beauty") && (
                      <SourceLink
                        className={styles.photoContinuation}
                        href={href}
                        aria-label={ui("moreNewBeautyProducts")}
                        data-ui-label="moreNewBeautyProducts"
                      >
                        <img
                          src={`/api/reference-media/${beauty ? "beauty-new-continuation" : "explore-beauty-continuation"}`}
                          alt=""
                        />
                      </SourceLink>
                    )}
                </div>
              ) : (
                <p className="empty-state" role="status">
                  {ui("noProductsInThisReferenceSample")}
                </p>
              )}
            </ExploreShelf>
          ))}
          {nativeHomeCategory && <HomeCategoryEditorial />}
          {beauty && <BeautySections catalog={catalog} />}
          {!category && (
            <section className="explore-shelf">
              <SourceLink href="/search?category=Womenswear&ratings=4.5%20stars%20and%20up">
                <h2>
                  {ui("topRatedInWomenswear")}{" "}
                  <span className={styles.shelfChevron}>›</span>
                </h2>
              </SourceLink>
              <div className="product-rail explore-women-partials">
                <div />
                <div>
                  <img
                    src="/api/reference-media/explore-womenswear-partial"
                    alt={ui("capturedWomenswearPhotographDetail")}
                  />
                </div>
              </div>
            </section>
          )}
        </>
      ) : (
        publicView && <PublicExplore view={publicView} />
      )}
      <FloatingNav
        android={androidLive && !publicView}
        sourceNavigation={!!publicView}
        fade
        back={!!currentCategory}
        onBack={
          publicView
            ? () => {
                if (!close())
                  router.replace(publicExploreBackHref(publicView.input));
              }
            : undefined
        }
        cart={catalog ? () => setCart(true) : undefined}
        showCartWhenEmpty={
          !androidLive && !beauty && (!!category || !categoriesPassed)
        }
      />
      {catalog && (
        <CartOverlay
          catalog={catalog}
          open={cart}
          onClose={() => setCart(false)}
        />
      )}
    </BuyerSurface>
  );
}
