import { describe, expect, it } from "vitest";
import {
  parseWorkspaceAccessRoute,
  retainsWorkspaceAccess,
  workspaceSnapshotVersion,
} from "./workspace-access";
import { SellerError } from "./errors";
const seller = "10000000-0000-4000-8000-000000000001",
  resource = "20000000-0000-4000-8000-000000000002";
const base = "/app/sellers/" + seller;
describe("finite workspace restoration route input", () => {
  it("recognizes the maintained workspace pages and exact resource routes", () => {
    for (const path of [
      "",
      "billing",
      "imports",
      "inbox",
      "inquiries",
      "insights",
      "inventory",
      "listings",
      "listings/new",
      "moderation",
      "notifications",
      "onboarding",
      "orders",
      "promotions",
      "reservations",
      "settings",
      "settings/contact",
      "settings/delivery",
      "settings/payments",
      "settings/payments/refresh",
      "settings/store",
      "settings/store/preview",
      "team",
      `imports/${resource}`,
      `inbox/${resource}`,
      `inquiries/${resource}`,
      `orders/${resource}`,
      `orders/${resource}/support`,
      `listings/${resource}/edit`,
      `listings/${resource}/review`,
      `listings/${resource}/moderation`,
    ]) {
      const parsed = parseWorkspaceAccessRoute(
        base + (path ? "/" + path : "") + "?lang=bg",
      );
      expect(parsed.sellerId).toBe(seller);
      expect(parsed.resourceId).toBe(path.includes(resource) ? resource : null);
    }
    for (const path of [
      "/app",
      "/app/intent",
      "/app/onboarding",
      "/app/products",
      "/app/invitations",
      "/app/invitations/" + resource,
    ])
      expect(parseWorkspaceAccessRoute(path).sellerId).toBeNull();
  });
  it("rejects invented routes, ambiguous paths, external authority and duplicate supported selectors", () => {
    for (const raw of [
      null,
      seller,
      "//evil.invalid/app",
      "/application",
      "/app/../app",
      base + "/team/extra",
      base + "/inbox/" + resource + "/support",
      base + "/orders/not-an-id",
      base + "/team#fragment",
      base + "/team?lang=bg&lang=en",
      base + "/insights?dataset=imports&dataset=stock",
      base + "/team?lang=other",
      base + "/settings/%73tore",
    ])
      expect(() => parseWorkspaceAccessRoute(raw)).toThrow(SellerError);
  });
  it("retains only the actual reader's supported query values and never accepts a capability selector", () => {
    expect(
      parseWorkspaceAccessRoute(
        base +
          "/insights?dataset=imports&lang=en&capability=team.manage&sellerId=other&role=owner",
      ).query,
    ).toEqual({ lang: "en", dataset: "imports" });
    expect(
      parseWorkspaceAccessRoute(
        base + "/inbox?q=phone&filter=unread&cursor=position&dataset=imports",
      ).query,
    ).toEqual({ q: "phone", filter: "unread", cursor: "position" });
  });
});
describe("retained shell and optional projection capability snapshot", () => {
  const original = [
    {
      sellerId: seller,
      capabilities: ["seller.read", "declaration.manage"] as const,
    },
    { sellerId: resource, capabilities: ["seller.read"] as const },
  ];
  it("does not reveal optional facts or another shell seller after their authority disappears", () => {
    expect(
      retainsWorkspaceAccess(original, [
        { sellerId: seller, capabilities: ["seller.read"] },
        original[1],
      ]),
    ).toBe(false);
    expect(retainsWorkspaceAccess(original, [original[0]])).toBe(false);
    expect(
      retainsWorkspaceAccess(original, [
        ...original,
        { sellerId: "new", capabilities: ["seller.read"] },
      ]),
    ).toBe(true);
  });
  it("compares semantic capability snapshots across RSC ordering and detects actual removals", () => {
    expect(workspaceSnapshotVersion(original)).toBe(
      workspaceSnapshotVersion([
        original[1],
        {
          sellerId: seller,
          capabilities: ["declaration.manage", "seller.read"],
        },
      ]),
    );
    expect(workspaceSnapshotVersion(original)).not.toBe(
      workspaceSnapshotVersion([original[0]]),
    );
  });
});
