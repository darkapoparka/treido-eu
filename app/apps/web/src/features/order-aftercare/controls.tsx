"use client";
import { useState } from "react";
import { useReverification } from "@clerk/nextjs";
import type { AftercareView, CaseView, RefundIntentView } from "./view";
import { CASE_REASONS, type CaseReason } from "./model";
import { aftercareAction, recoverAftercareAction } from "./actions";
import { useDurableRequest } from "./use-durable-request";
import { aftercareText } from "./messages";
import s from "../purchase-reviews/reviews.module.css";
function useCommand(view: AftercareView, kind: string) {
  const action = useReverification(aftercareAction);
  return useDurableRequest({
    key:
      "treido-aftercare:" +
      view.actorKey +
      ":" +
      view.orderId +
      ":" +
      (view.sellerId ?? "buyer") +
      ":" +
      kind,
    actorSubject: view.actorSubject,
    language: view.language,
    scope: {
      actorKey: view.actorKey,
      orderId: view.orderId,
      sellerId: view.sellerId,
      language: view.language,
    },
    recovery: {
      actorKey: view.actorKey,
      orderId: view.orderId,
      sellerId: view.sellerId,
    },
    action,
    recover: recoverAftercareAction,
  });
}
function RequestStatus({
  command,
  language,
}: {
  command: ReturnType<typeof useCommand>;
  language: "bg" | "en";
}) {
  return (
    <>
      {command.status && <p role="status">{command.status}</p>}
      {command.original && (
        <button
          type="button"
          className={s.secondary}
          disabled={command.pending}
          onClick={command.recover}
        >
          {aftercareText(language).recover}
        </button>
      )}
    </>
  );
}
export function CaseComposer({
  view,
  item,
}: {
  view: AftercareView;
  item?: CaseView;
}) {
  const t = aftercareText(view.language),
    command = useCommand(view, item?.id ?? "new"),
    [body, setBody] = useState(""),
    [evidence, setEvidence] = useState(""),
    [reason, setReason] = useState<CaseReason>("handover"),
    [action, setAction] = useState("message"),
    [acceptedHash, setAcceptedHash] = useState<string | null>(null);
  const choices = item
    ? [
        "message",
        ...(view.side === "merchant" && item.state !== "resolved"
          ? ["propose"]
          : []),
        ...(view.side === "buyer" && item.state === "awaiting_buyer"
          ? ["accept"]
          : []),
        ...(view.side === "buyer" && item.state === "resolved"
          ? ["reopen"]
          : []),
        ...(item.state !== "resolved" ? ["escalate"] : []),
        ...(item.state === "reviewed" ? ["appeal"] : []),
      ]
    : [];
  if (!view.canReply || (!item && view.side !== "buyer")) return null;
  return (
    <form
      className={s.stack}
      onSubmit={(event) => {
        event.preventDefault();
        if (!item && acceptedHash !== view.policy?.termsHash) return;
        command.run(
          item
            ? { action, caseId: item.id, expectedRevision: item.revision, body }
            : {
                action: "open",
                servicePolicyId: view.policy?.id,
                servicePolicyVersion: view.policy?.version,
                serviceTermsHash: view.policy?.termsHash,
                acknowledged: true,
                reason,
                body,
                evidence: evidence
                  .split(/\r?\n/)
                  .map((line) => line.trim())
                  .filter(Boolean),
                expectedRevision: view.orderRevision,
              },
        );
      }}
    >
      <fieldset className={s.stack} disabled={command.disabled}>
        {!item && (
          <label>
            <input
              type="checkbox"
              checked={acceptedHash === view.policy?.termsHash}
              onChange={(event) =>
                setAcceptedHash(
                  event.target.checked
                    ? (view.policy?.termsHash ?? null)
                    : null,
                )
              }
            />
            {t.agree}
          </label>
        )}
        {item ? (
          <label className={s.field}>
            {t.support}
            <select
              value={action}
              onChange={(event) => setAction(event.target.value)}
            >
              {choices.map((choice) => (
                <option key={choice} value={choice}>
                  {choice === "message"
                    ? t.message
                    : choice === "propose"
                      ? t.propose
                      : choice === "accept"
                        ? t.accept
                        : choice === "reopen"
                          ? t.reopen
                          : choice === "escalate"
                            ? t.escalate
                            : t.appeal}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className={s.field}>
            {t.reason}
            <select
              value={reason}
              onChange={(event) => {
                const value = CASE_REASONS.find(
                  (item) => item === event.target.value,
                );
                if (value) setReason(value);
              }}
            >
              {CASE_REASONS.map((reason) => (
                <option value={reason} key={reason}>
                  {t[reason]}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={s.field}>
          {t.body}
          <textarea
            maxLength={2000}
            required={action !== "accept" || !item}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </label>
        {!item && (
          <label className={s.field}>
            {t.evidence}
            <textarea
              maxLength={4800}
              value={evidence}
              onChange={(event) => setEvidence(event.target.value)}
            />
          </label>
        )}
        <button
          className={s.primary}
          type="submit"
          disabled={!item && acceptedHash !== view.policy?.termsHash}
        >
          {item ? t.message : t.open}
        </button>
      </fieldset>
      <RequestStatus command={command} language={view.language} />
    </form>
  );
}
export function RefundComposer({ view }: { view: AftercareView }) {
  const t = aftercareText(view.language),
    command = useCommand(view, "prepare-refund"),
    [reason, setReason] = useState(""),
    [selection, setSelection] = useState("remaining"),
    [refundShipping, setRefundShipping] = useState(false),
    [quantities, setQuantities] = useState<Record<string, string>>({});
  if (!view.canPrepareRefund) return null;
  return (
    <form
      className={s.stack}
      onSubmit={(event) => {
        event.preventDefault();
        command.run({
          action: "prepare_refund",
          expectedRevision: view.orderRevision,
          caseId: null,
          reason,
          selection,
          ...(view.shippingRefund ? { shipping: refundShipping } : {}),
          lines:
            selection === "remaining"
              ? []
              : view.lines
                  .filter((line) => Number(quantities[line.skuId]) > 0)
                  .map((line) => ({
                    skuId: line.skuId,
                    quantity: Number(quantities[line.skuId]),
                  })),
        });
      }}
    >
      <fieldset className={s.stack} disabled={command.disabled}>
        <legend>{t.prepare}</legend>
        <p>{t.originalTerms}</p>
        <p>{view.partialContract?.terms}</p>
        <label className={s.field}>
          {t.refundReason}
          <textarea
            required
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <label className={s.field}>
          {t.quantity}
          <select
            value={selection}
            onChange={(event) => setSelection(event.target.value)}
          >
            <option value="remaining">{t.remaining}</option>
            <option value="lines">{t.selectLines}</option>
          </select>
        </label>
        {view.shippingRefund && (
          <>
            <p>{view.shippingRefund.terms}</p>
            <label className={s.field}>
              <input
                type="checkbox"
                checked={refundShipping}
                disabled={!view.shippingRefund.eligible}
                onChange={(event) => setRefundShipping(event.target.checked)}
              />
              {view.language === "bg"
                ? "Възстанови допустимата доставка"
                : "Refund eligible shipping"}{" "}
              (
              {new Intl.NumberFormat(view.language, {
                style: "currency",
                currency: "EUR",
              }).format(view.shippingRefund.remainingMinor / 100)}
              )
            </label>
          </>
        )}
        {selection === "lines" &&
          view.lines.map((line) => (
            <label className={s.field} key={line.skuId}>
              {line.title} — {t.quantity} ({line.remainingQuantity})
              <input
                type="number"
                min={0}
                max={line.remainingQuantity}
                step={1}
                value={quantities[line.skuId] ?? "0"}
                onChange={(event) =>
                  setQuantities({
                    ...quantities,
                    [line.skuId]: event.target.value,
                  })
                }
              />
            </label>
          ))}
        <button className={s.primary} type="submit">
          {t.prepare}
        </button>
      </fieldset>
      <RequestStatus command={command} language={view.language} />
    </form>
  );
}
export function ExecuteRefundButton({
  view,
  item,
}: {
  view: AftercareView;
  item: RefundIntentView;
}) {
  const command = useCommand(view, "execute:" + item.id);
  if (!view.canRefund || !item.ownedByCurrentActor || item.state !== "prepared")
    return null;
  return (
    <>
      <button
        className={s.primary}
        disabled={command.disabled}
        onClick={() =>
          command.run({
            action: "execute_refund",
            expectedRevision: item.revision,
            intentId: item.id,
          })
        }
      >
        {aftercareText(view.language).execute}
      </button>
      <RequestStatus command={command} language={view.language} />
    </>
  );
}
export function ShippingControls({ view }: { view: AftercareView }) {
  const command = useCommand(view, "shipping"),
    t = aftercareText(view.language),
    [reference, setReference] = useState(""),
    [description, setDescription] = useState("");
  if (!view.shippingContractAvailable)
    return <p className={s.muted}>{t.noShipping}</p>;
  const canConfirm =
    view.side === "buyer" &&
    view.fulfilment.state === "seller_reported_dispatched";
  if (!view.canTrack && !canConfirm) return null;
  return (
    <form
      className={s.stack}
      onSubmit={(event) => {
        event.preventDefault();
        command.run({
          action: view.canTrack ? "record_tracking" : "confirm_delivery",
          expectedRevision: view.fulfilment.revision,
          description,
          ...(view.canTrack
            ? {
                carrier: view.acceptedCarrier?.code,
                trackingReference: reference,
              }
            : {}),
        });
      }}
    >
      <fieldset className={s.stack} disabled={command.disabled}>
        <legend>{t.tracking}</legend>
        <p>{t.manual}</p>
        {view.shippingRecipient?.available && (
          <>
            <p>{view.shippingRecipient.purpose}</p>
            <p className={s.muted}>{view.shippingRecipient.retention}</p>
            <dl>
              {Object.entries(view.shippingRecipient.recipient).map(
                ([field, value]) => (
                  <div key={field}>
                    <dt>
                      {
                        (
                          {
                            name:
                              view.language === "bg"
                                ? "Получател"
                                : "Recipient",
                            phone: view.language === "bg" ? "Телефон" : "Phone",
                            address:
                              view.language === "bg" ? "Адрес" : "Address",
                            city: view.language === "bg" ? "Град" : "City",
                            postalCode:
                              view.language === "bg"
                                ? "Пощенски код"
                                : "Postal code",
                            officeCode:
                              view.language === "bg" ? "Офис" : "Office",
                          } as Record<string, string>
                        )[field]
                      }
                    </dt>
                    <dd>{value}</dd>
                  </div>
                ),
              )}
            </dl>
          </>
        )}
        {view.canTrack && (
          <>
            <label className={s.field}>
              {t.carrier}
              <input
                required
                maxLength={80}
                value={view.acceptedCarrier?.label ?? ""}
                readOnly
              />
            </label>
            <label className={s.field}>
              {t.reference}
              <input
                required
                maxLength={100}
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
            </label>
          </>
        )}
        <label className={s.field}>
          {t.body}
          <textarea
            required
            maxLength={500}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <button type="submit" className={s.primary}>
          {view.canTrack ? t.dispatch : t.received}
        </button>
      </fieldset>
      <RequestStatus command={command} language={view.language} />
    </form>
  );
}
