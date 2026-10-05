import "server-only";
import { createHmac } from "node:crypto";
import type { PoolClient } from "pg";
import {
  hasVerifiedRecentAuthentication,
  type VerifiedIdentity,
} from "../../server/identity/clerk.server";
import { publicDiscoveryKey } from "../catalog/public-discovery.server";
import { PrivacyError } from "./model";
export function privacyActorKey(identity: VerifiedIdentity) {
  return createHmac("sha256", publicDiscoveryKey())
    .update("account-privacy-v1:" + identity.subject)
    .digest("hex");
}
export function requireRecentPrivacyIdentity(identity: VerifiedIdentity) {
  if (!hasVerifiedRecentAuthentication(identity))
    throw new PrivacyError("RECENT_AUTH_REQUIRED");
}
export async function requirePrivacyStorage(client: Pick<PoolClient, "query">) {
  const ready = (
    await client.query<{ ready: boolean }>(`SELECT
    to_regclass('treido.account_privacy_workspaces') IS NOT NULL AND
    to_regclass('treido.account_privacy_exports') IS NOT NULL AND
    to_regclass('treido.account_privacy_reviews') IS NOT NULL AND
    to_regclass('treido.account_closure_requests') IS NOT NULL AND
    to_regclass('treido.account_privacy_receipts') IS NOT NULL AS ready`)
  ).rows[0]?.ready;
  if (!ready) throw new PrivacyError("NOT_AVAILABLE");
}
