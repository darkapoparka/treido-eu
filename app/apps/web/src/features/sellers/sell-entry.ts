import "server-only";

import {
  checkSellerCapability,
  type SellerAccountFacts,
  type SellerActorFacts,
  type SellerMembershipFacts,
} from "./capabilities";
import {
  evaluateSellerReadiness,
  type SellerNextAction,
  type SellerReadinessFacts,
  type SellerReadinessReason,
} from "./readiness";

export type SellIntent =
  | { kind: "personal" }
  | { kind: "business" }
  | { kind: "new_listing"; sellerId: string }
  | { kind: "edit_draft"; sellerId: string; draftId: string };

export type SellContinuation = Readonly<{
  intent: SellIntent;
  language: "bg" | "en" | null;
  target: string;
}>;

type Lookup<T> =
  | { status: "found"; value: T }
  | { status: "absent" }
  | { status: "unavailable" };

export type SellEntryFacts = Readonly<{
  actor: SellerActorFacts | null;
  personalSeller?: Lookup<SellerAccountFacts>;
  requestedSeller?: Lookup<SellerAccountFacts>;
  membership?: SellerMembershipFacts | null;
  draft?: Lookup<
    Readonly<{
      id: string;
      sellerId: string;
      status: "draft" | "published" | "withdrawn" | "deleted" | "restricted";
    }>
  >;
  readiness?: SellerReadinessFacts;
}>;

type SellEntryReason =
  | SellerReadinessReason
  | "INVALID_CONTINUATION"
  | "DRAFT_ACCESS_DENIED"
  | "DRAFT_DELETED";
export type SellEntryDecision =
  | { status: "sign_in"; continuation: string }
  | {
      status: "mutation_required";
      destination: string;
      continuation: string;
      nextMutation: "ensure_personal_seller" | "create_business_seller";
    }
  | {
      status: "editor";
      destination: string;
      nextMutation: { type: "create_listing_draft"; sellerId: string } | null;
    }
  | {
      status: "blocked";
      reasonCodes: readonly SellEntryReason[];
      nextActions: readonly (SellerNextAction | "restart_sell")[];
    };

