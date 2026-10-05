"use client";

import { useLocale, useTranslations } from "next-intl";
import { FloatingNav } from "./components";
import { ShopSurface } from "./hydration-boundary";
import { Icon } from "./icons";
import { SourceLink } from "./return-navigation";
import "./deals.css";

/** Seller discounts have no approved production offer model yet. */
export function MarketplaceDeals() {
  const language = useLocale();
  const ui = useTranslations("discoveryUI");
  const bg = language === "bg";
  return (
    <ShopSurface className="shop-page deals-page">
      <h1>{ui("deals")}</h1>
      <div className="deals-filter-rail">
        <SourceLink
          className="deals-search"
          href="/search"
          aria-label={ui("search")}
        >
          <Icon name="search" />
        </SourceLink>
      </div>
      <div className="empty-state">
        <p>
          {bg
            ? "Все още няма оферти от продавачи за показване."
            : "There are no seller deals to show yet."}
        </p>
        <SourceLink className="pill" href="/search">
          {bg ? "Разгледай пазара" : "Browse the marketplace"}
        </SourceLink>
      </div>
      <FloatingNav back marketplace />
    </ShopSurface>
  );
}
