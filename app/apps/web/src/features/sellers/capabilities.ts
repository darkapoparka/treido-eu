import "server-only";

// Facts must come from a verified server session and current app-owned rows.
// These types, role templates and projections are not authentication evidence.
export type SellerActorFacts = Readonly<{
  userId: string;
  session: "verified" | "expired";
  status: "active" | "restricted" | "disabled";
  recentlyAuthenticated: boolean;
}>;

export type SellerAccountFacts =
  | Readonly<{
      id: string;
      kind: "personal";
      status: "active" | "restricted" | "closed";
      ownerUserId: string;
    }>
  | Readonly<{
      id: string;
      kind: "business";
      status: "active" | "restricted" | "closed";
    }>;

export type SellerMembershipFacts = Readonly<{
  userId: string;
  sellerId: string;
  status: "active" | "invited" | "revoked";
  role: "owner" | "manager" | "member";
  grants: readonly string[];
}>;

export type SellerAuthorityFacts = Readonly<{
  actor: SellerActorFacts | null;
  sellerId: string;
  seller: SellerAccountFacts | null;
  membership: SellerMembershipFacts | null;
}>;

export const SELLER_CAPABILITIES = Object.freeze([
  "seller.read",
  "listing.read",
  "listing.write",
  "listing.publish",
  "inbox.read",
  "inbox.reply",
  "inventory.manage",
  "import.run",
  "order.read",
  "order.fulfil",
  "analytics.read",
  "profile.manage",
  "declaration.manage",
  "delivery.manage",
  "billing.manage",
  "payment.setup",
  "refund.request",
  "team.manage",
  "ownership.transfer",
  "business.close",
] as const);

export type SellerCapability = (typeof SELLER_CAPABILITIES)[number];
export type SellerAuthorityReason =
  | "UNAUTHENTICATED"
  | "ACTOR_RESTRICTED"
  | "SELLER_ACCESS_DENIED"
  | "SELLER_RESTRICTED"
  | "SELLER_CLOSED"
  | "CAPABILITY_REQUIRED"
  | "RECENT_AUTHENTICATION_REQUIRED";

export type SellerCapabilityDecision =
  { allowed: true } | { allowed: false; reason: SellerAuthorityReason };

export type SellerCapabilities =
  | { authorized: true; capabilities: readonly SellerCapability[] }
  | {
      authorized: false;
      capabilities: readonly [];
      reason: SellerAuthorityReason;
    };

const businessOnly: readonly SellerCapability[] = [
  "inventory.manage",
  "import.run",
  "team.manage",
  "ownership.transfer",
  "business.close",
];
const ownerOnly: readonly SellerCapability[] = [
  "ownership.transfer",
  "business.close",
];
const managerDefaults: readonly SellerCapability[] = [
  "seller.read",
  "listing.read",
  "listing.write",
  "listing.publish",
  "inbox.read",
  "inbox.reply",
  "inventory.manage",
];
const recentAuthenticationRequired: readonly SellerCapability[] = [
  "payment.setup",
  "ownership.transfer",
  "business.close",
];

export function resolveSellerCapabilities(
  facts: SellerAuthorityFacts,
): SellerCapabilities {
  const deny = (reason: SellerAuthorityReason): SellerCapabilities => ({
    authorized: false,
    capabilities: [],
    reason,
  });
  const { actor, seller, membership } = facts;
  if (!actor?.userId || actor.session !== "verified")
    return deny("UNAUTHENTICATED");
  if (actor.status !== "active") return deny("ACTOR_RESTRICTED");
  if (!facts.sellerId || !seller || seller.id !== facts.sellerId)
    return deny("SELLER_ACCESS_DENIED");

  let capabilities: readonly SellerCapability[];
  if (seller.kind === "personal") {
    if (seller.ownerUserId !== actor.userId)
      return deny("SELLER_ACCESS_DENIED");
    capabilities = SELLER_CAPABILITIES.filter(
      (capability) => !businessOnly.includes(capability),
    );
  } else if (seller.kind === "business") {
    if (
      !membership ||
      membership.userId !== actor.userId ||
      membership.sellerId !== seller.id ||
      membership.status !== "active" ||
      !["owner", "manager", "member"].includes(membership.role) ||
      !Array.isArray(membership.grants)
    )
      return deny("SELLER_ACCESS_DENIED");
    capabilities = SELLER_CAPABILITIES.filter((capability) => {
      if (membership.role === "owner") return true;
      if (ownerOnly.includes(capability)) return false;
      if (membership.role === "member" && capability === "team.manage")
        return false;
      return (
        (membership.role === "manager" &&
          managerDefaults.includes(capability)) ||
        membership.grants.includes(capability)
      );
    });
  } else return deny("SELLER_ACCESS_DENIED");

  // Check private seller state only after ownership/current membership.
  if (seller.status === "restricted") return deny("SELLER_RESTRICTED");
  if (seller.status === "closed") return deny("SELLER_CLOSED");
  if (seller.status !== "active") return deny("SELLER_ACCESS_DENIED");
  return { authorized: true, capabilities };
}

export function checkSellerCapability(
  facts: SellerAuthorityFacts,
  capability: SellerCapability,
): SellerCapabilityDecision {
  const result = resolveSellerCapabilities(facts);
  if (!result.authorized) return { allowed: false, reason: result.reason };
  if (!result.capabilities.includes(capability))
    return { allowed: false, reason: "CAPABILITY_REQUIRED" };
  if (
    recentAuthenticationRequired.includes(capability) &&
    facts.actor?.recentlyAuthenticated !== true
  )
    return { allowed: false, reason: "RECENT_AUTHENTICATION_REQUIRED" };
  return { allowed: true };
}
