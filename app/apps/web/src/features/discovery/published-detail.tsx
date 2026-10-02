"use client";
import Link from "next/link";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getCategory } from "@treido/contracts/categories";
import type { PublishedListing } from "../catalog/published-model";
import type { ProductDetailProduct } from "../catalog/product-detail-model";
import { optionLabel } from "../selling/copy";
import { ShopSurface } from "./hydration-boundary";
import { FloatingNav, IconButton } from "./components";
import { ProductGalleryRail, ProductLightbox } from "./product-gallery-view";
import { useProductGallery } from "./use-product-gallery";
import { ProductPriceSummary } from "./product-price-summary";
import { ProductDisclosure } from "./product-disclosure";
import s from "./published-detail.module.css";
import "./product.css";
export function PublishedProductDetail({
  listing,
}: {
  listing: PublishedListing;
}) {
  const locale = useLocale(),
    t = useTranslations("publication");
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
    <ShopSurface
      className={"shop-page product-page " + s.page}
      data-product-id={listing.id}
      data-publication-revision={listing.revision}
    >
      <div className="product-underlay">
        <div className="store-row">
          <div className="store-row-identity">
            <span className="store-logo-fallback" aria-hidden="true">
              {listing.seller.name.slice(0, 1)}
            </span>
            <span>
              <strong>{listing.seller.name}</strong>
              <small className={s.muted}>{t(listing.seller.kind)}</small>
            </span>
          </div>
        </div>
        <ProductGalleryRail
          product={product}
          photos={photos}
          controller={gallery}
        />
        <section className="product-details">
          <div className={"product-heading " + s.heading}>
            <h1>{listing.title}</h1>
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
          <ProductPriceSummary
            product={product}
            variant=""
            price={listing.price}
            capturedSpendOffer=""
            onDetails={() => {}}
          />
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
            <Link
              className="primary"
              prefetch={false}
              href={"/messages/new?listing=" + listing.id + "&lang=" + locale}
            >
              {t("message")}
            </Link>
            <p className={s.muted}>{t("buyerContactNote")}</p>
          </div>
          <ProductDisclosure
            title={t("description")}
            className="pdp-description"
          >
            <p className={s.preserve}>{listing.description}</p>
          </ProductDisclosure>
          {listing.defects && (
            <ProductDisclosure title={t("defects")} className="pdp-description">
              <p className={s.preserve}>{listing.defects}</p>
            </ProductDisclosure>
          )}
          <ProductDisclosure title={t("handover")} className="pdp-description">
            <p>{listing.handover.map((mode) => t(mode)).join(" · ")}</p>
            {listing.deliveryDetails && (
              <p className={s.preserve}>{listing.deliveryDetails}</p>
            )}
          </ProductDisclosure>
          {category?.kind === "leaf" && (
            <ProductDisclosure title={t("details")} className="pdp-description">
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
      <FloatingNav back />
      <ProductLightbox product={product} photos={photos} controller={gallery} />
    </ShopSurface>
  );
}
