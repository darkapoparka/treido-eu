import { orderTotal, type StoreState } from "./model";
export const explorerMetrics = [
  {
    id: "orders",
    en: "Orders",
    bg: "Поръчки",
    category: "Orders",
    currency: false,
  },
  {
    id: "sales",
    en: "Total sales",
    bg: "Общи продажби",
    category: "Sales revenue",
    currency: true,
  },
  {
    id: "customers",
    en: "Customers",
    bg: "Клиенти",
    category: "Customers",
    currency: false,
  },
  {
    id: "inventory",
    en: "Available inventory",
    bg: "Налична стока",
    category: "Inventory",
    currency: false,
  },
] as const;
export type ExplorerMetric = (typeof explorerMetrics)[number]["id"];
export function localExplorationRows(
  store: StoreState,
  metrics: readonly ExplorerMetric[],
  start: string,
  end: string,
  dimension: "None" | "Date" | "Product" | "Customer",
) {
  const orders = store.orders.filter(
    (order) =>
      order.kind === "Order" &&
      order.fulfillment !== "Cancelled" &&
      (!start || order.date >= start) &&
      (!end || order.date <= end),
  );
  const row = (group?: { label: string; id: string }) => {
    const current = !group
      ? orders
      : dimension === "Date"
        ? orders.filter((order) => order.date === group.id)
        : dimension === "Customer"
          ? orders.filter(
              (order) => (order.customerId || "unknown") === group.id,
            )
          : orders.filter((order) =>
              order.lines.some((line) => line.productId === group.id),
            );
    const paid = current.filter((order) => order.payment !== "Pending");
    const values: Record<ExplorerMetric, number> = {
      orders: current.length,
      sales:
        dimension === "Product" && group
          ? paid
              .flatMap((order) => order.lines)
              .filter((line) => line.productId === group.id)
              .reduce((sum, line) => sum + line.price * line.quantity, 0)
          : paid.reduce(
              (sum, order) =>
                sum + Math.max(0, orderTotal(order) - order.refunded),
              0,
            ),
      customers:
        dimension === "Customer" && group
          ? Number(store.customers.some((customer) => customer.id === group.id))
          : store.customers.length,
      inventory: store.products
        .filter(
          (product) =>
            product.status !== "Archived" && product.trackInventory !== false,
        )
        .filter(
          (product) =>
            dimension !== "Product" || !group || product.id === group.id,
        )
        .reduce((sum, product) => sum + product.quantity, 0),
    };
    return {
      id: group?.id ?? "total",
      label: group?.label ?? "Total",
      values: metrics.map((metric) => values[metric]),
    };
  };
  if (dimension === "Date")
    return [...new Set(orders.map((order) => order.date))]
      .sort()
      .map((date) => row({ id: date, label: date }));
  if (dimension === "Product")
    return [
      ...new Set([
        ...store.products
          .filter(
            (product) =>
              metrics.some((metric) => metric !== "inventory") ||
              product.status !== "Archived",
          )
          .map((product) => product.id),
        ...(metrics.some((metric) => metric !== "inventory")
          ? orders.flatMap((order) => order.lines.map((line) => line.productId))
          : []),
      ]),
    ].map((id) =>
      row({
        id,
        label:
          store.products.find((product) => product.id === id)?.title ??
          "Unavailable product",
      }),
    );
  if (dimension === "Customer")
    return [
      ...new Set([
        ...store.customers.map((customer) => customer.id),
        ...orders.map((order) => order.customerId || "unknown"),
      ]),
    ].map((id) => {
      const customer = store.customers.find((value) => value.id === id);
      return row({
        id,
        label: customer
          ? `${customer.first} ${customer.last}`.trim() || customer.email
          : "Unknown customer",
      });
    });
  return [row()];
}
