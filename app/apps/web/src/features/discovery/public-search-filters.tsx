"use client";
import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  browseCategoryRoots,
  getBrowseCategory,
  getBrowseChildren,
  itemConditions,
  type AttributeDefinition,
} from "@treido/contracts/categories";
import {
  discoverySearchParams,
  discoverySorts,
  readDiscoveryInput,
  type DiscoveryInput,
} from "../catalog/discovery-input";
import type { PublicDiscoveryPage } from "../catalog/public-discovery-model";
import { optionLabel } from "../selling/copy";
import { Sheet } from "./components";
import { Icon } from "./icons";
import { useSheetStages } from "./sheet-stages";
import {
  clearPublicSearchFilters,
  publicSearchFilterParams,
} from "./public-search-model";
import styles from "./search-entry.module.css";

type Section =
  | "sort"
  | "category"
  | "condition"
  | "priceRange"
  | "location"
  | "sellerType"
  | "fields";
type Stage = "root" | Section | `category:${string}`;
const sections: Section[] = [
  "sort",
  "category",
  "condition",
  "priceRange",
  "location",
  "sellerType",
  "fields",
];

function categoryStageFor(id: string | null): Stage {
  const category = getBrowseCategory(id ?? "");
  const branch = category?.kind === "leaf" ? category.parentId : category?.id;
  return branch ? `category:${branch}` : "category";
}

/** The existing Search sheet geometry/history, supplied with marketplace
 * criteria. Draft edits are committed only by Done on the owning filter sheet
 * or directly opened category picker. */
