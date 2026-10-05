"use client";
import { useTranslations } from "next-intl";
import type { PublicListingCard } from "../catalog/public-discovery-model";
import type { PromotionPlacement } from "../promotions/placement";
import { useSponsoredObservation } from "./use-sponsored-observation";
import { ProductCard } from "./product-card";
import { ListingSaveButton } from "../library/controls";
import { SourceLink } from "./return-navigation";
import { optionLabel } from "../selling/copy";
import { useLocale } from "next-intl";
import s from "./marketplace.module.css";
export function PublicListingGrid({
  items,
  placements,
  rail = false,
}: {
  items: PublicListingCard[];
  placements?: PromotionPlacement[];
  rail?: boolean;
}) {
  const display =
    placements ?? items.map((listing) => ({ listing, sponsored: null }));
  return (
    <div className={(rail ? "product-rail " : "product-grid ") + s.grid}>
      {display.map((placement) => (
        <PublicListing key={placement.listing.id} placement={placement} />
      ))}
    </div>
  );
}
function PublicListing({ placement }: { placement: PromotionPlacement }) {
  const { listing: item, sponsored } = placement;
  const inventoryText = useTranslations("inventory");
  const t = useTranslations("marketplace"),
    locale = useLocale();
  const { ref, onClick } = useSponsoredObservation(sponsored?.token, item.id);
  return (
    <div
      className={s.listing}
      ref={ref}
      onClick={onClick}
    >
      <ProductCard
        product={
          sponsored
            ? {
                ...item,
                promotion:
                  locale === "bg" ? sponsored.labelBg : sponsored.label,
              }
            : item
        }
        showPromotion={!!sponsored}
        showRating={false}
        saveControl={<ListingSaveButton id={item.id} title={item.title} />}
      />
      <p className={s.facts}>
        {optionLabel(item.condition, locale)}
        {item.locality ? " · " + item.locality : ""}
        {item.stockState && item.stockState !== "unknown"
          ? " · " + inventoryText(item.stockState)
          : ""}
      </p>
      <SourceLink
        className={s.sellerLink}
        preserveDiscoveryContext={false}
        href={"/stores/" + item.seller.id + "?lang=" + locale}
      >
        {item.seller.name}
        <span>{t(item.seller.kind)}</span>
      </SourceLink>
    </div>
  );
}
