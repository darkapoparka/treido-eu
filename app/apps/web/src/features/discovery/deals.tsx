"use client";
/* eslint-disable @next/next/no-img-element -- Frozen reference-media photographs. */
import { useLocale as useIntlLocale } from "next-intl";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { SourceLink } from "./return-navigation";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ShopSurface } from "./hydration-boundary";
import { FloatingNav, IconButton, Sheet } from "./components";
import { Icon } from "./icons";
import { ReviewStars } from "./rating-stars";
import { useDiscovery } from "./state";
import { ShopOptionsMenu, type ShopMenuStage } from "./shop-options-menu";
import {
  dealStores,
  dealListings,
  type DealListing,
} from "../catalog/reference/deal-fixtures";
import { formatMoney } from "../catalog/types";
import "./deals.css";

const chips = ["Men", "Accessories", "Beauty", "Women"];

function DealCard({
  product,
  onOpen,
}: {
  product: DealListing;
  onOpen: () => void;
}) {
  const intlLocale = useIntlLocale();
  const ui = useTranslations("discoveryUI");
  const state = useDiscovery();
  return (
    <article className="deal-product" data-product-id={product.id}>
      <button
        className="deal-product-photo"
        aria-label={ui("viewValue1", { value1: product.title ?? "" })}
        onClick={onOpen}
      >
        <img src={product.images[0]} alt="" />
      </button>
      <IconButton
        className="deal-save"
        icon="heart"
        label={`${state.saved.includes(product.id) ? ui("unsave") : ui("save")} ${product.title}`}
        pressed={state.saved.includes(product.id)}
        onClick={() => state.toggleSaved(product.id)}
      />
      <button className="deal-product-copy" onClick={onOpen}>
        <strong>{product.title}</strong>
        <span className="deal-rating">
          <ReviewStars rating={5} /> ({product.reviews})
        </span>
        <span>{formatMoney(product.price, intlLocale)}</span>
      </button>
    </article>
  );
}

