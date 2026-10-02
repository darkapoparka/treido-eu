import { z } from "zod";
import {
  CATEGORY_REGISTRY_VERSION,
  getCategory,
  itemConditions,
  sellerKinds,
} from "./registry";
import type { AttributeDefinition, CategoryLeaf } from "./types";

const dimensionScales = { mm: 1, cm: 10, m: 1000 } as const;

function attributeSchema(definition: AttributeDefinition): z.ZodType {
  switch (definition.type) {
    case "text": {
      const value = z.string().trim().min(1).max(definition.maxLength);
      return definition.format === "date"
        ? value.refine((date) => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
            const timestamp = Date.parse(`${date}T00:00:00Z`);
            return (
              Number.isFinite(timestamp) &&
              new Date(timestamp).toISOString().slice(0, 10) === date
            );
          }, "Use a valid YYYY-MM-DD date")
        : value;
    }
    case "enum":
      return z.enum(definition.values);
    case "multi_enum":
      return z
        .array(z.enum(definition.values))
        .max(definition.maxItems)
        .refine(
          (values) => new Set(values).size === values.length,
          "Duplicate choices",
        );
    case "integer":
      return z.number().int().min(definition.min).max(definition.max);
    case "boolean":
      return definition.mustBeTrue ? z.literal(true) : z.boolean();
    case "decimal":
      return z
        .strictObject({
          value: z.string().max(20),
          unit: z.literal(definition.unit),
        })
        .refine(({ value }) => {
          const pattern = new RegExp(
            `^(0|[1-9][0-9]*)(?:\\.[0-9]{1,${definition.precision}})?$`,
          );
          if (!pattern.test(value)) return false;
          const [whole, fraction = ""] = value.split(".");
          const minor = Number(
            whole + fraction.padEnd(definition.precision, "0"),
          );
          return (
            Number.isSafeInteger(minor) &&
            minor >= definition.minMinor &&
            minor <= definition.maxMinor
          );
        }, "Decimal precision or value is out of bounds");
    case "dimension":
      return z
        .strictObject({
          width: z.number().positive(),
          height: z.number().positive(),
          depth: z.number().positive(),
          unit: z.enum(definition.units),
        })
        .refine(
          (size) =>
            [size.width, size.height, size.depth].every(
              (value) =>
                Number.isFinite(value) &&
                value * dimensionScales[size.unit] <= definition.maxMillimetres,
            ),
          "Dimensions exceed the supported size",
        );
  }
}

const schemas = new Map<string, z.ZodType>();

function schemaForCategory(
  category: CategoryLeaf,
  partial: boolean,
): z.ZodType {
  const key = `${category.id}:${partial ? "draft" : "complete"}`;
  const cached = schemas.get(key);
  if (cached) return cached;
  const fields = Object.fromEntries(
    category.profile.fields.map((definition) => {
      const schema = attributeSchema(definition);
      return [
        definition.id,
        partial || !definition.required ? schema.optional() : schema,
      ];
    }),
  );
  const schema = z.strictObject(fields).superRefine((attributes, context) => {
    const from = attributes.yearFrom;
    const to = attributes.yearTo;
    if (typeof from === "number" && typeof to === "number" && from > to)
      context.addIssue({
        code: "custom",
        path: ["yearTo"],
        message: "End year precedes start year",
      });
    if (
      (attributes.vehicleMake || attributes.vehicleModel || from || to) &&
      !attributes.fitmentSource
    )
      context.addIssue({
        code: "custom",
        path: ["fitmentSource"],
        message: "Declare the source of fitment information",
      });
    if (attributes.carrierLocked === true && !attributes.carrier)
      context.addIssue({
        code: "custom",
        path: ["carrier"],
        message: "Name the locked carrier",
      });
  });
  schemas.set(key, schema);
  return schema;
}

export type CategoryValidationIssue = Readonly<{
  field: string;
  message: string;
}>;
export type AttributeValidation =
  | Readonly<{ ok: true; attributes: Readonly<Record<string, unknown>> }>
  | Readonly<{
      ok: false;
      code: "INVALID_INPUT";
      issues: readonly CategoryValidationIssue[];
    }>;

/** Search validates individual criteria, without publication's required fields
 * or cross-field declarations. This grants no category exposure or authority. */
