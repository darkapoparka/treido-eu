import type { Customer, StoreState } from "./model";
export const segmentConditions = [
  "All customers",
  "Email subscribers",
  "Returning customers",
  "Bulgaria",
  "Greece",
  "Romania",
] as const;
export function customerMatchesSegment(
  store: Pick<StoreState, "orders">,
  customer: Customer,
  condition: string,
) {
  if (condition === "All customers") return true;
  if (condition === "Email subscribers") return customer.marketing;
  if (condition === "Returning customers")
    return (
      store.orders.filter(
        (order) =>
          order.kind === "Order" &&
          order.fulfillment !== "Cancelled" &&
          order.customerId === customer.id,
      ).length > 1
    );
  return (
    ["Bulgaria", "Greece", "Romania"].includes(condition) &&
    customer.country === condition
  );
}
