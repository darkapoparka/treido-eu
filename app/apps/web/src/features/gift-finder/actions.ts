"use server";
import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { backendConfigured } from "../sellers/backend-status.server";
import { referencePreviewEnabled } from "../catalog/queries.server";
import { SellerError } from "../sellers/errors";
import type { AssistantResult } from "../assistant-tools/actions";
import { readGift, changeGift } from "./commands.server";
import type { GiftView, GiftChange } from "./model";
async function identity() {
  if (referencePreviewEnabled() || !backendConfigured())
    throw new SellerError("NOT_AVAILABLE");
  return requireVerifiedIdentity();
}
function failure(error: unknown) {
  if (!(error instanceof SellerError))
    console.error("Treido gift request unavailable.");
  return {
    ok: false as const,
    code:
      error instanceof SellerError ? error.code : ("NOT_AVAILABLE" as const),
  };
}
export async function readGiftAction(): Promise<AssistantResult<GiftView>> {
  try {
    const actor = await identity();
    return {
      ok: true,
      data: {
        subject: actor.subject,
        value: await readGift(getDatabase(), actor),
      },
    };
  } catch (error) {
    return failure(error);
  }
}
export async function changeGiftAction(
  raw: unknown,
): Promise<AssistantResult<GiftChange>> {
  try {
    const actor = await identity();
    return {
      ok: true,
      data: {
        subject: actor.subject,
        value: await changeGift(getDatabase(), actor, raw),
      },
    };
  } catch (error) {
    return failure(error);
  }
}
