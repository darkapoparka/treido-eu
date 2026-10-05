import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("../../server/config/backend-bindings.server", () => ({
  requireBackendBindings: () => ({
    environment: "test",
    identity: { applicationId: "app_isolated" },
  }),
}));
import {
  authorizeAssistantMaintenance,
  type AssistantMaintenanceContext,
} from "./maintenance-authority.server";
import type { SellerTransaction } from "../../server/db/database";
const query = vi.fn(),
  tx = { client: { query } } as unknown as SellerTransaction,
  ids = [1, 2, 3, 4].map(
    (n) => "10000000-0000-4000-8000-" + String(n).padStart(12, "0"),
  );
const job: AssistantMaintenanceContext = {
  id: ids[0],
  kind: "assistant.usage",
  authority: "assistant",
  sellerId: null,
  buyerId: ids[1],
  actorId: null,
  resourceId: ids[2],
  operationKey: ids[2],
  generation: 2,
  executionToken: ids[3],
};
beforeEach(() => query.mockReset());
it("no maintenance authority can be fabricated from a browser role/seller/actor or substituted resource", async () => {
  for (const changed of [
    { authority: "buyer" },
    { sellerId: ids[0] },
    { actorId: ids[1] },
    { operationKey: ids[0] },
    { generation: 0 },
  ])
    await expect(
      authorizeAssistantMaintenance(
        tx,
        { ...job, ...changed } as AssistantMaintenanceContext,
        "assistant.usage",
      ),
    ).rejects.toThrow("FORBIDDEN");
  expect(query).not.toHaveBeenCalled();
});
it("a missing/stale original executor lease denies every write and external effect", async () => {
  query
    .mockResolvedValueOnce({ rows: [{ ready: true }] })
    .mockResolvedValueOnce({ rows: [] });
  await expect(
    authorizeAssistantMaintenance(tx, job, "assistant.usage"),
  ).rejects.toThrow("FORBIDDEN");
  const sql = query.mock.calls[1][0];
  expect(sql).toContain("e.execution_token=$6");
  expect(sql).toContain("e.execution_until>clock_timestamp()");
  expect(sql).toContain("j.generation=$5");
  expect(sql).not.toContain("j.environment");
  expect(
    query.mock.calls.some(([sql]) => /^UPDATE|^DELETE|^INSERT/.test(sql)),
  ).toBe(false);
});
it("only already emitted, originally owned usage is eligible; expiry cannot act on an unexpired asset", async () => {
  query
    .mockResolvedValueOnce({ rows: [{ ready: true }] })
    .mockResolvedValueOnce({ rows: [{ id: job.id }] })
    .mockResolvedValueOnce({ rows: [{ id: job.buyerId }], rowCount: 1 })
    .mockResolvedValueOnce({ rows: [] });
  await expect(
    authorizeAssistantMaintenance(tx, job, "assistant.usage"),
  ).rejects.toThrow("FORBIDDEN");
  expect(query.mock.calls[3][0]).toContain("r.emission_started_at IS NOT NULL");
  expect(query.mock.calls[3][0]).toContain("b.application_id=$3");
  expect(query.mock.calls[3][0]).toContain("r.provider_id IS NOT NULL");
  expect(query.mock.calls[3][0]).not.toContain("r.mode<>'voice'");
  query
    .mockReset()
    .mockResolvedValueOnce({ rows: [{ ready: true }] })
    .mockResolvedValueOnce({ rows: [{ id: job.id }] })
    .mockResolvedValueOnce({ rows: [{ id: job.buyerId }], rowCount: 1 })
    .mockResolvedValueOnce({ rows: [] });
  await expect(
    authorizeAssistantMaintenance(
      tx,
      { ...job, kind: "assistant.media-expiry" },
      "assistant.media-expiry",
    ),
  ).rejects.toThrow("FORBIDDEN");
  expect(query.mock.calls[3][0]).toContain(
    "a.expires_at<=clock_timestamp() OR a.state='cancelled'",
  );
});
