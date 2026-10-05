import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { ownAssistantInputExport } from "./export.server";
import type { PoolClient } from "pg";
const userId = "10000000-0000-4000-8000-000000000001";
it("absent optional storage gives a true empty export but denied metadata stays an error", async () => {
  const query = vi.fn().mockResolvedValue({ rows: [{ ready: false }] });
  expect(
    await ownAssistantInputExport(
      { client: { query } as unknown as Pick<PoolClient, "query"> },
      userId,
    ),
  ).toEqual([]);
  expect(query).toHaveBeenCalledTimes(1);
  query.mockRejectedValue(new Error("private export denied"));
  await expect(
    ownAssistantInputExport(
      { client: { query } as unknown as Pick<PoolClient, "query"> },
      userId,
    ),
  ).rejects.toThrow("private export denied");
});
it("current own export bounds three modes and selects only minimized criteria/consent metadata", async () => {
  const date = new Date("2026-10-04T10:00:00Z"),
    query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ ready: true }] })
      .mockResolvedValueOnce({
        rows: [
          {
            mode: "voice",
            state: "proposed",
            criteria: "q=Sony",
            consent: true,
            generation: 2,
            consentUpdatedAt: date,
            consentExpiresAt: date,
            createdAt: date,
          },
        ],
      });
  const result = await ownAssistantInputExport(
    { client: { query } as unknown as Pick<PoolClient, "query"> },
    userId,
  );
  expect(result[0]).toMatchObject({
    mode: "voice",
    criteria: "q=Sony&lang=bg",
    consent: true,
    consentGeneration: 2,
    consentUpdatedAt: date.toISOString(),
  });
  const sql = query.mock.calls[1][0];
  expect(sql).toContain("WHERE w.user_id=$1");
  expect(sql).toContain("LIMIT 3");
  expect(sql).not.toMatch(
    /prompt|transcript|object_key|provider_id|clerk_subject/,
  );
  expect(query.mock.calls[1][1]).toEqual([userId]);
});
