import "server-only";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import { requireBackendBindings } from "../../server/config/backend-bindings.server";
import { requireJobBindings } from "../../server/jobs/config.server";
import type { EffectResult } from "../../server/jobs/execution.server";
import { JobError } from "../../server/jobs/model";
import { validId } from "../selling/draft-model";

export type AcceptedRecipientRetentionContext = {
  id: string;
  kind: "shipping.recipient-expiry";
  authority: "shipping";
  buyerId: string;
  sellerId: null;
  actorId: null;
  resourceId: string;
  operationKey: string;
  generation: number;
  executionToken: string;
};

function originalArtifact(context: AcceptedRecipientRetentionContext) {
  if (
    context.kind !== "shipping.recipient-expiry" ||
    context.authority !== "shipping" ||
    context.sellerId !== null ||
    context.actorId !== null ||
    context.operationKey !== context.resourceId ||
    !Number.isSafeInteger(context.generation) ||
    context.generation < 1 ||
    [
      context.id,
      context.buyerId,
      context.resourceId,
      context.executionToken,
    ].some((id) => !validId(id))
  )
    throw new JobError("FORBIDDEN");
}

/** Caller is the ORIGINAL signed executor. Inngest and Clerk application IDs
 * are distinct namespaces; an approved retention mapping must bind both. */
export async function authorizeAcceptedRecipientRetention(
  tx: SellerTransaction,
  context: AcceptedRecipientRetentionContext,
) {
  originalArtifact(context);
  const backend = requireBackendBindings();
  const execution = requireJobBindings();
  await tx.client.query(
    "SELECT treido.order_shipping_validate_recipient_job($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
    [
      context.id,
      context.buyerId,
      context.resourceId,
      context.generation,
      context.executionToken,
      execution.applicationId,
      execution.environment,
      backend.environment,
      backend.identity.applicationId,
      backend.identity.mode,
    ],
  );
}

/** Local removal is deferred until the original executor's live-lease apply.
 * Its completion CAS and private value clearing therefore commit or roll back
 * together. This handler emits no SDK, storage, payment or carrier request. */
export async function processAcceptedRecipientRetention(
  database: SellerDatabase,
  context: AcceptedRecipientRetentionContext,
): Promise<EffectResult> {
  await inTransaction(database, (tx) =>
    authorizeAcceptedRecipientRetention(tx, context),
  );
  return {
    resultId: context.resourceId,
    lock: (tx) => authorizeAcceptedRecipientRetention(tx, context),
    apply: async (tx) => {
      originalArtifact(context);
      const backend = requireBackendBindings();
      const execution = requireJobBindings();
      const result = (
        await tx.client.query<{ state: string }>(
          "SELECT treido.order_shipping_clear_accepted_recipient($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) AS state",
          [
            context.id,
            context.buyerId,
            context.resourceId,
            context.generation,
            context.executionToken,
            execution.applicationId,
            execution.environment,
            backend.environment,
            backend.identity.applicationId,
            backend.identity.mode,
          ],
        )
      ).rows[0];
      if (!result || !["cleared", "already_cleared"].includes(result.state))
        throw new JobError("NOT_AVAILABLE");
    },
  };
}