export function Deals({ initialStoreId }: { initialStoreId?: string }) {
  const intlLocale = useIntlLocale();
  const ui = useTranslations("discoveryUI");
  const router = useRouter();
  const state = useDiscovery();
  const [menuId, setMenuId] = useState("");
  const lastMenuId = useRef("");
  const [stage, setStage] = useState<ShopMenuStage>("menu");
  const [shopId, setShopId] = useState(initialStoreId ?? "");
  const [productId, setProductId] = useState("");
  const [unidentifiedStoreId, setUnidentifiedStoreId] = useState("");
  const [hidden, setHidden] = useState<string[]>([]);
  const menuStore = dealStores.find((store) => store.id === menuId);
  const shop = dealStores.find((store) => store.id === shopId);
  const product = dealListings.find((item) => item.id === productId);
  function closeMenu() {
    setMenuId("");
    setStage("menu");
  }
  return (
    <ShopSurface className="shop-page deals-page">
      <h1>{ui("deals")}</h1>
      <div
        className="deals-filter-rail"
        aria-label={ui("dealCategories")}
        data-ui-label="dealCategories"
      >
        <SourceLink
          className="deals-search"
          href="/search"
          aria-label={ui("search")}
          data-ui-label="search"
        >
          <Icon name="search" />
        </SourceLink>
        {chips.map((chip) => (
          <SourceLink
            className="deals-chip"
            href={`/search?q=${encodeURIComponent(chip)}`}
            key={chip}
          >
            {chip}
          </SourceLink>
        ))}
      </div>
      <div className="deals-feed">
        {dealStores.map((store) => (
          <section
            className="deal-store"
            key={store.id}
            data-store-id={store.id}
          >
            <header className="deal-store-header">
              <button
                className="deal-store-identity"
                onClick={() => setShopId(store.id)}
                aria-label={ui("visitValue1", { value1: store.name ?? "" })}
              >
                <img src={store.logo} alt="" />
                <span>
                  <strong>{store.name}</strong>
                  <small>
                    <b>
                      {ui("save_06f8f0")}
                      {store.offer}
                    </b>{" "}
                    {ui("onOrdersOver")}
                    {store.threshold}
                  </small>
                </span>
              </button>
              <IconButton
                icon="more"
                label={ui("moreOptionsForValue1", { value1: store.name ?? "" })}
                onClick={() => {
                  lastMenuId.current = store.id;
                  setMenuId(store.id);
                  setStage("menu");
                }}
                data-ui-label="moreOptionsForValue1"
              />
            </header>
            {hidden.includes(store.id) ? (
              <div className="deal-hidden" role="status">
                <Icon name="eye-off" />
                <p>{ui("weLlShowYouLessLikeThis")}</p>
                <button
                  className="pill"
                  onClick={() =>
                    setHidden((ids) => ids.filter((id) => id !== store.id))
                  }
                >
                  {ui("undo")}
                </button>
              </div>
            ) : (
              <div className="deal-product-rail">
                {store.productIds.map((id) => {
                  const item = dealListings.find(
                    (listing) => listing.id === id,
                  )!;
                  return (
                    <DealCard
                      key={id}
                      product={item}
                      onOpen={() => setProductId(id)}
                    />
                  );
                })}
                <button
                  className="deal-source-tail"
                  aria-label={ui("additionalCapturedProductsFromValue1", {
                    value1: store.name ?? "",
                  })}
                  onClick={() => setUnidentifiedStoreId(store.id)}
                >
                  <img src={store.trailingPhoto} alt="" />
                </button>
              </div>
            )}
          </section>
        ))}
      </div>
      <FloatingNav back cart={() => router.push("/cart")} />
      <ShopOptionsMenu
        open={!!menuStore}
        store={menuStore}
        stage={stage}
        onStageChange={setStage}
        onClose={closeMenu}
        onReopen={() => setMenuId(lastMenuId.current)}
        onVisit={() => setShopId(menuId)}
        onHide={() => {
          setHidden((ids) => [...new Set([...ids, menuId])]);
          closeMenu();
        }}
      />
      <Sheet
        open={!!shop}
        title={shop?.name ?? "Shop"}
        onClose={() => setShopId("")}
        className="deal-detail-sheet"
      >
        {shop && (
          <>
            <div className="deal-shop-summary">
              <img src={shop.logo} alt="" />
              <div>
                <p>
                  {ui("save_06f8f0")}
                  {shop.offer} {ui("onOrdersOver")}
                  {shop.threshold}
                </p>
                <button
                  className="pill"
                  aria-pressed={state.followed.includes(shop.id)}
                  onClick={() => state.toggleFollow(shop.id)}
                >
                  {state.followed.includes(shop.id)
                    ? ui("following")
                    : ui("follow")}
                </button>
              </div>
            </div>
            <p className="sheet-copy">
              {ui("theCapturedDealAndItemsAreShownBelowAComplete")}
            </p>
            <div className="deal-product-rail">
              {shop.productIds.map((id) => (
                <DealCard
                  key={id}
                  product={dealListings.find((item) => item.id === id)!}
                  onOpen={() => setProductId(id)}
                />
              ))}
            </div>
            <button
              className="primary form-submit"
              onClick={() => setShopId("")}
            >
              {ui("returnToDeals")}
            </button>
          </>
        )}
      </Sheet>
      <Sheet
        open={!!product}
        title={product?.title ?? ui("capturedItem")}
        onClose={() => setProductId("")}
        className="deal-detail-sheet"
      >
        {product && (
          <>
            <img
              className="deal-detail-photo"
              src={product.images[0]}
              alt={product.title}
            />
            <p className="deal-detail-seller">{product.sellerName}</p>
            <strong>{formatMoney(product.price, intlLocale)}</strong>
            <p className="sheet-copy">{product.detailUnavailable}</p>
            <button
              className="primary form-submit"
              aria-pressed={state.saved.includes(product.id)}
              onClick={() => state.toggleSaved(product.id)}
            >
              {state.saved.includes(product.id)
                ? ui("removeFromSaved")
                : ui("saveItem")}
            </button>
            <Link className="pill deal-view-saved" href="/saved">
              {ui("viewSaved")}
            </Link>
          </>
        )}
      </Sheet>
      <Sheet
        open={!!unidentifiedStoreId}
        title={ui("additionalCapturedProducts")}
        onClose={() => setUnidentifiedStoreId("")}
      >
        <p className="sheet-copy">
          {ui("onlyTheEdgeOfTheNextProductPhotographAppearsIn")}
        </p>
        <button
          className="primary form-submit"
          onClick={() => setUnidentifiedStoreId("")}
        >
          {ui("returnToDeals")}
        </button>
      </Sheet>
    </ShopSurface>
  );
}
