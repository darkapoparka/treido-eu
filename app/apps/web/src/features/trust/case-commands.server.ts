import "server-only";
import { randomUUID } from "node:crypto";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { authorizeOperator } from "./reports.server";
import { moderateListingInTransaction } from "./moderation.server";
import {
  parseCaseCommand,
  type CaseReceipt,
  type CaseContext,
} from "./case-model";
import { caseStorageReady, readCaseReceipt } from "./case-storage.server";
import { readCaseContextInTransaction } from "./case-context.server";

export async function decideTrustCase(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
): Promise<CaseReceipt> {
  const data = parseCaseCommand(raw);
  if (!data) throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    const actor = await authorizeOperator(tx, identity, "reports.read");
    if (!(await caseStorageReady(tx))) throw new SellerError("NOT_AVAILABLE");
    // Recover an immutable acknowledgment under current read authority, even
    // after write revocation. New decisions still require current write authority.
    const prior = await readCaseReceipt(tx, actor.id, data);
    if (prior) return prior;
    await authorizeOperator(tx, identity, "moderation.write");
    if (data.kind === "message_report") {
      const target = (
        await tx.client.query<{ threadId: string }>(
          `SELECT m.thread_id AS "threadId" FROM treido.reports r JOIN treido.messages m ON m.id=r.resource_id
         WHERE r.id=$1 AND r.resource_kind='message' AND m.id=$2`,
          [data.caseId, data.resourceId],
        )
      ).rows[0];
      if (!target) throw new SellerError("NOT_FOUND");
      // The immutable messages table has no UPDATE grant. Lock its existing
      // mutable parent instead; every exact-message action uses this lock.
      await tx.client.query(
        "SELECT id FROM treido.conversation_threads WHERE id=$1 FOR UPDATE",
        [target.threadId],
      );
      await tx.client.query(
        "SELECT id FROM treido.reports WHERE id=$1 FOR UPDATE",
        [data.caseId],
      );
    } else {
      const target = await tx.client.query(
        `SELECT l.id FROM treido.moderation_appeals x JOIN treido.moderation_actions a ON a.id=x.action_id
         JOIN treido.listings l ON l.id=a.listing_id WHERE x.id=$1 AND a.id=$2 AND l.id=$3 FOR UPDATE OF l`,
        [data.caseId, data.originalActionId, data.resourceId],
      );
      if (target.rowCount !== 1) throw new SellerError("NOT_FOUND");
    }
    // A concurrent identical request may have committed while this one waited.
    const replay = await readCaseReceipt(tx, actor.id, data);
    if (replay) return replay;
    const context = await readCaseContextInTransaction(
      tx,
      identity,
      data.kind,
      data.caseId,
    );
    if (
      context.resourceId !== data.resourceId ||
      context.originalActionId !== data.originalActionId
    )
      throw new SellerError("INVALID_INPUT");
    if (
      context.status !== "open" ||
      context.revision !== data.expectedRevision ||
      context.resourceRevision !== data.expectedResourceRevision
    )
      throw new SellerError("CONFLICT");
    const recent = (
      await tx.client.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM treido.trust_case_decisions WHERE actor_id=$1 AND created_at>clock_timestamp()-interval '1 minute'",
        [actor.id],
      )
    ).rows[0].count;
    if (recent >= 30) throw new SellerError("QUOTA_EXCEEDED");
    let actionId: string | null = null;
    let resourceRevision = context.resourceRevision;
    let state: CaseContext["state"] = context.state;
    if (data.outcome === "message_hidden") {
      if (state !== "visible") throw new SellerError("CONFLICT");
      actionId = randomUUID();
      resourceRevision += 1;
      state = "hidden";
      await tx.client.query(
        `INSERT INTO treido.message_moderation_actions(id,message_id,report_id,actor_id,prior_revision,accepted_revision,state,reason)
         VALUES($1,$2,$3,$4,$5,$6,'hidden',$7)`,
        [
          actionId,
          data.resourceId,
          data.caseId,
          actor.id,
          context.resourceRevision,
          resourceRevision,
          data.reason,
        ],
      );
    } else if (data.outcome === "revised") {
      if (data.nextState === context.state)
        throw new SellerError("INVALID_INPUT");
      // Same established listing command on this connection. A formal appeal
      // outcome and its exact follow-up action either commit together or neither.
      const action = await moderateListingInTransaction(tx, identity, {
        listingId: data.resourceId,
        reportId: null,
        requestId: data.requestId,
        expectedRevision: data.expectedResourceRevision,
        state: data.nextState,
        reason: data.reason,
      });
      actionId = action.id;
      resourceRevision = action.revision;
      state = data.nextState!;
    }
    const id = randomUUID();
    const inserted = await tx.client.query(
      `INSERT INTO treido.trust_case_decisions(id,kind,case_id,report_id,appeal_id,resource_id,message_id,listing_id,resource_kind,
       original_action_id,message_action_id,listing_action_id,actor_id,request_id,input_hash,prior_revision,accepted_revision,
       observed_resource_revision,resource_revision,outcome,reason,resulting_state)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16+1,$17,$18,$19,$20,$21)
       ON CONFLICT(actor_id,request_id) DO NOTHING RETURNING id`,
      [
        id,
        data.kind,
        data.caseId,
        data.kind === "message_report" ? data.caseId : null,
        data.kind === "appeal" ? data.caseId : null,
        data.resourceId,
        data.kind === "message_report" ? data.resourceId : null,
        data.kind === "appeal" ? data.resourceId : null,
        data.kind === "message_report" ? "message" : "listing",
        data.originalActionId,
        data.kind === "message_report" ? actionId : null,
        data.kind === "appeal" ? actionId : null,
        actor.id,
        data.requestId,
        inputHash(data),
        context.revision,
        context.resourceRevision,
        resourceRevision,
        data.outcome,
        data.reason,
        state,
      ],
    );
    if (inserted.rowCount !== 1) throw new SellerError("CONFLICT");
    if (data.kind === "message_report")
      await tx.client.query(
        "UPDATE treido.reports SET state='reviewed',revision=revision+1 WHERE id=$1",
        [data.caseId],
      );
    const receipt = await readCaseReceipt(tx, actor.id, data);
    if (!receipt) throw new SellerError("NOT_AVAILABLE");
    return receipt;
  });
}
