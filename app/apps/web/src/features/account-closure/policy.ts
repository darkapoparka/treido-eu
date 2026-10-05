import {
  categories,
  ClosureError,
  exact,
  object,
  type ClosurePolicy,
  type PolicyRule,
} from "./model";
function text(value: unknown): value is { bg: string; en: string } {
  return (
    object(value) &&
    exact(value, ["bg", "en"]) &&
    [value.bg, value.en].every(
      (v) => typeof v === "string" && v.trim().length > 0 && v.length <= 12000,
    )
  );
}
/** Technical validation only. Approval must come from the immutable owner-reviewed registry. */
export function parsePolicy(value: unknown): ClosurePolicy {
  if (
    !object(value) ||
    !exact(value, [
      "version",
      "approvalReference",
      "summary",
      "rules",
      "identity",
      "personalBilling",
      "preservesAcceptedEvidence",
      "reversibleBeforeEffects",
    ]) ||
    typeof value.version !== "string" ||
    !/^[a-zA-Z0-9._-]{1,100}$/.test(value.version) ||
    typeof value.approvalReference !== "string" ||
    !value.approvalReference.trim() ||
    value.approvalReference.length > 500 ||
    !text(value.summary) ||
    !Array.isArray(value.rules) ||
    value.rules.length !== categories.length ||
    !["revoke", "delete"].includes(String(value.identity)) ||
    value.personalBilling !== "stop-renewal" ||
    value.preservesAcceptedEvidence !== true ||
    value.reversibleBeforeEffects !== true
  )
    throw new ClosureError("POLICY_REQUIRED");
  const rules: PolicyRule[] = [];
  for (const rule of value.rules) {
    if (
      !object(rule) ||
      !exact(rule, [
        "category",
        "handling",
        "purpose",
        "trigger",
        "delaySeconds",
        "explanation",
      ]) ||
      !categories.some((c) => c === rule.category) ||
      !["retain", "remove"].includes(String(rule.handling)) ||
      !["closure", "obligationsResolved"].includes(String(rule.trigger)) ||
      !text(rule.purpose) ||
      !text(rule.explanation) ||
      !(
        rule.delaySeconds === null ||
        (Number.isSafeInteger(rule.delaySeconds) &&
          Number(rule.delaySeconds) >= 0 &&
          Number(rule.delaySeconds) <= 2147483647)
      )
    )
      throw new ClosureError("POLICY_REQUIRED");
    if (
      ["commerceEvidence", "businessEvidence", "caseEvidence"].includes(
        String(rule.category),
      ) &&
      rule.handling !== "retain"
    )
      throw new ClosureError("POLICY_REQUIRED");
    if (
      rule.handling === "remove" &&
      (rule.delaySeconds === null || rule.trigger !== "closure")
    )
      throw new ClosureError("POLICY_REQUIRED");
    rules.push(rule as PolicyRule);
  }
  if (new Set(rules.map((r) => r.category)).size !== categories.length)
    throw new ClosureError("POLICY_REQUIRED");
  if (
    rules.find((rule) => rule.category === "identity")?.handling !==
    (value.identity === "delete" ? "remove" : "retain")
  )
    throw new ClosureError("POLICY_REQUIRED");
  return {
    version: value.version,
    approvalReference: value.approvalReference,
    summary: value.summary,
    rules,
    identity: value.identity as ClosurePolicy["identity"],
    personalBilling: "stop-renewal",
    preservesAcceptedEvidence: true,
    reversibleBeforeEffects: true,
  };
}
export function removalDelay(
  policy: ClosurePolicy,
  category: PolicyRule["category"],
) {
  const rule = policy.rules.find((r) => r.category === category);
  return rule?.handling === "remove" ? rule.delaySeconds : null;
}
