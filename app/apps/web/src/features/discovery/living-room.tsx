"use client";
import { useTranslations } from "next-intl";
import type { Catalog } from "../catalog/types";
import { projectLivingRoom } from "../catalog/reference/live-living-room-fixtures";
import { CurationCollection } from "./curation-collection";

export function LivingRoomCuration({ catalog }: { catalog: Catalog }) {
  const ui = useTranslations("discoveryUI");
  return (
    <CurationCollection
      title={ui("livingRoomGlowUp")}
      description="Chic lighting, side tables, and linen layers."
      category="Home"
      categoryHref="/explore/Home"
      categoryIcon="/api/reference-media/live-home-collection-category-icon"
      shareId="living-room-share-url"
      catalog={catalog}
      products={projectLivingRoom(catalog.products)}
    />
  );
}
