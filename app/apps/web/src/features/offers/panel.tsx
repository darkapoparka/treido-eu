"use client";
import { CreateReviewButton } from "../purchase-reviews/controls";
import { useCallback, useState } from "react";
import Link from "next/link";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { ConversationDialog } from "../messaging/dialog";
import { useInboxRefresh } from "../messaging/use-inbox-refresh";
import type { InboxScope } from "../messaging/inbox-model";
import { parseEuroPrice } from "../selling/draft-model";
import { variantCaption } from "../inventory/model";
import { readOffersAction } from "./actions";
import { useOfferRequest } from "./use-offer-request";
import { OfferRecoveryControls } from "./recovery-controls";
import {
  OFFER_LIMITS,
  type OfferItem,
  type OfferMessage,
  type OfferOperation,
  type OfferView,
} from "./model";
import m from "../messaging/messaging.module.css";
import s from "./offers.module.css";
const messageKeys = {
  created: "created",
  countered: "countered",
  accepted: "eventAccepted",
  rejected: "eventRejected",
  withdrawn: "eventWithdrawn",
  cancelled: "eventCancelled",
  expired: "eventExpired",
  hold_expired: "eventHoldExpired",
} as const;
export function OfferMessageCard({ value }: { value: OfferMessage }) {
  const t = useTranslations("offers"),
    format = useFormatter();
  return (
    <div className={s.message}>
      <strong>{t(messageKeys[value.kind])}</strong>
      <p>
        {format.number((value.unitPriceMinor * value.quantity) / 100, {
          style: "currency",
          currency: value.currency,
        })}{" "}
        · {format.number(value.quantity)}
      </p>
    </div>
  );
}
type DialogState =
  | { kind: "propose"; parent: OfferItem | null; revision: number }
  | {
      kind: "accept" | "reject" | "withdraw" | "cancel";
      offer: OfferItem;
      revision: number;
    };
