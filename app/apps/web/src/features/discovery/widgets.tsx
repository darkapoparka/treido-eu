"use client";
import { useTranslations } from "next-intl";
import { ShopSurface } from "./hydration-boundary";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { Sheet } from "./components";
import { useAccount } from "../account/state";
import "./widgets.css";
function OrderWidget({ size }: { size: "large" | "medium" | "small" }) {
  const ui = useTranslations("discoveryUI");
  const { orders } = useAccount();
  const bag = orders.find((order) => order.productId === "shampoo-bag");
  const shirt = orders.find((order) => order.id === "REF-manual-shirt");
  return (
    <div className={`order-widget widget-${size}`}>
      <Link
        className="widget-order-open"
        href={bag ? `/orders/${bag.id}` : "/orders"}
        aria-label={ui("openKITSCHOrderFromValue1Widget", {
          value1: size ?? "",
        })}
      />
      <header>
        <img src="/api/reference-media/widget-kitsch-logo" alt="" />
        {size !== "small" && <b>KITSCH</b>}
        <img
          className="widget-shop-mark"
          src="/api/reference-media/widget-shop-mark"
          alt="Shop"
        />
      </header>
      <div className="widget-order-status">
        {size === "small" && <span>KITSCH</span>}
        <b>{ui("orderPlaced")}</b>
        <p>{ui("standardShipping")}</p>
        {size !== "small" && (
          <>
            <progress
              value="20"
              max="100"
              aria-label={ui("orderDeliveryProgress")}
              data-ui-label="orderDeliveryProgress"
            />
            <img
              src="/api/reference-media/shampoo-bag"
              alt={ui("shampooBarBag")}
            />
          </>
        )}
      </div>
      {size === "large" && (
        <div className="widget-delivery">
          <Link
            className="widget-order-open"
            href={shirt ? `/orders/${shirt.id}?view=tracking` : "/orders"}
            aria-label={ui("openDeliveredTShirtOrderFromLargeWidget")}
            data-ui-label="openDeliveredTShirtOrderFromLargeWidget"
          />
          <header>
            <img src="/api/reference-media/widget-dhl-logo" alt="DHL" />
            <b>{ui("looseFitPrintedTShirt")}</b>
          </header>
          <div>
            <b>{ui("delivered")}</b>
            <p>{ui("deliveredToday")}</p>
          </div>
        </div>
      )}
    </div>
  );
}
export function Widgets() {
  const ui = useTranslations("discoveryUI");
  const [instructions, setInstructions] = useState(false);
  return (
    <ShopSurface className="widget-page">
      <OrderWidget size="large" />
      <OrderWidget size="medium" />
      <OrderWidget size="small" />
      <button className="pill" onClick={() => setInstructions(true)}>
        {ui("aboutTheseWidgets")}
      </button>
      <Link href="/orders">{ui("backToOrders")}</Link>
      <Sheet
        open={instructions}
        title={ui("orderWidgets")}
        onClose={() => setInstructions(false)}
      >
        <p className="sheet-copy">
          {ui("theseAreBrowserPreviewsOfTheCapturedShopWidgetsInstalling")}
        </p>
      </Sheet>
    </ShopSurface>
  );
}
