"use client";
import { useLocale, useTranslations } from "next-intl";
import type { PublicDiscoveryPage } from "../catalog/public-discovery-model";
import type { PromotionPlacement } from "../promotions/placement";
import { formatMoney } from "../catalog/types";
import { marketplaceResultsHref } from "./marketplace-navigation";
import { ListingSaveButton } from "../library/controls";
import { SourceLink } from "./return-navigation";
import { useSponsoredObservation } from "./use-sponsored-observation";
import { BuyerAvailability } from "./buyer-availability";
import { PublicListingImage } from "./public-image";
import { PublicStockLabel } from "./public-stock";
import styles from "./search-entry.module.css";

/** Same horizontal Search result owner: media, title/price and seller link.
 * Ranking, sponsored identity and cursor come from the server projection. */
export function PublicSearchResults({
  page,
  unavailable,
}: {
  page?: PublicDiscoveryPage;
  unavailable?: boolean;
}) {
  const t = useTranslations("marketplace");
  if (unavailable || !page?.items.length)
    return <BuyerAvailability unavailable={unavailable} input={page?.input} />;
  const placements =
    page.placements ??
    page.items.map((listing) => ({ listing, sponsored: null }));
  const next = marketplaceResultsHref(page.input, page.nextCursor);
  return (
    <>
      {page.cursorReset && <p role="status">{t("cursorReset")}</p>}
      <div className="search-results">
        {placements.map((placement) => (
          <PublicSearchRow key={placement.listing.id} placement={placement} />
        ))}
      </div>
      {page.nextCursor && (
        <nav aria-label={t("pagination")}>
          <SourceLink
            className="pill"
            preserveDiscoveryContext={false}
            href={next}
          >
            {t("next")}
          </SourceLink>
        </nav>
      )}
    </>
  );
}
function PublicSearchRow({ placement }: { placement: PromotionPlacement }) {
  const { listing: item, sponsored } = placement;
  const locale = useLocale(),
    inventoryText = useTranslations("inventory");
  const { ref, onClick } = useSponsoredObservation<HTMLElement>(
    sponsored?.token,
    item.id,
  );
  return (
    <article
      ref={ref}
      onClick={onClick}
      className="result-row"
      data-result-id={item.id}
    >
      <div className="product-media">
        <SourceLink href={`/products/${item.id}`}>
          <PublicListingImage src={item.images[0]} alt={item.title} />
        </SourceLink>
        <ListingSaveButton id={item.id} title={item.title} />
      </div>
      <div>
        <SourceLink href={`/products/${item.id}`}>
          <strong>{item.title}</strong>
        </SourceLink>
        <p>
          {item.priceFrom
            ? inventoryText("from", { price: formatMoney(item.price, locale) })
            : formatMoney(item.price, locale)}
        </p>
        <PublicStockLabel state={item.stockState} />
        <div className={styles.resultMerchant}>
          <SourceLink
            className="result-store"
            href={`/stores/${item.seller.id}`}
          >
            {item.seller.name}
          </SourceLink>
          {sponsored && (
            <span className={styles.resultDeal}>
              {locale === "bg" ? sponsored.labelBg : sponsored.label}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
