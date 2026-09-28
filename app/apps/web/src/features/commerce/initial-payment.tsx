"use client";
import { useEffect, useRef, useState } from "react";
import { Sheet } from "../discovery/components";
import { AddressEditor } from "../account/forms";
import { blankAddress, type Address } from "../account/state";
export function InitialPayment({
  address,
  onContinue,
}: {
  address?: Address;
  onContinue: () => void;
}) {
  const [pending, setPending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const [same, setSame] = useState(true),
    [securityHelp, setSecurityHelp] = useState(false),
    [boundary, setBoundary] = useState(false),
    [billing, setBilling] = useState<Address | undefined>(),
    [editing, setEditing] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <form
        className="initial-payment"
        onSubmit={(e) => {
          e.preventDefault();
          if (pending) return;
          const number = String(
            new FormData(e.currentTarget).get("cardNumber") ?? "",
          ).replace(/\s/g, "");
          if (!/^\d{12,19}$/.test(number)) {
            setError("Check your card number and try again.");
            return;
          }
          setError("");
          if (!same && !billing) {
            setEditing(true);
            return;
          }
          setPending(true);
          timer.current = setTimeout(() => {
            setPending(false);
            setBoundary(true);
          }, 650);
        }}
      >
        <div className="initial-card-fields">
          <input
            name="cardNumber"
            aria-label="Card number"
            placeholder="Card number"
            inputMode="numeric"
            autoComplete="off"
            required
            pattern="[0-9 ]{12,23}"
            minLength={12}
            maxLength={23}
          />
          <div>
            <input
              aria-label="Expiry (MM/YY)"
              placeholder="Expiry (MM/YY)"
              autoComplete="off"
              pattern="(0[1-9]|1[0-2])/[0-9]{2}"
              required
            />
            <input
              aria-label="CVV"
              placeholder="CVV"
              autoComplete="off"
              inputMode="numeric"
              pattern="[0-9]{3,4}"
              required
            />
            <button
              type="button"
              className="initial-card-help"
              aria-label="About security code"
              aria-expanded={securityHelp}
              onClick={() => setSecurityHelp((current) => !current)}
            >
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <rect x="2" y="3.5" width="16" height="13" rx="2.5" />
                <path d="M2 8h16M5 12h4" />
              </svg>
            </button>
          </div>
        </div>
        {securityHelp && (
          <p className="form-note" role="status">
            The 3 or 4 digit security code printed on your card.
          </p>
        )}
        <input
          className="initial-card-name"
          aria-label="Name on card"
          placeholder="Name on card"
          autoComplete="off"
          required
        />
        <label className="initial-billing">
          <input
            type="checkbox"
            checked={same}
            onChange={(e) => {
              setSame(e.target.checked);
              if (!e.target.checked) setEditing(true);
            }}
          />
          <span>
            Billing address same as shipping
            <small>
              {address
                ? `${address.street}, ${address.city}, ${address.postalCode}, US`
                : "Add a shipping address"}
            </small>
          </span>
        </label>
        {!same && billing && (
          <div className="initial-billing-selection">
            <strong>Billing address</strong>
            <p>
              {billing.firstName} {billing.lastName}
              <br />
              {billing.street}
              <br />
              {billing.city}, {billing.region} {billing.postalCode}
            </p>
            <button
              type="button"
              className="checkout-link"
              onClick={() => setEditing(true)}
            >
              Edit billing address
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {!same && !billing && (
          <button
            type="button"
            className="checkout-link"
            onClick={() => setEditing(true)}
          >
            Add billing address
          </button>
        )}
        <div className="checkout-pay">
          <button
            className="primary"
            disabled={pending}
            aria-label="Continue to review"
            aria-busy={pending}
          >
            {pending ? (
              <span className="captured-button-spinner" aria-hidden="true" />
            ) : (
              "Continue to review"
            )}
          </button>
        </div>
      </form>
      <Sheet
        open={editing}
        title="Billing address"
        onClose={() => setEditing(false)}
      >
        <AddressEditor
          initialValue={billing ?? blankAddress()}
          variant="checkout"
          onSave={(a) => {
            setBilling(a);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </Sheet>
      <Sheet
        open={boundary}
        title="Payment service is not connected"
        onClose={() => setBoundary(false)}
      >
        <p>Your card has not been saved or charged.</p>
        <button
          className="form-cancel"
          onClick={() => {
            setBoundary(false);
            onContinue();
          }}
        >
          Continue with saved payment method
        </button>
      </Sheet>
    </>
  );
}
