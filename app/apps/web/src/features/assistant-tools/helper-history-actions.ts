"use server";
import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { backendConfigured } from "../sellers/backend-status.server";
import { referencePreviewEnabled } from "../catalog/queries.server";
import { SellerError } from "../sellers/errors";
import type { AssistantResult } from "./actions";
import type { HelperHistoryView } from "./helper-history-model";
import { readHelperHistory } from "./helper-history.server";

export async function readHelperHistoryAction(raw: unknown): Promise<AssistantResult<HelperHistoryView>> {
  try {
    if (referencePreviewEnabled() || !backendConfigured()) throw new SellerError("NOT_AVAILABLE");
    const identity = await requireVerifiedIdentity();
    return { ok: true, data: { subject: identity.subject, value: await readHelperHistory(getDatabase(), identity, raw) } };
  } catch (error) {
    return { ok: false, code: error instanceof SellerError ? error.code : "NOT_AVAILABLE" };
  }
}
