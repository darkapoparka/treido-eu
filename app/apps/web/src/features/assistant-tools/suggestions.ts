import {
  getCategory,
  validateCategoryAttributeValue,
} from "@treido/contracts/categories";
import type { DraftPayload } from "../selling/draft-model";
import { toCategoryAttributes } from "../selling/form-model";
import { optionLabel } from "../selling/copy";
import { editableDraft, type HelperEdit } from "./sell-helper-model";
import { assistantCopy, type AssistantLocale } from "./copy";
/** Deterministic suggestions quote only supported seller-entered facts. They
 * remain local editable proposals until explicitly reviewed and saved. */
export function suggestHelperEdit(
  payload: DraftPayload,
  locale: AssistantLocale,
): HelperEdit {
  const edit = editableDraft(payload),
    category = getCategory(edit.categoryId);
  if (category?.kind !== "leaf") return edit;
  const supplied = toCategoryAttributes(category, payload.fields),
    facts: string[] = [];
  for (const field of category.profile.fields) {
    const value = supplied[field.id];
    if (
      value === undefined ||
      !validateCategoryAttributeValue(category.id, field.id, value).ok
    )
      continue;
    const raw = edit.fields[field.id];
    const text =
      typeof raw === "string"
        ? field.type === "boolean"
          ? raw === "yes"
            ? assistantCopy[locale].yes
            : assistantCopy[locale].no
          : field.type === "enum"
            ? optionLabel(raw.trim(), locale)
            : raw.trim()
        : Array.isArray(raw)
          ? raw.map((value) => optionLabel(value, locale)).join(" · ")
          : (field.type === "dimension"
              ? ["width", "height", "depth"]
              : ["value"]
            )
              .map((key) => raw[key])
              .join(" × ") +
            " " +
            (raw.unit ?? "");
    facts.push(field.labels[locale] + ": " + text);
  }
  const brand = typeof supplied.brand === "string" ? supplied.brand.trim() : "",
    model = typeof supplied.model === "string" ? supplied.model.trim() : "";
  return {
    ...edit,
    title: (edit.title.trim() || [brand, model].filter(Boolean).join(" "))
      .replace(/\s+/g, " ")
      .slice(0, 160),
    description: edit.description.trim() || facts.join("\n").slice(0, 6000),
  };
}
