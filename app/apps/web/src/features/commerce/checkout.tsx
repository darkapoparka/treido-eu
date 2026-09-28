"use client";
import { ShopSurface } from "../discovery/hydration-boundary";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  formatMoney,
  referenceVariantProduct,
  type Catalog,
} from "../catalog/types";
import { useDiscovery } from "../discovery/state";
import { consumeSheetHistory, Sheet } from "../discovery/components";
import { Icon } from "../discovery/icons";
import {
  bindSourceDestination,
  rememberSourcePosition,
} from "../discovery/return-navigation";
import { AccountIcon } from "../account/icons";
import { AccountPage, PaymentEditor } from "../account/forms";
import {
  useAccount,
  type Address,
  type ReferencePaymentCard,
} from "../account/state";
import { checkoutPolicies } from "../catalog/reference/store-policies";
import { CartContents } from "./cart";
import "./cart-parity.css";
export { CartContents } from "./cart";
import { InitialPayment } from "./initial-payment";
import {
  armCapturedConfirmation,
  reviewStageEnds,
  useCapturedTransition,
} from "./captured-transition";
import {
  CheckoutExtras,
  checkoutRecommendationsForStore,
} from "./checkout-extras";
import { capturedLineAmount, capturedOfferCompareAt } from "./pricing";
import {
  shopSourceAddress,
  shopSourceBuyer,
  shopSourcePayment,
} from "./source-fixtures";

type CheckoutStep =
  "review" | "phone" | "address-search" | "address" | "payment-setup";
type CheckoutSection = "ship" | "shipping" | "plan" | "payment";
type CheckoutHelp = "shipping" | "taxes" | "country" | "terms" | "privacy";

function blankCheckoutAddress(): Address {
  return {
    id: "",
    firstName: "",
    lastName: "",
    company: "",
    street: "",
    apartment: "",
    city: "",
    region: "",
    postalCode: "",
    country: "United States",
    phone: "",
    isDefault: false,
  };
}

export function CartPage({ catalog }: { catalog: Catalog }) {
  return (
    <AccountPage title="Your cart">
      <CartContents catalog={catalog} />
    </AccountPage>
  );
}

export function CartOverlay({
  catalog,
  open,
  onClose,
}: {
  catalog: Catalog;
  open: boolean;
  onClose: () => void;
}) {
  const [offer, setOffer] = useState("");
  const sourceOrigin = useRef<{ href: string; token: string | null } | null>(
    null,
  );
  const recordedOpen = useRef(false);
  useLayoutEffect(() => {
    if (!open) {
      recordedOpen.current = false;
      return;
    }
    if (recordedOpen.current) return;
    recordedOpen.current = true;
    const opener = document.activeElement;
    const selector = '[data-focus-return="cart"]';
    sourceOrigin.current = {
      href: location.href,
      token:
        opener instanceof HTMLElement && opener.matches(selector)
          ? rememberSourcePosition(
              selector,
              [...document.querySelectorAll(selector)].indexOf(opener),
            )
          : null,
    };
  }, [open]);
  return (
    <div
      style={{ display: "contents" }}
      onClickCapture={(event) => {
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        const link =
          event.target instanceof Element
            ? event.target.closest<HTMLAnchorElement>("a[href]")
            : null;
        if (
          !link?.closest("dialog.dark-cart-sheet[open]") ||
          link.target === "_blank" ||
          link.hasAttribute("download") ||
          link.href !== sourceOrigin.current?.href
        )
          return;
        // Returning to the exact page already beneath this cart is dismissal.
        // Intercept before Sheet would replace its temporary entry with a
        // duplicate of the same product, including its query and fragment.
        event.preventDefault();
        event.stopPropagation();
        if (window.history.state?.shopSheet) window.history.back();
        else onClose();
      }}
    >
      <Sheet
        open={open}
        title="Your cart"
        className="dark-cart-sheet"
        headerless
        onClose={onClose}
      >
        <CartContents
          catalog={catalog}
          onNavigate={(href) => {
            if (sourceOrigin.current?.token)
              bindSourceDestination(sourceOrigin.current.token, href);
            onClose();
          }}
          onOffer={setOffer}
        />
        <button
          className="cart-close"
          aria-label="Close cart"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </Sheet>
      <CartOffer
        catalog={catalog}
        storeId={offer}
        open={Boolean(offer)}
        onClose={() => setOffer("")}
      />
    </div>
  );
}

