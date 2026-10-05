"use server";
import { cookies } from "next/headers";
import { reverificationError } from "@clerk/nextjs/server";
import { getDatabase } from "../../server/db/database";
import {
  hasVerifiedRecentAuthentication,
  requireVerifiedIdentity,
  type VerifiedIdentity,
} from "../../server/identity/clerk.server";
import { backendConfigured } from "../sellers/backend-status.server";
import { referencePreviewEnabled } from "../catalog/queries.server";
import { SellerError } from "../sellers/errors";
import { localeCookie } from "../locale/locale";
import {
  ClosureError,
  parseCommand,
  uuid,
  type ClosureCode,
  type ClosureView,
} from "./model";
import { changeClosure, recoverClosure } from "./commands.server";
import { readClosure } from "./queries.server";
import {
  readAccountPreferences,
  type PreferenceView,
} from "./preferences.server";
import { processOwnSessionEffect } from "./effects.server";
export type SettingsMode = "closure" | "preferences" | "security";
export type SettingsView =
  | { mode: "preferences"; preferences: PreferenceView }
  | { mode: "closure" | "security"; closure: ClosureView };
function connected() {
  if (referencePreviewEnabled() || !backendConfigured())
    throw new ClosureError("NOT_AVAILABLE");
}
function failure(error: unknown) {
  const code: ClosureCode =
    error instanceof ClosureError || error instanceof SellerError
      ? error.code
      : "NOT_AVAILABLE";
  return { ok: false as const, code };
}
async function acknowledgeCurrentLocale(identity: VerifiedIdentity) {
  const preferences = (await readAccountPreferences(getDatabase(), identity))
    .preferences;
  if (preferences) {
    const store = await cookies();
    store.set(localeCookie, preferences.locale, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 31536000,
    });
  }
  return preferences;
}
export async function readAccountSettingsAction(
  mode: SettingsMode,
  prompt = false,
) {
  try {
    connected();
    if (!["closure", "preferences", "security"].includes(mode))
      throw new ClosureError("INVALID_INPUT");
    const identity = await requireVerifiedIdentity();
    if (mode !== "preferences" && !hasVerifiedRecentAuthentication(identity)) {
      if (prompt) return reverificationError("strict");
      return { ok: false as const, code: "RECENT_AUTH_REQUIRED" as const };
    }
    const view: SettingsView =
      mode === "preferences"
        ? {
            mode: mode,
            preferences: await readAccountPreferences(getDatabase(), identity),
          }
        : {
            mode: mode,
            closure: await readClosure(
              getDatabase(),
              identity,
              mode === "security",
            ),
          };
    return { ok: true as const, data: { subject: identity.subject, view } };
  } catch (error) {
    return failure(error);
  }
}
export async function changeAccountSettingsAction(raw: unknown) {
  try {
    connected();
    const command = parseCommand(raw),
      identity = await requireVerifiedIdentity();
    if (
      command.operation.kind !== "preferences" &&
      !hasVerifiedRecentAuthentication(identity)
    )
      return reverificationError("strict");
    const change = await changeClosure(getDatabase(), identity, command);
    let preferences = null;
    if (command.operation.kind === "preferences") {
      preferences = await acknowledgeCurrentLocale(identity);
    }
    return {
      ok: true as const,
      data: { subject: identity.subject, change, preferences },
    };
  } catch (error) {
    return failure(error);
  }
}
export async function recoverAccountSettingsAction(raw: unknown) {
  try {
    connected();
    const command = parseCommand(raw),
      identity = await requireVerifiedIdentity();
    if (
      command.operation.kind !== "preferences" &&
      !hasVerifiedRecentAuthentication(identity)
    )
      return reverificationError("strict");
    const change = await recoverClosure(getDatabase(), identity, command);
    if (change && command.operation.kind === "preferences")
      await acknowledgeCurrentLocale(identity);
    return {
      ok: true as const,
      data: {
        subject: identity.subject,
        change,
      },
    };
  } catch (error) {
    return failure(error);
  }
}
export async function executeOwnSessionRevocationAction(id: unknown) {
  try {
    connected();
    if (!uuid(id)) throw new ClosureError("INVALID_INPUT");
    const identity = await requireVerifiedIdentity();
    if (!hasVerifiedRecentAuthentication(identity))
      return reverificationError("strict");
    return {
      ok: true as const,
      data: {
        subject: identity.subject,
        ...(await processOwnSessionEffect(getDatabase(), identity, id)),
      },
    };
  } catch (error) {
    return failure(error);
  }
}
