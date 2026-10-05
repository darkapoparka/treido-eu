"use server";
import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { SellerError, type SellerResult } from "../sellers/errors";
import { readLibrary } from "./queries.server";
import { changeLibrary } from "./commands.server";
import {
  parseLibraryQuery,
  type LibraryView,
  type LibraryChange,
} from "./model";
function failure(error: unknown) {
  if (!(error instanceof SellerError))
    console.error("Treido buyer library unavailable.");
  return {
    ok: false,
    code: error instanceof SellerError ? error.code : "NOT_AVAILABLE",
  } as const;
}
export async function readLibraryAction(
  input: unknown,
): Promise<SellerResult<LibraryView>> {
  try {
    return {
      ok: true,
      data: await readLibrary(
        getDatabase(),
        await requireVerifiedIdentity(),
        input,
      ),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function changeLibraryAction(
  command: unknown,
  query: unknown,
): Promise<SellerResult<{ change: LibraryChange; view: LibraryView }>> {
  try {
    const input = parseLibraryQuery(query),
      actor = await requireVerifiedIdentity(),
      database = getDatabase();
    const change = await changeLibrary(database, actor, command);
    // A delete can legitimately invalidate the selected collection. Return the root library instead.
    const operation =
      command && typeof command === "object" && "operation" in command
        ? command.operation
        : null;
    if (
      operation &&
      typeof operation === "object" &&
      "kind" in operation &&
      operation.kind === "deleteCollection"
    ) {
      input.collectionId = null;
      input.cursor = null;
    }
    return {
      ok: true,
      data: { change, view: await readLibrary(database, actor, input) },
    };
  } catch (error) {
    return failure(error);
  }
}
