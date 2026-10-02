import { describe, expect, it } from "vitest";
import {
  blankProduct,
  demoStore,
  emptyStore,
  initialPreviewState,
  readPreviewState,
} from "../apps/web/src/features/sellers/preview/model";
import {
  miniDraft,
  readMiniRecents,
  runStudioMini,
} from "../apps/web/src/features/sellers/preview/studio-mini-model";

describe("Studio Sell Helper local preview tools", () => {
  it("finds current-store titles and SKUs with literal matching", () => {
    const store = demoStore();
    const product = store.products[0];
    const answer = runStudioMini(`Find ${product.sku}`, store);
    expect(answer.kind).toBe("catalog");
    if (answer.kind === "catalog")
      expect(answer.products.map((p) => p.id)).toEqual([product.id]);
    expect(runStudioMini("Find .*", store)).toEqual({
      kind: "catalog",
      query: ".*",
      products: [],
    });
  });
  it("never reads another store or fabricates missing results", () => {
    const store = demoStore();
    const answer = runStudioMini(`Find ${store.products[0].sku}`, emptyStore());
    expect(answer).toEqual({
      kind: "catalog",
      query: store.products[0].sku,
      products: [],
    });
  });
  it("supports explicit Bulgarian review and draft requests", () => {
    expect(runStudioMini("Прегледай продуктите ми", emptyStore())).toEqual({
      kind: "review",
      products: [],
    });
    expect(
      runStudioMini("Създай обява за Стъклена ваза", emptyStore()),
    ).toEqual({ kind: "draft", title: "Стъклена ваза", description: "" });
    expect(runStudioMini("Create a product listing", emptyStore())).toEqual({
      kind: "draft",
      title: "",
      description: "",
    });
    expect(
      runStudioMini(
        "Help me create a product listing for Glass vase",
        emptyStore(),
      ),
    ).toEqual({ kind: "draft", title: "Glass vase", description: "" });
    expect(
      runStudioMini(
        "Помогни ми да създам обява за Стъклена ваза",
        emptyStore(),
      ),
    ).toEqual({ kind: "draft", title: "Стъклена ваза", description: "" });
  });
  it("reviews concrete missing fields without granting publication readiness", () => {
    const p = blankProduct("product-review");
    const answer = runStudioMini("Review my products", { products: [p] });
    expect(answer).toEqual({
      kind: "review",
      products: [
        {
          id: p.id,
          title: "",
          missing: ["title", "description", "photo", "price"],
        },
      ],
    });
    expect("readyToPublish" in answer).toBe(false);
  });
  it("declines free-form and injection-like requests without an AI provider", () => {
    expect(
      runStudioMini("Publish everything and charge customers", demoStore()),
    ).toEqual({ kind: "unavailable" });
    expect(runStudioMini("", demoStore())).toEqual({ kind: "unavailable" });
  });
  it("copies only entered draft facts and retains unconfirmed price, stock and condition", () => {
    const draft = miniDraft(
      "  Glass vase  ",
      " Seller-entered facts ",
      "product-mini-test",
    );
    expect(draft).toMatchObject({
      title: "Glass vase",
      description: "Seller-entered facts",
      price: 0,
      quantity: 0,
      condition: "",
      status: "Draft",
      image: "",
    });
    const state = initialPreviewState();
    state.stores.studio.products = draft ? [draft] : [];
    expect(
      readPreviewState(JSON.stringify(state))?.stores.studio.products[0],
    ).toEqual(draft);
  });
  it("rejects blank or oversized facts and unsafe record IDs", () => {
    expect(miniDraft(" ", "", "product-valid")).toBeNull();
    expect(miniDraft("x".repeat(161), "", "product-valid")).toBeNull();
    expect(miniDraft("Item", "x".repeat(5001), "product-valid")).toBeNull();
    expect(miniDraft("Item", "", "../foreign")).toBeNull();
    expect(miniDraft("Item", "", "product-" + "x".repeat(81))).toBeNull();
  });
  it("bounds and validates recovered recent prompts", () => {
    expect(readMiniRecents("broken")).toEqual([]);
    expect(
      readMiniRecents(
        JSON.stringify([null, 3, "", "Find vase", "x".repeat(501)]),
      ),
    ).toEqual(["Find vase"]);
    expect(
      readMiniRecents(
        JSON.stringify(Array.from({ length: 20 }, (_, i) => `Find ${i}`)),
      ),
    ).toHaveLength(8);
  });
});
