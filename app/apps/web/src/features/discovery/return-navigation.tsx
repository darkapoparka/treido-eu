"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type ComponentProps,
} from "react";

type ReturnPosition = {
  href: string;
  y: number;
  selector: string;
  index: number;
  scrollers: ScrollPosition[];
  navigationTab: string;
};
type ScrollPosition = {
  depth: number;
  tag: string;
  className: string;
  left: number;
  top: number;
};
const returns = new Map<string, ReturnPosition>();
let pendingReturn: { token: string; destination: string } | null = null;
let pendingTop: { origin: string; destination: string } | null = null;
let pendingNavigation: { destination: string; tab: string } | null = null;
let restoreFrame = 0;
let observedPath: string | null = null;
type Props = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

function rememberScrollers(target: HTMLElement | undefined): ScrollPosition[] {
  const positions: ScrollPosition[] = [];
  let owner = target?.parentElement;
  let depth = 1;
  while (
    owner &&
    owner !== document.body &&
    owner !== document.documentElement
  ) {
    const style = getComputedStyle(owner);
    if (
      (owner.scrollWidth > owner.clientWidth &&
        /auto|scroll/.test(style.overflowX)) ||
      (owner.scrollHeight > owner.clientHeight &&
        /auto|scroll/.test(style.overflowY))
    )
      positions.push({
        depth,
        tag: owner.tagName,
        className: owner.className,
        left: owner.scrollLeft,
        top: owner.scrollTop,
      });
    owner = owner.parentElement;
    depth += 1;
  }
  return positions;
}

function restoreScrollers(target: HTMLElement, positions: ScrollPosition[]) {
  for (const position of positions) {
    let owner: HTMLElement | null = target;
    for (let depth = 0; depth < position.depth; depth += 1)
      owner = owner?.parentElement ?? null;
    if (
      !owner ||
      owner.tagName !== position.tag ||
      owner.className !== position.className
    )
      continue;
    owner.scrollTo({
      left: position.left,
      top: position.top,
      behavior: "instant",
    });
    // Visiting an item can reorder a recent rail. Preserve that real history
    // and the old offset unless it would leave the return control wholly hidden.
    const control = target.getBoundingClientRect();
    const bounds = owner.getBoundingClientRect();
    const left = bounds.left + owner.clientLeft;
    const right = left + owner.clientWidth;
    const delta =
      control.right <= left
        ? control.left - left
        : control.left >= right
          ? control.right - right
          : 0;
    if (delta)
      owner.scrollTo({ left: owner.scrollLeft + delta, behavior: "instant" });
  }
}

function restoreSourceReturn(token: string) {
  cancelAnimationFrame(restoreFrame);
  const position = readReturnPosition(token);
  if (!position) return;
  let attempts = 0;
  let previousHeight = -1;
  let settled = 0;
  const restore = () => {
    const origin = window.history.state?.shopSourceReturnOrigin;
    const matching =
      origin === token &&
      `${location.pathname}${location.search}${location.hash}` ===
        position.href;
    // A source entry can also own cart/filter history. Never restore a page
    // control behind one of those dialogs, even while streaming settles.
    if (matching && document.querySelector("dialog[open]")) return;
    const target = matching
      ? document.querySelectorAll<HTMLElement>(position.selector)[
          position.index
        ]
      : undefined;
    const height = document.documentElement.scrollHeight;
    settled = height === previousHeight ? settled + 1 : 0;
    previousHeight = height;
    if (
      target?.isConnected &&
      !target.closest('[data-shop-interactive="false"]') &&
      settled >= 2
    ) {
      restoreScrollers(target, position.scrollers);
      window.scrollTo({ top: position.y, behavior: "instant" });
      target.focus({ preventScroll: true });
      return;
    }
    if (++attempts < 180) restoreFrame = requestAnimationFrame(restore);
  };
  restoreFrame = requestAnimationFrame(restore);
}

