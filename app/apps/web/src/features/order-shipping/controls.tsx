"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { validId } from "../selling/draft-model";
import { createQuoteAction } from "../payments/actions";
import { PaymentBoundary } from "../payments/controls";
import { useShippingRequest } from "./use-shipping-request";
import { shippingText } from "./messages";
import type {
  ShippingClientContext,
  ShippingClientAcceptance,
} from "./client-contract";
import type { Recipient, Language, ShippingCosts } from "./model";
import s from "../purchase-reviews/reviews.module.css";
import local from "./shipping.module.css";
function money(minor: number, language: Language) {
  return new Intl.NumberFormat(language, {
    style: "currency",
    currency: "EUR",
  }).format(minor / 100);
}
export function ShippingCostsSummary({
  costs,
  language,
}: {
  costs: ShippingCosts;
  language: Language;
}) {
  const t = shippingText(language);
  return (
    <dl className={s.totals}>
      <div>
        <dt>{t.items}</dt>
        <dd>{money(costs.merchandiseMinor, language)}</dd>
      </div>
      <div>
        <dt>{t.shipping}</dt>
        <dd>{money(costs.shippingMinor, language)}</dd>
      </div>
      <div>
        <dt>{t.buyerFee}</dt>
        <dd>{money(costs.buyerFeeMinor, language)}</dd>
      </div>
      <div>
        <dt>{t.tax}</dt>
        <dd>
          {costs.taxMinor === null
            ? t.includedUnknown
            : money(costs.taxMinor, language) +
              " · " +
              (costs.taxBasis === "exclusive_known" ? t.extra : t.included)}
        </dd>
      </div>
      <div>
        <dt>{t.total}</dt>
        <dd>
          <strong>{money(costs.totalMinor, language)}</strong>
        </dd>
      </div>
      <div>
        <dt>{t.sellerFee}</dt>
        <dd>{money(costs.applicationFeeMinor, language)}</dd>
      </div>
    </dl>
  );
}
function RequestState({
  request,
  language,
}: {
  request: ReturnType<typeof useShippingRequest>;
  language: Language;
}) {
  const t = shippingText(language);
  return (
    <div aria-live="polite">
      {request.pending && <p role="status">{t.pending}</p>}
      {request.status && <p role="status">{request.status}</p>}
      {request.original && (
        <div className={s.actions}>
          <button
            className={s.secondary}
            disabled={request.pending}
            onClick={() => request.recover()}
          >
            {t.recover}
          </button>
          <button
            className={s.secondary}
            disabled={request.pending}
            onClick={() => request.recover(true)}
          >
            {t.cancel}
          </button>
        </div>
      )}
    </div>
  );
}
export function ShippingSelection({
  context,
}: {
  context: ShippingClientContext;
}) {
  const t = shippingText(context.language),
    [selected, setSelected] = useState(context.options[0]?.rateId ?? ""),
    [recipient, setRecipient] = useState<Recipient>({}),
    [purposeHash, setPurposeHash] = useState<string | null>(null);
  const request = useShippingRequest({
    key:
      "treido-shipping-prepare:" +
      context.actorKey +
      ":" +
      JSON.stringify(context.source),
    actorKey: context.actorKey,
    actorSubject: context.actorSubject,
    language: context.language,
  });
  const option = context.options.find((item) => item.rateId === selected);
  if (!context.available || !context.sourceHash || !option)
    return (
      <PaymentBoundary
        actorSubject={context.actorSubject}
        language={context.language}
      >
        <p role="status">{t.unavailable}</p>
        <RequestState request={request} language={context.language} />
      </PaymentBoundary>
    );
  return (
    <PaymentBoundary
      actorSubject={context.actorSubject}
      language={context.language}
    >
      <form
        className={s.stack}
        onSubmit={(event) => {
          event.preventDefault();
          if (purposeHash !== option.optionHash) return;
          request.run({
            action: "prepare",
            source: context.source,
            language: context.language,
            sourceHash: context.sourceHash,
            policyId: option.policyId,
            rateId: option.rateId,
            optionHash: option.optionHash,
            country: option.country,
            recipient: Object.fromEntries(
              option.fields
                .filter((field) => recipient[field])
                .map((field) => [field, recipient[field]]),
            ),
            acknowledgedPurpose: true,
          });
        }}
      >
        <fieldset className={s.stack} disabled={request.disabled}>
          <legend>{t.recipient}</legend>
          <label className={s.field}>
            {t.carrier}
            <select
              className={local.input}
              value={selected}
              onChange={(event) => {
                setSelected(event.target.value);
                setPurposeHash(null);
              }}
            >
              {context.options.map((item) => (
                <option key={item.rateId} value={item.rateId}>
                  {item.carrier} · {item.country} ·{" "}
                  {money(item.costs.shippingMinor, context.language)}
                </option>
              ))}
            </select>
          </label>
          {option.fields.map((field) => (
            <label className={s.field} key={field}>
              {t.fields[field]}
              {field === "officeCode" &&
              option.method === "collection_office" ? (
                <select
                  className={local.input}
                  required
                  value={recipient.officeCode ?? ""}
                  onChange={(event) =>
                    setRecipient({
                      ...recipient,
                      officeCode: event.target.value,
                    })
                  }
                >
                  <option value="">{t.fields.officeCode}</option>
                  {option.officeCodes?.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className={local.input}
                  required={option.requiredFields.includes(field)}
                  type={field === "phone" ? "tel" : "text"}
                  autoComplete="off"
                  maxLength={
                    field === "address" ? 300 : field === "phone" ? 40 : 100
                  }
                  value={recipient[field] ?? ""}
                  onChange={(event) =>
                    setRecipient({ ...recipient, [field]: event.target.value })
                  }
                />
              )}
            </label>
          ))}
          <p>{option.recipientPurpose}</p>
          <p className={s.muted}>{option.retentionDescription}</p>
          <ShippingCostsSummary
            costs={option.costs}
            language={context.language}
          />
          <p>{option.taxDescription}</p>
          <label className={local.check}>
            <input
              type="checkbox"
              checked={purposeHash === option.optionHash}
              onChange={(event) =>
                setPurposeHash(event.target.checked ? option.optionHash : null)
              }
            />
            {t.purpose}
          </label>
          <button
            className={s.primary}
            disabled={purposeHash !== option.optionHash}
            type="submit"
          >
            {t.prepare}
          </button>
        </fieldset>
      </form>
      <RequestState request={request} language={context.language} />
    </PaymentBoundary>
  );
}
export function ShippingAcceptance({
  context,
}: {
  context: ShippingClientAcceptance;
}) {
  const t = shippingText(context.language),
    [acceptedHash, setAcceptedHash] = useState<string | null>(null);
  const request = useShippingRequest({
    key: "treido-shipping-accept:" + context.actorKey + ":" + context.id,
    actorKey: context.actorKey,
    actorSubject: context.actorSubject,
    language: context.language,
  });
  if (context.state !== "reviewed" || !context.canAccept)
    return (
      <PaymentBoundary
        actorSubject={context.actorSubject}
        language={context.language}
      >
        <p role="status">
          {context.state !== "reviewed"
            ? t.accepted
            : context.expired
              ? t.expired
              : t.unavailable}
        </p>
        <RequestState request={request} language={context.language} />
      </PaymentBoundary>
    );
  return (
    <PaymentBoundary
      actorSubject={context.actorSubject}
      language={context.language}
    >
      <div className={s.stack}>
        <label className={local.check}>
          <input
            type="checkbox"
            disabled={request.disabled}
            checked={acceptedHash === context.snapshotHash}
            onChange={(event) =>
              setAcceptedHash(
                event.target.checked ? context.snapshotHash : null,
              )
            }
          />
          {t.agree}
        </label>
        <button
          className={s.primary}
          disabled={request.disabled || acceptedHash !== context.snapshotHash}
          onClick={() =>
            request.run({
              action: "accept",
              choice: {
                id: context.id,
                revision: context.revision,
                snapshotHash: context.snapshotHash,
                acknowledged: true,
              },
            })
          }
        >
          {t.accept}
        </button>
        <RequestState request={request} language={context.language} />
      </div>
    </PaymentBoundary>
  );
}
/** Existing T64 action remains the only quote creator. Readiness is a real
 * canonical registration gate; until its quote/refund integration exists, closed. */
export function ShippingPayableQuoteControl({
  context,
}: {
  context: ShippingClientAcceptance;
}) {
  const clerk = useClerk(),
    router = useRouter(),
    busy = useRef(false),
    original = useRef<string | null>(null),
    originalScope = useRef<string | null>(null),
    activeScope = useRef<string | null>(null),
    live = useRef(false),
    [pending, start] = useTransition(),
    [status, setStatus] = useState<string | null>(null),
    t = shippingText(context.language);
  const key =
    "treido-shipping-quote:" +
    context.actorKey +
    ":" +
    context.id +
    ":" +
    context.snapshotHash;
  useEffect(() => {
    live.current = true;
    activeScope.current = key;
    return () => {
      live.current = false;
      activeScope.current = null;
    };
  }, [key]);
  if (context.state !== "accepted" || !context.bridgeReady)
    return <p role="status">{t.paymentUnavailable}</p>;
  return (
    <PaymentBoundary
      actorSubject={context.actorSubject}
      language={context.language}
    >
      <button
        className={s.primary}
        disabled={pending}
        onClick={() => {
          if (busy.current || clerk.user?.id !== context.actorSubject) return;
          busy.current = true;
          if (originalScope.current !== key) {
            originalScope.current = key;
            original.current = null;
          }
          try {
            const saved = sessionStorage.getItem(key);
            if (saved && validId(saved)) original.current = saved;
          } catch {}
          original.current ??= crypto.randomUUID();
          try {
            sessionStorage.setItem(key, original.current);
          } catch {}
          const command = {
            actorKey: context.actorKey,
            requestId: original.current,
            source: context.source,
            language: context.language,
            policyId: context.basePolicyId,
            handover: "shipping",
            shipping: {
              id: context.id,
              revision: context.revision,
              snapshotHash: context.snapshotHash,
              acknowledged: true,
            },
            aftercare: context.aftercare,
          };
          start(async () => {
            try {
              const result = await createQuoteAction(command);
              if (
                !live.current ||
                activeScope.current !== key ||
                clerk.user?.id !== context.actorSubject
              )
                return;
              if (result.ok) {
                try {
                  sessionStorage.removeItem(key);
                } catch {}
                router.push(
                  `/checkout/payments/${result.data.id}?lang=${context.language}`,
                );
              } else setStatus(t.unknown);
            } catch {
              if (
                live.current &&
                activeScope.current === key &&
                clerk.user?.id === context.actorSubject
              )
                setStatus(t.unknown);
            } finally {
              busy.current = false;
            }
          });
        }}
      >
        {t.payment}
      </button>
      {status && <p role="status">{status}</p>}
    </PaymentBoundary>
  );
}
