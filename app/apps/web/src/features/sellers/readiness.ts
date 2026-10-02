import "server-only";

import {
  checkSellerCapability,
  resolveSellerCapabilities,
  type SellerAuthorityFacts,
  type SellerAuthorityReason,
  type SellerCapability,
} from "./capabilities";

export type SellerOperation =
  "draft" | "publish" | "checkout" | "payout" | "support";
type QuotaEligibility = "available" | "exhausted" | "unavailable";
type ProviderEligibility =
  | "ready"
  | "action_required"
  | "disabled"
  | "unsupported"
  | "stale"
  | "unavailable";
export type SellerSupportCapability =
  | "order.read"
  | "order.fulfil"
  | "inbox.read"
  | "inbox.reply"
  | "refund.request";

// Normalized current policy/provider observations, not browser setup flags.
// Version/expiry comparison belongs to the trusted adapter. Commands reload
// these facts under their transaction locks; an allowed projection is no lock.
export type SellerReadinessFacts = Readonly<{
  restrictions?: Partial<
    Record<SellerOperation, "clear" | "blocked" | "operator_only">
  > | null;
  draft?: Readonly<{ quota: QuotaEligibility }> | null;
  publication?: Readonly<{
    country: "supported" | "unsupported" | "unavailable";
    declarations:
      | "current"
      | "required"
      | "review_required"
      | "rejected"
      | "stale"
      | "unavailable";
    category:
      "reviewed" | "unreviewed" | "unsupported" | "stale" | "unavailable";
    listing: "valid" | "incomplete" | "unavailable";
    media: "ready" | "pending" | "failed" | "unavailable";
    quota: QuotaEligibility;
    moderation:
      "eligible" | "pending" | "restricted" | "removed" | "unavailable";
  }> | null;
  checkout?: Readonly<{
    order: "eligible" | "blocked" | "unavailable";
    payments: ProviderEligibility;
    payouts: ProviderEligibility;
    terms: "current" | "required" | "stale" | "unavailable";
    allocation: "available" | "exhausted" | "unavailable";
  }> | null;
  payout?: Readonly<{
    provider: ProviderEligibility;
    settlement: "eligible" | "pending" | "held" | "unsupported" | "unavailable";
  }> | null;
  support?: Readonly<{
    capability: SellerSupportCapability;
    lifecycle: "permitted" | "blocked" | "operator_only" | "unavailable";
  }> | null;
}>;

export type SellerReadinessReason =
  | SellerAuthorityReason
  | "FACTS_UNAVAILABLE"
  | "OPERATION_RESTRICTED"
  | "OPERATOR_RECOVERY_REQUIRED"
  | "DRAFT_QUOTA_EXCEEDED"
  | "PUBLICATION_QUOTA_EXCEEDED"
  | "COUNTRY_UNSUPPORTED"
  | "DECLARATION_REQUIRED"
  | "DECLARATION_REVIEW_REQUIRED"
  | "DECLARATION_REJECTED"
  | "DECLARATION_STALE"
  | "CATEGORY_UNREVIEWED"
  | "CATEGORY_UNSUPPORTED"
  | "CATEGORY_POLICY_STALE"
  | "LISTING_INCOMPLETE"
  | "MEDIA_NOT_READY"
  | "MEDIA_FAILED"
  | "MODERATION_PENDING"
  | "LISTING_RESTRICTED"
  | "LISTING_REMOVED"
  | "ORDER_INELIGIBLE"
  | "PAYMENT_SETUP_REQUIRED"
  | "PAYMENTS_DISABLED"
  | "PAYMENTS_UNSUPPORTED"
  | "PAYOUT_SETUP_REQUIRED"
  | "PAYOUTS_DISABLED"
  | "PAYOUTS_UNSUPPORTED"
  | "PROVIDER_STATUS_STALE"
  | "PROVIDER_UNAVAILABLE"
  | "CHECKOUT_TERMS_REQUIRED"
  | "CHECKOUT_TERMS_STALE"
  | "STOCK_UNAVAILABLE"
  | "SETTLEMENT_PENDING"
  | "SETTLEMENT_HELD"
  | "SETTLEMENT_POLICY_UNSUPPORTED"
  | "SUPPORT_ACTION_NOT_PERMITTED";

