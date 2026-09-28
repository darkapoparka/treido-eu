"use client";
/* eslint-disable @next/next/no-img-element */
import { SourceLink } from "./return-navigation";
import { useState } from "react";
import { formatMoney, type SavedListing } from "../catalog/types";
import { IconButton, Sheet } from "./components";
import { useDiscovery } from "./state";

export function SavedCard({
  product,
  seller,
  selected,
  onSelect,
}: {
  product: SavedListing;
  seller?: string;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const state = useDiscovery();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const saved = state.saved.includes(product.id);
  const native = product.referenceStyle === "android";
  const image = product.referenceThumbnails?.grid ?? product.images[0];
  const promotion =
    product.promotion ??
    (native &&
    product.price &&
    product.compareAt &&
    product.compareAt.amount > product.price.amount
      ? `${Math.round((1 - product.price.amount / product.compareAt.amount) * 100)}% off`
      : undefined);
  const originalPhoto =
    product.id.startsWith("idea-") ||
    product.id === "rice-bundle" ||
    product.id === "argan-liquid-combo";
  const photo = product.images[0] ? (
    <img
      src={image}
      srcSet={
        product.referenceThumbnails ? `${image} 1x, ${image}-3x 3x` : undefined
      }
      alt={onSelect ? "" : product.title}
    />
  ) : (
    <span className="sr-only">
      Product photograph was not included in the reference.
    </span>
  );
  const title = <strong>{product.title}</strong>;
  return (
    <article
      className={`saved-product ${onSelect ? "saved-choosing" : ""}`}
      data-product-id={product.id}
      data-photo-layout={product.photoLayout}
      data-original-photo={originalPhoto ? "true" : undefined}
    >
      <div className="product-media">
        {onSelect ? (
          <button
            type="button"
            aria-label={`Select ${product.title}`}
            aria-pressed={selected}
            onClick={onSelect}
          >
            {photo}
          </button>
        ) : product.detailUnavailable ? (
          <button
            type="button"
            aria-label={`View captured ${product.title}`}
            onClick={() => setDetailsOpen(true)}
          >
            {photo}
          </button>
        ) : (
          <SourceLink
            href={`/products/${product.id}`}
            aria-label={product.images[0] ? undefined : product.title}
          >
            {photo}
          </SourceLink>
        )}
        {promotion && <span className="saved-promotion">{promotion}</span>}
        <IconButton
          className={`save-button ${(onSelect ? selected : saved) ? "saved-active" : ""}`}
          icon={onSelect ? (selected ? "check" : "plus") : "heart"}
          label={
            onSelect
              ? `${selected ? "Remove" : "Add"} ${product.title}`
              : `${saved ? "Unsave" : "Save"} ${product.title}`
          }
          pressed={onSelect ? selected : saved}
          filled={onSelect ? false : undefined}
          onClick={onSelect ?? (() => state.toggleSaved(product.id))}
        />
      </div>
      {seller && <span>{seller}</span>}
      {product.detailUnavailable ? (
        <button
          type="button"
          className="saved-item-title"
          onClick={() => setDetailsOpen(true)}
        >
          {title}
        </button>
      ) : (
        <SourceLink
          className="saved-item-title"
          href={`/products/${product.id}`}
        >
          {title}
        </SourceLink>
      )}
      {product.price && (
        <b>
          {formatMoney(product.price)}
          {native && product.compareAt && (
            <>
              {" "}
              <del>{formatMoney(product.compareAt)}</del>
            </>
          )}
        </b>
      )}
      {product.variantLabel && (
        <small className="saved-variant">{product.variantLabel}</small>
      )}
      {product.detailUnavailable && (
        <Sheet
          open={detailsOpen}
          title="Captured item details"
          onClose={() => setDetailsOpen(false)}
        >
          <p className="sheet-copy">{product.detailUnavailable}</p>
          <button
            className="primary form-submit"
            onClick={() => setDetailsOpen(false)}
          >
            Back to Saved
          </button>
        </Sheet>
      )}
    </article>
  );
}
