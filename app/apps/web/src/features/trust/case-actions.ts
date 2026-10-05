"use server";
import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { libraryActorKey } from "../library/cursor.server";
import { SellerError, type SellerResult } from "../sellers/errors";
import { object } from "../purchase-reviews/model";
import { validId } from "../selling/draft-model";
import { readCaseContext } from "./case-context.server";
import { decideTrustCase } from "./case-commands.server";
import type { CaseContext, TrustCaseKind } from "./case-model";
function failure(error: unknown) {
  if (!(error instanceof SellerError))
    console.error("Treido case operation unavailable.");
  const code = error instanceof SellerError ? error.code : "NOT_AVAILABLE";
  return {
    ok: false as const,
    code,
    outcome: ["INVALID_INPUT", "CONFLICT", "QUOTA_EXCEEDED"].includes(code)
      ? ("rejected" as const)
      : ("unresolved" as const),
  };
}
export async function readTrustCaseContextAction(
  raw: unknown,
): Promise<SellerResult<CaseContext>> {
  try {
    const identity = await requireVerifiedIdentity();
    if (
      !object(raw) ||
      Object.keys(raw).some(
        (k) => !["actorKey", "kind", "caseId"].includes(k),
      ) ||
      !validId(raw.caseId) ||
      !["message_report", "appeal"].includes(String(raw.kind))
    )
      throw new SellerError("INVALID_INPUT");
    if (raw.actorKey !== libraryActorKey(identity))
      throw new SellerError("FORBIDDEN");
    return {
      ok: true,
      data: await readCaseContext(
        getDatabase(),
        identity,
        raw.kind as TrustCaseKind,
        raw.caseId,
      ),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function decideTrustCaseAction(raw: unknown) {
  try {
    const identity = await requireVerifiedIdentity();
    if (
      !object(raw) ||
      Object.keys(raw).some((k) => !["actorKey", "input"].includes(k))
    )
      throw new SellerError("INVALID_INPUT");
    if (raw.actorKey !== libraryActorKey(identity))
      throw new SellerError("FORBIDDEN");
    return {
      ok: true as const,
      data: await decideTrustCase(getDatabase(), identity, raw.input),
    };
  } catch (error) {
    return failure(error);
  }
}
