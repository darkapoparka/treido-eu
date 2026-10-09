"use server";
import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { SellerError } from "../sellers/errors";
import { changeNotificationPreferences } from "./commands.server";
import { readNotificationPreferences } from "./preferences.server";
import {
  notificationLanguage,
  type NotificationPreferenceResult,
  type NotificationPreferenceReadResult,
  type NotificationPreferenceCode,
} from "./model";
function failure(error: unknown): {
  ok: false;
  code: NotificationPreferenceCode;
} {
  const codes = [
    "INVALID_INPUT",
    "UNAUTHENTICATED",
    "FORBIDDEN",
    "CONFLICT",
    "NOT_AVAILABLE",
    "NOT_FOUND",
  ];
  if (!(error instanceof SellerError))
    console.error("Treido email notification preferences unavailable.");
  return {
    ok: false,
    code:
      error instanceof SellerError && codes.includes(error.code)
        ? (error.code as NotificationPreferenceCode)
        : "NOT_AVAILABLE",
  };
}
export async function notificationPreferenceAction(
  raw: unknown,
): Promise<NotificationPreferenceResult> {
  try {
    return {
      ok: true,
      data: await changeNotificationPreferences(
        getDatabase(),
        await requireVerifiedIdentity(),
        raw,
      ),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function readNotificationPreferenceAction(
  rawLanguage: unknown,
): Promise<NotificationPreferenceReadResult> {
  try {
    const language = notificationLanguage(rawLanguage);
    return {
      ok: true,
      data: await readNotificationPreferences(
        getDatabase(),
        await requireVerifiedIdentity(),
        language,
      ),
    };
  } catch (error) {
    return failure(error);
  }
}
