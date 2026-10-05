"use server";
import { reverificationError } from "@clerk/nextjs/server";
import { getDatabase } from "../../server/db/database";
import {
  hasVerifiedRecentAuthentication,
  requireVerifiedIdentity,
} from "../../server/identity/clerk.server";
import { referencePreviewEnabled } from "../catalog/queries.server";
import { backendConfigured } from "../sellers/backend-status.server";
import { SellerError } from "../sellers/errors";
import { parseDownloadInput, PrivacyError, type PrivacyCode } from "./model";
import { readPrivacy, readPrivateDownload } from "./queries.server";
import { changePrivacy } from "./commands.server";
function failure(error: unknown) {
  const code: PrivacyCode =
    error instanceof PrivacyError || error instanceof SellerError
      ? error.code
      : "NOT_AVAILABLE";
  if (!(error instanceof PrivacyError) && !(error instanceof SellerError))
    console.error("Treido personal data operation unavailable.");
  return { ok: false as const, code };
}
function requireConnectedPrivacy() {
  if (referencePreviewEnabled() || !backendConfigured())
    throw new PrivacyError("NOT_AVAILABLE");
}
export async function readPrivacyAction(promptForAuthentication = false) {
  try {
    requireConnectedPrivacy();
    const identity = await requireVerifiedIdentity();
    if (!hasVerifiedRecentAuthentication(identity)) {
      if (promptForAuthentication) return reverificationError("strict");
      return { ok: false as const, code: "RECENT_AUTH_REQUIRED" as const };
    }
    return {
      ok: true as const,
      data: {
        subject: identity.subject,
        view: await readPrivacy(getDatabase(), identity),
      },
    };
  } catch (error) {
    return failure(error);
  }
}
export async function changePrivacyAction(raw: unknown) {
  try {
    requireConnectedPrivacy();
    const identity = await requireVerifiedIdentity();
    if (!hasVerifiedRecentAuthentication(identity))
      return reverificationError("strict");
    return {
      ok: true as const,
      data: {
        subject: identity.subject,
        change: await changePrivacy(getDatabase(), identity, raw),
      },
    };
  } catch (error) {
    return failure(error);
  }
}
export async function downloadPrivacyAction(raw: unknown) {
  try {
    requireConnectedPrivacy();
    const input = parseDownloadInput(raw),
      identity = await requireVerifiedIdentity();
    if (!hasVerifiedRecentAuthentication(identity))
      return reverificationError("strict");
    return {
      ok: true as const,
      data: {
        subject: identity.subject,
        body: await readPrivateDownload(
          getDatabase(),
          identity,
          input.id,
          input.actorKey,
        ),
      },
    };
  } catch (error) {
    return failure(error);
  }
}
