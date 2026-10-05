"use server";
import { authorizeOperator } from "./reports.server";
import { getDatabase, inTransaction } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { libraryActorKey } from "../library/cursor.server";
import { SellerError, type SellerResult } from "../sellers/errors";
import { object } from "../purchase-reviews/model";
import { validId } from "../selling/draft-model";
import { moderateListing } from "./moderation.server";
import { parseModerationInput } from "./moderation-model";
import { readOperationContext } from "./operations-context.server";
import type { ModerationContext } from "./operations-model";
function failure(error: unknown) {
  if (!(error instanceof SellerError))
    console.error("Treido moderation operation unavailable.");
  const code = error instanceof SellerError ? error.code : "NOT_AVAILABLE";
  return {
    ok: false as const,
    code,
    outcome: ["INVALID_INPUT", "CONFLICT", "QUOTA_EXCEEDED"].includes(code)
      ? ("rejected" as const)
      : ("unresolved" as const),
  };
}
export async function readModerationContextAction(
  raw: unknown,
): Promise<SellerResult<ModerationContext>> {
  try {
    const identity = await requireVerifiedIdentity();
    if (
      !object(raw) ||
      Object.keys(raw).some(
        (k) => !["actorKey", "listingId", "reportId"].includes(k),
      ) ||
      !validId(raw.listingId) ||
      (raw.reportId !== null && !validId(raw.reportId))
    )
      throw new SellerError("INVALID_INPUT");
    if (raw.actorKey !== libraryActorKey(identity))
      throw new SellerError("FORBIDDEN");
    return {
      ok: true,
      data: await readOperationContext(
        getDatabase(),
        identity,
        raw.listingId,
        raw.reportId as string | null,
      ),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function changeModerationOperationAction(raw: unknown) {
  try {
    const identity = await requireVerifiedIdentity();
    if (
      !object(raw) ||
      Object.keys(raw).some((k) => !["actorKey", "input"].includes(k))
    )
      throw new SellerError("INVALID_INPUT");
    if (raw.actorKey !== libraryActorKey(identity))
      throw new SellerError("FORBIDDEN");
    const input = parseModerationInput(raw.input);
    if (!input) throw new SellerError("INVALID_INPUT");
    // This is the existing decision transaction, not a second moderation command.
    // Its immutable actor/request receipt is checked before stale revisions.
    return {
      ok: true as const,
      data: await moderateListing(getDatabase(), identity, input),
    };
  } catch (error) {
    return failure(error);
  }
}

export async function readOperatorSessionAction(
  actorKey: string,
): Promise<SellerResult<{ allowed: true }>> {
  try {
    const identity = await requireVerifiedIdentity();
    if (actorKey !== libraryActorKey(identity))
      throw new SellerError("FORBIDDEN");
    await inTransaction(getDatabase(), (tx) =>
      authorizeOperator(tx, identity, "reports.read"),
    );
    return { ok: true, data: { allowed: true } };
  } catch (error) {
    return failure(error);
  }
}
