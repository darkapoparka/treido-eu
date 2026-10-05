export type FeedbackView = {
  actorKey: string;
  actorSubject: string;
  orderId: string;
  sellerName: string;
  orderRevision: number;
  available: boolean;
  eligible: boolean;
  eligibility: "eligible" | "incomplete" | "policy_unavailable";
  policy: {
    id: string;
    version: number;
    termsHash: string;
    terms: string;
    retentionDescription: string;
  } | null;
  feedback: {
    id: string;
    rating: number;
    body: string;
    state: "pending" | "published" | "hidden";
    revision: number;
    createdAt: string;
    reason: string | null;
  } | null;
  language: "bg" | "en";
};
export type PublicPurchaseFeedback = {
  id: string;
  rating: number;
  body: string;
  publishedAt: string;
  verification: "completed_order";
  reviewer: "anonymous_buyer";
};
export type FeedbackOwnExport = {
  feedback: {
    id: string;
    orderId: string;
    rating: number;
    state: string;
    revision: number;
    createdAt: string;
  }[];
  receipts: {
    requestId: string;
    feedbackId: string;
    acceptedRevision: number;
    createdAt: string;
  }[];
  more: boolean;
};
