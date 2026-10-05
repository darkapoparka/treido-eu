import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { canIssuerDelegateTeamAccess } from "./policy.server";
import type { SellerAuthorityFacts } from "../sellers/capabilities";

const recipient: SellerAuthorityFacts = {
  actor: {
    userId: "recipient",
    status: "active",
    session: "verified",
    recentlyAuthenticated: false,
  },
  sellerId: "business",
  seller: { id: "business", kind: "business", status: "active" },
  membership: null,
};
describe("offline invitation issuer policy", () => {
  it.each(["restricted", "closed", "disabled"])(
    "denies a %s issuer without assigning them a session",
    (status) => {
      expect(
        canIssuerDelegateTeamAccess(
          recipient,
          { status },
          { status: "active", role: "owner", grants: [] },
          { role: "member", grants: ["seller.read"] },
        ),
      ).toBe(false);
    },
  );
  it("uses canonical manager defaults and current explicit grants for delegation", () => {
    const membership = {
      status: "active",
      role: "manager" as const,
      grants: ["team.manage"],
    };
    expect(
      canIssuerDelegateTeamAccess(recipient, { status: "active" }, membership, {
        role: "manager",
        grants: ["seller.read"],
      }),
    ).toBe(true);
    expect(
      canIssuerDelegateTeamAccess(recipient, { status: "active" }, membership, {
        role: "member",
        grants: ["seller.read", "billing.manage"],
      }),
    ).toBe(false);
    expect(
      canIssuerDelegateTeamAccess(
        recipient,
        { status: "active" },
        { ...membership, status: "revoked" },
        { role: "member", grants: ["seller.read"] },
      ),
    ).toBe(false);
    expect(
      canIssuerDelegateTeamAccess(
        recipient,
        { status: "active" },
        { ...membership, role: "member" },
        { role: "member", grants: ["seller.read"] },
      ),
    ).toBe(false);
  });
  it("keeps owner delegation and the actual recipient authentication gate", () => {
    const owner = { status: "active", role: "owner" as const, grants: [] };
    expect(
      canIssuerDelegateTeamAccess(recipient, { status: "active" }, owner, {
        role: "member",
        grants: ["seller.read", "billing.manage"],
      }),
    ).toBe(true);
    expect(
      canIssuerDelegateTeamAccess(
        { ...recipient, actor: null },
        { status: "active" },
        owner,
        { role: "member", grants: ["seller.read"] },
      ),
    ).toBe(false);
  });
  it("projects database membership rows without copying their issuer user ID into recipient facts", () => {
    const row = {
      userId: "offline-issuer",
      sellerId: "business",
      revision: 3,
      status: "active",
      role: "manager" as const,
      grants: ["team.manage"],
    };
    expect(
      canIssuerDelegateTeamAccess(recipient, { status: "active" }, row, {
        role: "member",
        grants: ["seller.read"],
      }),
    ).toBe(true);
  });
});