export function Checkout({
  catalog,
  storeId,
  initialStage = "review",
}: {
  catalog: Catalog;
  storeId?: string;
  initialStage?: CheckoutStep;
}) {
  const state = useDiscovery();
  const account = useAccount();
  const searchParams = useSearchParams();
  const addressFocus = useRef<HTMLButtonElement | null>(null);
  const [step, updateStep] = useState<CheckoutStep>(initialStage);
  const [expanded, setExpanded] = useState<CheckoutSection[]>([]);
  const [addressCompact, setAddressCompact] = useState(false);
  const [addressSearching, setAddressSearching] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>(() => [
    { ...shopSourceAddress },
  ]);
  const [addressId, setAddressId] = useState(shopSourceAddress.id);
  const [shipping, setShipping] = useState(0);
  const [payments, setPayments] = useState<ReferencePaymentCard[]>(() => [
    {
      id: shopSourcePayment.id,
      last4: shopSourcePayment.last4,
      expiry: "",
      billingAddressId: shopSourceAddress.id,
    },
  ]);
  const [paymentChoice, setPaymentChoice] = useState<string>(
    shopSourcePayment.id,
  );
  const [phoneStage, updatePhoneStage] = useState<"phone" | "code">(() =>
    searchParams.get("verification") === "code" ? "code" : "phone",
  );
  const [phoneDraft, setPhoneDraft] = useState("");
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [summary, setSummary] = useState(false);
  const [code, setCode] = useState("");
  const [discountError, setDiscountError] = useState(false);
  const [addressMenu, setAddressMenu] = useState("");
  const [deleteAddressId, setDeleteAddressId] = useState("");
  const [addressModal, setAddressModal] = useState(false);
  const [addressDraft, setAddressDraft] = useState<Address>(() =>
    initialStage === "address"
      ? { ...shopSourceAddress }
      : blankCheckoutAddress(),
  );
  const [editingAddressId, setEditingAddressId] = useState("");
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentMenu, setPaymentMenu] = useState("");
  const [editingPaymentId, setEditingPaymentId] = useState("");
  const [help, setHelp] = useState<CheckoutHelp | "">("");
  const [storeOffers, setStoreOffers] = useState(true);
  const [textOfferPhone, setTextOfferPhone] = useState("");
  const [processing, setProcessing] = useState(false);
  const [processingCaption, setProcessingCaption] = useState(false);
  const paymentTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => paymentTimers.current.forEach(clearTimeout), []);
  const [paymentBoundary, setPaymentBoundary] = useState(false);
  const reviewTransition = useCapturedTransition(reviewStageEnds);
  const reviewStage = reviewTransition.stage;
  const reviewPending = reviewStage !== 0;
  const cancelReview = reviewTransition.cancel;

  const resolvedLines = state.cart.flatMap((line) => {
    const product = catalog.products.find((p) => p.id === line.productId);
    return product
      ? [
          {
            ...line,
            product: referenceVariantProduct(
              product,
              product.variants.find((variant) => variant.id === line.variantId),
            ),
          },
        ]
      : [];
  });
  const effectiveStoreId = storeId || resolvedLines[0]?.product.storeId;
  const lines = resolvedLines.filter(
    (line) => !effectiveStoreId || line.product.storeId === effectiveStoreId,
  );
  const checkoutStore = catalog.stores.find(
    (store) => store.id === effectiveStoreId,
  );
  const checkoutStoreName =
    effectiveStoreId === "kitsch"
      ? "Kitsch"
      : (checkoutStore?.name ?? "this store");
  const policies = checkoutPolicies(effectiveStoreId);
  const hasCapturedKitschMerchandising = effectiveStoreId === "kitsch";
  const checkoutRecommendations =
    checkoutRecommendationsForStore(effectiveStoreId);
  const quantity = lines.reduce((n, line) => n + line.quantity, 0);
  const itemSubtotal = lines.reduce(
    (n, line) =>
      n + line.quantity * capturedLineAmount(line, line.product.price.amount),
    0,
  );
  const extrasSubtotal = checkoutRecommendations
    .filter((p) => extraIds.includes(p.id))
    .reduce((n, p) => n + p.amount, 0);
  const subtotal = itemSubtotal + extrasSubtotal;
  const fee = shipping === 0 ? 682 : 1174;
  const tax = lines.some(
    (line) =>
      line.productId === "shampoo-bag" &&
      line.variantId === "shampoo-bag-default",
  )
    ? 35
    : 0;
  const total = subtotal + fee + tax;
  const previewPayAmount =
    reviewStage === 3 ? subtotal : reviewStage === 4 ? subtotal + fee : total;
  const savings = lines.reduce(
    (n, line) =>
      n +
      (line.product.price.amount -
        capturedLineAmount(line, line.product.price.amount)) *
        line.quantity,
    0,
  );
  const address =
    addresses.find((entry) => entry.id === addressId) ?? addresses[0];
  const selectedPayment = payments.find((card) => card.id === paymentChoice);

  // Checkout steps live in browser history; drafts stay in this mounted owner.
  // A provider-boundary sheet is consumed before the next stage replaces it.
  const navigateSetup = (
    next: CheckoutStep,
    verification: "phone" | "code" = "phone",
    replaceEntry = false,
  ) => {
    reviewTransition.cancel();
    const url = new URL(window.location.href);
    if (next === "review") url.searchParams.delete("stage");
    else url.searchParams.set("stage", next);
    if (next === "phone" && verification === "code")
      url.searchParams.set("verification", "code");
    else url.searchParams.delete("verification");
    const fromSheet = consumeSheetHistory();
    const method = fromSheet || replaceEntry ? "replaceState" : "pushState";
    window.history[method]({ shopCheckoutStep: true }, "", url);
    updateStep(next);
    updatePhoneStage(verification);
    setAddressSearching(false);
    window.scrollTo(0, 0);
  };
  const setStep = (next: CheckoutStep) => navigateSetup(next);
  const setPhoneStage = (next: "phone" | "code") =>
    navigateSetup("phone", next);
  useEffect(() => {
    const restore = () => {
      cancelReview();
      paymentTimers.current.forEach(clearTimeout);
      setProcessing(false);
      const params = new URLSearchParams(window.location.search);
      const next = params.get("stage");
      updateStep(
        next === "phone" ||
          next === "address-search" ||
          next === "address" ||
          next === "payment-setup"
          ? next
          : "review",
      );
      updatePhoneStage(
        params.get("verification") === "code" ? "code" : "phone",
      );
      setAddressSearching(false);
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [cancelReview]);
  const toggle = (section: CheckoutSection) =>
    setExpanded((current) =>
      current.includes(section)
        ? current.filter((entry) => entry !== section)
        : [...current, section],
    );

  const saveAddress = (next: Address) => {
    const id =
      next.id ||
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `checkout-address-${Date.now()}`);
    const normalized = { ...next, id };
    setAddresses((current) => {
      const existing = normalized.isDefault
        ? current.map((entry) => ({ ...entry, isDefault: false }))
        : current;
      const exists = existing.some((entry) => entry.id === id);
      if (!exists) return [...existing, normalized];
      return existing.map((entry) => (entry.id === id ? normalized : entry));
    });
    setAddressId(id);
    return normalized;
  };

  const closeDeleteAddress = () => {
    setDeleteAddressId("");
    setAddressMenu("");
    window.requestAnimationFrame(() => {
      const target = addressFocus.current?.isConnected
        ? addressFocus.current
        : document.querySelector<HTMLButtonElement>(
            ".checkout-addresses .selected .context-trigger",
          );
      target?.focus({ preventScroll: true });
    });
  };

  if (!lines.length)
    return (
      <AccountPage title="Checkout">
        <div className="notification-empty order-empty-source">
          <h2>Your cart is empty</h2>
          <p>
            Add products while you shop, so they’ll be ready for checkout later.
          </p>
          <Link href="/search" className="form-cancel">
            Go shopping
          </Link>
        </div>
      </AccountPage>
    );

  const backFromSetup = () => {
    if (window.history.state?.shopCheckoutStep) {
      window.history.back();
      return;
    }
    if (step === "phone" && phoneStage === "code")
      navigateSetup("phone", "phone", true);
    else if (step === "payment-setup") navigateSetup("address", "phone", true);
    else if (step === "address") navigateSetup("address-search", "phone", true);
    else navigateSetup("review", "phone", true);
  };

  return (
    <ShopSurface
      className={`shop-page checkout-page source-checkout ${step !== "review" ? "is-setup" : ""} ${addressSearching ? "is-address-searching" : ""} ${processing ? "is-processing" : ""}`}
      aria-busy={processing || reviewPending}
      data-review-stage={reviewStage}
    >
      <header className="checkout-header">
        {step === "review" ? (
          <Link href="/cart" aria-label="Close checkout">
            <Icon name="close" />
          </Link>
        ) : (
          <button aria-label="Go back" onClick={backFromSetup}>
            <Icon name="back" />
          </button>
        )}
        <h1>
          {step === "review"
            ? "Review & Pay"
            : step === "phone"
              ? phoneStage === "code"
                ? "Confirm it’s you"
                : "Add phone number"
              : step === "address" || step === "address-search"
                ? "Shipping address"
                : "Add a card"}
        </h1>
      </header>

      {(step === "address-search" ||
        step === "address" ||
        step === "payment-setup") && (
        <div className={`checkout-steps checkout-steps-${step}`}>
          <i className="active" />
          <i className="active" />
          <i className={step === "payment-setup" ? "active" : "partial"} />
          <i className={step === "payment-setup" ? "partial" : ""} />
        </div>
      )}

      {step === "phone" ? (
        <SourcePhoneSetup
          stage={phoneStage}
          phone={phoneDraft}
          onPhoneChange={setPhoneDraft}
          onStageChange={setPhoneStage}
          onDone={(phone) => {
            // Keep the national-number draft as entered; the phone-step
            // callback already includes the country code for the address.
            setAddressDraft({ ...blankCheckoutAddress(), phone });
            setStep("address-search");
          }}
        />
      ) : step === "address-search" ? (
        <SourceAddressLookup
          onSearchingChange={setAddressSearching}
          onManual={() => {
            setAddressCompact(false);
            setAddressDraft({
              ...blankCheckoutAddress(),
              phone: phoneDraft
                ? `+1${phoneDraft.replace(/\D/g, "")}`
                : shopSourceBuyer.phone,
            });
            setStep("address");
          }}
          onSelect={(next) => {
            setAddressCompact(true);
            setAddressDraft({
              ...next,
              phone: phoneDraft
                ? `+1${phoneDraft.replace(/\D/g, "")}`
                : next.phone,
            });
            setStep("address");
          }}
        />
      ) : step === "address" ? (
        <SourceAddressEditor
          variant="initial"
          initialValue={addressDraft}
          compact={addressCompact}
          onExpand={() => setAddressCompact(false)}
          onChange={setAddressDraft}
          onCancel={() => setStep("address-search")}
          onSave={(next) => {
            const saved = saveAddress(next);
            setAddressDraft(saved);
            setStep("payment-setup");
          }}
        />
      ) : step === "payment-setup" ? (
        <InitialPayment
          address={addressDraft.street ? addressDraft : address}
          onContinue={() => {
            setStep("review");
            setExpanded([]);
            reviewTransition.start();
          }}
        />
      ) : (
        <>
          {reviewStage === 1 && (
            <div
              className="captured-review-loading"
              role="status"
              aria-label="Loading captured checkout"
            >
              <i />
            </div>
          )}
          <div className="checkout-identity">
            <strong>shop</strong>
            <span>{shopSourceBuyer.email}</span>
          </div>

          <div
            className="checkout-group source-checkout-group"
            inert={reviewPending || processing}
          >
            <section className="checkout-section">
              <button
                className="checkout-section-toggle"
                aria-expanded={expanded.includes("ship")}
                onClick={() => toggle("ship")}
              >
                <span className="checkout-section-label">Ship to</span>
                {!expanded.includes("ship") && address && (
                  <span className="checkout-section-value">
                    <strong>
                      {address.firstName} {address.lastName}
                    </strong>
                    <span>
                      {address.street}, {address.city} {address.region}
                      <br />
                      {address.postalCode}, US
                    </span>
                  </span>
                )}
                <span className="checkout-section-caret">
                  {expanded.includes("ship") ? "⌃" : "⌄"}
                </span>
              </button>
              {expanded.includes("ship") && (
                <div
                  className={`checkout-section-body checkout-addresses ${addresses.length === 1 ? "has-one-option" : ""}`}
                >
                  {addresses.map((entry) => (
                    <div
                      className={`shipping-option address-radio ${address?.id === entry.id ? "selected" : ""} ${!entry.isDefault ? "has-default-action" : ""}`}
                      key={entry.id}
                    >
                      <label>
                        <input
                          type="radio"
                          name="address"
                          checked={address?.id === entry.id}
                          onChange={() => setAddressId(entry.id)}
                        />
                        <span>
                          <strong>
                            {entry.firstName} {entry.lastName}, {entry.street}
                          </strong>
                          <span>
                            {entry.city} {entry.region} {entry.postalCode}, US
                            {entry.phone
                              ? `, ${entry.phone.replace(/\s/g, "")}`
                              : ""}
                          </span>
                          {entry.isDefault && (
                            <small className="default-pill">Default</small>
                          )}
                        </span>
                      </label>
                      {!entry.isDefault && (
                        <button
                          type="button"
                          className="source-default-action"
                          aria-label={`Set ${entry.street} as default address`}
                          onClick={() =>
                            setAddresses((current) =>
                              current.map((item) => ({
                                ...item,
                                isDefault: item.id === entry.id,
                              })),
                            )
                          }
                        >
                          Set as default
                        </button>
                      )}
                      <button
                        className="context-trigger"
                        aria-label={`Address options for ${entry.street}`}
                        onClick={(event) => {
                          addressFocus.current = event.currentTarget;
                          setAddressMenu(
                            addressMenu === entry.id ? "" : entry.id,
                          );
                        }}
                      >
                        •••
                      </button>
                      {addressMenu === entry.id && (
                        <div className="checkout-context-menu">
                          <button
                            onClick={() => {
                              setEditingAddressId(entry.id);
                              setAddressDraft({ ...entry });
                              setAddressMenu("");
                              setAddressModal(true);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="danger-text"
                            onClick={() => {
                              setDeleteAddressId(entry.id);
                              setAddressMenu("");
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  <button
                    className="checkout-link source-checkout-link"
                    onClick={() => {
                      setEditingAddressId("");
                      setAddressDraft({
                        ...blankCheckoutAddress(),
                        firstName: shopSourceBuyer.firstName,
                        lastName: shopSourceBuyer.lastName,
                      });
                      setAddressModal(true);
                    }}
                  >
                    <Icon name="plus" /> Use a different address
                  </button>
                </div>
              )}
            </section>

            <section className="checkout-section">
              <button
                className="checkout-section-toggle"
                aria-expanded={expanded.includes("shipping")}
                onClick={() => toggle("shipping")}
              >
                <span className="checkout-section-label">Shipping</span>
                {!expanded.includes("shipping") && (
                  <span className="checkout-section-value">
                    <strong>
                      {shipping === 0
                        ? "Standard Shipping"
                        : "Priority Shipping"}{" "}
                      · {formatMoney({ amount: fee, currency: "USD" })}
                    </strong>
                    <span>
                      <span className="checkout-shipping-status">
                        Ready to ship
                      </span>
                      <br />
                      {shipping === 0 ? "3-5 days" : "1-3 days"}
                    </span>
                  </span>
                )}
                <span className="checkout-section-caret">
                  {expanded.includes("shipping") ? "⌃" : "⌄"}
                </span>
              </button>
              {expanded.includes("shipping") && (
                <div className="checkout-section-body">
                  {[
                    [
                      "Standard Shipping",
                      "Estimated delivery Tue, Aug 4",
                      "3-5 days",
                      682,
                    ],
                    [
                      "Priority Shipping",
                      "Estimated delivery Tue, Aug 4",
                      "1-3 days",
                      1174,
                    ],
                  ].map(([name, eta, delivery, price], index) => (
                    <label
                      className={`shipping-option ${shipping === index ? "selected" : ""}`}
                      key={String(name)}
                    >
                      <input
                        type="radio"
                        name="shipping"
                        checked={shipping === index}
                        onChange={() => setShipping(index)}
                      />
                      <span>
                        <strong>{name}</strong>
                        <span>{eta}</span>
                        <span>{delivery}</span>
                      </span>
                      <b>
                        {formatMoney({
                          amount: Number(price),
                          currency: "USD",
                        })}
                      </b>
                    </label>
                  ))}
                </div>
              )}
            </section>

            <section className="checkout-section">
              <button
                className="checkout-section-toggle"
                aria-expanded={expanded.includes("plan")}
                onClick={() => toggle("plan")}
              >
                <span className="checkout-section-label">Plan</span>
                {!expanded.includes("plan") && (
                  <span className="checkout-section-value">
                    <strong>Pay now</strong>
                    <span>Pay the entire amount today</span>
                  </span>
                )}
                <span className="checkout-section-caret">
                  {expanded.includes("plan") ? "⌃" : "⌄"}
                </span>
              </button>
              {expanded.includes("plan") && (
                <div className="checkout-section-body checkout-plan-body">
                  <div className="installment-unavailable">
                    <strong>
                      <Icon name="info" />
                      <span>Installments unavailable</span>
                    </strong>
                    <p>
                      Installments can only be used for orders between $35.00
                      and $30,000.00.
                    </p>
                  </div>
                  <label className="shipping-option selected">
                    <input type="radio" checked readOnly />
                    <span>
                      <strong>Pay now</strong>
                      <span>Pay the entire amount today</span>
                    </span>
                  </label>
                  <label className="shipping-option is-disabled">
                    <input type="radio" disabled />
                    <span>
                      <strong>Pay in 2 installments</strong>
                      <span>Pay every 15 days with no interest or fees</span>
                    </span>
                  </label>
                </div>
              )}
            </section>

            <section className="checkout-section">
              <button
                className="checkout-section-toggle"
                aria-expanded={expanded.includes("payment")}
                onClick={() => toggle("payment")}
              >
                <span className="checkout-section-label">Payment</span>
                {!expanded.includes("payment") && selectedPayment && (
                  <span className="checkout-section-value payment-summary-value">
                    <strong>Visa ···· {selectedPayment.last4}</strong>
                    <b className="visa-mark">VISA</b>
                  </span>
                )}
                <span className="checkout-section-caret">
                  {expanded.includes("payment") ? "⌃" : "⌄"}
                </span>
              </button>
              {expanded.includes("payment") && (
                <div
                  className={`checkout-section-body checkout-payments ${payments.length === 1 ? "has-one-option" : ""}`}
                >
                  {payments.map((card) => {
                    const billing = [...addresses, ...account.addresses].find(
                      (entry) => entry.id === card.billingAddressId,
                    );
                    return (
                      <div
                        className={`shipping-option ${paymentChoice === card.id ? "selected" : ""}`}
                        key={card.id}
                      >
                        <label>
                          <input
                            type="radio"
                            name="payment"
                            checked={paymentChoice === card.id}
                            onChange={() => setPaymentChoice(card.id)}
                          />
                          <span>
                            <strong>
                              Visa ···· {card.last4}{" "}
                              <b className="visa-mark">VISA</b>
                            </strong>
                            <span className="checkout-payment-address">
                              {billing
                                ? `${billing.firstName} ${billing.lastName}, ${billing.street}, ${billing.city} ...`
                                : "Add billing address"}
                            </span>
                          </span>
                        </label>
                        <button
                          className="context-trigger"
                          aria-label={`Payment method options ${card.last4}`}
                          onClick={() =>
                            setPaymentMenu(
                              paymentMenu === card.id ? "" : card.id,
                            )
                          }
                        >
                          •••
                        </button>
                        {paymentMenu === card.id && (
                          <div className="checkout-context-menu">
                            <button
                              onClick={(event) => {
                                event.currentTarget
                                  .closest(".shipping-option")
                                  ?.querySelector<HTMLButtonElement>(
                                    ".context-trigger",
                                  )
                                  ?.focus({ preventScroll: true });
                                setEditingPaymentId(card.id);
                                setPaymentMenu("");
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="danger-text"
                              onClick={() => {
                                setPayments((current) =>
                                  current.filter(
                                    (entry) => entry.id !== card.id,
                                  ),
                                );
                                if (paymentChoice === card.id)
                                  setPaymentChoice(
                                    payments.find(
                                      (entry) => entry.id !== card.id,
                                    )?.id ?? "",
                                  );
                                setPaymentMenu("");
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="payment-actions-row">
                    <button
                      className="checkout-link source-checkout-link"
                      onClick={() => setPaymentModal(true)}
                    >
                      <span>＋</span> Pay another way
                    </button>
                    <span className="payment-marks" aria-hidden="true">
                      <svg className="source-generic-card" viewBox="0 0 32 20">
                        <rect width="32" height="20" rx="2" fill="#505050" />
                        <path d="M0 6h32v3H0z" fill="#d1d1d1" />
                        <rect
                          x="4"
                          y="14"
                          width="11"
                          height="2"
                          rx="1"
                          fill="#a8a8a8"
                        />
                      </svg>
                      <SourceApplePayMark />
                    </span>
                  </div>
                </div>
              )}
            </section>

            {hasCapturedKitschMerchandising &&
              !expanded.includes("payment") && (
                <section className="shop-cash-section">
                  <span>Shop Cash</span>
                  <div>
                    Get $20.00 off on orders over $50.00
                    <br />
                    <Link href="/search">Keep Shopping</Link>
                  </div>
                </section>
              )}
          </div>

          <label className="checkout-store-offers">
            <input
              type="checkbox"
              checked={storeOffers}
              disabled={processing || reviewPending}
              onChange={(event) => setStoreOffers(event.target.checked)}
            />
            <span>Sign me up for news and offers from this store</span>
          </label>

          {(reviewStage === 3 || reviewStage === 4) && (
            <div
              className="captured-review-extras-loading"
              role="status"
              aria-label="Loading captured recommendations"
            >
              <i />
              {reviewStage === 3 && (
                <div className="captured-review-skeleton" aria-hidden="true">
                  <header>
                    <b />
                    <i />
                    <i />
                  </header>
                  {[0, 1].map((row) => (
                    <div key={row}>
                      <i />
                      <span>
                        <b />
                        <b />
                        <b />
                      </span>
                      <i />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {hasCapturedKitschMerchandising && (
            <section className="checkout-text-offers">
              <h2>Text offers</h2>
              <p>
                Sign up to be in the loop on exclusive offers, new products, and
                haircare tips.
              </p>
              <div className="source-text-offer-phone">
                <input
                  type="tel"
                  aria-label="Phone number for text offers"
                  placeholder="Phone number"
                  autoComplete="tel-national"
                  value={textOfferPhone}
                  disabled={processing || reviewPending}
                  onChange={(event) => setTextOfferPhone(event.target.value)}
                />
                <button
                  type="button"
                  aria-label="Text offers country: United States (+1)"
                  aria-haspopup="dialog"
                  onClick={() => setHelp("country")}
                >
                  <SourceUnitedStatesFlag />
                  <span aria-hidden="true">⌄</span>
                </button>
              </div>
              <p className="checkout-sms-terms">
                &quot;By providing your number and clicking the button, you
                agree to receive recurring auto-dialed marketing SMS (including
                cart reminders; AI content; artificial or prerecorded voices)
                and our <a href={policies?.terms}>TERMS OF SERVICE</a>{" "}
                (including arbitration). Consent is not required to purchase.
                Msg & data rates may apply. Msg frequency varies. Reply HELP for
                help; STOP to opt-out. View{" "}
                <a href={policies?.privacy}>PRIVACY POLICY</a>.
              </p>
            </section>
          )}

          <CheckoutExtras
            recommendations={checkoutRecommendations}
            added={extraIds}
            disabled={processing || reviewPending}
            onAdd={(id) =>
              setExtraIds((current) =>
                current.includes(id) ? current : [...current, id],
              )
            }
          />

          <div className="checkout-summary source-order-summary">
            {!summary && (
              <button
                className="add-discount-pill"
                disabled={processing || reviewPending}
                onClick={() => setSummary(true)}
              >
                <Icon name="price-tag" /> Add discount
              </button>
            )}
            <button
              className="source-total-row"
              disabled={processing || reviewPending}
              aria-expanded={summary}
              onClick={() => setSummary((current) => !current)}
            >
              <span className="source-total-thumbnail">
                {lines[0] && <img src={lines[0].product.images[0]} alt="" />}
              </span>
              <span>
                <strong>{summary ? "Order summary" : "Total"}</strong>
                <small>
                  {quantity} {quantity === 1 ? "item" : "items"}
                </small>
              </span>
              <span className="source-total-value">
                <span className="source-total-price">
                  <b>USD</b>
                  <strong>
                    {formatMoney({ amount: total, currency: "USD" })}
                  </strong>
                  <span className="source-total-caret" aria-hidden="true">
                    <Icon name="chevron" />
                  </span>
                </span>
                {savings > 0 && (
                  <small>
                    <Icon name="price-tags" /> Total savings{" "}
                    {formatMoney({ amount: savings, currency: "USD" })}
                  </small>
                )}
              </span>
            </button>

            {summary && (
              <div className="inline-order-summary">
                <details className="order-points">
                  <summary>
                    <AccountIcon name="info" />
                    <span className="order-points-label">
                      Complete this purchase to
                      <br />
                      earn 4 points
                    </span>
                    <span className="order-points-caret" aria-hidden="true">
                      <Icon name="chevron" />
                    </span>
                  </summary>
                  <p>
                    The captured offer awards 4 points. No loyalty account is
                    connected in this reference preview.
                  </p>
                </details>
                {lines.map((line) => {
                  const net = capturedLineAmount(
                    line,
                    line.product.price.amount,
                  );
                  return (
                    <div
                      className="order-item source-summary-item"
                      key={`${line.productId}-${line.variantId}`}
                    >
                      <img src={line.product.images[0]} alt="" />
                      <span>
                        <strong>{line.product.title}</strong>
                        {net !== line.product.price.amount && (
                          <small className="source-line-discount">
                            <Icon name="price-tag" />
                            <span>27% OFF BACK TO SCHOOL SALE (-$1.35)</span>
                          </small>
                        )}
                        {line.quantity > 1 && (
                          <small>Quantity {line.quantity}</small>
                        )}
                      </span>
                      <strong>
                        {net !== line.product.price.amount && (
                          <del>{formatMoney(line.product.price)}</del>
                        )}{" "}
                        {formatMoney({
                          amount: net * line.quantity,
                          currency: line.product.price.currency,
                        })}
                      </strong>
                    </div>
                  );
                })}
                {checkoutRecommendations
                  .filter((p) => extraIds.includes(p.id))
                  .map((product) => (
                    <div
                      className="order-item source-summary-item"
                      key={product.id}
                    >
                      <img src={product.image} alt="" />
                      <span>{product.name}</span>
                      <strong>
                        {formatMoney({
                          amount: product.amount,
                          currency: "USD",
                        })}
                      </strong>
                    </div>
                  ))}
                <form
                  className="discount-form source-discount-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setDiscountError(true);
                  }}
                >
                  <input
                    aria-label="Discount code"
                    placeholder="Discount code or gift card"
                    disabled={processing || reviewPending}
                    value={code}
                    onChange={(event) => {
                      setCode(event.target.value);
                      setDiscountError(false);
                    }}
                  />
                  <button type="submit" disabled={processing || !code.trim()}>
                    Apply
                  </button>
                </form>
                {discountError && (
                  <p className="form-error" role="alert">
                    Discount codes cannot be validated in this reference
                    preview.
                  </p>
                )}
                <div className="checkout-totals">
                  <p>
                    Subtotal{" "}
                    <span>
                      {formatMoney({ amount: subtotal, currency: "USD" })}
                    </span>
                  </p>
                  <p>
                    <button
                      type="button"
                      className="checkout-fee-label"
                      aria-label="About shipping"
                      onClick={() => setHelp("shipping")}
                    >
                      Shipping <Icon name="question-circle" />
                    </button>
                    <span>{formatMoney({ amount: fee, currency: "USD" })}</span>
                  </p>
                  <p>
                    <button
                      type="button"
                      className="checkout-fee-label"
                      aria-label="About estimated taxes"
                      onClick={() => setHelp("taxes")}
                    >
                      Estimated taxes <Icon name="question-circle" />
                    </button>
                    <span>{formatMoney({ amount: tax, currency: "USD" })}</span>
                  </p>
                  <p className="checkout-total-line">
                    <strong>Total</strong>
                    <strong>
                      {formatMoney({ amount: total, currency: "USD" })}
                    </strong>
                  </p>
                  {savings > 0 && (
                    <strong className="checkout-savings">
                      <Icon name="price-tags" />
                      <span>
                        TOTAL SAVINGS{" "}
                        {formatMoney({ amount: savings, currency: "USD" })}
                      </span>
                    </strong>
                  )}
                </div>
              </div>
            )}

            <p className="checkout-terms">
              By clicking ‘Pay Now’ you agree to {checkoutStoreName}’s{" "}
              {policies ? (
                <a href={policies.terms}>Terms of Service</a>
              ) : (
                <button
                  className="checkout-policy-link"
                  onClick={() => setHelp("terms")}
                >
                  Terms of Service
                </button>
              )}{" "}
              and{" "}
              {policies ? (
                <a href={policies.privacy}>Privacy Policy</a>
              ) : (
                <button
                  className="checkout-policy-link"
                  onClick={() => setHelp("privacy")}
                >
                  Privacy Policy
                </button>
              )}
              .
            </p>
          </div>

          <div className="checkout-pay">
            <button
              className="primary"
              onClick={() => {
                if (processing) return;
                setProcessing(true);
                setProcessingCaption(false);
                paymentTimers.current = [
                  setTimeout(() => setProcessingCaption(true), 750),
                  setTimeout(() => {
                    setProcessing(false);
                    setPaymentBoundary(true);
                  }, 1100),
                ];
              }}
              disabled={
                !address || !selectedPayment || processing || reviewPending
              }
            >
              {processing ? (
                <span
                  className="processing-label"
                  data-processing-caption={processingCaption}
                >
                  <i aria-hidden="true" />{" "}
                  {processingCaption && "Processing..."}
                </span>
              ) : (
                <>
                  <span>Pay now</span>
                  <b>
                    {formatMoney({ amount: previewPayAmount, currency: "USD" })}
                  </b>
                </>
              )}
            </button>
          </div>
        </>
      )}

      <Sheet
        open={addressModal}
        title={editingAddressId ? "Edit address" : "Add address"}
        className="source-address-sheet"
        onClose={() => setAddressModal(false)}
      >
        <SourceAddressEditor
          key={`${addressModal}-${editingAddressId}`}
          variant="sheet"
          initialValue={addressDraft}
          onCancel={() => setAddressModal(false)}
          onSave={(next) => {
            const saved = saveAddress(next);
            setEditingAddressId(saved.id);
            setAddressModal(false);
          }}
        />
      </Sheet>

      <Sheet
        open={paymentModal}
        title="Payment methods"
        className="source-payment-sheet"
        onClose={() => setPaymentModal(false)}
      >
        <SourcePaymentEditor
          addresses={addresses}
          selectedAddressId={addressId}
          onCancel={() => setPaymentModal(false)}
          onPreviewSaved={() => {
            const id = "shop-source-masked-card";
            setPayments((current) =>
              current.some((entry) => entry.id === id)
                ? current
                : [
                    ...current,
                    {
                      id,
                      last4: "••••",
                      expiry: "",
                      billingAddressId: addressId,
                    },
                  ],
            );
            setPaymentChoice(id);
            setPaymentModal(false);
          }}
        />
      </Sheet>

      <Sheet
        open={Boolean(editingPaymentId)}
        title="Edit payment method"
        onClose={() => setEditingPaymentId("")}
      >
        {payments.find((card) => card.id === editingPaymentId) && (
          <PaymentEditor
            key={editingPaymentId}
            initialCard={payments.find((card) => card.id === editingPaymentId)}
            addresses={addresses}
            onEdited={(card) => {
              setPayments((current) =>
                current.map((entry) => (entry.id === card.id ? card : entry)),
              );
              setEditingPaymentId("");
            }}
          />
        )}
      </Sheet>

      <Sheet
        open={Boolean(help)}
        title={
          help === "shipping"
            ? "Shipping"
            : help === "taxes"
              ? "Estimated taxes"
              : help === "country"
                ? "Country or region"
                : help === "terms"
                  ? "Terms of Service"
                  : "Privacy Policy"
        }
        onClose={() => setHelp("")}
      >
        {help === "country" ? (
          <>
            <button
              className="checkout-country-choice shipping-option selected"
              onClick={() => setHelp("")}
              aria-label="Use United States (+1)"
            >
              <SourceUnitedStatesFlag /> United States (+1){" "}
              <Icon name="check" />
            </button>
            <p className="sheet-copy">
              United States is the only country available for text offers in
              this reference preview.
            </p>
          </>
        ) : help === "shipping" ? (
          <p className="sheet-copy">
            The selected shipping option is{" "}
            {shipping === 0 ? "Standard Shipping" : "Priority Shipping"},{" "}
            {formatMoney({ amount: fee, currency: "USD" })}. You can change it
            in Shipping method. This is the captured checkout rate; no live
            carrier quote has been requested.
          </p>
        ) : help === "taxes" ? (
          <p className="sheet-copy">
            The estimated tax shown for this reference order is{" "}
            {formatMoney({ amount: tax, currency: "USD" })}. It is a captured
            preview amount, not a live tax calculation. No payment will be
            submitted.
          </p>
        ) : (
          <p className="sheet-copy">
            {checkoutStoreName}’s{" "}
            {help === "terms" ? "Terms of Service" : "Privacy Policy"} are not
            included in this reference preview.
          </p>
        )}
      </Sheet>

      <Sheet
        open={Boolean(deleteAddressId)}
        title="Delete address"
        className="delete-address-confirm source-delete-address"
        onClose={closeDeleteAddress}
      >
        <p>
          Are you sure you want to delete the address{" "}
          {(() => {
            const target = addresses.find(
              (entry) => entry.id === deleteAddressId,
            );
            return target
              ? `${target.firstName} ${target.lastName}, ${target.street} ${target.city} ${target.region} ${target.postalCode}, US?`
              : "?";
          })()}
        </p>
        <div className="editor-actions">
          <button className="form-cancel" onClick={closeDeleteAddress}>
            Cancel
          </button>
          <button
            className="danger-button form-submit"
            onClick={() => {
              const remaining = addresses.filter(
                (entry) => entry.id !== deleteAddressId,
              );
              if (
                addresses.find((entry) => entry.id === deleteAddressId)
                  ?.isDefault &&
                remaining.length &&
                !remaining.some((entry) => entry.isDefault)
              ) {
                remaining[0] = { ...remaining[0], isDefault: true };
              }
              setAddresses(remaining);
              if (addressId === deleteAddressId)
                setAddressId(remaining[0]?.id ?? "");
              closeDeleteAddress();
            }}
          >
            Delete
          </button>
        </div>
      </Sheet>

      <Sheet
        open={paymentBoundary}
        title="Payment service is not connected"
        className="source-payment-boundary"
        onClose={() => setPaymentBoundary(false)}
      >
        <p>
          {hasCapturedKitschMerchandising ? (
            <>
              No card was charged and no order was created. The confirmation in
              the frozen reference is available below only as a captured source
              state.
            </>
          ) : (
            <>
              No card was charged and no order was created. This seller checkout
              does not have a captured confirmation.
            </>
          )}
        </p>
        {hasCapturedKitschMerchandising && (
          <Link
            className="primary form-submit"
            href="/orders/REF-1001/confirmation"
            onClick={(event) => {
              // Sheet consumes ordinary internal navigation in its capture
              // handler, before Next Link can call onNavigate.
              if (
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              )
                return;
              armCapturedConfirmation("REF-1001");
              setPaymentBoundary(false);
            }}
          >
            View captured source confirmation
          </Link>
        )}
        <button
          className="form-cancel"
          onClick={() => setPaymentBoundary(false)}
        >
          Back to checkout
        </button>
      </Sheet>
    </ShopSurface>
  );
}

function SourcePhoneSetup({
  stage,
  phone,
  onPhoneChange,
  onStageChange,
  onDone,
}: {
  stage: "phone" | "code";
  phone: string;
  onPhoneChange: (phone: string) => void;
  onStageChange: (stage: "phone" | "code") => void;
  onDone: (phone: string) => void;
}) {
  const [code, setCode] = useState("");
  const [processing, setProcessing] = useState(false);
  const [nextPending, setNextPending] = useState(false);
  const nextTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (nextTimer.current) clearTimeout(nextTimer.current);
    },
    [],
  );
  const [boundary, setBoundary] = useState(false);
  const digits = phone.replace(/\D/g, "");
  const beginBoundary = () => {
    if (processing) return;
    setProcessing(true);
    window.setTimeout(() => {
      setProcessing(false);
      setBoundary(true);
    }, 650);
  };
  return (
    <>
      <form
        className="source-phone-setup"
        onSubmit={(event) => {
          event.preventDefault();
          if (stage === "phone") {
            if (nextPending) return;
            setNextPending(true);
            nextTimer.current = setTimeout(() => {
              setNextPending(false);
              onStageChange("code");
            }, 650);
          } else if (code.length === 6) beginBoundary();
        }}
      >
        <div className="checkout-steps source-phone-steps">
          <i className="active" />
          <i className={stage === "code" ? "active" : ""} />
          <i />
          <i />
        </div>
        {stage === "phone" ? (
          <>
            <p className="source-phone-intro">
              Check out faster and safer. Your mobile number will be used to
              secure your payment information with Shop Pay.
            </p>
            <label className="source-phone-field">
              <span>Phone number</span>
              <div>
                <b>+1</b>
                <input
                  aria-label="Phone number"
                  inputMode="tel"
                  autoFocus
                  value={phone}
                  onChange={(event) =>
                    onPhoneChange(event.target.value.replace(/[^0-9 ()-]/g, ""))
                  }
                  placeholder="Enter your phone number"
                />
                <span aria-hidden="true">
                  <SourceUnitedStatesFlag />
                  <span>⌄</span>
                </span>
              </div>
            </label>
            <p className="source-phone-note">
              We’ll send you a security code to confirm it’s you.
            </p>
            <button
              className="primary source-phone-next"
              disabled={digits.length < 7 || nextPending}
              aria-label="Next"
              aria-busy={nextPending}
            >
              {nextPending ? (
                <span className="captured-button-spinner" aria-hidden="true" />
              ) : (
                "Next"
              )}
            </button>
          </>
        ) : (
          <>
            <p className="source-code-intro">
              {digits
                ? `Enter the code sent to +1${digits}`
                : "Enter your security code to continue."}
            </p>
            <label className="source-code-entry">
              <span className="sr-only">Security code</span>
              <div aria-hidden="true">
                {Array.from({ length: 6 }, (_, index) => (
                  <span key={index}>{code[index] ?? ""}</span>
                ))}
              </div>
              <input
                aria-label="Security code"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                value={code}
                maxLength={6}
                onChange={(event) => {
                  const next = event.target.value
                    .replace(/\D/g, "")
                    .slice(0, 6);
                  setCode(next);
                  if (next.length === 6) window.setTimeout(beginBoundary, 0);
                }}
              />
            </label>
            {processing && (
              <span
                className="source-code-spinner"
                aria-label="Checking code"
              />
            )}
            <button
              type="button"
              className="checkout-link source-resend-code"
              onClick={() => setBoundary(true)}
            >
              Resend code
            </button>
          </>
        )}
      </form>
      <Sheet
        open={boundary}
        title="Phone verification is not connected"
        className="source-phone-boundary"
        onClose={() => setBoundary(false)}
      >
        <p>
          No security code was sent and this number has not been verified. The
          next screen is available only to continue the frozen reference
          journey.
        </p>
        <button
          className="primary form-submit"
          onClick={() => {
            setBoundary(false);
            onDone(`+1${digits}`);
          }}
        >
          Continue to captured shipping address
        </button>
        <button className="form-cancel" onClick={() => setBoundary(false)}>
          Back to code entry
        </button>
      </Sheet>
    </>
  );
}

function SourceAddressLookup({
  onSelect,
  onManual,
  onSearchingChange,
}: {
  onSelect: (address: Address) => void;
  onManual: () => void;
  onSearchingChange: (searching: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const showSuggestion = focused && /1226|university|menlo/i.test(query.trim());
  const stopSearching = () => {
    setFocused(false);
    onSearchingChange(false);
  };
  return (
    <div className={`source-address-lookup ${focused ? "is-searching" : ""}`}>
      {!focused && (
        <label className="form-field source-country-field">
          Country/region
          <select defaultValue="United States">
            <option>United States</option>
          </select>
          <span aria-hidden="true">
            <SourceUnitedStatesFlag />
          </span>
        </label>
      )}
      <label className="form-field source-address-search-field">
        <Icon name="search" />
        <span>{focused ? "Address" : ""}</span>
        <input
          ref={searchInput}
          aria-label="Search address"
          placeholder="Start typing address..."
          value={query}
          onFocus={() => {
            setFocused(true);
            onSearchingChange(true);
          }}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              stopSearching();
              searchInput.current?.blur();
            }
          }}
        />
        {query && (
          <button
            type="button"
            aria-label="Clear address"
            onClick={() => {
              setQuery("");
              searchInput.current?.focus();
            }}
          >
            ×
          </button>
        )}
      </label>
      {focused && (
        <button
          className="checkout-link"
          onClick={() => {
            stopSearching();
            onManual();
          }}
        >
          <span aria-hidden="true">▱</span> Enter address manually
        </button>
      )}
      {showSuggestion && (
        <button
          className="source-address-suggestion"
          onClick={() => {
            stopSearching();
            onSelect({
              ...shopSourceAddress,
              id: "",
              firstName: "",
              lastName: "",
              isDefault: false,
            });
          }}
        >
          <AccountIcon name="location" filled />
          <span>
            1226 University Dr, Menlo Park CA 94025,
            <br /> United States
          </span>
        </button>
      )}
      {focused && !showSuggestion && query.trim() && (
        <p className="source-address-no-match" role="status">
          No captured suggestion matches. Enter your address manually.
        </p>
      )}
      {focused && (
        <p className="source-google-note">Suggestions powered by Google</p>
      )}
      {!focused && (
        <div className="source-address-lookup-actions">
          <button
            className="primary address-lookup-continue"
            onClick={onManual}
          >
            Continue to payment details
          </button>
        </div>
      )}
    </div>
  );
}

function SourceAddressEditor({
  initialValue,
  onSave,
  onCancel,
  onChange,
  compact = false,
  onExpand,
  variant,
}: {
  initialValue: Address;
  onSave: (value: Address) => void;
  onCancel: () => void;
  onChange?: (value: Address) => void;
  compact?: boolean;
  onExpand?: () => void;
  variant: "initial" | "sheet";
}) {
  const [value, setValue] = useState(initialValue);
  const [suggestions, setSuggestions] = useState(false);
  const [phoneHelp, setPhoneHelp] = useState(false);
  const change = (key: keyof Address, next: string | boolean) => {
    const updated = { ...value, [key]: next };
    setValue(updated);
    onChange?.(updated);
  };
  const field = (
    key: keyof Pick<
      Address,
      | "firstName"
      | "lastName"
      | "company"
      | "street"
      | "apartment"
      | "city"
      | "postalCode"
      | "phone"
    >,
    label: string,
    required = true,
  ) => (
    <div
      className={`source-address-field source-address-field-${key}`}
      key={key}
    >
      <label
        className="form-field source-floating-field"
        data-filled={Boolean(value[key])}
      >
        <span>{label}</span>
        <input
          aria-label={label}
          value={String(value[key] ?? "")}
          placeholder={label}
          required={required}
          type={key === "phone" ? "tel" : "text"}
          autoComplete="off"
          onFocus={() => {
            if (key === "street" && variant === "sheet") setSuggestions(true);
          }}
          onBlur={(event) => {
            if (
              key === "street" &&
              !event.currentTarget.parentElement?.parentElement?.contains(
                event.relatedTarget,
              )
            )
              setSuggestions(false);
          }}
          onChange={(event) => change(key, event.target.value)}
        />
        {key === "street" && <Icon name="search" />}
      </label>
      {key === "phone" && variant === "sheet" && (
        <>
          <button
            type="button"
            className="source-address-phone-help"
            aria-label="About delivery phone number"
            aria-expanded={phoneHelp}
            onClick={() => setPhoneHelp((current) => !current)}
          >
            <Icon name="question-circle" />
          </button>
          {phoneHelp && (
            <p className="source-security-help" role="status">
              A phone number is optional for this delivery address.
            </p>
          )}
        </>
      )}
      {key === "street" &&
        suggestions &&
        /1226|university|menlo/i.test(value.street) && (
          <div className="source-inline-address-suggestion">
            <span>SUGGESTIONS</span>
            <button
              type="button"
              aria-label="Close address suggestions"
              onClick={() => setSuggestions(false)}
            >
              ×
            </button>
            <button
              type="button"
              className="source-address-result"
              onClick={() => {
                const updated = {
                  ...value,
                  street: shopSourceAddress.street,
                  city: shopSourceAddress.city,
                  region: shopSourceAddress.region,
                  postalCode: shopSourceAddress.postalCode,
                };
                setValue(updated);
                onChange?.(updated);
                setSuggestions(false);
              }}
            >
              <strong>1226 University Dr,</strong> Menlo Park CA 94025, United
              States
            </button>
          </div>
        )}
    </div>
  );
  const country = (
    <label className="form-field source-country-field">
      Country/Region
      <select
        value={value.country}
        onChange={(event) => change("country", event.target.value)}
      >
        <option>United States</option>
      </select>
      {variant === "initial" && (
        <span aria-hidden="true">
          <SourceUnitedStatesFlag />
        </span>
      )}
    </label>
  );
  const locality = (
    <>
      {field("city", "City")}
      <label
        className="form-field source-floating-field"
        data-filled={Boolean(value.region)}
      >
        <span>State</span>
        <select
          aria-label="State"
          value={value.region}
          onChange={(event) => change("region", event.target.value)}
          required
        >
          <option value="">State</option>
          <option value="CA">California</option>
        </select>
      </label>
      {field("postalCode", "ZIP code")}
    </>
  );
  return (
    <form
      className={`source-address-editor source-address-editor-${variant} ${compact ? "is-compact" : ""}`}
      onSubmit={(event) => {
        event.preventDefault();
        onSave(value);
      }}
    >
      {compact && (
        <div className="source-selected-address">
          <AccountIcon name="location" filled />
          <span>
            <strong>{value.street}</strong>
            <small>
              {value.city}, {value.region}, {value.postalCode}, US
            </small>
          </span>
          <button type="button" onClick={onExpand}>
            Edit
          </button>
        </div>
      )}
      {variant === "sheet" && country}
      {field("firstName", "First name")}
      {field("lastName", "Last name")}
      {!compact && variant === "initial" && country}
      {variant === "sheet" && field("company", "Company (optional)", false)}
      {!compact && field("street", "Address")}
      {field("apartment", "Apartment, suite, etc (optional)", false)}
      {variant === "initial" && field("company", "Company (optional)", false)}
      {variant === "sheet" && locality}
      {field("phone", "Phone (optional)", false)}
      {variant === "initial" && !compact && locality}
      {variant === "sheet" && (
        <label className="check-row source-default-address">
          <input
            type="checkbox"
            checked={value.isDefault}
            onChange={(event) => change("isDefault", event.target.checked)}
          />
          This is my default address
        </label>
      )}
      <div className="editor-actions">
        {variant === "sheet" && (
          <button type="button" className="form-cancel" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="primary form-submit">
          {variant === "initial"
            ? "Continue to payment details"
            : "Save address"}
        </button>
      </div>
    </form>
  );
}

function SourceUnitedStatesFlag() {
  return (
    <svg className="source-us-flag" viewBox="0 0 26 18" aria-hidden="true">
      <rect width="26" height="18" rx="2" fill="#fff" />
      <path
        d="M0 1h26M0 4h26M0 7h26M0 10h26M0 13h26M0 16h26"
        stroke="#db3445"
        strokeWidth="1.5"
      />
      <path fill="#304a80" d="M0 0h12v10H0z" />
      <path
        d="M2 2h8M2 4h8M2 6h8M2 8h8"
        stroke="#fff"
        strokeWidth=".8"
        strokeDasharray="1 1.4"
      />
    </svg>
  );
}

function SourceApplePayMark() {
  return (
    <span className="source-apple-mark" aria-hidden="true">
      <svg viewBox="0 0 18 21">
        <path
          fill="currentColor"
          d="M12.3.6c.2 1.8-.6 3.7-2.8 4.3-.4-1.9.8-3.8 2.8-4.3ZM8.7 6c1.7 0 2.2-1.1 3.9-.9 1.6.1 2.5.8 3.1 1.7-3.1 1.9-2.6 5.6.5 7-.6 1.6-1.4 3.2-2.4 4.4-1.9 2.4-2.7.6-5 .6s-3.3 1.9-5.1-.8C1.3 14.4.2 9.7 3.1 6.6 4.7 4.9 6.6 5.2 8.7 6Z"
        />
      </svg>
      Pay
    </span>
  );
}

function SourcePaymentEditor({
  addresses,
  selectedAddressId,
  onCancel,
  onPreviewSaved,
}: {
  addresses: Address[];
  selectedAddressId: string;
  onCancel: () => void;
  onPreviewSaved: () => void;
}) {
  const [method, setMethod] = useState<"card" | "apple">("card");
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [name, setName] = useState(
    `${shopSourceBuyer.firstName} ${shopSourceBuyer.lastName}`,
  );
  const [nickname, setNickname] = useState("");
  const [securityHelp, setSecurityHelp] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [billing, setBilling] = useState(selectedAddressId);
  const [billOpen, setBillOpen] = useState(false);
  const [billingEditor, setBillingEditor] = useState(false);
  const [addedBillingAddresses, setAddedBillingAddresses] = useState<Address[]>(
    [],
  );
  const billingAddresses = [...addresses, ...addedBillingAddresses];
  const [boundary, setBoundary] = useState(false);
  const validCard =
    /^\d{12,19}$/.test(number.replace(/\D/g, "")) &&
    /^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry) &&
    /^\d{3,4}$/.test(cvc);
  const selectedBilling = billingAddresses.find(
    (entry) => entry.id === billing,
  );
  useEffect(() => {
    const sheet = formRef.current?.closest<HTMLDialogElement>(
      ".source-payment-sheet",
    );
    if (!sheet) return;
    const syncScrollState = () => setScrolled(sheet.scrollTop >= 40);
    syncScrollState();
    sheet.addEventListener("scroll", syncScrollState, { passive: true });
    return () => sheet.removeEventListener("scroll", syncScrollState);
  }, []);
  return (
    <>
      <form
        ref={formRef}
        className={`source-payment-editor${scrolled ? " source-payment-editor-scrolled" : ""}`}
        onSubmit={(event) => {
          event.preventDefault();
          setBoundary(true);
        }}
      >
        <div className="source-card-method">
          <label className="shipping-option selected source-payment-method-choice">
            <input
              type="radio"
              name="new-payment"
              checked={method === "card"}
              onChange={() => setMethod("card")}
            />
            <span>
              <strong>Credit card</strong>
              <small className="source-payment-brands">
                <b className="visa-mark">VISA</b>
                {!number && (
                  <>
                    <b className="source-mastercard" aria-label="Mastercard">
                      <i />
                      <i />
                    </b>
                    <b className="source-amex">
                      AM
                      <br />
                      EX
                    </b>
                    <b className="source-more-cards">+5</b>
                  </>
                )}
              </small>
            </span>
          </label>
          <div className="source-card-fields">
            <label className="form-field">
              Card number
              <input
                aria-label="Card number"
                inputMode="numeric"
                autoComplete="off"
                disabled={method !== "card"}
                value={number}
                onChange={(event) =>
                  setNumber(event.target.value.replace(/[^0-9 ]/g, ""))
                }
                placeholder="Card number"
              />
              <Icon name="lock" />
            </label>
            <div>
              <label className="form-field">
                {" "}
                Expiration date (MM / YY)
                <input
                  aria-label="Expiration"
                  disabled={method !== "card"}
                  value={expiry}
                  onChange={(event) => setExpiry(event.target.value)}
                  placeholder="Expiration date (MM / YY)"
                />
              </label>{" "}
              <div className="form-field source-security-field">
                <span>Security code</span>
                <input
                  aria-label="Security code"
                  inputMode="numeric"
                  disabled={method !== "card"}
                  value={cvc}
                  onChange={(event) =>
                    setCvc(event.target.value.replace(/\D/g, ""))
                  }
                  placeholder="Security code"
                />
                <button
                  type="button"
                  className="source-card-help"
                  aria-label="About security code"
                  aria-expanded={securityHelp}
                  onClick={() => setSecurityHelp((current) => !current)}
                >
                  ?
                </button>
                {securityHelp && (
                  <p className="source-security-help" role="status">
                    The 3 or 4 digit security code printed on your card.
                  </p>
                )}
              </div>
            </div>
          </div>{" "}
          <div className="form-field source-card-name">
            <span>Name on card</span>
            <input
              ref={nameInput}
              aria-label="Name on card"
              placeholder="Name on card"
              value={name}
              disabled={method !== "card"}
              onChange={(event) => setName(event.target.value)}
            />
            {name && (
              <button
                type="button"
                aria-label="Clear name on card"
                disabled={method !== "card"}
                onClick={() => {
                  setName("");
                  nameInput.current?.focus();
                }}
              >
                <Icon name="close" />
              </button>
            )}
          </div>
          <label className="form-field">
            Nickname (optional){" "}
            <input
              placeholder="Nickname (optional)"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
            />
          </label>
        </div>
        <label className="shipping-option source-payment-method-choice source-apple-choice">
          <input
            type="radio"
            name="new-payment"
            checked={method === "apple"}
            onChange={() => setMethod("apple")}
          />
          <strong>Apple Pay</strong>
          <SourceApplePayMark />
        </label>
        <div className="source-billing-group">
          <button
            type="button"
            className="source-bill-to"
            aria-expanded={billOpen}
            onClick={() => setBillOpen((current) => !current)}
          >
            <span>Bill to</span>
            {!billOpen && selectedBilling && (
              <span>
                <strong>
                  {selectedBilling.firstName} {selectedBilling.lastName}
                </strong>
                <br />
                {selectedBilling.street}
                <br />
                {selectedBilling.city} {selectedBilling.region}{" "}
                {selectedBilling.postalCode}, US
              </span>
            )}
            <span className="source-billing-chevron" aria-hidden="true">
              <Icon name="chevron" />
            </span>
          </button>
          {billOpen && (
            <div className="source-billing-options">
              {billingAddresses.map((entry) => (
                <label
                  className={`shipping-option ${billing === entry.id ? "selected" : ""}`}
                  key={entry.id}
                >
                  <input
                    type="radio"
                    name="billing"
                    checked={billing === entry.id}
                    onChange={() => setBilling(entry.id)}
                  />
                  <span>
                    <strong>
                      {" "}
                      {entry.firstName} {entry.lastName}, {entry.street}
                    </strong>
                    <span>
                      {entry.city} {entry.region} {entry.postalCode}, US,
                    </span>
                    {entry.phone && <span>{entry.phone}</span>}
                    {entry.isDefault && (
                      <small className="default-pill">Default</small>
                    )}
                  </span>
                </label>
              ))}
              <button
                type="button"
                className="checkout-link"
                onClick={() => setBillingEditor(true)}
              >
                ＋ Use a different address
              </button>
            </div>
          )}
        </div>
        {boundary && (
          <div className="payment-preview-boundary" role="status">
            <strong>Payment service is not connected.</strong>
            <p>No payment method was added and no card data was sent.</p>
            {method === "card" && validCard && (
              <button
                type="button"
                className="primary form-submit"
                onClick={onPreviewSaved}
              >
                Preview captured post-save state
              </button>
            )}
            {method === "card" && !validCard && (
              <p className="form-error">
                Check the card fields before previewing the captured state.
              </p>
            )}
            {method === "apple" && (
              <p className="form-error">
                Apple Pay is not connected in this reference preview.
              </p>
            )}
          </div>
        )}
        <div className="editor-actions">
          <button type="button" className="form-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="primary form-submit" type="submit">
            Save
          </button>
        </div>
      </form>
      <Sheet
        open={billingEditor}
        title="Billing address"
        className="source-address-sheet"
        onClose={() => setBillingEditor(false)}
      >
        <SourceAddressEditor
          key={String(billingEditor)}
          variant="sheet"
          initialValue={blankCheckoutAddress()}
          onCancel={() => setBillingEditor(false)}
          onSave={(address) => {
            const added = { ...address, id: crypto.randomUUID() };
            setAddedBillingAddresses((current) => [...current, added]);
            setBilling(added.id);
            setBillingEditor(false);
          }}
        />
      </Sheet>
    </>
  );
}

export function CartOffer({
  catalog,
  storeId,
  open,
  onClose,
}: {
  catalog: Catalog;
  storeId: string;
  open: boolean;
  onClose: () => void;
}) {
  const state = useDiscovery();
  const { hasPaymentProfile } = useAccount();
  const offerIds = [
    "black-conditioner-bag",
    "chocolate-body-bag",
    "shower-caddy",
    "solid-shave-butter",
  ];
  const products = offerIds.flatMap((id) => {
    const product = catalog.products.find((entry) => entry.id === id);
    return product ? [product] : [];
  });
  const lines = state.cart.filter(
    (line) =>
      catalog.products.find((product) => product.id === line.productId)
        ?.storeId === storeId,
  );
  const subtotal = lines.reduce(
    (n, line) =>
      n +
      capturedLineAmount(
        line,
        catalog.products.find((product) => product.id === line.productId)?.price
          .amount ?? 0,
      ) *
        line.quantity,
    0,
  );
  const comparison =
    lines.length > 0 &&
    lines.every((line) => capturedOfferCompareAt(line) !== undefined)
      ? lines.reduce(
          (amount, line) =>
            amount + (capturedOfferCompareAt(line) ?? 0) * line.quantity,
          0,
        )
      : undefined;
  return (
    <Sheet
      open={open}
      title={`Add ${formatMoney({ amount: Math.max(0, 5000 - subtotal), currency: "USD" })} to save $20 with your exclusive offer`}
      onClose={onClose}
      className="cart-offer"
    >
      <div className="offer-progress">
        <span style={{ width: `${Math.min(100, subtotal / 50)}%` }} />
      </div>
      <div className="offer-products">
        {products.map((product) => (
          <article key={product.id}>
            <Link href={`/products/${product.id}`} onClick={onClose}>
              <img src={product.images[0]} alt="" />
              {product.compareAt && (
                <span className="offer-discount">47% off</span>
              )}
              <strong>{product.title}</strong>
              <span>
                {formatMoney(product.price)}{" "}
                {product.compareAt && (
                  <del>{formatMoney(product.compareAt)}</del>
                )}
              </span>
            </Link>
            <button
              className="offer-heart"
              aria-label={`Save ${product.title}`}
              aria-pressed={state.saved.includes(product.id)}
              onClick={() => state.toggleSaved(product.id)}
            >
              <Icon name="heart" filled={state.saved.includes(product.id)} />
            </button>
          </article>
        ))}
      </div>
      <div className="offer-footer">
        <p>
          In your cart{" "}
          <strong>{lines.reduce((n, line) => n + line.quantity, 0)}</strong>
          <span>
            {comparison !== undefined && comparison > subtotal && (
              <del>{formatMoney({ amount: comparison, currency: "USD" })}</del>
            )}{" "}
            {formatMoney({ amount: subtotal, currency: "USD" })}
          </span>
        </p>
        <div className="offer-cart-thumbnails" aria-hidden="true">
          {lines.slice(0, 3).map((line) => {
            const product = catalog.products.find(
              (entry) => entry.id === line.productId,
            );
            return product ? (
              <img
                key={`${line.productId}-${line.variantId}`}
                src={product.images[0]}
                alt=""
              />
            ) : null;
          })}
        </div>
        <Link
          className="primary form-submit"
          onClick={onClose}
          href={`/checkout?store=${encodeURIComponent(storeId)}${hasPaymentProfile ? "" : "&stage=phone"}`}
        >
          Continue to checkout
        </Link>
      </div>
    </Sheet>
  );
}
