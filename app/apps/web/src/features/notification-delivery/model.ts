import { validId } from "../selling/draft-model";
import { SellerError } from "../sellers/errors";

export const NOTIFICATION_CONSENT_VERSION = "email-notifications-v1";
export type NotificationLanguage = "bg" | "en";
export type NotificationSettings = {
  savedSearchEmail: boolean;
  messageEmail: boolean;
};
export type NotificationPreferenceView = {
  actorKey: string;
  actorSubject: string;
  revision: number;
  language: NotificationLanguage;
  settings: NotificationSettings;
  recipient: "ready" | "missing" | "unavailable";
  deliveryAvailable: boolean;
};
export type NotificationPreferenceCommand = NotificationSettings & {
  actorKey: string;
  requestId: string;
  expectedRevision: number;
  language: NotificationLanguage;
  consentVersion: typeof NOTIFICATION_CONSENT_VERSION;
};
export type NotificationPreferenceCode =
  | "INVALID_INPUT"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "NOT_AVAILABLE"
  | "NOT_FOUND";
export type NotificationPreferenceAcknowledgement = {
  actorKey: string;
  actorSubject: string;
  requestId: string;
  revision: number;
  settings: NotificationSettings;
};
export type NotificationPreferenceResult =
  | { ok: true; data: NotificationPreferenceAcknowledgement }
  | { ok: false; code: NotificationPreferenceCode };
export type NotificationPreferenceReadResult =
  | { ok: true; data: NotificationPreferenceView }
  | { ok: false; code: NotificationPreferenceCode };
export function notificationLanguage(raw: unknown): NotificationLanguage {
  if (raw !== "bg" && raw !== "en") throw new SellerError("INVALID_INPUT");
  return raw;
}
export function parseNotificationPreference(
  raw: unknown,
): NotificationPreferenceCommand {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new SellerError("INVALID_INPUT");
  const x = raw as Record<string, unknown>;
  const keys = [
    "actorKey",
    "requestId",
    "expectedRevision",
    "language",
    "savedSearchEmail",
    "messageEmail",
    "consentVersion",
  ];
  if (
    Object.keys(x).length !== keys.length ||
    Object.keys(x).some((key) => !keys.includes(key)) ||
    typeof x.actorKey !== "string" ||
    !/^[a-f0-9]{64}$/.test(x.actorKey) ||
    !validId(x.requestId) ||
    !Number.isSafeInteger(x.expectedRevision) ||
    Number(x.expectedRevision) < 0 ||
    Number(x.expectedRevision) >= 2147483646 ||
    typeof x.savedSearchEmail !== "boolean" ||
    typeof x.messageEmail !== "boolean" ||
    x.consentVersion !== NOTIFICATION_CONSENT_VERSION
  )
    throw new SellerError("INVALID_INPUT");
  return {
    actorKey: x.actorKey,
    requestId: x.requestId as string,
    expectedRevision: x.expectedRevision as number,
    language: notificationLanguage(x.language),
    savedSearchEmail: x.savedSearchEmail,
    messageEmail: x.messageEmail,
    consentVersion: NOTIFICATION_CONSENT_VERSION,
  };
}
export type NotificationJobRow = {
  id: string;
  kind: "buyer.notification-email";
  sellerId: null;
  buyerId: string;
  resourceId: string;
  operationKey: string;
  actorId: null;
  authority: "notification";
  state: "pending" | "accepted" | "completed" | "cancelled" | "dead";
  generation: number;
  attempts: number;
};
export type NotificationEffectContext = NotificationJobRow & {
  executionToken: string;
};
export type NotificationMailState =
  | "pending"
  | "unavailable"
  | "uncertain"
  | "submitted"
  | "sent"
  | "delivered"
  | "bounced"
  | "failed"
  | "complained"
  | "cancelled";
