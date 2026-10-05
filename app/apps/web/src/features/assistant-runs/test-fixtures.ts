import { createHash } from "node:crypto";
import type { InputPolicyConfig, RuntimePolicy } from "./policy.server";
/** Isolated test data only. Never inserted by runtime or used as approval. */
export const isolatedKey = "T63-ISOLATED-TRANSPORT-NO-NETWORK";
export const isolatedPolicyConfig: InputPolicyConfig = {
  version: 1,
  gatewayAccountId: "team_isolated",
  gatewayProjectId: "prj_isolated",
  gatewayCredentialFingerprint: createHash("sha256")
    .update("treido-gateway-binding-v1\0")
    .update(isolatedKey)
    .digest("hex"),
  approvalReference: "isolated-test-only",
  processorReference: "isolated-test-only",
  retentionReference: "isolated-test-only",
  noticeBg: "Изолиран тест",
  noticeEn: "Isolated test",
  models: {
    text: "isolated/text",
    photo: "isolated/photo",
    voice: "isolated/voice",
  },
  responseModels: {
    text: "isolated-text-response",
    photo: "isolated-photo-response",
    voice: null,
  },
  providers: ["isolated"],
  budgetCurrency: "USD",
  runMinor: 7,
  humanDailyMinor: 14,
  platformDailyMinor: 100,
  inputBytes: 16000,
  outputTokens: 200,
  mediaSeconds: 600,
  inputSeconds: 600,
  consentSeconds: 600,
  audioSeconds: 60,
  mediaScope: "a".repeat(64),
  providerEnabled: true,
  mediaEnabled: true,
  retentionEnabled: true,
  evaluationRevision: "isolated-test-only",
};
export const isolatedPolicy: RuntimePolicy = {
  id: "10000000-0000-4000-8000-000000000001",
  applicationId: "app_isolated",
  environment: "test",
  config: isolatedPolicyConfig,
};
export const isolatedGeneration = "gen_01ARZ3NDEKTSV4RRFFQ69G5FAV";
