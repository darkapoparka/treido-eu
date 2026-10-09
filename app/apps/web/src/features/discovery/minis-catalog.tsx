"use client";
import type { ReactNode } from "react";
import { ShopSurface } from "./hydration-boundary";
import styles from "./minis.module.css";
import "./live-minis.css";
import "./buyer-surface.css";

/** Catalogue presentation shared by source replay and actual Treido tools. */
export function MiniCatalogSurface({
  children,
  android = false,
  searching = false,
  publicData = false,
}: {
  children: ReactNode;
  android?: boolean;
  searching?: boolean;
  publicData?: boolean;
}) {
  return (
    <ShopSurface
      className={`shop-page minis-page ${styles.catalog} ${android ? "android-live android-minis" : ""}${publicData ? " buyer-surface buyer-public" : ""}`}
      data-searching={searching || undefined}
    >
      {children}
    </ShopSurface>
  );
}

export function MiniCatalogHeading({ children }: { children: ReactNode }) {
  return (
    <header className="section-heading">
      <h1>Minis</h1>
      {children}
    </header>
  );
}

export function MiniCatalogRowContent({
  icon,
  name,
  description,
}: {
  icon: ReactNode;
  name: string;
  description: string;
}) {
  return (
    <>
      {icon}
      <span>
        <strong>{name}</strong>
        <p>{description}</p>
      </span>
    </>
  );
}
