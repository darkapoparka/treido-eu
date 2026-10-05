import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const bindings = vi.hoisted(() => ({ jobs: vi.fn() }));
vi.mock("../../server/config/backend-bindings.server", () => ({
  requireBackendBindings: () => ({
    environment: "test",
    identity: { applicationId: "app_isolated" },
  }),
}));
vi.mock("../../server/jobs/config.server", () => ({
  requireJobBindings: bindings.jobs,
}));
import { JobError } from "../../server/jobs/model";
import { checkAssistantBudget } from "../assistant-tools/storage.server";
import { reserveInputMoney, requireInputLifecycle } from "./storage.server";
import { isolatedPolicy } from "./test-fixtures";
import type { SellerTransaction } from "../../server/db/database";
const query = vi.fn(),
  tx = { client: { query } } as unknown as SellerTransaction;
beforeEach(() => {
  query.mockReset();
  bindings.jobs.mockReset();
});
it("shared daily human accounting counts one reservation per run and receipts only for command rate", async () => {
  query
    .mockResolvedValueOnce({ rows: [{ ready: true, inputReady: true }] })
    .mockResolvedValueOnce({ rows: [{ recent: 10, runs: 20 }] });
  await expect(checkAssistantBudget(tx, "same-human", true)).rejects.toThrow(
    "QUOTA_EXCEEDED",
  );
  const sql = query.mock.calls[1][0];
  expect(sql).toContain("buyer_compatibility_receipts");
  expect(sql).toContain("seller_helper_receipts");
  expect(sql).toContain("buyer_gift_receipts");
  expect(sql).toContain(
    "created_at,false AS run FROM treido.buyer_assistant_receipts",
  );
  expect(sql).toContain("OR status IN ('reserved','calling','unknown')");
  expect(query.mock.calls[1][1]).toEqual(["same-human"]);
});
it("additive absence retains F22/Gift limits without changing old query count", async () => {
  query
    .mockResolvedValueOnce({ rows: [{ ready: true, inputReady: false }] })
    .mockResolvedValueOnce({ rows: [{ recent: 59, runs: 19 }] });
  await expect(
    checkAssistantBudget(tx, "human", true),
  ).resolves.toBeUndefined();
  expect(query).toHaveBeenCalledTimes(2);
  expect(query.mock.calls[1][0]).not.toContain("assistant_run_reservations");
});
it("spending holds unknown/pending across every policy version and day boundary before reserving", async () => {
  query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [{ human: "8", platform: "30" }] });
  await expect(reserveInputMoney(tx, "human", isolatedPolicy)).rejects.toThrow(
    "QUOTA_EXCEEDED",
  );
  expect(query.mock.calls[0][0]).toContain("pg_advisory_xact_lock");
  const sql = query.mock.calls[1][0];
  expect(sql).toContain("status IN ('reserved','calling','unknown') OR");
  expect(sql).not.toContain("policy_id");
  expect(query.mock.calls[1][1]).toEqual([
    "human",
    "app_isolated",
    "test",
    "USD",
  ]);
});
it("platform ceiling and missing/bad accounting never become zero headroom", async () => {
  query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [{ human: "0", platform: "94" }] });
  await expect(reserveInputMoney(tx, "human", isolatedPolicy)).rejects.toThrow(
    "QUOTA_EXCEEDED",
  );
  query
    .mockReset()
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] });
  await expect(reserveInputMoney(tx, "human", isolatedPolicy)).rejects.toThrow(
    "NOT_AVAILABLE",
  );
  query.mockReset().mockRejectedValue(new Error("budget denied"));
  await expect(checkAssistantBudget(tx, "human", true)).rejects.toThrow(
    "budget denied",
  );
});
it("missing lifecycle registration or real job binding fails before permitting new input effects", async () => {
  query.mockResolvedValue({ rows: [{ ready: false }] });
  await expect(requireInputLifecycle(tx)).rejects.toThrow("NOT_AVAILABLE");
  expect(bindings.jobs).not.toHaveBeenCalled();
  query.mockResolvedValue({ rows: [{ ready: true }] });
  bindings.jobs.mockImplementation(() => {
    throw new JobError("NOT_AVAILABLE");
  });
  await expect(requireInputLifecycle(tx)).rejects.toThrow("NOT_AVAILABLE");
});
