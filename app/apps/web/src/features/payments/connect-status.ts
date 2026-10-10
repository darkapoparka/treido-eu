/** Safe account diagnostics. These never authorize a listing, quote or payment. */
export type ConnectStatus = {
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  cardPayments: string;
  transfers: string;
  currentlyDue: string[];
  pastDue: string[];
  pendingVerification: string[];
  disabledReason: string | null;
  checkedAt: string;
  eventuallyDue: string[];
  requirementsDeadline: string | null;
  supportedAccount: boolean;
  platformAccountReady: boolean;
  sellerAccountReady: boolean;
};
export type ConnectStatusState =
  | "unsupported"
  | "restricted"
  | "action_required"
  | "under_review"
  | "capabilities_ready"
  | "pending";
export function canReadConnectStatus(capabilities: readonly string[]) {
  return (
    capabilities.includes("billing.manage") ||
    capabilities.includes("payment.setup")
  );
}
export function connectStatusState(facts: ConnectStatus): ConnectStatusState {
  if (!facts.supportedAccount) return "unsupported";
  if (
    facts.disabledReason &&
    !facts.currentlyDue.length &&
    !facts.pastDue.length &&
    !facts.pendingVerification.length
  )
    return "restricted";
  if (
    facts.pastDue.length ||
    facts.currentlyDue.length ||
    !facts.detailsSubmitted
  )
    return "action_required";
  if (facts.platformAccountReady || facts.sellerAccountReady)
    return "capabilities_ready";
  if (facts.pendingVerification.length) return "under_review";
  if (facts.disabledReason) return "restricted";
  return "pending";
}
export function connectRequirementGroups(facts: ConnectStatus) {
  // One field appears in its most urgent group, never twice as unfinished work.
  const pastDue = [...new Set(facts.pastDue)];
  const current = [...new Set(facts.currentlyDue)].filter(
    (field) => !pastDue.includes(field),
  );
  const verification = [...new Set(facts.pendingVerification)].filter(
    (field) => !pastDue.includes(field) && !current.includes(field),
  );
  const later = [...new Set(facts.eventuallyDue)].filter(
    (field) =>
      !pastDue.includes(field) &&
      !current.includes(field) &&
      !verification.includes(field),
  );
  return { pastDue, current, verification, later };
}
