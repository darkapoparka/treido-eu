"use client";
import { useLocale as useIntlLocale } from "next-intl";
import { useCaption } from "../locale/use-caption";
import { useTranslations } from "next-intl";
import { ShopSurface } from "../discovery/hydration-boundary";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CartCatalog } from "./cart-catalog";
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
  const ui = useTranslations("commerceUI");
  return (
    <AccountPage title={ui("yourCart")}>
      <CartContents catalog={catalog} />
    </AccountPage>
  );
}

export function CartOverlay({
  catalog,
  content,
  open,
  onClose,
}: {
  catalog: CartCatalog;
  content?: ReactNode;
  open: boolean;
  onClose: () => void;
}) {
  const ui = useTranslations("commerceUI");
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
        title={ui("yourCart")}
        className="dark-cart-sheet"
        headerless
        onClose={onClose}
      >
        {content ?? (
          <CartContents
            catalog={catalog}
            onNavigate={(href) => {
              if (sourceOrigin.current?.token)
                bindSourceDestination(sourceOrigin.current.token, href);
              onClose();
            }}
            onOffer={setOffer}
          />
        )}
        <button
          className="cart-close"
          aria-label={ui("closeCart")}
          onClick={onClose}
          data-ui-label="closeCart"
        >
          <Icon name="close" />
        </button>
      </Sheet>
      <CartOffer
        catalog={catalog}
        content={content}
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
  const intlLocale = useIntlLocale();
  const caption = useCaption();
  const ui = useTranslations("commerceUI");
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
      <AccountPage title={ui("checkout")}>
        <div className="notification-empty order-empty-source">
          <h2>{ui("yourCartIsEmpty")}</h2>
          <p>{ui("addProductsWhileYouShopSoTheyLlBeReady")}</p>
          <Link href="/search" className="form-cancel">
            {ui("goShopping")}
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
          <Link
            href="/cart"
            aria-label={ui("closeCheckout")}
            data-ui-label="closeCheckout"
          >
            <Icon name="close" />
          </Link>
        ) : (
          <button
            aria-label={ui("goBack")}
            onClick={backFromSetup}
            data-ui-label="goBack"
          >
            <Icon name="back" />
          </button>
        )}
        <h1>
          {step === "review"
            ? ui("reviewPay")
            : step === "phone"
              ? phoneStage === "code"
                ? ui("confirmItSYou")
                : ui("addPhoneNumber")
              : step === "address" || step === "address-search"
                ? ui("shippingAddress")
                : ui("addACard")}
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
              aria-label={ui("loadingCapturedCheckout")}
              data-ui-label="loadingCapturedCheckout"
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
                <span className="checkout-section-label">{ui("shipTo")}</span>
                {!expanded.includes("ship") && address && (
                  <span className="checkout-section-value">
                    <strong>
                      {address.firstName} {address.lastName}
                    </strong>
                    <span>
                      {address.street}, {address.city} {address.region}
                      <br />
                      {address.postalCode}
                      {ui("uS")}
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
                            {entry.city} {entry.region} {entry.postalCode}
                            {ui("uS")}
                            {entry.phone
                              ? `, ${entry.phone.replace(/\s/g, "")}`
                              : ""}
                          </span>
                          {entry.isDefault && (
                            <small className="default-pill">
                              {ui("default")}
                            </small>
                          )}
                        </span>
                      </label>
                      {!entry.isDefault && (
                        <button
                          type="button"
                          className="source-default-action"
                          aria-label={ui("setValue1AsDefaultAddress", {
                            value1: entry.street ?? "",
                          })}
                          onClick={() =>
                            setAddresses((current) =>
                              current.map((item) => ({
                                ...item,
                                isDefault: item.id === entry.id,
                              })),
                            )
                          }
                        >
                          {ui("setAsDefault")}
                        </button>
                      )}
                      <button
                        className="context-trigger"
                        aria-label={ui("addressOptionsForValue1", {
                          value1: entry.street ?? "",
                        })}
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
                            {ui("edit")}
                          </button>
                          <button
                            className="danger-text"
                            onClick={() => {
                              setDeleteAddressId(entry.id);
                              setAddressMenu("");
                            }}
                          >
                            {ui("delete")}
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
                    <Icon name="plus" /> {ui("useADifferentAddress_deaf31")}
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
                <span className="checkout-section-label">{ui("shipping")}</span>
                {!expanded.includes("shipping") && (
                  <span className="checkout-section-value">
                    <strong>
                      {shipping === 0
                        ? ui("standardShipping")
                        : ui("priorityShipping")}{" "}
                      ·{" "}
                      {formatMoney(
                        { amount: fee, currency: "USD" },
                        intlLocale,
                      )}
                    </strong>
                    <span>
                      <span className="checkout-shipping-status">
                        {ui("readyToShip")}
                      </span>
                      <br />
                      {shipping === 0 ? ui("text35Days") : ui("text13Days")}
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
                        <strong>{caption(name)}</strong>
                        <span>{eta}</span>
                        <span>{delivery}</span>
                      </span>
                      <b>
                        {formatMoney(
                          {
                            amount: Number(price),
                            currency: "USD",
                          },
                          intlLocale,
                        )}
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
                <span className="checkout-section-label">{ui("plan")}</span>
                {!expanded.includes("plan") && (
                  <span className="checkout-section-value">
                    <strong>{ui("payNow")}</strong>
                    <span>{ui("payTheEntireAmountToday")}</span>
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
                      <span>{ui("installmentsUnavailable")}</span>
                    </strong>
                    <p>{ui("installmentsCanOnlyBeUsedForOrdersBetween3500")}</p>
                  </div>
                  <label className="shipping-option selected">
                    <input type="radio" checked readOnly />
                    <span>
                      <strong>{ui("payNow")}</strong>
                      <span>{ui("payTheEntireAmountToday")}</span>
                    </span>
                  </label>
                  <label className="shipping-option is-disabled">
                    <input type="radio" disabled />
                    <span>
                      <strong>{ui("payIn2Installments")}</strong>
                      <span>{ui("payEvery15DaysWithNoInterestOrFees")}</span>
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
                <span className="checkout-section-label">{ui("payment")}</span>
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
                                : ui("addBillingAddress")}
                            </span>
                          </span>
                        </label>
                        <button
                          className="context-trigger"
                          aria-label={ui("paymentMethodOptionsValue1", {
                            value1: card.last4 ?? "",
                          })}
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
                              {ui("edit")}
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
                              {ui("delete")}
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
                      <span>＋</span> {ui("payAnotherWay")}
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
                    {ui("get2000OffOnOrdersOver5000")}
                    <br />
                    <Link href="/search">{ui("keepShopping_45f176")}</Link>
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
            <span>{ui("signMeUpForNewsAndOffersFromThisStore")}</span>
          </label>

          {(reviewStage === 3 || reviewStage === 4) && (
            <div
              className="captured-review-extras-loading"
              role="status"
              aria-label={ui("loadingCapturedRecommendations")}
              data-ui-label="loadingCapturedRecommendations"
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
              <h2>{ui("textOffers")}</h2>
              <p>{ui("signUpToBeInTheLoopOnExclusiveOffers")}</p>
              <div className="source-text-offer-phone">
                <input
                  type="tel"
                  aria-label={ui("phoneNumberForTextOffers")}
                  placeholder={ui("phoneNumber")}
                  autoComplete="tel-national"
                  value={textOfferPhone}
                  disabled={processing || reviewPending}
                  onChange={(event) => setTextOfferPhone(event.target.value)}
                  data-ui-label="phoneNumberForTextOffers"
                />
                <button
                  type="button"
                  aria-label={ui("textOffersCountryUnitedStates1")}
                  aria-haspopup="dialog"
                  onClick={() => setHelp("country")}
                  data-ui-label="textOffersCountryUnitedStates1"
                >
                  <SourceUnitedStatesFlag />
                  <span aria-hidden="true">⌄</span>
                </button>
              </div>
              <p className="checkout-sms-terms">
                {ui("byProvidingYourNumberAndClickingTheButtonYouAgree")}{" "}
                <a href={policies?.terms}>{ui("tERMSOFSERVICE")}</a>{" "}
                {ui(
                  "includingArbitrationConsentIsNotRequiredToPurchaseMsgData",
                )}{" "}
                <a href={policies?.privacy}>{ui("pRIVACYPOLICY")}</a>.
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
                <Icon name="price-tag" /> {ui("addDiscount")}
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
                <strong>{summary ? ui("orderSummary") : ui("total")}</strong>
                <small>
                  {quantity} {quantity === 1 ? ui("item") : ui("items")}
                </small>
              </span>
              <span className="source-total-value">
                <span className="source-total-price">
                  <b>USD</b>
                  <strong>
                    {formatMoney(
                      { amount: total, currency: "USD" },
                      intlLocale,
                    )}
                  </strong>
                  <span className="source-total-caret" aria-hidden="true">
                    <Icon name="chevron" />
                  </span>
                </span>
                {savings > 0 && (
                  <small>
                    <Icon name="price-tags" /> {ui("totalSavings")}{" "}
                    {formatMoney(
                      { amount: savings, currency: "USD" },
                      intlLocale,
                    )}
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
                      {ui("completeThisPurchaseTo")}
                      <br />
                      {ui("earn4Points")}
                    </span>
                    <span className="order-points-caret" aria-hidden="true">
                      <Icon name="chevron" />
                    </span>
                  </summary>
                  <p>{ui("theCapturedOfferAwards4PointsNoLoyaltyAccountIs")}</p>
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
                            <span>{ui("text27OFFBACKTOSCHOOLSALE135")}</span>
                          </small>
                        )}
                        {line.quantity > 1 && (
                          <small>
                            {ui("quantity")} {line.quantity}
                          </small>
                        )}
                      </span>
                      <strong>
                        {net !== line.product.price.amount && (
                          <del>
                            {formatMoney(line.product.price, intlLocale)}
                          </del>
                        )}{" "}
                        {formatMoney(
                          {
                            amount: net * line.quantity,
                            currency: line.product.price.currency,
                          },
                          intlLocale,
                        )}
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
                        {formatMoney(
                          {
                            amount: product.amount,
                            currency: "USD",
                          },
                          intlLocale,
                        )}
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
                    aria-label={ui("discountCode")}
                    placeholder={ui("discountCodeOrGiftCard")}
                    disabled={processing || reviewPending}
                    value={code}
                    onChange={(event) => {
                      setCode(event.target.value);
                      setDiscountError(false);
                    }}
                    data-ui-label="discountCode"
                  />
                  <button type="submit" disabled={processing || !code.trim()}>
                    {ui("apply")}
                  </button>
                </form>
                {discountError && (
                  <p className="form-error" role="alert">
                    {ui("discountCodesCannotBeValidatedInThisReferencePreview")}
                  </p>
                )}
                <div className="checkout-totals">
                  <p>
                    {ui("subtotal")}{" "}
                    <span>
                      {formatMoney(
                        { amount: subtotal, currency: "USD" },
                        intlLocale,
                      )}
                    </span>
                  </p>
                  <p>
                    <button
                      type="button"
                      className="checkout-fee-label"
                      aria-label={ui("aboutShipping")}
                      onClick={() => setHelp("shipping")}
                      data-ui-label="aboutShipping"
                    >
                      {ui("shipping")} <Icon name="question-circle" />
                    </button>
                    <span>
                      {formatMoney(
                        { amount: fee, currency: "USD" },
                        intlLocale,
                      )}
                    </span>
                  </p>
                  <p>
                    <button
                      type="button"
                      className="checkout-fee-label"
                      aria-label={ui("aboutEstimatedTaxes")}
                      onClick={() => setHelp("taxes")}
                      data-ui-label="aboutEstimatedTaxes"
                    >
                      {ui("estimatedTaxes")} <Icon name="question-circle" />
                    </button>
                    <span>
                      {formatMoney(
                        { amount: tax, currency: "USD" },
                        intlLocale,
                      )}
                    </span>
                  </p>
                  <p className="checkout-total-line">
                    <strong>{ui("total")}</strong>
                    <strong>
                      {formatMoney(
                        { amount: total, currency: "USD" },
                        intlLocale,
                      )}
                    </strong>
                  </p>
                  {savings > 0 && (
                    <strong className="checkout-savings">
                      <Icon name="price-tags" />
                      <span>
                        {ui("tOTALSAVINGS")}{" "}
                        {formatMoney(
                          { amount: savings, currency: "USD" },
                          intlLocale,
                        )}
                      </span>
                    </strong>
                  )}
                </div>
              </div>
            )}

            <p className="checkout-terms">
              {ui("byClickingPayNowYouAgreeTo")} {checkoutStoreName}’s{" "}
              {policies ? (
                <a href={policies.terms}>{ui("termsOfService_4afa55")}</a>
              ) : (
                <button
                  className="checkout-policy-link"
                  onClick={() => setHelp("terms")}
                >
                  {ui("termsOfService_4afa55")}
                </button>
              )}{" "}
              {ui("and")}{" "}
              {policies ? (
                <a href={policies.privacy}>{ui("privacyPolicy_506ff3")}</a>
              ) : (
                <button
                  className="checkout-policy-link"
                  onClick={() => setHelp("privacy")}
                >
                  {ui("privacyPolicy_506ff3")}
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
                  {processingCaption && ui("processing")}
                </span>
              ) : (
                <>
                  <span>{ui("payNow")}</span>
                  <b>
                    {formatMoney(
                      { amount: previewPayAmount, currency: "USD" },
                      intlLocale,
                    )}
                  </b>
                </>
              )}
            </button>
          </div>
        </>
      )}

      <Sheet
        open={addressModal}
        title={editingAddressId ? ui("editAddress") : ui("addAddress")}
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
        title={ui("paymentMethods")}
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
        title={ui("editPaymentMethod")}
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
            ? ui("shipping")
            : help === "taxes"
              ? ui("estimatedTaxes")
              : help === "country"
                ? ui("countryOrRegion")
                : help === "terms"
                  ? ui("termsOfService_4afa55")
                  : ui("privacyPolicy_506ff3")
        }
        onClose={() => setHelp("")}
      >
        {help === "country" ? (
          <>
            <button
              className="checkout-country-choice shipping-option selected"
              onClick={() => setHelp("")}
              aria-label={ui("useUnitedStates1")}
              data-ui-label="useUnitedStates1"
            >
              <SourceUnitedStatesFlag /> {ui("unitedStates1")}{" "}
              <Icon name="check" />
            </button>
            <p className="sheet-copy">
              {ui("unitedStatesIsTheOnlyCountryAvailableForTextOffers")}
            </p>
          </>
        ) : help === "shipping" ? (
          <p className="sheet-copy">
            {ui("theSelectedShippingOptionIs")}{" "}
            {shipping === 0 ? ui("standardShipping") : ui("priorityShipping")},{" "}
            {formatMoney({ amount: fee, currency: "USD" }, intlLocale)}
            {ui("youCanChangeItInShippingMethodThisIsThe")}
          </p>
        ) : help === "taxes" ? (
          <p className="sheet-copy">
            {ui("theEstimatedTaxShownForThisReferenceOrderIs")}{" "}
            {formatMoney({ amount: tax, currency: "USD" }, intlLocale)}
            {ui("itIsACapturedPreviewAmountNotALiveTax")}
          </p>
        ) : (
          <p className="sheet-copy">
            {checkoutStoreName}’s{" "}
            {help === "terms"
              ? ui("termsOfService_4afa55")
              : ui("privacyPolicy_506ff3")}{" "}
            {ui("areNotIncludedInThisReferencePreview")}
          </p>
        )}
      </Sheet>

      <Sheet
        open={Boolean(deleteAddressId)}
        title={ui("deleteAddress")}
        className="delete-address-confirm source-delete-address"
        onClose={closeDeleteAddress}
      >
        <p>
          {ui("areYouSureYouWantToDeleteTheAddress")}{" "}
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
            {ui("cancel")}
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
            {ui("delete")}
          </button>
        </div>
      </Sheet>

      <Sheet
        open={paymentBoundary}
        title={ui("paymentServiceIsNotConnected")}
        className="source-payment-boundary"
        onClose={() => setPaymentBoundary(false)}
      >
        <p>
          {hasCapturedKitschMerchandising ? (
            <>{ui("noCardWasChargedAndNoOrderWasCreatedThe")}</>
          ) : (
            <>{ui("noCardWasChargedAndNoOrderWasCreatedThis")}</>
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
            {ui("viewCapturedSourceConfirmation")}
          </Link>
        )}
        <button
          className="form-cancel"
          onClick={() => setPaymentBoundary(false)}
        >
          {ui("backToCheckout")}
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
  const ui = useTranslations("commerceUI");
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
              {ui("checkOutFasterAndSaferYourMobileNumberWillBe")}
            </p>
            <label className="source-phone-field">
              <span>{ui("phoneNumber")}</span>
              <div>
                <b>+1</b>
                <input
                  aria-label={ui("phoneNumber")}
                  inputMode="tel"
                  autoFocus
                  value={phone}
                  onChange={(event) =>
                    onPhoneChange(event.target.value.replace(/[^0-9 ()-]/g, ""))
                  }
                  placeholder={ui("enterYourPhoneNumber")}
                  data-ui-label="phoneNumber"
                />
                <span aria-hidden="true">
                  <SourceUnitedStatesFlag />
                  <span>⌄</span>
                </span>
              </div>
            </label>
            <p className="source-phone-note">
              {ui("weLlSendYouASecurityCodeToConfirmIt")}
            </p>
            <button
              className="primary source-phone-next"
              disabled={digits.length < 7 || nextPending}
              aria-label={ui("next")}
              aria-busy={nextPending}
              data-ui-label="next"
            >
              {nextPending ? (
                <span className="captured-button-spinner" aria-hidden="true" />
              ) : (
                ui("next")
              )}
            </button>
          </>
        ) : (
          <>
            <p className="source-code-intro">
              {digits
                ? `Enter the code sent to +1${digits}`
                : ui("enterYourSecurityCodeToContinue")}
            </p>
            <label className="source-code-entry">
              <span className="sr-only">{ui("securityCode")}</span>
              <div aria-hidden="true">
                {Array.from({ length: 6 }, (_, index) => (
                  <span key={index}>{code[index] ?? ""}</span>
                ))}
              </div>
              <input
                aria-label={ui("securityCode")}
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
                data-ui-label="securityCode"
              />
            </label>
            {processing && (
              <span
                className="source-code-spinner"
                aria-label={ui("checkingCode")}
                data-ui-label="checkingCode"
              />
            )}
            <button
              type="button"
              className="checkout-link source-resend-code"
              onClick={() => setBoundary(true)}
            >
              {ui("resendCode")}
            </button>
          </>
        )}
      </form>
      <Sheet
        open={boundary}
        title={ui("phoneVerificationIsNotConnected")}
        className="source-phone-boundary"
        onClose={() => setBoundary(false)}
      >
        <p>{ui("noSecurityCodeWasSentAndThisNumberHasNot")}</p>
        <button
          className="primary form-submit"
          onClick={() => {
            setBoundary(false);
            onDone(`+1${digits}`);
          }}
        >
          {ui("continueToCapturedShippingAddress")}
        </button>
        <button className="form-cancel" onClick={() => setBoundary(false)}>
          {ui("backToCodeEntry")}
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
  const ui = useTranslations("commerceUI");
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
          {ui("countryRegion")}
          <select defaultValue="United States">
            <option value="United States">{ui("unitedStates")}</option>
          </select>
          <span aria-hidden="true">
            <SourceUnitedStatesFlag />
          </span>
        </label>
      )}
      <label className="form-field source-address-search-field">
        <Icon name="search" />
        <span>{focused ? ui("address") : ""}</span>
        <input
          ref={searchInput}
          aria-label={ui("searchAddress")}
          placeholder={ui("startTypingAddress")}
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
          data-ui-label="searchAddress"
        />
        {query && (
          <button
            type="button"
            aria-label={ui("clearAddress")}
            onClick={() => {
              setQuery("");
              searchInput.current?.focus();
            }}
            data-ui-label="clearAddress"
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
          <span aria-hidden="true">▱</span> {ui("enterAddressManually")}
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
            <br /> {ui("unitedStates")}
          </span>
        </button>
      )}
      {focused && !showSuggestion && query.trim() && (
        <p className="source-address-no-match" role="status">
          {ui("noCapturedSuggestionMatchesEnterYourAddressManually")}
        </p>
      )}
      {focused && (
        <p className="source-google-note">{ui("suggestionsPoweredByGoogle")}</p>
      )}
      {!focused && (
        <div className="source-address-lookup-actions">
          <button
            className="primary address-lookup-continue"
            onClick={onManual}
          >
            {ui("continueToPaymentDetails")}
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
  const caption = useCaption();
  const ui = useTranslations("commerceUI");
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
        <span>{caption(label)}</span>
        <input
          aria-label={caption(label)}
          value={String(value[key] ?? "")}
          placeholder={caption(label)}
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
            aria-label={ui("aboutDeliveryPhoneNumber")}
            aria-expanded={phoneHelp}
            onClick={() => setPhoneHelp((current) => !current)}
            data-ui-label="aboutDeliveryPhoneNumber"
          >
            <Icon name="question-circle" />
          </button>
          {phoneHelp && (
            <p className="source-security-help" role="status">
              {ui("aPhoneNumberIsOptionalForThisDeliveryAddress")}
            </p>
          )}
        </>
      )}
      {key === "street" &&
        suggestions &&
        /1226|university|menlo/i.test(value.street) && (
          <div className="source-inline-address-suggestion">
            <span>{ui("sUGGESTIONS")}</span>
            <button
              type="button"
              aria-label={ui("closeAddressSuggestions")}
              onClick={() => setSuggestions(false)}
              data-ui-label="closeAddressSuggestions"
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
              <strong>1226 University Dr,</strong>{" "}
              {ui("menloParkCA94025UnitedStates")}
            </button>
          </div>
        )}
    </div>
  );
  const country = (
    <label className="form-field source-country-field">
      {ui("countryRegion_1d79d2")}
      <select
        value={value.country}
        onChange={(event) => change("country", event.target.value)}
      >
        <option value="United States">{ui("unitedStates")}</option>
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
        <span>{ui("state")}</span>
        <select
          aria-label={ui("state")}
          value={value.region}
          onChange={(event) => change("region", event.target.value)}
          required
          data-ui-label="state"
        >
          <option value="">{ui("state")}</option>
          <option value="CA">{ui("california")}</option>
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
              {value.city}, {value.region}, {value.postalCode}
              {ui("uS")}
            </small>
          </span>
          <button type="button" onClick={onExpand}>
            {ui("edit")}
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
          {ui("thisIsMyDefaultAddress")}
        </label>
      )}
      <div className="editor-actions">
        {variant === "sheet" && (
          <button type="button" className="form-cancel" onClick={onCancel}>
            {ui("cancel")}
          </button>
        )}
        <button type="submit" className="primary form-submit">
          {variant === "initial"
            ? ui("continueToPaymentDetails")
            : ui("saveAddress")}
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
  const ui = useTranslations("commerceUI");
  return (
    <span className="source-apple-mark" aria-hidden="true">
      <svg viewBox="0 0 18 21">
        <path
          fill="currentColor"
          d="M12.3.6c.2 1.8-.6 3.7-2.8 4.3-.4-1.9.8-3.8 2.8-4.3ZM8.7 6c1.7 0 2.2-1.1 3.9-.9 1.6.1 2.5.8 3.1 1.7-3.1 1.9-2.6 5.6.5 7-.6 1.6-1.4 3.2-2.4 4.4-1.9 2.4-2.7.6-5 .6s-3.3 1.9-5.1-.8C1.3 14.4.2 9.7 3.1 6.6 4.7 4.9 6.6 5.2 8.7 6Z"
        />
      </svg>
      {ui("pay")}
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
  const ui = useTranslations("commerceUI");
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
              <strong>{ui("creditCard")}</strong>
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
              {ui("cardNumber")}
              <input
                aria-label={ui("cardNumber")}
                inputMode="numeric"
                autoComplete="off"
                disabled={method !== "card"}
                value={number}
                onChange={(event) =>
                  setNumber(event.target.value.replace(/[^0-9 ]/g, ""))
                }
                placeholder={ui("cardNumber")}
                data-ui-label="cardNumber"
              />
              <Icon name="lock" />
            </label>
            <div>
              <label className="form-field">
                {" "}
                {ui("expirationDateMMYY")}
                <input
                  aria-label={ui("expiration")}
                  disabled={method !== "card"}
                  value={expiry}
                  onChange={(event) => setExpiry(event.target.value)}
                  placeholder={ui("expirationDateMMYY")}
                  data-ui-label="expiration"
                />
              </label>{" "}
              <div className="form-field source-security-field">
                <span>{ui("securityCode")}</span>
                <input
                  aria-label={ui("securityCode")}
                  inputMode="numeric"
                  disabled={method !== "card"}
                  value={cvc}
                  onChange={(event) =>
                    setCvc(event.target.value.replace(/\D/g, ""))
                  }
                  placeholder={ui("securityCode")}
                  data-ui-label="securityCode"
                />
                <button
                  type="button"
                  className="source-card-help"
                  aria-label={ui("aboutSecurityCode")}
                  aria-expanded={securityHelp}
                  onClick={() => setSecurityHelp((current) => !current)}
                  data-ui-label="aboutSecurityCode"
                >
                  ?
                </button>
                {securityHelp && (
                  <p className="source-security-help" role="status">
                    {ui("the3Or4DigitSecurityCodePrintedOnYour")}
                  </p>
                )}
              </div>
            </div>
          </div>{" "}
          <div className="form-field source-card-name">
            <span>{ui("nameOnCard")}</span>
            <input
              ref={nameInput}
              aria-label={ui("nameOnCard")}
              placeholder={ui("nameOnCard")}
              value={name}
              disabled={method !== "card"}
              onChange={(event) => setName(event.target.value)}
              data-ui-label="nameOnCard"
            />
            {name && (
              <button
                type="button"
                aria-label={ui("clearNameOnCard")}
                disabled={method !== "card"}
                onClick={() => {
                  setName("");
                  nameInput.current?.focus();
                }}
                data-ui-label="clearNameOnCard"
              >
                <Icon name="close" />
              </button>
            )}
          </div>
          <label className="form-field">
            {ui("nicknameOptional")}{" "}
            <input
              placeholder={ui("nicknameOptional")}
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
            <span>{ui("billTo")}</span>
            {!billOpen && selectedBilling && (
              <span>
                <strong>
                  {selectedBilling.firstName} {selectedBilling.lastName}
                </strong>
                <br />
                {selectedBilling.street}
                <br />
                {selectedBilling.city} {selectedBilling.region}{" "}
                {selectedBilling.postalCode}
                {ui("uS")}
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
                      {entry.city} {entry.region} {entry.postalCode}
                      {ui("uS_eb65e8")}
                    </span>
                    {entry.phone && <span>{entry.phone}</span>}
                    {entry.isDefault && (
                      <small className="default-pill">{ui("default")}</small>
                    )}
                  </span>
                </label>
              ))}
              <button
                type="button"
                className="checkout-link"
                onClick={() => setBillingEditor(true)}
              >
                {ui("useADifferentAddress_602ad8")}
              </button>
            </div>
          )}
        </div>
        {boundary && (
          <div className="payment-preview-boundary" role="status">
            <strong>{ui("paymentServiceIsNotConnected_2881d2")}</strong>
            <p>{ui("noPaymentMethodWasAddedAndNoCardDataWas")}</p>
            {method === "card" && validCard && (
              <button
                type="button"
                className="primary form-submit"
                onClick={onPreviewSaved}
              >
                {ui("previewCapturedPostSaveState")}
              </button>
            )}
            {method === "card" && !validCard && (
              <p className="form-error">
                {ui("checkTheCardFieldsBeforePreviewingTheCapturedState")}
              </p>
            )}
            {method === "apple" && (
              <p className="form-error">
                {ui("applePayIsNotConnectedInThisReferencePreview")}
              </p>
            )}
          </div>
        )}
        <div className="editor-actions">
          <button type="button" className="form-cancel" onClick={onCancel}>
            {ui("cancel")}
          </button>
          <button className="primary form-submit" type="submit">
            {ui("save")}
          </button>
        </div>
      </form>
      <Sheet
        open={billingEditor}
        title={ui("billingAddress")}
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
  content,
  storeId,
  open,
  onClose,
}: {
  catalog: CartCatalog;
  content?: ReactNode;
  storeId: string;
  open: boolean;
  onClose: () => void;
}) {
  const intlLocale = useIntlLocale();
  const ui = useTranslations("commerceUI");
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
      title={ui("addValue1ToSave20WithYourExclusiveOffer", {
        value1: formatMoney(
          { amount: Math.max(0, 5000 - subtotal), currency: "USD" },
          intlLocale,
        ),
      })}
      onClose={onClose}
      className="cart-offer"
    >
      {content ?? (
        <>
          <div className="offer-progress">
            <span style={{ width: `${Math.min(100, subtotal / 50)}%` }} />
          </div>
          <div className="offer-products">
            {products.map((product) => (
              <article key={product.id}>
                <Link href={`/products/${product.id}`} onClick={onClose}>
                  <img src={product.images[0]} alt="" />
                  {product.compareAt && (
                    <span className="offer-discount">{ui("text47Off")}</span>
                  )}
                  <strong>{product.title}</strong>
                  <span>
                    {formatMoney(product.price, intlLocale)}{" "}
                    {product.compareAt && (
                      <del>{formatMoney(product.compareAt, intlLocale)}</del>
                    )}
                  </span>
                </Link>
                <button
                  className="offer-heart"
                  aria-label={ui("saveValue1", { value1: product.title ?? "" })}
                  aria-pressed={state.saved.includes(product.id)}
                  onClick={() => state.toggleSaved(product.id)}
                >
                  <Icon
                    name="heart"
                    filled={state.saved.includes(product.id)}
                  />
                </button>
              </article>
            ))}
          </div>
          <div className="offer-footer">
            <p>
              {ui("inYourCart")}{" "}
              <strong>{lines.reduce((n, line) => n + line.quantity, 0)}</strong>
              <span>
                {comparison !== undefined && comparison > subtotal && (
                  <del>
                    {formatMoney(
                      { amount: comparison, currency: "USD" },
                      intlLocale,
                    )}
                  </del>
                )}{" "}
                {formatMoney({ amount: subtotal, currency: "USD" }, intlLocale)}
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
              {ui("continueToCheckout")}
            </Link>
          </div>
        </>
      )}
    </Sheet>
  );
}
