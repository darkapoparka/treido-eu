"use client";
import Link from "next/link";
import {
  CreateReviewButton,
  BuyerReviewLinks,
} from "../purchase-reviews/controls";
import { useLocale, useTranslations } from "next-intl";
import { AccountPage } from "../account/forms";
import { Icon } from "../discovery/icons";
import { SourceLink } from "../discovery/return-navigation";
import { formatMoney } from "../catalog/types";
import { variantCaption } from "../inventory/model";
import { CartMutationButton } from "./mutation-button";
import type { BuyerCart, CartLine } from "./model";
import { paymentText } from "../payments/messages";
import { BuyerSessionBoundary } from "../library/session-boundary";
import { useBuyerCartController } from "./use-cart";
import s from "./cart.module.css";
import "../discovery/buyer-surface.css";
import {
  CartLinePresentation,
  CartStepper,
  CartSubtotal,
  CartSellerGroup,
  CartEmpty,
} from "../commerce/cart";
export function BuyerCartLine({
  line,
  base,
}: {
  line: CartLine;
  base: Pick<BuyerCart, "actorKey" | "revision"> & { subject: string };
}) {
  const t = useTranslations("buyerCart"),
    locale = useLocale(),
    ui = useTranslations("commerceUI"),
    discovery = useTranslations("discoveryUI"),
    item = line.item;
  return (
    <CartLinePresentation
      skuId={line.skuId}
      image={item?.photo}
      title={item?.title ?? t("unavailableItem")}
      href={
        item ? "/products/" + item.listingId + "?lang=" + locale : undefined
      }
      variant={item ? variantCaption(item.options) : undefined}
      price={
        item
          ? formatMoney(
              { amount: item.priceMinor * line.quantity, currency: "EUR" },
              locale,
            )
          : undefined
      }
    >
      {line.state !== "ready" && (
        <p className={s.notice} role="status">
          {t(line.state === "unavailable" ? "unavailableItem" : line.state)}
        </p>
      )}
      <div className={"cart-controls " + s.controls}>
        {item && (
          <>
            <CartStepper
              quantity={line.quantity}
              label={t("quantity")}
              decrease={
                <CartMutationButton
                  base={base}
                  refreshPage
                  wrapperClassName={s.stepperControl}
                  className=""
                  operation={
                    line.quantity === 1
                      ? { kind: "remove", skuId: line.skuId }
                      : {
                          kind: "set",
                          listingId: item.listingId,
                          skuId: item.skuId,
                          publicationRevision: item.publicationRevision,
                          quantity: line.quantity - 1,
                        }
                  }
                  label={
                    line.quantity === 1
                      ? t("remove")
                      : discovery("decreaseQuantity") + " " + item.title
                  }
                >
                  <Icon name={line.quantity === 1 ? "trash" : "minus"} />
                </CartMutationButton>
              }
              increase={
                <CartMutationButton
                  base={base}
                  refreshPage
                  wrapperClassName={s.stepperControl}
                  className=""
                  operation={{
                    kind: "set",
                    listingId: item.listingId,
                    skuId: item.skuId,
                    publicationRevision: item.publicationRevision,
                    quantity: line.quantity + 1,
                  }}
                  label={ui("increaseValue1", { value1: item.title })}
                  disabled={
                    line.quantity >=
                    Math.min(item.available, item.mode === "unique" ? 1 : 99)
                  }
                >
                  <Icon name="plus" />
                </CartMutationButton>
              }
            />
            {line.state === "changed" && (
              <CartMutationButton
                base={base}
                refreshPage
                operation={{
                  kind: "set",
                  listingId: item.listingId,
                  skuId: item.skuId,
                  publicationRevision: item.publicationRevision,
                  quantity: line.quantity,
                }}
                label={t(line.state === "changed" ? "confirmPrice" : "update")}
                disabled={
                  line.quantity >
                  Math.min(item.available, item.mode === "unique" ? 1 : 99)
                }
              />
            )}
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
    </CartLinePresentation>
  );
}
export function BuyerCartPage({
  initial,
  status,
  initialSubject = null,
}: {
  initial: BuyerCart | null;
  status: "ready" | "guest" | "error";
  initialSubject?: string | null;
}) {
  return (
    <BuyerSessionBoundary>
      <ScopedBuyerCartPage
        initial={initial}
        status={status}
        initialSubject={initialSubject}
      />
    </BuyerSessionBoundary>
  );
}
function ScopedBuyerCartPage({
  initial: serverInitial,
  initialSubject,
}: {
  initial: BuyerCart | null;
  status: "ready" | "guest" | "error";
  initialSubject: string | null;
}) {
  const t = useTranslations("buyerCart"),
    locale = useLocale(),
    controller = useBuyerCartController(serverInitial, initialSubject);
  const initial = controller.cart,
    status = controller.status;
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
    <AccountPage
      title={t("title")}
      publicData
      className={"cart-page " + s.page}
    >
      {status !== "ready" ? (
        <CartEmpty
          title={t(status === "guest" ? "guest" : "unavailable")}
          note={status === "guest" ? t("guestNote") : undefined}
          actions={
            status === "guest" ? (
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
            ) : (
              <button
                className="primary"
                onClick={() => void controller.refresh()}
              >
                {t("retry")}
              </button>
            )
          }
        />
      ) : !initial?.lines.length ? (
        <CartEmpty
          title={t("empty")}
          note={t("emptyNote")}
          actions={
            <Link className="primary" href={"/search?lang=" + locale}>
              {t("browse")}
            </Link>
          }
        />
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
              <CartSellerGroup
                className={s.group}
                key={group}
                seller={
                  first ? (
                    <SourceLink
                      href={"/stores/" + first.sellerId + "?lang=" + locale}
                    >
                      {first.sellerName}
                    </SourceLink>
                  ) : (
                    t("unavailableGroup")
                  )
                }
              >
                {lines.map((line) => (
                  <BuyerCartLine
                    key={line.skuId + ":" + initial.revision}
                    line={line}
                    base={{
                      actorKey: initial.actorKey,
                      revision: initial.revision,
                      subject: controller.subject!,
                    }}
                  />
                ))}
                {first && (
                  <>
                    <CartSubtotal
                      label={t("subtotal")}
                      total={formatMoney(
                        { amount: total, currency: "EUR" },
                        locale,
                      )}
                    />
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
              </CartSellerGroup>
            );
          })}
        </>
      )}
      <BuyerReviewLinks />
    </AccountPage>
  );
}
