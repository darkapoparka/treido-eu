import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SellerDatabase } from "../../server/db/database";
import type { PublishedListing } from "../catalog/published-model";
import type { PublicInventory } from "../inventory/model";

const state = vi.hoisted(() => ({
  collection: true,
  binding: {
    platformAccount: "acct_testplatform",
    livemode: false,
    environment: "development",
    applicationId: "treido-global",
  },
  inventory: vi.fn(),
  query: vi.fn(),
  policyCurrent: true,
  mappingCurrent: true,
  termsCurrent: true,
  candidates: true,
}));
vi.mock("server-only", () => ({}));
vi.mock("../../server/db/database", () => ({
  inTransaction: async (_database: unknown, work: (tx: unknown) => unknown) =>
    work({ client: { query: state.query } }),
}));
vi.mock("../inventory/queries.server", () => ({
  readPublicInventoryInTransaction: state.inventory,
}));
vi.mock("./bindings.server", () => ({
  requireCollection: () => {
    if (!state.collection) throw new Error("collection_unavailable");
    return state.binding;
  },
}));
import { readPublicPaymentEntry } from "./public-entry.server";

const database = {} as SellerDatabase;
const sellerId = "10000000-0000-4000-8000-000000000001";
const listingId = "10000000-0000-4000-8000-000000000002";
const policyId = "10000000-0000-4000-8000-000000000003";
const listing: Pick<
  PublishedListing,
  "id" | "revision" | "seller" | "handover"
> = {
  id: listingId,
  revision: 3,
  seller: { id: sellerId, name: "Seller", kind: "personal" },
  handover: ["pickup"],
};
const available: PublicInventory = {
  publicationRevision: 3,
  mode: "unique",
  state: "available",
  skus: [{ id: "sku", options: {}, priceMinor: 100, available: 1, onHand: 1 }],
};
beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(state, {
    collection: true,
    policyCurrent: true,
    mappingCurrent: true,
    termsCurrent: true,
    candidates: true,
  });
  Object.assign(state.binding, {
    platformAccount: "acct_testplatform",
    livemode: false,
    environment: "development",
    applicationId: "treido-global",
  });
  state.inventory.mockResolvedValue(available);
  state.query.mockImplementation(async (sql: string, args: unknown[]) => {
    if (sql.includes("lock_payment_policy")) {
      const scoped =
        state.policyCurrent &&
        JSON.stringify(args) ===
          JSON.stringify([
            policyId,
            "acct_testplatform",
            false,
            "development",
            "treido-global",
          ]);
      return { rows: [{ id: scoped ? policyId : null }] };
    }
    if (sql.includes("lock_seller_payment_binding"))
      return { rows: [{ id: state.mappingCurrent ? "mapping" : null }] };
    if (sql.includes("lock_payable_listing_terms"))
      return { rows: [{ id: state.termsCurrent ? policyId : null }] };
    if (sql.includes("FROM treido.payment_policies WHERE"))
      return { rows: [{ id: policyId }] };
    if (sql.includes("FROM treido.seller_payment_bindings WHERE"))
      return { rows: [{ id: "mapping", sellerId }] };
    return { rows: state.candidates ? [{ policyId }] : [] };
  });
});

describe("public payment entry", () => {
  it("reuses exact checkout registry gates and current public inventory; exposes only a boolean", async () => {
    expect(await readPublicPaymentEntry(database, listing)).toBe(true);
    expect(state.inventory).toHaveBeenCalledWith(
      expect.anything(),
      listingId,
      3,
    );
    expect(
      state.query.mock.calls
        .filter(([sql]) => sql.includes("treido.lock_"))
        .map(([, args]) => args),
    ).toEqual([
      [policyId, "acct_testplatform", false, "development", "treido-global"],
      [sellerId, "acct_testplatform", false],
      [sellerId, listingId, 3, policyId],
    ]);
    expect(state.query.mock.calls[0][1]).toEqual([
      sellerId,
      listingId,
      3,
      "acct_testplatform",
      false,
      "development",
      "treido-global",
    ]);
  });
  it("collection off stays contact-only without touching the database", async () => {
    state.collection = false;
    expect(await readPublicPaymentEntry(database, listing)).toBe(false);
    expect(state.inventory).not.toHaveBeenCalled();
    expect(state.query).not.toHaveBeenCalled();
  });
  it.each([
    ["livemode", true],
    ["environment", "preview"],
    ["applicationId", "another-app"],
    ["platformAccount", "acct_otherplatform"],
  ] as const)(
    "canonical policy rejects the wrong %s even if a candidate is returned",
    async (key, value) => {
      Object.assign(state.binding, { [key]: value });
      expect(await readPublicPaymentEntry(database, listing)).toBe(false);
      expect(
        state.query.mock.calls.some(([sql]) => sql.includes("lock_seller")),
      ).toBe(false);
    },
  );
  it.each(["policyCurrent", "mappingCurrent", "termsCurrent"] as const)(
    "revoked or not-yet-approved %s fails closed through the canonical gate",
    async (key) => {
      state[key] = false;
      expect(await readPublicPaymentEntry(database, listing)).toBe(false);
    },
  );
  it("missing payable-publication terms keeps the contact-only default", async () => {
    state.candidates = false;
    expect(await readPublicPaymentEntry(database, listing)).toBe(false);
  });
  it.each([
    null,
    { ...available, publicationRevision: 2 },
    { ...available, mode: "unknown", skus: [] },
    { ...available, skus: [{ ...available.skus[0], available: 0 }] },
  ])(
    "missing, stale, unknown or held stock never offers payment (%j)",
    async (inventory) => {
      state.inventory.mockResolvedValue(inventory);
      expect(await readPublicPaymentEntry(database, listing)).toBe(false);
      expect(state.query).not.toHaveBeenCalled();
    },
  );
  it("unit prices below Stripe's total minimum still allow a valid multi-unit checkout attempt", async () => {
    state.inventory.mockResolvedValue({
      ...available,
      mode: "stocked",
      skus: [{ ...available.skus[0], available: 2, onHand: 2, priceMinor: 40 }],
    });
    expect(await readPublicPaymentEntry(database, listing)).toBe(true);
  });
  it("shipping-only supply cannot acquire a pickup entry", async () => {
    expect(
      await readPublicPaymentEntry(database, {
        ...listing,
        handover: ["shipping"],
      }),
    ).toBe(false);
    expect(state.inventory).not.toHaveBeenCalled();
  });
  it.each(["inventory", "query"] as const)(
    "%s failure stays contact-only",
    async (key) => {
      state[key].mockRejectedValue(new Error("unavailable"));
      expect(await readPublicPaymentEntry(database, listing)).toBe(false);
    },
  );
});
