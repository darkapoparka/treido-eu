import {
  SellerError,
  type SellerErrorCode,
  type SellerResult,
} from "../sellers/errors";
import { validId } from "../selling/draft-model";
import {
  parseToolIntent,
  toolParams,
  type ToolIntent,
} from "../shopping-tools/intent";
import type { ToolResults } from "../shopping-tools/model";
import { discoveryTerms } from "../catalog/public-discovery-model";

export const INPUT_MODES = ["text", "photo", "voice"] as const;
export type InputMode = (typeof INPUT_MODES)[number];
export const INPUT_LIMITS = {
  commandBytes: 24000,
  prompt: 2000,
  transcript: 4000,
  responseBytes: 65536,
  steps: 6,
  cards: 20,
  comparisons: 4,
  seconds: 15,
  mediaBytes: 12 * 1024 * 1024,
  audioSeconds: 60,
} as const;
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}
export function invalid(): never {
  throw new SellerError("INVALID_INPUT");
}
export function keys(value: Record<string, unknown>, allowed: string[]) {
  if (
    Object.keys(value).some((key) => !allowed.includes(key)) ||
    allowed.some((key) => !(key in value))
  )
    invalid();
}
export function text(value: unknown, maximum: number, empty = false): string {
  if (
    typeof value !== "string" ||
    value.length > maximum ||
    (!empty && !value.trim()) ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
  )
    invalid();
  return value;
}
export function mode(value: unknown): InputMode {
  if (!INPUT_MODES.includes(value as InputMode)) invalid();
  return value as InputMode;
}
export function uuid(value: unknown): string {
  if (typeof value !== "string" || !validId(value)) invalid();
  return value;
}
export function integer(value: unknown, maximum: number, minimum = 0): number {
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < minimum ||
    (value as number) > maximum
  )
    invalid();
  return value as number;
}
export function criteria(value: unknown): string {
  const intent = parseToolIntent(value, "find-for-me");
  if (intent.cursor) invalid();
  return toolParams(intent).toString();
}
/** Refinement cannot remove or replace any explicitly selected hard filter. */
export function preserveConstraints(original: string, proposed: string) {
  const base = new URLSearchParams(criteria(original)),
    next = new URLSearchParams(criteria(proposed));
  if (
    parseToolIntent(original, "find-for-me").discovery.locale !==
    parseToolIntent(proposed, "find-for-me").discovery.locale
  )
    invalid();
  for (const key of new Set(base.keys())) {
    const expected = base.getAll(key),
      actual = next.getAll(key);
    if (
      expected.length !== actual.length ||
      expected.some((value, index) => actual[index] !== value)
    )
      invalid();
  }
  return criteria(proposed);
}
export type Interpretation = {
  criteria: string;
  itemType: string | null;
  colour: string | null;
  style: string | null;
  transcript: string | null;
};
export function parseInterpretation(
  raw: unknown,
  inputMode: InputMode,
  original: string,
): Interpretation {
  const value = record(raw);
  keys(value, ["criteria", "itemType", "colour", "style", "transcript"]);
  const nullable = (key: string, maximum: number) => {
    const result = value[key] === null ? null : text(value[key], maximum);
    if (
      result !== null &&
      key !== "transcript" &&
      /[<>]|https?:\/\/|javascript:|data:/i.test(result)
    )
      invalid();
    return result;
  };
  const result = {
    criteria: preserveConstraints(original, criteria(value.criteria)),
    itemType: nullable("itemType", 120),
    colour: nullable("colour", 120),
    style: nullable("style", 120),
    transcript: nullable("transcript", INPUT_LIMITS.transcript),
  };
  if (inputMode !== "voice" && result.transcript !== null) invalid();
  if (inputMode === "photo") {
    const base = new URLSearchParams(criteria(original)),
      next = new URLSearchParams(result.criteria);
    // Photo labels may supply visual search words; all other criteria must
    // already come from the human. This does not constrain deliberate edits.
    for (const key of new Set(next.keys()))
      if (!base.has(key) && key !== "q") invalid();
    if (!base.has("q") && next.has("q")) {
      const visualTerms = discoveryTerms(
          [result.itemType, result.colour, result.style].join(" "),
        ).sort(),
        proposedTerms = discoveryTerms(next.get("q")!).sort();
      if (
        !visualTerms.length ||
        visualTerms.length !== proposedTerms.length ||
        visualTerms.some((term, index) => term !== proposedTerms[index])
      )
        invalid();
    }
  }
  return result;
}
export type InputOperation =
  | { kind: "consent"; policyId: string; granted: boolean; confirmed: true }
  | {
      kind: "stage";
      policyId: string;
      bytes: number;
      contentType: string;
      checksum: string;
      confirmed: true;
    }
  | { kind: "complete"; assetId: string }
  | {
      kind: "prepare";
      policyId: string;
      criteria: string;
      prompt: string;
      mediaId: string | null;
      confirmed: true;
    }
  | { kind: "execute"; runId: string; confirmed: true }
  | { kind: "accept"; runId: string; criteria: string; confirmed: true }
  | {
      kind: "cancel";
      runId: string | null;
      assetId: string | null;
      confirmed: true;
    };
