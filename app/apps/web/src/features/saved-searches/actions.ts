"use server";
import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { SellerError, type SellerResult } from "../sellers/errors";
import { readSavedSearches } from "./queries.server";
import { changeSavedSearch } from "./commands.server";
import { readSearchUpdates } from "./feed.server";
import { searchActorKey } from "./storage.server";
import type { SearchView, SearchChange, MatchFeed } from "./model";
function failure(error: unknown) {
  if (!(error instanceof SellerError))
    console.error("Treido saved searches unavailable.");
  return {
    ok: false as const,
    code:
      error instanceof SellerError ? error.code : ("NOT_AVAILABLE" as const),
  };
}
export async function readSavedSearchesAction(): Promise<
  SellerResult<{ subject: string; view: SearchView }>
> {
  try {
    const identity = await requireVerifiedIdentity();
    return {
      ok: true,
      data: {
        subject: identity.subject,
        view: await readSavedSearches(getDatabase(), identity),
      },
    };
  } catch (error) {
    return failure(error);
  }
}
export async function changeSavedSearchAction(
  raw: unknown,
): Promise<SellerResult<{ subject: string; change: SearchChange }>> {
  try {
    const identity = await requireVerifiedIdentity();
    return {
      ok: true,
      data: {
        subject: identity.subject,
        change: await changeSavedSearch(getDatabase(), identity, raw),
      },
    };
  } catch (error) {
    return failure(error);
  }
}
export async function readSearchUpdatesAction(
  raw: unknown,
  actorKey: string,
): Promise<SellerResult<{ subject: string; feed: MatchFeed }>> {
  try {
    const identity = await requireVerifiedIdentity();
    if (actorKey !== searchActorKey(identity))
      throw new SellerError("FORBIDDEN");
    return {
      ok: true,
      data: {
        subject: identity.subject,
        feed: await readSearchUpdates(getDatabase(), identity, raw),
      },
    };
  } catch (error) {
    return failure(error);
  }
}
