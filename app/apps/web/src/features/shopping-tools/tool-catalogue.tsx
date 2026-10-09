"use client";
/* eslint-disable @next/next/no-img-element */
import { useLayoutEffect, useRef } from "react";
import { getImageProps } from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  MiniCatalogHeading,
  MiniCatalogRowContent,
  MiniCatalogSurface,
} from "../discovery/minis-catalog";
import { FloatingNav, IconButton } from "../discovery/components";
import { Icon } from "../discovery/icons";
import {
  rememberSourcePosition,
  restoreSourcePosition,
  SourceLink,
} from "../discovery/return-navigation";
import { useMiniRoute } from "../discovery/mini-navigation";
import { foldDiscoveryText } from "../catalog/public-discovery-model";
import {
  productMiniHref,
  productMinis,
  searchProductMinis,
  type ProductMini,
} from "./tool-catalog";
import { useProductMiniVisits } from "./tool-visits";
import { toolCopy } from "./copy";
import styles from "./tool-catalogue.module.css";

const iconAtlasSource = getImageProps({
  src: "/minis/treido-tool-icons.png",
  width: 288,
  height: 144,
  alt: "",
}).props.src;

function ProductMiniIcon({
  tool,
  recent = false,
  featured = false,
}: {
  tool: ProductMini;
  recent?: boolean;
  featured?: boolean;
}) {
  const [column, row] = tool.iconPosition;
  return (
    <span
      className={`${styles.icon}${recent ? ` ${styles.recentIcon}` : ""}${featured ? ` ${styles.featureIcon}` : ""}`}
      style={{
        backgroundImage: `url("${iconAtlasSource}")`,
        backgroundPosition: `${(column * 100) / 3}% ${row * 100}%`,
      }}
      aria-hidden="true"
    />
  );
}

