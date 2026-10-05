import { validId } from "../selling/draft-model";
import type { SellerCapability } from "../sellers/capabilities";

export const TEAM_GRANTS = [
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
  "marketing.manage",
  "billing.manage",
  "payment.setup",
  "refund.request",
  "team.manage",
] as const satisfies readonly SellerCapability[];
export type TeamRole = "manager" | "member";
export type TeamAccess = { role: TeamRole; grants: SellerCapability[] };
export function normalizeRecipient(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 &&
    /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(
      email,
    )
    ? email
    : null;
}
export function parseTeamAccess(value: unknown): TeamAccess | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (
    !["manager", "member"].includes(String(v.role)) ||
    !Array.isArray(v.grants) ||
    v.grants.length > TEAM_GRANTS.length ||
    v.grants.some((g) => !TEAM_GRANTS.includes(g)) ||
    new Set(v.grants).size !== v.grants.length ||
    !v.grants.includes("seller.read") ||
    (v.role === "member" && v.grants.includes("team.manage"))
  )
    return null;
  return { role: v.role as TeamRole, grants: [...v.grants].sort() };
}
export type TeamCommand = {
  sellerId: string;
  requestId: string;
  expectedRevision: number;
} & (
  | {
      kind: "invite";
      recipient: string;
      access: TeamAccess;
      language: "bg" | "en";
    }
  | { kind: "cancel"; invitationId: string }
  | { kind: "resend"; invitationId: string }
  | { kind: "change"; userId: string; access: TeamAccess }
  | { kind: "revoke"; userId: string }
);
export function validTeamCommand(input: TeamCommand) {
  if (
    !input ||
    !validId(input.sellerId) ||
    !validId(input.requestId) ||
    !Number.isSafeInteger(input.expectedRevision) ||
    input.expectedRevision < 0
  )
    return false;
  if (input.kind === "invite")
    return Boolean(
      normalizeRecipient(input.recipient) &&
      parseTeamAccess(input.access) &&
      ["bg", "en"].includes(input.language),
    );
  if (input.kind === "change")
    return Boolean(validId(input.userId) && parseTeamAccess(input.access));
  if (input.kind === "revoke") return validId(input.userId);
  return (
    ["cancel", "resend"].includes(input.kind) &&
    validId((input as { invitationId: string }).invitationId)
  );
}
export type TeamMember = {
  userId: string;
  role: "owner" | TeamRole;
  grants: SellerCapability[];
  revision: number;
  status: "active" | "revoked" | "invited";
  canChange: boolean;
  canRevoke: boolean;
  self: boolean;
};
export type TeamInvitation = {
  id: string;
  recipient: string;
  role: TeamRole;
  grants: SellerCapability[];
  status: "pending" | "accepted" | "cancelled" | "expired" | "declined";
  expiresAt: string;
  delivery: "pending" | "submitted" | "unavailable" | "uncertain" | "cancelled";
  canManage: boolean;
};
export type TeamView = {
  sellerId: string;
  name: string;
  revision: number;
  seats: number;
  usedSeats: number;
  reservedSeats: number;
  managerDefaults: SellerCapability[];
  delegable: SellerCapability[];
  canInviteManager: boolean;
  members: TeamMember[];
  invitations: TeamInvitation[];
};
export type IncomingInvitation = {
  id: string;
  sellerId: string;
  name: string;
  role: TeamRole;
  grants: SellerCapability[];
  expiresAt: string;
  status: TeamInvitation["status"];
  canAccept: boolean;
  canDecline: boolean;
  canOpen: boolean;
};

const capabilityMessages = {
  "seller.read": "capabilities.seller_read",
  "listing.read": "capabilities.listing_read",
  "listing.write": "capabilities.listing_write",
  "listing.publish": "capabilities.listing_publish",
  "inbox.read": "capabilities.inbox_read",
  "inbox.reply": "capabilities.inbox_reply",
  "inventory.manage": "capabilities.inventory_manage",
  "import.run": "capabilities.import_run",
  "order.read": "capabilities.order_read",
  "order.fulfil": "capabilities.order_fulfil",
  "analytics.read": "capabilities.analytics_read",
  "profile.manage": "capabilities.profile_manage",
  "declaration.manage": "capabilities.declaration_manage",
  "delivery.manage": "capabilities.delivery_manage",
  "marketing.manage": "capabilities.marketing_manage",
  "billing.manage": "capabilities.billing_manage",
  "payment.setup": "capabilities.payment_setup",
  "refund.request": "capabilities.refund_request",
  "team.manage": "capabilities.team_manage",
} as const;
export function capabilityMessageKey(capability: string) {
  return Object.hasOwn(capabilityMessages, capability)
    ? capabilityMessages[capability as keyof typeof capabilityMessages]
    : "permissions";
}
