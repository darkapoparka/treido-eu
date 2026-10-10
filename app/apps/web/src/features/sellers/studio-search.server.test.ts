import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), query: vi.fn(), transaction: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../../server/db/database", () => ({ inTransaction: mocks.transaction }));
vi.mock("./persistence.server", () => ({ authorizeSeller: mocks.authorize }));
vi.mock("./customers.server", () => ({ sellerCustomerReference: (seller: string, buyer: string) => `C-${seller.slice(-4)}-${buyer.slice(-4)}` }));
vi.mock("./merchant-navigation", () => ({ merchantNavigation: () => [{ key: "home", label: "Home", href: "/app/sellers/00000000-0000-4000-8000-000000000001?lang=en" }] }));
import { readStudioSearch } from "./studio-search.server";
import { SellerError } from "./errors";
const sellerId = "00000000-0000-4000-8000-000000000001";
const identity = { subject: "user_synthetic_a" } as VerifiedIdentity;
const database = {} as SellerDatabase;
const command = { sellerId, actorSubject: identity.subject, q: "", group: "all", language: "en" };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation(async (_database, callback) => callback({ client: { query: mocks.query } }));
  mocks.authorize.mockResolvedValue({ context: { sellerId, name: "Synthetic seller", kind: "personal", capabilities: ["seller.read", "listing.read"] } });
  mocks.query.mockResolvedValue({ rows: [] });
});
describe("Studio search uses current seller authority", () => {
  it("rejects stale human identity before opening the database transaction", async () => {
    await expect(readStudioSearch(database, identity, { ...command, actorSubject: "user_synthetic_b" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("denies an order-only deep search to a catalog member", async () => {
    await expect(readStudioSearch(database, identity, { ...command, group: "orders" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.query.mock.calls.some(([sql]) => String(sql).includes("FROM treido.paid_orders"))).toBe(false);
  });
  it("does not query private resources after membership revocation", async () => {
    mocks.authorize.mockRejectedValue(new SellerError("FORBIDDEN"));
    await expect(readStudioSearch(database, identity, command)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.query.mock.calls.every(([sql]) => String(sql).startsWith("SET LOCAL"))).toBe(true);
  });
  it("binds title text literally and returns read-only product destinations", async () => {
    mocks.query.mockImplementation(async (sql: string) => ({ rows: sql.includes("FROM treido.listings") ? [{ id: sellerId, title: "Лампа", status: "draft" }] : [] }));
    const query = "%_' OR TRUE --";
    const view = await readStudioSearch(database, identity, { ...command, q: query, group: "products" });
    const resource = mocks.query.mock.calls.find(([sql]) => String(sql).includes("FROM treido.listings"));
    expect(resource?.[1]).toEqual([sellerId, query]);
    expect(resource?.[0]).not.toContain(query);
    expect(view.items[0].href).toBe(`/app/sellers/${sellerId}/listings/${sellerId}/review?lang=en`);
    expect(view.groups).not.toContain("orders");
    expect(view.items[0].title).toBe("Лампа");
  });
  it("uses only real seller-local customer references and never returns buyer IDs", async () => {
    mocks.authorize.mockResolvedValue({ context: { sellerId, name: "Synthetic seller", kind: "business", capabilities: ["seller.read", "order.read"] } });
    mocks.query.mockImplementation(async (sql: string) => ({ rows: sql.includes("WITH latest") ? [{ buyerId: "00000000-0000-4000-8000-000000000099", lastOrderId: sellerId }] : [] }));
    const result = await readStudioSearch(database, identity, { ...command, group: "customers" });
    expect(result.items[0]).toMatchObject({ title: "C-0001-0099", group: "customers" });
    expect(JSON.stringify(result)).not.toContain("00000000-0000-4000-8000-000000000099");
    expect(result.customerScope).toBe("recent_30");
    expect(mocks.query.mock.calls.find(([sql]) => String(sql).includes("WITH latest"))?.[1]).toEqual([sellerId]);
  });
  it("does not turn database failure into a successful empty catalog", async () => {
    mocks.query.mockImplementation(async (sql: string) => { if (sql.includes("FROM treido.listings")) throw new Error("synthetic unavailable database"); return { rows: [] }; });
    await expect(readStudioSearch(database, identity, command)).rejects.toThrow("synthetic unavailable database");
  });
});
