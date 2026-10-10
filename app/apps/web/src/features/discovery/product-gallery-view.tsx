"use client";
/* eslint-disable @next/next/no-img-element -- Preserve the verified reference image rendering. */
import { useTranslations } from "next-intl";
import { useRef } from "react";
import type { ProductDetailProduct } from "../catalog/product-detail-model";
import { IconButton, Sheet } from "./components";
import { productPhotoSwipe } from "./product-gallery";
import type { useProductGallery } from "./use-product-gallery";
import { PublicListingImage } from "./public-image";

type Props = {
  product: ProductDetailProduct;
  photos: readonly string[];
  controller: ReturnType<typeof useProductGallery>;
  publicMedia?: boolean;
};
export function ProductGalleryRail({
  product,
  photos,
  controller,
  publicMedia = false,
}: Props) {
  const ui = useTranslations("discoveryUI");
  const { galleryRail, queueCapturedGalleryLead, setGallery } = controller;
  return (
    <>
      {photos.length > 0 && (
        <div
          className="product-gallery"
          ref={galleryRail}
          onScroll={(event) => queueCapturedGalleryLead(event.currentTarget)}
        >
          {photos.map((src, i) => (
            <button
              key={src}
              onClick={() => setGallery(i)}
              aria-label={ui("viewProductImageValue1", { value1: i + 1 })}
              style={
                product.referenceStyle === "android"
                  ? { aspectRatio: product.referenceImageRatio }
                  : undefined
              }
            >
              {publicMedia ? (
                <PublicListingImage
                  src={src}
                  alt={ui("value1ImageValue2", {
                    value1: product.title ?? "",
                    value2: i + 1,
                  })}
                />
              ) : (
                <img
                  src={src}
                  loading={
                    product.detail?.colorGallery && i > 1 ? "lazy" : undefined
                  }
                  decoding={product.detail?.colorGallery ? "async" : undefined}
                  srcSet={
                    product.referenceStyle === "android"
                      ? `${src} 1x, ${src}-3x 3x`
                      : undefined
                  }
                  alt={ui("value1ImageValue2", {
                    value1: product.title ?? "",
                    value2: i + 1,
                  })}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
export function ProductLightbox({
  product,
  photos,
  controller,
  publicMedia = false,
}: Props) {
  const ui = useTranslations("discoveryUI");
  const android = product.referenceStyle === "android";
  const photoGestureRef = useRef<{
    pointer: number;
    x: number;
    y: number;
  } | null>(null);

  const {
    gallery,
    setGallery,
    dotStart,
    dotEnd,
    closeGallery: closeGalleryState,
    stepGallery,
  } = controller;
  function closeGallery() {
    photoGestureRef.current = null;
    closeGalleryState();
  }
  return (
    <Sheet
      open={gallery !== null}
      title={ui("productPhotos")}
      headerless
      className={`product-lightbox${android ? " android-product-lightbox" : ""}`}
      initialFocus=".lightbox-swipe"
      onClose={closeGallery}
    >
      {gallery !== null && (
        <>
          <IconButton
            icon="close"
            label={ui("closeProductPhotos")}
            onClick={closeGallery}
            data-ui-label="closeProductPhotos"
          />
          <div
            className="lightbox-swipe"
            tabIndex={0}
            role="group"
            aria-roledescription="carousel"
            aria-label={ui("productPhotosUseLeftAndRightArrowKeysToChange")}
            onPointerDown={(event) => {
              if (!event.isPrimary || event.button !== 0) return;
              photoGestureRef.current = {
                pointer: event.pointerId,
                x: event.clientX,
                y: event.clientY,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerUp={(event) => {
              const gesture = photoGestureRef.current;
              photoGestureRef.current = null;
              if (!gesture || gesture.pointer !== event.pointerId) return;
              const direction = productPhotoSwipe(gesture, {
                x: event.clientX,
                y: event.clientY,
              });
              if (direction) stepGallery(direction);
            }}
            onPointerCancel={() => {
              photoGestureRef.current = null;
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                stepGallery(event.key === "ArrowRight" ? 1 : -1);
              } else if (event.key === "Home" || event.key === "End") {
                event.preventDefault();
                setGallery(event.key === "Home" ? 0 : photos.length - 1);
              }
            }}
            data-ui-label="productPhotosUseLeftAndRightArrowKeysToChange"
          >
            {publicMedia ? (
              <PublicListingImage
                src={photos[gallery]}
                draggable={false}
                onDragStart={(event) => event.preventDefault()}
                alt={ui("value1ImageValue2", {
                  value1: product.title ?? "",
                  value2: gallery + 1,
                })}
              />
            ) : (
              <img
                src={photos[gallery]}
                srcSet={
                  android
                    ? `${photos[gallery]} 1x, ${photos[gallery]}-3x 3x`
                    : undefined
                }
                draggable={false}
                onDragStart={(event) => event.preventDefault()}
                alt={ui("value1ImageValue2", {
                  value1: product.title ?? "",
                  value2: gallery + 1,
                })}
              />
            )}
          </div>
          <div className="photo-dots">
            {photos.map((_, i) =>
              i < dotStart || i >= dotEnd ? null : (
                <button
                  key={i}
                  aria-label={ui("showPhotoValue1", { value1: i + 1 })}
                  data-edge={
                    android &&
                    ((i === dotStart && dotStart > 0) ||
                      (i === dotEnd - 1 && dotEnd < photos.length))
                      ? "small"
                      : undefined
                  }
                  aria-pressed={gallery === i}
                  onClick={() => setGallery(i)}
                />
              ),
            )}
          </div>
        </>
      )}
    </Sheet>
  );
}