export function PublicSearchFilters({
  open,
  onClose,
  onReopen,
  input,
  page,
  onApply,
  sellerKind,
  initialSection = "root",
}: {
  open: boolean;
  onClose: () => void;
  onReopen: () => void;
  input: DiscoveryInput;
  page?: PublicDiscoveryPage;
  onApply: (params: URLSearchParams) => void;
  sellerKind?: "personal" | "business";
  initialSection?: "root" | "category";
}) {
  const locale = useLocale(),
    t = useTranslations("marketplace"),
    ui = useTranslations("discoveryUI");
  const [draft, setDraft] = useState(input);
  const [prices, setPrices] = useState({
    min: input.minPriceMinor === null ? "" : String(input.minPriceMinor / 100),
    max: input.maxPriceMinor === null ? "" : String(input.maxPriceMinor / 100),
  });
  const flow = useSheetStages<Stage>({
    open,
    initial:
      initialSection === "category" ? categoryStageFor(input.category) : "root",
    onClose,
    onReopen,
    onStart: () => {
      setDraft(input);
      setPrices({
        min:
          input.minPriceMinor === null ? "" : String(input.minPriceMinor / 100),
        max:
          input.maxPriceMinor === null ? "" : String(input.maxPriceMinor / 100),
      });
    },
  });
  const category = getBrowseCategory(draft.category ?? "");
  const section = flow.stage.startsWith("category:")
    ? "category"
    : flow.stage === "root"
      ? null
      : (flow.stage as Section);
  const facetCount = (
    key: "categories" | "conditions" | "sellers",
    value: string,
  ) => page?.facets[key].find((facet) => facet.value === value)?.count;
  function choice(
    label: string,
    selected: boolean,
    select: () => void,
    count?: number,
  ) {
    return (
      <button
        type="button"
        key={label}
        aria-pressed={selected}
        data-filter-selected={selected || undefined}
        onClick={select}
      >
        {section === "category" ? (
          <span className={styles.categoryLabel}>
            {label}
            {count !== undefined ? ` (${count})` : ""}
          </span>
        ) : (
          <>
            {label}
            {count !== undefined ? ` (${count})` : ""}
          </>
        )}
        <span
          aria-hidden="true"
          className={`radio-outline ${selected ? "selected" : ""}`}
        />
      </button>
    );
  }
  function apply() {
    const next = publicSearchFilterParams({
      ...draft,
      seller: sellerKind ? "all" : draft.seller,
    });
    flow.close(() => onApply(next));
  }
  function doneSection() {
    if (initialSection === "category") {
      apply();
      return;
    }
    if (section === "priceRange") {
      const next = discoverySearchParams(draft);
      next.set("minPrice", prices.min);
      next.set("maxPrice", prices.max);
      setDraft(readDiscoveryInput(next).input);
    }
    flow.back();
  }
  function saveFields(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget),
      next = discoverySearchParams({ ...draft, attributes: {} });
    for (const [key, value] of data)
      if (key.startsWith("attr.") && typeof value === "string" && value.trim())
        next.append(key, value.trim());
    if (category?.kind === "leaf")
      for (const field of category.profile.fields) {
        if (field.type !== "dimension" && field.type !== "decimal") continue;
        const parts =
          field.type === "dimension" ? ["width", "height", "depth"] : ["value"];
        const value: Record<string, string | number> = {};
        let filled = true;
        for (const part of parts) {
          const raw = String(data.get(`detail.${field.id}.${part}`) ?? "")
            .trim()
            .replace(",", ".");
          if (!raw) filled = false;
          value[part] = field.type === "dimension" ? Number(raw) : raw;
        }
        value.unit = String(data.get(`detail.${field.id}.unit`) ?? "cm");
        if (filled) next.set(`attr.${field.id}`, JSON.stringify(value));
      }
    setDraft(readDiscoveryInput(next).input);
    flow.back();
  }
  const rootCategory = flow.stage.startsWith("category:")
    ? getBrowseCategory(flow.stage.slice(9))
    : null;
  const parentCategory = rootCategory?.parentId
    ? getBrowseCategory(rootCategory.parentId)
    : null;
  return (
    <>
      <Sheet
        open={open && flow.active && initialSection === "root"}
        title={ui("filter")}
        className={`${styles.filterSheet} buyer-public-filter filter-tall ${section ? "filter-covered" : ""}`}
        onClose={() => flow.close()}
        manageHistory={false}
      >
        <div className="filter-options">
          {sections
            .filter(
              (key) =>
                (!sellerKind || key !== "sellerType") &&
                (key !== "fields" || category?.kind === "leaf"),
            )
            .map((key) => (
              <button
                type="button"
                key={key}
                aria-haspopup="dialog"
                onClick={() =>
                  flow.navigate(
                    key === "category" ? categoryStageFor(draft.category) : key,
                  )
                }
              >
                {t(key)}
                <span className="filter-value">
                  {key === "sort"
                    ? t(draft.sort)
                    : key === "category"
                      ? category?.labels[locale]
                      : key === "condition" && draft.condition
                        ? optionLabel(draft.condition, locale)
                        : key === "sellerType"
                          ? t(draft.seller)
                          : ""}
                  <Icon name="back" />
                </span>
              </button>
            ))}
        </div>
        <div className="sheet-actions">
          <button
            className="pill"
            type="button"
            onClick={() => {
              setDraft(clearPublicSearchFilters(draft));
              setPrices({ min: "", max: "" });
            }}
          >
            {ui("clearAll")}
          </button>
          <button className="primary" type="button" onClick={apply}>
            {ui("done")}
          </button>
        </div>
      </Sheet>
      <Sheet
        open={open && flow.active && section !== null}
        title={
          rootCategory
            ? rootCategory.labels[locale]
            : section
              ? t(section)
              : ui("filter")
        }
        className={`${styles.filterSheet} buyer-public-filter ${section === "sort" ? "filter-short" : "filter-tall"} ${section === "category" ? styles.categorySheet : ""}`}
        onClose={() =>
          initialSection === "category" ? flow.close() : flow.back()
        }
        onBack={
          section === "category" && rootCategory
            ? () =>
                flow.navigate(
                  parentCategory ? `category:${parentCategory.id}` : "category",
                )
            : undefined
        }
        backLabel={
          ui("back") +
          ": " +
          (parentCategory?.labels[locale] ?? t("allCategories"))
        }
        manageHistory={false}
        initialFocus='.filter-options [data-filter-selected="true"]'
      >
        <div className="filter-options">
          {section === "sort" &&
            discoverySorts.map((sort) =>
              choice(t(sort), draft.sort === sort, () =>
                setDraft({ ...draft, sort }),
              ),
            )}
          {section === "sellerType" &&
            (["all", "personal", "business"] as const).map((seller) =>
              choice(
                t(seller),
                draft.seller === seller,
                () => setDraft({ ...draft, seller }),
                facetCount("sellers", seller),
              ),
            )}
          {section === "condition" && (
            <>
              {choice(t("anyCondition"), !draft.condition, () =>
                setDraft({ ...draft, condition: null }),
              )}
              {itemConditions.map((condition) =>
                choice(
                  optionLabel(condition, locale),
                  draft.condition === condition,
                  () => setDraft({ ...draft, condition }),
                  facetCount("conditions", condition),
                ),
              )}
            </>
          )}
          {section === "category" && (
            <>
              {choice(
                rootCategory ? t("allItems") : t("allCategories"),
                draft.category === (rootCategory?.id ?? null),
                () =>
                  setDraft({
                    ...draft,
                    category: rootCategory?.id ?? null,
                    attributes: {},
                  }),
              )}
              {(rootCategory
                ? getBrowseChildren(rootCategory.id)
                : browseCategoryRoots
              ).map((item) =>
                item.kind !== "leaf" ? (
                  <button
                    key={item.id}
                    type="button"
                    aria-haspopup="dialog"
                    onClick={() => flow.navigate(`category:${item.id}`)}
                  >
                    <span className={styles.categoryLabel}>
                      {item.labels[locale]}
                    </span>
                    <Icon name="chevron" />
                  </button>
                ) : (
                  choice(
                    item.labels[locale],
                    draft.category === item.id,
                    () =>
                      setDraft({ ...draft, category: item.id, attributes: {} }),
                    facetCount("categories", item.id),
                  )
                ),
              )}
            </>
          )}
          {section === "priceRange" && (
            <>
              <label>
                {t("minPrice")}
                <input
                  inputMode="decimal"
                  maxLength={12}
                  value={prices.min}
                  onChange={(event) =>
                    setPrices({ ...prices, min: event.target.value })
                  }
                />
              </label>
              <label>
                {t("maxPrice")}
                <input
                  inputMode="decimal"
                  maxLength={12}
                  value={prices.max}
                  onChange={(event) =>
                    setPrices({ ...prices, max: event.target.value })
                  }
                />
              </label>
            </>
          )}
          {section === "location" && (
            <label>
              {t("location")}
              <input
                maxLength={100}
                value={draft.location}
                placeholder={t("locationHint")}
                onChange={(event) =>
                  setDraft({ ...draft, location: event.target.value })
                }
              />
            </label>
          )}
          {section === "fields" && category?.kind === "leaf" && (
            <form
              onSubmit={saveFields}
              key={category.id + JSON.stringify(draft.attributes)}
            >
              {category.profile.fields.map((field) => (
                <PublicAttributeField
                  key={field.id}
                  field={field}
                  value={draft.attributes[field.id]}
                />
              ))}
              <div className="sheet-actions">
                <button className="primary" type="submit">
                  {ui("done")}
                </button>
              </div>
            </form>
          )}
        </div>
        {section !== "fields" && (
          <div className="sheet-actions">
            <button className="primary" type="button" onClick={doneSection}>
              {ui("done")}
            </button>
          </div>
        )}
      </Sheet>
    </>
  );
}

