"use client";
/* eslint-disable @next/next/no-img-element -- Private verified source photographs. */
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import type { Catalog, Product } from "../catalog/types";
import { ShopSurface } from "./hydration-boundary";
import { FloatingNav, IconButton, ProductCard, Sheet } from "./components";
import { SourceLink } from "./return-navigation";
import { SourceShareFields } from "./source-share-fields";
import "./curation-collection.css";

export function CurationCollection({
  title,
  description,
  category,
  categoryHref,
  categoryIcon,
  shareId,
  products,
  catalog,
  children,
}: {
  title: string;
  description: string;
  category: string;
  categoryHref: string;
  categoryIcon: string;
  shareId: string;
  products: readonly Product[];
  catalog: Catalog;
  children?: ReactNode;
}) {
  const ui = useTranslations("discoveryUI");
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  return (
    <ShopSurface className="shop-page android-live native-curation-collection">
      <header className="native-curation-heading">
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <IconButton
        icon="share-android"
        label={ui("shareValue1", { value1: title ?? "" })}
        className="native-curation-share"
        onClick={() => {
          setShareUrl(window.location.href);
          setCopyStatus("");
          setSharing(true);
        }}
        data-ui-label="shareValue1"
      />
      <SourceLink
        className="native-curation-category"
        href={categoryHref}
        startAtTop
      >
        <img src={categoryIcon} alt="" />
        {category}
      </SourceLink>
      <div className="product-grid native-curation-grid">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            storeName={
              catalog.stores.find((store) => store.id === product.storeId)?.name
            }
            showPromotion={false}
          />
        ))}
      </div>
      {children}
      <FloatingNav android back fade />
      <Sheet
        open={sharing}
        title={ui("sharingLink")}
        className="curation-share-sheet"
        onClose={() => setSharing(false)}
      >
        <SourceShareFields
          id={shareId}
          label={ui("linkToThisCollection")}
          url={shareUrl}
          status={copyStatus}
          onStatus={setCopyStatus}
        />
      </Sheet>
    </ShopSurface>
  );
}
