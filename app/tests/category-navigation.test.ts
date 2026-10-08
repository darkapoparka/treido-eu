import { describe, expect, it } from "vitest";
import {
  categoryLeaves,
  browseCategories,
  browseCategoryRoots,
  getBrowseAncestry,
  getBrowseChildren,
  getBrowseLeafIds,
  getCategory,
  validateListingCategory,
} from "@treido/contracts/categories";
import { readDiscoveryInput } from "../apps/web/src/features/catalog/discovery-input";
import { readFileSync } from "node:fs";
import { buildCategoryNavigationMigration } from "../apps/web/src/server/categories/navigation-migration";

describe("versioned browse taxonomy", () => {
  it("assigns every existing publication leaf exactly once, with at most three levels", () => {
    expect(browseCategoryRoots).toHaveLength(17);
    const ids = browseCategoryRoots.flatMap((node) =>
      getBrowseLeafIds(node.id),
    );
    expect(new Set(ids).size).toBe(152);
    expect([...ids].sort()).toEqual(
      categoryLeaves.map((node) => node.id).sort(),
    );
    for (const node of browseCategories) {
      const path = getBrowseAncestry(node.id);
      expect(path.length).toBeLessThanOrEqual(3);
      expect(path[0].kind).toBe("root");
      expect(path.at(-1)).toBe(node);
      expect(node.labels.bg.trim()).not.toBe("");
      expect(node.labels.en.trim()).not.toBe("");
      if (node.kind !== "leaf")
        expect(getBrowseChildren(node.id).length).toBeGreaterThan(0);
    }
    expect(getBrowseLeafIds("unknown")).toEqual([]);
  });
  it("separates Garden from Tools without changing a persisted leaf or its approval", () => {
    const garden = getBrowseLeafIds("cat:garden");
    expect(garden).toHaveLength(4);
    expect(garden).toContain("cat:garden-diy/garden-tools");
    const tools = getBrowseLeafIds("cat:garden-diy");
    expect(tools).toHaveLength(7);
    expect(tools).toContain("cat:garden-diy/hand-tools");
    expect(tools.some((id) => garden.includes(id))).toBe(false);
    expect(getCategory("cat:garden-diy/garden-tools")?.parentId).toBe(
      "cat:garden-diy",
    );
    expect(
      getBrowseAncestry("cat:garden-diy/garden-tools").map((node) => node.id),
    ).toEqual(["cat:garden", "cat:garden-diy/garden-tools"]);
    expect(getCategory("cat:garden-diy/garden-tools")).toMatchObject({
      policy: { enabledForPublish: false },
    });
  });
  it("filters groups by real descendant IDs and keeps attributes exclusive to leaves", () => {
    const parsed = readDiscoveryInput({
      category: "nav:electronics/computers",
      seller: "business",
      "attr.storageGB": "128",
    });
    expect(parsed.input.category).toBe("nav:electronics/computers");
    expect(parsed.input.attributes).toEqual({});
    expect(
      readDiscoveryInput({ category: "nav:unknown/group" }).input.category,
    ).toBeNull();
    expect(
      validateListingCategory({
        taxonomyVersion: 1,
        categoryId: "nav:electronics/computers",
        sellerKind: "personal",
        country: "BG",
        condition: "good",
        attributes: {},
      }),
    ).toEqual({ ok: false, code: "UNKNOWN_CATEGORY" });
  });
  it("persists the same tree in an additive migration without rewriting category policy", () => {
    const sql = readFileSync(
      "apps/web/migrations/0053_category_navigation.sql",
      "utf8",
    ).replaceAll("\r\n", "\n");
    expect(sql).toBe(buildCategoryNavigationMigration());
    expect(sql).toContain(
      "REFERENCES treido.categories(registry_version,id,kind)",
    );
    expect(sql).not.toMatch(
      /UPDATE treido\.(categories|category_policies)|enabled_for_publish=true/,
    );
  });
});
