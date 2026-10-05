import "server-only";
import type { SellerTransaction } from "../../server/db/database";
import { requireBackendBindings } from "../../server/config/backend-bindings.server";
import { SellerError } from "../sellers/errors";
import {
  INPUT_MODES,
  record,
  keys,
  text,
  integer,
  type InputMode,
} from "./model";
export type InputPolicyConfig = {
  version: 1;
  gatewayAccountId: string;
  gatewayProjectId: string;
  gatewayCredentialFingerprint: string;
  approvalReference: string;
  processorReference: string;
  retentionReference: string;
  noticeBg: string;
  noticeEn: string;
  models: Record<InputMode, string | null>;
  responseModels: Record<InputMode, string | null>;
  providers: string[];
  budgetCurrency: "USD";
  runMinor: number;
  humanDailyMinor: number;
  platformDailyMinor: number;
  inputBytes: number;
  outputTokens: number;
  mediaSeconds: number;
  inputSeconds: number;
  consentSeconds: number;
  audioSeconds: number;
  mediaScope: string;
  providerEnabled: boolean;
  mediaEnabled: boolean;
  retentionEnabled: boolean;
  evaluationRevision: string;
};
export type RuntimePolicy = {
  id: string;
  applicationId: string;
  environment: string;
  config: InputPolicyConfig;
};
function parsePolicyConfigValue(raw: unknown): InputPolicyConfig {
  const v = record(raw);
  keys(v, [
    "version",
    "gatewayAccountId",
    "gatewayProjectId",
    "gatewayCredentialFingerprint",
    "approvalReference",
    "processorReference",
    "retentionReference",
    "noticeBg",
    "noticeEn",
    "models",
    "responseModels",
    "providers",
    "budgetCurrency",
    "runMinor",
    "humanDailyMinor",
    "platformDailyMinor",
    "inputBytes",
    "outputTokens",
    "mediaSeconds",
    "inputSeconds",
    "consentSeconds",
    "audioSeconds",
    "mediaScope",
    "providerEnabled",
    "mediaEnabled",
    "retentionEnabled",
    "evaluationRevision",
  ]);
  if (
    v.version !== 1 ||
    v.budgetCurrency !== "USD" ||
    typeof v.mediaScope !== "string" ||
    !/^[a-f0-9]{64}$/.test(v.mediaScope)
  )
    throw new SellerError("NOT_AVAILABLE");
  const model = record(v.models);
  keys(model, [...INPUT_MODES]);
  const models = Object.fromEntries(
    INPUT_MODES.map((m) => {
      const id = model[m];
      if (
        id !== null &&
        (typeof id !== "string" ||
          !/^[a-z0-9-]{1,40}\/[A-Za-z0-9._:-]{1,120}$/.test(id))
      )
        throw new SellerError("NOT_AVAILABLE");
      return [m, id];
    }),
  ) as InputPolicyConfig["models"];
  const response = record(v.responseModels);
  keys(response, [...INPUT_MODES]);
  const responseModels = Object.fromEntries(
    INPUT_MODES.map((m) => [
      m,
      response[m] === null ? null : text(response[m], 200),
    ]),
  ) as InputPolicyConfig["responseModels"];
  if (
    typeof v.gatewayCredentialFingerprint !== "string" ||
    !/^[a-f0-9]{64}$/.test(v.gatewayCredentialFingerprint) ||
    !/^team_[A-Za-z0-9]{3,128}$/.test(v.gatewayAccountId as string) ||
    !/^prj_[A-Za-z0-9]{3,128}$/.test(v.gatewayProjectId as string) ||
    INPUT_MODES.some((m) => m !== "voice" && models[m] && !responseModels[m])
  )
    throw new SellerError("NOT_AVAILABLE");
  if (
    !Array.isArray(v.providers) ||
    !v.providers.length ||
    v.providers.length > 3 ||
    v.providers.some(
      (p) => typeof p !== "string" || !/^[a-z][a-z0-9-]{1,50}$/.test(p),
    )
  )
    throw new SellerError("NOT_AVAILABLE");
  for (const key of ["providerEnabled", "mediaEnabled", "retentionEnabled"])
    if (typeof v[key] !== "boolean") throw new SellerError("NOT_AVAILABLE");
  const runMinor = integer(v.runMinor, 1000000, 1),
    humanDailyMinor = integer(v.humanDailyMinor, 10000000, runMinor),
    platformDailyMinor = integer(
      v.platformDailyMinor,
      1000000000,
      humanDailyMinor,
    );
  return {
    version: 1,
    gatewayAccountId: text(v.gatewayAccountId, 128),
    gatewayProjectId: text(v.gatewayProjectId, 128),
    gatewayCredentialFingerprint: v.gatewayCredentialFingerprint,
    approvalReference: text(v.approvalReference, 300),
    processorReference: text(v.processorReference, 300),
    retentionReference: text(v.retentionReference, 300),
    noticeBg: text(v.noticeBg, 2000),
    noticeEn: text(v.noticeEn, 2000),
    models,
    responseModels,
    providers: v.providers as string[],
    budgetCurrency: "USD",
    runMinor,
    humanDailyMinor,
    platformDailyMinor,
    inputBytes: integer(v.inputBytes, 16000, 1024),
    outputTokens: integer(v.outputTokens, 4000, 1),
    mediaSeconds: integer(v.mediaSeconds, 86400, 600),
    inputSeconds: integer(v.inputSeconds, 86400, 600),
    consentSeconds: integer(v.consentSeconds, 86400, 600),
    audioSeconds: integer(v.audioSeconds, 60, 1),
    mediaScope: v.mediaScope,
    providerEnabled: v.providerEnabled as boolean,
    mediaEnabled: v.mediaEnabled as boolean,
    retentionEnabled: v.retentionEnabled as boolean,
    evaluationRevision: text(v.evaluationRevision, 128),
  };
}
export function parsePolicyConfig(raw: unknown): InputPolicyConfig {
  try {
    return parsePolicyConfigValue(raw);
  } catch {
    throw new SellerError("NOT_AVAILABLE");
  }
}
/** Approved registry is runtime read/lock-only. No example/default policy is installed. */
export async function runtimePolicy(
  tx: Pick<SellerTransaction, "client">,
  id?: string,
): Promise<RuntimePolicy | null> {
  const binding = requireBackendBindings();
  const row = (
    await tx.client.query<{ id: string; config: unknown }>(
      `SELECT id,config FROM treido.assistant_runtime_policies WHERE application_id=$1 AND environment=$2 AND purpose='shopping-input-v1' AND approved_at<=clock_timestamp() AND revoked_at IS NULL ${id ? "AND id=$3" : ""} ORDER BY approved_at DESC LIMIT 1 FOR SHARE`,
      id
        ? [binding.identity.applicationId, binding.environment, id]
        : [binding.identity.applicationId, binding.environment],
    )
  ).rows[0];
  return row
    ? {
        id: row.id,
        applicationId: binding.identity.applicationId,
        environment: binding.environment,
        config: parsePolicyConfig(row.config),
      }
    : null;
}
export function requirePolicy(
  policy: RuntimePolicy | null,
  inputMode?: InputMode,
) {
  if (
    !policy ||
    !policy.config.retentionEnabled ||
    (inputMode &&
      (!policy.config.providerEnabled || !policy.config.models[inputMode]))
  )
    throw new SellerError("NOT_AVAILABLE");
  return policy;
}
