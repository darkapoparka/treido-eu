"use client";
import type { Catalog } from "../catalog/types";
import { CurationCollection } from "./curation-collection";
export function StaudCuration({ catalog }: { catalog: Catalog }) {
  return (
    <CurationCollection
      title="Brand Spotlight: Staud"
      description="Timeless pieces with a contemporary touch."
      category="Womenswear"
      categoryHref="/explore/Women"
      categoryIcon="/api/reference-media/live-staud-category-icon"
      shareId="staud-share-url"
      catalog={catalog}
      products={catalog.products.filter(
        (product) => product.storeId === "live-staud",
      )}
    />
  );
}
