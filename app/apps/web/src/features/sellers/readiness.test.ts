import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { type SellerAuthorityFacts } from "./capabilities";
import {
  evaluateSellerReadiness,
  type SellerOperation,
  type SellerReadinessFacts,
} from "./readiness";

function authority(personal = false): SellerAuthorityFacts {
  return {
    actor: {
      userId: "human_a",
      session: "verified",
      status: "active",
      recentlyAuthenticated: true,
    },
    sellerId: "seller_a",
    seller: personal
      ? {
          id: "seller_a",
          kind: "personal",
          ownerUserId: "human_a",
          status: "active",
        }
      : { id: "seller_a", kind: "business", status: "active" },
    membership: personal
      ? null
      : {
          userId: "human_a",
          sellerId: "seller_a",
          status: "active",
          role: "owner",
          grants: [],
        },
  };
}
function ready(): SellerReadinessFacts {
  return {
    restrictions: {
      draft: "clear",
      publish: "clear",
      checkout: "clear",
      payout: "clear",
      support: "clear",
    },
    draft: { quota: "available" },
    publication: {
      country: "supported",
      declarations: "current",
      category: "reviewed",
      listing: "valid",
      media: "ready",
      quota: "available",
      moderation: "eligible",
    },
    checkout: {
      order: "eligible",
      payments: "ready",
      payouts: "ready",
      terms: "current",
      allocation: "available",
    },
    payout: { provider: "ready", settlement: "eligible" },
    support: { capability: "order.fulfil", lifecycle: "permitted" },
  };
}
const operations: SellerOperation[] = [
  "draft",
  "publish",
  "checkout",
  "payout",
  "support",
];

