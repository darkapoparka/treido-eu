import "server-only";
import type {
  SellerDatabase,
  SellerTransaction,
} from "../../server/db/database";
import { inTransaction } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman, inputHash } from "../sellers/persistence.server";
import { requireBackendBindings } from "../../server/config/backend-bindings.server";
import { SellerError } from "../sellers/errors";
import { parseMeasurementChoice, type MeasurementChoiceView } from "./model";
import { createHmac } from "node:crypto";
import { publicDiscoveryKey } from "../catalog/public-discovery.server";
export async function approvedMeasurementPolicy(tx: SellerTransaction) {
  const config = requireBackendBindings();
  return (
    (
      await tx.client.query<{
        id: string;
        retentionDays: number;
        consentRule: string;
        text: { bg: string; en: string };
      }>(
        `SELECT id,retention_days AS "retentionDays",consent_rule AS "consentRule",text FROM treido.promotion_measurement_policies pp WHERE environment=$1 AND application_id=$2 AND policy_version='visible-v1' AND consent_rule='explicit_promotion_measurement_opt_in' AND event_definition='{"ratio":0.5,"continuousMilliseconds":1000,"foreground":true,"click":"product_anchor"}'::jsonb AND approved_at<=clock_timestamp() AND revoked_at IS NULL AND version=(SELECT max(latest.version) FROM treido.promotion_measurement_policies latest WHERE latest.environment=pp.environment AND latest.application_id=pp.application_id) FOR SHARE`,
        [config.environment, config.identity.applicationId],
      )
    ).rows[0] ?? null
  );
}
export function measurementActorKey(identity: VerifiedIdentity) {
  return createHmac("sha256", publicDiscoveryKey())
    .update("promotion-measurement-choice-v1:" + identity.subject)
    .digest("hex");
}
export async function readPromotionMeasurementChoice(
  database: SellerDatabase,
  identity: VerifiedIdentity,
): Promise<MeasurementChoiceView> {
  return inTransaction(database, async (tx) => {
    const policy = await approvedMeasurementPolicy(tx),
      actorKey = measurementActorKey(identity);
    let user: { id: string };
    try {
      user = await authorizeHuman(tx, identity, false);
    } catch (error) {
      if (error instanceof SellerError && error.code === "NOT_FOUND")
        return {
          actorKey,
          registered: false,
          policy,
          allowed: false,
          revision: 0,
        };
      throw error;
    }
    const choice = policy
      ? (
          await tx.client.query<{ allowed: boolean; revision: number }>(
            `SELECT allowed,revision FROM treido.promotion_measurement_choices WHERE user_id=$1 AND policy_id=$2 ORDER BY revision DESC LIMIT 1`,
            [user.id, policy.id],
          )
        ).rows[0]
      : null;
    return {
      actorKey,
      registered: true,
      policy,
      allowed: choice?.allowed === true,
      revision: choice?.revision ?? 0,
    };
  });
}
/** Explicit actor-owned, revisioned opt-in/withdrawal; unknown outcome retries the exact immutable choice. */
export async function changePromotionMeasurementChoice(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  const command = parseMeasurementChoice(raw);
  if (command.actorKey !== measurementActorKey(identity))
    throw new SellerError("FORBIDDEN");
  return inTransaction(database, async (tx) => {
    const policy = await approvedMeasurementPolicy(tx);
    if (!policy || policy.id !== command.policyId)
      throw new SellerError("NOT_AVAILABLE");
    // Ordinary first registration happens only after this valid explicit personal command, never a GET.
    const user = await authorizeHuman(tx, identity, true),
      hash = inputHash(command);
    const prior = (
      await tx.client.query<{
        hash: string;
        allowed: boolean;
        revision: number;
      }>(
        `SELECT input_hash AS hash,allowed,revision FROM treido.promotion_measurement_choices WHERE user_id=$1 AND request_id=$2`,
        [user.id, command.requestId],
      )
    ).rows[0];
    if (prior) {
      if (prior.hash !== hash) throw new SellerError("CONFLICT");
      return { allowed: prior.allowed, revision: prior.revision };
    }
    const latest = (
      await tx.client.query<{ revision: number }>(
        `SELECT revision FROM treido.promotion_measurement_choices WHERE user_id=$1 AND policy_id=$2 ORDER BY revision DESC LIMIT 1`,
        [user.id, policy.id],
      )
    ).rows[0];
    if ((latest?.revision ?? 0) !== command.expectedRevision)
      throw new SellerError("CONFLICT");
    const next = command.expectedRevision + 1;
    await tx.client.query(
      `INSERT INTO treido.promotion_measurement_choices(user_id,policy_id,request_id,allowed,revision,input_hash) VALUES($1,$2,$3,$4,$5,$6)`,
      [user.id, policy.id, command.requestId, command.allowed, next, hash],
    );
    return { allowed: command.allowed, revision: next };
  });
}
