"use client";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  getBrowseCategory,
  getBrowseChildren,
} from "@treido/contracts/categories";
import type { BuyerPublicView } from "../catalog/buyer-entry-model";
import { ExploreCategoryTiles } from "./explore-category-tiles";
import {
  exploreCategoryTiles,
  exploreHref,
  publicExploreShelves,
} from "./explore-model";
import { ExploreShelf } from "./explore-shelf";
import { SourceLink } from "./return-navigation";
import { PublicListingGrid } from "./public-listing-grid";
import { BuyerAvailability } from "./buyer-availability";
import { marketplaceHref } from "./marketplace-navigation";
import { useEffect, useRef } from "react";

/** The original Explore category and shelf owners consume real taxonomy and
 * eligible publications. Editorial campaigns/Minis await their public adapter;
 * they are never filled with captured reference artwork or fictional content. */
export function PublicExplore({ view }: { view: BuyerPublicView }) {
  const ui = useTranslations("discoveryUI"),
    t = useTranslations("marketplace");
  const params = useSearchParams();
  const selected = view.input.category
    ? getBrowseCategory(view.input.category)
    : null;
  const root =
    selected?.kind === "leaf" ? getBrowseCategory(selected.parentId) : selected;
  const rail = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const owner = rail.current;
    const active = owner?.querySelector<HTMLElement>('[aria-current="page"]');
    if (owner && active)
      owner.scrollTo({
        left:
          active.offsetLeft -
          owner.offsetLeft -
          (owner.clientWidth - active.clientWidth) / 2,
        behavior: "instant",
      });
  }, [selected?.id]);
  const expanded = params.get("categories") === "all";
  const tiles = exploreCategoryTiles(view);
  const shelves = publicExploreShelves(view);
  return (
    <>
      {root && (
        <div
          className="category-rail buyer-category-rail"
          ref={rail}
          aria-label={t("categoryNavigation")}
        >
          {root && (
            <>
              <SourceLink
                className="pill"
                preserveDiscoveryContext={false}
                href={marketplaceHref("/search", {
                  ...view.input,
                  category: root.id,
                  attributes: {},
                })}
              >
                {t("allItems")}
              </SourceLink>
              {getBrowseChildren(root.id).map((child) => (
                <SourceLink
                  className="pill"
                  key={child.id}
                  preserveDiscoveryContext={false}
                  aria-current={selected?.id === child.id ? "page" : undefined}
                  href={marketplaceHref(
                    child.kind === "leaf"
                      ? "/search"
                      : `/explore/${encodeURIComponent(child.id)}`,
                    {
                      ...view.input,
                      category: child.id,
                      attributes:
                        selected?.id === child.id ? view.input.attributes : {},
                    },
                  )}
                >
                  {child.labels[view.input.locale]}
                </SourceLink>
              ))}
            </>
          )}
        </div>
      )}
      {!selected && (
        <>
          <ExploreCategoryTiles tiles={expanded ? tiles : tiles.slice(0, 6)} />
          <button
            type="button"
            className="explore-more-categories"
            aria-expanded={expanded}
            aria-controls="explore-categories"
            onClick={() => {
              const query = new URLSearchParams(params);
              if (expanded) query.delete("categories");
              else query.set("categories", "all");
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
            {expanded ? ui("less") : ui("more_d47d7c")}
          </button>
        </>
      )}
      {view.unavailable ? (
        <BuyerAvailability unavailable />
      ) : shelves.length ? (
        shelves.map((shelf, index) => (
          <ExploreShelf
            key={`${shelf.categoryId}-${index}`}
            title={shelf.title}
            href={shelf.href}
            seeAllLabel={t("seeAll")}
          >
            <PublicListingGrid
              items={shelf.placements.map((placement) => placement.listing)}
              placements={shelf.placements}
              rail
              shelf
            />
          </ExploreShelf>
        ))
      ) : (
        <BuyerAvailability
          categoryLabel={selected?.labels[view.input.locale]}
        />
      )}
      {view.page?.cursorReset && <p role="status">{t("cursorReset")}</p>}
      {view.page?.nextCursor && (
        <SourceLink
          className="pill"
          preserveDiscoveryContext={false}
          href={exploreHref(view.input, view.page.nextCursor)}
        >
          {t("next")}
        </SourceLink>
      )}
    </>
  );
}
