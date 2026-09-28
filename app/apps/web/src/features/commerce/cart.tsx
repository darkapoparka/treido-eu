"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useLayoutEffect, useState, type ReactNode } from "react";
import { SourceLink } from "../discovery/return-navigation";
import { useAccount } from "../account/state";
import { Icon } from "../discovery/icons";
import { useDiscovery } from "../discovery/state";
import {
  formatMoney,
  referenceVariantProduct,
  variantSelectionLimit,
  type Catalog,
} from "../catalog/types";
import { capturedLineAmount } from "./pricing";
function cartMutationFocus(control: HTMLElement, ...selectors: string[]) {
  const owner = control.closest<HTMLElement>("dialog, main");
  return owner ? { owner, selectors } : null;
}
export function CartContents({
  catalog,
  onNavigate,
  onOffer,
}: {
  catalog: Catalog;
  onNavigate?: (href: string) => void;
  onOffer?: (id: string) => void;
}) {
  const state = useDiscovery();
  const { hasPaymentProfile } = useAccount();
  const [pendingFocus, setPendingFocus] = useState<{
    owner: HTMLElement;
    selectors: string[];
  } | null>(null);
  function prepareMutationFocus(control: HTMLElement, ...selectors: string[]) {
    setPendingFocus(cartMutationFocus(control, ...selectors));
  }
  useLayoutEffect(() => {
    const pending = pendingFocus;
    if (
      !pending?.owner.isConnected ||
      (pending.owner instanceof HTMLDialogElement && !pending.owner.open)
    )
      return;
    for (const selector of [
      ...pending.selectors,
      ".cart-controls button:not(:disabled)",
      ".notification-empty h2",
      ".cart-close",
    ]) {
      const target = pending.owner.querySelector<HTMLElement>(selector);
      if (target) {
        target.focus();
        break;
      }
    }
  }, [pendingFocus]);
  const resolve = (list: typeof state.cart) =>
    list.flatMap((l) => {
      const product = catalog.products.find((p) => p.id === l.productId),
        variant = product?.variants.find((v) => v.id === l.variantId);
      return product && variant
        ? [
            {
              ...l,
              product: referenceVariantProduct(product, variant),
              variant,
              store: catalog.stores.find(
                (store) => store.id === product.storeId,
              ),
            },
          ]
        : [];
    });
  const resolved = resolve(state.cart),
    later = resolve(state.later);
  // Missing seller identities are not evidence that unrelated items share a
  // merchant. Keep each unidentified product in its own local cart group.
  const groupKey = (product: Catalog["products"][number]) =>
    product.storeId || `uncaptured:${product.id}`;
  const stores = [...new Set(resolved.map((l) => groupKey(l.product)))];
  return (
    <>
      {!resolved.length ? (
        <div className="notification-empty">
          <h2 tabIndex={-1}>Your cart is empty</h2>
          <p>
            Add products while you shop, so
            <br />
            they’ll be ready for checkout later.
          </p>
          {!onNavigate && (
            <Link className="primary form-submit" href="/search">
              Go shopping
            </Link>
          )}
        </div>
      ) : (
        stores.map((storeId) => {
          const lines = resolved.filter((l) => groupKey(l.product) === storeId),
            store = catalog.stores.find((s) => s.id === storeId),
            total = lines.reduce(
              (n, l) =>
                n + l.quantity * capturedLineAmount(l, l.product.price.amount),
              0,
            );
          return (
            <section className="seller-cart" key={storeId}>
              <header>
                {store?.logo && <img src={store.logo} alt="" />}
                <div>
                  <strong>
                    {store?.name ?? "Shop information not captured"}
                  </strong>
                  {store?.rating !== undefined && (
                    <p>
                      {store.rating} ★ (
                      {storeId === "kitsch" &&
                      lines.some((line) => line.productId === "shampoo-bag")
                        ? "195.2K"
                        : store.ratingCount}
                      )
                    </p>
                  )}
                </div>
              </header>
              {storeId === "kitsch" &&
                lines.some((l) => l.productId === "shampoo-bag") && (
                  <p className="cart-captured-error" role="status">
                    <Icon name="alert" />
                    <span>
                      The spring20orderdiscountold discount code is not honoured
                    </span>
                  </p>
                )}
              {lines.map((l) => (
                <article
                  className="commerce-line"
                  key={`${l.productId}-${l.variantId}`}
                  data-cart-line={`${l.productId}|${l.variantId}`}
                >
                  {l.product.images[0] && (
                    <img src={l.product.images[0]} alt="" />
                  )}
                  <div>
                    <div className="cart-line-title">
                      <CartNavigationLink
                        href={`/products/${l.productId}`}
                        onNavigate={onNavigate}
                      >
                        <strong>{l.product.title}</strong>
                      </CartNavigationLink>
                      <span>
                        {formatMoney({
                          ...l.product.price,
                          amount: l.product.price.amount * l.quantity,
                        })}
                      </span>
                    </div>
                    {l.product.variants.length > 1 && (
                      <p className="cart-variant">{l.variant.label}</p>
                    )}
                    {capturedLineAmount(l, l.product.price.amount) !==
                      l.product.price.amount && (
                      <p className="cart-discount">
                        Discount applied{" "}
                        <span>
                          {formatMoney({
                            amount: -135 * l.quantity,
                            currency: "USD",
                          })}
                        </span>
                      </p>
                    )}
                    <div className="cart-controls">
                      <div className="cart-stepper">
                        <button
                          aria-label={
                            l.quantity === 1
                              ? `Remove ${l.product.title}`
                              : `Decrease ${l.product.title}`
                          }
                          onClick={(event) => {
                            if (l.quantity === 1) {
                              prepareMutationFocus(event.currentTarget);
                              state.remove(l.productId, l.variantId);
                            } else
                              state.setQuantity(
                                l.productId,
                                l.variantId,
                                l.quantity - 1,
                              );
                          }}
                        >
                          <Icon name={l.quantity === 1 ? "trash" : "minus"} />
                        </button>
                        <output>{l.quantity}</output>
                        <button
                          aria-label={`Increase ${l.product.title}`}
                          disabled={
                            l.quantity >= variantSelectionLimit(l.variant)
                          }
                          onClick={() =>
                            state.setQuantity(
                              l.productId,
                              l.variantId,
                              l.quantity + 1,
                            )
                          }
                        >
                          <Icon name="plus" />
                        </button>
                      </div>
                      <button
                        onClick={(event) => {
                          prepareMutationFocus(
                            event.currentTarget,
                            `.cart-later [data-cart-line="${CSS.escape(`${l.productId}|${l.variantId}`)}"] .move-to-cart:not(:disabled)`,
                            `.cart-later [data-cart-line="${CSS.escape(`${l.productId}|${l.variantId}`)}"] .cart-controls button:not(:disabled)`,
                          );
                          state.saveForLater(l.productId, l.variantId);
                        }}
                      >
                        Save for later
                      </button>
                    </div>
                  </div>
                </article>
              ))}
              {onOffer && storeId === "kitsch" && (
                <button
                  className="cart-offer-link"
                  onClick={() => onOffer(storeId)}
                >
                  <span>
                    Add{" "}
                    {formatMoney({
                      amount: Math.max(0, 5000 - total),
                      currency: "USD",
                    })}{" "}
                    to save $20 with your exclusive offer
                  </span>
                  <strong>Add items</strong>
                  <progress value={total} max={5000} aria-hidden="true" />
                </button>
              )}
              <div className="cart-subtotal">
                <span>Subtotal</span>
                <strong>
                  {formatMoney({
                    amount: total,
                    currency: lines[0].product.price.currency,
                  })}
                </strong>
              </div>
              {store ? (
                <CartNavigationLink
                  onNavigate={onNavigate}
                  className="primary form-submit"
                  href={`/checkout?store=${encodeURIComponent(storeId)}${hasPaymentProfile ? "" : "&stage=phone"}`}
                >
                  Continue to checkout
                </CartNavigationLink>
              ) : (
                <p className="form-note">
                  Checkout details were not captured for this item. Nothing will
                  be charged.
                </p>
              )}
            </section>
          );
        })
      )}
      {later.length > 0 && (
        <section className="cart-later">
          <h2>Saved for later</h2>
          {later.map((l) => (
            <article
              className="commerce-line"
              key={`${l.productId}-${l.variantId}`}
              data-cart-line={`${l.productId}|${l.variantId}`}
            >
              {l.product.images[0] && (
                <span className="cart-later-media">
                  <img src={l.product.images[0]} alt="" />
                  {l.store?.logo && (
                    <img
                      className="cart-later-store-logo"
                      src={l.store.logo}
                      alt=""
                    />
                  )}
                </span>
              )}
              <div>
                <div className="cart-line-title">
                  <strong>{l.product.title}</strong>
                  <span>
                    {formatMoney({
                      ...l.product.price,
                      amount: l.product.price.amount * l.quantity,
                    })}
                  </span>
                </div>
                {l.product.variants.length > 1 && (
                  <p className="cart-variant">{l.variant.label}</p>
                )}
                <div className="cart-controls">
                  <button
                    aria-label={`Remove saved ${l.product.title}`}
                    onClick={(event) => {
                      prepareMutationFocus(event.currentTarget);
                      state.removeLater(l.productId, l.variantId);
                    }}
                  >
                    <Icon name="trash" />
                  </button>
                  <button
                    aria-label={`Save ${l.product.title}`}
                    aria-pressed={state.saved.includes(l.productId)}
                    onClick={() => state.toggleSaved(l.productId)}
                  >
                    <Icon
                      name="heart"
                      filled={state.saved.includes(l.productId)}
                    />
                  </button>
                  <button
                    className="move-to-cart"
                    disabled={variantSelectionLimit(l.variant) <= 0}
                    title={
                      variantSelectionLimit(l.variant) <= 0
                        ? "Currently unavailable"
                        : undefined
                    }
                    onClick={(event) => {
                      prepareMutationFocus(
                        event.currentTarget,
                        `.seller-cart [data-cart-line="${CSS.escape(`${l.productId}|${l.variantId}`)}"] .cart-controls > button`,
                      );
                      state.moveToCart(
                        l.productId,
                        l.variantId,
                        variantSelectionLimit(l.variant),
                      );
                    }}
                  >
                    <span>Move to cart</span>
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </>
  );
}

function CartNavigationLink({
  href,
  className,
  onNavigate,
  children,
}: {
  href: string;
  className?: string;
  onNavigate?: (href: string) => void;
  children: ReactNode;
}) {
  if (!onNavigate)
    return (
      <SourceLink href={href} className={className}>
        {children}
      </SourceLink>
    );
  return (
    <Link
      href={href}
      className={className}
      onClick={(event) => {
        // Sheet owns ordinary internal navigation in capture. Modified clicks
        // keep the current cart and source history intact.
        if (event.defaultPrevented) onNavigate(href);
      }}
    >
      {children}
    </Link>
  );
}