export type SellerNextAction =
  | "sign_in"
  | "reauthenticate"
  | "choose_seller"
  | "contact_support"
  | "ask_owner"
  | "retry"
  | "review_usage"
  | "complete_declarations"
  | "edit_listing"
  | "check_media"
  | "wait_for_review"
  | "configure_payments"
  | "configure_delivery"
  | "review_inventory"
  | "wait_for_settlement";

export type SellerReadiness = Readonly<{
  operation: SellerOperation;
  status: "allowed" | "blocked";
  reasonCodes: readonly SellerReadinessReason[];
  nextActions: readonly SellerNextAction[];
}>;

const operationCapabilities = {
  draft: "listing.write",
  publish: "listing.publish",
  checkout: "listing.publish",
  payout: "billing.manage",
} as const;
const supportCapabilities: readonly SellerSupportCapability[] = [
  "order.read",
  "order.fulfil",
  "inbox.read",
  "inbox.reply",
  "refund.request",
];

export function evaluateSellerReadiness(
  authority: SellerAuthorityFacts,
  operation: SellerOperation,
  facts: SellerReadinessFacts,
): SellerReadiness {
  const reasons = new Set<SellerReadinessReason>();
  const finish = (): SellerReadiness => ({
    operation,
    status: reasons.size === 0 ? "allowed" : "blocked",
    reasonCodes: [...reasons],
    nextActions: readinessActions(authority, [...reasons]),
  });
  const access = resolveSellerCapabilities(authority);
  if (!access.authorized) {
    reasons.add(access.reason);
    return finish();
  }
  const capability =
    operation === "support"
      ? facts.support?.capability
      : operationCapabilities[operation];
  if (
    !capability ||
    (operation === "support" &&
      !supportCapabilities.includes(capability as SellerSupportCapability))
  ) {
    reasons.add("FACTS_UNAVAILABLE");
    return finish();
  }
  const permission = checkSellerCapability(authority, capability);
  if (!permission.allowed) {
    reasons.add(permission.reason);
    return finish();
  }
  const check = (
    state: string | undefined,
    allowed: string,
    denied: Readonly<Record<string, SellerReadinessReason>>,
  ) => {
    if (state !== allowed)
      reasons.add(
        state && Object.hasOwn(denied, state)
          ? denied[state]
          : "FACTS_UNAVAILABLE",
      );
  };
  check(facts.restrictions?.[operation], "clear", {
    blocked: "OPERATION_RESTRICTED",
    operator_only: "OPERATOR_RECOVERY_REQUIRED",
  });
  if (operation === "checkout") {
    check(facts.restrictions?.publish, "clear", {
      blocked: "OPERATION_RESTRICTED",
      operator_only: "OPERATOR_RECOVERY_REQUIRED",
    });
  }
  // An operator-only/restricted operation offers recovery, not setup actions.
  if (reasons.size > 0) return finish();
  if (operation === "draft") {
    // The adapter computes eligibility for this create/save, not a plan label.
    check(facts.draft?.quota, "available", {
      exhausted: "DRAFT_QUOTA_EXCEEDED",
    });
  }
  if (operation === "publish" || operation === "checkout") {
    const publication = facts.publication;
    check(publication?.country, "supported", {
      unsupported: "COUNTRY_UNSUPPORTED",
    });
    check(publication?.declarations, "current", {
      required: "DECLARATION_REQUIRED",
      review_required: "DECLARATION_REVIEW_REQUIRED",
      rejected: "DECLARATION_REJECTED",
      stale: "DECLARATION_STALE",
    });
    check(publication?.category, "reviewed", {
      unreviewed: "CATEGORY_UNREVIEWED",
      unsupported: "CATEGORY_UNSUPPORTED",
      stale: "CATEGORY_POLICY_STALE",
    });
    check(publication?.listing, "valid", { incomplete: "LISTING_INCOMPLETE" });
    check(publication?.media, "ready", {
      pending: "MEDIA_NOT_READY",
      failed: "MEDIA_FAILED",
    });
    check(publication?.quota, "available", {
      exhausted: "PUBLICATION_QUOTA_EXCEEDED",
    });
    check(publication?.moderation, "eligible", {
      pending: "MODERATION_PENDING",
      restricted: "LISTING_RESTRICTED",
      removed: "LISTING_REMOVED",
    });
  }
  const provider = (state: ProviderEligibility | undefined, payout: boolean) =>
    check(state, "ready", {
      action_required: payout
        ? "PAYOUT_SETUP_REQUIRED"
        : "PAYMENT_SETUP_REQUIRED",
      disabled: payout ? "PAYOUTS_DISABLED" : "PAYMENTS_DISABLED",
      unsupported: payout ? "PAYOUTS_UNSUPPORTED" : "PAYMENTS_UNSUPPORTED",
      stale: "PROVIDER_STATUS_STALE",
      unavailable: "PROVIDER_UNAVAILABLE",
    });
  if (operation === "checkout") {
    check(facts.checkout?.order, "eligible", { blocked: "ORDER_INELIGIBLE" });
    provider(facts.checkout?.payments, false);
    provider(facts.checkout?.payouts, true);
    check(facts.checkout?.terms, "current", {
      required: "CHECKOUT_TERMS_REQUIRED",
      stale: "CHECKOUT_TERMS_STALE",
    });
    check(facts.checkout?.allocation, "available", {
      exhausted: "STOCK_UNAVAILABLE",
    });
  }
  if (operation === "payout") {
    provider(facts.payout?.provider, true);
    check(facts.payout?.settlement, "eligible", {
      pending: "SETTLEMENT_PENDING",
      held: "SETTLEMENT_HELD",
      unsupported: "SETTLEMENT_POLICY_UNSUPPORTED",
    });
  }
  if (operation === "support") {
    check(facts.support?.lifecycle, "permitted", {
      blocked: "SUPPORT_ACTION_NOT_PERMITTED",
      operator_only: "OPERATOR_RECOVERY_REQUIRED",
    });
  }
  return finish();
}

