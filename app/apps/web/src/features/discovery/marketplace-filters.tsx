"use client";
import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  categoryRoots,
  getCategory,
  getChildren,
  itemConditions,
  type AttributeDefinition,
} from "@treido/contracts/categories";
import type { DiscoveryInput } from "../catalog/discovery-input";
import { discoverySearchParams } from "../catalog/discovery-input";
import { optionLabel } from "../selling/copy";
import { Sheet } from "./components";
import s from "./marketplace.module.css";

function AttributeFilter({
  field,
  value,
}: {
  field: AttributeDefinition;
  value: DiscoveryInput["attributes"][string] | undefined;
}) {
  const locale = useLocale(),
    t = useTranslations("marketplace");
  const name = "attr." + field.id;
  const label = field.labels[locale];
  if (field.type === "enum" || field.type === "boolean") {
    const choices = field.type === "boolean" ? ["true", "false"] : field.values;
    return (
      <label className={s.field}>
        {label}
        <select
          name={name}
          defaultValue={value === undefined ? "" : String(value)}
        >
          <option value="">{t("any")}</option>
          {choices.map((choice) => (
            <option key={choice} value={choice}>
              {field.type === "boolean"
                ? t(choice === "true" ? "yes" : "no")
                : optionLabel(choice, locale)}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (field.type === "multi_enum")
    return (
      <fieldset className={s.choices}>
        <legend>{label}</legend>
        {field.values.map((choice) => (
          <label key={choice}>
            <input
              type="checkbox"
              name={name}
              value={choice}
              defaultChecked={Array.isArray(value) && value.includes(choice)}
            />
            {optionLabel(choice, locale)}
          </label>
        ))}
      </fieldset>
    );
  if (field.type === "dimension" || field.type === "decimal") {
    const current =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    const parts =
      field.type === "dimension" ? ["width", "height", "depth"] : ["value"];
    return (
      <fieldset className={s.choices}>
        <legend>{label}</legend>
        <div className={s.dimensions}>
          {parts.map((part) => (
            <label className={s.field} key={part}>
              {t(part as "width" | "height" | "depth" | "value")}
              <input
                inputMode="decimal"
                name={"detail." + field.id + "." + part}
                defaultValue={String(current[part] ?? "")}
                aria-label={
                  label +
                  " · " +
                  t(part as "width" | "height" | "depth" | "value")
                }
              />
            </label>
          ))}
          {field.type === "decimal" ? (
            <>
              <input
                type="hidden"
                name={"detail." + field.id + ".unit"}
                value={field.unit}
              />
              <span>{field.unit}</span>
            </>
          ) : (
            <select
              name={"detail." + field.id + ".unit"}
              defaultValue={String(current.unit ?? "cm")}
              aria-label={label + " · " + t("unit")}
            >
              <option value="mm">mm</option>
              <option value="cm">cm</option>
              <option value="m">m</option>
            </select>
          )}
        </div>
      </fieldset>
    );
  }
  return (
    <label className={s.field}>
      {label}
      <input
        name={name}
        defaultValue={value === undefined ? "" : String(value)}
        maxLength={field.type === "text" ? field.maxLength : 80}
        inputMode={field.type === "integer" ? "numeric" : "text"}
      />
    </label>
  );
}
export function MarketplaceFilters({
  input,
  onApply,
  onClose,
  sellerKind,
}: {
  sellerKind?: "personal" | "business";
  input: DiscoveryInput;
  onApply: (params: URLSearchParams) => void;
  onClose: () => void;
}) {
  const locale = useLocale(),
    t = useTranslations("marketplace");
  const [categoryId, setCategoryId] = useState<string>(input.category ?? "");
  const category = getCategory(categoryId);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    params.set("q", input.q);
    params.set("sort", input.sort);
    params.set("lang", locale);
    for (const [key, value] of data)
      if (
        typeof value === "string" &&
        value.trim() &&
        !key.startsWith("detail.")
      )
        params.append(key, value.trim());
    if (category?.kind === "leaf")
      for (const field of category.profile.fields) {
        if (field.type !== "dimension" && field.type !== "decimal") continue;
        const parts =
          field.type === "dimension" ? ["width", "height", "depth"] : ["value"];
        const value: Record<string, string | number> = {};
        let filled = true;
        for (const part of parts) {
          const raw = String(data.get("detail." + field.id + "." + part) ?? "")
            .trim()
            .replace(",", ".");
          if (!raw) filled = false;
          value[part] = field.type === "dimension" ? Number(raw) : raw;
        }
        value.unit = String(data.get("detail." + field.id + ".unit") ?? "cm");
        if (filled) params.set("attr." + field.id, JSON.stringify(value));
      }
    onApply(params);
  }
  return (
    <Sheet open title={t("filters")} onClose={onClose} className={s.sheet}>
      <form onSubmit={submit} className={s.filterForm}>
        <label className={s.field}>
          {t("category")}
          <select
            name="category"
            aria-label={t("category")}
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">{t("allCategories")}</option>
            {categoryRoots.map((root) => (
              <optgroup key={root.id} label={root.labels[locale]}>
                <option value={root.id}>
                  {root.labels[locale]} · {t("any")}
                </option>
                {getChildren(root.id).map((leaf) => (
                  <option key={leaf.id} value={leaf.id}>
                    {leaf.labels[locale]}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        {sellerKind ? (
          <input type="hidden" name="seller" value="all" />
        ) : (
          <label className={s.field}>
            {t("sellerType")}
            <select
              name="seller"
              aria-label={t("sellerType")}
              defaultValue={input.seller}
            >
              {(["all", "personal", "business"] as const).map((kind) => (
                <option key={kind} value={kind}>
                  {t(kind)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={s.field}>
          {t("condition")}
          <select
            name="condition"
            aria-label={t("condition")}
            defaultValue={input.condition ?? ""}
          >
            <option value="">{t("anyCondition")}</option>
            {itemConditions.map((condition) => (
              <option key={condition} value={condition}>
                {optionLabel(condition, locale)}
              </option>
            ))}
          </select>
        </label>
        <div className={s.priceFields}>
          <label className={s.field}>
            {t("minPrice")}
            <input
              name="minPrice"
              inputMode="decimal"
              maxLength={12}
              defaultValue={
                input.minPriceMinor === null
                  ? ""
                  : (input.minPriceMinor / 100).toFixed(2)
              }
            />
          </label>
          <label className={s.field}>
            {t("maxPrice")}
            <input
              name="maxPrice"
              inputMode="decimal"
              maxLength={12}
              defaultValue={
                input.maxPriceMinor === null
                  ? ""
                  : (input.maxPriceMinor / 100).toFixed(2)
              }
            />
          </label>
        </div>
        <label className={s.field}>
          {t("location")}
          <input
            name="location"
            maxLength={100}
            defaultValue={input.location}
            placeholder={t("locationHint")}
          />
        </label>
        {category?.kind === "leaf" && (
          <section key={category.id} className={s.attributes}>
            <h3>{t("fields")}</h3>
            {category.profile.fields.map((field) => (
              <AttributeFilter
                key={field.id}
                field={field}
                value={
                  category.id === input.category
                    ? input.attributes[field.id]
                    : undefined
                }
              />
            ))}
          </section>
        )}
        <div className={s.sheetActions}>
          <button
            type="button"
            className="pill"
            onClick={() =>
              onApply(
                discoverySearchParams({
                  ...input,
                  category: null,
                  condition: null,
                  location: "",
                  minPriceMinor: null,
                  maxPriceMinor: null,
                  attributes: {},
                }),
              )
            }
          >
            {t("clear")}
          </button>
          <button type="submit" className="primary">
            {t("apply")}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
