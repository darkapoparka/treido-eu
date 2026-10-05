import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { paymentBindings } from "../payments/bindings.server";
import { approvedPolicy } from "../payments/registry.server";
import { aftercareStorageAvailable } from "./storage.server";
import { readFinancialPolicy } from "./policy.server";
export type NewQuoteAftercareChoice = {
  policyId: string;
  version: number;
  termsHash: string;
  terms: string;
  retentionDescription: string;
};
export async function readNewQuoteAftercareChoice(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  basePolicyId: string,
  language: "bg" | "en",
): Promise<{ available: boolean; choice: NewQuoteAftercareChoice | null }> {
  if (!validId(basePolicyId) || (language !== "bg" && language !== "en"))
    throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    await authorizeHuman(tx, identity, false);
    if (!(await aftercareStorageAvailable(tx)))
      return { available: false, choice: null };
    const binding = paymentBindings();
    await approvedPolicy(tx, basePolicyId, binding);
    const candidate = (
      await tx.client.query<{ id: string }>(
        "SELECT id FROM treido.order_financial_policies WHERE base_policy_id=$1 AND platform_account=$2 AND livemode=$3 AND environment=$4 AND application_id=$5 AND method='pickup' AND approved_at<=clock_timestamp() AND revoked_at IS NULL ORDER BY version DESC LIMIT 1",
        [
          basePolicyId,
          binding.platformAccount,
          binding.livemode,
          binding.environment,
          binding.applicationId,
        ],
      )
    ).rows[0];
    if (!candidate) return { available: false, choice: null };
    const policy = await readFinancialPolicy(
      tx,
      {
        policyId: basePolicyId,
        platformAccount: binding.platformAccount,
        livemode: binding.livemode,
        environment: binding.environment,
        applicationId: binding.applicationId,
      },
      candidate.id,
    );
    if (!policy) return { available: false, choice: null };
    return {
      available: true,
      choice: {
        policyId: policy.id,
        version: policy.version,
        termsHash: policy.termsHash,
        terms: policy.terms[language],
        retentionDescription: policy.recipientRetentionDescription[language],
      },
    };
  });
}