/** Native Back can arrive before its streamed source has mounted. */
export function useSourceReturn(ready: boolean) {
  const pathname = usePathname();
  useEffect(() => {
    if (!ready) return;
    if (pendingTop && pendingTop.origin !== location.pathname) {
      const destination = pendingTop.destination;
      pendingTop = null;
      // Reset only the arrived destination. The source history entry retains
      // its native scroll position even if a later reload clears our return map.
      if (destination === `${location.pathname}${location.search}`)
        window.scrollTo({ top: 0, behavior: "instant" });
    }
    const restore = (committed = false) => {
      const crossedRoute =
        observedPath !== null && observedPath !== location.pathname;
      observedPath = location.pathname;
      // Sheet entries inherit the origin token. Only a return from another
      // route can restore it; a same-route pop must retain the sheet's focus.
      if (!crossedRoute && !committed) return;
      const token = window.history.state?.shopSourceReturnOrigin;
      const position = readReturnPosition(token);
      if (
        position?.href ===
        `${location.pathname}${location.search}${location.hash}`
      )
        restoreSourceReturn(token);
    };
    const popped = () => restore();
    window.addEventListener("popstate", popped);
    // Retry after a slow streamed source mounts; an early popstate probe may
    // have expired. Same-route sheet history still does not restore the page.
    restore(pathname === location.pathname);
    return () => window.removeEventListener("popstate", popped);
  }, [ready, pathname]);
}

/** Record the page opener before a sheet takes ownership of a temporary entry. */
export function rememberSourcePosition(selector: string, index = 0) {
  observedPath = location.pathname;
  const token = crypto.randomUUID();
  returns.set(token, {
    href: `${location.pathname}${location.search}${location.hash}`,
    y: scrollY,
    navigationTab: readNavigationTab(location.pathname),
    selector,
    index,
    scrollers: rememberScrollers(
      document.querySelectorAll<HTMLElement>(selector)[index],
    ),
  });
  window.history.replaceState(
    {
      ...window.history.state,
      shopSourceReturnOrigin: token,
      shopSourceReturnPosition: returns.get(token),
    },
    "",
    location.href,
  );
  pendingReturn = null;
  pendingNavigation = null;
  return token;
}

/** An explicit same-page owner may restore its own control, never a sheet's. */
export function restoreSourcePosition(selector: string) {
  const token = window.history.state?.shopSourceReturnOrigin;
  if (readReturnPosition(token)?.selector === selector)
    restoreSourceReturn(token);
}

export function rememberSourceReturn(
  destination: string,
  selector: string,
  index = 0,
) {
  const token = rememberSourcePosition(selector, index);
  bindSourceDestination(token, destination);
}

/** A consumed sheet can launch from the page position recorded on opening. */
export function bindSourceDestination(token: string, destination: string) {
  if (!returns.has(token)) return;
  pendingReturn = {
    token,
    destination: new URL(destination, location.href).pathname,
  };
  pendingNavigation = {
    destination: pendingReturn.destination,
    tab: returns.get(token)!.navigationTab,
  };
}

/** Carry only our return owner through an explicitly owned query transition. */
export function sourceReturnState(
  data: Record<string, unknown>,
  advance: boolean,
) {
  const navigation = window.history.state?.shopSourceNavigation;
  if (navigation) data = { ...data, shopSourceNavigation: navigation };
  const token = window.history.state?.shopSourceReturnToken;
  if (!readReturnPosition(token)) return data;
  const depth = window.history.state?.shopSourceReturnDepth;
  return {
    ...data,
    shopSourceReturnToken: token,
    shopSourceReturnTarget: { token, position: returns.get(token) },
    shopSourceReturnDepth:
      (Number.isSafeInteger(depth) && depth >= 0 ? depth : 0) +
      (advance ? 1 : 0),
  };
}

export function SourceLink({
  href,
  onNavigate,
  sourceKey,
  startAtTop = false,
  ...props
}: Props & { sourceKey?: string; startAtTop?: boolean }) {
  const element = useRef<HTMLAnchorElement>(null);
  const id =
    sourceKey ??
    `${href}|${props.className ?? ""}|${props["aria-label"] ?? ""}`;
  return (
    <Link
      {...props}
      href={href}
      ref={element}
      data-source-return={id}
      onNavigate={(event) => {
        pendingTop = null;
        const selector = `[data-source-return="${CSS.escape(id)}"]`;
        rememberSourceReturn(
          href,
          selector,
          [...document.querySelectorAll(selector)].indexOf(element.current!),
        );
        if (!startAtTop) {
          onNavigate?.(event);
          return;
        }
        let cancelled = false;
        onNavigate?.({
          preventDefault() {
            cancelled = true;
            event.preventDefault();
          },
        });
        const destination = new URL(href, location.href);
        if (
          !cancelled &&
          startAtTop &&
          props.scroll !== false &&
          destination.pathname !== location.pathname &&
          !destination.hash
        )
          pendingTop = {
            origin: location.pathname,
            destination: `${destination.pathname}${destination.search}`,
          };
      }}
    />
  );
}

