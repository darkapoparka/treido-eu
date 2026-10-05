import "server-only";
import { randomUUID } from "node:crypto";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import {
  hasVerifiedRecentAuthentication,
  type VerifiedIdentity,
} from "../../server/identity/clerk.server";
import { requireBackendBindings } from "../../server/config/backend-bindings.server";
import { requireJobBindings } from "../../server/jobs/config.server";
import { authorizeHuman, inputHash } from "../sellers/persistence.server";
import { libraryActorKey } from "../library/cursor.server";
import { validId } from "../selling/draft-model";
import { object } from "../purchase-reviews/model";
import { SellerError } from "../sellers/errors";
import { aftercareStorageAvailable } from "./storage.server";
import { exact, boundedText, revision } from "./model";
export async function authorizeAftercareOperator(
  tx: SellerTransaction,
  identity: VerifiedIdentity,
  cap: "cases.read" | "cases.decide" | "feedback.moderate",
  write = false,
) {
  if (write && !hasVerifiedRecentAuthentication(identity))
    throw new SellerError("FORBIDDEN");
  const user = await authorizeHuman(tx, identity, write);
  if (!(await aftercareStorageAvailable(tx)))
    throw new SellerError("NOT_AVAILABLE");
  const environment = requireBackendBindings().environment,
    applicationId = requireJobBindings().applicationId;
  const allowed = (
    await tx.client.query<{ allowed: boolean }>(
      "SELECT treido.lock_order_aftercare_operator($1,$2,$3,$4) AS allowed",
      [user.id, cap, environment, applicationId],
    )
  ).rows[0];
  if (!allowed?.allowed) throw new SellerError("FORBIDDEN");
  return { user, environment, applicationId };
}
export function parseOperatorDecision(raw: unknown) {
  if (
    !object(raw) ||
    typeof raw.actorKey !== "string" ||
    !/^[a-f0-9]{64}$/.test(raw.actorKey) ||
    !validId(raw.caseId) ||
    !validId(raw.requestId) ||
    (raw.decision !== "operator_recommendation" &&
      raw.decision !== "operator_information" &&
      raw.decision !== "operator_no_decision")
  )
    throw new SellerError("INVALID_INPUT");
  exact(raw, [
    "actorKey",
    "caseId",
    "requestId",
    "expectedRevision",
    "decision",
    "body",
  ]);
  return {
    actorKey: raw.actorKey,
    caseId: raw.caseId,
    requestId: raw.requestId,
    expectedRevision: revision(raw.expectedRevision),
    decision: raw.decision,
    body: boundedText(raw.body, 2000),
  };
}
export async function decideOrderCase(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  const command = parseOperatorDecision(raw);
  if (command.actorKey !== libraryActorKey(identity))
    throw new SellerError("FORBIDDEN");
  return inTransaction(database, async (tx) => {
    const access = await authorizeAftercareOperator(
      tx,
      identity,
      "cases.decide",
      true,
    );
    const initial = (
      await tx.client.query<{ orderId: string }>(
        'SELECT order_id AS "orderId" FROM treido.order_cases WHERE id=$1',
        [command.caseId],
      )
    ).rows[0];
    if (!initial) throw new SellerError("NOT_FOUND");
    await tx.client.query(
      "SELECT id FROM treido.paid_orders WHERE id=$1 FOR UPDATE",
      [initial.orderId],
    );
    const current = (
      await tx.client.query<{
        orderId: string;
        state: string;
        revision: number;
        policyId: string;
        appealSeconds: number | null;
        eventLimit: number;
      }>(
        'SELECT c.order_id AS "orderId",c.state,c.revision,c.policy_id AS "policyId",p.appeal_seconds AS "appealSeconds",p.event_limit AS "eventLimit" FROM treido.order_cases c JOIN treido.order_service_policies p ON p.id=c.policy_id WHERE c.id=$1 AND p.environment=$2 AND p.application_id=$3 AND p.approved_at<=clock_timestamp() AND p.revoked_at IS NULL FOR UPDATE OF c FOR SHARE OF p',
        [command.caseId, access.environment, access.applicationId],
      )
    ).rows[0];
    if (!current) throw new SellerError("NOT_AVAILABLE");
    const prior = (
      await tx.client.query<{
        hash: string;
        revision: number;
        caseId: string | null;
      }>(
        'SELECT input_hash AS hash,accepted_revision AS revision,case_id AS "caseId" FROM treido.order_aftercare_receipts WHERE order_id=$1 AND actor_id=$2 AND request_id=$3',
        [current.orderId, access.user.id, command.requestId],
      )
    ).rows[0];
    if (prior) {
      if (prior.hash !== inputHash(command) || prior.caseId !== command.caseId)
        throw new SellerError("CONFLICT");
      return { caseId: command.caseId, revision: prior.revision };
    }
    if (
      current.state !== "review_requested" ||
      current.revision !== command.expectedRevision
    )
      throw new SellerError("CONFLICT");
    const count = (
      await tx.client.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM treido.order_case_events WHERE case_id=$1",
        [command.caseId],
      )
    ).rows[0];
    if (count.n >= current.eventLimit) throw new SellerError("QUOTA_EXCEEDED");
    await tx.client.query(
      "UPDATE treido.order_cases SET state='reviewed',revision=revision+1,appeal_until=CASE WHEN $2::int IS NULL THEN NULL ELSE clock_timestamp()+make_interval(secs=>$2) END,updated_at=clock_timestamp() WHERE id=$1",
      [command.caseId, current.appealSeconds],
    );
    await tx.client.query(
      "INSERT INTO treido.order_case_events(id,case_id,actor_id,side,kind,body,evidence,accepted_revision) VALUES($1,$2,$3,'operator',$4,$5,'[]',$6)",
      [
        randomUUID(),
        command.caseId,
        access.user.id,
        command.decision,
        command.body,
        current.revision + 1,
      ],
    );
    await tx.client.query(
      "INSERT INTO treido.order_aftercare_receipts(order_id,actor_id,request_id,input_hash,action,case_id,accepted_revision,accepted_state) VALUES($1,$2,$3,$4,$5,$6,$7,'reviewed')",
      [
        current.orderId,
        access.user.id,
        command.requestId,
        inputHash(command),
        command.decision,
        command.caseId,
        current.revision + 1,
      ],
    );
    return { caseId: command.caseId, revision: current.revision + 1 };
  });
}
export async function readOperatorAftercare(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  caseId?: string,
) {
  if (caseId && !validId(caseId)) throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    const access = await authorizeAftercareOperator(tx, identity, "cases.read");
    const canDecide =
      (
        await tx.client.query<{ allowed: boolean }>(
          "SELECT treido.lock_order_aftercare_operator($1,'cases.decide',$2,$3) AS allowed",
          [access.user.id, access.environment, access.applicationId],
        )
      ).rows[0]?.allowed === true;
    const cases = (
      await tx.client.query<{
        id: string;
        orderId: string;
        reason: string;
        state: string;
        revision: number;
        createdAt: Date;
      }>(
        'SELECT c.id,c.order_id AS "orderId",c.reason,c.state,c.revision,c.created_at AS "createdAt" FROM treido.order_cases c JOIN treido.order_service_policies p ON p.id=c.policy_id WHERE p.environment=$1 AND p.application_id=$2 AND ($3::uuid IS NULL OR c.id=$3) ORDER BY c.created_at DESC,c.id DESC LIMIT 51',
        [access.environment, access.applicationId, caseId ?? null],
      )
    ).rows;
    if (caseId && !cases.length) throw new SellerError("NOT_FOUND");
    const output = [];
    for (const row of cases.slice(0, 50)) {
      const events = caseId
        ? (
            await tx.client.query<{
              id: string;
              side: string;
              kind: string;
              body: string;
              evidence: string[];
              createdAt: Date;
            }>(
              'SELECT id,side,kind,body,evidence,created_at AS "createdAt" FROM treido.order_case_events WHERE case_id=$1 ORDER BY accepted_revision DESC LIMIT 51',
              [row.id],
            )
          ).rows
        : [];
      output.push({
        ...row,
        createdAt: row.createdAt.toISOString(),
        events: events
          .slice(0, 50)
          .reverse()
          .map((event) => ({
            ...event,
            createdAt: event.createdAt.toISOString(),
          })),
        moreEvents: events.length > 50,
      });
    }
    return {
      actorKey: libraryActorKey(identity),
      actorSubject: identity.subject,
      cases: output,
      more: cases.length > 50,
      canDecide,
    };
  });
}
