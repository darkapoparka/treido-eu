"use client";
import { getCategory } from "@treido/contracts/categories";
import { optionLabel } from "../selling/copy";
import { formatAttribute } from "../shopping-tools/tool-ui";
import { parseToolIntent } from "../shopping-tools/intent";
import { money, toolCopy } from "../shopping-tools/copy";
export function InputCriteriaSummary({
  canonical,
  locale,
}: {
  canonical: string;
  locale: "bg" | "en";
}) {
  const intent = parseToolIntent(canonical, "find-for-me"),
    input = intent.discovery,
    t = toolCopy[locale],
    category = input.category ? getCategory(input.category) : null;
  const rows: [string, string][] = [
    [t.query, input.q || t.any],
    [t.category, category?.labels[locale] ?? t.allCategories],
    [t.seller, t[input.seller]],
    [
      t.condition,
      input.condition ? optionLabel(input.condition, locale) : t.any,
    ],
    [t.location, input.location || t.any],
    [
      t.minimum,
      input.minPriceMinor === null ? t.any : money(input.minPriceMinor, locale),
    ],
    [
      t.maximum,
      input.maxPriceMinor === null ? t.any : money(input.maxPriceMinor, locale),
    ],
    [t.handover, t[intent.handover]],
    [t.availability, intent.availability === "known" ? t.known : t.anyStock],
  ];
  for (const [key, value] of Object.entries(input.attributes))
    rows.push([
      category?.kind === "leaf"
        ? (category.profile.fields.find((field) => field.id === key)?.labels[
            locale
          ] ?? key)
        : key,
      formatAttribute(value, locale),
    ]);
  return (
    <dl>
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
