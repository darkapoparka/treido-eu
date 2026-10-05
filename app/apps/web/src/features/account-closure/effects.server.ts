import "server-only";
import { randomUUID } from "node:crypto";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { inputHash } from "../sellers/persistence.server";
import { ClosureError } from "./model";
import {
  approvedBinding,
  requireRecent,
  type EffectRow,
} from "./storage.server";
import {
  clerkEffectAdapter,
  type ProviderOutcome,
} from "./clerk-adapter.server";
import { mediaEffectAdapter } from "./media-adapter.server";
import { billingEffectAdapter } from "./billing-adapter.server";
import { ownSecurityEffect } from "./commands.server";
export type ClosureExecutionProof = { jobId: string; executionToken: string };
/** Original effects remain durable; message DELETE retries retain the same immutable object and dispatch barrier. */
export async function performLifecycleEffect(
  database: SellerDatabase,
  effect: EffectRow,
  proof: ClosureExecutionProof | null,
  securityIdentity?: VerifiedIdentity,
) {
  const currentSecurity = () => {
    if (effect.planId !== null) {
      if (proof === null) throw new ClosureError("FORBIDDEN");
      return;
    }
    if (
      proof !== null ||
      !securityIdentity ||
      securityIdentity.subject !== effect.subject
    )
      throw new ClosureError("FORBIDDEN");
    requireRecent(securityIdentity);
  };
  currentSecurity();
  if (effect.state === "confirmed") return "confirmed" as const;
  const messageImage =
    effect.kind === "media.delete" &&
    effect.target.ownerKind === "message-image";
  const binding = await inTransaction(database, (tx) =>
    approvedBinding(tx, effect.bindingId),
  );
  const adapter =
    effect.kind === "data.remove"
      ? null
      : effect.kind === "media.delete"
        ? mediaEffectAdapter(binding, effect)
        : effect.kind === "billing.stop-renewal"
          ? await billingEffectAdapter(database, binding, effect)
          : await clerkEffectAdapter(binding, effect);
  let observation: ProviderOutcome | null = null;
  if (adapter && !messageImage) {
    try {
      observation = await adapter.observe();
    } catch {
      throw new ClosureError(
        effect.firstAttemptAt ? "UNKNOWN_OUTCOME" : "NOT_AVAILABLE",
      );
    }
  }
  currentSecurity();
  const token = randomUUID();
  const claim = await inTransaction(
    database,
    async (tx) =>
      (
        await tx.client.query<{
          claim: { claimed: boolean; confirmed: boolean; execute?: boolean };
        }>(
          `SELECT treido.account_claim_effect($1::uuid,$2::uuid,$3::uuid,$4::uuid) AS claim`,
          [
            effect.id,
            token,
            proof?.jobId ?? null,
            proof?.executionToken ?? null,
          ],
        )
      ).rows[0]?.claim,
  );
  if (!claim?.claimed)
    return claim?.confirmed ? ("confirmed" as const) : ("pending" as const);
  let imageDispatched = false;
  const currentImageLease = async (dispatch = false) => {
    if (!messageImage) return;
    await inTransaction(database, async (tx) => {
      await tx.client.query(
        dispatch
          ? "SELECT treido.account_dispatch_message_image($1::uuid,$2::uuid)"
          : "SELECT treido.account_message_image_io($1::uuid,$2::uuid)",
        [effect.id, token],
      );
    });
    imageDispatched = true;
  };
  if (!adapter) {
    // Removal and its confirmation commit together; a crash cannot create another deletion command.
    await inTransaction(database, async (tx) => {
      await tx.client.query(
        `SELECT treido.account_remove_optional_data($1::uuid,$2::uuid)`,
        [effect.id, token],
      );
      await tx.client.query(
        `SELECT treido.account_record_effect($1::uuid,$2::uuid,'confirmed',$3,'database')`,
        [
          effect.id,
          token,
          inputHash({
            kind: effect.kind,
            operationKey: effect.operationKey,
            state: "removed",
          }),
        ],
      );
    });
    return "confirmed" as const;
  }
  let outcome: ProviderOutcome;
  try {
    currentSecurity();
    // Reserve durable dispatch before the first provider IO. This also fences
    // older workers using the existing account_message_image_io seam.
    await currentImageLease();
    if (messageImage) observation = await adapter.observe();
    // Recheck current authority before DELETE under the existing barrier.
    await currentImageLease(true);
    outcome =
      observation?.state === "confirmed"
        ? observation
        : claim.execute || messageImage
          ? await adapter.execute()
          : await adapter.observe();
  } catch {
    outcome = {
      state: "unknown",
      evidence: { kind: effect.kind, status: "unresolved" },
    };
  }
  if (imageDispatched) {
    // Separate from acknowledgement: a lost lease cannot discard what the
    // provider actually returned or imply that a rejected hold saved bytes.
    await inTransaction(database, async (tx) => {
      await tx.client.query(
        "SELECT treido.account_observe_message_image($1::uuid,$2::uuid,$3,$4)",
        [
          effect.id,
          token,
          outcome.state,
          inputHash({ operationKey: effect.operationKey, ...outcome.evidence }),
        ],
      );
    });
  }
  await inTransaction(database, async (tx) => {
    await tx.client.query(
      `SELECT treido.account_record_effect($1::uuid,$2::uuid,$3,$4,'provider')`,
      [
        effect.id,
        token,
        outcome.state,
        inputHash({ operationKey: effect.operationKey, ...outcome.evidence }),
      ],
    );
  });
  return outcome.state;
}
/** Security commands retain ordinary current/recent human authorization. */
export async function processOwnSessionEffect(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  effectId: string,
) {
  requireRecent(identity);
  const effect = await ownSecurityEffect(database, identity, effectId);
  if (effect.planId !== null) throw new ClosureError("FORBIDDEN");
  return {
    state: await performLifecycleEffect(database, effect, null, identity),
  };
}
