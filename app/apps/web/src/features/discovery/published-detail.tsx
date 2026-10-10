"use client";
import { PublicInventoryPanel } from "../inventory/public-panel";
import type { PublicInventory } from "../inventory/model";
import { LibraryProvider } from "../library/provider";
import {
  ListingSaveButton,
  ListingCollectionButton,
  SellerFollowButton,
} from "../library/controls";
import libraryStyles from "../library/library.module.css";
import Link from "next/link";
import { SourceLink } from "./return-navigation";
import { PublicListingGrid } from "./public-listing-grid";
import type { PublicListingCard } from "../catalog/public-discovery-model";
import { useEffect, useState } from "react";
import { useDiscovery } from "./state";
import { useLocale, useTranslations } from "next-intl";
import { getCategory } from "@treido/contracts/categories";
import type { PublishedListing } from "../catalog/published-model";
import type { ProductDetailProduct } from "../catalog/product-detail-model";
import { optionLabel } from "../selling/copy";
import { IconButton, StoreRow } from "./components";
import { ProductSurface, PublicProductDock } from "./product-shell";
import { ProductGalleryRail, ProductLightbox } from "./product-gallery-view";
import { useProductGallery } from "./use-product-gallery";
import { ProductPriceSummary } from "./product-price-summary";
import { ProductDisclosure } from "./product-disclosure";
import s from "./published-detail.module.css";
import "./product.css";
export function PublishedProductDetail(
  props: Parameters<typeof PublishedProductContent>[0],
) {
  return (
    <LibraryProvider
      query={{
        view: "state",
        listingIds: [
          props.listing.id,
          ...(props.moreFromSeller ?? []).map((item) => item.id),
        ],
        sellerIds: [props.listing.seller.id],
      }}
    >
      <PublishedProductContent {...props} />
    </LibraryProvider>
  );
}
function PublishedProductContent({
  listing,
  moreFromSeller = [],
  inventory,
  paymentEntryAvailable = false,
}: {
  listing: PublishedListing;
  moreFromSeller?: PublicListingCard[];
  inventory?: PublicInventory | null;
  paymentEntryAvailable?: boolean;
}) {
  const locale = useLocale(),
    t = useTranslations("publication");
  const market = useTranslations("marketplace");
  const { viewProduct } = useDiscovery();
  useEffect(() => {
    viewProduct(listing.id);
  }, [listing.id, viewProduct]);
  const [shareStatus, setShareStatus] = useState("");
  const photos = listing.photos.map((photo) => photo.url);
  const gallery = useProductGallery(photos, false);
  const product: ProductDetailProduct = {
    id: listing.id,
    title: listing.title,
    storeId: listing.seller.id,
    images: photos,
    price: listing.price,
    description: listing.description,
    variants: [],
    ratingCount: "",
  };
  const category = getCategory(listing.categoryId);
  return (
    <ProductSurface
      published
      className={"shop-page product-page " + s.page}
      data-product-id={listing.id}
      data-publication-revision={listing.revision}
    >
      <div className="product-underlay">
        <StoreRow
          store={{ id: listing.seller.id, name: listing.seller.name }}
          href={"/stores/" + listing.seller.id + "?lang=" + locale}
          subtitle={<small className={s.muted}>{t(listing.seller.kind)}</small>}
          actions={<SellerFollowButton id={listing.seller.id} />}
        />
        <ProductGalleryRail
          product={product}
          photos={photos}
          controller={gallery}
        />
        <section className="product-details">
          <div className={"product-heading " + s.heading}>
            <h1>{listing.title}</h1>
            <ListingSaveButton
              id={listing.id}
              title={listing.title}
              overlay={false}
            />
            <IconButton
              icon="share"
              label={t("share")}
              onClick={async () => {
                const url =
                  location.origin +
                  "/products/" +
                  listing.id +
                  "?lang=" +
                  locale;
                try {
                  if (navigator.share)
                    await navigator.share({ title: listing.title, url });
                  else {
                    await navigator.clipboard.writeText(url);
                    setShareStatus(t("copied"));
                  }
                } catch (error) {
                  if (!(
                    error instanceof DOMException && error.name === "AbortError"
                  ))
                    setShareStatus(t("shareFailed"));
                }
              }}
            />
          </div>
          {shareStatus && (
            <p role="status" className={s.muted}>
              {shareStatus}
            </p>
          )}
          {inventory !== undefined ? (
            <PublicInventoryPanel
              product={product}
              revision={listing.revision}
              initial={inventory}
              allowCart={paymentEntryAvailable}
            />
          ) : (
            <ProductPriceSummary
              product={product}
              variant=""
              price={listing.price}
              capturedSpendOffer=""
              onDetails={() => {}}
            />
          )}
          {category && (
            <SourceLink
              className={s.category}
              href={"/search?category=" + category.id + "&lang=" + locale}
            >
              {category.labels[locale]}
            </SourceLink>
          )}
          <dl className={s.facts}>
            <div>
              <dt>{t("condition")}</dt>
              <dd>{optionLabel(listing.condition, locale)}</dd>
            </div>
            <div>
              <dt>{t("location")}</dt>
              <dd>{listing.locality}</dd>
            </div>
          </dl>
          <div className={s.contact}>
            <div className={libraryStyles.actions}>
              <ListingCollectionButton id={listing.id} />
            </div>
            <Link
              className="primary"
              prefetch={false}
              href={"/messages/new?listing=" + listing.id + "&lang=" + locale}
            >
              {t("message")}
            </Link>
            <p className={s.muted}>
              {t(
                paymentEntryAvailable ? "buyerPaymentNote" : "buyerContactNote",
              )}
            </p>
          </div>
          <ProductDisclosure
            title={t("description")}
            className="pdp-description"
            collapsible
          >
            <p className={s.preserve}>{listing.description}</p>
          </ProductDisclosure>
          {listing.defects && (
            <ProductDisclosure
              title={t("defects")}
              className="pdp-description"
              collapsible
            >
              <p className={s.preserve}>{listing.defects}</p>
            </ProductDisclosure>
          )}
          <ProductDisclosure
            title={t("handover")}
            className="pdp-description"
            collapsible
          >
            <p>{listing.handover.map((mode) => t(mode)).join(" · ")}</p>
            {listing.deliveryDetails && (
              <p className={s.preserve}>{listing.deliveryDetails}</p>
            )}
          </ProductDisclosure>
          {category?.kind === "leaf" && (
            <ProductDisclosure
              title={t("details")}
              className="pdp-description"
              collapsible
            >
              <dl className={s.facts}>
                {category.profile.fields.flatMap((field) => {
                  const value = listing.fields[field.id];
                  if (value === undefined || value === "") return [];
                  const display = Array.isArray(value)
                    ? value.map((v) => optionLabel(v, locale)).join(", ")
                    : typeof value === "object"
                      ? Object.values(value).filter(Boolean).join(" ")
                      : optionLabel(value, locale);
                  return (
                    <div key={field.id}>
                      <dt>{field.labels[locale]}</dt>
                      <dd>{display}</dd>
                    </div>
                  );
                })}
              </dl>
            </ProductDisclosure>
          )}
          <Link
            className={s.report}
            prefetch={false}
            href={
              "/messages/report?kind=listing&id=" +
              listing.id +
              "&lang=" +
              locale
            }
          >
            {t("report")}
          </Link>
        </section>
      </div>
      {moreFromSeller.length > 0 && (
        <section className={s.recommendations}>
          <h2>{market("moreFromSeller")}</h2>
          <PublicListingGrid items={moreFromSeller} rail />
        </section>
      )}
      <PublicProductDock />
      <ProductLightbox product={product} photos={photos} controller={gallery} />
    </ProductSurface>
  );
}
