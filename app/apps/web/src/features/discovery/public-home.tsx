"use client";
import { useLocale, useTranslations } from "next-intl";
import type { PublicDiscoveryPage } from "../catalog/public-discovery-model";
import { StoreRow } from "./components";
import { HomeMerchantCard } from "./home-merchant-card";
import { publicHomeSections } from "./public-home-model";
import { PublicListingGrid } from "./public-listing-grid";
import { SourceLink } from "./return-navigation";
import { Icon } from "./icons";
import "./public-home.css";

/** Genuine public listings use the same Home shelf presentation as reference
 * Home. This adapter has no captured catalogue or invented merchant facts. */
export function PublicHome({
  page,
}: {
  page: Pick<PublicDiscoveryPage, "items" | "placements">;
}) {
  const locale = useLocale();
  const ui = useTranslations("discoveryUI");
  const t = useTranslations("marketplace");
  return (
    <div className="home-merchant-shelves public-home">
      {publicHomeSections(page).map((section) => {
        const items = section.placements.map((placement) => placement.listing);
        const seller = section.seller;
        return (
          <HomeMerchantCard
            key={items[0].id}
            id={seller.id}
            name={seller.name}
            className="public-home-merchant"
            header={
              <StoreRow
                store={{
                  id: seller.id,
                  name: seller.name,
                  logo: "",
                  ratingCount: "",
                }}
              />
            }
            footer={
              <SourceLink
                href={`/stores/${seller.id}?lang=${locale}`}
                className="merchant-shop-all"
                aria-label={`${t("browseSeller")} · ${seller.name}`}
              >
                <strong>{ui("shopAll")}</strong>
                <span>
                  <Icon name="arrow" />
                </span>
              </SourceLink>
            }
          >
            <PublicListingGrid
              items={items}
              placements={section.placements}
              rail
              compact
            />
          </HomeMerchantCard>
        );
      })}
    </div>
  );
}
