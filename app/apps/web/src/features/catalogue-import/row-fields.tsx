"use client";
import { useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import { categoryRoots, getCategory, getChildren } from "@treido/contracts/categories";
import { AttributeFields } from "../selling/attribute-fields";
import type { RawFields, RawValue } from "../selling/form-model";
import { validateImportRow, type ImportRowView } from "./model";
import type { CsvRow } from "./csv";
import a from "../sellers/admin.module.css";
import s from "./import.module.css";

export function importAttributeFields(raw: string | undefined): RawFields | null {
  try {
    const input: unknown = JSON.parse(raw?.trim() || "{}");
    if (!input || typeof input !== "object" || Array.isArray(input)) return null;
    const fields: RawFields = {};
    for (const [key, value] of Object.entries(input)) {
      if (["__proto__", "prototype", "constructor"].includes(key)) return null;
      if (typeof value === "string") fields[key] = value;
      else if (typeof value === "boolean") fields[key] = value ? "yes" : "no";
      else if (typeof value === "number" && Number.isFinite(value)) fields[key] = String(value);
      else if (Array.isArray(value) && value.every((part) => typeof part === "string")) fields[key] = value;
      else if (value && typeof value === "object" && !Array.isArray(value) && Object.values(value).every((part) => typeof part === "string" || (typeof part === "number" && Number.isFinite(part)))) fields[key] = Object.fromEntries(Object.entries(value).map(([part, content]) => [part, String(content)]));
      else return null;
    }
    return fields;
  } catch { return null; }
}
export function ImportRowFields({ row, onChange }: { row: ImportRowView; onChange: (raw: CsvRow) => void }) {
  const locale = useLocale(), language = locale === "bg" ? "bg" : "en", bg = language === "bg";
  const t = useTranslations("catalogueImport"), prefix = useId();
  const raw = row.raw, checked = validateImportRow(raw, row.number);
  const category = getCategory(raw.category_id ?? "");
  const fields = importAttributeFields(raw.attributes_json);
  const issues = checked.errors;
  const labels = { external_id: "externalField", title: "titleField", description: "descriptionField", price: "priceField", locality: "localityField", quantity: "quantityField", sku: "skuField" } as const;
  function issueFor(key: string) {
    const issue = issues.find((item) => item.field === key);
    return issue ? (issue.code === "required" ? (bg ? "Попълни това поле." : "Complete this field.") : (bg ? "Провери стойността." : "Check this value.")) : null;
  }
  function set(key: keyof CsvRow, value: string) { onChange({ ...raw, [key]: value }); }
  function text(key: keyof typeof labels, maxLength: number, required = false, inputMode?: "decimal" | "numeric") {
    const error = issueFor(key), id = `${prefix}-${key}`;
    return <label key={key} htmlFor={id} className={key === "description" ? s.wide : undefined}>{t(labels[key])}
      {key === "description" ? <textarea id={id} name={key} value={raw[key] ?? ""} maxLength={maxLength} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => set(key, event.target.value)} />
        : <input id={id} name={key} value={raw[key] ?? ""} maxLength={maxLength} required={required} inputMode={inputMode} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => set(key, event.target.value)} />}
      {error && <small id={`${id}-error`} className={s.error}>{error}</small>}
    </label>;
  }
  const attributeErrors = Object.fromEntries(issues.filter((issue) => issue.field.startsWith("attributes.")).map((issue) => [issue.field.slice(11), issue.code === "required" ? "required" : "invalid"])) as Record<string, "required" | "invalid">;
  return <>
    {text("external_id", 128, true)}{text("title", 160, true)}{text("description", 6000)}
    <label>{t("categoryField")}<select name="category_id" value={raw.category_id ?? ""} required aria-invalid={!!issueFor("category_id")} onChange={(event) => set("category_id", event.target.value)}>
      <option value="">{bg ? "Избери категория" : "Choose a category"}</option>
      {raw.category_id && category?.kind !== "leaf" && <option value={raw.category_id}>{bg ? "Неподдържана категория — избери друга" : "Unsupported category — choose another"}</option>}
      {categoryRoots.map((root) => <optgroup key={root.id} label={root.labels[language]}>{getChildren(root.id).map((leaf) => <option key={leaf.id} value={leaf.id}>{leaf.labels[language]}</option>)}</optgroup>)}
    </select>{issueFor("category_id") && <small className={s.error}>{issueFor("category_id")}</small>}</label>
    <label>{t("conditionField")}<select name="condition" value={raw.condition ?? ""} required aria-invalid={!!issueFor("condition")} onChange={(event) => set("condition", event.target.value)}>
      <option value="">{bg ? "Избери състояние" : "Choose a condition"}</option>
      {raw.condition && !(category?.kind === "leaf" && category.policy.conditions.some((value) => value === raw.condition)) && <option value={raw.condition}>{bg ? "Провери състоянието" : "Review the condition"}</option>}
      {category?.kind === "leaf" && category.policy.conditions.map((condition) => <option key={condition} value={condition}>{({ new: bg ? "Ново" : "New", like_new: bg ? "Като ново" : "Like new", good: bg ? "Добро" : "Good", fair: bg ? "Задоволително" : "Fair", used: bg ? "Използвано" : "Used", refurbished: bg ? "Обновено" : "Refurbished", for_parts: bg ? "За части" : "For parts" } as Record<string, string>)[condition] ?? condition.replaceAll("_", " ")}</option>)}
    </select>{issueFor("condition") && <small className={s.error}>{issueFor("condition")}</small>}</label>
    {text("price", 12, true, "decimal")}
    <label>{t("currencyField")}<select name="currency" value={raw.currency ?? ""} required onChange={(event) => set("currency", event.target.value)}><option value="">{bg ? "Избери валута" : "Choose currency"}</option>{raw.currency && raw.currency !== "EUR" && <option value={raw.currency}>{bg ? "Избери EUR" : "Choose EUR"}</option>}<option value="EUR">EUR</option></select>{issueFor("currency") && <small className={s.error}>{issueFor("currency")}</small>}</label>
    {text("locality", 100)}
    <label>{t("modeField")}<select name="inventory_mode" value={raw.inventory_mode ?? ""} onChange={(event) => set("inventory_mode", event.target.value)}>
      <option value="">{bg ? "Настрой наличностите в черновата" : "Configure stock in the draft"}</option>
      {raw.inventory_mode && !["unique", "stocked"].includes(raw.inventory_mode) && <option value={raw.inventory_mode}>{bg ? "Избери поддържан режим" : "Choose a supported mode"}</option>}
      <option value="unique">{bg ? "Единичен артикул" : "Unique item"}</option><option value="stocked">{bg ? "Стокова наличност" : "Stocked product"}</option>
    </select>{issueFor("inventory_mode") && <small className={s.error}>{issueFor("inventory_mode")}</small>}</label>
    {text("quantity", 7, false, "numeric")}{text("sku", 64)}
    {category?.kind === "leaf" && fields && <div className={s.wide}>
      <h3>{bg ? "Характеристики на продукта" : "Product attributes"}</h3>
      <AttributeFields category={category} fields={fields} errors={attributeErrors} locale={language} onChange={(field: string, value: RawValue) => set("attributes_json", JSON.stringify({ ...fields, [field]: value }))} />
    </div>}
    <details className={s.wide} open={fields === null || undefined}><summary>{bg ? "Изходни характеристики от CSV" : "Source attributes from CSV"}</summary><p>{bg ? "Използвай полетата по-горе за обичайните промени. Тук можеш да поправиш невалиден JSON без да загубиш изходните данни." : "Use the fields above for normal edits. Repair invalid JSON here without losing the source data."}</p><label>attributes_json<textarea name="attributes_json" value={raw.attributes_json ?? ""} maxLength={24000} aria-invalid={fields === null} onChange={(event) => set("attributes_json", event.target.value)} /></label>
      {fields === null && <><p className={s.error}>{bg ? "Характеристиките не са валиден обект. Поправи текста или започни от празни характеристики." : "Attributes are not a valid object. Repair the text or explicitly start with empty attributes."}</p><button type="button" className={a.secondary} onClick={() => { if (window.confirm(bg ? "Да се премахнат ли невалидните характеристики от този ред?" : "Remove the invalid attributes from this row?")) set("attributes_json", "{}"); }}>{bg ? "Започни от празни характеристики" : "Start with empty attributes"}</button></>}
    </details>
    <label className={s.wide}>{t("optionsField")}<small>{bg ? 'До три двойки име/стойност, например {"Цвят":"Син"}. Единичният артикул няма варианти.' : 'Up to three name/value pairs, for example {"Color":"Blue"}. Unique items do not have variants.'}</small><textarea name="options_json" value={raw.options_json ?? ""} maxLength={24000} aria-invalid={!!issueFor("options_json")} onChange={(event) => set("options_json", event.target.value)} />{issueFor("options_json") && <small className={s.error}>{issueFor("options_json")}</small>}</label>
    <p className={s.wide} role="status">{issues.length ? (bg ? `Полета за проверка: ${issues.length}. Промените се проверяват отново при запазване.` : `${issues.length} fields need attention. Changes are checked again when saved.`) : (bg ? "Полетата са валидни. Запази реда, за да се проверят и текущите налични места и външният идентификатор." : "Fields are valid. Save the row to check current capacity and the external identifier.")}</p>
  </>;
}
