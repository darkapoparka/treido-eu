import { validId } from "../selling/draft-model";

export type BillingRecoveryCommand = {
  sellerId: string;
  actorKey: string;
  intentId: string;
  requestId: string;
  expectedRevision: number;
  operation: "observe" | "abandon" | "escalate";
};
export function parseBillingRecovery(
  value: unknown,
): BillingRecoveryCommand | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const x = value as Record<string, unknown>;
  if (
    Object.keys(x).some(
      (k) =>
        ![
          "sellerId",
          "actorKey",
          "intentId",
          "requestId",
          "expectedRevision",
          "operation",
        ].includes(k),
    ) ||
    !validId(x.sellerId) ||
    !validId(x.intentId) ||
    !validId(x.requestId) ||
    typeof x.actorKey !== "string" ||
    !/^[a-f0-9]{64}$/.test(x.actorKey) ||
    !Number.isSafeInteger(x.expectedRevision) ||
    (x.expectedRevision as number) < 0 ||
    !["observe", "abandon", "escalate"].includes(String(x.operation))
  )
    return null;
  return x as BillingRecoveryCommand;
}
export function pendingChange(parameters: Record<string, unknown>) {
  return (
    parameters.payment_behavior === "pending_if_incomplete" &&
    parameters.proration_behavior === "always_invoice"
  );
}
/** No clock or unchanged-price inference can retire an attempted change. */
export function changeResolution(facts: {
  legacy: boolean;
  subscriptionTerminal: boolean;
  hasPendingUpdate: boolean;
  targetApplied: boolean;
  invoiceStatus: string | null;
  invoiceMatches: boolean;
}): "complete" | "expired" | null {
  if (facts.subscriptionTerminal) return "expired";
  if (facts.legacy || !facts.invoiceMatches || facts.hasPendingUpdate)
    return null;
  if (facts.invoiceStatus === "paid" && facts.targetApplied) return "complete";
  if (facts.invoiceStatus === "void") return "expired";
  return null;
}

/** Browser recovery only remembers the original request; it is not authority.
 * Missing, blocked or corrupt storage must not prevent an explicit command.
 * Keep an older expectedRevision when replaying the exact original request. */
export function restoreBillingRecovery(
  scope: Pick<
    BillingRecoveryCommand,
    "sellerId" | "actorKey" | "intentId" | "operation"
  >,
  ...candidates: unknown[]
): BillingRecoveryCommand | null {
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const command = parseBillingRecovery(
        typeof candidate === "string" ? JSON.parse(candidate) : candidate,
      );
      if (
        command &&
        command.sellerId === scope.sellerId &&
        command.actorKey === scope.actorKey &&
        command.intentId === scope.intentId &&
        command.operation === scope.operation
      )
        return command;
    } catch {
      /* Invalid optional browser state is not a failed financial command. */
    }
  }
  return null;
}
