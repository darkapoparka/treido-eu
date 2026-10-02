"use client";
/* eslint-disable @next/next/no-img-element -- Private source brand assets. */
import { useTranslations } from "next-intl";
import { useState, useEffect, type CSSProperties, type ReactNode } from "react";
import type { Store } from "../catalog/types";
import { merchantPresentation } from "../catalog/seller-presentation";
import { ShopSurface } from "./hydration-boundary";
import { SourceLink, ContextualCloseLink } from "./return-navigation";
import { NativeIcon } from "./native-icons";
import { MerchantFollowIcon } from "./merchant-follow-icon";
import { IconButton, Sheet } from "./components";
import { SourceShareFields } from "./source-share-fields";
import { useDiscovery } from "./state";
import "./native-merchant.css";
import "./merchant-system.css";
import { BrowseScopeUnavailable } from "./browse-scope";

export function MerchantShell({
  store,
  kind,
  catalogLayout,
  children,
}: {
  store: Store;
  kind: "store" | "info" | "reviews" | "collection" | "search";
  catalogLayout?: "native-listings";
  children: ReactNode;
}) {
  const theme = merchantPresentation(store);
  return (
    <ShopSurface
      className={`shop-page android-live native-merchant native-merchant-${kind}`}
      data-merchant={store.name}
      data-catalog-layout={catalogLayout}
      data-merchant-source={theme.source ?? "captured"}
      data-merchant-tone={
        /^#fff(?:fff)?$/i.test(theme.foreground) ? "dark" : "light"
      }
      style={
        {
          "--merchant-controls":
            kind === "store"
              ? (theme.storeControlBackground ?? theme.panel ?? "#ffffff40")
              : (theme.panel ?? "#ffffff40"),
          "--merchant-mark-top": `${theme.wordmarkTop ?? 74}px`,
          "--merchant-cover-height": `${theme.coverHeight ?? 364}px`,
          "--merchant-mark-width": `${theme.wordmarkWidth ?? 247.333}px`,
          "--merchant-mark-height": `${theme.wordmarkHeight ?? 106.667}px`,
          "--merchant-hero-height": theme.heroHeight
            ? `${theme.heroHeight}px`
            : "auto",
          "--merchant-bg": theme.background,
          "--merchant-ink": theme.foreground,
          "--merchant-panel": theme.panel ?? "#ffffff40",
        } as CSSProperties
      }
    >
      <BrowseScopeUnavailable storefront />
      {children}
    </ShopSurface>
  );
}

export function MerchantPhoto({
  src,
  className = "",
  alt = "",
}: {
  src: string;
  className?: string;
  alt?: string;
}) {
  return (
    <img
      className={className}
      src={src}
      srcSet={
        src.startsWith("/api/reference-media/")
          ? `${src} 1x, ${src}-3x 3x`
          : undefined
      }
      alt={alt}
    />
  );
}

export function MerchantHeader({
  store,
  profile = false,
}: {
  store: Store;
  profile?: boolean;
}) {
  const ui = useTranslations("discoveryUI");
  const state = useDiscovery();
  const followId = merchantPresentation(store).followId ?? store.id;
  const following = state.followed.includes(followId);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (profile) return;
    let frame = 0;
    const read = () => {
      const brand = document.querySelector<HTMLElement>(
        ".native-merchant-brand",
      );
      if (brand) setCollapsed(brand.getBoundingClientRect().bottom + 40 <= 0);
    };
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(read);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [profile]);
  const [sharing, setSharing] = useState(false);
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("");
  return (
    <>
      <header
        className={`native-merchant-toolbar ${profile ? "is-profile" : ""}`}
        data-collapsed={collapsed}
      >
        {profile ? (
          <ContextualCloseLink
            className="icon-button"
            href={`/stores/${store.id}`}
            aria-label={ui("closeStoreInformation")}
            data-ui-label="closeStoreInformation"
          >
            <NativeIcon name="close" />
          </ContextualCloseLink>
        ) : (
          <SourceLink
            className="icon-button"
            href={`/stores/${store.id}/info`}
            aria-label={ui("storeInformation")}
            data-ui-label="storeInformation"
          >
            {collapsed && <MerchantAvatar store={store} />}
            <NativeIcon name="menu" />
          </SourceLink>
        )}
        {!profile && (
          <SourceLink
            className="native-merchant-search"
            href={`/stores/${store.id}/search`}
            aria-label={ui("searchStore")}
            data-ui-label="searchStore"
          >
            <NativeIcon name="search" />
            <span>{ui("searchThisStore")}</span>
          </SourceLink>
        )}
        <button
          className="pill native-merchant-follow"
          aria-pressed={following}
          aria-label={following ? ui("unfollow") : ui("follow")}
          data-following={following}
          onClick={() => state.toggleFollow(followId)}
        >
          {following ? <MerchantFollowIcon /> : ui("follow")}
        </button>
        {profile && (
          <IconButton
            native
            icon="share-android"
            label={ui("shareStore")}
            onClick={() => {
              setUrl(new URL(`/stores/${store.id}`, location.origin).href);
              setStatus("");
              setSharing(true);
            }}
            data-ui-label="shareStore"
          />
        )}
      </header>
      <Sheet
        open={sharing}
        title={ui("sharingLink")}
        onClose={() => setSharing(false)}
      >
        <SourceShareFields
          id={`merchant-${store.id}`}
          label={ui("linkToThisStore")}
          url={url}
          status={status}
          onStatus={setStatus}
        />
      </Sheet>
    </>
  );
}

export function MerchantIdentity({ store }: { store: Store }) {
  const ui = useTranslations("discoveryUI");
  const p = merchantPresentation(store);
  return (
    <div className="native-merchant-identity">
      <MerchantAvatar store={store} />
      <div>
        <b>{store.name}</b>
        {(p.rating ?? store.rating) !== undefined && (
          <SourceLink
            href={`/stores/${store.id}/reviews`}
            aria-label={ui("readValue1Reviews", { value1: store.name ?? "" })}
          >
            {p.rating ?? store.rating} ★ ({p.ratingCount ?? store.ratingCount})
          </SourceLink>
        )}
      </div>
    </div>
  );
}

export function MerchantAvatar({ store }: { store: Store }) {
  const src = merchantPresentation(store).avatar || store.logo;
  return src ? (
    <MerchantPhoto src={src} />
  ) : (
    <span className="native-merchant-monogram" aria-hidden="true">
      {store.name
        .split(/[\s-]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => Array.from(s)[0])
        .join("")
        .toUpperCase()}
    </span>
  );
}
