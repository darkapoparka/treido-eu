import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("../../server/config/backend-bindings.server", () => ({
  requireBackendBindings: () => ({
    environment: "test",
    identity: { applicationId: "app_isolated" },
  }),
}));
import {
  parsePolicyConfig,
  runtimePolicy,
  requirePolicy,
} from "./policy.server";
import { isolatedPolicyConfig, isolatedPolicy } from "./test-fixtures";
import type { SellerTransaction } from "../../server/db/database";
const query = vi.fn(),
  tx = { client: { query } } as unknown as SellerTransaction;
beforeEach(() => {
  query.mockReset();
});
it("approval/cost/privacy/processor/retention/account mapping is mandatory, without defaults", () => {
  expect(parsePolicyConfig(isolatedPolicyConfig)).toEqual(isolatedPolicyConfig);
  for (const key of [
    "gatewayCredentialFingerprint",
    "gatewayProjectId",
    "approvalReference",
    "processorReference",
    "retentionReference",
    "noticeBg",
    "noticeEn",
    "humanDailyMinor",
    "platformDailyMinor",
    "evaluationRevision",
  ]) {
    const config = { ...isolatedPolicyConfig } as Record<string, unknown>;
    delete config[key];
    expect(() => parsePolicyConfig(config)).toThrow("NOT_AVAILABLE");
  }
  for (const change of [
    { budgetCurrency: "EUR" },
    { runMinor: 0 },
    { humanDailyMinor: 6 },
    { platformDailyMinor: 13 },
    { outputTokens: 4001 },
    { audioSeconds: 61 },
    { providerEnabled: "yes" },
    { responseModels: { ...isolatedPolicyConfig.responseModels, text: null } },
  ])
    expect(() =>
      parsePolicyConfig({ ...isolatedPolicyConfig, ...change }),
    ).toThrow("NOT_AVAILABLE");
});
it("registry reads bind application/environment and reject future or revoked approvals in SQL", async () => {
  query.mockResolvedValue({ rows: [] });
  expect(await runtimePolicy(tx, isolatedPolicy.id)).toBeNull();
  expect(query.mock.calls[0][0]).toContain("approved_at<=clock_timestamp()");
  expect(query.mock.calls[0][0]).toContain("revoked_at IS NULL");
  expect(query.mock.calls[0][1]).toEqual([
    "app_isolated",
    "test",
    isolatedPolicy.id,
  ]);
  expect(query.mock.calls[0][0]).not.toMatch(/INSERT|UPDATE|DELETE/);
});
it("unqualified mode or retention cannot execute and metadata errors remain genuine failures", async () => {
  expect(() => requirePolicy(null, "text")).toThrow("NOT_AVAILABLE");
  expect(() =>
    requirePolicy(
      {
        ...isolatedPolicy,
        config: { ...isolatedPolicyConfig, retentionEnabled: false },
      },
      "photo",
    ),
  ).toThrow("NOT_AVAILABLE");
  query.mockRejectedValue(new Error("registry denied"));
  await expect(runtimePolicy(tx)).rejects.toThrow("registry denied");
});
