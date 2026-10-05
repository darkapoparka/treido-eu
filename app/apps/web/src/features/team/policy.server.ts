import "server-only";
import {
  resolveSellerCapabilities,
  type SellerAuthorityFacts,
  type SellerCapability,
} from "../sellers/capabilities";
import { SellerError } from "../sellers/errors";
import type { TeamAccess } from "./model";

export function effectiveTeamAccess(
  authority: SellerAuthorityFacts,
  access: { role: "owner" | TeamAccess["role"]; grants: readonly string[] },
): readonly SellerCapability[] {
  if (!authority.actor) return [];
  const result = resolveSellerCapabilities({
    ...authority,
    membership: {
      userId: authority.actor.userId,
      sellerId: authority.sellerId,
      status: "active",
      ...access,
    },
  });
  return result.authorized ? result.capabilities : [];
}
export function canDelegateTeamAccess(
  authority: SellerAuthorityFacts,
  access: TeamAccess,
): boolean {
  const current = resolveSellerCapabilities(authority);
  return (
    current.authorized &&
    current.capabilities.includes("team.manage") &&
    effectiveTeamAccess(authority, access).every((capability) =>
      current.capabilities.includes(capability),
    )
  );
}
export function assertDelegableTeamAccess(
  authority: SellerAuthorityFacts,
  access: TeamAccess,
) {
  if (!canDelegateTeamAccess(authority, access))
    throw new SellerError("FORBIDDEN");
}
/** Persisted issuer authority is not an issuer session. The verified recipient's
 * actor is used only to project role templates in this business; no offline
 * issuer authentication or recent-auth evidence is invented. */
export function canIssuerDelegateTeamAccess(
  recipientAuthority: SellerAuthorityFacts,
  issuer: { status: string },
  membership:
    | {
        status: string;
        role: "owner" | TeamAccess["role"];
        grants: readonly string[];
      }
    | undefined,
  access: TeamAccess,
) {
  if (issuer.status !== "active" || membership?.status !== "active")
    return false;
  const current = effectiveTeamAccess(recipientAuthority, {
    role: membership.role,
    grants: membership.grants,
  });
  return (
    current.includes("team.manage") &&
    effectiveTeamAccess(recipientAuthority, access).every((capability) =>
      current.includes(capability),
    )
  );
}
export function canManageTeamMember(
  authority: SellerAuthorityFacts,
  target: {
    userId: string;
    role: "owner" | TeamAccess["role"];
    grants: readonly string[];
  },
) {
  if (!authority.actor || target.userId === authority.actor.userId)
    return false;
  if (authority.membership?.role === "owner") return true;
  return (
    target.role !== "owner" &&
    canDelegateTeamAccess(authority, {
      role: target.role,
      grants: [...target.grants] as SellerCapability[],
    })
  );
}
