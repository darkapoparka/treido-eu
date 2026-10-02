import {
  getCategory,
  type CategoryLeafId,
  type ItemCondition,
} from "@treido/contracts/categories";
import type { RawFields, RawValue } from "./form-model";

export type DraftPayload = {
  schemaVersion: 1;
  title: string;
  description: string;
  categoryId: CategoryLeafId | null;
  condition: ItemCondition | "";
  fields: RawFields;
  priceMinor: number | null;
  currency: "EUR";
  locality: string;
};
export type DraftView = {
  id: string;
  sellerId: string;
  revision: number;
  updatedAt: string;
  payload: DraftPayload;
};
export type DraftAcknowledgement = Omit<DraftView, "payload">;

export const emptyDraft: DraftPayload = {
  schemaVersion: 1,
  title: "",
  description: "",
  categoryId: null,
  condition: "",
  fields: {},
  priceMinor: null,
  currency: "EUR",
  locality: "",
};
export const validId = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
const record = (value: unknown): value is Record<string, unknown> =>
  !!value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

// Drafts can be incomplete. Bound and type their contents without applying the
// required-field/media/declaration checks that belong to publication.
export function parseDraftPayload(value: unknown): DraftPayload | null {
  if (
    !record(value) ||
    Object.keys(value).some((key) => !Object.hasOwn(emptyDraft, key)) ||
    value.schemaVersion !== 1 ||
    value.currency !== "EUR" ||
    typeof value.title !== "string" ||
    value.title.length > 160 ||
    typeof value.description !== "string" ||
    value.description.length > 6000 ||
    typeof value.locality !== "string" ||
    value.locality.length > 100 ||
    !record(value.fields) ||
    typeof value.condition !== "string" ||
    (value.priceMinor !== null &&
      (!Number.isSafeInteger(value.priceMinor) ||
        (value.priceMinor as number) < 0 ||
        (value.priceMinor as number) > 1_000_000_000))
  )
    return null;
  const category =
    typeof value.categoryId === "string" ? getCategory(value.categoryId) : null;
  if (value.categoryId !== null && category?.kind !== "leaf") return null;
  if (
    (!category &&
      (value.condition !== "" || Object.keys(value.fields).length)) ||
    (category?.kind === "leaf" &&
      value.condition !== "" &&
      !category.policy.conditions.includes(value.condition as ItemCondition))
  )
    return null;
  const fields: RawFields = {};
  for (const [id, raw] of Object.entries(value.fields)) {
    const definition =
      category?.kind === "leaf"
        ? category.profile.fields.find((field) => field.id === id)
        : null;
    if (!definition) return null;
    if (definition.type === "multi_enum") {
      if (
        !Array.isArray(raw) ||
        raw.length > definition.maxItems ||
        new Set(raw).size !== raw.length ||
        !raw.every(
          (item) =>
            typeof item === "string" && definition.values.includes(item),
        )
      )
        return null;
    } else if (
      definition.type === "dimension" ||
      definition.type === "decimal"
    ) {
      const keys =
        definition.type === "dimension"
          ? ["width", "height", "depth", "unit"]
          : ["value", "unit"];
      if (
        !record(raw) ||
        Object.entries(raw).some(
          ([key, item]) =>
            !keys.includes(key) || typeof item !== "string" || item.length > 80,
        )
      )
        return null;
    } else if (
      typeof raw !== "string" ||
      raw.length > (definition.type === "text" ? definition.maxLength : 200)
    )
      return null;
    fields[id] = raw as RawValue;
  }
  if (JSON.stringify(value).length > 24000) return null;
  return {
    schemaVersion: 1,
    title: value.title,
    description: value.description,
    categoryId: category?.kind === "leaf" ? category.id : null,
    condition: value.condition as ItemCondition | "",
    fields,
    priceMinor: value.priceMinor as number | null,
    currency: "EUR",
    locality: value.locality,
  };
}

export function parseEuroPrice(value: string): number | null | "invalid" {
  const text = value.trim();
  if (!text) return null;
  if (!/^\d{1,7}(?:[.,]\d{1,2})?$/.test(text)) return "invalid";
  const [whole, fraction = ""] = text.replace(",", ".").split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