const resourceId = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export function parseSellContinuation(
  value: unknown,
):
  | { ok: true; continuation: SellContinuation }
  | { ok: false; code: "INVALID_CONTINUATION" } {
  const invalid = { ok: false, code: "INVALID_CONTINUATION" } as const;
  // Only canonical URLs produced by these routes are accepted. In particular,
  // never decode/normalize an arbitrary URL before applying the route allowlist.
  if (
    typeof value !== "string" ||
    value.length > 512 ||
    /[%\\#\s\u0000-\u001f\u007f-\uffff]/.test(value)
  )
    return invalid;
  const parts = value.split("?");
  if (parts.length > 2) return invalid;
  const [path, query] = parts;
  let intent: SellIntent;
  if (path === "/sell") intent = { kind: "personal" };
  else {
    const match =
      /^\/app\/sellers\/([^/]+)\/listings\/(new|([^/]+)\/edit)$/.exec(path);
    if (
      !match ||
      !resourceId.test(match[1]) ||
      (match[3] && !resourceId.test(match[3]))
    )
      return invalid;
    intent = match[3]
      ? { kind: "edit_draft", sellerId: match[1], draftId: match[3] }
      : { kind: "new_listing", sellerId: match[1] };
  }
  const params = new URLSearchParams(query);
  const seen = new Set<string>();
  for (const [key, item] of params) {
    if (seen.has(key)) return invalid;
    seen.add(key);
    if (key === "lang" && (item === "bg" || item === "en")) continue;
    if (
      key === "intent" &&
      path === "/sell" &&
      (item === "personal" || item === "business")
    ) {
      intent = { kind: item };
      continue;
    }
    return invalid;
  }
  const language = params.get("lang") as "bg" | "en" | null;
  const canonical = new URLSearchParams();
  if (intent.kind === "business") canonical.set("intent", "business");
  if (language) canonical.set("lang", language);
  const suffix = canonical.size ? `?${canonical}` : "";
  return {
    ok: true,
    continuation: { intent, language, target: path + suffix },
  };
}

// Read-only routing policy. Every named mutation must independently authenticate,
// reload ownership/membership and enforce quota/revisions in its transaction.
export function resolveSellEntry(
  rawContinuation: unknown,
  facts: SellEntryFacts,
): SellEntryDecision {
  const blocked = (
    reason: SellEntryReason,
    action: SellerNextAction | "restart_sell",
  ): SellEntryDecision => ({
    status: "blocked",
    reasonCodes: [reason],
    nextActions: [action],
  });
  const parsed = parseSellContinuation(rawContinuation);
  if (!parsed.ok) return blocked(parsed.code, "restart_sell");
  const { intent, language, target } = parsed.continuation;
  const actor = facts.actor;
  if (!actor?.userId || actor.session !== "verified")
    return { status: "sign_in", continuation: target };
  if (actor.status !== "active")
    return blocked("ACTOR_RESTRICTED", "contact_support");
  const locale = language ? `?lang=${language}` : "";
  if (intent.kind === "business")
    return {
      status: "mutation_required",
      destination: `/app/onboarding?intent=business${language ? `&lang=${language}` : ""}`,
      continuation: target,
      nextMutation: "create_business_seller",
    };
  const lookup =
    intent.kind === "personal" ? facts.personalSeller : facts.requestedSeller;
  if (!lookup || lookup.status === "unavailable")
    return blocked("FACTS_UNAVAILABLE", "retry");
  if (lookup.status === "absent") {
    if (intent.kind !== "personal")
      return blocked("SELLER_ACCESS_DENIED", "choose_seller");
    return {
      status: "mutation_required",
      destination: `/app${locale}`,
      continuation: target,
      nextMutation: "ensure_personal_seller",
    };
  }
  if (lookup.status !== "found" || !resourceId.test(lookup.value?.id ?? ""))
    return blocked("SELLER_ACCESS_DENIED", "choose_seller");
  const seller = lookup.value;
  if (intent.kind === "personal" && seller.kind !== "personal")
    return blocked("SELLER_ACCESS_DENIED", "choose_seller");
  const authority = {
    actor,
    sellerId: intent.kind === "personal" ? seller.id : intent.sellerId,
    seller,
    membership: facts.membership ?? null,
  };
  const permission = checkSellerCapability(authority, "listing.write");
  if (!permission.allowed)
    return blocked(
      permission.reason,
      permission.reason === "SELLER_ACCESS_DENIED"
        ? "choose_seller"
        : permission.reason === "CAPABILITY_REQUIRED"
          ? "ask_owner"
          : "contact_support",
    );
  let destination = `/app/sellers/${seller.id}/listings/new${locale}`;
  if (intent.kind === "edit_draft") {
    const draft = facts.draft;
    if (!draft || draft.status === "unavailable")
      return blocked("FACTS_UNAVAILABLE", "retry");
    if (
      draft.status !== "found" ||
      draft.value?.id !== intent.draftId ||
      draft.value.sellerId !== seller.id
    )
      return blocked("DRAFT_ACCESS_DENIED", "restart_sell");
    if (draft.value.status === "deleted")
      return blocked("DRAFT_DELETED", "restart_sell");
    if (draft.value.status === "restricted")
      return blocked("OPERATION_RESTRICTED", "contact_support");
    if (!["draft", "published", "withdrawn"].includes(draft.value.status))
      return blocked("DRAFT_ACCESS_DENIED", "restart_sell");
    destination = `/app/sellers/${seller.id}/listings/${intent.draftId}/edit${locale}`;
  }
  const readiness = evaluateSellerReadiness(
    authority,
    "draft",
    facts.readiness ?? {},
  );
  if (readiness.status !== "allowed")
    return {
      status: "blocked",
      reasonCodes: readiness.reasonCodes,
      nextActions: readiness.nextActions,
    };
  return {
    status: "editor",
    destination,
    nextMutation:
      intent.kind === "edit_draft"
        ? null
        : { type: "create_listing_draft", sellerId: seller.id },
  };
}
