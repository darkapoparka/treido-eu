"use client";
import type { ComponentPropsWithoutRef } from "react";
import { ShopSurface } from "./hydration-boundary";
import { FloatingNav } from "./components";
import "./product-shell.css";

/** Shared Shop product geometry; public data never opts into reference assets. */
export function ProductSurface({
  className = "",
  shopPresentation = true,
  published = false,
  ...props
}: ComponentPropsWithoutRef<"main"> & {
  shopPresentation?: boolean;
  published?: boolean;
}) {
  return (
    <ShopSurface
      {...props}
      className={`${className}${shopPresentation ? " shop-product" : ""}${published ? " published-product" : ""}`}
    />
  );
}

export function PublicProductDock() {
  return <FloatingNav back marketplace sourceNavigation />;
}
