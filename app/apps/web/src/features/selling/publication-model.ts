import { getCategory } from "@treido/contracts/categories";
import { parseDraftPayload, validId, type DraftPayload } from "./draft-model";
import { reviewPreparation } from "./form-model";
import type { SellerReadiness } from "../sellers/readiness";

export type PublicationReview = {
  sellerId: string;
  listingId: string;
  revision: number;
  publication: "draft" | "published" | "withdrawn";
  title: string;
  fieldIssues: string[];
  readyPhotos: number;
  readiness: SellerReadiness;
  canWithdraw: boolean;
  canPublish: boolean;
  sellerKind: "personal" | "business";
  media: { id: string; revision: number }[];
};
export function publicationFieldIssues(payload: DraftPayload): string[] {
  if (!parseDraftPayload(payload)) return ["listing"];
  const issues: string[] = [];
  if (!payload.title.trim()) issues.push("title");
  if (!payload.description.trim()) issues.push("description");
  if (payload.priceMinor === null || payload.priceMinor < 1)
    issues.push("price");
  if (!payload.locality.trim()) issues.push("locality");
  const category = payload.categoryId ? getCategory(payload.categoryId) : null;
  if (category?.kind !== "leaf") issues.push("category");
  else
    issues.push(
      ...Object.keys(
        reviewPreparation(category, {
          condition: payload.condition,
          fields: payload.fields,
        }).errors,
      ).map((field) => `attribute:${field}`),
    );
  return issues;
}
export type WithdrawalInput = {
  sellerId: string;
  listingId: string;
  requestId: string;
  expectedRevision: number;
};
export function parseWithdrawalInput(value: unknown): WithdrawalInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).some(
      (key) =>
        !["sellerId", "listingId", "requestId", "expectedRevision"].includes(
          key,
        ),
    ) ||
    !validId(input.sellerId) ||
    !validId(input.listingId) ||
    !validId(input.requestId) ||
    !Number.isSafeInteger(input.expectedRevision) ||
    (input.expectedRevision as number) < 1 ||
    (input.expectedRevision as number) >= 2147483647
  )
    return null;
  return input as WithdrawalInput;
}
