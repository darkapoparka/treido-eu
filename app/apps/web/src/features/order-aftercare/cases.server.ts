import "server-only";
import { randomUUID } from "node:crypto";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import {
  parseAftercareCommand,
  parseRecovery,
  nextCaseState,
  type CaseState,
} from "./model";
import {
  aftercareStorageAvailable,
  orderContext,
  aftercareReceipt,
  saveAftercareReceipt,
} from "./storage.server";
import { readServicePolicy } from "./policy.server";
export async function executeOrderCase(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  const command = parseAftercareCommand(raw);
  if (
    ![
      "open",
      "message",
      "propose",
      "accept",
      "reopen",
      "escalate",
      "appeal",
    ].includes(command.action)
  )
    throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    await authorizeHuman(tx, identity, true);
    const order = await orderContext(
      tx,
      identity,
      command,
      command.sellerId ? "order.fulfil" : "order.read",
      true,
    );
    if (!(await aftercareStorageAvailable(tx)))
      throw new SellerError("NOT_AVAILABLE");
    const prior = await aftercareReceipt(tx, order, command.requestId, command);
    if (prior)
      return {
        orderId: order.orderId,
        requestId: command.requestId,
        caseId: prior.caseId,
        intentId: prior.intentId,
        revision: prior.revision,
        state: prior.state,
      };
    const policy = await readServicePolicy(tx, order);
    if (!policy) throw new SellerError("NOT_AVAILABLE");
    const recent = (
      await tx.client.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM treido.order_aftercare_receipts WHERE actor_id=$1 AND created_at>clock_timestamp()-interval '1 minute'",
        [order.actorId],
      )
    ).rows[0];
    if (recent.n >= 20) throw new SellerError("QUOTA_EXCEEDED");
    let caseId: string,
      caseRevision: number,
      state: CaseState,
      evidence: string[] = [],
      body: string,
      kind: string;
    if (command.action === "open") {
      if (order.side !== "buyer") throw new SellerError("FORBIDDEN");
      if (
        policy.id !== command.servicePolicyId ||
        policy.version !== command.servicePolicyVersion ||
        policy.termsHash !== command.serviceTermsHash
      )
        throw new SellerError("CONFLICT");
      if (order.orderRevision !== command.expectedRevision)
        throw new SellerError("CONFLICT");
      const counts = (
        await tx.client.query<{ n: number }>(
          "SELECT count(*)::int AS n FROM treido.order_cases WHERE order_id=$1",
          [order.orderId],
        )
      ).rows[0];
      if (counts.n >= policy.caseLimit) throw new SellerError("QUOTA_EXCEEDED");
      caseId = randomUUID();
      caseRevision = 0;
      state = "open";
      body = command.body;
      evidence = command.evidence;
      kind = "open";
      await tx.client.query(
        "INSERT INTO treido.order_cases(id,order_id,buyer_id,seller_id,policy_id,reason,state) VALUES($1,$2,$3,$4,$5,$6,'open')",
        [
          caseId,
          order.orderId,
          order.buyerId,
          order.sellerId,
          policy.id,
          command.reason,
        ],
      );
    } else if (
      command.action === "message" ||
      command.action === "propose" ||
      command.action === "accept" ||
      command.action === "reopen" ||
      command.action === "escalate" ||
      command.action === "appeal"
    ) {
      const current = (
        await tx.client.query<{
          id: string;
          state: CaseState;
          revision: number;
          policyId: string;
          appealExpired: boolean;
          appealAllowed: boolean;
        }>(
          'SELECT id,state,revision,policy_id AS "policyId",(appeal_until IS NOT NULL AND appeal_until<=clock_timestamp()) AS "appealExpired",(appeal_until IS NOT NULL) AS "appealAllowed" FROM treido.order_cases WHERE id=$1 AND order_id=$2 FOR UPDATE',
          [command.caseId, order.orderId],
        )
      ).rows[0];
      if (!current) throw new SellerError("NOT_FOUND");
      if (current.revision !== command.expectedRevision)
        throw new SellerError("CONFLICT");
      const originalPolicy = await readServicePolicy(
        tx,
        order,
        current.policyId,
      );
      if (!originalPolicy) throw new SellerError("NOT_AVAILABLE");
      const eventCount = (
        await tx.client.query<{ n: number }>(
          "SELECT count(*)::int AS n FROM treido.order_case_events WHERE case_id=$1",
          [current.id],
        )
      ).rows[0];
      if (eventCount.n >= originalPolicy.eventLimit)
        throw new SellerError("QUOTA_EXCEEDED");
      if (
        command.action === "appeal" &&
        (!current.appealAllowed || current.appealExpired)
      )
        throw new SellerError("CONFLICT");
      caseId = current.id;
      caseRevision = current.revision + 1;
      state = nextCaseState(current.state, order.side, command.action);
      body = command.body;
      kind = command.action;
      await tx.client.query(
        "UPDATE treido.order_cases SET state=$2,revision=$3,updated_at=clock_timestamp() WHERE id=$1",
        [caseId, state, caseRevision],
      );
    } else throw new SellerError("INVALID_INPUT");
    await tx.client.query(
      "INSERT INTO treido.order_case_events(id,case_id,actor_id,side,kind,body,evidence,accepted_revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        randomUUID(),
        caseId,
        order.actorId,
        order.side,
        kind,
        body,
        JSON.stringify(evidence),
        caseRevision,
      ],
    );
    return saveAftercareReceipt(tx, order, command, {
      caseId,
      intentId: null,
      revision: caseRevision,
      state,
    });
  });
}
export async function recoverOrderAftercare(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  const command = parseRecovery(raw);
  return inTransaction(database, async (tx) => {
    const order = await orderContext(tx, identity, command);
    if (!(await aftercareStorageAvailable(tx)))
      throw new SellerError("NOT_AVAILABLE");
    const prior = await aftercareReceipt(tx, order, command.requestId);
    if (!prior) throw new SellerError("NOT_FOUND");
    return {
      orderId: order.orderId,
      requestId: command.requestId,
      caseId: prior.caseId,
      intentId: prior.intentId,
      revision: prior.revision,
      state: prior.state,
    };
  });
}
