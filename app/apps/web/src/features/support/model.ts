import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";

export const SUPPORT_TOPICS = [
  "account",
  "safety",
  "technical",
  "other",
] as const;
export type SupportTopic = (typeof SUPPORT_TOPICS)[number];
export type SupportState = "open" | "waiting" | "resolved";
export type SupportKind = "create" | "reply" | "note" | "resolve" | "reopen";
export type SupportCommand = {
  actorKey: string;
  requestId: string;
  kind: SupportKind;
  ticketId: string | null;
  expectedRevision: number;
  title: string;
  topic: SupportTopic;
  body: string;
};
export type SupportReceipt = {
  id: string;
  revision: number;
  sequence: number;
  state: SupportState;
};
export type SupportTicket = {
  id: string;
  title: string;
  topic: SupportTopic;
  state: SupportState;
  revision: number;
  lastSequence: number;
  publicSequence: number;
  createdAt: string;
  updatedAt: string;
  unread: boolean;
};
export type SupportEntry = {
  sequence: number;
  side: "requester" | "operator";
  kind: SupportKind;
  body: string;
  at: string;
};
export type SupportView = {
  actorKey: string;
  operator: boolean;
  canWrite: boolean;
  tickets: SupportTicket[];
  nextBefore: string | null;
  ticket: SupportTicket | null;
  entries: SupportEntry[];
  olderSequence: number | null;
};
export function supportText(
  raw: unknown,
  minimum: number,
  maximum: number,
): string {
  if (
    typeof raw !== "string" ||
    raw.length > maximum ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(raw)
  )
    throw new SellerError("INVALID_INPUT");
  const value = raw.trim();
  if (value.length < minimum) throw new SellerError("INVALID_INPUT");
  return value;
}
export function parseSupportCommand(raw: unknown): SupportCommand {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new SellerError("INVALID_INPUT");
  const value = raw as Record<string, unknown>;
  if (
    Object.keys(value).some(
      (key) =>
        ![
          "actorKey",
          "requestId",
          "kind",
          "ticketId",
          "expectedRevision",
          "title",
          "topic",
          "body",
        ].includes(key),
    )
  )
    throw new SellerError("INVALID_INPUT");
  if (
    typeof value.actorKey !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.actorKey) ||
    !validId(value.requestId) ||
    !["create", "reply", "note", "resolve", "reopen"].includes(
      String(value.kind),
    )
  )
    throw new SellerError("INVALID_INPUT");
  const kind = value.kind as SupportKind;
  if (
    kind !== "create" &&
    (!validId(value.ticketId) ||
      !Number.isSafeInteger(value.expectedRevision) ||
      Number(value.expectedRevision) < 1 ||
      Number(value.expectedRevision) >= 2147483647)
  )
    throw new SellerError("INVALID_INPUT");
  if (
    kind === "create" &&
    (!SUPPORT_TOPICS.includes(value.topic as SupportTopic) ||
      value.ticketId != null ||
      (value.expectedRevision !== undefined && value.expectedRevision !== 0))
  )
    throw new SellerError("INVALID_INPUT");
  return {
    actorKey: value.actorKey,
    requestId: value.requestId as string,
    kind,
    ticketId: kind === "create" ? null : (value.ticketId as string),
    expectedRevision: kind === "create" ? 0 : Number(value.expectedRevision),
    title: kind === "create" ? supportText(value.title, 3, 120) : "",
    topic: kind === "create" ? (value.topic as SupportTopic) : "other",
    body: supportText(value.body, 1, 4000),
  };
}
export function supportTransition(
  state: SupportState,
  kind: Exclude<SupportKind, "create">,
  operator: boolean,
): SupportState {
  if (kind === "note") {
    if (!operator) throw new SellerError("FORBIDDEN");
    return state;
  }
  if (kind === "reopen") {
    if (state !== "resolved") throw new SellerError("CONFLICT");
    return "open";
  }
  if (state === "resolved") throw new SellerError("CONFLICT");
  if (kind === "resolve") return "resolved";
  return operator ? "waiting" : "open";
}
