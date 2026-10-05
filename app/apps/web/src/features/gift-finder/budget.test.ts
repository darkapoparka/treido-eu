import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { checkAssistantBudget } from "../assistant-tools/storage.server";
import type { SellerTransaction } from "../../server/db/database";
const query = vi.fn();
const tx = { client: { query }, db: {} } as unknown as SellerTransaction;
beforeEach(() => query.mockReset());
it("keeps F22 accounting working before the additive Gift relation exists", async () => {
  query
    .mockResolvedValueOnce({ rows: [{ ready: false }] })
    .mockResolvedValueOnce({ rows: [{ recent: 0, runs: 19 }] });
  await expect(
    checkAssistantBudget(tx, "human", true),
  ).resolves.toBeUndefined();
  expect(query.mock.calls[1][0]).not.toContain("buyer_gift_receipts");
  expect(query.mock.calls[1][0]).toContain("buyer_compatibility_receipts");
  expect(query.mock.calls[1][0]).toContain("seller_helper_receipts");
});
it("counts Gift/F22 runs together using the same human and retained limits", async () => {
  query
    .mockResolvedValueOnce({ rows: [{ ready: true }] })
    .mockResolvedValueOnce({ rows: [{ recent: 0, runs: 20 }] });
  await expect(checkAssistantBudget(tx, "same-human", true)).rejects.toThrow(
    "QUOTA_EXCEEDED",
  );
  expect(query.mock.calls[1][0]).toContain(
    "buyer_gift_receipts WHERE user_id=$1",
  );
  expect(query.mock.calls[1][1]).toEqual(["same-human"]);
  expect(query.mock.calls[1][0]).toContain("('find','page','refresh')");
});
it("permits clear/shortlist work after assisted run exhaustion but retains shared command rate", async () => {
  query
    .mockResolvedValueOnce({ rows: [{ ready: true }] })
    .mockResolvedValueOnce({ rows: [{ recent: 59, runs: 20 }] });
  await expect(
    checkAssistantBudget(tx, "human", false),
  ).resolves.toBeUndefined();
  query
    .mockResolvedValueOnce({ rows: [{ ready: true }] })
    .mockResolvedValueOnce({ rows: [{ recent: 60, runs: 0 }] });
  await expect(checkAssistantBudget(tx, "human", false)).rejects.toThrow(
    "QUOTA_EXCEEDED",
  );
});
it("never converts unavailable metadata/accounting into a zero budget", async () => {
  query.mockRejectedValueOnce(new Error("storage denied"));
  await expect(checkAssistantBudget(tx, "human", true)).rejects.toThrow(
    "storage denied",
  );
  expect(query).toHaveBeenCalledTimes(1);
});
