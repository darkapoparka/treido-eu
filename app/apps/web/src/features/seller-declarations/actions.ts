"use server";
import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { libraryActorKey } from "../library/cursor.server";
import { SellerError, type SellerResult } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import {
  record,
  type DeclarationReviewAcknowledgement,
  type DeclarationReviewView,
} from "./model";
import {
  readDeclarationReview,
  reviewSellerDeclaration,
} from "./persistence.server";

function failure(error: unknown) {
  if (!(error instanceof SellerError))
    console.error("Treido declaration review unavailable.");
  return {
    ok: false as const,
    code:
      error instanceof SellerError ? error.code : ("NOT_AVAILABLE" as const),
  };
}
export async function readDeclarationReviewAction(
  raw: unknown,
): Promise<SellerResult<DeclarationReviewView>> {
  try {
    const identity = await requireVerifiedIdentity();
    if (
      !record(raw) ||
      Object.keys(raw).length !== 2 ||
      Object.keys(raw).some(
        (key) => !["actorKey", "declarationId"].includes(key),
      ) ||
      !validId(raw.declarationId)
    )
      throw new SellerError("INVALID_INPUT");
    if (raw.actorKey !== libraryActorKey(identity))
      throw new SellerError("FORBIDDEN");
    return {
      ok: true,
      data: await readDeclarationReview(
        getDatabase(),
        identity,
        raw.declarationId,
      ),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function reviewSellerDeclarationAction(
  raw: unknown,
): Promise<SellerResult<DeclarationReviewAcknowledgement>> {
  try {
    const identity = await requireVerifiedIdentity();
    if (
      !record(raw) ||
      Object.keys(raw).length !== 2 ||
      Object.keys(raw).some((key) => !["actorKey", "input"].includes(key))
    )
      throw new SellerError("INVALID_INPUT");
    if (raw.actorKey !== libraryActorKey(identity))
      throw new SellerError("FORBIDDEN");
    return {
      ok: true,
      data: await reviewSellerDeclaration(getDatabase(), identity, raw.input),
    };
  } catch (error) {
    return failure(error);
  }
}
