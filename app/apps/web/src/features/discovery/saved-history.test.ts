import { describe, expect, it } from "vitest";
import {
  decodeSavedCollections,
  type SavedCollectionsState,
} from "./saved-model";
const seed: SavedCollectionsState = { saved: ["first"], collections: [] };

describe("tab-local Saved snapshots", () => {
  it("restores collection membership and the saved union", () => {
    const collection = {
      id: "picks",
      name: "Favorites",
      visibility: "Private",
      productIds: ["second", "second"],
      collaborationPromptDismissed: true,
    };
    const raw = JSON.stringify({
      saved: ["first", "first"],
      collections: [collection],
    });
    expect(decodeSavedCollections(raw, seed)).toEqual({
      saved: ["first", "second"],
      collections: [{ ...collection, productIds: ["second"] }],
    });
  });
  it("keeps an intentionally empty library empty", () => {
    const empty = { saved: [], collections: [] };
    expect(decodeSavedCollections(JSON.stringify(empty), seed)).toEqual(empty);
  });
  it("falls back to the source seed for malformed storage", () => {
    expect(decodeSavedCollections("not a snapshot", seed)).toBe(seed);
    expect(decodeSavedCollections(JSON.stringify(null), seed)).toBe(seed);
    expect(
      decodeSavedCollections(
        JSON.stringify({ saved: [42], collections: [] }),
        seed,
      ),
    ).toBe(seed);
  });
});
