"use server";

import { redirect } from "next/navigation";
import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import {
  createBusinessSeller,
  ensurePersonalSeller,
} from "./persistence.server";
import { createListingDraft, saveListingDraft } from "../selling/drafts.server";
import { SellerError, type SellerResult } from "./errors";
import type { DraftAcknowledgement } from "../selling/draft-model";

function failure(error: unknown) {
  if (!(error instanceof SellerError))
    console.error("Treido seller operation unavailable.");
  return {
    ok: false,
    code: error instanceof SellerError ? error.code : "NOT_AVAILABLE",
  } as const;
}

export async function persistDraftAction(input: {
  sellerId: string | null;
  draftId: string | null;
  expectedRevision: number;
  requestId: string;
  payload: unknown;
}): Promise<SellerResult<DraftAcknowledgement>> {
  try {
    const identity = await requireVerifiedIdentity();
    if (
      !input ||
      typeof input !== "object" ||
      Array.isArray(input) ||
      (input.draftId !== null && typeof input.draftId !== "string")
    )
      throw new SellerError("INVALID_INPUT");
    const database = getDatabase();
    if (input.draftId !== null) {
      if (!input.sellerId) throw new SellerError("INVALID_INPUT");
      return {
        ok: true,
        data: await saveListingDraft(database, identity, {
          ...input,
          draftId: input.draftId,
          sellerId: input.sellerId,
        }),
      };
    }
    return {
      ok: true,
      data: await createListingDraft(database, identity, input),
    };
  } catch (error) {
    return failure(error);
  }
}

export async function startPersonalAction(form: FormData) {
  const language = form.get("lang") === "bg" ? "bg" : "en";
  let sellerId: string;
  try {
    const identity = await requireVerifiedIdentity();
    sellerId = await ensurePersonalSeller(getDatabase(), identity);
  } catch {
    redirect(`/app?error=unavailable&lang=${language}`);
  }
  redirect(`/app/sellers/${sellerId}/listings/new?lang=${language}`);
}

export async function createBusinessAction(
  _previous: SellerResult<string> | null,
  form: FormData,
): Promise<SellerResult<string>> {
  let sellerId: string;
  try {
    const identity = await requireVerifiedIdentity();
    const name = form.get("name");
    const requestId = form.get("requestId");
    if (typeof name !== "string" || typeof requestId !== "string")
      throw new SellerError("INVALID_INPUT");
    sellerId = await createBusinessSeller(getDatabase(), identity, {
      name,
      requestId,
    });
  } catch (error) {
    return failure(error);
  }
  return { ok: true, data: sellerId };
}