export type InputCommand = {
  actorKey: string;
  requestId: string;
  expectedRevision: number;
  mode: InputMode;
  operation: InputOperation;
};
export function parseInputCommand(raw: unknown): InputCommand {
  let serialized: string;
  try {
    serialized = JSON.stringify(raw);
  } catch {
    invalid();
  }
  if (
    typeof serialized !== "string" ||
    new TextEncoder().encode(serialized).length > INPUT_LIMITS.commandBytes
  )
    invalid();
  const value = record(raw);
  keys(value, [
    "actorKey",
    "requestId",
    "expectedRevision",
    "mode",
    "operation",
  ]);
  if (
    typeof value.actorKey !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.actorKey)
  )
    invalid();
  const inputMode = mode(value.mode),
    op = record(value.operation),
    kind = op.kind;
  const confirmed = () => {
    if (op.confirmed !== true) invalid();
    return true as const;
  };
  let operation: InputOperation;
  switch (kind) {
    case "consent":
      keys(op, ["kind", "policyId", "granted", "confirmed"]);
      if (typeof op.granted !== "boolean") invalid();
      operation = {
        kind,
        policyId: uuid(op.policyId),
        granted: op.granted,
        confirmed: confirmed(),
      };
      break;
    case "stage":
      keys(op, [
        "kind",
        "policyId",
        "bytes",
        "contentType",
        "checksum",
        "confirmed",
      ]);
      if (
        inputMode === "text" ||
        typeof op.checksum !== "string" ||
        !/^[a-f0-9]{64}$/.test(op.checksum)
      )
        invalid();
      if (
        !(
          inputMode === "voice"
            ? ["audio/wav"]
            : ["image/jpeg", "image/png", "image/webp"]
        ).includes(op.contentType as string)
      )
        invalid();
      operation = {
        kind,
        policyId: uuid(op.policyId),
        bytes: integer(op.bytes, INPUT_LIMITS.mediaBytes, 1),
        contentType: op.contentType as string,
        checksum: op.checksum,
        confirmed: confirmed(),
      };
      break;
    case "complete":
      keys(op, ["kind", "assetId"]);
      operation = { kind, assetId: uuid(op.assetId) };
      break;
    case "prepare":
      keys(op, [
        "kind",
        "policyId",
        "criteria",
        "prompt",
        "mediaId",
        "confirmed",
      ]);
      operation = {
        kind,
        policyId: uuid(op.policyId),
        criteria: criteria(op.criteria),
        prompt: text(op.prompt, INPUT_LIMITS.prompt, true),
        mediaId: op.mediaId === null ? null : uuid(op.mediaId),
        confirmed: confirmed(),
      };
      if (
        (inputMode === "text") !== (operation.mediaId === null) ||
        (inputMode === "text" && !operation.prompt.trim())
      )
        invalid();
      break;
    case "execute":
      keys(op, ["kind", "runId", "confirmed"]);
      operation = { kind, runId: uuid(op.runId), confirmed: confirmed() };
      break;
    case "accept":
      keys(op, ["kind", "runId", "criteria", "confirmed"]);
      operation = {
        kind,
        runId: uuid(op.runId),
        criteria: criteria(op.criteria),
        confirmed: confirmed(),
      };
      break;
    case "cancel":
      keys(op, ["kind", "runId", "assetId", "confirmed"]);
      operation = {
        kind,
        runId: op.runId === null ? null : uuid(op.runId),
        assetId: op.assetId === null ? null : uuid(op.assetId),
        confirmed: confirmed(),
      };
      break;
    default:
      invalid();
  }
  return {
    actorKey: value.actorKey,
    requestId: uuid(value.requestId),
    expectedRevision: integer(value.expectedRevision, 2147483645),
    mode: inputMode,
    operation,
  };
}
export type RunState =
  | "reserved"
  | "calling"
  | "unknown"
  | "proposed"
  | "accepted"
  | "cancelled"
  | "failed";
