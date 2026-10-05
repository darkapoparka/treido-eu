import "server-only";
import type { SellerTransaction } from "../../server/db/database";
import { inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import type { AftercareChoice, Language } from "./model";
import type { OrderContext } from "./storage.server";
export type ServicePolicy = {
  id: string;
  version: number;
  terms: { bg: string; en: string };
  termsHash: string;
  retentionDescription: { bg: string; en: string };
  caseLimit: number;
  eventLimit: number;
  appealSeconds: number | null;
};
export type FinancialPolicy = {
  id: string;
  version: number;
  purpose: "goods_aftercare_v2";
  method: "pickup" | "shipping";
  refundContract: "bounded_partial_v2";
  terms: { bg: string; en: string };
  termsHash: string;
  executionSeconds: number;
  refundRequestLimit: number;
  taxBasis: "inclusive_unspecified";
  feeBasis: "original_proportional_provider_reversal";
  reverseTransfer: true;
  refundApplicationFee: true;
  trackingAllowed: boolean;
  recipientRetentionDescription: { bg: string; en: string };
};
export type RegistryScope = Pick<
  OrderContext,
  "policyId" | "platformAccount" | "livemode" | "environment" | "applicationId"
>;
export function servicePolicyHash(
  policy: Omit<ServicePolicy, "id" | "termsHash">,
) {
  return inputHash({
    format: "order-service-policy-v1",
    version: policy.version,
    terms: policy.terms,
    retentionDescription: policy.retentionDescription,
    caseLimit: policy.caseLimit,
    eventLimit: policy.eventLimit,
    appealSeconds: policy.appealSeconds,
  });
}
export function financialPolicyHash(
  policy: Omit<FinancialPolicy, "id" | "termsHash">,
) {
  return inputHash({
    format: "goods-aftercare-policy-v2",
    version: policy.version,
    purpose: policy.purpose,
    method: policy.method,
    refundContract: policy.refundContract,
    terms: policy.terms,
    executionSeconds: policy.executionSeconds,
    refundRequestLimit: policy.refundRequestLimit,
    taxBasis: policy.taxBasis,
    feeBasis: policy.feeBasis,
    reverseTransfer: policy.reverseTransfer,
    refundApplicationFee: policy.refundApplicationFee,
    trackingAllowed: policy.trackingAllowed,
    recipientRetentionDescription: policy.recipientRetentionDescription,
  });
}
export async function readServicePolicy(
  tx: SellerTransaction,
  scope: RegistryScope,
  id?: string,
): Promise<ServicePolicy | null> {
  const row = (
    await tx.client.query<ServicePolicy>(
      'SELECT id,version,terms,terms_hash AS "termsHash",retention_description AS "retentionDescription",case_limit AS "caseLimit",event_limit AS "eventLimit",appeal_seconds AS "appealSeconds" FROM treido.order_service_policies WHERE base_policy_id=$1 AND platform_account=$2 AND livemode=$3 AND environment=$4 AND application_id=$5 AND approved_at<=clock_timestamp() AND revoked_at IS NULL AND ($6::uuid IS NULL OR id=$6) ORDER BY version DESC LIMIT 1',
      [
        scope.policyId,
        scope.platformAccount,
        scope.livemode,
        scope.environment,
        scope.applicationId,
        id ?? null,
      ],
    )
  ).rows[0];
  if (!row) return null;
  const locked = (
    await tx.client.query<{ allowed: boolean }>(
      "SELECT treido.lock_order_aftercare_registry('service',$1,$2,$3,$4,$5,$6) AS allowed",
      [
        row.id,
        scope.policyId,
        scope.platformAccount,
        scope.livemode,
        scope.environment,
        scope.applicationId,
      ],
    )
  ).rows[0];
  if (!locked?.allowed) return null;
  if (servicePolicyHash(row) !== row.termsHash)
    throw new SellerError("NOT_AVAILABLE");
  return row;
}
export async function readFinancialPolicy(
  tx: SellerTransaction,
  scope: RegistryScope,
  id: string,
): Promise<FinancialPolicy | null> {
  const locked = (
    await tx.client.query<{ allowed: boolean }>(
      "SELECT treido.lock_order_aftercare_registry('financial',$1,$2,$3,$4,$5,$6) AS allowed",
      [
        id,
        scope.policyId,
        scope.platformAccount,
        scope.livemode,
        scope.environment,
        scope.applicationId,
      ],
    )
  ).rows[0];
  if (!locked?.allowed) return null;
  const row = (
    await tx.client.query<FinancialPolicy>(
      'SELECT id,version,purpose,method,refund_contract AS "refundContract",terms,terms_hash AS "termsHash",execution_seconds AS "executionSeconds",refund_request_limit AS "refundRequestLimit",tax_basis AS "taxBasis",fee_basis AS "feeBasis",reverse_transfer AS "reverseTransfer",refund_application_fee AS "refundApplicationFee",tracking_allowed AS "trackingAllowed",recipient_retention_description AS "recipientRetentionDescription" FROM treido.order_financial_policies WHERE id=$1',
      [id],
    )
  ).rows[0];
  if (
    !row ||
    financialPolicyHash(row) !== row.termsHash ||
    row.purpose !== "goods_aftercare_v2" ||
    row.refundContract !== "bounded_partial_v2" ||
    row.reverseTransfer !== true ||
    row.refundApplicationFee !== true
  )
    throw new SellerError("NOT_AVAILABLE");
  return row;
}
export async function acceptedFinancialPolicy(
  tx: SellerTransaction,
  order: OrderContext,
): Promise<FinancialPolicy | null> {
  const accepted = (
    await tx.client.query<{
      policyId: string;
      version: number;
      termsHash: string;
      method: string;
      buyerId: string;
      sellerId: string;
    }>(
      'SELECT policy_id AS "policyId",version,terms_hash AS "termsHash",method,buyer_id AS "buyerId",seller_id AS "sellerId" FROM treido.quote_aftercare_acceptances WHERE quote_id=$1',
      [order.quoteId],
    )
  ).rows[0];
  if (!accepted) return null;
  const policy = await readFinancialPolicy(tx, order, accepted.policyId);
  if (!policy) return null;
  if (
    accepted.version !== policy.version ||
    accepted.termsHash !== policy.termsHash ||
    accepted.method !== policy.method ||
    accepted.buyerId !== order.buyerId ||
    accepted.sellerId !== order.sellerId ||
    order.terms.handover !== policy.method
  )
    throw new SellerError("NOT_AVAILABLE");
  return policy;
}
export async function freezeNewQuoteAftercare(
  tx: SellerTransaction,
  scope: RegistryScope,
  choice: AftercareChoice | undefined,
  method: "pickup" | "shipping",
  language: Language,
) {
  if (!choice) return null;
  const policy = await readFinancialPolicy(tx, scope, choice.policyId);
  if (
    !policy ||
    policy.method !== method ||
    policy.version !== choice.version ||
    policy.termsHash !== choice.termsHash ||
    !choice.acknowledged
  )
    throw new SellerError("NOT_AVAILABLE");
  return {
    policy,
    terms: {
      format: "goods-aftercare-acceptance-v2",
      policyId: policy.id,
      version: policy.version,
      termsHash: policy.termsHash,
      choiceHash: inputHash(choice),
      method,
      buyerTerms: policy.terms[language],
    },
  };
}
export async function persistNewQuoteAftercare(
  tx: SellerTransaction,
  quoteId: string,
  buyerId: string,
  sellerId: string,
  language: Language,
  acceptance: NonNullable<Awaited<ReturnType<typeof freezeNewQuoteAftercare>>>,
) {
  await tx.client.query(
    "INSERT INTO treido.quote_aftercare_acceptances(quote_id,policy_id,buyer_id,seller_id,version,terms_hash,choice_hash,method,language) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    [
      quoteId,
      acceptance.policy.id,
      buyerId,
      sellerId,
      acceptance.policy.version,
      acceptance.policy.termsHash,
      acceptance.terms.choiceHash,
      acceptance.policy.method,
      language,
    ],
  );
}
