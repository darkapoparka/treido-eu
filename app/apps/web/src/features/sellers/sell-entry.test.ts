import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import {
  parseSellContinuation,
  resolveSellEntry,
  type SellEntryFacts,
} from "./sell-entry";

function facts(): SellEntryFacts {
  return {
    actor: {
      userId: "human_a",
      session: "verified",
      status: "active",
      recentlyAuthenticated: false,
    },
    personalSeller: {
      status: "found",
      value: {
        id: "personal_a",
        kind: "personal",
        status: "active",
        ownerUserId: "human_a",
      },
    },
    requestedSeller: {
      status: "found",
      value: { id: "business_a", kind: "business", status: "active" },
    },
    membership: {
      userId: "human_a",
      sellerId: "business_a",
      status: "active",
      role: "manager",
      grants: [],
    },
    draft: {
      status: "found",
      value: { id: "draft_a", sellerId: "business_a", status: "draft" },
    },
    readiness: {
      restrictions: { draft: "clear" },
      draft: { quota: "available" },
    },
  };
}

describe("bounded sign-in continuation", () => {
  it.each([
    ["/sell", { kind: "personal" }],
    ["/sell?lang=en", { kind: "personal" }],
    ["/sell?intent=personal&lang=bg", { kind: "personal" }],
    ["/sell?intent=business", { kind: "business" }],
    [
      "/app/sellers/business_a/listings/new",
      { kind: "new_listing", sellerId: "business_a" },
    ],
    [
      "/app/sellers/business_a/listings/draft_a/edit?lang=en",
      { kind: "edit_draft", sellerId: "business_a", draftId: "draft_a" },
    ],
  ])("preserves only the intended action from %s", (url, intent) => {
    expect(parseSellContinuation(url)).toMatchObject({
      ok: true,
      continuation: { intent },
    });
  });

  it.each([
    null,
    {},
    1,
    "",
    "https://evil.example/app",
    "http://127.0.0.1:6418/sell",
    "//evil.example/sell",
    "/\\evil.example/sell",
    "javascript:alert(1)",
    "/%2f%2fevil.example",
    "/%252f%252fevil.example",
    "/sell%0d%0aLocation:evil",
    "/sell\r\n",
    "/sell\t",
    " /sell",
    "/sell ",
    "/sell#https://evil.example",
    "/app/sellers/%62usiness_a/listings/new",
    "/app/sellers/business_a%2F..%2Fbusiness_b/listings/new",
    "/app/sellers/../listings/new",
    "/app/sellers/business_a/listings/../edit",
    "/app/sellers/business_a/listings/draft_a/edit/../../billing",
    "/app/sellers/business_a/team",
    "/app/sellers/business_a/listings/new?returnTo=https://evil.example",
    "/sell?seller=business",
    "/sell?sellerId=business_a",
    "/sell?role=owner",
    "/sell?lang=en&lang=bg",
    "/sell?intent=personal&intent=business",
    "/sell?intent=%62usiness",
    "/app/sellers/business_a/listings/new?intent=personal",
    "/sell?lang=EN",
    "/sell?intent=admin",
    "/sell?next=%2Fapp%2Fsellers%2Fbusiness_a",
    "/products/draft_a",
    "/app",
    `/app/sellers/${"x".repeat(129)}/listings/new`,
    "/sell?lang=en?intent=business",
  ])("rejects unsafe or unrelated target %s", (target) => {
    expect(parseSellContinuation(target)).toEqual({
      ok: false,
      code: "INVALID_CONTINUATION",
    });
    expect(resolveSellEntry(target, { actor: null })).toMatchObject({
      status: "blocked",
      reasonCodes: ["INVALID_CONTINUATION"],
    });
  });

  it("returns a canonical internal continuation without incidental query syntax", () => {
    expect(parseSellContinuation("/sell?lang=en&intent=business")).toEqual({
      ok: true,
      continuation: {
        intent: { kind: "business" },
        language: "en",
        target: "/sell?intent=business&lang=en",
      },
    });
  });
});

