import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  database: vi.fn(),
  duplicate: vi.fn(),
  withdraw: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../../server/identity/clerk.server", () => ({
  requireVerifiedIdentity: mocks.identity,
}));
vi.mock("../../server/db/database", () => ({ getDatabase: mocks.database }));
vi.mock("./admin-product-management.server", () => ({
  duplicateSellerProduct: mocks.duplicate,
  withdrawSellerProducts: mocks.withdraw,
}));
import {
  duplicateProductAction,
  withdrawProductsAction,
} from "./admin-product-management-actions";
import { SellerError } from "./errors";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.identity.mockResolvedValue({ subject: "verified" });
  mocks.database.mockReturnValue({ test: "database" });
});
describe("private product action transport", () => {
  it("authenticates both commands before database access", async () => {
    mocks.identity.mockRejectedValue(new SellerError("UNAUTHENTICATED"));
    expect(await duplicateProductAction({})).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    expect(await withdrawProductsAction({})).toEqual({
      ok: false,
      code: "UNAUTHENTICATED",
    });
    expect(mocks.database).not.toHaveBeenCalled();
  });
  it("passes the verified actor and preserves per-row outcomes", async () => {
    const input = { sellerId: "input" };
    const rows = [
      { listingId: "one", result: { ok: false, code: "CONFLICT" } },
    ];
    mocks.withdraw.mockResolvedValue(rows);
    expect(await withdrawProductsAction(input)).toEqual({
      ok: true,
      data: rows,
    });
    expect(mocks.withdraw).toHaveBeenCalledWith(
      { test: "database" },
      { subject: "verified" },
      input,
    );
  });
  it("retains a domain failure rather than pretending to duplicate", async () => {
    mocks.duplicate.mockRejectedValue(new SellerError("QUOTA_EXCEEDED"));
    expect(await duplicateProductAction({})).toEqual({
      ok: false,
      code: "QUOTA_EXCEEDED",
    });
  });
  it("redacts an unexpected provider error", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      mocks.duplicate.mockRejectedValue(
        new Error("private connection password"),
      );
      expect(await duplicateProductAction({})).toEqual({
        ok: false,
        code: "NOT_AVAILABLE",
      });
      expect(log).toHaveBeenCalledWith(
        "Treido product management unavailable.",
      );
    } finally {
      log.mockRestore();
    }
  });
});
