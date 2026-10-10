"use client";
/* eslint-disable @next/next/no-img-element -- Published media keeps the existing Shop image element and geometry. */
import { useCallback, useState, type ComponentProps } from "react";
import { useLocale } from "next-intl";
import s from "./public-image.module.css";

type Props = Pick<
  ComponentProps<"img">,
  "alt" | "className" | "loading" | "decoding" | "draggable" | "onDragStart"
> & { alt: string; src?: string };

/** A changed publication image owns a new load. No captured-image fallback. */
export function PublicListingImage(props: Props) {
  return <CurrentImage key={props.src ?? "missing"} {...props} />;
}

function CurrentImage({ src, alt, ...props }: Props) {
  const locale = useLocale();
  const [failed, setFailed] = useState(false);
  // Cached failures can finish before hydration attaches the error listener.
  const imageRef = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth === 0) setFailed(true);
  }, []);
  const text = locale === "bg" ? "Снимката не е налична" : "Image unavailable";
  if (!src || failed)
    return (
      <span
        className={s.unavailable}
        role="img"
        aria-label={alt ? text + ": " + alt : text}
        data-public-image="unavailable"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <circle cx="8" cy="8" r="1.5" />
          <path d="m4 18 5-5 3 3 4-6 5 8" />
        </svg>
        <span aria-hidden="true">{text}</span>
      </span>
    );
  return <img {...props} ref={imageRef} src={src} alt={alt} onError={() => setFailed(true)} />;
}
