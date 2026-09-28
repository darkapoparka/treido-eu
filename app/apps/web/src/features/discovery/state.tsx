"use client";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Collection } from "./saved-model";
import { useSavedCollections } from "./saved-history";
import { useMiniHistory } from "./mini-history";
import { useCartHistory } from "./cart-history";
import type { CartLine } from "./cart-model";
export type { Collection } from "./saved-model";
export type { CartLine } from "./cart-model";
export type ViewedItem = {
  kind: "product" | "store";
  id: string;
  promotion?: string;
};
type State = {
  capturedSearchHistory: "photo" | null;
  recentActivity: "products" | "stores" | "minis" | null;
  viewedItems: ViewedItem[];
  viewedAnswers: "jeans"[];
  newlyViewedAnswers: "jeans"[];
  viewAnswer: (id: "jeans") => void;
  viewStore: (id: string) => void;
  removeViewed: (kind: ViewedItem["kind"], id: string) => void;
  reportedProducts: string[];
  reportProduct: (id: string) => void;
  saved: string[];
  viewedProducts: string[];
  viewProduct: (id: string) => void;
  visitedMinis: string[];
  visitMini: (id: string) => void;
  followed: string[];
  cart: CartLine[];
  later: CartLine[];
  moveToCart: (id: string, variantId: string, maximum?: number) => void;
  removeLater: (id: string, variantId: string) => void;
  collections: Collection[];
  toggleSaved: (id: string) => void;
  toggleFollow: (id: string) => void;
  add: (line: CartLine) => void;
  remove: (id: string, variantId: string) => void;
  setQuantity: (id: string, variantId: string, quantity: number) => void;
  saveForLater: (id: string, variantId: string) => void;
  createCollection: (name: string, productIds?: string[]) => string;
  updateCollection: (id: string, value: Partial<Collection>) => void;
  deleteCollection: (id: string) => void;
};
export type DiscoverySeed = Partial<
  Pick<
    State,
    | "capturedSearchHistory"
    | "recentActivity"
    | "viewedItems"
    | "viewedAnswers"
    | "viewedProducts"
    | "visitedMinis"
    | "reportedProducts"
    | "saved"
    | "collections"
    | "followed"
    | "cart"
    | "later"
  >
>;
const Context = createContext<State | null>(null);
export function DiscoveryProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial?: DiscoverySeed;
}) {
  const capturedSearchHistory = initial?.capturedSearchHistory ?? null;
  const [recentActivity, setRecentActivity] = useState<
    "products" | "stores" | "minis" | null
  >(initial?.recentActivity ?? null);
  // Frozen Home017 already contains these prior visits; subsequent visits use the same state.
  const [viewedProducts, setViewedProducts] = useState<string[]>(
    () => initial?.viewedProducts ?? ["cleo", "round-sunglasses", "u-see-me"],
  );
  const [viewedItems, setViewedItems] = useState<ViewedItem[]>(
    () =>
      initial?.viewedItems ??
      ["cleo", "round-sunglasses", "u-see-me"].map((id) => ({
        kind: "product" as const,
        id,
      })),
  );
  const [viewedAnswers, setViewedAnswers] = useState<"jeans"[]>(
    () => initial?.viewedAnswers ?? [],
  );
  const [newlyViewedAnswers, setNewlyViewedAnswers] = useState<"jeans"[]>([]);
  const viewAnswer = useCallback((id: "jeans") => {
    setNewlyViewedAnswers((answers) =>
      answers.includes(id) ? answers : [id, ...answers],
    );
    setViewedAnswers((answers) =>
      answers[0] === id
        ? answers
        : [id, ...answers.filter((answer) => answer !== id)],
    );
  }, []);
  const viewStore = useCallback((id: string) => {
    setRecentActivity("stores");
    setViewedItems((v) =>
      [
        { kind: "store" as const, id },
        ...v.filter((x) => x.kind !== "store" || x.id !== id),
      ].slice(0, 24),
    );
  }, []);
  const viewProduct = useCallback((id: string) => {
    setRecentActivity("products");
    setViewedProducts((v) => [id, ...v.filter((x) => x !== id)].slice(0, 12));
    setViewedItems((v) =>
      [
        { kind: "product" as const, id },
        ...v.filter((x) => x.kind !== "product" || x.id !== id),
      ].slice(0, 24),
    );
  }, []);
  const { visitedMinis, visitMini } = useMiniHistory(initial?.visitedMinis);
  const [reportedProducts, setReportedProducts] = useState<string[]>(
    () => initial?.reportedProducts ?? [],
  );
  const [{ saved, collections }, dispatchSaved] = useSavedCollections({
    saved: initial?.saved ?? ["shea-butter", "rice-bundle"],
    collections: initial?.collections ?? [],
  });
  const [followed, setFollowed] = useState<string[]>(
    () => initial?.followed ?? [],
  );
  const [{ cart, later }, dispatchCart] = useCartHistory({
    cart: initial?.cart ?? [],
    later: initial?.later ?? [],
  });
  const toggle = (values: string[], id: string) =>
    values.includes(id) ? values.filter((v) => v !== id) : [...values, id];
  return (
    <Context
      value={{
        capturedSearchHistory,
        recentActivity,
        reportedProducts,
        reportProduct: (id) =>
          setReportedProducts((v) => (v.includes(id) ? v : [...v, id])),
        saved,
        viewedProducts,
        viewedItems,
        viewedAnswers,
        newlyViewedAnswers,
        viewAnswer,
        viewStore,
        removeViewed: (kind, id) => {
          setViewedItems((v) =>
            v.filter((x) => x.kind !== kind || x.id !== id),
          );
          if (kind === "product")
            setViewedProducts((v) => v.filter((x) => x !== id));
        },
        viewProduct,
        visitedMinis,
        visitMini: (id) => {
          setRecentActivity("minis");
          visitMini(id);
        },
        followed,
        cart,
        later,
        removeLater: (id, variantId) =>
          dispatchCart({ type: "remove-later", productId: id, variantId }),
        moveToCart: (id, variantId, maximum = 99) =>
          dispatchCart({
            type: "move-to-cart",
            productId: id,
            variantId,
            maximum,
          }),
        collections,
        toggleSaved: (productId) =>
          dispatchSaved({ type: "toggle-saved", productId }),
        toggleFollow: (id) => setFollowed((v) => toggle(v, id)),
        add: (line) => dispatchCart({ type: "add", line }),
        remove: (id, variantId) =>
          dispatchCart({ type: "remove", productId: id, variantId }),
        setQuantity: (id, variantId, quantity) =>
          dispatchCart({
            type: "quantity",
            productId: id,
            variantId,
            quantity,
          }),
        saveForLater: (id, variantId) =>
          dispatchCart({ type: "save-for-later", productId: id, variantId }),
        createCollection: (name, productIds = []) => {
          const id = crypto.randomUUID();
          dispatchSaved({
            type: "create-collection",
            collection: { id, name, visibility: "Private", productIds },
          });
          return id;
        },
        updateCollection: (id, value) =>
          dispatchSaved({ type: "update-collection", id, value }),
        deleteCollection: (id) =>
          dispatchSaved({ type: "delete-collection", id }),
      }}
    >
      {children}
    </Context>
  );
}
export function useDiscovery() {
  const state = useContext(Context);
  if (!state) throw new Error("DiscoveryProvider is missing");
  return state;
}
