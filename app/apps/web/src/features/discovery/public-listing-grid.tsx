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
import {
  PublicStockLabel,
  unavailablePublicStock,
  publicMediaLabelsClass,
} from "./public-stock";
import s from "./marketplace.module.css";
export function PublicListingGrid({
  items,
  placements,
  rail = false,
  compact = false,
  shelf = false,
}: {
  items: PublicListingCard[];
  placements?: PromotionPlacement[];
  rail?: boolean;
  compact?: boolean;
  /** Existing Shop shelf cards, without the Marketplace grid/facts wrapper. */
  shelf?: boolean;
}) {
  const display =
    placements ?? items.map((listing) => ({ listing, sponsored: null }));
  return (
    <div
      className={
        (rail ? "product-rail" : "product-grid") +
        (shelf || (rail && compact) ? "" : " " + s.grid)
      }
    >
      {display.map((placement) =>
        shelf || (rail && compact) ? (
          <PublicShelfListing
            key={placement.listing.id}
            placement={placement}
            compact={compact}
          />
        ) : (
          <PublicListing
            key={placement.listing.id}
            placement={placement}
            compact={compact}
          />
        ),
      )}
    </div>
  );
}
function PublicShelfListing({
  placement,
  compact,
}: {
  placement: PromotionPlacement;
  compact: boolean;
}) {
  const { listing, sponsored } = placement;
  const locale = useLocale();
  const observation = useSponsoredObservation<HTMLElement>(
    sponsored?.token,
    listing.id,
  );
  const label = sponsored
    ? locale === "bg"
      ? sponsored.labelBg
      : sponsored.label
    : undefined;
  return (
    <ProductCard
      publicMedia
      product={label && !compact ? { ...listing, promotion: label } : listing}
      compact={compact}
      showPromotion={!!label && !compact}
      showRating={false}
      storeName={compact ? undefined : listing.seller.name}
      saveControl={<ListingSaveButton id={listing.id} title={listing.title} />}
      observation={observation}
      mediaLabel={
        unavailablePublicStock(listing.stockState) ? (
          <div className={publicMediaLabelsClass}>
            <PublicStockLabel state={listing.stockState} media />
            {compact && label && (
              <span className="public-home-sponsored">{label}</span>
            )}
          </div>
        ) : compact && label ? (
          <span className="public-home-sponsored">{label}</span>
        ) : undefined
      }
    />
  );
}
function PublicListing({
  placement,
  compact,
}: {
  placement: PromotionPlacement;
  compact: boolean;
}) {
  const { listing: item, sponsored } = placement;
  const inventoryText = useTranslations("inventory");
  const t = useTranslations("marketplace"),
    locale = useLocale();
  const { ref, onClick } = useSponsoredObservation(sponsored?.token, item.id);
  return (
    <div
      className={s.listing}
      data-compact-listing={compact || undefined}
      ref={ref}
      onClick={onClick}
    >
      <ProductCard
        publicMedia
        product={
          sponsored && !compact
            ? {
                ...item,
                promotion:
                  locale === "bg" ? sponsored.labelBg : sponsored.label,
              }
            : item
        }
        compact={compact}
        showPromotion={!!sponsored && !compact}
        showRating={false}
        saveControl={<ListingSaveButton id={item.id} title={item.title} />}
      />
      {compact && sponsored && (
        <span className="public-home-sponsored">
          {locale === "bg" ? sponsored.labelBg : sponsored.label}
        </span>
      )}
      {!compact && (
        <>
          <p className={s.facts}>
            {optionLabel(item.condition, locale)}
            {item.locality ? " · " + item.locality : ""}
            {item.stockState && item.stockState !== "unknown"
              ? " · " + inventoryText(item.stockState)
              : ""}
          </p>
          <SourceLink
            className={s.sellerLink}
            href={"/stores/" + item.seller.id + "?lang=" + locale}
          >
            {item.seller.name}
            <span>{t(item.seller.kind)}</span>
          </SourceLink>
        </>
      )}
    </div>
  );
}