export type InputChange = {
  revision: number;
  runId: string | null;
  assetId: string | null;
  replayed: boolean;
};
/** A malformed HTTP acknowledgment must leave the original command pending. */
export function parseInputResponse(
  raw: unknown,
): SellerResult<{ subject: string; value: InputChange }> {
  const response = record(raw);
  if (response.ok === false) {
    keys(response, ["ok", "code"]);
    const allowed: SellerErrorCode[] = [
      "UNAUTHENTICATED",
      "FORBIDDEN",
      "NOT_FOUND",
      "INVALID_INPUT",
      "CONFLICT",
      "QUOTA_EXCEEDED",
      "NOT_AVAILABLE",
    ];
    if (!allowed.includes(response.code as SellerErrorCode)) invalid();
    return { ok: false, code: response.code as SellerErrorCode };
  }
  if (response.ok !== true) invalid();
  keys(response, ["ok", "data"]);
  const data = record(response.data);
  keys(data, ["subject", "value"]);
  const value = record(data.value);
  keys(value, ["revision", "runId", "assetId", "replayed"]);
  if (typeof value.replayed !== "boolean") invalid();
  return {
    ok: true,
    data: {
      subject: text(data.subject, 200),
      value: {
        revision: integer(value.revision, 2147483646, 1),
        runId: value.runId === null ? null : uuid(value.runId),
        assetId: value.assetId === null ? null : uuid(value.assetId),
        replayed: value.replayed,
      },
    },
  };
}
export type InputPolicyView = {
  id: string;
  noticeBg: string;
  noticeEn: string;
  expiresSeconds: number;
  audioSeconds: number;
  modes: InputMode[];
  mediaReady: boolean;
};
export type InputView = {
  actorKey: string;
  revision: number;
  mode: InputMode;
  policy: InputPolicyView | null;
  consent: boolean;
  consentChoice: { policyId: string; granted: boolean } | null;
  asset: {
    id: string;
    state: string;
    expiresAt: string;
    cleanupAfter: string;
    preview: string | null;
    bytes: number;
    contentType: string;
    checksum: string;
  } | null;
  run: {
    id: string;
    state: RunState;
    criteria: string | null;
    reviewedCriteria: string | null;
    prompt: string | null;
    proposal: Interpretation | null;
    budgetPending: boolean;
    expiresAt: string;
  } | null;
  results: ToolResults | null;
};
export type AssistantInterpretInputProps = {
  initial: ToolIntent;
  locale: "bg" | "en";
  mode: InputMode;
  onReviewedIntent?: (canonicalCriteria: string) => void;
};
