"use client";
import { useTranslations } from "next-intl";
import type { PublicListingCard } from "../catalog/public-discovery-model";
import s from "./public-stock.module.css";

export function unavailablePublicStock(
  value: PublicListingCard["stockState"],
): value is "reserved" | "out_of_stock" {
  return value === "reserved" || value === "out_of_stock";
}

/** Only current unavailable stock adds a label; unknown never means available. */
export function PublicStockLabel({
  state,
  media = false,
}: {
  state: PublicListingCard["stockState"];
  media?: boolean;
}) {
  const t = useTranslations("inventory");
  if (!unavailablePublicStock(state)) return null;
  return (
    <span className={media ? s.media : s.copy} data-public-stock={state}>
      {t(state)}
    </span>
  );
}
export const publicMediaLabelsClass = s.labels;
