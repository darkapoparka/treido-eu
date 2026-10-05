"use server";
import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import {
  SellerError,
  type SellerResult,
  type SellerErrorCode,
} from "../sellers/errors";
import { libraryActorKey } from "../library/cursor.server";
import { validId } from "../selling/draft-model";
import { object } from "../purchase-reviews/model";
import { changeInquiry } from "./commands.server";
import { readInquiryDetail } from "./queries.server";
import {
  inquiryWorkflowView,
  type InquiryWorkflowView,
} from "./workflow-model";
import type { InquiryResult } from "./model";

export async function changeInquiryAction(
  input: unknown,
): Promise<
  | { ok: true; data: InquiryResult }
  | { ok: false; code: SellerErrorCode; outcome: "rejected" | "unresolved" }
> {
  try {
    return {
      ok: true,
      data: await changeInquiry(
        getDatabase(),
        await requireVerifiedIdentity(),
        input,
      ),
    };
  } catch (error) {
    if (!(error instanceof SellerError))
      console.error("Treido inquiry operation unavailable.");
    const code = error instanceof SellerError ? error.code : "NOT_AVAILABLE";
    return {
      ok: false,
      code,
      // Lost authority or infrastructure cannot disprove an earlier commit.
      outcome: ["INVALID_INPUT", "CONFLICT", "QUOTA_EXCEEDED"].includes(code)
        ? "rejected"
        : "unresolved",
    };
  }
}

export async function readInquiryWorkflowAction(
  input: unknown,
): Promise<SellerResult<InquiryWorkflowView>> {
  try {
    if (
      !object(input) ||
      Object.keys(input).some(
        (key) => !["actorKey", "sellerId", "reviewId"].includes(key),
      ) ||
      !validId(input.sellerId) ||
      !validId(input.reviewId)
    )
      throw new SellerError("INVALID_INPUT");
    const identity = await requireVerifiedIdentity();
    if (input.actorKey !== libraryActorKey(identity))
      throw new SellerError("FORBIDDEN");
    const detail = await readInquiryDetail(
      getDatabase(),
      identity,
      input.sellerId as string,
      input.reviewId as string,
    );
    return { ok: true, data: inquiryWorkflowView(detail) };
  } catch (error) {
    if (!(error instanceof SellerError))
      console.error("Treido inquiry workflow read unavailable.");
    return {
      ok: false,
      code: error instanceof SellerError ? error.code : "NOT_AVAILABLE",
    };
  }
}
