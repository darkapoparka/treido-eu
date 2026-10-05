"use client";
import { useState } from "react";
import { getCategory } from "@treido/contracts/categories";
import { ProductCard } from "../discovery/product-card";
import { ListingSaveButton } from "../library/controls";
import { AssistantListingActions } from "../assistant-tools/listing-actions";
import { money } from "../shopping-tools/copy";
import { formatAttribute } from "../shopping-tools/tool-ui";
import type { GiftView, GiftOperation } from "./model";
import { giftCopy } from "./copy";
import s from "./gift.module.css";
export function GiftCandidates({
  view,
  subject,
  locale,
  disabled,
  onReview,
}: {
  view: GiftView;
  subject: string;
  locale: "bg" | "en";
  disabled: boolean;
  onReview: (op: GiftOperation) => void;
}) {
  const t = giftCopy[locale],
    [chosen, setChosen] = useState(
      view.items.filter((item) => item.selected).map((item) => item.listingId),
    );
  return (
    <section aria-label={t.candidates}>
      <h2>{t.candidates}</h2>
      <p>{t.scope}</p>
      <p>{t.shippingUnknown}</p>
      {view.unsupported.length > 0 ? (
        <p role="status">{t.arrival}</p>
      ) : view.items.length === 0 ? (
        <p>{view.brief ? t.empty : t.initial}</p>
      ) : null}
      <div className={s.grid}>
        {view.items.map((item) => {
          const current = item.current,
            category = current ? getCategory(current.card.categoryId) : null;
          return (
            <article key={item.listingId} className={s.result}>
              {current ? (
                <>
                  <ProductCard
                    product={current.card}
                    showRating={false}
                    saveControl={
                      <ListingSaveButton
                        id={current.card.id}
                        title={current.card.title}
                      />
                    }
                  />
                  <p>
                    {t.current}: {money(current.card.price.amount, locale)}
                  </p>
                  <p>{current.checkedAt}</p>
                  {item.changed && <p role="status">{t.changed}</p>}
                  {item.observed && (
                    <p>
                      {t.observed}:{" "}
                      {money(item.observed.observation.priceMinor, locale)} ·{" "}
                      {item.observedAt}
                    </p>
                  )}
                  <details>
                    <summary>{t.evidence}</summary>
                    <dl className={s.facts}>
                      {Object.entries(current.attributes).map(
                        ([key, value]) => (
                          <div key={key}>
                            <dt>
                              {category?.kind === "leaf"
                                ? (category.profile.fields.find(
                                    (field) => field.id === key,
                                  )?.labels[locale] ?? key)
                                : key}
                            </dt>
                            <dd>{formatAttribute(value, locale)}</dd>
                          </div>
                        ),
                      )}
                    </dl>
                    <p>{t.noGuarantee}</p>
                  </details>
                  <AssistantListingActions
                    listingId={item.listingId}
                    subject={subject}
                  />
                </>
              ) : (
                <p>{t.unavailable}</p>
              )}
              {item.selected && <p>{t.selected}</p>}
              <label className={s.check}>
                <input
                  type="checkbox"
                  aria-label={
                    current
                      ? t.select + ": " + current.card.title
                      : t.unavailable
                  }
                  checked={chosen.includes(item.listingId)}
                  disabled={
                    disabled ||
                    !current ||
                    item.changed ||
                    (!chosen.includes(item.listingId) && chosen.length >= 4)
                  }
                  onChange={(e) =>
                    setChosen((ids) =>
                      e.target.checked
                        ? [...ids, item.listingId]
                        : ids.filter((id) => id !== item.listingId),
                    )
                  }
                />
                {t.select}
              </label>
            </article>
          );
        })}
      </div>
      <p>
        {t.limit} ({chosen.length}/4)
      </p>
      <div className={s.actions}>
        <button
          className={s.button}
          disabled={disabled || !view.brief}
          onClick={() => onReview({ kind: "choose", listingIds: chosen })}
        >
          {t.saveSelection}
        </button>
        <button
          className={s.button}
          disabled={disabled}
          onClick={() => setChosen([])}
        >
          {t.clearSelection}
        </button>
      </div>
    </section>
  );
}
