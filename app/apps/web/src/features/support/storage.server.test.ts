import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { requireSupportStorage } from "./storage.server";
import type { SellerDatabase } from "../../server/db/database";
const database = (rows: { ready: boolean }[]) =>
  ({
    pool: { query: vi.fn().mockResolvedValue({ rows }) },
  }) as unknown as SellerDatabase;

describe("private support binding", () => {
  it("requires all five feature-owned storage relations", async () => {
    const db = database([{ ready: true }]);
    await expect(requireSupportStorage(db)).resolves.toBeUndefined();
    const query = vi.mocked(db.pool.query).mock.calls[0][0];
    expect(query).toContain("count(*)=5");
    expect(query).toContain("support_command_receipts");
    expect(query).toContain("support_read_cursors");
    expect(query).toContain("support_notifications");
  });
  it.each([
    { name: "absent", rows: [] },
    { name: "partial", rows: [{ ready: false }] },
  ])("does not substitute empty support on $name storage", async ({ rows }) => {
    await expect(requireSupportStorage(database(rows))).rejects.toMatchObject({
      code: "NOT_AVAILABLE",
    });
  });
  it("preserves an actual adapter failure instead of returning sample success", async () => {
    const db = database([]),
      failure = new Error("Isolated adapter outage");
    vi.mocked(db.pool.query).mockRejectedValueOnce(failure);
    await expect(requireSupportStorage(db)).rejects.toBe(failure);
  });
});
