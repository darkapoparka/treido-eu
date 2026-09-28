"use client";
import { ShopSurface } from "./hydration-boundary";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { ProductOptions } from "./reviews";
import { ProductColorOptions } from "./product-color-options";
import { ProductUnavailable } from "./product-unavailable";
import { SourceShareFields } from "./source-share-fields";
import { ProductVariantOptions } from "./product-variant-options";
import { useSheetStages } from "./sheet-stages";
import { ReviewStars } from "./review-feedback";
import { moveProductPhoto, productPhotoSwipe } from "./product-gallery";
import { ProductAdditionFlight, useProductAddition } from "./product-addition";
import { ProductReviewPreview } from "./product-review-preview";
import { ProductDisclosure, ProductSummaryCredit } from "./product-disclosure";
import { ProductDescriptionContent } from "./product-description-content";
import { rememberSourceReturn, SourceLink } from "./return-navigation";
import {
  formatMoney,
  variantSelectionLimit,
  type Catalog,
  type Product as ProductType,
} from "../catalog/types";
import {
  FloatingNav,
  IconButton,
  Sheet,
  StoreRow,
  ProductCard,
  consumeSheetHistory,
  commitSheetQuery,
} from "./components";
import { Icon } from "./icons";
import { CartOverlay as Cart, CartOffer } from "../commerce/checkout";
import { useDiscovery } from "./state";
import { COLLECTION_NAME_MAX_LENGTH } from "./saved-model";
import { useAccount } from "../account/state";
import styles from "./product-detail.module.css";
import "./product.css";
export { CartOverlay as Cart } from "../commerce/checkout";
export function ProductDetail({
  product,
  catalog,
}: {
  product: ProductType;
  catalog: Catalog;
}) {
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
  const [gallery, setGallery] = useState<number | null>(null),
    [cart, setCart] = useState(false),
    [offer, setOffer] = useState(false),
    [offerPending, setOfferPending] = useState(false),
    [added, setAdded] = useState(false),
    [detail, setDetail] = useState(""),
    [options, setOptions] = useState(false),
    [picker, setPicker] = useState(false),
    [name, setName] = useState(""),
    [toast, setToast] = useState(false),
    [subscription, setSubscription] = useState(false);
  const [reportNotesOpen, setReportNotesOpen] = useState(false);
  const reportMerchant = reportNotesOpen
    ? product.detail?.reportNotesMerchant
    : undefined;
  const merchantRatingCount =
    reportMerchant?.ratingCount ?? product.detail?.merchantRatingCount;
  const merchantLogoOutline =
    reportMerchant?.logoOutline ?? product.detail?.merchantLogoOutline;
  const pickerSubmitting = useRef(false);
  const pickerFlow = useSheetStages<"picker" | "create">({
    open: picker,
    initial: "picker",
    onClose: () => {
      setPicker(false);
      if (picker && state.saved.includes(product.id)) setToast(true);
    },
    onReopen: () => {
      pickerSubmitting.current = false;
      setPicker(true);
    },
    onStart: () => {
      setName("");
      pickerSubmitting.current = false;
    },
  });
  const creating = pickerFlow.stage === "create";
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
  const galleryRail = useRef<HTMLDivElement>(null);
  const gallerySnapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (gallerySnapTimer.current) clearTimeout(gallerySnapTimer.current);
    },
    [],
  );
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
  const photoGesture = useRef<{ pointer: number; x: number; y: number } | null>(
    null,
  );
  const viewProduct = state.viewProduct;
  useEffect(() => {
    viewProduct(product.id);
  }, [product.id, viewProduct]);
  const store = catalog.stores.find((s) => s.id === product.storeId),
    selected =
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
  const capturedSpendOffer = `Save $${store?.promotionSavings ?? 20} when you spend $50`;
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
  const dotStart =
    android && gallery !== null
      ? Math.max(0, Math.min(gallery - 2, photos.length - 5))
      : 0;
  const dotEnd = android
    ? Math.min(photos.length, dotStart + 5)
    : photos.length;
  function queueCapturedGalleryLead(rail: HTMLDivElement) {
    if (android) return;
    if (gallerySnapTimer.current) clearTimeout(gallerySnapTimer.current);
    gallerySnapTimer.current = setTimeout(() => {
      if (!window.matchMedia("(max-width: 700px)").matches) return;
      const slides = Array.from(rail.children).filter(
        (node): node is HTMLElement => node instanceof HTMLElement,
      );
      if (!slides.length) return;
      const inset = parseFloat(getComputedStyle(rail).paddingLeft) || 16;
      let target = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (const [index, slide] of slides.entries()) {
        const candidate = Math.max(
          0,
          slide.offsetLeft - inset - (index === 0 ? 0 : 8),
        );
        const distance = Math.abs(rail.scrollLeft - candidate);
        if (distance < nearestDistance) {
          target = candidate;
          nearestDistance = distance;
        }
      }
      if (Math.abs(rail.scrollLeft - target) > 0.5) {
        const inlineSnap = rail.style.scrollSnapType;
        rail.style.scrollSnapType = "none";
        rail.scrollLeft = target;
        requestAnimationFrame(() => {
          if (inlineSnap) rail.style.scrollSnapType = inlineSnap;
          else rail.style.removeProperty("scroll-snap-type");
        });
      }
    }, 40);
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
  function closeGallery() {
    const rail = galleryRail.current;
    const photo = gallery === null ? null : rail?.children[gallery];
    photoGesture.current = null;
    setGallery(null);
    // Align after Sheet has returned focus. Selecting a photo must not move
    // the document vertically; focus returns to that gallery control.
    requestAnimationFrame(() => {
      if (
        !rail?.isConnected ||
        !(photo instanceof HTMLElement) ||
        !photo.isConnected
      )
        return;
      photo.focus({ preventScroll: true });
      rail.scrollTo({
        left:
          rail.scrollLeft +
          photo.getBoundingClientRect().left -
          rail.getBoundingClientRect().left -
          (parseFloat(getComputedStyle(rail).scrollPaddingLeft) || 0),
        behavior: "auto",
      });
    });
  }
  function stepGallery(direction: number) {
    setGallery((index) =>
      index === null ? null : moveProductPhoto(index, direction, photos.length),
    );
  }
  function saveTo(id?: string, newName?: string) {
    if (pickerSubmitting.current) return;
    pickerSubmitting.current = true;
    pickerFlow.close(() => {
      if (!state.saved.includes(product.id)) state.toggleSaved(product.id);
      if (newName) state.createCollection(newName, [product.id]);
      else if (id) {
        const collection = state.collections.find((item) => item.id === id);
        if (collection && !collection.productIds.includes(product.id))
          state.updateCollection(id, {
            productIds: [...collection.productIds, product.id],
          });
      }
      setToast(true);
    });
  }
  const previousPickerStage = useRef(creating);
  useEffect(() => {
    const fromEditor = previousPickerStage.current;
    previousPickerStage.current = creating;
    if (!pickerFlow.active) return;
    const frame = requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(
          creating
            ? '.product-save-picker[open] input[aria-label="Collection name"]'
            : fromEditor
              ? ".product-save-picker[open] [data-picker-create]"
              : ".product-save-picker[open] .picker-row",
        )
        ?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [creating, pickerFlow.active]);
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
  const relatedIds = shea
    ? [
        "chocolate-body-bag",
        "sugar-body-scrub",
        "solid-shave-butter",
        "charcoal-body-wash",
      ]
    : bag
      ? ["black-conditioner-bag", "chocolate-body-bag"]
      : undefined;
  const related = relatedIds
    ? relatedIds.flatMap((id) => {
        const item = catalog.products.find((p) => p.id === id);
        if (!item) return [];
        return [
          {
            ...item,
            ...(bag
              ? {
                  images: [`/api/reference-media/pdp-bag-${id}-recommendation`],
                }
              : {}),
            ...(shea ? { promotion: "$20 off order" } : {}),
            ...(shea && id === "chocolate-body-bag"
              ? { title: "Chocolate Body Wash Bar Bag", ratingCount: "748" }
              : {}),
          },
        ];
      })
    : store
      ? catalog.products
          .filter((p) => p.storeId === product.storeId && p.id !== product.id)
          .slice(0, 4)
      : [];
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
        {photos.length > 0 && (
          <div
            className="product-gallery"
            ref={galleryRail}
            onScroll={(event) => queueCapturedGalleryLead(event.currentTarget)}
          >
            {photos.map((src, i) => (
              <button
                key={src}
                onClick={() => setGallery(i)}
                aria-label={`View product image ${i + 1}`}
                style={
                  product.referenceStyle === "android"
                    ? { aspectRatio: product.referenceImageRatio }
                    : undefined
                }
              >
                <img
                  src={src}
                  loading={
                    product.detail?.colorGallery && i > 1 ? "lazy" : undefined
                  }
                  decoding={product.detail?.colorGallery ? "async" : undefined}
                  srcSet={
                    product.referenceStyle === "android"
                      ? `${src} 1x, ${src}-3x 3x`
                      : undefined
                  }
                  alt={`${product.title}, image ${i + 1}`}
                />
              </button>
            ))}
          </div>
        )}
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
              label="Save product"
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
            />
            <IconButton
              icon="share"
              label="Share product"
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
            />
            {priceAlertTip && (
              <p className="product-price-alert-tip" role="note">
                Get alerts for price drops
                <br />
                on saved items
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
                label={`${product.rating} out of 5 stars`}
              />{" "}
              {product.ratingCount} ratings ›
            </button>
          )}
          {product.detail?.lowStock && (
            <p className={styles.stockNotice}>
              <strong>Almost gone.</strong> This item is low in stock.
            </p>
          )}
          {android &&
            product.detail?.referenceBadge &&
            (!product.detail.referenceBadgeVariantId ||
              product.detail.referenceBadgeVariantId === variant) && (
              <p
                className="native-product-badge"
                data-tone={product.detail.referenceBadgeTone}
              >
                {product.detail.referenceBadge}
                {product.detail.referenceStockBadge?.variantId === variant && (
                  <span className="native-stock-badge">
                    {product.detail.referenceStockBadge.label}
                  </span>
                )}
              </p>
            )}
          <p
            className="product-price"
            data-native-sold-out={nativeSoldOut || undefined}
          >
            {nativeSoldOut ? (
              <>
                <del>{formatMoney(price)}</del> <strong>Sold out</strong>
              </>
            ) : (
              <>
                {formatMoney(price)}{" "}
                {(selected?.referenceCompareAt ?? product.compareAt) && (
                  <del>
                    {formatMoney(
                      (selected?.referenceCompareAt ?? product.compareAt)!,
                    )}
                  </del>
                )}
              </>
            )}
            {product.detail?.markdownLabel && (
              <>
                {" "}
                <span className={styles.markdown}>
                  {product.detail.markdownLabel}
                </span>
              </>
            )}
          </p>
          {product.detail?.arrivalLabel && (
            <p className={styles.arrival}>{product.detail.arrivalLabel}</p>
          )}
          {(shea || bag || product.promotion) && (
            <button
              className="product-deal"
              onClick={() => setDetail("Offer details")}
            >
              <img
                src={`/api/reference-media/${product.detail?.promotionIcon === "plain-bag" ? "dress-deal-tag" : "deal-tag"}`}
                alt=""
              />
              <span>
                <strong
                  className={
                    product.promotion ? styles.promotionTitle : undefined
                  }
                >
                  {product.promotion ?? capturedSpendOffer}
                </strong>
                <span>
                  {product.detail?.promotionTerms ?? "Exclusive to Shop"}
                </span>
              </span>
            </button>
          )}
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
                  <strong>Color:</strong> {product.color}
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
                <legend>Size</legend>
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
            <label>Quantity</label>
            <div className="stepper">
              <IconButton
                icon="minus"
                label="Decrease quantity"
                disabled={quantity <= 1}
                onClick={() => {
                  setQuantity((q) => Math.max(1, q - 1));
                  setAdded(false);
                }}
              />
              <output>{quantity}</output>
              <IconButton
                icon="plus"
                label="Increase quantity"
                disabled={quantity >= quantityLimit}
                onClick={() => {
                  setQuantity((q) => Math.min(quantityLimit, q + 1));
                  setAdded(false);
                }}
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
                    <strong>One time purchase</strong>
                    <span className="purchase-mode-price">
                      {formatMoney(product.price)}
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
                      Buy now
                    </button>
                    <button
                      className="primary"
                      disabled={!quantityLimit}
                      onClick={() => add()}
                    >
                      {added ? "Added to cart" : "Add to cart"}
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label>
                  <span>
                    <strong>
                      Subscribe & save <small>Save 25%</small>
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
                      Buy now
                    </button>
                    <button
                      className="primary"
                      onClick={() => setDetail("Subscription")}
                    >
                      Add to cart
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
                    <Icon name="check" /> Added to cart
                  </>
                ) : added && !bag ? (
                  "Added to cart"
                ) : (
                  "Add to cart"
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
                Buy now {android && <Icon name="open-in-browser" />}
              </button>
            </div>
          )}
          {added && !bag && product.storeId === "kitsch" && (
            <button className="pdp-offer-link" onClick={() => setOffer(true)}>
              Add items to save $20 with your exclusive offer ›
            </button>
          )}
          {android && product.detail?.highlights && (
            <ProductDisclosure
              title="Highlights"
              collapsible
              className="native-product-highlights"
            >
              <ul>
                {product.detail.highlights.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
              <ProductSummaryCredit />
            </ProductDisclosure>
          )}
          <ProductDisclosure
            title="Description"
            initiallyOpen={!product.detail?.descriptionInitiallyCollapsed}
            collapsible={android}
            className={`pdp-description${bag ? " pdp-description-bag" : shea ? " pdp-description-shea" : ""}`}
          >
            {android && product.detail?.descriptionSpecs ? (
              <>
                <ProductDescriptionContent product={product} preview />
                <button
                  className="native-description-more"
                  onClick={() => setDetail("Description")}
                >
                  Read more
                </button>
              </>
            ) : (
              descriptionPreview.map((paragraph, index) => (
                <p key={paragraph}>
                  {paragraph}
                  {!product.detail?.completeDescription &&
                    index === descriptionPreview.length - 1 && (
                      <button onClick={() => setDetail("Description")}>
                        Read more
                      </button>
                    )}
                </p>
              ))
            )}
          </ProductDisclosure>
          {android && product.detail?.specifications && (
            <ProductDisclosure
              title="Specifications"
              collapsible
              initiallyOpen={false}
              className="native-product-specifications"
            >
              <dl>
                {product.detail.specifications.map(({ label, value }) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <ProductSummaryCredit />
            </ProductDisclosure>
          )}
          {android &&
            product.detail?.reviewPreview &&
            product.rating !== undefined && (
              <ProductReviewPreview
                productId={product.id}
                rating={product.rating}
                ratingCount={product.ratingCount}
                cardWidth={product.detail.reviewPreview.cardWidth}
                distribution={product.detail.reviewPreview.distribution}
                reviews={product.detail.reviewPreview.reviews}
                collapsible
              />
            )}
          {(shea || bag) && (
            <ProductReviewPreview
              productId={product.id}
              rating={product.rating ?? 4.6}
              ratingCount={shea ? "3.3K" : "3.8K"}
              distribution={shea ? [80, 9, 5, 3, 3] : [80, 9, 5, 3, 5]}
              reviews={
                shea
                  ? [
                      {
                        title: "Girlfriend loves it and I can breathe .",
                        rating: 5,
                        author: "Wes",
                        date: "13 days ago",
                      },
                      {
                        title: "How much I love your product",
                        rating: 5,
                        author: "Juanita",
                        date: "18 days ago",
                      },
                    ]
                  : [
                      {
                        title: "Curly Hair Shampoo Bar",
                        rating: 4,
                        author: "Jessica",
                        date: "Jun 22, 2026",
                      },
                      {
                        title: "Great…",
                        rating: 5,
                        initial: "S",
                        partial: true,
                      },
                    ]
              }
            />
          )}
          {!store && product.rating !== undefined && (
            <section className={styles.unrecordedReviews}>
              <h2>Reviews</h2>
              <p>
                This reference includes {product.ratingCount} ratings.
                Individual review text was not captured for this product.
              </p>
            </section>
          )}
          {store && (
            <ProductDisclosure
              className="pdp-delivery"
              title="Delivery & Returns"
              collapsible={android}
            >
              <button
                onClick={() => {
                  setPostalDraft(postalCode);
                  setDetail("Ship to");
                }}
              >
                <Icon name="location" />
                <span>
                  Ship to <b>{postalCode}</b>
                </span>
                <Icon name="chevron" style={{ transform: "rotate(90deg)" }} />
              </button>
              <p>
                <Icon name="truck" />
                {product.detail?.delivery
                  ? postalCode === product.detail.delivery.postalCode
                    ? product.detail.delivery.message
                    : "Shipping availability has not been checked for this address"
                  : "Shipping calculated at checkout"}
              </p>
              {(shea || bag) && (
                <p>
                  <Icon name="calendar" />
                  Arrives as soon as Sun, Aug 2
                </p>
              )}
              {product.detail?.delivery?.returns && (
                <p className="native-return-note">
                  <Icon name="return-package" />
                  <span>
                    {product.detail.delivery.returns.message}
                    <small>{product.detail.delivery.returns.disclaimer}</small>
                  </span>
                </p>
              )}
              <div
                data-policy-count={
                  product.detail?.delivery?.shippingPolicy === false ? 1 : 2
                }
              >
                {store.referencePolicies?.refund ? (
                  <SourceLink
                    startAtTop
                    href={`/stores/${store.id}/policies/refund`}
                  >
                    Return policy
                  </SourceLink>
                ) : (
                  <button onClick={() => setDetail("Return policy")}>
                    Return policy
                  </button>
                )}
                {product.detail?.delivery?.shippingPolicy !== false &&
                  (store.referencePolicies?.shipping ? (
                    <SourceLink
                      startAtTop
                      href={`/stores/${store.id}/policies/shipping`}
                    >
                      Shipping policy
                    </SourceLink>
                  ) : (
                    <button onClick={() => setDetail("Shipping policy")}>
                      Shipping policy
                    </button>
                  ))}
              </div>
              {store.referenceWebsite ? (
                <a
                  href={store.referenceWebsite}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Icon name="link" /> Visit {store.name}
                </a>
              ) : (
                <SourceLink startAtTop href={`/stores/${product.storeId}`}>
                  <Icon name="link" /> Visit {store.name}
                </SourceLink>
              )}
            </ProductDisclosure>
          )}
          {store && !android && (
            <article
              className={`pdp-store-card ${shea || bag ? "pdp-kitsch-card" : ""}`}
            >
              <SourceLink
                startAtTop
                href={`/stores/${store.id}`}
                aria-label={`Visit ${store.name}`}
              >
                <img
                  src={
                    shea || bag
                      ? "/api/reference-media/pdp-kitsch-art"
                      : product.images[0]
                  }
                  alt=""
                />
                <span className="pdp-store-identity">
                  <strong>{store.name}</strong>
                  <span>
                    {store.rating} ★ (
                    {shea ? "195K" : bag ? "195.2K" : store.ratingCount})
                  </span>
                </span>
              </SourceLink>
              <button
                aria-pressed={state.followed.includes(store.id)}
                onClick={() => state.toggleFollow(store.id)}
              >
                {state.followed.includes(store.id) ? "Following" : "Follow"}
              </button>
            </article>
          )}
          {related.length > 0 && (
            <>
              <h2 className="pdp-related-heading">You might also like</h2>
              <div className="product-grid">
                {related.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    showPromotion={shea}
                    storeName={store?.name}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      </div>
      <FloatingNav
        android={product.referenceStyle === "android"}
        back
        cart={state.cart.length ? openCart : undefined}
      />
      <Cart catalog={catalog} open={cart} onClose={() => setCart(false)} />
      {store && (
        <CartOffer
          catalog={catalog}
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
      <Sheet
        open={gallery !== null}
        title="Product photos"
        headerless
        className={`product-lightbox${android ? " android-product-lightbox" : ""}`}
        initialFocus=".lightbox-swipe"
        onClose={closeGallery}
      >
        {gallery !== null && (
          <>
            <IconButton
              icon="close"
              label="Close product photos"
              onClick={closeGallery}
            />
            <div
              className="lightbox-swipe"
              tabIndex={0}
              role="group"
              aria-roledescription="carousel"
              aria-label="Product photos. Use Left and Right arrow keys to change photo."
              onPointerDown={(event) => {
                if (!event.isPrimary || event.button !== 0) return;
                photoGesture.current = {
                  pointer: event.pointerId,
                  x: event.clientX,
                  y: event.clientY,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerUp={(event) => {
                const gesture = photoGesture.current;
                photoGesture.current = null;
                if (!gesture || gesture.pointer !== event.pointerId) return;
                const direction = productPhotoSwipe(gesture, {
                  x: event.clientX,
                  y: event.clientY,
                });
                if (direction) stepGallery(direction);
              }}
              onPointerCancel={() => {
                photoGesture.current = null;
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault();
                  stepGallery(event.key === "ArrowRight" ? 1 : -1);
                } else if (event.key === "Home" || event.key === "End") {
                  event.preventDefault();
                  setGallery(event.key === "Home" ? 0 : photos.length - 1);
                }
              }}
            >
              <img
                src={photos[gallery]}
                srcSet={
                  android
                    ? `${photos[gallery]} 1x, ${photos[gallery]}-3x 3x`
                    : undefined
                }
                draggable={false}
                onDragStart={(event) => event.preventDefault()}
                alt={`${product.title}, image ${gallery + 1}`}
              />
            </div>
            <div className="photo-dots">
              {photos.map((_, i) =>
                i < dotStart || i >= dotEnd ? null : (
                  <button
                    key={i}
                    aria-label={`Show photo ${i + 1}`}
                    data-edge={
                      android &&
                      ((i === dotStart && dotStart > 0) ||
                        (i === dotEnd - 1 && dotEnd < photos.length))
                        ? "small"
                        : undefined
                    }
                    aria-pressed={gallery === i}
                    onClick={() => setGallery(i)}
                  />
                ),
              )}
            </div>
          </>
        )}
      </Sheet>
      <Sheet
        open={picker && pickerFlow.active}
        manageHistory={false}
        title={creating ? "Create collection" : "Save to collection"}
        headerless={!creating}
        className={`product-save-picker ${creating ? "picker-creating" : ""}`}
        onClose={() => pickerFlow.close()}
      >
        {creating ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              saveTo(undefined, name.trim());
            }}
          >
            <input
              aria-label="Collection name"
              maxLength={COLLECTION_NAME_MAX_LENGTH}
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <div className="sheet-actions">
              <button
                type="button"
                className="pill"
                onClick={() => pickerFlow.back()}
              >
                Back
              </button>
              <button className="primary" disabled={!name.trim()}>
                Create collection
              </button>
            </div>
          </form>
        ) : (
          <>
            <button className="picker-row" onClick={() => saveTo()}>
              {photos[0] ? (
                <img src={photos[0]} alt="" />
              ) : (
                <div className="picker-collection-preview" aria-hidden="true" />
              )}
              <span>
                Saved <Icon name="lock" />
              </span>
              <span className="picker-saved-icon">
                <Icon name="heart" filled />
              </span>
            </button>
            {state.collections.map((c) => (
              <button
                className="picker-row"
                key={c.id}
                onClick={() => saveTo(c.id)}
              >
                <div className="picker-collection-preview" aria-hidden="true">
                  {c.productIds.slice(0, 4).flatMap((id) => {
                    const item = catalog.products.find((p) => p.id === id);
                    return item?.images[0]
                      ? [<img key={id} src={item.images[0]} alt="" />]
                      : [];
                  })}
                </div>
                <span>
                  {c.name} {c.visibility === "Private" && <Icon name="lock" />}
                </span>
                <Icon
                  name={c.productIds.includes(product.id) ? "check" : "plus"}
                />
              </button>
            ))}
            <button
              className="picker-row"
              data-picker-create
              onClick={() => pickerFlow.navigate("create")}
            >
              <b aria-hidden="true">+</b>Create collection
            </button>
          </>
        )}
      </Sheet>
      {toast && (
        <div className="product-saved-toast" role="status">
          {photos[0] && <img src={photos[0]} alt="" />}
          <span>
            <strong>Item saved</strong>
            <small>{product.title}</small>
          </span>
          <button
            onClick={() => {
              setToast(false);
              router.push("/saved");
            }}
          >
            View
          </button>
        </div>
      )}
      <Sheet
        open={!!detail}
        title={detail}
        className={
          detail === "Description"
            ? `product-description-sheet${shea ? " shea-description-sheet" : ""}${android ? " android-description-sheet" : ""}`
            : detail === "Sharing link"
              ? "native-source-share"
              : undefined
        }
        onClose={() => setDetail("")}
      >
        <div className="sheet-copy">
          {detail === "Sharing link" ? (
            <SourceShareFields
              id="product-share-url"
              label="Link to this product"
              url={shareUrl}
              status={shareStatus}
              onStatus={setShareStatus}
            />
          ) : detail === "Description" ? (
            <>
              {shea ? (
                <>
                  <ul role="list">
                    <li>
                      Super-hydrating formula moisturizes your skin (you
                      won&apos;t even need body lotion post-shower!)
                    </li>
                    <li>
                      Small plant-derived exfoliants gently exfoliate to reveal
                      softer skin.
                    </li>
                    <li>
                      Free of parabens, phthalates, silicones, & sulfates.
                    </li>
                    <li>
                      Made in the USA from Globally Sourced Ingredients, Vegan,
                      Cruelty Free, Leaping Bunny Certified
                    </li>
                  </ul>
                  <p>Ingredients:</p>
                  <p>
                    Sodium Sunflowerate, Sodium Cocoate, Fragrance (Parfum),
                    Butyrospermum Parkii (Shea) Butter, Sodium Chloride (Sea
                    Salt), Prunus Armeniaca (Apricot) Seed Powder, Natural
                    Tocopherol (Vitamin E), Benzaldehyde, Limonene, Citrus
                    Aurantium Amara Peel Oil, Cinnamal, Citrus Limon (Lemon)
                    Peel Oil, Linalool, Linalyl Acetate, Mentha Viridis
                    (Spearmint) Leaf Oil, Carvone, Cananga Odorata Oil/Extract,
                    Pinene, Iron Oxides (CI 77491, 77492, CI 77499).
                  </p>
                  <p>Natural Color</p>
                  <p>Free of parabens, phthalates, silicones, &amp; sulfates</p>
                  <p>Fragrance: Almond & Cherry</p>
                </>
              ) : android && product.detail?.descriptionSpecs ? (
                <ProductDescriptionContent
                  product={product}
                  onExternal={() => setDetail("")}
                />
              ) : (
                <p>{description}</p>
              )}
            </>
          ) : detail === "Offer details" ? (
            <p>
              {shea || bag
                ? `${product.promotion ?? capturedSpendOffer}. ${product.detail?.promotionTerms ?? "Exclusive to Shop"}. This is a reference offer.`
                : `${product.promotion ?? "No offer was captured."} ${product.detail?.promotionTerms ?? ""}`}
            </p>
          ) : detail === "Checkout preview" ? (
            <>
              <p>
                No seller or checkout details were included for this item.
                Nothing will be charged. Your selected size and quantity are
                available in the local cart.
              </p>
              <button
                className="primary"
                onClick={() => {
                  setDetail("");
                  setCart(true);
                }}
              >
                View cart
              </button>
            </>
          ) : detail === "Ship to" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!postalDraft.trim()) return;
                setPostalCode(postalDraft.trim());
                setDetail("");
              }}
            >
              <label>
                Postal code
                <input
                  aria-label="Postal code"
                  value={postalDraft}
                  onChange={(e) => setPostalDraft(e.target.value)}
                  required
                />
              </label>
              <button className="primary">Done</button>
            </form>
          ) : detail === "Subscription" ? (
            <p>
              Subscription selection is available in this preview. Recurring
              checkout is not connected.
            </p>
          ) : detail.includes("policy") && store ? (
            <Link href={`/stores/${product.storeId}/info`}>
              View {store.name} policies
            </Link>
          ) : (
            <p>{`/products/${product.id}`}</p>
          )}
        </div>
      </Sheet>
    </ShopSurface>
  );
}
