import type { AttributeDefinition, AttributeProfile } from "./types";

type DefinitionShape<T> = T extends AttributeDefinition
  ? Omit<T, "id" | "labels" | "required">
  : never;

function field(
  id: string,
  bg: string,
  en: string,
  definition: DefinitionShape<AttributeDefinition>,
  required = false,
): AttributeDefinition {
  return Object.freeze({
    id,
    labels: Object.freeze({ bg, en }),
    required,
    ...definition,
  }) as AttributeDefinition;
}

const text = (id: string, bg: string, en: string, required = false) =>
  field(id, bg, en, { type: "text", maxLength: 200 }, required);
const choice = (
  id: string,
  bg: string,
  en: string,
  values: readonly string[],
  required = false,
) =>
  field(id, bg, en, { type: "enum", values: Object.freeze(values) }, required);
const brand = text("brand", "Марка", "Brand");
const model = text("model", "Модел", "Model");
const material = text("material", "Материал", "Material");
const colour = text("colour", "Цвят", "Colour");
const size = text("size", "Размер", "Size");
const workingStatus = choice(
  "workingStatus",
  "Работно състояние",
  "Working status",
  ["working", "partly_working", "not_working", "unknown"],
);
const dimensions = field("dimensions", "Размери", "Dimensions", {
  type: "dimension",
  units: Object.freeze(["mm", "cm", "m"] as const),
  maxMillimetres: 100_000,
});
const weight = field("weight", "Тегло", "Weight", {
  type: "decimal",
  precision: 2,
  minMinor: 1,
  maxMinor: 1_000_000,
  unit: "kg",
});
const safetyDeclaration = choice(
  "safetyDeclaration",
  "Декларация за безопасност",
  "Safety declaration",
  ["not_recalled", "unknown", "recalled"],
);

function profile(
  id: string,
  fields: readonly AttributeDefinition[],
): AttributeProfile {
  return Object.freeze({ id, version: 1, fields: Object.freeze(fields) });
}

export const attributeProfiles = Object.freeze({
  fashion: profile("fashion", [
    choice("audience", "За кого", "Audience", ["women", "men", "unisex"], true),
    choice("sizeSystem", "Система за размери", "Size system", [
      "EU",
      "UK",
      "US",
      "letter",
      "one_size",
      "other",
    ]),
    size,
    brand,
    colour,
    material,
    field("unworn", "Неносено", "Unworn", { type: "boolean" }),
  ]),
  "phones-computing": profile("phones-computing", [
    brand,
    model,
    field("storageGB", "Памет за съхранение", "Storage", {
      type: "integer",
      min: 1,
      max: 1_048_576,
      unit: "GB",
    }),
    field("ramGB", "Оперативна памет", "RAM", {
      type: "integer",
      min: 1,
      max: 65_536,
      unit: "GB",
    }),
    field("carrierLocked", "Заключено към оператор", "Carrier locked", {
      type: "boolean",
    }),
    text("carrier", "Оператор", "Carrier"),
    choice("batteryState", "Състояние на батерията", "Battery state", [
      "normal",
      "reduced",
      "needs_replacement",
      "unknown",
    ]),
    workingStatus,
  ]),
  "cameras-audio": profile("cameras-audio", [
    brand,
    model,
    workingStatus,
    text("mount", "Байонет", "Mount"),
    text("connection", "Свързване", "Connection"),
    field("includedAccessories", "Включени аксесоари", "Included accessories", {
      type: "multi_enum",
      values: Object.freeze([
        "charger",
        "cable",
        "case",
        "box",
        "manual",
        "battery",
        "stand",
        "other",
      ]),
      maxItems: 8,
    }),
  ]),
  "furniture-appliances": profile("furniture-appliances", [
    dimensions,
    material,
    brand,
    model,
    workingStatus,
    weight,
    choice("handoverConstraint", "Предаване", "Handover constraint", [
      "pickup_only",
      "shipping_possible",
      "unknown",
    ]),
  ]),
  "sports-kids": profile("sports-kids", [
    choice("sport", "Спорт", "Sport", [
      "fitness",
      "cycling",
      "camping",
      "hiking",
      "football",
      "basketball",
      "volleyball",
      "tennis",
      "badminton",
      "swimming",
      "skiing",
      "snowboarding",
      "fishing",
      "skating",
      "other",
    ]),
    choice("ageRange", "Възрастова група", "Age range", [
      "baby",
      "toddler",
      "child",
      "teen",
      "adult",
      "all_ages",
      "unknown",
    ]),
    size,
    brand,
    model,
    safetyDeclaration,
  ]),
  beauty: profile("beauty", [
    brand,
    text("productType", "Вид продукт", "Product type"),
    field("sealed", "Фабрично запечатано", "Factory sealed", {
      type: "boolean",
    }),
    field("expiryDate", "Срок на годност", "Expiry date", {
      type: "text",
      maxLength: 10,
      format: "date",
    }),
    text("batch", "Партида", "Batch"),
    model,
    workingStatus,
  ]),
  "books-media": profile("books-media", [
    text("workTitle", "Заглавие на произведението", "Work title", true),
    text("creator", "Автор или създател", "Author or creator"),
    choice(
      "language",
      "Език",
      "Language",
      ["bg", "en", "de", "fr", "es", "it", "ru", "other", "not_applicable"],
      true,
    ),
    choice(
      "format",
      "Формат",
      "Format",
      [
        "hardback",
        "paperback",
        "magazine",
        "vinyl",
        "cd",
        "dvd",
        "blu_ray",
        "other",
      ],
      true,
    ),
    field("isbn", "ISBN", "ISBN", { type: "text", maxLength: 17 }),
  ]),
  parts: profile("parts", [
    brand,
    text("partNumber", "Номер на частта", "Part number"),
    text("vehicleMake", "Марка на превозното средство", "Vehicle make"),
    text("vehicleModel", "Модел на превозното средство", "Vehicle model"),
    field("yearFrom", "От година", "From year", {
      type: "integer",
      min: 1900,
      max: 2100,
    }),
    field("yearTo", "До година", "To year", {
      type: "integer",
      min: 1900,
      max: 2100,
    }),
    choice("fitmentSource", "Източник за съвместимост", "Fitment source", [
      "manufacturer",
      "catalogue",
      "seller_declared",
      "unknown",
    ]),
    workingStatus,
  ]),
  "equipment-art": profile("equipment-art", [
    dimensions,
    weight,
    material,
    brand,
    model,
    workingStatus,
    safetyDeclaration,
    text("maker", "Автор или производител", "Maker"),
    choice("provenance", "Произход", "Provenance", [
      "documented",
      "seller_declared",
      "unknown",
    ]),
    colour,
  ]),
});
export type AttributeProfileId = keyof typeof attributeProfiles;

