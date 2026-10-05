import "server-only";
import {
  publishedJoins,
  publishedEligibility,
} from "../catalog/publication-eligibility.server";
import { randomUUID } from "node:crypto";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import {
  authorizeHuman,
  authorizeSeller,
  inputHash,
} from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { authorizeOperator } from "./reports.server";
import {
  boundedReason,
  parseModerationInput,
  type ModerationState,
} from "./moderation-model";

export async function moderateListing(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  input: unknown,
) {
  return inTransaction(database, (tx) =>
    moderateListingInTransaction(tx, identity, input),
  );
}
/** Shared only for atomic formal appeal outcomes; preserves the original command. */
export async function moderateListingInTransaction(
  tx: SellerTransaction,
  identity: VerifiedIdentity,
  input: unknown,
) {
  const data = parseModerationInput(input);
  if (!data) throw new SellerError("INVALID_INPUT");
  const actor = await authorizeOperator(tx, identity, "moderation.write");
  if (data.reportId) await authorizeOperator(tx, identity, "reports.read");
  const listing = (
    await tx.client.query<{ state: ModerationState; revision: number }>(
      "SELECT moderation_state AS state,moderation_revision AS revision FROM treido.listings WHERE id=$1 FOR UPDATE",
      [data.listingId],
    )
  ).rows[0];
  if (!listing) throw new SellerError("NOT_FOUND");
  const hash = inputHash(data);
  const previous = (
    await tx.client.query<{ id: string; revision: number; hash: string }>(
      "SELECT id,accepted_revision AS revision,input_hash AS hash FROM treido.moderation_actions WHERE actor_id=$1 AND request_id=$2",
      [actor.id, data.requestId],
    )
  ).rows[0];
  if (previous) {
    if (previous.hash !== hash) throw new SellerError("CONFLICT");
    return { id: previous.id, revision: previous.revision };
  }
  if (listing.revision !== data.expectedRevision)
    throw new SellerError("CONFLICT");
  if (data.reportId) {
    const report = (
      await tx.client.query<{
        resourceId: string;
        resourceKind: string;
        state: string;
      }>(
        'SELECT resource_id AS "resourceId",resource_kind AS "resourceKind",state FROM treido.reports WHERE id=$1 FOR UPDATE',
        [data.reportId],
      )
    ).rows[0];
    if (
      !report ||
      report.resourceKind !== "listing" ||
      report.resourceId !== data.listingId
    )
      throw new SellerError("INVALID_INPUT");
    if (report.state !== "open") throw new SellerError("CONFLICT");
  }
  const id = randomUUID(),
    revision = listing.revision + 1;
  const inserted = await tx.client.query(
    "INSERT INTO treido.moderation_actions(id,listing_id,actor_id,report_id,prior_state,next_state,prior_revision,accepted_revision,reason,request_id,input_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(actor_id,request_id) DO NOTHING RETURNING id",
    [
      id,
      data.listingId,
      actor.id,
      data.reportId,
      listing.state,
      data.state,
      listing.revision,
      revision,
      data.reason,
      data.requestId,
      hash,
    ],
  );
  // Different listings have independent locks. A racing reused actor/retry key
  // must be a conflict, with no second state/report update or raw SQL failure.
  if (inserted.rowCount !== 1) throw new SellerError("CONFLICT");
  await tx.client.query(
    "UPDATE treido.listings SET moderation_state=$2,moderation_revision=$3 WHERE id=$1",
    [data.listingId, data.state, revision],
  );
  if (data.reportId)
    await tx.client.query(
      "UPDATE treido.reports SET state='reviewed',revision=revision+1 WHERE id=$1",
      [data.reportId],
    );
  return { id, revision };
}

export async function appealModeration(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  input: { actionId: string; requestId: string; details: string },
) {
  if (!input || !validId(input.actionId) || !validId(input.requestId))
    throw new SellerError("INVALID_INPUT");
  const details = boundedReason(input.details);
  if (!details) throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    const user = await authorizeHuman(tx, identity, true);
    const action = (
      await tx.client.query<{ sellerId: string; reporterId: string | null }>(
        'SELECT l.seller_id AS "sellerId",r.reporter_id AS "reporterId" FROM treido.moderation_actions a JOIN treido.listings l ON l.id=a.listing_id LEFT JOIN treido.reports r ON r.id=a.report_id WHERE a.id=$1',
        [input.actionId],
      )
    ).rows[0];
    if (!action) throw new SellerError("NOT_FOUND");
    if (action.reporterId !== user.id) {
      try {
        await authorizeSeller(tx, identity, action.sellerId, "listing.read");
      } catch (error) {
        if (error instanceof SellerError) throw new SellerError("NOT_FOUND");
        throw error;
      }
    }
    const hash = inputHash({ actionId: input.actionId, details });
    const previous = (
      await tx.client.query<{ id: string; hash: string }>(
        "SELECT id,input_hash AS hash FROM treido.moderation_appeals WHERE actor_id=$1 AND request_id=$2",
        [user.id, input.requestId],
      )
    ).rows[0];
    if (previous) {
      if (previous.hash !== hash) throw new SellerError("CONFLICT");
      return { id: previous.id };
    }
    const id = randomUUID();
    await tx.client.query(
      "INSERT INTO treido.moderation_appeals(id,action_id,actor_id,details,request_id,input_hash) VALUES($1,$2,$3,$4,$5,$6)",
      [id, input.actionId, user.id, details, input.requestId, hash],
    );
    return { id };
  });
}

export async function readPublicListingState(
  database: SellerDatabase,
  listingId: string,
) {
  if (!validId(listingId)) throw new SellerError("NOT_FOUND");
  const row = (
    await database.pool.query<{ id: string; revision: number }>(
      "SELECT l.id,l.revision " +
        publishedJoins +
        " WHERE l.id=$1 AND " +
        publishedEligibility,
      [listingId],
    )
  ).rows[0];
  if (!row) throw new SellerError("NOT_FOUND");
  return row;
}
