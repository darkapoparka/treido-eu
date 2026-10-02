import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import {
  checkSellerCapability,
  resolveSellerCapabilities,
  type SellerAuthorityFacts,
  type SellerCapability,
  type SellerMembershipFacts,
} from "./capabilities";

function authority(
  kind: "personal" | "business" = "business",
  role: SellerMembershipFacts["role"] = "owner",
  grants: readonly string[] = [],
): SellerAuthorityFacts {
  return {
    actor: {
      userId: "human_a",
      session: "verified",
      status: "active",
      recentlyAuthenticated: true,
    },
    sellerId: "seller_a",
    seller:
      kind === "personal"
        ? { id: "seller_a", kind, status: "active", ownerUserId: "human_a" }
        : { id: "seller_a", kind, status: "active" },
    membership:
      kind === "business"
        ? {
            userId: "human_a",
            sellerId: "seller_a",
            role,
            status: "active",
            grants,
          }
        : null,
  };
}

describe("current seller capabilities", () => {
  it.each<{
    kind: "personal" | "business";
    role: SellerMembershipFacts["role"];
    grants: string[];
    allowed: SellerCapability[];
    denied: SellerCapability[];
  }>([
    {
      kind: "personal",
      role: "owner",
      grants: [],
      allowed: [
        "listing.write",
        "listing.publish",
        "inbox.read",
        "order.fulfil",
        "billing.manage",
        "payment.setup",
      ],
      denied: [
        "inventory.manage",
        "import.run",
        "team.manage",
        "ownership.transfer",
        "business.close",
      ],
    },
    {
      kind: "business",
      role: "owner",
      grants: [],
      allowed: [
        "listing.publish",
        "inventory.manage",
        "import.run",
        "order.fulfil",
        "team.manage",
        "billing.manage",
        "ownership.transfer",
      ],
      denied: [],
    },
    {
      kind: "business",
      role: "manager",
      grants: [],
      allowed: [
        "listing.read",
        "listing.write",
        "listing.publish",
        "inbox.read",
        "inbox.reply",
        "inventory.manage",
      ],
      denied: [
        "import.run",
        "order.read",
        "order.fulfil",
        "billing.manage",
        "payment.setup",
        "team.manage",
        "ownership.transfer",
      ],
    },
    {
      kind: "business",
      role: "manager",
      grants: [
        "import.run",
        "order.fulfil",
        "billing.manage",
        "team.manage",
        "ownership.transfer",
      ],
      allowed: ["import.run", "order.fulfil", "billing.manage", "team.manage"],
      denied: ["ownership.transfer", "business.close"],
    },
    {
      kind: "business",
      role: "member",
      grants: [],
      allowed: [],
      denied: [
        "seller.read",
        "listing.read",
        "listing.write",
        "inbox.read",
        "order.read",
      ],
    },
    {
      kind: "business",
      role: "member",
      grants: [
        "listing.write",
        "inbox.reply",
        "order.read",
        "refund.request",
        "team.manage",
        "business.close",
        "platform.moderate",
      ],
      allowed: ["listing.write", "inbox.reply", "order.read", "refund.request"],
      denied: [
        "listing.read",
        "listing.publish",
        "inbox.read",
        "team.manage",
        "business.close",
      ],
    },
  ])(
    "$kind $role receives only permitted operations with $grants",
    ({ kind, role, grants, allowed, denied }) => {
      const facts = authority(kind, role, grants);
      for (const capability of allowed)
        expect(checkSellerCapability(facts, capability)).toEqual({
          allowed: true,
        });
      for (const capability of denied)
        expect(checkSellerCapability(facts, capability)).toEqual({
          allowed: false,
          reason: "CAPABILITY_REQUIRED",
        });
      const projection = resolveSellerCapabilities(facts);
      expect(JSON.stringify(projection)).not.toMatch(
        /human_a|seller_a|platform\.moderate/,
      );
    },
  );

  it("keeps one human's different business grants separate", () => {
    const businessA = authority("business", "owner");
    const businessB: SellerAuthorityFacts = {
      ...authority("business", "member", ["inbox.read"]),
      sellerId: "seller_b",
      seller: { id: "seller_b", kind: "business", status: "active" },
      membership: {
        userId: "human_a",
        sellerId: "seller_b",
        role: "member",
        status: "active",
        grants: ["inbox.read"],
      },
    };
    expect(checkSellerCapability(businessA, "billing.manage").allowed).toBe(
      true,
    );
    expect(checkSellerCapability(businessB, "inbox.read").allowed).toBe(true);
    expect(checkSellerCapability(businessB, "billing.manage").allowed).toBe(
      false,
    );
    expect(
      resolveSellerCapabilities({
        ...businessB,
        membership: businessA.membership,
      }),
    ).toMatchObject({ authorized: false, reason: "SELLER_ACCESS_DENIED" });
  });

  it.each([
    ["missing actor", { actor: null }, "UNAUTHENTICATED"],
    [
      "expired session",
      { actor: { ...authority().actor!, session: "expired" } },
      "UNAUTHENTICATED",
    ],
    [
      "restricted human",
      { actor: { ...authority().actor!, status: "restricted" } },
      "ACTOR_RESTRICTED",
    ],
    ["missing seller", { seller: null }, "SELLER_ACCESS_DENIED"],
    [
      "foreign requested seller",
      { sellerId: "seller_b" },
      "SELLER_ACCESS_DENIED",
    ],
    ["missing membership", { membership: null }, "SELLER_ACCESS_DENIED"],
    [
      "foreign human",
      { membership: { ...authority().membership!, userId: "human_b" } },
      "SELLER_ACCESS_DENIED",
    ],
    [
      "foreign business",
      { membership: { ...authority().membership!, sellerId: "seller_b" } },
      "SELLER_ACCESS_DENIED",
    ],
    [
      "revoked owner",
      { membership: { ...authority().membership!, status: "revoked" } },
      "SELLER_ACCESS_DENIED",
    ],
    [
      "unaccepted invite",
      { membership: { ...authority().membership!, status: "invited" } },
      "SELLER_ACCESS_DENIED",
    ],
    [
      "restricted seller",
      { seller: { ...authority().seller!, status: "restricted" } },
      "SELLER_RESTRICTED",
    ],
    [
      "closed seller",
      { seller: { ...authority().seller!, status: "closed" } },
      "SELLER_CLOSED",
    ],
  ])("fails closed for %s", (_name, overrides, reason) => {
    const facts = {
      ...authority(),
      ...(overrides as Partial<SellerAuthorityFacts>),
    };
    expect(resolveSellerCapabilities(facts)).toEqual({
      authorized: false,
      capabilities: [],
      reason,
    });
    expect(checkSellerCapability(facts, "listing.write")).toEqual({
      allowed: false,
      reason,
    });
  });

  it("personal ownership cannot be replaced by a business membership", () => {
    const facts = authority("personal");
    expect(
      resolveSellerCapabilities({
        ...facts,
        actor: { ...facts.actor!, userId: "human_b" },
        membership: { ...authority().membership!, userId: "human_b" },
      }),
    ).toMatchObject({ authorized: false, reason: "SELLER_ACCESS_DENIED" });
  });

  it("does not disclose foreign seller restrictions", () => {
    expect(
      resolveSellerCapabilities({
        ...authority(),
        membership: null,
        seller: { id: "seller_a", kind: "business", status: "restricted" },
      }),
    ).toMatchObject({ authorized: false, reason: "SELLER_ACCESS_DENIED" });
  });

  it.each(["payment.setup", "ownership.transfer", "business.close"] as const)(
    "requires recent authentication for %s without blocking ordinary listing work",
    (capability) => {
      const facts = authority();
      const stale = {
        ...facts,
        actor: { ...facts.actor!, recentlyAuthenticated: false },
      };
      expect(checkSellerCapability(stale, capability)).toEqual({
        allowed: false,
        reason: "RECENT_AUTHENTICATION_REQUIRED",
      });
      expect(checkSellerCapability(stale, "listing.write")).toEqual({
        allowed: true,
      });
    },
  );

  it.each([
    { actor: { userId: "human_a", session: "verified" } },
    { seller: { id: "seller_a", kind: "business" } },
    {
      membership: {
        userId: "human_a",
        sellerId: "seller_a",
        role: "owner",
        grants: [],
      },
    },
    { membership: { ...authority().membership!, role: "admin" } },
    { membership: { ...authority().membership!, grants: undefined } },
  ])("denies incomplete/unsupported adapter facts %j", (overrides) => {
    const facts = { ...authority(), ...overrides } as SellerAuthorityFacts;
    expect(resolveSellerCapabilities(facts)).toMatchObject({
      authorized: false,
      capabilities: [],
    });
  });

  it("browse/plan/setup and provider organization fields cannot repair revoked authority", () => {
    const facts = authority();
    const forged = {
      ...facts,
      membership: { ...facts.membership!, status: "revoked" },
      seller: "business",
      sellerId: "seller_a", // Even a browse value is not a seller row.
      plan: "business_pro_v1",
      isOnboarded: true,
      setupPercent: 100,
      clerkOrganizationRole: "org:admin",
      capabilities: ["billing.manage"],
    } as unknown as SellerAuthorityFacts;
    expect(checkSellerCapability(forged, "billing.manage").allowed).toBe(false);
    expect(
      resolveSellerCapabilities({
        ...facts,
        membership: { ...facts.membership!, status: "revoked" },
        ...{
          browseScope: "business",
          plan: "business_pro_v1",
          isOnboarded: true,
        },
      }),
    ).toMatchObject({ authorized: false, reason: "SELLER_ACCESS_DENIED" });
  });
});
