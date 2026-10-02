"use client";
import { useTranslations } from "next-intl";
import { ShopSurface } from "../discovery/hydration-boundary";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Icon } from "../discovery/icons";
import { AccountIcon } from "../account/icons";
import { useState } from "react";
import { useAccount } from "../account/state";
import { Boundary } from "../account/forms";
import { SourceLink } from "../discovery/return-navigation";
import { usePickupDraft } from "./pickup-draft";
import "./pickup-parity.css";
import {
  shopSourceAddress,
  shopSourceBuyer,
  shopSourcePickup,
} from "./source-fixtures";

// Flow21/006–007 captures this seller checkout, but does not reveal the item name.
// The item is intentionally checkout-only and is not linked to an invented PDP.
export function PickupCheckout() {
  const ui = useTranslations("commerceUI");
  const { paymentCards } = useAccount();
  const payment = paymentCards[0];
  const { value: draft, update } = usePickupDraft();
  const { pickup, offers, discount, discountCode, summary } = draft;
  const [boundary, setBoundary] = useState("");
  const total = pickup ? "3.80" : "10.83";
  return (
    <ShopSurface className="shop-page checkout-page source-checkout pickup-checkout">
      <header className="checkout-header">
        <Link
          href="/cart"
          aria-label={ui("closeCheckout")}
          data-ui-label="closeCheckout"
        >
          <Icon name="close" />
        </Link>
        <h1>{ui("reviewPay")}</h1>
      </header>
      <div className="checkout-identity">
        <strong>shop</strong>
        <span>{shopSourceBuyer.email}</span>
      </div>
      <div
        className="fulfillment-tabs"
        role="tablist"
        aria-label={ui("fulfillment")}
        data-ui-label="fulfillment"
      >
        <button
          role="tab"
          aria-selected={!pickup}
          onClick={() => update({ pickup: false })}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m12 3 9 4.5v9L12 21l-9-4.5v-9L12 3Zm0 9 9-4.5M12 12 3 7.5m9 4.5v9M7.5 5.25l9 4.5V14M1 12h5m-4 4h4" />
          </svg>{" "}
          {ui("ship")}
        </button>
        <button
          role="tab"
          aria-selected={pickup}
          onClick={() => update({ pickup: true })}
        >
          <AccountIcon name="location" /> {ui("pickup")}
        </button>
      </div>
      {pickup && (
        <>
          <p className="pickup-warning">
            <Icon name="info" />
            <span>
              {shopSourcePickup.warning}{" "}
              <button
                type="button"
                onClick={() => setBoundary(ui("locationLookup"))}
              >
                {shopSourcePickup.searchPostalCode}
              </button>
            </span>
          </p>
          <p className="pickup-count">
            {ui("text1LocationWithYourItem")}{" "}
            <button onClick={() => setBoundary(ui("locationLookup"))}>
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              >
                <path d="m3 11 18-8-8 18-2-8-8-2Z" />
              </svg>
              {shopSourcePickup.searchPostalCode}
            </button>
          </p>
        </>
      )}
      <section className="pickup-details">
        {pickup ? (
          <div className="pickup-location">
            <small>{ui("location")}</small>
            <input
              type="radio"
              name="pickup-location"
              aria-label={shopSourcePickup.name}
              checked
              readOnly
            />
            <p>
              <strong>
                {shopSourcePickup.name} ({shopSourcePickup.distance}) ·{" "}
                {shopSourcePickup.price}
              </strong>
              <br />
              {shopSourcePickup.street}, {shopSourcePickup.cityRegion}
              <br />
              <span className="pickup-readiness">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 4v4l3 2" />
                </svg>
                {shopSourcePickup.readiness}
              </span>
            </p>
          </div>
        ) : (
          <>
            <div>
              <small>{ui("shipTo")}</small>
              <p>
                <strong>
                  {shopSourceBuyer.firstName} {shopSourceBuyer.lastName}
                </strong>
                <br />
                {shopSourceAddress.street}, {shopSourceAddress.city}{" "}
                {shopSourceAddress.region} {shopSourceAddress.postalCode}
                {ui("uS")}
              </p>
              <button
                type="button"
                aria-label={ui("shippingAddressIsACapturedSourceValue")}
                onClick={() => setBoundary(ui("addressService"))}
                data-ui-label="shippingAddressIsACapturedSourceValue"
              >
                <span className="pickup-caret" aria-hidden="true" />
              </button>
            </div>
            <div>
              <small>{ui("shipping")}</small>
              <p>
                <strong>{ui("groundShipping700")}</strong>
                <br />
                <button
                  className="pickup-promise"
                  type="button"
                  onClick={() => setBoundary(ui("shippingPromise"))}
                >
                  {ui("friJul31")} <span aria-hidden="true">◔</span>{" "}
                  {ui("promise")}
                </button>
                <br />
                {ui("trackingNumberProvided")}
              </p>
              <button
                type="button"
                aria-label={ui("shippingServiceDetails")}
                onClick={() => setBoundary(ui("shippingService"))}
                data-ui-label="shippingServiceDetails"
              >
                <span className="pickup-caret" aria-hidden="true" />
              </button>
            </div>
          </>
        )}
        <div>
          <small>{ui("payment")}</small>
          <strong>
            {payment ? (
              <>
                Visa ···· {payment.last4}{" "}
                <span className="visa-mark">VISA</span>
              </>
            ) : (
              ui("addPaymentMethod")
            )}
          </strong>
          <SourceLink
            href="/account/payments"
            aria-label={ui("editPaymentMethod")}
            data-ui-label="editPaymentMethod"
          >
            <span className="pickup-caret" aria-hidden="true" />
          </SourceLink>
        </div>
      </section>
      <label className="pickup-offers">
        <input
          type="checkbox"
          checked={offers}
          onChange={(e) => update({ offers: e.target.checked })}
        />
        {ui("signMeUpForNewsAndOffersFromThisStore")}
      </label>
      <button
        className="pill"
        onClick={() => update({ discount: !discount })}
        aria-expanded={discount}
      >
        <Icon name="tag" /> {ui("addDiscount")}
      </button>
      {discount && (
        <form
          className="discount-form"
          onSubmit={(e) => {
            e.preventDefault();
            setBoundary(ui("discountValidation"));
          }}
        >
          <input
            aria-label={ui("discountCode")}
            placeholder={ui("discountCode")}
            value={discountCode}
            onChange={(event) => update({ discountCode: event.target.value })}
            data-ui-label="discountCode"
          />
          <button>{ui("apply")}</button>
        </form>
      )}
      <button
        className="pickup-total"
        onClick={() => update({ summary: !summary })}
        aria-expanded={summary}
      >
        <img
          src="/api/reference-media/checkout-white-rock-item"
          alt={ui("capturedCheckoutItem")}
        />
        <span>
          <strong>{ui("total")}</strong>
          <small>{ui("text1Item")}</small>
        </span>
        <b>
          <small>USD</small>
          <span>${total}</span>
          <span className="pickup-caret" aria-hidden="true" />
        </b>
      </button>
      {summary && (
        <div className="checkout-totals">
          <p>
            {ui("text1Item_620d09")} {pickup ? ui("pickup") : ui("ship")}
            <span>${total}</span>
          </p>
        </div>
      )}
      <div className="checkout-pay">
        <button
          className="primary"
          disabled={!payment}
          onClick={() => setBoundary(ui("payment"))}
        >
          <span>{ui("payNow")}</span>
          <b>${total}</b>
        </button>
      </div>
      <Boundary
        open={!!boundary}
        kind={boundary}
        onClose={() => setBoundary("")}
      />
    </ShopSurface>
  );
}
