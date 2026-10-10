import { validId } from "../selling/draft-model";

export const CUSTOMER_PAGE_SIZE = 20;
export type CustomerQuery = { before: string | null };
export type SellerCustomer = {
  reference: string;
  orderCount: number;
  refundedOrders: number;
  financialFollowUp: number;
  firstOrderAt: string;
  lastOrderAt: string;
  lastOrderId: string;
};
export type SellerCustomersView = {
  sellerId: string;
  sellerName: string;
  actorKey: string;
  observedAt: string;
  customers: SellerCustomer[];
  nextBefore: string | null;
  query: CustomerQuery;
  canExport: boolean;
};
export function parseCustomerQuery(raw: Record<string, unknown>): CustomerQuery | null {
  if (Object.keys(raw).some((key) => !["lang", "before"].includes(key))) return null;
  if (raw.lang !== undefined && !["bg", "en"].includes(raw.lang as string)) return null;
  const before = raw.before ?? null;
  if (before !== null && !validId(before)) return null;
  return { before: typeof before === "string" ? before.toLowerCase() : null };
}
