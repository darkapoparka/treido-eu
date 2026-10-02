import {
  CATEGORY_REGISTRY_VERSION,
  getCategory,
  validateCategoryAttributes,
  type AttributeDefinition,
  type CategoryLeaf,
  type ItemCondition,
} from "@treido/contracts/categories";

export type RawValue = string | string[] | Record<string, string>;
export type RawFields = Record<string, RawValue>;
export type CategoryPreparation = { condition: string; fields: RawFields };
export const PREPARATION_STORAGE_KEY = "treido-category-preparation-v1";
const MAX_BUFFER_LENGTH = 32_000;

export function fieldHasValue(value: RawValue | undefined): boolean {
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  return (
    !!value &&
    Object.entries(value).some(
      ([key, text]) => key !== "unit" && text.trim() !== "",
    )
  );
}

function numberValue(value: string | undefined, integer = false) {
  const text = (value ?? "").trim().replace(",", ".");
  return (integer ? /^\d+$/ : /^\d+(?:\.\d+)?$/).test(text)
    ? Number(text)
    : NaN;
}

export function toCategoryAttributes(
  category: CategoryLeaf,
  fields: RawFields,
): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};
  for (const field of category.profile.fields) {
    const raw = fields[field.id];
    if (!fieldHasValue(raw)) continue;
    if (field.type === "integer")
      attributes[field.id] = numberValue(
        typeof raw === "string" ? raw : undefined,
        true,
      );
    else if (field.type === "boolean")
      attributes[field.id] = raw === "yes" ? true : raw === "no" ? false : raw;
    else if (field.type === "decimal") {
      const value = typeof raw === "object" && !Array.isArray(raw) ? raw : {};
      attributes[field.id] = {
        value: (value.value ?? "").trim().replace(",", "."),
        unit: value.unit ?? field.unit,
      };
    } else if (field.type === "dimension") {
      const value = typeof raw === "object" && !Array.isArray(raw) ? raw : {};
      attributes[field.id] = {
        width: numberValue(value.width),
        height: numberValue(value.height),
        depth: numberValue(value.depth),
        unit: value.unit ?? "cm",
      };
    } else attributes[field.id] = raw;
  }
  return attributes;
}

export function reviewPreparation(
  category: CategoryLeaf,
  preparation: CategoryPreparation,
) {
  const errors: Record<string, "required" | "invalid"> = {};
  if (
    !category.policy.conditions.some(
      (condition) => condition === preparation.condition,
    )
  )
    errors.condition = "required";
  const parsed = validateCategoryAttributes(
    category.id,
    toCategoryAttributes(category, preparation.fields),
  );
  if (!parsed.ok)
    for (const issue of parsed.issues) {
      const id = issue.field.split(".")[0];
      errors[id] = fieldHasValue(preparation.fields[id])
        ? "invalid"
        : "required";
    }
  return { errors, attributes: parsed.ok ? parsed.attributes : null };
}

function validRaw(field: AttributeDefinition, raw: unknown): raw is RawValue {
  if (field.type === "multi_enum")
    return (
      Array.isArray(raw) &&
      raw.length <= field.maxItems &&
      new Set(raw).size === raw.length &&
      raw.every(
        (value) => typeof value === "string" && field.values.includes(value),
      )
    );
  if (field.type === "dimension" || field.type === "decimal") {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
    const keys =
      field.type === "dimension"
        ? ["width", "height", "depth", "unit"]
        : ["value", "unit"];
    return Object.entries(raw).every(
      ([key, value]) =>
        keys.includes(key) && typeof value === "string" && value.length <= 80,
    );
  }
  return (
    typeof raw === "string" &&
    raw.length <= (field.type === "text" ? field.maxLength : 200)
  );
}

export function encodePreparation(
  category: CategoryLeaf,
  preparation: CategoryPreparation,
): string | null {
  if (Object.keys(reviewPreparation(category, preparation).errors).length)
    return null;
  const buffer = JSON.stringify({
    version: 1,
    taxonomyVersion: CATEGORY_REGISTRY_VERSION,
    categoryId: category.id,
    preparation,
  });
  return buffer.length <= MAX_BUFFER_LENGTH ? buffer : null;
}

export function decodePreparation(
  buffer: string,
): { category: CategoryLeaf; preparation: CategoryPreparation } | null {
  if (buffer.length > MAX_BUFFER_LENGTH) return null;
  try {
    const data = JSON.parse(buffer);
    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      Object.keys(data).some(
        (key) =>
          !["version", "taxonomyVersion", "categoryId", "preparation"].includes(
            key,
          ),
      ) ||
      data.version !== 1 ||
      data.taxonomyVersion !== CATEGORY_REGISTRY_VERSION ||
      typeof data.categoryId !== "string"
    )
      return null;
    const category = getCategory(data.categoryId);
    if (category?.kind !== "leaf") return null;
    const preparation = data.preparation;
    if (
      !preparation ||
      typeof preparation !== "object" ||
      Array.isArray(preparation) ||
      Object.keys(preparation).some(
        (key) => !["condition", "fields"].includes(key),
      ) ||
      typeof preparation.condition !== "string" ||
      !preparation.fields ||
      typeof preparation.fields !== "object" ||
      Array.isArray(preparation.fields)
    )
      return null;
    for (const [id, raw] of Object.entries(preparation.fields)) {
      const field = category.profile.fields.find((field) => field.id === id);
      if (!field || !validRaw(field, raw)) return null;
    }
    if (Object.keys(reviewPreparation(category, preparation).errors).length)
      return null;
    return {
      category,
      preparation: {
        condition: preparation.condition as ItemCondition,
        fields: preparation.fields,
      },
    };
  } catch {
    return null;
  }
}
