export type CartLine = {
  productId: string;
  variantId: string;
  quantity: number;
};
export type CartState = { cart: CartLine[]; later: CartLine[] };
export type CartAction =
  | { type: "add"; line: CartLine }
  | {
      type: "remove" | "remove-later" | "save-for-later";
      productId: string;
      variantId: string;
    }
  | { type: "quantity"; productId: string; variantId: string; quantity: number }
  | {
      type: "move-to-cart";
      productId: string;
      variantId: string;
      maximum: number;
    };

const matches = (
  line: CartLine,
  target: Pick<CartLine, "productId" | "variantId">,
) => line.productId === target.productId && line.variantId === target.variantId;

export function cartReducer(state: CartState, action: CartAction): CartState {
  if (action.type === "add") {
    return {
      ...state,
      cart: [
        ...state.cart.filter((line) => !matches(line, action.line)),
        action.line,
      ],
    };
  }
  if (action.type === "remove") {
    return {
      ...state,
      cart: state.cart.filter((line) => !matches(line, action)),
    };
  }
  if (action.type === "remove-later") {
    return {
      ...state,
      later: state.later.filter((line) => !matches(line, action)),
    };
  }
  if (action.type === "quantity") {
    if (!Number.isFinite(action.quantity)) return state;
    return {
      ...state,
      cart: state.cart.map((line) =>
        matches(line, action)
          ? { ...line, quantity: Math.max(1, Math.floor(action.quantity)) }
          : line,
      ),
    };
  }
  if (action.type === "save-for-later") {
    const line = state.cart.find((item) => matches(item, action));
    if (!line) return state;
    return {
      cart: state.cart.filter((item) => !matches(item, action)),
      later: [...state.later.filter((item) => !matches(item, action)), line],
    };
  }
  if (action.type !== "move-to-cart") return state;
  const line = state.later.find((item) => matches(item, action));
  if (!line || !Number.isSafeInteger(action.maximum) || action.maximum <= 0)
    return state;
  const existing = state.cart.find((item) => matches(item, action));
  return {
    cart: [
      ...state.cart.filter((item) => !matches(item, action)),
      {
        ...line,
        quantity: Math.min(
          action.maximum,
          line.quantity + (existing?.quantity ?? 0),
        ),
      },
    ],
    later: state.later.filter((item) => !matches(item, action)),
  };
}

// Storage contains selections only. Prices, account data and payment outcomes
// remain outside this tab-local reference snapshot.
export function decodeCart(raw: string, fallback: CartState): CartState {
  try {
    if (raw.length > 65_536) return fallback;
    const value: unknown = JSON.parse(raw);
    if (
      !value ||
      typeof value !== "object" ||
      !("cart" in value) ||
      !("later" in value)
    )
      return fallback;
    function lines(input: unknown): CartLine[] | null {
      if (!Array.isArray(input) || input.length > 100) return null;
      const result: CartLine[] = [];
      const keys = new Set<string>();
      for (const item of input) {
        if (!item || typeof item !== "object") return null;
        const { productId, variantId, quantity } = item;
        if (
          typeof productId !== "string" ||
          !productId.trim() ||
          productId.length > 256 ||
          typeof variantId !== "string" ||
          !variantId.trim() ||
          variantId.length > 256 ||
          !Number.isSafeInteger(quantity) ||
          quantity <= 0
        )
          return null;
        const key = JSON.stringify([productId, variantId]);
        if (keys.has(key)) return null;
        keys.add(key);
        result.push({ productId, variantId, quantity });
      }
      return result;
    }
    const cart = lines(value.cart),
      later = lines(value.later);
    return cart && later ? { cart, later } : fallback;
  } catch {
    return fallback;
  }
}
