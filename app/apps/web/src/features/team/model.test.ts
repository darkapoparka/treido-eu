import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  normalizeRecipient,
  parseTeamAccess,
  validTeamCommand,
  TEAM_GRANTS,
} from "./model";
import {
  effectiveTeamAccess,
  canDelegateTeamAccess,
  canManageTeamMember,
} from "./policy.server";
import type { SellerAuthorityFacts } from "../sellers/capabilities";
import messages from "./messages.json";
const authority: SellerAuthorityFacts = {
  actor: {
    userId: "actor",
    session: "verified",
    status: "active",
    recentlyAuthenticated: false,
  },
  sellerId: "seller",
  seller: { id: "seller", kind: "business", status: "active" },
  membership: {
    userId: "actor",
    sellerId: "seller",
    status: "active",
    role: "manager",
    grants: ["team.manage"],
  },
};
describe("business invitation input and explicit authority", () => {
  it("delegates marketing only from a current explicit grant and keeps financial permissions separate", () => {
    const access = {
      role: "member" as const,
      grants: ["seller.read", "marketing.manage"] as const,
    };
    expect(parseTeamAccess(access)).not.toBeNull();
    expect(
      canDelegateTeamAccess(authority, {
        ...access,
        grants: [...access.grants],
      }),
    ).toBe(false);
    const marketer: SellerAuthorityFacts = {
      ...authority,
      membership: {
        ...authority.membership!,
        grants: ["team.manage", "marketing.manage"],
      },
    };
    expect(
      canDelegateTeamAccess(marketer, {
        ...access,
        grants: [...access.grants],
      }),
    ).toBe(true);
    expect(
      canDelegateTeamAccess(marketer, {
        role: "member",
        grants: ["seller.read", "marketing.manage", "billing.manage"],
      }),
    ).toBe(false);
    expect(
      effectiveTeamAccess(authority, {
        role: "manager",
        grants: ["seller.read"],
      }),
    ).not.toContain("marketing.manage");
    expect(
      canDelegateTeamAccess(
        {
          ...marketer,
          membership: { ...marketer.membership!, status: "revoked" },
        },
        { ...access, grants: [...access.grants] },
      ),
    ).toBe(false);
  });

  it("normalizes only a specific valid address without changing aliases", () => {
    expect(normalizeRecipient(" Buyer+Stock@Example.test ")).toBe(
      "buyer+stock@example.test",
    );
    for (const value of [
      "a@b",
      "multiple@example.test,other@example.test",
      "x\n@example.test",
      null,
    ])
      expect(normalizeRecipient(value)).toBeNull();
  });
  it("refuses unknown, duplicated, owner-only and role-incompatible grants", () => {
    expect(
      parseTeamAccess({
        role: "member",
        grants: ["seller.read", "listing.read"],
      }),
    ).not.toBeNull();
    for (const access of [
      { role: "owner", grants: ["seller.read"] },
      { role: "member", grants: ["seller.read", "team.manage"] },
      { role: "member", grants: ["seller.read", "ownership.transfer"] },
      { role: "member", grants: ["seller.read", "seller.read"] },
      { role: "member", grants: ["listing.write"] },
    ])
      expect(parseTeamAccess(access)).toBeNull();
  });
  it("uses server role defaults but never delegates a permission absent from the current manager", () => {
    expect(
      effectiveTeamAccess(authority, {
        role: "manager",
        grants: ["seller.read"],
      }),
    ).toContain("inventory.manage");
    expect(
      canDelegateTeamAccess(authority, {
        role: "member",
        grants: ["seller.read", "listing.read"],
      }),
    ).toBe(true);
    expect(
      canDelegateTeamAccess(authority, {
        role: "member",
        grants: ["seller.read", "billing.manage"],
      }),
    ).toBe(false);
    expect(
      canManageTeamMember(authority, {
        userId: "other",
        role: "owner",
        grants: [],
      }),
    ).toBe(false);
    expect(
      canManageTeamMember(authority, {
        userId: "actor",
        role: "manager",
        grants: [],
      }),
    ).toBe(false);
  });
  it("rejects malformed command scopes", () => {
    expect(
      validTeamCommand({
        kind: "revoke",
        sellerId: "wrong",
        userId: "wrong",
        requestId: "wrong",
        expectedRevision: -1,
      }),
    ).toBe(false);
  });
  it("provides both languages for every grant and every state", () => {
    expect(Object.keys(messages.bg).sort()).toEqual(
      Object.keys(messages.en).sort(),
    );
    for (const cap of TEAM_GRANTS) {
      const key = cap.replaceAll(
        ".",
        "_",
      ) as keyof typeof messages.en.capabilities;
      expect(messages.en.capabilities[key]).toBeTruthy();
      expect(messages.bg.capabilities[key]).toBeTruthy();
    }
  });
});