describe("read-only Sell entry", () => {
  it.each([null, { ...facts().actor!, session: "expired" as const }])(
    "guest/expired session keeps the requested draft action for sign-in",
    (actor) => {
      expect(
        resolveSellEntry(
          "/app/sellers/business_a/listings/draft_a/edit?lang=en",
          { actor },
        ),
      ).toEqual({
        status: "sign_in",
        continuation: "/app/sellers/business_a/listings/draft_a/edit?lang=en",
      });
    },
  );

  it("defaults to the personal editor even when a business is remembered", () => {
    const input = {
      ...facts(),
      browseScope: "business",
      selectedSellerId: "business_a",
      plan: "business_pro_v1",
    };
    expect(resolveSellEntry("/sell?lang=en", input)).toEqual({
      status: "editor",
      destination: "/app/sellers/personal_a/listings/new?lang=en",
      nextMutation: { type: "create_listing_draft", sellerId: "personal_a" },
    });
  });

  it("requests idempotent personal creation without requiring business setup", () => {
    expect(
      resolveSellEntry("/sell", {
        ...facts(),
        personalSeller: { status: "absent" },
      }),
    ).toEqual({
      status: "mutation_required",
      destination: "/app",
      continuation: "/sell",
      nextMutation: "ensure_personal_seller",
    });
  });

  it.each(["/sell?intent=business", "/sell?intent=business&lang=bg"])(
    "explicit business intent requests setup without granting membership: %s",
    (url) => {
      expect(resolveSellEntry(url, { actor: facts().actor })).toMatchObject({
        status: "mutation_required",
        nextMutation: "create_business_seller",
      });
      expect(
        resolveSellEntry(url, {
          actor: { ...facts().actor!, status: "restricted" },
        }),
      ).toMatchObject({ status: "blocked", reasonCodes: ["ACTOR_RESTRICTED"] });
    },
  );

  it.each(["absent", "unavailable"] as const)(
    "a %s personal seller lookup cannot become fabricated editor success",
    (status) => {
      const result = resolveSellEntry("/sell", {
        ...facts(),
        personalSeller: { status },
      });
      if (status === "unavailable")
        expect(result).toMatchObject({
          status: "blocked",
          reasonCodes: ["FACTS_UNAVAILABLE"],
        });
      else expect(result.status).toBe("mutation_required");
    },
  );

  it("resumes an owned draft and rechecks current membership after sign-in", () => {
    const url = "/app/sellers/business_a/listings/draft_a/edit";
    expect(resolveSellEntry(url, facts())).toEqual({
      status: "editor",
      destination: url,
      nextMutation: null,
    });
    const input = facts();
    expect(
      resolveSellEntry(url, {
        ...input,
        membership: { ...input.membership!, status: "revoked" },
      }),
    ).toMatchObject({
      status: "blocked",
      reasonCodes: ["SELLER_ACCESS_DENIED"],
    });
  });

  it("cannot use business A's membership for a continuation into business B", () => {
    const input = facts();
    const url = "/app/sellers/business_b/listings/new";
    const requestedSeller = {
      status: "found" as const,
      value: {
        id: "business_b",
        kind: "business" as const,
        status: "active" as const,
      },
    };
    expect(resolveSellEntry(url, { ...input, requestedSeller })).toMatchObject({
      status: "blocked",
      reasonCodes: ["SELLER_ACCESS_DENIED"],
    });
    expect(
      resolveSellEntry(url, {
        ...input,
        requestedSeller,
        membership: {
          ...input.membership!,
          sellerId: "business_b",
          role: "member",
          grants: ["listing.write"],
        },
      }),
    ).toMatchObject({
      status: "editor",
      destination: url,
      nextMutation: { type: "create_listing_draft", sellerId: "business_b" },
    });
  });

  it.each([
    { draft: { status: "absent" }, reason: "DRAFT_ACCESS_DENIED" },
    { draft: { status: "unavailable" }, reason: "FACTS_UNAVAILABLE" },
    {
      draft: {
        status: "found",
        value: { id: "draft_b", sellerId: "business_a", status: "draft" },
      },
      reason: "DRAFT_ACCESS_DENIED",
    },
    {
      draft: {
        status: "found",
        value: { id: "draft_a", sellerId: "business_b", status: "draft" },
      },
      reason: "DRAFT_ACCESS_DENIED",
    },
    {
      draft: {
        status: "found",
        value: { id: "draft_a", sellerId: "business_a", status: "deleted" },
      },
      reason: "DRAFT_DELETED",
    },
    {
      draft: {
        status: "found",
        value: { id: "draft_a", sellerId: "business_a", status: "restricted" },
      },
      reason: "OPERATION_RESTRICTED",
    },
  ])(
    "gives recovery for missing/foreign/deleted/restricted drafts: $reason",
    ({ draft, reason }) => {
      expect(
        resolveSellEntry("/app/sellers/business_a/listings/draft_a/edit", {
          ...facts(),
          draft,
        } as SellEntryFacts),
      ).toMatchObject({ status: "blocked", reasonCodes: [reason] });
    },
  );

  it("validates draft ownership before reporting operation eligibility", () => {
    expect(
      resolveSellEntry("/app/sellers/business_a/listings/draft_a/edit", {
        ...facts(),
        draft: {
          status: "found",
          value: { id: "draft_a", sellerId: "business_b", status: "draft" },
        },
        readiness: undefined,
      }),
    ).toMatchObject({
      status: "blocked",
      reasonCodes: ["DRAFT_ACCESS_DENIED"],
    });
  });

  it("a requested business or another human cannot replace personal ownership", () => {
    const input = facts();
    expect(
      resolveSellEntry("/sell", {
        ...input,
        personalSeller: input.requestedSeller,
      }),
    ).toMatchObject({
      status: "blocked",
      reasonCodes: ["SELLER_ACCESS_DENIED"],
    });
    expect(
      resolveSellEntry("/sell", {
        ...input,
        actor: { ...input.actor!, userId: "human_b" },
      }),
    ).toMatchObject({
      status: "blocked",
      reasonCodes: ["SELLER_ACCESS_DENIED"],
    });
  });

  it.each([
    { restrictions: { draft: "blocked" }, draft: { quota: "available" } },
    { restrictions: { draft: "clear" }, draft: { quota: "exhausted" } },
    {},
  ] as const)(
    "does not route to apparently writable editors when draft readiness fails",
    (readiness) => {
      expect(resolveSellEntry("/sell", { ...facts(), readiness }).status).toBe(
        "blocked",
      );
    },
  );

  it("lookup failure or unsafe stored IDs never become a fallback seller", () => {
    expect(
      resolveSellEntry("/app/sellers/business_a/listings/new", {
        ...facts(),
        requestedSeller: { status: "unavailable" },
      }),
    ).toMatchObject({ status: "blocked", reasonCodes: ["FACTS_UNAVAILABLE"] });
    expect(
      resolveSellEntry("/sell", {
        ...facts(),
        personalSeller: {
          status: "found",
          value: {
            id: "../business_a",
            kind: "personal",
            ownerUserId: "human_a",
            status: "active",
          },
        },
      }),
    ).toMatchObject({
      status: "blocked",
      reasonCodes: ["SELLER_ACCESS_DENIED"],
    });
  });

  it("repeated entry queries do not consume or mutate facts", () => {
    const input = facts();
    const before = structuredClone(input);
    const first = resolveSellEntry("/sell", input);
    expect(resolveSellEntry("/sell", input)).toEqual(first);
    expect(input).toEqual(before);
  });
});
