"use client";
import { useState } from "react";
import { getCategory } from "@treido/contracts/categories";
import { IntentControls } from "../shopping-tools/intent-controls";
import { parseToolIntent, toolParams } from "../shopping-tools/intent";
import { toolCopy, money } from "../shopping-tools/copy";
import { formatAttribute } from "../shopping-tools/tool-ui";
import { optionLabel } from "../selling/copy";
import {
  giftAges,
  giftOccasions,
  giftIntent,
  parseGiftBrief,
  type GiftBrief,
} from "./model";
import { giftCopy } from "./copy";
import s from "./gift.module.css";

export function GiftBriefSummary({
  brief,
  locale,
}: {
  brief: GiftBrief;
  locale: "bg" | "en";
}) {
  const t = giftCopy[locale],
    common = toolCopy[locale],
    intent = giftIntent(brief),
    input = intent.discovery,
    category = input.category ? getCategory(input.category) : null;
  return (
    <div className={s.panel}>
      <dl className={s.facts}>
        <div>
          <dt>{t.keyword}</dt>
          <dd>{input.q || t.any}</dd>
        </div>
        <div>
          <dt>{t.category}</dt>
          <dd>{category?.labels[locale] ?? t.any}</dd>
        </div>
        <div>
          <dt>{t.condition}</dt>
          <dd>
            {input.condition ? optionLabel(input.condition, locale) : t.any}
          </dd>
        </div>
        <div>
          <dt>{t.seller}</dt>
          <dd>{common[input.seller]}</dd>
        </div>
        <div>
          <dt>{t.budget}</dt>
          <dd>
            {input.minPriceMinor === null
              ? t.any
              : money(input.minPriceMinor, locale)}{" "}
            —{" "}
            {input.maxPriceMinor === null
              ? t.any
              : money(input.maxPriceMinor, locale)}
          </dd>
        </div>
        <div>
          <dt>{t.location}</dt>
          <dd>{input.location || t.any}</dd>
        </div>
        <div>
          <dt>{t.handover}</dt>
          <dd>{common[intent.handover]}</dd>
        </div>
        <div>
          <dt>{t.availability}</dt>
          <dd>{intent.availability === "known" ? t.known : t.any}</dd>
        </div>
        <div>
          <dt>{t.sort}</dt>
          <dd>{common[input.sort]}</dd>
        </div>
        <div>
          <dt>
            {t.occasion} · {t.contextOnly}
          </dt>
          <dd>{t.occasions[brief.occasion]}</dd>
        </div>
        <div>
          <dt>
            {t.age} · {t.contextOnly}
          </dt>
          <dd>{t.ages[brief.age]}</dd>
        </div>
        {brief.neededBy && (
          <div>
            <dt>{t.neededBy}</dt>
            <dd>{brief.neededBy}</dd>
          </div>
        )}
        {Object.entries(input.attributes).map(([field, value]) => (
          <div key={field}>
            <dt>
              {category?.kind === "leaf"
                ? (category.profile.fields.find((f) => f.id === field)?.labels[
                    locale
                  ] ?? field)
                : field}
            </dt>
            <dd>{formatAttribute(value, locale)}</dd>
          </div>
        ))}
      </dl>
      <p>{t.contextNote}</p>
      <p>{t.shippingUnknown}</p>
      {brief.neededBy && <p role="status">{t.arrival}</p>}
    </div>
  );
}
export function GiftBriefForm({
  initial,
  locale,
  disabled,
  onReview,
}: {
  initial: GiftBrief | null;
  locale: "bg" | "en";
  disabled: boolean;
  onReview: (brief: GiftBrief) => void;
}) {
  const t = giftCopy[locale];
  const [occasion, setOccasion] = useState<GiftBrief["occasion"]>(
      initial?.occasion ?? "none",
    ),
    [age, setAge] = useState<GiftBrief["age"]>(initial?.age ?? "unspecified"),
    [neededBy, setNeededBy] = useState(initial?.neededBy ?? ""),
    [error, setError] = useState(false);
  const intent = initial
    ? giftIntent(initial)
    : parseToolIntent("lang=" + locale, "find-for-me");
  intent.discovery = { ...intent.discovery, locale };
  return (
    <fieldset disabled={disabled} className={s.editor}>
      <legend>{t.context}</legend>
      <p className={s.note}>{t.contextNote}</p>
      <div className={s.fields}>
        <label className={s.field} htmlFor="gift-occasion">
          {t.occasion}
          <select
            id="gift-occasion"
            value={occasion}
            onChange={(e) =>
              setOccasion(e.target.value as GiftBrief["occasion"])
            }
          >
            {giftOccasions.map((key) => (
              <option key={key} value={key}>
                {t.occasions[key]}
              </option>
            ))}
          </select>
        </label>
        <label className={s.field} htmlFor="gift-age">
          {t.age}
          <select
            id="gift-age"
            value={age}
            onChange={(e) => setAge(e.target.value as GiftBrief["age"])}
          >
            {giftAges.map((key) => (
              <option key={key} value={key}>
                {t.ages[key]}
              </option>
            ))}
          </select>
        </label>
        <label className={s.field} htmlFor="gift-needed-by">
          {t.neededBy}
          <input
            id="gift-needed-by"
            type="date"
            value={neededBy}
            onChange={(e) => setNeededBy(e.target.value)}
          />
        </label>
      </div>
      {error && <p role="alert">{t.strict}</p>}
      <IntentControls
        initial={intent}
        mode="find-for-me"
        onReview={(value) => {
          try {
            const brief = parseGiftBrief({
              version: 1,
              occasion,
              age,
              neededBy: neededBy || null,
              criteria: toolParams(value).toString(),
            });
            setError(false);
            onReview(brief);
          } catch {
            setError(true);
          }
        }}
      />
    </fieldset>
  );
}