function readinessActions(
  authority: SellerAuthorityFacts,
  reasons: readonly SellerReadinessReason[],
): SellerNextAction[] {
  const actions = new Set<SellerNextAction>();
  const permitted = (
    action: SellerNextAction,
    capability: SellerCapability,
  ) => {
    const decision = checkSellerCapability(authority, capability);
    actions.add(
      decision.allowed
        ? action
        : decision.reason === "RECENT_AUTHENTICATION_REQUIRED"
          ? "reauthenticate"
          : "ask_owner",
    );
  };
  for (const reason of reasons) {
    switch (reason) {
      case "UNAUTHENTICATED":
        actions.add("sign_in");
        break;
      case "RECENT_AUTHENTICATION_REQUIRED":
        actions.add("reauthenticate");
        break;
      case "SELLER_ACCESS_DENIED":
        actions.add("choose_seller");
        break;
      case "CAPABILITY_REQUIRED":
        actions.add("ask_owner");
        break;
      case "FACTS_UNAVAILABLE":
      case "PROVIDER_UNAVAILABLE":
      case "PROVIDER_STATUS_STALE":
        actions.add("retry");
        break;
      case "DRAFT_QUOTA_EXCEEDED":
      case "PUBLICATION_QUOTA_EXCEEDED":
        permitted("review_usage", "billing.manage");
        break;
      case "DECLARATION_REQUIRED":
      case "DECLARATION_STALE":
        permitted("complete_declarations", "declaration.manage");
        break;
      case "CATEGORY_UNREVIEWED":
      case "CATEGORY_UNSUPPORTED":
      case "CATEGORY_POLICY_STALE":
      case "LISTING_INCOMPLETE":
        permitted("edit_listing", "listing.write");
        break;
      case "MEDIA_NOT_READY":
      case "MEDIA_FAILED":
        permitted("check_media", "listing.write");
        break;
      case "MODERATION_PENDING":
      case "DECLARATION_REVIEW_REQUIRED":
        actions.add("wait_for_review");
        break;
      case "PAYMENT_SETUP_REQUIRED":
      case "PAYOUT_SETUP_REQUIRED":
        permitted("configure_payments", "payment.setup");
        break;
      case "CHECKOUT_TERMS_REQUIRED":
      case "CHECKOUT_TERMS_STALE":
        permitted("configure_delivery", "delivery.manage");
        break;
      case "STOCK_UNAVAILABLE":
        permitted(
          authority.seller?.kind === "personal"
            ? "edit_listing"
            : "review_inventory",
          authority.seller?.kind === "personal"
            ? "listing.write"
            : "inventory.manage",
        );
        break;
      case "SETTLEMENT_PENDING":
        actions.add("wait_for_settlement");
        break;
      default:
        actions.add("contact_support");
    }
  }
  return [...actions];
}
