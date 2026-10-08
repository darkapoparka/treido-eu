"use client";
import type { ComponentPropsWithoutRef } from "react";
import { ShopSurface } from "./hydration-boundary";
import "./buyer-surface.css";

/** Same DOM and calibrated feature classes; no reference-data selection here. */
export function BuyerSurface({
  className = "",
  publicData = false,
  ...props
}: ComponentPropsWithoutRef<"main"> & { publicData?: boolean }) {
  return (
    <ShopSurface
      {...props}
      className={`${className} buyer-surface${publicData ? " buyer-public" : ""}`}
    />
  );
}
