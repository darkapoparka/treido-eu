"use client";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  categoryRoots,
  getChildren,
  getCategory,
  itemConditions,
  type AttributeDefinition,
} from "@treido/contracts/categories";
import {
  discoverySearchParams,
  type DiscoveryAttribute,
} from "../catalog/discovery-input";
import { optionLabel } from "../selling/copy";
import {
  parseToolIntent,
  toolHref,
  type ToolIntent,
  type ToolMode,
} from "./intent";
import { toolCopy, type ToolLocale } from "./copy";
import s from "./tools.module.css";
function AttributeControl({
  field,
  value,
  locale,
}: {
  field: AttributeDefinition;
  value?: DiscoveryAttribute;
  locale: ToolLocale;
}) {
  const t = toolCopy[locale],
    name = "attr." + field.id;
  if (field.type === "dimension") {
    const v =
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      "width" in value
        ? value
        : null;
    return (
      <fieldset className={s.field}>
        <legend>{field.labels[locale]}</legend>
        <div className={s.dimension}>
          {(["width", "height", "depth"] as const).map((axis) => (
            <label key={axis}>
              {t[axis]}
              <input
                name={name + "." + axis}
                inputMode="decimal"
                maxLength={20}
                defaultValue={v?.[axis] ?? ""}
              />
            </label>
          ))}
          <label>
            {t.unit}
            <select name={name + ".unit"} defaultValue={v?.unit ?? "cm"}>
              {field.units.map((unit) => (
                <option key={unit}>{unit}</option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>
    );
  }
  if (field.type === "decimal") {
    const v =
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      "value" in value
        ? value.value
        : "";
    return (
      <label className={s.field}>
        {field.labels[locale]} ({field.unit})
        <input
          name={name + ".value"}
          defaultValue={v}
          inputMode="decimal"
          maxLength={20}
        />
      </label>
    );
  }
  if (field.type === "enum" || field.type === "multi_enum")
    return (
      <label className={s.field}>
        {field.labels[locale]}
        <select
          name={name}
          multiple={field.type === "multi_enum"}
          defaultValue={
            value === undefined
              ? field.type === "multi_enum"
                ? []
                : ""
              : Array.isArray(value)
                ? value
                : String(value)
          }
        >
          {field.type === "enum" && <option value="">{t.any}</option>}
          {field.values.map((option) => (
            <option key={option} value={option}>
              {optionLabel(option, locale)}
            </option>
          ))}
        </select>
      </label>
    );
  if (field.type === "boolean")
    return (
      <label className={s.field}>
        {field.labels[locale]}
        <select
          name={name}
          defaultValue={value === undefined ? "" : String(value)}
        >
          <option value="">{t.any}</option>
          <option value="true">{t.yes}</option>
          {!field.mustBeTrue && <option value="false">{t.no}</option>}
        </select>
      </label>
    );
  return (
    <label className={s.field}>
      {field.labels[locale]}
      {field.type === "integer" && field.unit ? " (" + field.unit + ")" : ""}
      <input
        name={name}
        defaultValue={value === undefined ? "" : String(value)}
        type={
          field.type === "text" && field.format === "date" ? "date" : "text"
        }
        inputMode={field.type === "integer" ? "numeric" : undefined}
        maxLength={field.type === "text" ? field.maxLength : 12}
      />
    </label>
  );
}
export function IntentControls({
  initial,
  mode,
  onReview,
}: {
  initial: ToolIntent;
  mode: ToolMode;
  onReview?: (intent: ToolIntent) => void;
}) {
  const router = useRouter(),
    locale = initial.discovery.locale,
    t = toolCopy[locale],
    input = initial.discovery,
    params = discoverySearchParams(input);
  const [categoryId, setCategory] = useState(input.category ?? ""),
    [error, setError] = useState(false),
    [navigating, startNavigation] = useTransition();
  const category = getCategory(categoryId);
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(false);
    const data = new FormData(event.currentTarget),
      next = new URLSearchParams();
    for (const key of [
      "q",
      "category",
      "seller",
      "condition",
      "location",
      "minPrice",
      "maxPrice",
      "sort",
      "handover",
      "availability",
    ]) {
      const value = data.get(key);
      if (typeof value === "string" && value.trim())
        next.set(key, value.trim().replace(/\s+/g, " "));
    }
    next.set("lang", locale);
    if (category?.kind === "leaf")
      for (const field of category.profile.fields) {
        const key = "attr." + field.id;
        if (field.type === "dimension") {
          const raw = Object.fromEntries(
            ["width", "height", "depth"].map((axis) => [
              axis,
              String(data.get(key + "." + axis) ?? "")
                .trim()
                .replace(",", "."),
            ]),
          );
          if (Object.values(raw).some(Boolean))
            next.set(
              key,
              JSON.stringify({
                width: Number(raw.width),
                height: Number(raw.height),
                depth: Number(raw.depth),
                unit: data.get(key + ".unit"),
              }),
            );
        } else if (field.type === "decimal") {
          const value = String(data.get(key + ".value") ?? "")
            .trim()
            .replace(",", ".");
          if (value) next.set(key, JSON.stringify({ value, unit: field.unit }));
        } else
          for (const value of data.getAll(key))
            if (typeof value === "string" && value.trim())
              next.append(key, value.trim());
      }
    try {
      const parsed = parseToolIntent(next.toString(), mode);
      if (onReview) {
        onReview(parsed);
        return;
      }
      startNavigation(() => router.push(toolHref(mode, parsed)));
    } catch {
      setError(true);
    }
  }
  return (
    <details className={s.filter} open>
      <summary>{t.criteria}</summary>
      <form onSubmit={apply}>
        <div className={s.fields}>
          <label className={s.field}>
            {t.query}
            <input name="q" maxLength={120} defaultValue={input.q} />
          </label>
          <label className={s.field}>
            {t.category}
            <select
              name="category"
              value={categoryId}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="">{t.allCategories}</option>
              {categoryRoots.map((root) => (
                <optgroup key={root.id} label={root.labels[locale]}>
                  <option value={root.id}>{root.labels[locale]}</option>
                  {getChildren(root.id).map((leaf) => (
                    <option key={leaf.id} value={leaf.id}>
                      {leaf.labels[locale]}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className={s.field}>
            {t.seller}
            <select name="seller" defaultValue={input.seller}>
              {(["all", "personal", "business"] as const).map((kind) => (
                <option key={kind} value={kind}>
                  {t[kind]}
                </option>
              ))}
            </select>
          </label>
          <label className={s.field}>
            {t.condition}
            <select name="condition" defaultValue={input.condition ?? ""}>
              <option value="">{t.any}</option>
              {itemConditions.map((condition) => (
                <option key={condition} value={condition}>
                  {optionLabel(condition, locale)}
                </option>
              ))}
            </select>
          </label>
          <label className={s.field}>
            {t.minimum}
            <input
              name="minPrice"
              inputMode="decimal"
              maxLength={12}
              defaultValue={params.get("minPrice") ?? ""}
            />
          </label>
          <label className={s.field}>
            {t.maximum}
            <input
              name="maxPrice"
              inputMode="decimal"
              maxLength={12}
              defaultValue={params.get("maxPrice") ?? ""}
            />
          </label>
          <label className={s.field}>
            {t.location}
            <input
              name="location"
              maxLength={100}
              defaultValue={input.location}
            />
          </label>
          <label className={s.field}>
            {t.handover}
            <select name="handover" defaultValue={initial.handover}>
              {(["any", "pickup", "shipping"] as const).map((value) => (
                <option value={value} key={value}>
                  {t[value]}
                </option>
              ))}
            </select>
          </label>
          <label className={s.field}>
            {t.availability}
            <select name="availability" defaultValue={initial.availability}>
              <option value="any">{t.anyStock}</option>
              <option value="known">{t.known}</option>
            </select>
          </label>
          {mode === "find-for-me" && (
            <label className={s.field}>
              {t.sort}
              <select name="sort" defaultValue={input.sort}>
                {(
                  ["relevance", "newest", "price_asc", "price_desc"] as const
                ).map((value) => (
                  <option value={value} key={value}>
                    {t[value]}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className={s.wide}>
            <details open={Object.keys(input.attributes).length > 0}>
              <summary>{t.attributes}</summary>
              <p className={s.note}>{t.attrHint}</p>
              <div key={categoryId} className={s.fields}>
                {category?.kind === "leaf" &&
                  category.profile.fields.map((field) => (
                    <AttributeControl
                      key={field.id}
                      field={field}
                      locale={locale}
                      value={
                        categoryId === input.category
                          ? input.attributes[field.id]
                          : undefined
                      }
                    />
                  ))}
              </div>
            </details>
          </div>
        </div>
        {error && <p role="alert">{t.invalid}</p>}
        <div className={s.nav}>
          <button className={s.button + " " + s.primary} disabled={navigating}>
            {navigating ? t.loading : t.apply}
          </button>
          <a href={"/minis/" + mode + "?lang=" + locale}>{t.reset}</a>
        </div>
      </form>
    </details>
  );
}
