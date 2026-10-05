"use server";
import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { libraryActorKey } from "../library/cursor.server";
import { SellerError, type SellerResult } from "../sellers/errors";
import { readNotificationFeed } from "./queries.server";
import { markNotificationsRead } from "./commands.server";
import type { NotificationFeed, NotificationReadResult } from "./model";
function failure(error: unknown) {
  if (!(error instanceof SellerError))
    console.error("Treido notifications unavailable.");
  return {
    ok: false as const,
    code:
      error instanceof SellerError ? error.code : ("NOT_AVAILABLE" as const),
  };
}
export async function readNotificationsAction(
  raw: unknown,
  actorKey: string,
): Promise<SellerResult<NotificationFeed>> {
  try {
    const identity = await requireVerifiedIdentity();
    if (actorKey !== libraryActorKey(identity))
      throw new SellerError("FORBIDDEN");
    return {
      ok: true,
      data: await readNotificationFeed(getDatabase(), identity, raw),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function markNotificationsReadAction(
  raw: unknown,
): Promise<SellerResult<NotificationReadResult[]>> {
  try {
    return {
      ok: true,
      data: await markNotificationsRead(
        getDatabase(),
        await requireVerifiedIdentity(),
        raw,
      ),
    };
  } catch (error) {
    return failure(error);
  }
}