export function validateCategoryAttributeValue(
  categoryId: string,
  fieldId: string,
  value: unknown,
): AttributeValidation {
  const category = getCategory(categoryId);
  const definition =
    category?.kind === "leaf"
      ? category.profile.fields.find((field) => field.id === fieldId)
      : undefined;
  if (!definition)
    return {
      ok: false,
      code: "INVALID_INPUT",
      issues: [{ field: fieldId, message: "Unknown category field" }],
    };
  const parsed = attributeSchema(definition).safeParse(value);
  return parsed.success
    ? { ok: true, attributes: { [fieldId]: parsed.data } }
    : {
        ok: false,
        code: "INVALID_INPUT",
        issues: parsed.error.issues.map((issue) => ({
          field: fieldId,
          message: issue.message,
        })),
      };
}

export function validateCategoryAttributes(
  categoryId: string,
  input: unknown,
  partial = false,
): AttributeValidation {
  const category = getCategory(categoryId);
  if (category?.kind !== "leaf")
    return {
      ok: false,
      code: "INVALID_INPUT",
      issues: [
        { field: "categoryId", message: "Select a known leaf category" },
      ],
    };
  const schema = schemaForCategory(category, partial);
  const parsed = schema.safeParse(input);
  return parsed.success
    ? { ok: true, attributes: parsed.data as Record<string, unknown> }
    : {
        ok: false,
        code: "INVALID_INPUT",
        issues: parsed.error.issues.map((issue) => ({
          field: issue.path.map(String).join("."),
          message: issue.message,
        })),
      };
}

const listingCategorySchema = z.strictObject({
  taxonomyVersion: z.number().int(),
  categoryId: z.string().min(1).max(120),
  sellerKind: z.enum(sellerKinds),
  country: z.string().length(2),
  condition: z.enum(itemConditions),
  attributes: z.unknown(),
});
export type CategoryValidationFailure =
  | "INVALID_INPUT"
  | "STALE_TAXONOMY"
  | "UNKNOWN_CATEGORY"
  | "ROOT_CATEGORY"
  | "SELLER_KIND_NOT_ALLOWED"
  | "COUNTRY_NOT_ALLOWED"
  | "CONDITION_NOT_ALLOWED"
  | "CATEGORY_DISABLED";
export type ListingCategoryValidation =
  | Readonly<{
      ok: true;
      category: CategoryLeaf;
      selection: Readonly<{
        taxonomyVersion: 1;
        categoryId: CategoryLeaf["id"];
        sellerKind: "personal" | "business";
        country: "BG";
        condition: z.infer<typeof listingCategorySchema>["condition"];
      }>;
      attributes: Readonly<Record<string, unknown>>;
    }>
  | Readonly<{
      ok: false;
      code: CategoryValidationFailure;
      issues?: readonly CategoryValidationIssue[];
    }>;

/** The caller derives sellerKind from the current authorized account. This pure
 * validation never authenticates a seller or authorizes publication. */
export function validateListingCategory(
  input: unknown,
  purpose: "draft" | "publish" = "publish",
): ListingCategoryValidation {
  if (purpose !== "draft" && purpose !== "publish")
    return { ok: false, code: "INVALID_INPUT" };
  const parsed = listingCategorySchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      code: "INVALID_INPUT",
      issues: parsed.error.issues.map((issue) => ({
        field: issue.path.map(String).join("."),
        message: issue.message,
      })),
    };
  const value = parsed.data;
  if (value.taxonomyVersion !== CATEGORY_REGISTRY_VERSION)
    return { ok: false, code: "STALE_TAXONOMY" };
  const category = getCategory(value.categoryId);
  if (!category) return { ok: false, code: "UNKNOWN_CATEGORY" };
  if (category.kind !== "leaf") return { ok: false, code: "ROOT_CATEGORY" };
  if (!category.policy.sellerKinds.includes(value.sellerKind))
    return { ok: false, code: "SELLER_KIND_NOT_ALLOWED" };
  if (!category.policy.countries.some((country) => country === value.country))
    return { ok: false, code: "COUNTRY_NOT_ALLOWED" };
  if (!category.policy.conditions.includes(value.condition))
    return { ok: false, code: "CONDITION_NOT_ALLOWED" };
  if (purpose === "publish" && !category.policy.enabledForPublish)
    return { ok: false, code: "CATEGORY_DISABLED" };
  const attributes = validateCategoryAttributes(
    category.id,
    value.attributes,
    purpose === "draft",
  );
  if (!attributes.ok) return attributes;
  return {
    ok: true,
    category,
    selection: {
      taxonomyVersion: CATEGORY_REGISTRY_VERSION,
      categoryId: category.id,
      sellerKind: value.sellerKind,
      country: "BG",
      condition: value.condition,
    },
    attributes: attributes.attributes,
  };
}