/** Real tool destinations use the same catalogue owners as guarded source replay. */
export function ProductMiniCatalogue() {
  const locale = useLocale() === "en" ? "en" : "bg";
  const ui = useTranslations("discoveryUI"),
    t = toolCopy[locale];
  const router = useRouter();
  const { params: source, change } = useMiniRoute("/minis");
  const tools = productMinis(locale);
  const history = useProductMiniVisits();
  // Catalogue presentation is separate from the incoming marketplace q.
  // Keeping it on this history entry restores the actual results after Back.
  const searching = source.get("miniSearch") === "1";
  const query = source.get("miniQuery") ?? "";
  const searchOrigin = useRef<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const wasSearching = useRef(false);
  const search = foldDiscoveryText(query);
  const results = searchProductMinis(locale, query, history.visits);
  const recent = history.visits.flatMap((id) => {
    const tool = tools.find((entry) => entry.id === id);
    return tool ? [tool] : [];
  });
  const cancelSearch = () => {
    if (searchOrigin.current) router.back();
    else change({ miniSearch: null, miniQuery: null }, true);
  };
  const editQuery = (value: string | null) =>
    change({ miniQuery: value }, true, {
      productMiniSearchOrigin: searchOrigin.current,
    });
  useLayoutEffect(() => {
    if (searching) {
      wasSearching.current = true;
      const origin = window.history.state?.productMiniSearchOrigin;
      if (typeof origin === "string") searchOrigin.current = origin;
      input.current?.focus({ preventScroll: true });
    } else if (wasSearching.current) {
      wasSearching.current = false;
      const opener = 'button[data-ui-label="searchMinis"]';
      restoreSourcePosition(opener);
      document
        .querySelector<HTMLButtonElement>(opener)
        ?.focus({ preventScroll: true });
    }
  }, [searching]);
  const row = (tool: ProductMini) => {
    const href = productMiniHref(tool.id, locale, new URLSearchParams(source));
    return (
      <SourceLink
        key={tool.id}
        href={href}
        preserveDiscoveryContext={false}
        data-mini-id={tool.id}
        onClick={() => history.visit(tool.id)}
      >
        <MiniCatalogRowContent
          name={tool.name}
          description={tool.description}
          icon={<ProductMiniIcon tool={tool} />}
        />
      </SourceLink>
    );
  };
  return (
    <MiniCatalogSurface android publicData searching={searching}>
      {searching ? (
        <>
          <header className="native-mini-searchbar">
            <label>
              <Icon name="search" />
              <input
                ref={input}
                className={styles.searchInput}
                id="native-mini-search"
                type="search"
                aria-label={ui("searchMinis")}
                placeholder={ui("search")}
                value={query}
                onChange={(event) => editQuery(event.target.value || null)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    cancelSearch();
                  }
                }}
                data-ui-label="searchMinis"
              />
              {query && (
                <button
                  className={styles.clearButton}
                  type="button"
                  aria-label={ui("clearSearch")}
                  onClick={() => {
                    editQuery(null);
                    input.current?.focus({ preventScroll: true });
                  }}
                  data-ui-label="clearSearch"
                >
                  <Icon name="close" />
                </button>
              )}
            </label>
            <button
              className={styles.cancelButton}
              type="button"
              onClick={cancelSearch}
            >
              {ui("cancel")}
            </button>
          </header>
          {!search && results.length > 0 && <h2>{ui("recentlyViewed")}</h2>}
          <div className="mini-list native-mini-search-results">
            {results.map(row)}
          </div>
          {search && results.length === 0 && (
            <p className="sheet-copy" role="status">
              {t.catalogNoResults}
            </p>
          )}
        </>
      ) : (
        <>
          <MiniCatalogHeading>
            <IconButton
              icon="search"
              label={ui("searchMinis")}
              data-ui-label="searchMinis"
              onClick={() => {
                searchOrigin.current = rememberSourcePosition(
                  'button[data-ui-label="searchMinis"]',
                );
                change({ miniSearch: "1", miniQuery: null }, false, {
                  productMiniSearchOrigin: searchOrigin.current,
                });
              }}
            />
          </MiniCatalogHeading>
          <div
            className="mini-carousel"
            aria-label={ui("featuredMinis")}
            tabIndex={0}
          >
            {tools
              .filter((tool) => tool.hero)
              .map((tool) => (
                <SourceLink
                  className="mini-feature"
                  key={tool.id}
                  data-mini-id={tool.id}
                  href={productMiniHref(
                    tool.id,
                    locale,
                    new URLSearchParams(source),
                  )}
                  preserveDiscoveryContext={false}
                  onClick={() => history.visit(tool.id)}
                >
                  <img
                    {...getImageProps({
                      src: tool.hero!,
                      width: 1708,
                      height: 921,
                      sizes: "(max-width:480px) calc(100vw - 56px), 371px",
                      alt: "",
                    }).props}
                    alt=""
                  />
                  <div>
                    <MiniCatalogRowContent
                      icon={<ProductMiniIcon tool={tool} featured />}
                      name={tool.name}
                      description={tool.description}
                    />
                  </div>
                </SourceLink>
              ))}
          </div>
          {recent.length > 0 && (
            <>
              <h2>{ui("recentlyViewed")}</h2>
              <div className={`mini-recent ${styles.recentRail}`}>
                {recent.map((tool) => (
                  <SourceLink
                    key={tool.id}
                    aria-label={tool.name}
                    preserveDiscoveryContext={false}
                    href={productMiniHref(
                      tool.id,
                      locale,
                      new URLSearchParams(source),
                    )}
                    onClick={() => history.visit(tool.id)}
                  >
                    <ProductMiniIcon tool={tool} recent />
                  </SourceLink>
                ))}
              </div>
            </>
          )}
          {[...new Set(tools.map((tool) => tool.group))].map((group) => (
            <section className="native-mini-group" key={group}>
              <h2>{group}</h2>
              <div className="mini-list-pages">
                <div className="mini-list">
                  {tools.filter((tool) => tool.group === group).map(row)}
                </div>
              </div>
            </section>
          ))}
        </>
      )}
      <FloatingNav android back fade />
    </MiniCatalogSurface>
  );
}
