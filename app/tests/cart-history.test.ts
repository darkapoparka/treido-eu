import { describe, expect, it } from "vitest";
import {
  cartReducer,
  decodeCart,
  type CartState,
} from "../apps/web/src/features/discovery/cart-model";

const bag = {
  productId: "shampoo-bag",
  variantId: "shampoo-bag-default",
  quantity: 2,
};
const seed: CartState = { cart: [bag], later: [] };

describe("tab-local cart selections", () => {
  it("preserves an intentionally empty cart instead of resurrecting the seed", () => {
    expect(decodeCart('{"cart":[],"later":[]}', seed)).toEqual({
      cart: [],
      later: [],
    });
  });

  it("retains variant and quantity while discarding untrusted monetary/provider fields", () => {
    expect(
      decodeCart(
        JSON.stringify({
          cart: [{ ...bag, price: 1, paid: true }],
          later: [],
          total: 1,
        }),
        seed,
      ),
    ).toEqual(seed);
  });

  it.each([
    "{",
    JSON.stringify({ cart: [bag, bag], later: [] }),
    JSON.stringify({ cart: [{ ...bag, quantity: -1 }], later: [] }),
    JSON.stringify({ cart: [{ ...bag, quantity: 1.5 }], later: [] }),
    JSON.stringify({
      cart: [{ ...bag, quantity: Number.MAX_SAFE_INTEGER + 1 }],
      later: [],
    }),
    JSON.stringify({ cart: [{ ...bag, variantId: "" }], later: [] }),
    JSON.stringify({ cart: [], later: "invalid" }),
    " ".repeat(65_537),
  ])("recovers the explicit seed from an invalid snapshot", (raw) => {
    expect(decodeCart(raw, seed)).toBe(seed);
  });

  it("moves a selection atomically and merges the same variant within current availability", () => {
    const saved = cartReducer(seed, { type: "save-for-later", ...bag });
    expect(saved).toEqual({ cart: [], later: [bag] });
    const withAnother = cartReducer(saved, {
      type: "add",
      line: { ...bag, quantity: 3 },
    });
    expect(
      cartReducer(withAnother, { type: "move-to-cart", ...bag, maximum: 4 }),
    ).toEqual({ cart: [{ ...bag, quantity: 4 }], later: [] });
    expect(
      cartReducer(saved, { type: "move-to-cart", ...bag, maximum: 0 }),
    ).toEqual(saved);
  });

  it("does not merge different variants or re-add a removed selection", () => {
    const other = { ...bag, variantId: "another-variant" };
    const state = cartReducer(seed, { type: "add", line: other });
    expect(cartReducer(state, { type: "remove", ...bag }).cart).toEqual([
      other,
    ]);
    expect(
      cartReducer(seed, { type: "quantity", ...bag, quantity: Number.NaN }),
    ).toEqual(seed);
  });
});