function PublicAttributeField({
  field,
  value,
}: {
  field: AttributeDefinition;
  value: DiscoveryInput["attributes"][string] | undefined;
}) {
  const locale = useLocale(),
    t = useTranslations("marketplace"),
    label = field.labels[locale],
    name = `attr.${field.id}`;
  if (field.type === "enum" || field.type === "boolean")
    return (
      <label>
        {label}
        <select
          name={name}
          defaultValue={value === undefined ? "" : String(value)}
        >
          <option value="">{t("any")}</option>
          {(field.type === "boolean" ? ["true", "false"] : field.values).map(
            (choice) => (
              <option value={choice} key={choice}>
                {field.type === "boolean"
                  ? t(choice === "true" ? "yes" : "no")
                  : optionLabel(choice, locale)}
              </option>
            ),
          )}
        </select>
      </label>
    );
  if (field.type === "multi_enum")
    return (
      <fieldset>
        <legend>{label}</legend>
        {field.values.map((choice) => (
          <label key={choice}>
            {optionLabel(choice, locale)}
            <input
              type="checkbox"
              name={name}
              value={choice}
              defaultChecked={Array.isArray(value) && value.includes(choice)}
            />
          </label>
        ))}
      </fieldset>
    );
  if (field.type === "dimension" || field.type === "decimal") {
    const current =
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    return (
      <fieldset>
        <legend>{label}</legend>
        {(field.type === "dimension"
          ? ["width", "height", "depth"]
          : ["value"]
        ).map((part) => (
          <label key={part}>
            {t(part as "width" | "height" | "depth" | "value")}
            <input
              inputMode="decimal"
              name={`detail.${field.id}.${part}`}
              defaultValue={String(current[part] ?? "")}
            />
          </label>
        ))}
        {field.type === "decimal" ? (
          <>
            <input
              type="hidden"
              name={`detail.${field.id}.unit`}
              value={field.unit}
            />
            <span>{field.unit}</span>
          </>
        ) : (
          <select
            name={`detail.${field.id}.unit`}
            defaultValue={String(current.unit ?? "cm")}
            aria-label={label + " · " + t("unit")}
          >
            {["mm", "cm", "m"].map((unit) => (
              <option key={unit}>{unit}</option>
            ))}
          </select>
        )}
      </fieldset>
    );
  }
  return (
    <label>
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
