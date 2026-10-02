"use server";
import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { SellerError, type SellerResult } from "../sellers/errors";
import {
  openListingConversation,
  sendConversationMessage,
} from "./participants.server";
import {
  readInbox,
  readConversation,
  markConversationRead,
  setContactBlocked,
} from "./inbox.server";
import {
  parseInboxScope,
  type InboxView,
  type ConversationView,
} from "./inbox-model";
function failure(error: unknown) {
  if (!(error instanceof SellerError))
    console.error("Treido messaging unavailable.");
  return {
    ok: false,
    code: error instanceof SellerError ? error.code : "NOT_AVAILABLE",
  } as const;
}
export async function readInboxAction(
  input: unknown,
): Promise<SellerResult<InboxView>> {
  try {
    const actor = await requireVerifiedIdentity();
    return { ok: true, data: await readInbox(getDatabase(), actor, input) };
  } catch (error) {
    return failure(error);
  }
}
export async function readConversationAction(
  input: unknown,
): Promise<SellerResult<ConversationView>> {
  try {
    const actor = await requireVerifiedIdentity();
    return {
      ok: true,
      data: await readConversation(getDatabase(), actor, input),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function sendMessageAction(
  input: unknown,
): Promise<SellerResult<{ id: string; sequence: number }>> {
  try {
    const actor = await requireVerifiedIdentity();
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new SellerError("INVALID_INPUT");
    const value = input as Record<string, unknown>,
      scope = parseInboxScope({ sellerId: value.sellerId });
    if (
      !scope ||
      Object.keys(value).some(
        (k) => !["sellerId", "threadId", "body", "requestId"].includes(k),
      )
    )
      throw new SellerError("INVALID_INPUT");
    return {
      ok: true,
      data: await sendConversationMessage(
        getDatabase(),
        actor,
        {
          threadId: value.threadId,
          body: value.body,
          requestId: value.requestId,
          attachmentIds: [],
        },
        scope,
      ),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function markReadAction(
  input: unknown,
): Promise<SellerResult<{ sequence: number }>> {
  try {
    const actor = await requireVerifiedIdentity();
    return {
      ok: true,
      data: await markConversationRead(getDatabase(), actor, input),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function blockContactAction(
  input: unknown,
): Promise<SellerResult<{ revision: number }>> {
  try {
    const actor = await requireVerifiedIdentity();
    return {
      ok: true,
      data: await setContactBlocked(getDatabase(), actor, input),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function startConversationAction(
  listingId: string,
): Promise<SellerResult<{ id: string }>> {
  try {
    const actor = await requireVerifiedIdentity();
    return {
      ok: true,
      data: await openListingConversation(getDatabase(), actor, listingId),
    };
  } catch (error) {
    return failure(error);
  }
}
