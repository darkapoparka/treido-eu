"use server";
import { getDatabase, inTransaction } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { libraryActorKey } from "../library/cursor.server";
import { authorizeHuman, inputHash } from "../sellers/persistence.server";
import { object } from "../purchase-reviews/model";
import { SellerError } from "../sellers/errors";
import { appealModeration } from "./moderation.server";
import { parseAppealSubmission } from "./appeal-submission-model";

export async function submitRecoverableAppealAction(raw: unknown) {
  try {
    const identity = await requireVerifiedIdentity();
    if (
      !object(raw) ||
      Object.keys(raw).some((k) => !["actorKey", "input"].includes(k))
    )
      throw new SellerError("INVALID_INPUT");
    if (raw.actorKey !== libraryActorKey(identity))
      throw new SellerError("FORBIDDEN");
    const input = parseAppealSubmission(raw.input);
    if (!input) throw new SellerError("INVALID_INPUT");
    const database = getDatabase();
    // The caller retains read authority to their own submission. Recover it
    // before testing whether a *new* appeal would still be permitted.
    const receipt = await inTransaction(database, async (tx) => {
      const user = await authorizeHuman(tx, identity, false);
      const previous = (
        await tx.client.query<{ id: string; hash: string }>(
          "SELECT id,input_hash AS hash FROM treido.moderation_appeals WHERE actor_id=$1 AND request_id=$2",
          [user.id, input.requestId],
        )
      ).rows[0];
      if (
        previous &&
        previous.hash !==
          inputHash({ actionId: input.actionId, details: input.details })
      )
        throw new SellerError("CONFLICT");
      return previous ? { id: previous.id } : null;
    });
    // Current seller/reporter authority is rechecked by the original command.
    const result =
      receipt ?? (await appealModeration(database, identity, input));
    return { ok: true as const, data: { id: result.id, input } };
  } catch (error) {
    if (!(error instanceof SellerError))
      console.error("Treido appeal submission unavailable.");
    const code = error instanceof SellerError ? error.code : "NOT_AVAILABLE";
    return {
      ok: false as const,
      code,
      rejected: ["INVALID_INPUT", "CONFLICT", "QUOTA_EXCEEDED"].includes(code),
    };
  }
}