type OfferPanelProps = {
  threadId: string;
  scope: InboxScope;
  actorSubject: string;
  onChanged: () => void;
};
export function OfferPanel(props: OfferPanelProps) {
  return (
    <OfferPanelContent
      key={
        props.actorSubject +
        ":" +
        (props.scope.sellerId ?? "buyer") +
        ":" +
        props.threadId
      }
      {...props}
    />
  );
}
function OfferPanelContent({
  threadId,
  scope,
  actorSubject,
  onChanged,
}: OfferPanelProps) {
  const t = useTranslations("offers"),
    format = useFormatter(),
    language = useLocale() === "bg" ? "bg" : "en",
    sellerId = scope.sellerId;
  const [before, setBefore] = useState<number | null>(null);
  const load = useCallback(
    () => readOffersAction({ threadId, sellerId, before }),
    [threadId, sellerId, before],
  );
  const { data, status, refresh } = useInboxRefresh<OfferView | null>(
    null,
    actorSubject,
    load,
  );
  const [dialog, setDialog] = useState<DialogState | null>(null),
    [skuId, setSkuId] = useState(""),
    [quantity, setQuantity] = useState("1"),
    [amount, setAmount] = useState(""),
    [hours, setHours] = useState(24),
    [validationError, setValidationError] = useState<string | null>(null);
  const request = useOfferRequest({
    actorSubject,
    sellerId,
    threadId,
    data,
    status,
    onSettled: () => {
      setDialog(null);
      setBefore(null);
      setValidationError(null);
      void refresh(true);
      onChanged();
    },
  });
  const pending = request.pending,
    error = validationError ?? request.error,
    saved = request.notice === "applied" || request.notice === "recorded";
  const actionDenied = ["FORBIDDEN", "UNAUTHENTICATED", "NOT_FOUND"].includes(
    request.error ?? "",
  );
  function propose(parent: OfferItem | null = null) {
    if (!data || status !== "ready" || request.blocked) return;
    setValidationError(null);
    request.clearNotice();
    const sku = parent
      ? data.inventory?.skus.find((item) => item.id === parent.skuId)
      : data.inventory?.skus.length === 1
        ? data.inventory.skus[0]
        : undefined;
    setSkuId(parent?.skuId ?? sku?.id ?? "");
    setQuantity(String(parent?.quantity ?? 1));
    setAmount(parent ? (parent.unitPriceMinor / 100).toFixed(2) : "");
    setHours(24);
    setDialog({ kind: "propose", parent, revision: data.revision });
  }
  function decide(
    kind: "accept" | "reject" | "withdraw" | "cancel",
    offer: OfferItem,
  ) {
    if (!data || status !== "ready" || request.blocked) return;
    setValidationError(null);
    request.clearNotice();
    setDialog({ kind, offer, revision: data.revision });
  }
  function submit() {
    if (!data || !dialog || status !== "ready" || request.blocked) return;
    let operation: OfferOperation;
    if (dialog.kind === "propose") {
      const price = parseEuroPrice(amount),
        count = /^\d+$/.test(quantity) ? Number(quantity) : NaN;
      if (
        typeof price !== "number" ||
        price < 1 ||
        !Number.isSafeInteger(count) ||
        count < 1 ||
        count > 99 ||
        !skuId ||
        !data.inventory
      ) {
        setValidationError("INVALID_INPUT");
        return;
      }
      operation = {
        kind: "propose",
        parentId: dialog.parent?.id ?? null,
        skuId,
        publicationRevision:
          dialog.parent?.publicationRevision ??
          data.inventory.publicationRevision,
        quantity: count,
        unitPriceMinor: price,
        expiresHours: hours,
      };
    } else operation = { kind: dialog.kind, offerId: dialog.offer.id };
    setValidationError(null);
    request.submit(operation, dialog.revision);
  }
  if (status !== "ready" || !data || actionDenied)
    return (
      <section className={s.root} role="status">
        <p>
          {t(
            status === "denied" || actionDenied
              ? "denied"
              : status === "unavailable"
                ? "unavailable"
                : "checking",
          )}
        </p>
        {(status === "unavailable" || actionDenied) && (
          <button className={m.button} onClick={() => void refresh(true)}>
            {t("retry")}
          </button>
        )}
      </section>
    );
  const money = (minor: number) =>
    format.number(minor / 100, { style: "currency", currency: "EUR" });
  const time = (value: string) =>
    format.dateTime(new Date(value), {
      dateStyle: "medium",
      timeStyle: "short",
    });
  const pendingOffer = data.items.some(
    (item) => item.state === "pending" || item.holdState === "active",
  );
  const dialogTitle = dialog
    ? t(
        dialog.kind === "propose"
          ? dialog.parent
            ? "counter"
            : "make"
          : dialog.kind === "cancel"
            ? "cancelHold"
            : dialog.kind,
      )
    : "";
  return (
    <section className={s.root} data-offer-panel>
      <header className={s.header}>
        <h3>{t("title")}</h3>
        <div className={s.actions}>
          <button
            className={m.button}
            onClick={() => {
              setDialog(null);
              void refresh();
            }}
          >
            {t("retry")}
          </button>
          {data.canNegotiate && !before && !pendingOffer && (
            <button
              className={m.button + " " + m.primary}
              onClick={() => propose()}
              disabled={request.blocked}
            >
              {t("make")}
            </button>
          )}
        </div>
      </header>
      {!data.canNegotiate && (
        <p className={m.muted}>
          {t(
            data.inventory?.mode === "unknown"
              ? "needsInventory"
              : "notNegotiable",
          )}
        </p>
      )}
      {!data.items.length && <p className={m.muted}>{t("empty")}</p>}
      {saved && <p role="status">{t("saved")}</p>}
      {request.notice === "not_applied" && (
        <p role="status">{t("originalNotApplied")}</p>
      )}
      {!dialog && request.original && (
        <OfferRecoveryControls
          original={request.original}
          items={data.items}
          pending={pending}
          error={request.error}
          unrecorded={request.notice === "unrecorded"}
          onCheck={request.checkOriginal}
          onRetry={request.retryOriginal}
        />
      )}
      <ol className={s.list}>
        {data.items.map((item) => (
          <li key={item.id} className={s.card} data-offer-id={item.id}>
            <header>
              <strong>{money(item.unitPriceMinor * item.quantity)}</strong>
              <span>{t(item.state)}</span>
            </header>
            <p>
              {t(item.proposerSide === data.side ? "you" : item.proposerSide)} ·{" "}
              {format.number(item.quantity)} × {money(item.unitPriceMinor)}
            </p>
            <small>{t("expiresAt", { time: time(item.expiresAt) })}</small>
            {item.holdState && (
              <p className={s.notice}>
                {item.holdState === "active" && item.holdUntil
                  ? t("holdActive", { time: time(item.holdUntil) })
                  : t(
                      item.holdState === "expired"
                        ? "holdExpired"
                        : item.holdState === "released"
                          ? "holdReleased"
                          : item.holdState === "consumed"
                            ? "holdConsumed"
                            : "holdReconciliation",
                    )}
              </p>
            )}
            {item.timerHistory.map((event) => (
              <small key={event.kind}>
                {t(
                  event.kind === "expired"
                    ? "expiryRecorded"
                    : "holdExpiryRecorded",
                  { time: time(event.at) },
                )}
              </small>
            ))}
            {item.state === "accepted" && (
              <p className={m.muted}>{t("contactOnly")}</p>
            )}
            {data.side === "buyer" &&
              item.state === "accepted" &&
              item.holdState === "active" &&
              !request.original && (
                <CreateReviewButton
                  actorKey={data.actorKey}
                  source={{ kind: "offer", threadId, offerId: item.id }}
                />
              )}
            {data.side === "buyer" &&
              item.state === "accepted" &&
              !request.original && (
                <Link
                  className={m.button}
                  href={"/checkout/payments?lang=" + language}
                >
                  {t("purchaseOptions")}
                </Link>
              )}
            <div className={s.actions}>
              {item.state === "pending" &&
                (item.proposerSide === data.side
                  ? data.canCancel && (
                      <button
                        className={m.button}
                        onClick={() => decide("withdraw", item)}
                        disabled={request.blocked}
                      >
                        {t("withdraw")}
                      </button>
                    )
                  : data.canNegotiate && (
                      <>
                        <button
                          className={m.button + " " + m.primary}
                          onClick={() => decide("accept", item)}
                          disabled={request.blocked}
                        >
                          {t("accept")}
                        </button>
                        <button
                          className={m.button}
                          onClick={() => propose(item)}
                          disabled={request.blocked}
                        >
                          {t("counter")}
                        </button>
                        <button
                          className={m.button}
                          onClick={() => decide("reject", item)}
                          disabled={request.blocked}
                        >
                          {t("reject")}
                        </button>
                      </>
                    ))}
              {item.state === "accepted" &&
                item.holdState === "active" &&
                data.canCancel && (
                  <button
                    className={m.button}
                    onClick={() => decide("cancel", item)}
                    disabled={request.blocked}
                  >
                    {t("cancelHold")}
                  </button>
                )}
            </div>
          </li>
        ))}
      </ol>
      <div className={s.actions}>
        {before && (
          <button className={m.button} onClick={() => setBefore(null)}>
            {t("latest")}
          </button>
        )}
        {data.olderBefore && (
          <button
            className={m.button}
            onClick={() => setBefore(data.olderBefore)}
          >
            {t("older")}
          </button>
        )}
      </div>
      {dialog && (
        <ConversationDialog title={dialogTitle} onClose={() => setDialog(null)}>
          <form
            className={s.form}
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            {dialog.kind === "propose" ? (
              <>
                <label>
                  {t("variant")}
                  <select
                    aria-label={t("variant")}
                    required
                    value={skuId}
                    disabled={request.blocked || !!dialog.parent}
                    onChange={(event) => setSkuId(event.target.value)}
                  >
                    <option value="">{t("variant")}</option>
                    {data.inventory?.skus.map((sku) => (
                      <option key={sku.id} value={sku.id}>
                        {variantCaption(sku.options) || t("defaultVariant")}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("quantity")}
                  <input
                    required
                    type="number"
                    min={1}
                    max={data.inventory?.mode === "unique" ? 1 : 99}
                    value={quantity}
                    disabled={request.blocked || !!dialog.parent}
                    onChange={(event) => setQuantity(event.target.value)}
                  />
                </label>
                <label>
                  {t("amount")}
                  <input
                    required
                    inputMode="decimal"
                    maxLength={12}
                    value={amount}
                    disabled={request.blocked}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                </label>
                <label>
                  {t("expires")}
                  <select
                    aria-label={t("expires")}
                    disabled={request.blocked}
                    value={hours}
                    onChange={(event) => setHours(Number(event.target.value))}
                  >
                    {OFFER_LIMITS.hours.map((value) => (
                      <option key={value} value={value}>
                        {t("hours", { count: value })}
                      </option>
                    ))}
                  </select>
                </label>
                <p className={m.muted}>{t("contactOnly")}</p>
              </>
            ) : (
              <>
                <strong>
                  {money(dialog.offer.unitPriceMinor * dialog.offer.quantity)}
                </strong>
                {dialog.kind === "accept" && <p>{t("acceptNote")}</p>}
                {dialog.kind === "cancel" && <p>{t("cancelNote")}</p>}
              </>
            )}
            {error && (
              <p role="alert" className={m.error}>
                {t(
                  error === "CONFLICT"
                    ? "conflict"
                    : error === "INVALID_INPUT"
                      ? "invalid"
                      : error === "QUOTA_EXCEEDED"
                        ? "limit"
                        : [
                              "FORBIDDEN",
                              "UNAUTHENTICATED",
                              "NOT_FOUND",
                            ].includes(error)
                          ? "denied"
                          : "failed",
                )}
              </p>
            )}
            {request.original && (
              <OfferRecoveryControls
                original={request.original}
                items={data.items}
                pending={pending}
                error={request.error}
                unrecorded={request.notice === "unrecorded"}
                onCheck={request.checkOriginal}
                onRetry={request.retryOriginal}
              />
            )}
            <footer>
              <button
                type="button"
                className={m.button}
                onClick={() => setDialog(null)}
              >
                {t("cancel")}
              </button>
              <button
                className={m.button + " " + m.primary}
                disabled={request.blocked}
              >
                {t(pending ? "saving" : "confirm")}
              </button>
            </footer>
          </form>
        </ConversationDialog>
      )}
    </section>
  );
}
