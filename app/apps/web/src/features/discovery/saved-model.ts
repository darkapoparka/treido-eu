export const COLLECTION_NAME_MAX_LENGTH = 500;

export type Collection = {
  id: string;
  name: string;
  visibility: "Private" | "Public";
  productIds: string[];
  collaborationPromptDismissed?: boolean;
};

export type SavedCollectionsState = {
  saved: string[];
  collections: Collection[];
};

export type SavedCollectionsAction =
  | { type: "toggle-saved"; productId: string }
  | { type: "create-collection"; collection: Collection }
  | {
      type: "update-collection";
      id: string;
      value: Partial<Omit<Collection, "id">>;
    }
  | { type: "delete-collection"; id: string };

const unique = (ids: readonly string[]) => Array.from(new Set(ids));

// One local reference-state transition owns Saved and collection membership.
// Adding from More ideas or a product's collection picker must also save the
// item. Removing a membership does not unsave it; deleting a collection keeps
// its products in Saved, as the existing deletion UI promises. No persistence
// or authenticated account mutation is implied by this fixture reducer.
export function savedCollectionsReducer(
  state: SavedCollectionsState,
  action: SavedCollectionsAction,
): SavedCollectionsState {
  switch (action.type) {
    case "toggle-saved": {
      const id = action.productId;
      if (!state.saved.includes(id))
        return { ...state, saved: [...state.saved, id] };
      return {
        saved: state.saved.filter((productId) => productId !== id),
        collections: state.collections.map((collection) =>
          collection.productIds.includes(id)
            ? {
                ...collection,
                productIds: collection.productIds.filter(
                  (productId) => productId !== id,
                ),
              }
            : collection,
        ),
      };
    }
    case "create-collection": {
      if (action.collection.name.length > COLLECTION_NAME_MAX_LENGTH)
        return state;
      if (state.collections.some((c) => c.id === action.collection.id))
        return state;
      const collection = {
        ...action.collection,
        productIds: unique(action.collection.productIds),
      };
      return {
        saved: unique([...state.saved, ...collection.productIds]),
        collections: [...state.collections, collection],
      };
    }
    case "update-collection": {
      if (
        action.value.name !== undefined &&
        action.value.name.length > COLLECTION_NAME_MAX_LENGTH
      )
        return state;
      const existing = state.collections.find((c) => c.id === action.id);
      if (!existing) return state;
      const collection: Collection = {
        ...existing,
        ...action.value,
        id: existing.id,
        productIds: unique(action.value.productIds ?? existing.productIds),
      };
      return {
        saved: unique([...state.saved, ...collection.productIds]),
        collections: state.collections.map((c) =>
          c.id === action.id ? collection : c,
        ),
      };
    }
    case "delete-collection": {
      const existing = state.collections.find((c) => c.id === action.id);
      if (!existing) return state;
      return {
        saved: unique([...state.saved, ...existing.productIds]),
        collections: state.collections.filter((c) => c.id !== action.id),
      };
    }
  }
}

// Browser storage is untrusted. Invalid or oversized tab snapshots restore the
// explicit source seed instead of crashing or inventing collection membership.
export function decodeSavedCollections(
  raw: string,
  fallback: SavedCollectionsState,
): SavedCollectionsState {
  const ids = (value: unknown): value is string[] =>
    Array.isArray(value) &&
    value.length <= 2000 &&
    value.every(
      (id) => typeof id === "string" && id.length > 0 && id.length <= 200,
    );
  try {
    if (raw.length > 1_000_000) return fallback;
    const value: unknown = JSON.parse(raw);
    if (
      !value ||
      typeof value !== "object" ||
      !("saved" in value) ||
      !("collections" in value) ||
      !ids(value.saved) ||
      !Array.isArray(value.collections) ||
      value.collections.length > 500
    )
      return fallback;
    const collections: Collection[] = [];
    for (const item of value.collections) {
      if (
        !item ||
        typeof item !== "object" ||
        typeof item.id !== "string" ||
        !item.id ||
        item.id.length > 200 ||
        typeof item.name !== "string" ||
        item.name.length > COLLECTION_NAME_MAX_LENGTH ||
        !["Private", "Public"].includes(item.visibility) ||
        !ids(item.productIds) ||
        (item.collaborationPromptDismissed !== undefined &&
          typeof item.collaborationPromptDismissed !== "boolean")
      )
        return fallback;
      if (collections.some((collection) => collection.id === item.id))
        return fallback;
      collections.push({
        id: item.id,
        name: item.name,
        visibility: item.visibility,
        productIds: unique(item.productIds),
        ...(item.collaborationPromptDismissed === undefined
          ? {}
          : {
              collaborationPromptDismissed: item.collaborationPromptDismissed,
            }),
      });
    }
    return {
      saved: unique([
        ...value.saved,
        ...collections.flatMap((item) => item.productIds),
      ]),
      collections,
    };
  } catch {
    return fallback;
  }
}
