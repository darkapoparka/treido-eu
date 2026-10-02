"use client";
import { useEffect, useRef, useState } from "react";
import { moveProductPhoto } from "./product-gallery";

export function useProductGallery(photos: readonly string[], android: boolean) {
  const [gallery, setGallery] = useState<number | null>(null);
  const galleryRail = useRef<HTMLDivElement>(null);
  const gallerySnapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (gallerySnapTimer.current) clearTimeout(gallerySnapTimer.current);
    },
    [],
  );
  const dotStart =
    android && gallery !== null
      ? Math.max(0, Math.min(gallery - 2, photos.length - 5))
      : 0;
  const dotEnd = android
    ? Math.min(photos.length, dotStart + 5)
    : photos.length;
  function queueCapturedGalleryLead(rail: HTMLDivElement) {
    if (android) return;
    if (gallerySnapTimer.current) clearTimeout(gallerySnapTimer.current);
    gallerySnapTimer.current = setTimeout(() => {
      if (!window.matchMedia("(max-width: 700px)").matches) return;
      const slides = Array.from(rail.children).filter(
        (node): node is HTMLElement => node instanceof HTMLElement,
      );
      if (!slides.length) return;
      const inset = parseFloat(getComputedStyle(rail).paddingLeft) || 16;
      let target = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (const [index, slide] of slides.entries()) {
        const candidate = Math.max(
          0,
          slide.offsetLeft - inset - (index === 0 ? 0 : 8),
        );
        const distance = Math.abs(rail.scrollLeft - candidate);
        if (distance < nearestDistance) {
          target = candidate;
          nearestDistance = distance;
        }
      }
      if (Math.abs(rail.scrollLeft - target) > 0.5) {
        const inlineSnap = rail.style.scrollSnapType;
        rail.style.scrollSnapType = "none";
        rail.scrollLeft = target;
        requestAnimationFrame(() => {
          if (inlineSnap) rail.style.scrollSnapType = inlineSnap;
          else rail.style.removeProperty("scroll-snap-type");
        });
      }
    }, 40);
  }
  function closeGallery() {
    const rail = galleryRail.current;
    const photo = gallery === null ? null : rail?.children[gallery];
    setGallery(null);
    // Align after Sheet has returned focus. Selecting a photo must not move
    // the document vertically; focus returns to that gallery control.
    requestAnimationFrame(() => {
      if (
        !rail?.isConnected ||
        !(photo instanceof HTMLElement) ||
        !photo.isConnected
      )
        return;
      photo.focus({ preventScroll: true });
      rail.scrollTo({
        left:
          rail.scrollLeft +
          photo.getBoundingClientRect().left -
          rail.getBoundingClientRect().left -
          (parseFloat(getComputedStyle(rail).scrollPaddingLeft) || 0),
        behavior: "auto",
      });
    });
  }
  function stepGallery(direction: number) {
    setGallery((index) =>
      index === null ? null : moveProductPhoto(index, direction, photos.length),
    );
  }
  return {
    gallery,
    setGallery,
    galleryRail,
    dotStart,
    dotEnd,
    queueCapturedGalleryLead,
    closeGallery,
    stepGallery,
  };
}
