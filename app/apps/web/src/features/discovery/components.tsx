"use client";
/* eslint-disable @next/next/no-img-element -- Local allowlisted reference crops. */
import Link from "next/link";
import { SourceLink, useSourceNavigationTab } from "./return-navigation";
import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useId,
  type CSSProperties,
  type ReactNode,
  type PointerEvent,
} from "react";
import { Icon, type IconName } from "./icons";
import { ReviewStars } from "./rating-stars";
import { useDiscovery } from "./state";
import { useSurfaceReady } from "./hydration-boundary";
import { formatMoney, type Product, type Store } from "../catalog/types";
export function IconButton({
  icon,
  label,
  onClick,
  pressed,
  filled,
  disabled,
  className = "",
}: {
  icon: IconName;
  label: string;
  onClick?: () => void;
  pressed?: boolean;
  filled?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} filled={filled ?? pressed} />
    </button>
  );
}
export function FloatingNav({
  back = false,
  cart,
  onBack,
  showCartWhenEmpty = false,
  showExplore = true,
  fade = false,
  android = false,
}: {
  back?: boolean;
  cart?: () => void;
  onBack?: () => void;
  showCartWhenEmpty?: boolean;
  showExplore?: boolean;
  fade?: boolean;
  android?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { cart: lines, viewedProducts } = useDiscovery();
  const cartQuantity = lines.reduce(
    (quantity, line) => quantity + line.quantity,
    0,
  );
  const active = useSourceNavigationTab(pathname, android);
  return (
    <div
      data-fade={fade || undefined}
      className={`floating-dock ${back || (cart && (showCartWhenEmpty || cartQuantity > 0)) ? "has-side-controls" : ""}`}
    >
      {back && (
        <IconButton
          icon="back"
          label="Go back"
          className="dock-back"
          onClick={() => {
            if (onBack) onBack();
            else if (window.history.length > 1) router.back();
            else router.push("/");
          }}
        />
      )}
      <nav aria-label="Main navigation" className="floating-nav">
        {(
          [
            ["/", "home", "Home"],
            ["/search", "search", "Search"],
            ["/explore", "explore", "Explore"],
            ["/orders", "orders", "Orders"],
          ] as const
        )
          .filter(([href]) => showExplore || href !== "/explore")
          .map(([href, icon, label]) => (
            <Link
              href={
                android && href === "/" && viewedProducts.length > 0
                  ? "/?home=recent"
                  : href
              }
              aria-label={android && label === "Search" ? "Chat" : label}
              aria-current={active === href ? "page" : undefined}
              key={href}
            >
              <Icon name={icon} filled={icon !== "search"} />
            </Link>
          ))}
      </nav>
      {cart && (showCartWhenEmpty || cartQuantity > 0) && (
        <button
          type="button"
          className={`icon-button dock-cart ${cartQuantity > 0 ? "cart-filled" : ""}`}
          aria-label="Open cart"
          data-focus-return="cart"
          onClick={cart}
        >
          <Icon name="cart" filled />
          {cartQuantity > 0 && (
            <span
              className="dock-cart-count"
              data-wide={cartQuantity > 9 || undefined}
              aria-hidden="true"
            >
              {cartQuantity > 99 ? "99+" : cartQuantity}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
export function SaveButton({ product }: { product: Product }) {
  const state = useDiscovery();
  return (
    <IconButton
      className="save-button"
      icon="heart"
      label={`${state.saved.includes(product.id) ? "Unsave" : "Save"} ${product.title}`}
      pressed={state.saved.includes(product.id)}
      onClick={() => state.toggleSaved(product.id)}
    />
  );
}
export function ProductCard({
  product,
  compact = false,
  showPromotion = false,
  showRating = true,
  mediaOnly = false,
  storeName,
  ratingStyle = "stars",
  ratingStars,
  partialRatingStars,
}: {
  product: Product;
  compact?: boolean;
  showPromotion?: boolean;
  showRating?: boolean;
  mediaOnly?: boolean;
  storeName?: string;
  ratingStyle?: "stars" | "summary";
  /** The depicted star fill when a shelf snapshot differs from product details. */
  ratingStars?: number;
  /** Only these filled stars were visible; the full rating and count are unknown. */
  partialRatingStars?: number;
}) {
  const discovery = useDiscovery();
  const reported = discovery.reportedProducts.includes(product.id);
  const markdown =
    product.referenceStyle === "android" &&
    !product.promotion &&
    product.compareAt?.currency === product.price.currency &&
    product.compareAt.amount > product.price.amount
      ? Math.round(
          (100 * (product.compareAt.amount - product.price.amount)) /
            product.compareAt.amount,
        )
      : undefined;
  const showMarkdown = showPromotion && !compact && markdown !== undefined;
  const photo =
    product.referenceThumbnails?.[compact ? "shelf" : "grid"] ??
    product.images[0];
  return (
    <article
      className={`product-card ${compact ? "compact" : ""}`}
      data-product-id={product.id}
      data-native-photo={
        product.referenceImageTreatment === "native" || undefined
      }
    >
      <div className="product-media">
        <SourceLink
          href={`/products/${product.id}`}
          startAtTop={product.referenceStyle === "android"}
          aria-label={product.images[0] ? undefined : product.title}
        >
          {product.images[0] ? (
            <img
              className={reported ? "product-reported-media" : ""}
              src={photo}
              srcSet={
                product.referenceThumbnails
                  ? `${photo} 1x, ${photo}-3x 3x`
                  : undefined
              }
              alt={product.title}
            />
          ) : (
            <span className="sr-only">
              Product photograph was not included in the reference.
            </span>
          )}
        </SourceLink>
        {reported && (
          <span className="product-reported-mark">
            <Icon name="eye-off" />
          </span>
        )}
        {(compact || (showPromotion && product.promotion) || showMarkdown) && (
          <span
            className={`price-badge ${product.promotion ? "deal" : ""}`}
            data-reference-markdown={showMarkdown || undefined}
          >
            {showMarkdown
              ? `${markdown}% off`
              : (product.promotion ?? formatMoney(product.price))}
            {!showMarkdown &&
              product.referenceStyle === "android" &&
              product.compareAt && <del>{formatMoney(product.compareAt)}</del>}
          </span>
        )}
        {!reported && <SaveButton product={product} />}
      </div>
      {!compact && !mediaOnly && (
        <SourceLink
          href={`/products/${product.id}`}
          className="product-copy"
          startAtTop={product.referenceStyle === "android"}
        >
          {storeName && <span className="product-seller">{storeName}</span>}
          <strong>{product.title}</strong>
          {showRating &&
            (product.ratingCount || partialRatingStars !== undefined) && (
              <span
                className="rating"
                data-partial-rating={
                  partialRatingStars !== undefined || undefined
                }
                style={
                  partialRatingStars === undefined
                    ? undefined
                    : ({
                        "--partial-rating-stars": partialRatingStars,
                      } as CSSProperties)
                }
              >
                {ratingStyle === "summary" ? (
                  <>
                    ★ {product.rating} · {product.ratingCount} reviews
                  </>
                ) : (
                  <>
                    <ReviewStars
                      rating={ratingStars ?? product.rating ?? 5}
                      label={
                        partialRatingStars !== undefined
                          ? "Partially captured stars; full rating and review count unavailable"
                          : ratingStars === undefined &&
                              product.rating === undefined
                            ? "Captured rating"
                            : undefined
                      }
                    />{" "}
                    {product.ratingCount && `(${product.ratingCount})`}
                  </>
                )}
              </span>
            )}
          <span>
            {formatMoney(product.price)}{" "}
            {showPromotion && product.compareAt && (
              <del>{formatMoney(product.compareAt)}</del>
            )}
          </span>
        </SourceLink>
      )}
    </article>
  );
}
export function StoreRow({
  store,
  onMore,
}: {
  store: Store;
  onMore?: () => void;
}) {
  return (
    <div className="store-row">
      <SourceLink className="store-row-identity" href={`/stores/${store.id}`}>
        {store.logo ? (
          <img src={store.logo} alt="" />
        ) : (
          <span className="store-logo-fallback" aria-hidden="true">
            {store.name[0]}
          </span>
        )}
        <span>
          <strong>{store.name}</strong>
          {store.rating !== undefined && (
            <span>
              {store.rating} ★ {store.ratingCount && `(${store.ratingCount})`}
            </span>
          )}
        </span>
      </SourceLink>
      {onMore ? (
        <IconButton icon="more" label="More options" onClick={onMore} />
      ) : (
        <SourceLink
          href={`/stores/${store.id}/info`}
          aria-label="Store information"
        >
          <Icon name="more" />
        </SourceLink>
      )}
    </div>
  );
}
let pendingSheetBack: ReturnType<typeof setTimeout> | undefined;
const liveSheets = new Map<string, HTMLDialogElement>();
const committedSheetQueries = new Map<string, string>();
let sheetBodyLocks = 0;
let sheetBodyOverflow = "";
function restoreSheetQuery(url: string | undefined) {
  if (!url) return;
  const target = new URL(url, window.location.origin);
  if (target.pathname !== window.location.pathname) return;
  const state = { ...window.history.state };
  // Next's public history wrapper copies its internal state itself. Passing
  // these reserved flags would bypass its useSearchParams synchronization.
  delete state.__NA;
  delete state._N;
  window.history.replaceState(state, "", url);
}
// Criteria are committed to the page, not to a temporary overlay entry. Native
// history keeps client useSearchParams readers in sync without an RSC request.
export function commitSheetQuery(params: URLSearchParams) {
  const url = `${window.location.pathname}${params.size ? `?${params}` : ""}${window.location.hash}`;
  for (const marker of liveSheets.keys())
    committedSheetQueries.set(marker, url);
  restoreSheetQuery(url);
}
// Call before an imperative route transition from a sheet. The destination
// replaces the owned overlay entry; cleanup must not issue another back().
export function consumeSheetHistory(): boolean {
  if (!window.history.state?.shopSheet) return false;
  const state = { ...window.history.state };
  delete state.shopSheet;
  window.history.replaceState(state, "", window.location.href);
  return true;
}
export function Sheet({
  open,
  title,
  onClose,
  children,
  className = "",
  headerless = false,
  dragHandle = false,
  initialFocus,
  manageHistory = true,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  headerless?: boolean;
  dragHandle?: boolean;
  initialFocus?: string;
  // URL-owned stages already have an entry; only local overlays add one.
  manageHistory?: boolean;
}) {
  const ready = useSurfaceReady();
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const navigating = useRef(false);
  const titleId = useId();
  const drag = useRef<{
    pointerId: number;
    y: number;
    time: number;
    distance: number;
  } | null>(null);
  const closeRef = useRef(onClose);
  const entryMarker = useRef<string | null>(null);
  const dismissPending = useRef(false);
  function dismiss() {
    const marker = entryMarker.current;
    if (manageHistory && marker && window.history.state?.shopSheet === marker) {
      if (!dismissPending.current) {
        dismissPending.current = true;
        // The popstate handler closes the DOM and restores focus only after
        // the overlay history entry has retired. An immediate next navigation
        // must not race a deferred cleanup back().
        window.history.back();
      }
    } else closeRef.current();
  }
  const resetDrag = () => {
    drag.current = null;
    if (ref.current) ref.current.style.transform = "";
  };
  const dragHandlers = {
    onPointerDown(e: PointerEvent<HTMLDivElement>) {
      if (
        e.button !== 0 ||
        drag.current ||
        (e.target as HTMLElement).closest("button,a,input,textarea,select")
      )
        return;
      drag.current = {
        pointerId: e.pointerId,
        y: e.clientY,
        time: performance.now(),
        distance: 0,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      if (ref.current) ref.current.style.animation = "none";
    },
    onPointerMove(e: PointerEvent<HTMLDivElement>) {
      if (drag.current?.pointerId !== e.pointerId || !ref.current) return;
      drag.current.distance = Math.max(0, e.clientY - drag.current.y);
      ref.current.style.transform = `translateY(${drag.current.distance}px)`;
    },
    onPointerUp(e: PointerEvent<HTMLDivElement>) {
      const gesture = drag.current;
      if (!gesture || gesture.pointerId !== e.pointerId) return;
      resetDrag();
      if (e.currentTarget.hasPointerCapture(e.pointerId))
        e.currentTarget.releasePointerCapture(e.pointerId);
      const velocity =
        gesture.distance / Math.max(1, performance.now() - gesture.time);
      if (gesture.distance > 80 || (gesture.distance > 35 && velocity > 0.6))
        dismiss();
    },
    onPointerCancel(e: PointerEvent<HTMLDivElement>) {
      if (drag.current?.pointerId === e.pointerId) resetDrag();
    },
    onLostPointerCapture(e: PointerEvent<HTMLDivElement>) {
      if (drag.current?.pointerId === e.pointerId) resetDrag();
    },
  };
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const el = ref.current;
    if (!el || !ready) return;
    if (!open) {
      drag.current = null;
      if (el.open) el.close();
      el.style.transform = "";
      el.style.animation = "";
      return;
    }
    if (pendingSheetBack) clearTimeout(pendingSheetBack);
    pendingSheetBack = undefined;
    navigating.current = false;
    const returnPath = window.location.pathname;
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const returnKey = trigger?.dataset.focusReturn;
    if (sheetBodyLocks === 0) sheetBodyOverflow = document.body.style.overflow;
    sheetBodyLocks += 1;
    const marker = `sheet-${crypto.randomUUID()}`;
    entryMarker.current = marker;
    dismissPending.current = false;
    let ownsEntry = false;
    const onBack = () => {
      restoreSheetQuery(committedSheetQueries.get(marker));
      const stack = [...liveSheets.keys()];
      if (
        stack.indexOf(marker) > stack.indexOf(window.history.state?.shopSheet)
      )
        closeRef.current();
    };
    // Register before showModal: once a sheet is visible, an immediate Back
    // must dismiss it, never leave the underlying page. Strict Mode's setup /
    // cleanup / setup and replacement sheets adopt the retiring entry below;
    // only cleanup is deferred, not registration of an interactive overlay.
    if (manageHistory) {
      const historyState = { ...window.history.state, shopSheet: marker };
      if (
        window.history.state?.shopSheet &&
        !liveSheets.has(window.history.state.shopSheet)
      )
        window.history.replaceState(historyState, "", window.location.href);
      else window.history.pushState(historyState, "", window.location.href);
      liveSheets.set(marker, el);
      ownsEntry = true;
      window.addEventListener("popstate", onBack);
    }
    document.body.style.overflow = "hidden";
    if (!el.open) el.showModal();
    if (initialFocus) el.querySelector<HTMLElement>(initialFocus)?.focus();
    return () => {
      if (entryMarker.current === marker) entryMarker.current = null;
      dismissPending.current = false;
      window.removeEventListener("popstate", onBack);
      liveSheets.delete(marker);
      const committedQuery = committedSheetQueries.get(marker);
      committedSheetQueries.delete(marker);
      if (
        !navigating.current &&
        ownsEntry &&
        window.history.state?.shopSheet === marker
      ) {
        pendingSheetBack = setTimeout(() => {
          if (window.history.state?.shopSheet === marker) {
            if (committedQuery)
              window.addEventListener(
                "popstate",
                () => restoreSheetQuery(committedQuery),
                { once: true },
              );
            window.history.back();
          }
          pendingSheetBack = undefined;
        }, 0);
      }
      sheetBodyLocks -= 1;
      if (sheetBodyLocks === 0)
        document.body.style.overflow = sheetBodyOverflow;
      if (el.open) el.close();
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      else if (!navigating.current && window.location.pathname === returnPath) {
        const parent = [...liveSheets.values()]
          .reverse()
          .find((sheet) => sheet.open);
        // Saving the final cart line for later removes its dock trigger;
        // moving it back creates a new DOM node. Recover the same logical
        // control, but never move focus outside a remaining modal dialog.
        const replacement = returnKey
          ? (parent ?? document).querySelector<HTMLElement>(
              `[data-focus-return="${CSS.escape(returnKey)}"]:not([disabled])`,
            )
          : null;
        const fallback =
          replacement ??
          parent?.querySelector<HTMLElement>(
            "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
          ) ??
          document.querySelector<HTMLElement>(
            'nav[aria-label="Main navigation"] a[aria-current="page"]',
          );
        fallback?.focus({ preventScroll: true });
      }
    };
  }, [open, initialFocus, manageHistory, ready]);
  return (
    <dialog
      ref={ref}
      className={`sheet ${className}`}
      aria-labelledby={titleId}
      onClickCapture={(event) => {
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        const link =
          event.target instanceof Element
            ? event.target.closest<HTMLAnchorElement>("a[href]")
            : null;
        if (!link || link.target === "_blank" || link.hasAttribute("download"))
          return;
        const destination = new URL(link.href, window.location.href);
        if (destination.origin !== window.location.origin) return;
        // Navigation consumes the sheet entry. Replacing it avoids both an
        // obsolete duplicate entry and an asynchronous cleanup back() racing
        // the App Router's transition. Link's own onClick still runs.
        event.preventDefault();
        navigating.current = true;
        consumeSheetHistory();
        router.replace(
          `${destination.pathname}${destination.search}${destination.hash}`,
        );
      }}
      onKeyDown={(event) => {
        if (
          event.key !== "Escape" ||
          event.defaultPrevented ||
          event.nativeEvent.isComposing
        )
          return;
        // Handle each physical Escape once at the top dialog. Native cancel
        // remains available for other dismissal requests; a child cannot
        // bubble the same key into its parent or depend on close-watcher timing.
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) dismiss();
      }}
      onCancel={(e) => {
        e.preventDefault();
        dismiss();
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const bounds = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < bounds.left ||
          e.clientX > bounds.right ||
          e.clientY < bounds.top ||
          e.clientY > bounds.bottom
        )
          dismiss();
      }}
    >
      {headerless ? (
        <>
          <h2 id={titleId} className="sr-only">
            {title}
          </h2>
          {dragHandle && (
            <div
              className="sheet-drag-handle"
              aria-hidden="true"
              {...dragHandlers}
            >
              <span />
            </div>
          )}
        </>
      ) : (
        <div className="sheet-header" {...dragHandlers}>
          <h2 id={titleId}>{title}</h2>
          <IconButton icon="close" label={`Close ${title}`} onClick={dismiss} />
        </div>
      )}
      {children}
    </dialog>
  );
}