/** A route's Close action returns to its owned entry; false leaves its fallback. */
export function useContextualClose() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (pendingReturn?.destination !== pathname) return;
    // Bind the return to this actual destination entry. Forward restores the
    // token, whereas a later unrelated visit to the same route has no token.
    window.history.replaceState(
      {
        ...window.history.state,
        shopSourceReturnToken: pendingReturn.token,
        shopSourceReturnDepth: 0,
        shopSourceReturnTarget: {
          token: pendingReturn.token,
          position: returns.get(pendingReturn.token),
        },
      },
      "",
      location.href,
    );
    pendingReturn = null;
  }, [pathname]);
  return () => {
    const token = window.history.state?.shopSourceReturnToken;
    if (!readReturnPosition(token)) return false;
    const depth = window.history.state.shopSourceReturnDepth;
    if (Number.isSafeInteger(depth) && depth > 0) window.history.go(-depth - 1);
    else router.back();
    restoreSourceReturn(token);
    return true;
  };
}

/** Close returns to the actual entry point; direct URLs keep their fallback. */
export function ContextualCloseLink({ href, onNavigate, ...props }: Props) {
  const close = useContextualClose();
  return (
    <Link
      {...props}
      href={href}
      onNavigate={(event) => {
        if (!close()) {
          onNavigate?.(event);
          return;
        }
        event.preventDefault();
      }}
    />
  );
}

// Product/merchant excursions retain their originating native dock selection.
// Entry-local history keeps Back, Forward and reload independent.
const navigationEvent = "shop-source-navigation";
const navigationTabs = new Set(["/", "/search", "/explore", "/orders"]);
export function navigationTabForPath(pathname: string): string {
  if (pathname === "/orders/history") return "/";
  if (pathname.startsWith("/orders")) return "/orders";
  if (pathname.startsWith("/search")) return "/search";
  if (pathname.startsWith("/explore") || pathname.startsWith("/minis"))
    return "/explore";
  return "/";
}
function readNavigationTab(pathname: string): string {
  const fallback = navigationTabForPath(pathname);
  if (!/^\/(products|stores)(\/|$)/.test(pathname)) return fallback;
  if (pendingNavigation?.destination === pathname) {
    const tab = pendingNavigation.tab;
    if (tab && navigationTabs.has(tab)) return tab;
  }
  const saved = window.history.state?.shopSourceNavigation;
  return saved?.pathname === pathname && navigationTabs.has(saved.tab)
    ? saved.tab
    : fallback;
}
function subscribeNavigation(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener(navigationEvent, listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener(navigationEvent, listener);
  };
}
export function useSourceNavigationTab(pathname: string, enabled: boolean) {
  const fallback = navigationTabForPath(pathname);
  const tab = useSyncExternalStore(
    subscribeNavigation,
    () => (enabled ? readNavigationTab(pathname) : fallback),
    () => fallback,
  );
  useEffect(() => {
    if (!enabled || location.pathname !== pathname) return;
    // Persist the actual history entry, not the provisional server render.
    const currentTab = readNavigationTab(pathname);
    if (pendingNavigation?.destination === pathname) pendingNavigation = null;
    const saved = window.history.state?.shopSourceNavigation;
    if (saved?.pathname === pathname && saved.tab === currentTab) return;
    window.history.replaceState(
      {
        ...window.history.state,
        shopSourceNavigation: { pathname, tab: currentTab },
      },
      "",
      location.href,
    );
    window.dispatchEvent(new Event(navigationEvent));
  }, [enabled, pathname, tab]);
  return tab;
}

/** Restore our own serialized source after a full page reload, without storage
 * shared between tabs or accounts. Only coordinates and the source selector
 * travel with the browser entry; nothing is sent to a provider. */
function readReturnPosition(token: unknown): ReturnPosition | undefined {
  // A direct entry has no return token. Two absent tokens must not be treated
  // as a matching record before its position is read.
  if (typeof token !== "string" || !token) return;
  const known = returns.get(token);
  if (known) return known;
  const state = window.history.state;
  const target = state?.shopSourceReturnTarget;
  const position =
    state?.shopSourceReturnOrigin === token
      ? state.shopSourceReturnPosition
      : target?.token === token
        ? target.position
        : undefined;
  if (
    !position ||
    typeof position.href !== "string" ||
    typeof position.selector !== "string" ||
    !Number.isFinite(position.y) ||
    !Number.isSafeInteger(position.index) ||
    position.index < 0 ||
    !Array.isArray(position.scrollers)
  )
    return;
  returns.set(token, position);
  return position;
}
