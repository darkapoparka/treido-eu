"use client";
/* eslint-disable @next/next/no-img-element -- Eligibility-checked, owned listing derivatives. */
import Link from "next/link";
import {
  CreateReviewButton,
  BuyerReviewLinks,
} from "../purchase-reviews/controls";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ShopSurface } from "../discovery/hydration-boundary";
import { FloatingNav } from "../discovery/components";
import { SourceLink } from "../discovery/return-navigation";
import { formatMoney } from "../catalog/types";
import { variantCaption } from "../inventory/model";
import { CartMutationButton } from "./mutation-button";
import type { BuyerCart, CartLine } from "./model";
import { paymentText } from "../payments/messages";
import s from "./cart.module.css";
function CartRow({
  line,
  base,
}: {
  line: CartLine;
  base: Pick<BuyerCart, "actorKey" | "revision">;
}) {
  const t = useTranslations("buyerCart"),
    locale = useLocale(),
    [quantity, setQuantity] = useState(String(line.quantity)),
    item = line.item;
  const count = /^\d+$/.test(quantity) ? Number(quantity) : 0;
  return (
    <article className="commerce-line" data-cart-sku={line.skuId}>
      {item?.photo && <img src={item.photo} alt="" />}
      <div>
        {item ? (
          <>
            <div className="cart-line-title">
              <SourceLink
                href={"/products/" + item.listingId + "?lang=" + locale}
              >
                <strong>{item.title}</strong>
              </SourceLink>
              <span>
                {formatMoney(
                  { amount: item.priceMinor * line.quantity, currency: "EUR" },
                  locale,
                )}
              </span>
            </div>
            <p className="cart-variant">{variantCaption(item.options)}</p>
          </>
        ) : (
          <strong>{t("unavailableItem")}</strong>
        )}
        {line.state !== "ready" && (
          <p className={s.notice} role="status">
            {t(line.state === "unavailable" ? "unavailableItem" : line.state)}
          </p>
        )}
        <div className={"cart-controls " + s.controls}>
          {item && (
            <>
              <label className={s.quantity}>
                {t("quantity")}
                <input
                  type="number"
                  min={1}
                  max={
                    item.mode === "unique"
                      ? 1
                      : Math.min(99, Math.max(1, item.available))
                  }
                  step={1}
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </label>
              <CartMutationButton
                base={base}
                refreshPage
                operation={{
                  kind: "set",
                  listingId: item.listingId,
                  skuId: item.skuId,
                  publicationRevision: item.publicationRevision,
                  quantity: count,
                }}
                label={t(line.state === "changed" ? "confirmPrice" : "update")}
                disabled={
                  !Number.isSafeInteger(count) ||
                  count < 1 ||
                  count >
                    Math.min(item.available, item.mode === "unique" ? 1 : 99)
                }
              />
            </>
          )}
          <CartMutationButton
            base={base}
            refreshPage
            operation={{ kind: "remove", skuId: line.skuId }}
            label={t("remove")}
          />
        </div>
        {item && (
          <Link
            className="pill"
            href={"/messages/new?listing=" + item.listingId + "&lang=" + locale}
          >
            {t("contact")}
          </Link>
        )}
      </div>
    </article>
  );
}
export function BuyerCartPage({
  initial,
  status,
}: {
  initial: BuyerCart | null;
  status: "ready" | "guest" | "error";
}) {
  const t = useTranslations("buyerCart"),
    locale = useLocale(),
    router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [router]);
  const groups = initial
    ? [
        ...new Set(
          initial.lines.map((line) =>
            line.item ? line.item.sellerId + ":EUR" : "unavailable",
          ),
        ),
      ]
    : [];
  return (
    <ShopSurface className={"shop-page cart-page " + s.page} data-account-cart>
      <header className={s.header}>
        <h1>{t("title")}</h1>
        <Link href={"/search?lang=" + locale} className="pill">
          {t("browse")}
        </Link>
        <BuyerReviewLinks />
      </header>
      {status !== "ready" ? (
        <section className="empty-state">
          <h2>{t(status === "guest" ? "guest" : "unavailable")}</h2>
          {status === "guest" ? (
            <>
              <p>{t("guestNote")}</p>
              <Link
                className="primary"
                href={
                  "/sign-in?lang=" +
                  locale +
                  "&returnTo=" +
                  encodeURIComponent("/cart?lang=" + locale)
                }
              >
                {t("signIn")}
              </Link>
            </>
          ) : (
            <button className="primary" onClick={() => router.refresh()}>
              {t("retry")}
            </button>
          )}
        </section>
      ) : !initial?.lines.length ? (
        <section className="notification-empty">
          <h2>{t("empty")}</h2>
          <p>{t("emptyNote")}</p>
          <Link className="primary" href={"/search?lang=" + locale}>
            {t("browse")}
          </Link>
        </section>
      ) : (
        <>
          <p className={s.note}>{t("noReservation")}</p>
          {groups.map((group) => {
            const lines = initial.lines.filter(
                (line) =>
                  (line.item ? line.item.sellerId + ":EUR" : "unavailable") ===
                  group,
              ),
              first = lines[0].item;
            const total = lines.reduce(
              (sum, line) => sum + (line.item?.priceMinor ?? 0) * line.quantity,
              0,
            );
            return (
              <section className={"seller-cart " + s.group} key={group}>
                <header>
                  {first ? (
                    <SourceLink
                      href={"/stores/" + first.sellerId + "?lang=" + locale}
                    >
                      <strong>{first.sellerName}</strong>
                    </SourceLink>
                  ) : (
                    <strong>{t("unavailableGroup")}</strong>
                  )}
                </header>
                {lines.map((line) => (
                  <CartRow
                    key={line.skuId + ":" + initial.revision}
                    line={line}
                    base={{
                      actorKey: initial.actorKey,
                      revision: initial.revision,
                    }}
                  />
                ))}
                {first && (
                  <>
                    <div className="cart-subtotal">
                      <span>{t("subtotal")}</span>
                      <strong>
                        {formatMoney(
                          { amount: total, currency: "EUR" },
                          locale,
                        )}
                      </strong>
                    </div>
                    <p className={s.note}>
                      {t("currentPrice")} · {t("contactOnly")}
                    </p>
                    <CreateReviewButton
                      actorKey={initial.actorKey}
                      source={{
                        kind: "cart",
                        sellerId: first.sellerId,
                        cartRevision: initial.revision,
                      }}
                      disabled={lines.some((line) => line.state !== "ready")}
                    />
                    <Link
                      className="secondary"
                      href={"/checkout/payments?lang=" + locale}
                    >
                      {paymentText(locale === "bg" ? "bg" : "en").payments}
                    </Link>
                  </>
                )}
              </section>
            );
          })}
        </>
      )}
      <FloatingNav back marketplace />
    </ShopSurface>
  );
}
