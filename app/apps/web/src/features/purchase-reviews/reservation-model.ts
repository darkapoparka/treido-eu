export type ReservationItem = {
  id: string;
  sellerId: string;
  sellerName: string;
  purpose: "offer" | "checkout";
  state: "active" | "released" | "expired" | "consumed" | "reconciliation";
  createdAt: string;
  expiresAt: string;
  threadId: string | null;
  offerId: string | null;
  offerRevision: number | null;
  canCancel: boolean;
  merchandiseMinor: number;
  lines: {
    listingId: string;
    skuId: string;
    title: string;
    options: Record<string, string>;
    quantity: number;
    unitPriceMinor: number;
  }[];
};
export type ReservationQueue = {
  actorKey: string;
  sellerId: string | null;
  items: ReservationItem[];
  nextBefore: string | null;
  activeCount: number;
  reconciliationCount: number;
};
