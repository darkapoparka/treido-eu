"use server";
import { readVerifiedIdentity } from "../../server/identity/clerk.server";
import { getDatabase } from "../../server/db/database";
import { SellerError } from "./errors";
import { readStudioSearch } from "./studio-search.server";
export async function searchStudioAction(raw: unknown) {
  try {
    const identity = await readVerifiedIdentity();
    if (!identity) return { ok: false as const, code: "FORBIDDEN" as const };
    return {
      ok: true as const,
      data: await readStudioSearch(getDatabase(), identity, raw),
    };
  } catch (error) {
    return {
      ok: false as const,
      code:
        error instanceof SellerError ? error.code : ("NOT_AVAILABLE" as const),
    };
  }
}
