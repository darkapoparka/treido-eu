"use client";
import { useState } from "react";
import Link from "next/link";
import {
  PRODUCTS,
  type CampaignView,
  type Language,
  type ProductId,
  type PromotionCommand,
  type PromotionView,
} from "./model";
import { promotionCopy } from "./copy";
import { usePromotions } from "./use-promotions";
import a from "../sellers/admin.module.css";
import s from "./promotions.module.css";
function money(value: number, language: Language) {
  return new Intl.NumberFormat(language === "bg" ? "bg-BG" : "en-GB", {
    style: "currency",
    currency: "EUR",
  }).format(value / 100);
}
function date(value: string, language: Language) {
  return new Intl.DateTimeFormat(language === "bg" ? "bg-BG" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function PromotionManager({
  initial,
  subject,
  language,
}: {
  initial: PromotionView;
  subject: string;
  language: Language;
}) {
  const h = usePromotions(initial, subject),
    c = promotionCopy(language),
    [listingId, setListing] = useState(initial.listings[0]?.id ?? ""),
    [productId, setProduct] = useState<ProductId>("bump_once_v1");
  const common = (item: CampaignView) => ({
    actorKey: h.view.actorKey,
    sellerId: h.view.sellerId,
    campaignId: item.id,
    expectedRevision: item.revision,
    requestId: crypto.randomUUID(),
  });
  const blocked = h.busy || !!h.pending || h.status !== "ready";
  const text =
    h.error === "UNKNOWN"
      ? c.ui.unknown
      : h.error === "ACCEPTED"
        ? c.ui.accepted
        : h.error === "CONFLICT"
          ? c.ui.conflict
          : h.error === "INVALID_INPUT"
            ? c.ui.invalid
            : h.error === "QUOTA_EXCEEDED"
              ? c.ui.limit
              : h.error
                ? c.ui.failed
                : null;
  return (
    <main lang={language}>
      <header className={a.pageBar}>
        <h1>{c.ui.title}</h1>
        <button
          type="button"
          className={a.secondary}
          onClick={() => void h.refresh()}
          disabled={h.busy}
        >
          {c.ui.refresh}
        </button>
      </header>
      <div className={`${a.pageBody} ${s.root}`}>
        {h.status !== "ready" ? (
          <section className={s.notice} role="status">
            <p>
              {h.status === "checking"
                ? c.ui.checking
                : h.status === "denied"
                  ? c.ui.denied
                  : c.ui.failed}
            </p>
            {h.status === "failed" && (
              <button className={a.secondary} onClick={() => void h.refresh()}>
                {c.ui.retry}
              </button>
            )}
          </section>
        ) : (
          <>
            <p>{c.ui.intro}</p>
            {!h.view.paymentAvailable && (
              <p className={s.notice}>{c.ui.unavailable}</p>
            )}
            {text && <p role="status">{text}</p>}
            {h.pending && (
              <section className={s.notice}>
                <p>{c.ui.unknown}</p>
                <div className={s.actions}>
                  <button
                    className={a.secondary}
                    disabled={h.busy}
                    onClick={() => void h.recover()}
                  >
                    {c.ui.recover}
                  </button>
                  <button
                    className={a.secondary}
                    disabled={h.busy}
                    onClick={() => void h.retry()}
                  >
                    {c.ui.retryOriginal}
                  </button>
                </div>
              </section>
            )}
            <section className={s.card}>
              <h2>{c.ui.newDraft}</h2>
              {!h.view.listings.length ? (
                <p>{c.ui.noListings}</p>
              ) : (
                <form
                  className={s.form}
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!blocked && listingId)
                      void h.run({
                        actorKey: h.view.actorKey,
                        sellerId: h.view.sellerId,
                        requestId: crypto.randomUUID(),
                        campaignId: crypto.randomUUID(),
                        expectedRevision: 0,
                        action: "save",
                        listingId,
                        productId,
                      });
                  }}
                >
                  <label>
                    {c.ui.listing}
                    <select
                      value={listingId}
                      onChange={(event) => setListing(event.target.value)}
                      disabled={blocked}
                      required
                    >
                      {h.view.listings.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title || item.id}
                          {item.eligible ? "" : " • " + c.ui.notEligible}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {c.ui.product}
                    <select
                      value={productId}
                      onChange={(event) =>
                        setProduct(event.target.value as ProductId)
                      }
                      disabled={blocked}
                    >
                      {Object.keys(PRODUCTS).map((id) => (
                        <option key={id} value={id}>
                          {c.products[id as ProductId]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p>
                    {c.ui.proposal}:{" "}
                    {money(PRODUCTS[productId].proposedMinor, language)}
                  </p>
                  <button
                    className={a.primary}
                    disabled={blocked || !listingId}
                  >
                    {c.ui.create}
                  </button>
                </form>
              )}
              <Link
                className={s.link}
                href={`/app/sellers/${h.view.sellerId}/listings?lang=${language}`}
              >
                {c.ui.back}
              </Link>
            </section>
            {!h.view.campaigns.length && <p>{c.ui.empty}</p>}
            {h.view.campaigns.map((item) => (
              <CampaignCard
                key={item.id + ":" + item.revision}
                item={item}
                language={language}
                canBill={h.view.canBill}
                blocked={blocked}
                run={(change) =>
                  h.run({ ...common(item), ...change } as PromotionCommand)
                }
              />
            ))}
            <p>{c.ui.metricNote}</p>
            {h.view.truncated && <p>{c.ui.truncated}</p>}
            <small>
              {c.ui.observed}: {date(h.view.observedAt, language)}
            </small>
          </>
        )}
      </div>
    </main>
  );
}
function CampaignCard({
  item,
  language,
  canBill,
  blocked,
  run,
}: {
  item: CampaignView;
  language: Language;
  canBill: boolean;
  blocked: boolean;
  run: (change: Record<string, unknown>) => Promise<void>;
}) {
  const c = promotionCopy(language),
    [reason, setReason] = useState(""),
    [acknowledged, setAcknowledged] = useState(false),
    review = item.review;
  return (
    <section className={s.card} aria-labelledby={"campaign-" + item.id}>
      <div className={s.header}>
        <h2 id={"campaign-" + item.id}>{item.title || item.listingId}</h2>
        <span className={s.badge}>{c.states[item.state]}</span>
      </div>
      <p>{c.products[item.productId]}</p>
      {item.reason && (
        <p>
          {c.ui.reasonLabel}: {c.reasons[item.reason]}
        </p>
      )}
      {!item.eligible && <p>{c.ui.notEligible}</p>}
      {item.state === "draft" && (
        <button
          className={a.secondary}
          disabled={blocked || !item.eligible}
          onClick={() => void run({ action: "review", reason: "" })}
        >
          {c.ui.review}
        </button>
      )}
      {review && (
        <div className={s.review}>
          <p>
            {review.terms ? c.ui.total : c.ui.proposal}:{" "}
            {money(review.terms?.totalMinor ?? review.proposedMinor, language)}
          </p>
          <p>
            {c.ui.capacity}:{" "}
            {review.capacity === "available"
              ? c.ui.available
              : review.capacity === "waitlist"
                ? c.ui.waitlist
                : review.capacity === "full"
                  ? c.ui.full
                  : c.ui.unavailable}
          </p>
          {review.terms ? (
            <p className={s.terms}>{review.terms.text[language]}</p>
          ) : (
            <p>{c.ui.noTerms}</p>
          )}
          <small>
            {c.ui.expiry}: {date(review.expiresAt, language)}
          </small>
          {item.state === "draft" && (
            <>
              <label className={s.consent}>
                <input
                  type="checkbox"
                  checked={acknowledged}
                  disabled={blocked || !review.saleAvailable || !canBill}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                />
                {c.ui.acknowledge}
              </label>
              <button
                className={a.primary}
                disabled={
                  blocked ||
                  !canBill ||
                  !review.saleAvailable ||
                  review.capacity !== "available" ||
                  !acknowledged
                }
                onClick={() =>
                  void run({
                    action: "purchase",
                    reviewId: review.id,
                    termsHash: review.termsHash,
                    acknowledged: true,
                    language,
                  })
                }
              >
                {c.ui.purchase}
              </button>
            </>
          )}
        </div>
      )}
      {item.state === "draft" &&
        review?.saleAvailable &&
        review.capacity === "waitlist" && (
          <button
            className={a.secondary}
            disabled={blocked}
            onClick={() => void run({ action: "waitlist", reason: "" })}
          >
            {language === "bg"
              ? "Заяви място без плащане • до 7 дни"
              : "Join waitlist without payment • up to 7 days"}
          </button>
        )}
      {item.attempt?.checkoutUrl && (
        <a className={s.link} href={item.attempt.checkoutUrl} rel="noreferrer">
          {language === "bg"
            ? "Продължи първоначалното плащане"
            : "Continue original checkout"}
        </a>
      )}
      {item.purchase && (
        <div className={s.review}>
          <h3>{c.ui.receipt}</h3>
          <p>
            {c.ui.total}: {money(item.purchase.terms.totalMinor, language)}
          </p>
          <p className={s.terms}>{item.purchase.terms.text[language]}</p>
          <p>
            {item.purchase.interval
              ? (item.productId === "bump_once_v1"
                  ? language === "bg"
                    ? "Един промотиран сигнал за свежест"
                    : "One promoted-freshness signal"
                  : c.ui.interval) +
                ": " +
                date(item.purchase.interval.startsAt, language) +
                (item.productId === "bump_once_v1"
                  ? ""
                  : " – " + date(item.purchase.interval.endsAt, language))
              : c.ui.pendingInterval}
          </p>
        </div>
      )}
      {item.waiting && (
        <p role="status">
          {language === "bg"
            ? "Позиция в изчакване без такса"
            : "Waitlist position without charge"}
          : {item.waiting.position} ·{" "}
          {language === "bg" ? "Валидно до" : "Until"}{" "}
          {date(item.waiting.expiresAt, language)}
        </p>
      )}
      {item.remedy && (
        <p role="status">
          {language === "bg"
            ? "Преглед за компенсация; не е потвърдено възстановяване"
            : "Remedy review; no refund is confirmed"}
          :{" "}
          {item.remedy.kind === "full_refund_review"
            ? language === "bg"
              ? "пълна сума"
              : "full amount"
            : language === "bg"
              ? "пропорционална сума"
              : "prorated amount"}{" "}
          · {language === "bg" ? "максимум" : "maximum"}{" "}
          {money(item.remedy.maximumMinor, language)}
        </p>
      )}
      <dl className={s.metrics}>
        <div>
          <dt>{c.ui.impressions}</dt>
          <dd>{item.metrics.impressions}</dd>
        </div>
        <div>
          <dt>{c.ui.clicks}</dt>
          <dd>{item.metrics.clicks}</dd>
        </div>
        <div>
          <dt>{c.ui.inquiries}</dt>
          <dd>{item.metrics.inquiries}</dd>
        </div>
      </dl>
      {!["completed", "cancelled"].includes(item.state) && (
        <>
          <label className={s.reason}>
            {c.ui.reason}
            <input
              maxLength={300}
              value={reason}
              disabled={blocked}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <div className={s.actions}>
            {["active", "scheduled"].includes(item.state) && (
              <button
                className={a.secondary}
                disabled={blocked || !reason.trim()}
                onClick={() => void run({ action: "pause", reason })}
              >
                {c.ui.pause}
              </button>
            )}
            <button
              className={a.secondary}
              disabled={blocked || !reason.trim()}
              onClick={() => void run({ action: "cancel", reason })}
            >
              {c.ui.cancel}
            </button>
            {item.state !== "draft" && (
              <button
                className={a.secondary}
                disabled={blocked || item.reason === "operator_safety"}
                onClick={() => void run({ action: "recheck", reason: "" })}
              >
                {c.ui.recheck}
              </button>
            )}
          </div>
          <small>{c.ui.stopNote}</small>
        </>
      )}
      <small>{c.ui.history}</small>
    </section>
  );
}
