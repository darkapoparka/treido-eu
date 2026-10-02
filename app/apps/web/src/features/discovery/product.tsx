"use client";
import { displayCount } from "../locale/number-display";
import { useLocale as useIntlLocale } from "next-intl";
import { useTranslations } from "next-intl";
import { ShopSurface } from "./hydration-boundary";
/* eslint-disable @next/next/no-img-element */
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { ProductOptions } from "./reviews";
import { ProductColorOptions } from "./product-color-options";
import { ProductUnavailable } from "./product-unavailable";
import { ProductVariantOptions } from "./product-variant-options";
import { ReviewStars } from "./review-feedback";
import { ProductAdditionFlight, useProductAddition } from "./product-addition";
import { rememberSourceReturn } from "./return-navigation";
import { formatMoney, variantSelectionLimit } from "../catalog/types";
import {
  FloatingNav,
  IconButton,
  StoreRow,
  consumeSheetHistory,
  commitSheetQuery,
} from "./components";
import { Icon } from "./icons";
import { CartOverlay as Cart, CartOffer } from "../commerce/checkout";
import { useDiscovery } from "./state";
import { useAccount } from "../account/state";
import styles from "./product-detail.module.css";
import "./product.css";
import { ProductInformationSheet } from "./product-information-sheet";
import { ProductSellerRecommendations } from "./product-seller-recommendations";
import type { ProductDetailPageView } from "../catalog/product-context-model";
import { useProductContext, ProductContextStatus } from "./product-context";
import { useProductGallery } from "./use-product-gallery";
import { ProductGalleryRail, ProductLightbox } from "./product-gallery-view";
import { useProductSaving } from "./use-product-saving";
import { ProductSavePicker } from "./product-save-picker";
import { ProductPriceSummary } from "./product-price-summary";
import { ProductContentSections } from "./product-content-sections";
import { ProductDelivery } from "./product-delivery";
export { CartOverlay as Cart } from "../commerce/checkout";
export function ProductDetail({ data }: { data: ProductDetailPageView }) {
  const intlLocale = useIntlLocale();
  const ui = useTranslations("discoveryUI");
  const { product, seller: store, related } = data.view;
  const context = useProductContext(product, data.context);
  const catalog = context.value.cart;
  const contextStatus =
    context.pending || context.error ? (
      <ProductContextStatus context={context} />
    ) : undefined;
  const state = useDiscovery(),
    router = useRouter();
  const { hasPaymentProfile } = useAccount();
  const searchParams = useSearchParams();
  const [quantity, setQuantity] = useState(1),
    [localVariant, setVariant] = useState(
      product.variants.find(
        (v) =>
          (v.referenceColor || v.referenceOptions) &&
          v.id === searchParams.get("variant"),
      )?.id ??
        product.variants.find((v) => v.id === product.referenceDefaultVariantId)
          ?.id ??
        product.variants.find((v) => variantSelectionLimit(v) > 0)?.id ??
        product.variants[0]?.id ??
        "",
    );
  const nativeOptions =
    product.referenceStyle === "android" &&
    product.variants.some(
      (option) => option.referenceColor || option.referenceOptions,
    );
  // Native selections follow the actual history entry, not stale component state.
  const variant = nativeOptions
    ? (product.variants.find(
        (option) => option.id === searchParams.get("variant"),
      )?.id ??
      product.variants.find(
        (option) => option.id === product.referenceDefaultVariantId,
      )?.id ??
      product.variants.find((option) => variantSelectionLimit(option) > 0)
        ?.id ??
      product.variants[0]?.id ??
      "")
    : localVariant;
  const [shareUrl, setShareUrl] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const [cart, setCart] = useState(false),
    [offer, setOffer] = useState(false),
    [offerPending, setOfferPending] = useState(false),
    [added, setAdded] = useState(false),
    [detail, setDetail] = useState(""),
    [options, setOptions] = useState(false),
    [subscription, setSubscription] = useState(false);
  const saving = useProductSaving(product.id);
  const { setPicker, setToast } = saving;
  const [reportNotesOpen, setReportNotesOpen] = useState(false);
  const reportMerchant = reportNotesOpen
    ? product.detail?.reportNotesMerchant
    : undefined;
  const merchantRatingCount =
    reportMerchant?.ratingCount ?? product.detail?.merchantRatingCount;
  const merchantLogoOutline =
    reportMerchant?.logoOutline ?? product.detail?.merchantLogoOutline;
  const [postalCode, setPostalCode] = useState(
    product.detail?.delivery?.postalCode ?? "94025",
  );
  const [postalDraft, setPostalDraft] = useState(
    product.detail?.delivery?.postalCode ?? "94025",
  );
  const [priceAlertTip, setPriceAlertTip] = useState(
    () =>
      product.referenceStyle !== "android" &&
      !state.viewedProducts.includes(product.id) &&
      !state.saved.includes(product.id) &&
      state.viewedItems[0]?.kind === "store" &&
      state.viewedItems[0]?.id === product.storeId,
  );
  useEffect(() => {
    if (!priceAlertTip) return;
    const timer = setTimeout(() => setPriceAlertTip(false), 5000);
    return () => clearTimeout(timer);
  }, [priceAlertTip]);
  const addition = useProductAddition();
  const productUnderlay = useRef<HTMLDivElement>(null);
  const [cartPresentation, setCartPresentation] = useState<{
    scrollY: number;
    peekScroll: number;
    documentHeight: number;
    pathname: string;
  } | null>(null);
  useLayoutEffect(() => {
    if (!cart || !cartPresentation || !productUnderlay.current) return;
    const underlay = productUnderlay.current;
    underlay.scrollTop = cartPresentation.peekScroll;
    return () => {
      underlay.scrollTop = 0;
      requestAnimationFrame(() => {
        if (window.location.pathname === cartPresentation.pathname)
          window.scrollTo({
            top: cartPresentation.scrollY,
            behavior: "instant",
          });
      });
    };
  }, [cart, cartPresentation]);
  const viewProduct = state.viewProduct;
  useEffect(() => {
    viewProduct(product.id);
  }, [product.id, viewProduct]);
  const selected =
    product.variants.find((v) => v.id === variant) ?? product.variants[0];
  const quantityLimit = variantSelectionLimit(selected);
  const android = product.referenceStyle === "android";
  const nativeSoldOut =
    android &&
    Boolean(
      selected?.referenceUnavailable || selected?.referenceColor?.unavailable,
    );
  const shea = product.id === "shea-butter",
    bag = product.id === "shampoo-bag";
  const offerAmount = new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const capturedSpendOffer = ui("saveSavingsWhenYouSpendMinimum", {
    savings: offerAmount.format(store?.promotionSavings ?? 20),
    minimum: offerAmount.format(50),
  });
  const photos = shea
    ? [
        "/api/reference-media/shea-gallery-hero",
        "/api/reference-media/shea-gallery-testimonial",
        "/api/reference-media/shea-gallery-benefits",
        "/api/reference-media/shea-gallery-hand",
        "/api/reference-media/shea-gallery-shower",
      ]
    : (selected?.referenceImage ?? selected?.referenceColor?.photo)
      ? [
          selected.referenceImage ?? selected.referenceColor!.photo,
          ...(product.detail?.colorGallery ?? product.images).filter(
            (src) =>
              src !==
              (selected.referenceImage ?? selected.referenceColor?.photo),
          ),
        ]
      : product.images;
  const galleryController = useProductGallery(photos, android);
  const { galleryRail } = galleryController;
  function selectColor(id: string) {
    const next = product.variants.find((option) => option.id === id);
    if (!next || (!next.referenceColor && !next.referenceOptions)) return;
    setVariant(id);
    setQuantity(1);
    setAdded(false);
    const query = new URLSearchParams(window.location.search);
    query.set("variant", id);
    commitSheetQuery(query);
    requestAnimationFrame(() =>
      galleryRail.current?.scrollTo({ left: 0, behavior: "instant" }),
    );
  }
  const price =
    subscription && shea
      ? { ...product.price, amount: 1050 }
      : (selected?.referencePrice ?? product.price);
  function add(showFeedback = true) {
    if (!quantityLimit) return;
    const prior =
      state.cart.find(
        (l) => l.productId === product.id && l.variantId === variant,
      )?.quantity ?? 0;
    const increment = Math.min(quantity, quantityLimit - prior);
    if (increment <= 0) return;
    if (
      showFeedback &&
      bag &&
      !addition.begin(photos[0], product.title, increment)
    )
      return;
    state.add({
      productId: product.id,
      variantId: variant,
      quantity: prior + increment,
    });
    setAdded(true);
    if (showFeedback && bag) setOfferPending(true);
  }
  function showCart() {
    // The source retains the bottom of the shopper's visible product viewport
    // above the cart. Keep that same DOM and restore the original scroll on exit.
    const underlayTop =
      productUnderlay.current?.getBoundingClientRect().top ?? 0;
    setCartPresentation({
      scrollY: window.scrollY,
      peekScroll: Math.max(0, window.innerHeight - 196 - underlayTop),
      documentHeight: document.documentElement.scrollHeight,
      pathname: window.location.pathname,
    });
    setCart(true);
  }
  function openCart() {
    // The recording leaves the product interactive after its flight/confirmation.
    // Open the pending offer through a real cart action, not an invented network
    // timer that steals focus several seconds after the shopper moves elsewhere.
    if (
      offerPending &&
      state.cart.some((line) => line.productId === product.id)
    ) {
      setOfferPending(false);
      setOffer(true);
    } else showCart();
  }
  function buy() {
    if (!quantityLimit) return;
    add(false);
    if (!store) {
      // An unidentified seller must not enter another seller's captured checkout.
      // Product selection and cart editing still work without a provider call.
      setDetail("Checkout preview");
      return;
    }
    // Only an owned overlay entry should be replaced. Ordinary Buy now must
    // keep the product in browser history for checkout cancellation.
    (consumeSheetHistory() ? router.replace : router.push)(
      `/checkout?store=${encodeURIComponent(store.id)}${hasPaymentProfile ? "" : "&stage=phone"}`,
    );
  }
  const description = shea
    ? "Super-hydrating formula moisturizes your skin (you won’t even need body lotion post-shower!) Small plant-derived exfoliants gently exfoliate to reveal softer skin."
    : bag
      ? "Mesh fabric creates a thick, foamy lather for luxurious washing. Our patented design preserves the life of your bar."
      : product.description;
  // Flow 17's Shea preview and bag preview are distinct compositions. Preserve
  // their paragraph breaks and visible excerpts without truncating the full
  // description or assigning the bag Shea's ingredients (flow 32 changes item).
  const descriptionPreview = shea
    ? [
        "Super-hydrating formula moisturizes your skin (you won’t even need body lotion post-shower!)",
        "Small plant-derived exfoliants gently exfoliate to reveal softer skin...",
      ]
    : bag
      ? [
          "Mesh fabric creates a thick, foamy lather for luxurious washing.",
          "Our patented design preserves the life...",
        ]
      : [description];
  return (
    <ShopSurface
      className={`shop-page product-page ${cart ? "cart-visible" : ""} ${photos.length ? "" : styles.detailsOnly} ${product.referenceStyle === "android" ? "android-live android-product" : ""}`}
      data-product-id={product.id}
      data-native-photo={
        product.referenceImageTreatment === "native" || undefined
      }
      data-merchant-outline={merchantLogoOutline === false ? "none" : undefined}
      data-price-tip={priceAlertTip ? "visible" : "dismissed"}
      onPointerDownCapture={() => {
        if (priceAlertTip) setPriceAlertTip(false);
      }}
      style={
        cart && cartPresentation
          ? { minHeight: cartPresentation.documentHeight }
          : undefined
      }
    >
      <ProductAdditionFlight flight={addition.flight} />
      <span className="sr-only" aria-live="polite">
        <span
          key={addition.announcementId}
          data-addition-announcement={addition.announcementId}
        >
          {addition.announcement}
        </span>
      </span>
      <div className="product-underlay" ref={productUnderlay}>
        {store && (
          <StoreRow
            store={
              merchantRatingCount
                ? { ...store, ratingCount: merchantRatingCount }
                : store
            }
            onMore={() => setOptions(true)}
          />
        )}
        <ProductGalleryRail
          product={product}
          photos={photos}
          controller={galleryController}
        />
        <section className="product-details">
          <div className="product-heading">
            <h1>
              {android &&
              product.detail?.titleNoWrapSuffix &&
              product.title.endsWith(product.detail.titleNoWrapSuffix) ? (
                <>
                  {product.title.slice(
                    0,
                    -product.detail.titleNoWrapSuffix.length,
                  )}
                  <span className="native-product-title-suffix">
                    {product.detail.titleNoWrapSuffix}
                  </span>
                </>
              ) : (
                product.title
              )}
            </h1>
            <IconButton
              icon="heart"
              label={ui("saveProduct")}
              pressed={state.saved.includes(product.id)}
              onClick={() => {
                setPriceAlertTip(false);
                if (product.referenceStyle === "android") {
                  state.toggleSaved(product.id);
                  return;
                }
                if (!state.saved.includes(product.id))
                  state.toggleSaved(product.id);
                setToast(false);
                setPicker(true);
              }}
              data-ui-label="saveProduct"
            />
            <IconButton
              icon="share"
              label={ui("shareProduct")}
              onClick={async () => {
                if (android) {
                  setShareUrl(window.location.href);
                  setShareStatus("");
                  setDetail("Sharing link");
                  return;
                }
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  setDetail("Link copied");
                } catch {
                  setDetail("Share product");
                }
              }}
              data-ui-label="shareProduct"
            />
            {priceAlertTip && (
              <p className="product-price-alert-tip" role="note">
                {ui("getAlertsForPriceDrops")}
                <br />
                {ui("onSavedItems")}
              </p>
            )}
          </div>
          {product.rating !== undefined && (
            <button
              className="rating review-link"
              onClick={() => {
                rememberSourceReturn(
                  `/products/${product.id}/reviews`,
                  ".product-details > .review-link",
                );
                router.push(`/products/${product.id}/reviews`);
              }}
            >
              <ReviewStars
                rating={
                  android ? product.rating : Math.round(product.rating * 2) / 2
                }
                label={ui("value1OutOf5Stars", {
                  value1: product.rating ?? "",
                })}
              />{" "}
              {displayCount(product.ratingCount, intlLocale)}{" "}
              {ui("ratings_2e5d92")}
            </button>
          )}
          <ProductPriceSummary
            product={product}
            selected={selected}
            variant={variant}
            price={price}
            capturedSpendOffer={capturedSpendOffer}
            onDetails={setDetail}
          />
          {android && product.detail?.optionGroups && selected && (
            <ProductVariantOptions
              product={product}
              selected={selected}
              onChange={selectColor}
            />
          )}
          {android &&
            !product.detail?.optionGroups &&
            selected?.referenceColor && (
              <ProductColorOptions
                variants={product.variants}
                value={variant}
                onChange={selectColor}
              />
            )}
          {android &&
            !selected?.referenceColor &&
            product.color &&
            product.detail?.colorSwatch && (
              <fieldset className="pdp-color-choice">
                <legend>
                  <strong>{ui("color")}</strong> {product.color}
                </legend>
                <button
                  type="button"
                  aria-label={"Color: " + product.color}
                  aria-pressed="true"
                  onClick={() => setVariant(selected.id)}
                >
                  <img src={product.detail.colorSwatch} alt="" />
                </button>
              </fieldset>
            )}
          {product.variants.length > 1 &&
            !selected?.referenceColor &&
            !product.detail?.optionGroups && (
              <fieldset className="variants">
                <legend>{ui("size")}</legend>
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    disabled={!variantSelectionLimit(v)}
                    className="pill"
                    aria-pressed={variant === v.id}
                    onClick={() => {
                      setVariant(v.id);
                      setQuantity(1);
                      setAdded(false);
                    }}
                  >
                    {v.label}
                  </button>
                ))}
              </fieldset>
            )}
          <div
            className="quantity"
            data-native-sold-out={nativeSoldOut || undefined}
          >
            <label>{ui("quantity")}</label>
            <div className="stepper">
              <IconButton
                icon="minus"
                label={ui("decreaseQuantity")}
                disabled={quantity <= 1}
                onClick={() => {
                  setQuantity((q) => Math.max(1, q - 1));
                  setAdded(false);
                }}
                data-ui-label="decreaseQuantity"
              />
              <output>{quantity}</output>
              <IconButton
                icon="plus"
                label={ui("increaseQuantity")}
                disabled={quantity >= quantityLimit}
                onClick={() => {
                  setQuantity((q) => Math.min(quantityLimit, q + 1));
                  setAdded(false);
                }}
                data-ui-label="increaseQuantity"
              />
            </div>
          </div>
          {nativeSoldOut ? (
            <ProductUnavailable
              saved={state.saved.includes(product.id)}
              onSave={() => state.toggleSaved(product.id)}
            />
          ) : shea ? (
            <div className="purchase-modes">
              <div>
                <label>
                  <span>
                    <strong>{ui("oneTimePurchase")}</strong>
                    <span className="purchase-mode-price">
                      {formatMoney(product.price, intlLocale)}
                    </span>
                  </span>
                  <input
                    type="radio"
                    name="purchase"
                    checked={!subscription}
                    onChange={() => setSubscription(false)}
                  />
                </label>
                {!subscription && (
                  <div className="purchase-actions">
                    <button onClick={buy} disabled={!quantityLimit}>
                      {ui("buyNow")}
                    </button>
                    <button
                      className="primary"
                      disabled={!quantityLimit}
                      onClick={() => add()}
                    >
                      {added ? ui("addedToCart") : ui("addToCart")}
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label>
                  <span>
                    <strong>
                      {ui("subscribeSave")} <small>{ui("save25")}</small>
                    </strong>
                    <span className="purchase-mode-price">
                      $10.50 <del>$14.00</del>
                    </span>
                  </span>
                  <input
                    type="radio"
                    name="purchase"
                    checked={subscription}
                    onChange={() => setSubscription(true)}
                  />
                </label>
                {subscription && (
                  <div className="purchase-actions">
                    <button onClick={() => setDetail("Subscription")}>
                      {ui("buyNow")}
                    </button>
                    <button
                      className="primary"
                      onClick={() => setDetail("Subscription")}
                    >
                      {ui("addToCart")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div
              className={`pdp-purchase-buttons${bag && added ? " pdp-purchase-buttons-added" : ""}`}
            >
              <button
                className="primary"
                data-addition={bag ? addition.phase : undefined}
                disabled={
                  !quantityLimit || (bag && addition.phase === "flying")
                }
                onClick={() => add()}
              >
                {bag && addition.phase === "confirmed" ? (
                  <>
                    <Icon name="check" /> {ui("addedToCart")}
                  </>
                ) : added && !bag ? (
                  ui("addedToCart")
                ) : (
                  ui("addToCart")
                )}
              </button>
              <button
                onClick={buy}
                disabled={
                  !quantityLimit ||
                  (bag &&
                    added &&
                    state.cart.some(
                      (line) =>
                        line.productId === product.id &&
                        line.variantId === variant,
                    ))
                }
              >
                {ui("buyNow")} {android && <Icon name="open-in-browser" />}
              </button>
            </div>
          )}
          {added && !bag && product.storeId === "kitsch" && (
            <button className="pdp-offer-link" onClick={() => setOffer(true)}>
              {ui("addItemsToSave20WithYourExclusiveOffer")}
            </button>
          )}
          <ProductContentSections
            product={product}
            descriptionPreview={descriptionPreview}
            hasSeller={Boolean(store)}
            onDetails={setDetail}
          />
          <ProductDelivery
            product={product}
            store={store}
            postalCode={postalCode}
            onShipTo={() => {
              setPostalDraft(postalCode);
              setDetail("Ship to");
            }}
            onDetails={setDetail}
          />
          <ProductSellerRecommendations
            product={product}
            store={store}
            related={related}
          />
        </section>
      </div>
      <FloatingNav
        android={product.referenceStyle === "android"}
        back
        cart={state.cart.length ? openCart : undefined}
      />
      <Cart
        catalog={catalog}
        content={contextStatus}
        open={cart}
        onClose={() => setCart(false)}
      />
      {store && (
        <CartOffer
          catalog={catalog}
          content={contextStatus}
          storeId={product.storeId}
          open={offer}
          onClose={() => setOffer(false)}
        />
      )}
      <ProductOptions
        productId={product.id}
        storeId={product.storeId}
        open={options}
        onClose={() => setOptions(false)}
        onReopen={() => setOptions(true)}
        onReportNotesChange={setReportNotesOpen}
      />
      <ProductLightbox
        product={product}
        photos={photos}
        controller={galleryController}
      />
      <ProductSavePicker
        product={product}
        photos={photos}
        saving={saving}
        covers={context.value.covers}
        status={contextStatus}
      />
      <ProductInformationSheet
        product={product}
        store={store}
        detail={detail}
        onDetails={setDetail}
        description={description}
        capturedSpendOffer={capturedSpendOffer}
        sharing={{
          url: shareUrl,
          status: shareStatus,
          onStatus: setShareStatus,
        }}
        delivery={{
          draft: postalDraft,
          onDraft: setPostalDraft,
          onCommit: setPostalCode,
        }}
        onViewCart={() => setCart(true)}
      />
    </ShopSurface>
  );
}
