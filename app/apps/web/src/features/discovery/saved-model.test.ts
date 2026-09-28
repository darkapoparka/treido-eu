import { describe, expect, it } from "vitest";
import {
  COLLECTION_NAME_MAX_LENGTH,
  decodeSavedCollections,
  savedCollectionsReducer,
  type Collection,
  type SavedCollectionsState,
} from "./saved-model";

// Synthetic identities only; no reference photos or real account records.
const collection = (id: string, productIds: string[] = []): Collection => ({
  id,
  name: `Collection ${id}`,
  visibility: "Private",
  productIds,
});
const initial = (): SavedCollectionsState => ({
  saved: ["saved-product"],
  collections: [collection("first", ["saved-product"])],
});

describe("local Saved and collection membership", () => {
  it("keeps valid Saved state when an oversized create or rename is rejected", () => {
    const before = savedCollectionsReducer(initial(), {
      type: "update-collection",
      id: "first",
      value: { name: "My renamed collection", productIds: ["new-product"] },
    });
    const name = "x".repeat(COLLECTION_NAME_MAX_LENGTH + 1);
    for (const action of [
      {
        type: "create-collection",
        collection: { ...collection("second"), name },
      },
      { type: "update-collection", id: "first", value: { name } },
    ] as const) {
      const next = savedCollectionsReducer(before, action);
      expect(next).toBe(before);
      expect(decodeSavedCollections(JSON.stringify(next), initial())).toEqual(
        before,
      );
    }
  });

  it("round-trips collection names at the supported length boundary", () => {
    const name = "x".repeat(COLLECTION_NAME_MAX_LENGTH);
    const created = savedCollectionsReducer(initial(), {
      type: "create-collection",
      collection: { ...collection("second", ["new-product"]), name },
    });
    const renamed = savedCollectionsReducer(created, {
      type: "update-collection",
      id: "first",
      value: { name },
    });
    expect(renamed.collections.map((item) => item.name)).toEqual([name, name]);
    expect(decodeSavedCollections(JSON.stringify(renamed), initial())).toEqual(
      renamed,
    );
  });

  it("saves a product selected while creating a collection", () => {
    const next = savedCollectionsReducer(initial(), {
      type: "create-collection",
      collection: collection("second", ["new-product", "new-product"]),
    });
    expect(next.saved).toEqual(["saved-product", "new-product"]);
    expect(next.collections[1].productIds).toEqual(["new-product"]);
  });

  it("saves an item added from More ideas to an existing collection", () => {
    const next = savedCollectionsReducer(initial(), {
      type: "update-collection",
      id: "first",
      value: { productIds: ["saved-product", "idea-product"] },
    });
    expect(next.saved).toEqual(["saved-product", "idea-product"]);
    expect(next.collections[0].productIds).toEqual(next.saved);
  });

  it("keeps an item in Saved when its collection membership is removed", () => {
    const next = savedCollectionsReducer(initial(), {
      type: "update-collection",
      id: "first",
      value: { productIds: [] },
    });
    expect(next.saved).toEqual(["saved-product"]);
    expect(next.collections[0].productIds).toEqual([]);
  });

  it("keeps newly discovered products after their collection is deleted", () => {
    const added = savedCollectionsReducer(initial(), {
      type: "update-collection",
      id: "first",
      value: { productIds: ["saved-product", "idea-product"] },
    });
    const deleted = savedCollectionsReducer(added, {
      type: "delete-collection",
      id: "first",
    });
    expect(deleted.collections).toEqual([]);
    expect(deleted.saved).toEqual(["saved-product", "idea-product"]);
  });

  it("also retains collection-only items from an inconsistent local snapshot", () => {
    const next = savedCollectionsReducer(
      { saved: [], collections: [collection("first", ["legacy-product"])] },
      { type: "delete-collection", id: "first" },
    );
    expect(next.saved).toEqual(["legacy-product"]);
  });

  it("removes stale memberships when an item is unsaved globally", () => {
    const state: SavedCollectionsState = {
      saved: ["saved-product", "other-product"],
      collections: [
        collection("first", ["saved-product"]),
        collection("second", ["saved-product", "other-product"]),
      ],
    };
    const next = savedCollectionsReducer(state, {
      type: "toggle-saved",
      productId: "saved-product",
    });
    expect(next.saved).toEqual(["other-product"]);
    expect(next.collections.map((c) => c.productIds)).toEqual([
      [],
      ["other-product"],
    ]);
    // The previous render's snapshot must not be mutated.
    expect(state.collections[0].productIds).toEqual(["saved-product"]);
  });

  it("does not restore old collection memberships when saving an item again", () => {
    const unsaved = savedCollectionsReducer(initial(), {
      type: "toggle-saved",
      productId: "saved-product",
    });
    const saved = savedCollectionsReducer(unsaved, {
      type: "toggle-saved",
      productId: "saved-product",
    });
    expect(saved.saved).toEqual(["saved-product"]);
    expect(saved.collections[0].productIds).toEqual([]);
  });

  it("preserves order and other collections when updating a membership", () => {
    const state: SavedCollectionsState = {
      ...initial(),
      collections: [collection("first"), collection("second")],
    };
    const next = savedCollectionsReducer(state, {
      type: "update-collection",
      id: "first",
      value: { productIds: ["new-product", "new-product"] },
    });
    expect(next.saved).toEqual(["saved-product", "new-product"]);
    expect(next.collections[0].productIds).toEqual(["new-product"]);
    expect(next.collections[1]).toBe(state.collections[1]);
  });

  it("does not create ghost saved items for a missing collection", () => {
    const state = initial();
    expect(
      savedCollectionsReducer(state, {
        type: "update-collection",
        id: "missing",
        value: { productIds: ["ghost"] },
      }),
    ).toBe(state);
    expect(
      savedCollectionsReducer(state, {
        type: "delete-collection",
        id: "missing",
      }),
    ).toBe(state);
  });

  it("does not duplicate a collection identity", () => {
    const state = initial();
    expect(
      savedCollectionsReducer(state, {
        type: "create-collection",
        collection: collection("first", ["different-product"]),
      }),
    ).toBe(state);
  });

  it("preserves memberships through name and privacy changes", () => {
    const renamed = savedCollectionsReducer(initial(), {
      type: "update-collection",
      id: "first",
      value: { name: "Renamed", visibility: "Public" },
    });
    expect(renamed.collections[0]).toEqual({
      ...collection("first", ["saved-product"]),
      name: "Renamed",
      visibility: "Public",
    });
    expect(renamed.saved).toEqual(["saved-product"]);
  });
  it("keeps most-recent selection order distinct from global Saved order", () => {
    const created = savedCollectionsReducer(
      { saved: ["first", "second"], collections: [] },
      {
        type: "create-collection",
        collection: collection("picks"),
      },
    );
    const one = savedCollectionsReducer(created, {
      type: "update-collection",
      id: "picks",
      value: { productIds: ["first"] },
    });
    const two = savedCollectionsReducer(one, {
      type: "update-collection",
      id: "picks",
      value: { productIds: ["second", "first"] },
    });
    expect(two.collections[0].productIds).toEqual(["second", "first"]);
    expect(two.saved).toEqual(["first", "second"]);
    const deleted = savedCollectionsReducer(two, {
      type: "delete-collection",
      id: "picks",
    });
    expect(deleted.saved).toEqual(["first", "second"]);
    expect(deleted.collections).toEqual([]);
  });

  it("removes only the requested empty collection without changing existing selections", () => {
    const before = initial();
    const added = savedCollectionsReducer(before, {
      type: "create-collection",
      collection: collection("empty"),
    });
    const deleted = savedCollectionsReducer(added, {
      type: "delete-collection",
      id: "empty",
    });
    expect(deleted).toEqual(before);
    expect(deleted.collections[0]).toBe(before.collections[0]);
  });
});