/** Leaf requirements refine shared profiles without creating competing forms. */
export function profileForLeaf(root: string, slug: string): AttributeProfile {
  const profiles: Record<string, AttributeProfileId> = {
    electronics: "phones-computing",
    fashion: "fashion",
    home: "furniture-appliances",
    appliances: "furniture-appliances",
    "garden-diy": "equipment-art",
    "sports-outdoors": "sports-kids",
    "baby-kids": "sports-kids",
    "beauty-care": "beauty",
    "books-media": "books-media",
    "hobbies-collectibles": "equipment-art",
    music: "cameras-audio",
    gaming: "phones-computing",
    "motors-parts": "parts",
    "pet-supplies": "equipment-art",
    "business-equipment": "equipment-art",
    "art-handmade": "equipment-art",
  };
  let id = profiles[root];
  if (!id) throw new Error(`Missing category profile: ${root}`);
  if (
    root === "electronics" &&
    [
      "cameras-lenses",
      "headphones",
      "speakers-audio",
      "televisions-projectors",
    ].includes(slug)
  )
    id = "cameras-audio";
  if (root === "gaming" && slug === "gaming-furniture")
    id = "furniture-appliances";
  if (root === "business-equipment" && slug === "printers-scanners")
    id = "phones-computing";
  if (
    root === "baby-kids" &&
    ["baby-clothing", "kids-clothing", "kids-shoes"].includes(slug)
  )
    id = "fashion";

  const required = new Set<string>();
  if (id === "phones-computing" || id === "cameras-audio")
    ["brand", "model", "workingStatus"].forEach((key) => required.add(key));
  if (
    root === "electronics" &&
    ["phones", "tablets", "laptops", "desktop-computers"].includes(slug)
  )
    required.add("storageGB");
  if (
    id === "fashion" &&
    !["bags", "watches", "jewellery", "accessories"].includes(slug)
  )
    ["sizeSystem", "size"].forEach((key) => required.add(key));
  if (id === "furniture-appliances") required.add("dimensions");
  if (root === "appliances")
    ["model", "workingStatus", "handoverConstraint"].forEach((key) =>
      required.add(key),
    );
  if (root === "baby-kids" && id === "sports-kids")
    ["ageRange", "safetyDeclaration"].forEach((key) => required.add(key));
  if (root === "beauty-care")
    ["brand", "productType"].forEach((key) => required.add(key));
  if (
    root === "motors-parts" &&
    ["car-parts", "motorcycle-parts", "tyres-wheels"].includes(slug)
  )
    ["partNumber", "fitmentSource"].forEach((key) => required.add(key));
  const sealed = root === "beauty-care" && slug.startsWith("sealed-");
  const unworn = root === "fashion" && slug === "unworn-intimates-swimwear";
  if (sealed) required.add("sealed");
  if (unworn) required.add("unworn");

  return profile(
    id,
    attributeProfiles[id].fields.map((definition) =>
      Object.freeze({
        ...definition,
        required: definition.required || required.has(definition.id),
        ...(root === "baby-kids" &&
        definition.id === "audience" &&
        definition.type === "enum"
          ? { values: Object.freeze(["girls", "boys", "unisex"]) }
          : {}),
        ...(definition.type === "boolean" &&
        ((sealed && definition.id === "sealed") ||
          (unworn && definition.id === "unworn"))
          ? { mustBeTrue: true as const }
          : {}),
      }),
    ),
  );
}