describe("operation-specific seller readiness", () => {
  it.each(operations)(
    "allows qualified personal and business %s",
    (operation) => {
      for (const personal of [false, true]) {
        expect(
          evaluateSellerReadiness(authority(personal), operation, ready()),
        ).toEqual({
          operation,
          status: "allowed",
          reasonCodes: [],
          nextActions: [],
        });
      }
    },
  );

  it("starts a personal draft without storefront, declarations, payment setup or Pro", () => {
    expect(
      evaluateSellerReadiness(authority(true), "draft", {
        restrictions: { draft: "clear" },
        draft: { quota: "available" },
      }).status,
    ).toBe("allowed");
  });

  it("publishes supported contact listings without payment or bank onboarding", () => {
    const facts = ready();
    expect(
      evaluateSellerReadiness(authority(), "publish", {
        restrictions: { publish: "clear" },
        publication: facts.publication,
        checkout: null,
        payout: null,
      }).status,
    ).toBe("allowed");
  });

  it("keeps permitted existing support independent of new supply and payment readiness", () => {
    expect(
      evaluateSellerReadiness(authority(), "support", {
        restrictions: {
          draft: "blocked",
          publish: "blocked",
          checkout: "blocked",
          support: "clear",
        },
        draft: { quota: "exhausted" },
        publication: null,
        checkout: null,
        payout: null,
        support: { capability: "order.fulfil", lifecycle: "permitted" },
      }),
    ).toEqual({
      operation: "support",
      status: "allowed",
      reasonCodes: [],
      nextActions: [],
    });
  });

  it.each(operations)(
    "cannot grant %s using a plan, checklist or payment success flag",
    (operation) => {
      const facts = {
        ...ready(),
        plan: "business_pro_v1",
        isOnboarded: true,
        setupPercent: 100,
        paymentSuccess: true,
      };
      const actor = authority();
      expect(
        evaluateSellerReadiness(
          { ...actor, membership: { ...actor.membership!, status: "revoked" } },
          operation,
          facts,
        ),
      ).toMatchObject({
        status: "blocked",
        reasonCodes: ["SELLER_ACCESS_DENIED"],
      });
      expect(
        evaluateSellerReadiness(actor, operation, {
          plan: "business_pro_v1",
          isOnboarded: true,
          paymentSuccess: true,
        } as SellerReadinessFacts).status,
      ).toBe("blocked");
    },
  );

  it.each(operations)(
    "missing current facts fail closed for %s",
    (operation) => {
      expect(evaluateSellerReadiness(authority(), operation, {})).toMatchObject(
        {
          status: "blocked",
          reasonCodes: ["FACTS_UNAVAILABLE"],
          nextActions: ["retry"],
        },
      );
    },
  );

  it.each([
    ["country", "unsupported", "COUNTRY_UNSUPPORTED"],
    ["declarations", "required", "DECLARATION_REQUIRED"],
    ["declarations", "review_required", "DECLARATION_REVIEW_REQUIRED"],
    ["declarations", "rejected", "DECLARATION_REJECTED"],
    ["declarations", "stale", "DECLARATION_STALE"],
    ["category", "unreviewed", "CATEGORY_UNREVIEWED"],
    ["category", "unsupported", "CATEGORY_UNSUPPORTED"],
    ["category", "stale", "CATEGORY_POLICY_STALE"],
    ["listing", "incomplete", "LISTING_INCOMPLETE"],
    ["media", "pending", "MEDIA_NOT_READY"],
    ["media", "failed", "MEDIA_FAILED"],
    ["quota", "exhausted", "PUBLICATION_QUOTA_EXCEEDED"],
    ["moderation", "pending", "MODERATION_PENDING"],
    ["moderation", "restricted", "LISTING_RESTRICTED"],
    ["moderation", "removed", "LISTING_REMOVED"],
    ["category", "unavailable", "FACTS_UNAVAILABLE"],
  ])("blocks publication and checkout for %s=%s", (field, value, reason) => {
    const facts = ready();
    const changed = {
      ...facts,
      publication: { ...facts.publication!, [field]: value },
    } as SellerReadinessFacts;
    for (const operation of ["publish", "checkout"] as const) {
      expect(
        evaluateSellerReadiness(authority(), operation, changed),
      ).toMatchObject({ status: "blocked", reasonCodes: [reason] });
    }
    expect(evaluateSellerReadiness(authority(), "draft", changed).status).toBe(
      "allowed",
    );
  });

  it.each([
    ["order", "blocked", "ORDER_INELIGIBLE"],
    ["payments", "action_required", "PAYMENT_SETUP_REQUIRED"],
    ["payments", "disabled", "PAYMENTS_DISABLED"],
    ["payments", "unsupported", "PAYMENTS_UNSUPPORTED"],
    ["payments", "stale", "PROVIDER_STATUS_STALE"],
    ["payments", "unavailable", "PROVIDER_UNAVAILABLE"],
    ["payouts", "action_required", "PAYOUT_SETUP_REQUIRED"],
    ["payouts", "disabled", "PAYOUTS_DISABLED"],
    ["terms", "required", "CHECKOUT_TERMS_REQUIRED"],
    ["terms", "stale", "CHECKOUT_TERMS_STALE"],
    ["allocation", "exhausted", "STOCK_UNAVAILABLE"],
  ])("blocks checkout for %s=%s", (field, value, reason) => {
    const facts = ready();
    expect(
      evaluateSellerReadiness(authority(), "checkout", {
        ...facts,
        checkout: { ...facts.checkout!, [field]: value },
      } as SellerReadinessFacts),
    ).toMatchObject({ status: "blocked", reasonCodes: [reason] });
  });

  it.each([
    ["provider", "action_required", "PAYOUT_SETUP_REQUIRED"],
    ["provider", "disabled", "PAYOUTS_DISABLED"],
    ["provider", "unsupported", "PAYOUTS_UNSUPPORTED"],
    ["provider", "stale", "PROVIDER_STATUS_STALE"],
    ["provider", "unavailable", "PROVIDER_UNAVAILABLE"],
    ["settlement", "pending", "SETTLEMENT_PENDING"],
    ["settlement", "held", "SETTLEMENT_HELD"],
    ["settlement", "unsupported", "SETTLEMENT_POLICY_UNSUPPORTED"],
  ])(
    "successful sale/checklist cannot override payout %s=%s",
    (field, value, reason) => {
      const facts = ready();
      expect(
        evaluateSellerReadiness(authority(), "payout", {
          ...facts,
          payout: { ...facts.payout!, [field]: value },
          saleSucceeded: true,
          setupPercent: 100,
        } as SellerReadinessFacts),
      ).toMatchObject({ status: "blocked", reasonCodes: [reason] });
    },
  );

  it("payout checks provider and settlement independently of new-publication requirements", () => {
    expect(
      evaluateSellerReadiness(authority(), "payout", {
        restrictions: { payout: "clear" },
        payout: { provider: "ready", settlement: "eligible" },
        publication: null,
        draft: { quota: "exhausted" },
      }).status,
    ).toBe("allowed");
  });

  it("uses the specific read or fulfilment permission for existing cases", () => {
    const owner = authority();
    const member = {
      ...owner,
      membership: {
        ...owner.membership!,
        role: "member" as const,
        grants: ["order.read"],
      },
    };
    expect(
      evaluateSellerReadiness(member, "support", {
        ...ready(),
        support: { capability: "order.read", lifecycle: "permitted" },
      }).status,
    ).toBe("allowed");
    expect(evaluateSellerReadiness(member, "support", ready())).toMatchObject({
      status: "blocked",
      reasonCodes: ["CAPABILITY_REQUIRED"],
    });
    expect(
      evaluateSellerReadiness(owner, "support", {
        ...ready(),
        support: { capability: "listing.write", lifecycle: "permitted" },
      } as unknown as SellerReadinessFacts).status,
    ).toBe("blocked");
  });

  it.each(operations)(
    "enforces restrictions for %s and gives only recovery on operator-only states",
    (operation) => {
      const facts = ready();
      expect(
        evaluateSellerReadiness(authority(), operation, {
          ...facts,
          restrictions: { ...facts.restrictions, [operation]: "blocked" },
        }),
      ).toMatchObject({
        status: "blocked",
        reasonCodes: ["OPERATION_RESTRICTED"],
        nextActions: ["contact_support"],
      });
      expect(
        evaluateSellerReadiness(authority(), operation, {
          ...facts,
          restrictions: { ...facts.restrictions, [operation]: "operator_only" },
          publication: null,
        }),
      ).toMatchObject({
        status: "blocked",
        reasonCodes: ["OPERATOR_RECOVERY_REQUIRED"],
        nextActions: ["contact_support"],
      });
    },
  );

  it("does not offer declaration/payment setup to a manager lacking those grants", () => {
    const owner = authority();
    const manager = {
      ...owner,
      membership: { ...owner.membership!, role: "manager" as const },
    };
    const facts = ready();
    const result = evaluateSellerReadiness(manager, "checkout", {
      ...facts,
      publication: { ...facts.publication!, declarations: "required" },
      checkout: { ...facts.checkout!, payments: "action_required" },
    });
    expect(result).toMatchObject({
      reasonCodes: ["DECLARATION_REQUIRED", "PAYMENT_SETUP_REQUIRED"],
      nextActions: ["ask_owner"],
    });
    const staleAuth = {
      ...owner,
      actor: { ...owner.actor!, recentlyAuthenticated: false },
    };
    expect(
      evaluateSellerReadiness(staleAuth, "checkout", {
        ...facts,
        checkout: { ...facts.checkout!, payments: "action_required" },
      }).nextActions,
    ).toEqual(["reauthenticate"]);
  });

  it("returns bounded unique reasons/actions with no private/provider evidence", () => {
    const facts = ready();
    const result = evaluateSellerReadiness(authority(), "checkout", {
      ...facts,
      publication: {
        ...facts.publication!,
        category: "unavailable",
        media: "unavailable",
      },
      checkout: {
        ...facts.checkout!,
        payments: "unavailable",
        payouts: "unavailable",
      },
      providerPayload: { secret: "private_evidence" },
      legalDocument: "private_evidence",
    } as SellerReadinessFacts);
    expect(result.reasonCodes).toEqual([
      "FACTS_UNAVAILABLE",
      "PROVIDER_UNAVAILABLE",
    ]);
    expect(result.nextActions).toEqual(["retry"]);
    expect(JSON.stringify(result)).not.toMatch(
      /private_evidence|human_a|seller_a/,
    );
  });
});
