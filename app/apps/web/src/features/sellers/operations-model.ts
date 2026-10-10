import type { SellerContext } from "./persistence.server";

export const OPERATION_COUNT_LIMIT = 1000;
export type OperationKind =
  | "drafts"
  | "withdrawn"
  | "restricted"
  | "published"
  | "photos"
  | "stock"
  | "offers"
  | "imports"
  | "orders"
  | "fulfilment"
  | "payments";
export type OperationCount = {
  kind: OperationKind;
  count: number;
  hasMore: boolean;
};
export type SellerOperationsView = {
  sellerId: string;
  observedAt: string;
  counts: OperationCount[];
  milestones: { kind: "product" | "photo" | "publication" | "order"; complete: boolean }[];
};

/** Visibility only. The server reauthorizes before selecting any source. */
export function permittedOperations(
  seller: Pick<SellerContext, "kind" | "capabilities">,
): OperationKind[] {
  const has = (capability: SellerContext["capabilities"][number]) =>
    seller.capabilities.includes(capability);
  const result: OperationKind[] = [];
  if (has("listing.read")) result.push("drafts", "withdrawn", "restricted", "published", "photos", "stock");
  if (has("inbox.read")) result.push("offers");
  if (seller.kind === "business" && has("import.run") && has("listing.read"))
    result.push("imports");
  if (has("order.read")) result.push("orders", "fulfilment", "payments");
  return result;
}

export function operationCount(kind: OperationKind, value: number): OperationCount {
  if (!Number.isSafeInteger(value) || value < 0 || value > OPERATION_COUNT_LIMIT + 1)
    throw new Error("Invalid seller operation count");
  return { kind, count: Math.min(value, OPERATION_COUNT_LIMIT), hasMore: value > OPERATION_COUNT_LIMIT };
}

export function operationDestination(sellerId: string, kind: OperationKind): string {
  const base = `/app/sellers/${sellerId}`;
  switch (kind) {
    case "drafts": return `${base}/listings?status=draft`;
    case "withdrawn": return `${base}/listings?status=withdrawn`;
    case "restricted": return `${base}/listings?status=restricted`;
    case "published": return `${base}/listings?status=published`;
    case "photos": return `${base}/listings`;
    case "stock": return `${base}/inventory`;
    case "offers": return `${base}/inbox`;
    case "imports": return `${base}/imports`;
    case "orders": return `${base}/orders`;
    case "fulfilment": return `${base}/orders?queue=fulfilment`;
    case "payments": return `${base}/orders?queue=financial`;
  }
}
