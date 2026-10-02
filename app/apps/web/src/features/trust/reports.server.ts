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
import { authorizeHuman, inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { authorizeConversation } from "../messaging/participants.server";

export type OperatorCapability = "reports.read" | "moderation.write";
export async function authorizeOperator(
  tx: SellerTransaction,
  identity: VerifiedIdentity,
  capability: OperatorCapability,
) {
  const user = await authorizeHuman(tx, identity, false);
  const allowed = (
    await tx.client.query<{ allowed: boolean }>(
      "SELECT treido.lock_operator_grant($1,$2) AS allowed",
      [user.id, capability],
    )
  ).rows[0]?.allowed;
  if (!allowed) throw new SellerError("FORBIDDEN");
  return user;
}

export async function createResourceReport(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  input: {
    resourceKind: "listing" | "message";
    resourceId: string;
    requestId: string;
    reason: string;
    details: string;
  },
) {
  if (
    !input ||
    !["listing", "message"].includes(input.resourceKind) ||
    !validId(input.resourceId) ||
    !validId(input.requestId) ||
    !["unsafe", "counterfeit", "misleading", "abuse", "other"].includes(
      input.reason,
    ) ||
    typeof input.details !== "string" ||
    input.details.length > 2000 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(input.details)
  )
    throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    const user = await authorizeHuman(tx, identity, true);
    const hash = inputHash({ ...input, details: input.details.trim() });
    const previous = (
      await tx.client.query<{ id: string; hash: string }>(
        "SELECT id,input_hash AS hash FROM treido.reports WHERE reporter_id=$1 AND request_id=$2",
        [user.id, input.requestId],
      )
    ).rows[0];
    // Current resource authority is checked on every retry before its receipt.
    if (input.resourceKind === "message") {
      const message = (
        await tx.client.query<{ threadId: string }>(
          'SELECT thread_id AS "threadId" FROM treido.messages WHERE id=$1',
          [input.resourceId],
        )
      ).rows[0];
      if (!message) throw new SellerError("NOT_FOUND");
      await authorizeConversation(tx, identity, message.threadId);
    } else {
      const target = await tx.client.query(
        "SELECT l.id " +
          publishedJoins +
          " WHERE l.id=$1 AND " +
          publishedEligibility +
          " FOR SHARE OF l,s",
        [input.resourceId],
      );
      if (target.rowCount !== 1) throw new SellerError("NOT_FOUND");
    }
    if (previous) {
      if (previous.hash !== hash) throw new SellerError("CONFLICT");
      return { id: previous.id };
    }
    const id = randomUUID();
    await tx.client.query(
      "INSERT INTO treido.reports(id,reporter_id,resource_kind,resource_id,reason,details,request_id,input_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        id,
        user.id,
        input.resourceKind,
        input.resourceId,
        input.reason,
        input.details.trim(),
        input.requestId,
        hash,
      ],
    );
    return { id };
  });
}

export async function readOwnedReport(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  id: string,
) {
  if (!validId(id)) throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    const user = await authorizeHuman(tx, identity, false);
    const row = (
      await tx.client.query<{ id: string; state: string; revision: number }>(
        "SELECT id,state,revision FROM treido.reports WHERE id=$1 AND reporter_id=$2",
        [id, user.id],
      )
    ).rows[0];
    if (!row) throw new SellerError("NOT_FOUND");
    return row;
  });
}

export async function readOperatorReports(
  database: SellerDatabase,
  identity: VerifiedIdentity,
) {
  return inTransaction(database, async (tx) => {
    await authorizeOperator(tx, identity, "reports.read");
    return (
      await tx.client.query<{
        id: string;
        resourceKind: string;
        resourceId: string;
        reason: string;
        details: string;
        revision: number;
        moderationRevision: number | null;
      }>(
        `SELECT r.id,r.resource_kind AS "resourceKind",r.resource_id AS "resourceId",r.reason,r.details,r.revision,l.moderation_revision AS "moderationRevision" FROM treido.reports r LEFT JOIN treido.listings l ON r.resource_kind='listing' AND l.id=r.resource_id WHERE r.state='open' ORDER BY r.created_at,r.id LIMIT 50`,
      )
    ).rows;
  });
}
