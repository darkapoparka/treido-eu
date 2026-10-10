import { parseMoney, type Discount, type StoreState } from "./model";

export const discountEligibilityOptions = [
  ["All customers", "Всички клиенти"],
  ["Markets", "Пазари"],
  ["Specific customer segments", "Клиентски сегменти"],
  ["Specific customers", "Конкретни клиенти"],
] as const;

export function discountEligibilityItems(store: StoreState, kind: string) {
  if (kind === "Markets")
    return store.markets.map((item) => ({ id: item.id, title: item.title }));
  if (kind === "Specific customer segments")
    return store.entries
      .filter((item) => item.type === "Segment")
      .map((item) => ({ id: item.id, title: item.title }));
  if (kind === "Specific customers")
    return store.customers.map((item) => ({
      id: item.id,
      title: `${item.first} ${item.last}`.trim(),
    }));
  return [];
}

export function validDiscountBuyRequirement(discount: Discount) {
  if (discount.buyMinimumKind === "Amount") {
    const minor =
      discount.buyMinimumAmountMinor ??
      parseMoney(String(discount.buyMinimumAmount ?? 0));
    return (
      minor !== null &&
      Number.isSafeInteger(minor) &&
      minor > 0 &&
      minor <= 100000000
    );
  }
  return (
    Number.isInteger(discount.buyQuantity) &&
    discount.buyQuantity >= 1 &&
    discount.buyQuantity <= 999
  );
}

/** Checks fictional selected-store references only; this never grants checkout eligibility. */
export function validDiscountPlanningTargets(
  discount: Discount,
  store: StoreState,
) {
  if (
    discount.valueMode === "Free" &&
    (discount.type !== "Buy X get Y" || discount.value !== 0)
  )
    return false;
  if (discount.type === "Buy X get Y") {
    if (
      discount.valueMode === "Percentage" &&
      (!Number.isFinite(discount.value) ||
        discount.value <= 0 ||
        discount.value > 100)
    )
      return false;
    if (
      discount.valueMode === "Fixed amount" &&
      discount.getValueMinor !== undefined &&
      (!Number.isSafeInteger(discount.getValueMinor) ||
        discount.getValueMinor <= 0 ||
        discount.getValueMinor > 100000000)
    )
      return false;
    if (
      discount.buyMinimumKind === "Amount" &&
      discount.buyMinimumAmountMinor !== undefined &&
      (!Number.isSafeInteger(discount.buyMinimumAmountMinor) ||
        discount.buyMinimumAmountMinor <= 0 ||
        discount.buyMinimumAmountMinor > 100000000)
    )
      return false;
  }
  if (
    discount.maximumPerOrderEnabled &&
    (!Number.isSafeInteger(discount.maximumPerOrder) ||
      (discount.maximumPerOrder ?? 0) < 1 ||
      (discount.maximumPerOrder ?? 0) > 999999)
  )
    return false;
  if (discount.eligibility === "All customers")
    return !discount.eligibilityIds?.length;
  const items = discountEligibilityItems(store, discount.eligibility);
  const ids = discount.eligibilityIds;
  if (!ids)
    return store.entries.some(
      (item) => item.type === "Segment" && item.title === discount.eligibility,
    );
  return (
    ids.length > 0 &&
    ids.length <= 100 &&
    new Set(ids).size === ids.length &&
    ids.every((id) => items.some((item) => item.id === id))
  );
}
