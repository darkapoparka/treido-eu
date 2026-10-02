import { describe, expect, it } from "vitest";
import {
  CATEGORY_REGISTRY_VERSION,
  attributeProfiles,
  categoryLeaves,
  categoryRoots,
  getCategory,
  getCategoryAncestry,
  getCategoryLabel,
  getChildren,
  searchDraftCategories,
  validateCategoryAttributes,
  validateListingCategory,
} from "@treido/contracts/categories";

const phone = "cat:electronics/phones";
const phoneAttributes = {
  brand: "Apple",
  model: "iPhone 14",
  storageGB: 128,
  workingStatus: "working",
};
const selection = (changes = {}) => ({
  taxonomyVersion: CATEGORY_REGISTRY_VERSION,
  categoryId: phone,
  sellerKind: "personal",
  country: "BG",
  condition: "good",
  attributes: {},
  ...changes,
});

describe("Treido category registry", () => {
  it("has the complete bilingual physical-goods catalogue with unique stable IDs", () => {
    expect(categoryRoots).toHaveLength(16);
    expect(categoryLeaves).toHaveLength(152);
    const categories = [...categoryRoots, ...categoryLeaves];
    expect(new Set(categories.map((category) => category.id)).size).toBe(168);
    for (const category of categories) {
      expect(category.labels.bg).toMatch(/[А-Яа-я]/);
      expect(category.labels.en.trim()).not.toBe("");
      expect(category.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
    expect(getCategory("cat:baby-kids/toys")?.parentId).toBe("cat:baby-kids");
    expect(getCategory("cat:pet-supplies/toys")?.parentId).toBe(
      "cat:pet-supplies",
    );
    expect(getCategory("cat:food/vegetables")).toBeUndefined();
    expect(getCategory("cat:property/apartments")).toBeUndefined();
  });

  it("provides rooted ancestry and unique sibling slugs without orphan/cycle paths", () => {
    for (const root of categoryRoots) {
      expect(root.parentId).toBeNull();
      const children = getChildren(root.id);
      expect(children.length).toBeGreaterThan(0);
      expect(new Set(children.map((child) => child.slug)).size).toBe(
        children.length,
      );
      for (const leaf of children) {
        expect(getCategoryAncestry(leaf.id).map((node) => node.id)).toEqual([
          root.id,
          leaf.id,
        ]);
        expect(getChildren(leaf.id)).toEqual([]);
      }
    }
    expect(getCategoryAncestry("cat:unknown")).toEqual([]);
  });

  it("supports BG/EN labels, explicit BG fallback and bounded draft lookup", () => {
    expect(getCategoryLabel(phone, "bg")).toBe("Телефони");
    expect(getCategoryLabel(phone, "en")).toBe("Phones");
    expect(getCategoryLabel(phone, "fr")).toBe("Телефони");
    expect(getCategoryLabel("missing")).toBeUndefined();
    expect(
      searchDraftCategories(" ЕЛЕКТРОНИКА телефони ").map((leaf) => leaf.id),
    ).toContain(phone);
    expect(
      searchDraftCategories("electronics phones").map((leaf) => leaf.id),
    ).toContain(phone);
    expect(searchDraftCategories("", 48)).toHaveLength(48);
    expect(searchDraftCategories("", 49)).toEqual([]);
    expect(searchDraftCategories("", 1.5)).toEqual([]);
    expect(searchDraftCategories("x".repeat(201))).toEqual([]);
  });

  it("binds all leaves to nine versioned profiles covering every specified field type", () => {
    expect(Object.keys(attributeProfiles)).toHaveLength(9);
    const types = new Set<string>();
    for (const leaf of categoryLeaves) {
      expect(leaf.profile.id in attributeProfiles).toBe(true);
      expect(leaf.profile.version).toBe(1);
      expect(leaf.policy.version).toBe(1);
      const fields = leaf.profile.fields;
      expect(new Set(fields.map((field) => field.id)).size).toBe(fields.length);
      fields.forEach((field) => types.add(field.type));
    }
    expect([...types].sort()).toEqual([
      "boolean",
      "decimal",
      "dimension",
      "enum",
      "integer",
      "multi_enum",
      "text",
    ]);
  });

  it("keeps policies, fields and label data immutable at runtime", () => {
    const category = getCategory(phone);
    expect(category?.kind).toBe("leaf");
    if (category?.kind !== "leaf") throw new Error("Missing phone category");
    expect(Object.isFrozen(category)).toBe(true);
    expect(Object.isFrozen(category.policy)).toBe(true);
    expect(Object.isFrozen(category.policy.conditions)).toBe(true);
    expect(Object.isFrozen(category.profile.fields[0].labels)).toBe(true);
    expect(() =>
      Object.assign(category.policy, { enabledForPublish: true }),
    ).toThrow();
  });
});

describe("category policy boundary", () => {
  it.each(["personal", "business"])(
    "allows new and used draft goods for %s without granting selling authority",
    (sellerKind) => {
      expect(
        validateListingCategory(
          selection({ sellerKind, condition: "new" }),
          "draft",
        ).ok,
      ).toBe(true);
      expect(
        validateListingCategory(
          selection({ sellerKind, condition: "good" }),
          "draft",
        ).ok,
      ).toBe(true);
    },
  );

  it.each([
    ["taxonomyVersion", 0, "STALE_TAXONOMY"],
    ["taxonomyVersion", 2, "STALE_TAXONOMY"],
    ["categoryId", "cat:electronics", "ROOT_CATEGORY"],
    ["categoryId", "cat:electronics/stolen-phones", "UNKNOWN_CATEGORY"],
    ["country", "US", "COUNTRY_NOT_ALLOWED"],
    ["country", "bg", "COUNTRY_NOT_ALLOWED"],
    ["sellerKind", "verified_business", "INVALID_INPUT"],
    ["condition", "used", "INVALID_INPUT"],
  ])("rejects invalid %s input %s", (field, value, code) => {
    expect(
      validateListingCategory(selection({ [field]: value }), "draft"),
    ).toMatchObject({ ok: false, code });
  });

  it("denies every pending leaf for publication, including a fabricated client approval", () => {
    for (const leaf of categoryLeaves) {
      expect(leaf.policy.reviewStatus).toBe("pending");
      expect(leaf.policy.enabledForPublish).toBe(false);
      expect(
        validateListingCategory(
          selection({
            categoryId: leaf.id,
            condition: leaf.policy.conditions[0],
          }),
        ),
      ).toMatchObject({ ok: false, code: "CATEGORY_DISABLED" });
    }
    expect(
      validateListingCategory(selection({ enabledForPublish: true }), "draft"),
    ).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(
      validateListingCategory(selection(), "approved" as "publish"),
    ).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  });

  it("enforces hygiene and category-specific conditions with explicit policy restrictions", () => {
    const skincare = "cat:beauty-care/sealed-skincare";
    expect(
      validateListingCategory(
        selection({ categoryId: skincare, condition: "good" }),
        "draft",
      ),
    ).toMatchObject({ ok: false, code: "CONDITION_NOT_ALLOWED" });
    expect(
      validateListingCategory(
        selection({
          categoryId: skincare,
          condition: "new",
          attributes: { sealed: false },
        }),
        "draft",
      ).ok,
    ).toBe(false);
    expect(
      validateCategoryAttributes(skincare, {
        brand: "Brand",
        productType: "Cream",
        sealed: true,
      }).ok,
    ).toBe(true);
    expect(
      validateCategoryAttributes("cat:fashion/unworn-intimates-swimwear", {
        audience: "unisex",
        sizeSystem: "EU",
        size: "M",
        unworn: false,
      }).ok,
    ).toBe(false);
    const child = getCategory("cat:baby-kids/toys");
    expect(child?.kind === "leaf" && child.policy.restrictions).toContain(
      "no_used_child_car_seats",
    );
    const motors = getCategory("cat:motors-parts/car-parts");
    expect(motors?.kind === "leaf" && motors.policy.restrictions).toContain(
      "no_airbags",
    );
  });
});

describe("typed listing attributes", () => {
  it("validates required phone fields while allowing incomplete but typed draft input", () => {
    expect(validateCategoryAttributes(phone, phoneAttributes)).toMatchObject({
      ok: true,
      attributes: phoneAttributes,
    });
    expect(validateCategoryAttributes(phone, {}).ok).toBe(false);
    expect(validateListingCategory(selection(), "draft")).toMatchObject({
      ok: true,
      attributes: {},
      selection: { taxonomyVersion: 1, categoryId: phone, country: "BG" },
    });
    expect(
      validateListingCategory(
        selection({ attributes: { storageGB: "128" } }),
        "draft",
      ).ok,
    ).toBe(false);
  });

  it.each([NaN, Infinity, -1, 0, 2.5, Number.MAX_SAFE_INTEGER, "128"])(
    "rejects unsafe storage %s without coercion",
    (storageGB) => {
      expect(
        validateCategoryAttributes(phone, { ...phoneAttributes, storageGB }).ok,
      ).toBe(false);
    },
  );

  it("rejects unknown/private attributes and preserves unknown versus declared false", () => {
    expect(
      validateCategoryAttributes(phone, {
        ...phoneAttributes,
        serialNumber: "PRIVATE-SERIAL",
      }).ok,
    ).toBe(false);
    expect(validateCategoryAttributes(phone, null).ok).toBe(false);
    const unknown = validateCategoryAttributes(phone, phoneAttributes);
    const declaredFalse = validateCategoryAttributes(phone, {
      ...phoneAttributes,
      carrierLocked: false,
    });
    if (!unknown.ok || !declaredFalse.ok)
      throw new Error("Valid phone attributes rejected");
    expect(unknown.attributes.carrierLocked).toBeUndefined();
    expect(declaredFalse.attributes.carrierLocked).toBe(false);
    expect(
      validateCategoryAttributes(phone, {
        ...phoneAttributes,
        carrierLocked: true,
      }).ok,
    ).toBe(false);
  });

  it("validates dimensions with explicit supported units and converted bounds", () => {
    const category = "cat:home/tables-chairs";
    expect(
      validateCategoryAttributes(category, {
        dimensions: { width: 120, height: 75, depth: 60, unit: "cm" },
      }).ok,
    ).toBe(true);
    for (const dimensions of [
      { width: 120, height: 75, depth: 60, unit: "inches" },
      { width: 0, height: 75, depth: 60, unit: "cm" },
      { width: 101, height: 75, depth: 60, unit: "m" },
      { width: 120, height: 75, unit: "cm" },
    ])
      expect(validateCategoryAttributes(category, { dimensions }).ok).toBe(
        false,
      );
  });

  it("uses bounded decimal strings and explicit units rather than coercion or float money", () => {
    const category = "cat:garden-diy/hand-tools";
    expect(
      validateCategoryAttributes(category, {
        weight: { value: "12.34", unit: "kg" },
      }).ok,
    ).toBe(true);
    for (const value of [
      "12.345",
      "01.00",
      "1e3",
      "-1",
      "0",
      "10000.01",
      "9007199254740999999",
    ])
      expect(
        validateCategoryAttributes(category, { weight: { value, unit: "kg" } })
          .ok,
      ).toBe(false);
    expect(
      validateCategoryAttributes(category, {
        weight: { value: 12.34, unit: "kg" },
      }).ok,
    ).toBe(false);
    expect(
      validateCategoryAttributes(category, {
        weight: { value: "12.34", unit: "g" },
      }).ok,
    ).toBe(false);
  });

  it("bounds text, choices and multi-select values and rejects impossible dates", () => {
    const audio = "cat:electronics/headphones";
    const attributes = {
      brand: "Sony",
      model: "Model",
      workingStatus: "working",
    };
    expect(
      validateCategoryAttributes(audio, {
        ...attributes,
        includedAccessories: ["cable", "case"],
      }).ok,
    ).toBe(true);
    expect(
      validateCategoryAttributes(audio, {
        ...attributes,
        includedAccessories: ["case", "case"],
      }).ok,
    ).toBe(false);
    expect(
      validateCategoryAttributes(audio, {
        ...attributes,
        includedAccessories: ["account"],
      }).ok,
    ).toBe(false);
    expect(
      validateCategoryAttributes(audio, {
        ...attributes,
        model: "x".repeat(201),
      }).ok,
    ).toBe(false);
    const beauty = "cat:beauty-care/sealed-makeup";
    const product = { brand: "Brand", productType: "Makeup", sealed: true };
    expect(
      validateCategoryAttributes(beauty, {
        ...product,
        expiryDate: "2027-02-28",
      }).ok,
    ).toBe(true);
    expect(
      validateCategoryAttributes(beauty, {
        ...product,
        expiryDate: "2027-02-30",
      }).ok,
    ).toBe(false);
  });

  it("requires an explicit fitment source and ordered years without inferring compatibility", () => {
    const category = "cat:motors-parts/car-parts";
    const attributes = {
      partNumber: "ABC-12",
      vehicleMake: "Toyota",
      yearFrom: 2015,
      yearTo: 2020,
      fitmentSource: "seller_declared",
    };
    expect(validateCategoryAttributes(category, attributes).ok).toBe(true);
    expect(
      validateCategoryAttributes(category, { ...attributes, yearTo: 2010 }).ok,
    ).toBe(false);
    expect(
      validateCategoryAttributes(category, {
        ...attributes,
        fitmentSource: undefined,
      }).ok,
    ).toBe(false);
    expect(
      validateCategoryAttributes(category, {
        ...attributes,
        fitmentSource: "AI_guess",
      }).ok,
    ).toBe(false);
  });
});
