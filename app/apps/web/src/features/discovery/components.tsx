"use client";
/* eslint-disable @next/next/no-img-element -- Local allowlisted reference crops. */
import { displayRating, displayCount } from "../locale/number-display";
import { useLocale as useIntlLocale } from "next-intl";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { SourceLink, useSourceNavigationTab } from "./return-navigation";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { discoveryDestination } from "./browse-scope-route";
import {
  Suspense,
  useEffect,
  useRef,
  useId,
  type ReactNode,
  type PointerEvent,
} from "react";
import { Icon } from "./icons";
import { NativeIcon } from "./native-icons";
import { IconButton } from "./icon-button";
export { IconButton } from "./icon-button";
export { ProductCard, SaveButton } from "./product-card";
import { useDiscovery } from "./state";
import { useSurfaceReady } from "./hydration-boundary";
import type { Store } from "../catalog/types";
import { useLocale } from "../locale/provider";
import { localeDestination, parseLocale } from "../locale/locale";
type FloatingNavProps = {
  back?: boolean;
  cart?: () => void;
  onBack?: () => void;
  showCartWhenEmpty?: boolean;
  showExplore?: boolean;
  fade?: boolean;
  android?: boolean;
  nativeIcons?: boolean;
  marketplace?: boolean;
};
export function FloatingNav(props: FloatingNavProps) {
  return (
    <Suspense fallback={<FloatingNavContent {...props} params={null} />}>
      <ScopedFloatingNav {...props} />
    </Suspense>
  );
}
function ScopedFloatingNav(props: FloatingNavProps) {
  const params = useSearchParams();
  return <FloatingNavContent {...props} params={new URLSearchParams(params)} />;
}
function FloatingNavContent({
  back = false,
  cart,
  onBack,
  showCartWhenEmpty = false,
  showExplore = true,
  fade = false,
  android = false,
  nativeIcons = false,
  marketplace = false,
  params,
}: FloatingNavProps & { params: URLSearchParams | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const { cart: lines, viewedProducts } = useDiscovery();
  const cartQuantity = lines.reduce(
    (quantity, line) => quantity + line.quantity,
    0,
  );
  const sourceActive = useSourceNavigationTab(pathname, android);
  const active = marketplace
    ? pathname.startsWith("/messages")
      ? "/messages"
      : pathname.startsWith("/app")
        ? "/app"
        : pathname === "/"
          ? "/"
          : "/search"
    : sourceActive;
  const marketText = useTranslations("marketplace");
  const { messages } = useLocale();
  const text = messages.navigation;
  return (
    <div
      data-fade={fade || undefined}
      className={`floating-dock ${back || (cart && (showCartWhenEmpty || cartQuantity > 0)) ? "has-side-controls" : ""}`}
    >
      {back && (
        <IconButton
          icon="back"
          label={text.back}
          className="dock-back"
          native={nativeIcons}
          onClick={() => {
            if (onBack) onBack();
            else if (window.history.length > 1) router.back();
            else router.push("/");
          }}
        />
      )}
      <nav aria-label={text.main} className="floating-nav">
        {(marketplace
          ? ([
              ["/", "home", text.home],
              ["/search", "search", text.search],
              ["/messages", "chat-round", marketText("messages")],
              ["/app", "storefront", marketText("sell")],
            ] as const)
          : ([
              ["/", "home", text.home],
              ["/search", "search", text.search],
              ["/explore", "explore", text.explore],
              ["/orders", "orders", text.orders],
            ] as const)
        )
          .filter(([href]) => showExplore || href !== "/explore")
          .map(([href, icon, label]) => (
            <Link
              href={localeDestination(
                discoveryDestination(
                  android && href === "/" && viewedProducts.length > 0
                    ? "/?home=recent"
                    : href,
                  new URLSearchParams(params ?? undefined),
                ),
                parseLocale(params?.get("lang")),
              )}
              aria-label={android && href === "/search" ? text.chat : label}
              data-nav-kind={android && icon === "search" ? "chat" : icon}
              aria-current={active === href ? "page" : undefined}
              key={href}
            >
              {nativeIcons ? (
                <NativeIcon
                  name={icon === "search" ? "search-nav" : icon}
                  filled={icon !== "search"}
                />
              ) : (
                <Icon name={icon} filled={icon !== "search"} />
              )}
            </Link>
          ))}
      </nav>
      {cart && (showCartWhenEmpty || cartQuantity > 0) && (
        <button
          type="button"
          className={`icon-button dock-cart ${cartQuantity > 0 ? "cart-filled" : ""}`}
          aria-label={text.cart}
          data-focus-return="cart"
          onClick={cart}
        >
          {nativeIcons ? (
            <NativeIcon name="cart" filled />
          ) : (
            <Icon name="cart" filled />
          )}
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
export function StoreRow({
  store,
  onMore,
}: {
  store: Pick<Store, "id" | "name" | "logo" | "rating" | "ratingCount">;
  onMore?: () => void;
}) {
  const intlLocale = useIntlLocale();
  const ui = useTranslations("discoveryUI");
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
              {displayRating(store.rating, intlLocale)} ★{" "}
              {store.ratingCount &&
                `(${displayCount(store.ratingCount, intlLocale)})`}
            </span>
          )}
        </span>
      </SourceLink>
      {onMore ? (
        <IconButton
          icon="more"
          label={ui("moreOptions")}
          onClick={onMore}
          data-ui-label="moreOptions"
        />
      ) : (
        <SourceLink
          href={`/stores/${store.id}/info`}
          aria-label={ui("storeInformation")}
          data-ui-label="storeInformation"
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
  const ui = useTranslations("discoveryUI");
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
            '.floating-nav a[aria-current="page"]',
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
          <IconButton
            icon="close"
            label={ui("closeValue1", { value1: title ?? "" })}
            onClick={dismiss}
            data-ui-label="closeValue1"
          />
        </div>
      )}
      {children}
    </dialog>
  );
}
