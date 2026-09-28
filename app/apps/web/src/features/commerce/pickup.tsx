"use client";
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
  const { paymentCards } = useAccount();
  const payment = paymentCards[0];
  const { value: draft, update } = usePickupDraft();
  const { pickup, offers, discount, discountCode, summary } = draft;
  const [boundary, setBoundary] = useState("");
  const total = pickup ? "3.80" : "10.83";
  return (
    <ShopSurface className="shop-page checkout-page source-checkout pickup-checkout">
      <header className="checkout-header">
        <Link href="/cart" aria-label="Close checkout">
          <Icon name="close" />
        </Link>
        <h1>Review & Pay</h1>
      </header>
      <div className="checkout-identity">
        <strong>shop</strong>
        <span>{shopSourceBuyer.email}</span>
      </div>
      <div className="fulfillment-tabs" role="tablist" aria-label="Fulfillment">
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
          Ship
        </button>
        <button
          role="tab"
          aria-selected={pickup}
          onClick={() => update({ pickup: true })}
        >
          <AccountIcon name="location" /> Pickup
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
                onClick={() => setBoundary("Location lookup")}
              >
                {shopSourcePickup.searchPostalCode}
              </button>
            </span>
          </p>
          <p className="pickup-count">
            1 location with your item{" "}
            <button onClick={() => setBoundary("Location lookup")}>
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
            <small>Location</small>
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
              <small>Ship to</small>
              <p>
                <strong>
                  {shopSourceBuyer.firstName} {shopSourceBuyer.lastName}
                </strong>
                <br />
                {shopSourceAddress.street}, {shopSourceAddress.city}{" "}
                {shopSourceAddress.region} {shopSourceAddress.postalCode}, US
              </p>
              <button
                type="button"
                aria-label="Shipping address is a captured source value"
                onClick={() => setBoundary("Address service")}
              >
                <span className="pickup-caret" aria-hidden="true" />
              </button>
            </div>
            <div>
              <small>Shipping</small>
              <p>
                <strong>Ground Shipping · $7.00</strong>
                <br />
                <button
                  className="pickup-promise"
                  type="button"
                  onClick={() => setBoundary("Shipping promise")}
                >
                  Fri, Jul 31 <span aria-hidden="true">◔</span> Promise
                </button>
                <br />
                Tracking number provided
              </p>
              <button
                type="button"
                aria-label="Shipping service details"
                onClick={() => setBoundary("Shipping service")}
              >
                <span className="pickup-caret" aria-hidden="true" />
              </button>
            </div>
          </>
        )}
        <div>
          <small>Payment</small>
          <strong>
            {payment ? (
              <>
                Visa ···· {payment.last4}{" "}
                <span className="visa-mark">VISA</span>
              </>
            ) : (
              "Add payment method"
            )}
          </strong>
          <SourceLink href="/account/payments" aria-label="Edit payment method">
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
        Sign me up for news and offers from this store
      </label>
      <button
        className="pill"
        onClick={() => update({ discount: !discount })}
        aria-expanded={discount}
      >
        <Icon name="tag" /> Add discount
      </button>
      {discount && (
        <form
          className="discount-form"
          onSubmit={(e) => {
            e.preventDefault();
            setBoundary("Discount validation");
          }}
        >
          <input
            aria-label="Discount code"
            placeholder="Discount code"
            value={discountCode}
            onChange={(event) => update({ discountCode: event.target.value })}
          />
          <button>Apply</button>
        </form>
      )}
      <button
        className="pickup-total"
        onClick={() => update({ summary: !summary })}
        aria-expanded={summary}
      >
        <img
          src="/api/reference-media/checkout-white-rock-item"
          alt="Captured checkout item"
        />
        <span>
          <strong>Total</strong>
          <small>1 item</small>
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
            1 item · {pickup ? "Pickup" : "Ship"}
            <span>${total}</span>
          </p>
        </div>
      )}
      <div className="checkout-pay">
        <button
          className="primary"
          disabled={!payment}
          onClick={() => setBoundary("Payment")}
        >
          <span>Pay now</span>
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
