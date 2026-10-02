import { describe, expect, it } from "vitest";
import {
  demoStore,
  emptyStore,
} from "../apps/web/src/features/sellers/preview/model";
import {
  previewSearchItems,
  searchPreviewItems,
} from "../apps/web/src/features/sellers/preview/search-model";
import {
  parsePreviewRoute,
  previewHref,
} from "../apps/web/src/features/sellers/preview/routes";

describe("merchant preview search", () => {
  it("starts with an idle hint and browses only the chosen category", () => {
    const items = previewSearchItems(demoStore(), "en");
    expect(searchPreviewItems(items, "  ")).toEqual([]);
    const products = searchPreviewItems(items, "", "products");
    expect(products.map((item) => item.destination)).toEqual([
      "products/linen-shirt",
      "products/glass-vase",
      "products/headphones",
    ]);
    expect(products.some((item) => item.description.includes("Draft"))).toBe(
      true,
    );
  });
  it("finds case-insensitive SKU and all search terms", () => {
    const items = previewSearchItems(demoStore(), "en");
    expect(
      searchPreviewItems(items, "lin 001", "products").map(
        (item) => item.title,
      ),
    ).toEqual(["Linen everyday shirt"]);
    expect(searchPreviewItems(items, "LIN-001", "products")).toHaveLength(1);
    expect(
      searchPreviewItems(items, "linen missingword", "products"),
    ).toHaveLength(0);
  });
  it("uses literal punctuation instead of wildcard or regular-expression matching", () => {
    const store = demoStore();
    store.products[0].title = "100%_ cotton [limited]";
    const items = previewSearchItems(store, "en");
    expect(searchPreviewItems(items, "100%_", "products")).toHaveLength(1);
    expect(searchPreviewItems(items, "[limited]", "products")).toHaveLength(1);
    expect(searchPreviewItems(items, ".*", "products")).toEqual([]);
    expect(searchPreviewItems(items, "[", "products")).toHaveLength(1);
  });
  it("normalizes full-width text for catalog searches", () => {
    const items = previewSearchItems(demoStore(), "en");
    expect(
      searchPreviewItems(items, "ＬＩＮ－００１", "products"),
    ).toHaveLength(1);
  });
  it("ranks an exact page title ahead of partial matches", () => {
    const items = previewSearchItems(demoStore(), "en");
    const found = searchPreviewItems(items, "products");
    expect(found[0].title).toBe("Products");
    expect(found[0].destination).toBe("products");
  });
  it("does not expose records from the other selected store", () => {
    const studio = previewSearchItems(demoStore(), "en");
    const personal = previewSearchItems(emptyStore(), "en");
    expect(searchPreviewItems(studio, "linen")).toHaveLength(1);
    expect(searchPreviewItems(personal, "linen")).toEqual([]);
    expect(searchPreviewItems(personal, "", "products")).toEqual([]);
  });
  it("finds customers by email and routes drafts to their own editor", () => {
    const store = demoStore();
    store.orders[0].kind = "Draft";
    const items = previewSearchItems(store, "en");
    expect(
      searchPreviewItems(items, "alex@example.com", "customers")[0].destination,
    ).toBe("customers/alex");
    expect(
      searchPreviewItems(items, store.orders[0].id, "orders")[0].destination,
    ).toBe(`drafts/${store.orders[0].id}`);
  });
  it("finds Bulgarian pages and settings by localized or English terms", () => {
    const items = previewSearchItems(emptyStore(), "bg");
    expect(searchPreviewItems(items, "продукти")[0].title).toBe("Продукти");
    expect(searchPreviewItems(items, "shipping", "settings")[0].title).toBe(
      "Доставка",
    );
    expect(
      searchPreviewItems(items, "доставка", "settings")[0].destination,
    ).toBe("settings/shipping");
  });
  it("keeps all result destinations finite and in the selected preview context", () => {
    const store = demoStore();
    store.products[0].id = "https://example.com/escape";
    const items = previewSearchItems(store, "en");
    expect(items.some((item) => item.destination.includes("example.com"))).toBe(
      false,
    );
    for (const item of items) {
      expect(parsePreviewRoute(item.destination.split("/"))).not.toBeNull();
      expect(previewHref(item.destination, "bg", "personal")).toMatch(
        /^\/admin-preview(?:\/|\?)/,
      );
      expect(previewHref(item.destination, "bg", "personal")).toContain(
        "lang=bg&store=personal",
      );
    }
  });
  it("does not search or return uploaded file bodies and customer notes", () => {
    const store = demoStore();
    store.customers[0].notes = "unrelated-private-note";
    store.entries.push({
      id: "file",
      title: "Invoice",
      body: "data:application/pdf;base64,JVBERi0=",
      type: "File",
      status: "Saved",
      tags: "Paperwork",
    });
    const items = previewSearchItems(store, "en");
    expect(searchPreviewItems(items, "unrelated-private-note")).toEqual([]);
    expect(searchPreviewItems(items, "JVBERi0")).toEqual([]);
    expect(searchPreviewItems(items, "Invoice", "content")[0].destination).toBe(
      "files/file",
    );
  });
});
