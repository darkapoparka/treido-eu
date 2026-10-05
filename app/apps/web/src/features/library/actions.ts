"use server";
import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { SellerError } from "../sellers/errors";
import type { PrivateResult } from "./private-session";
import { readLibrary } from "./queries.server";
import { changeLibrary } from "./commands.server";
import {
  parseLibraryQuery,
  type LibraryView,
  type LibraryChange,
} from "./model";
function failure(error: unknown, subject: string | null) {
  if (!(error instanceof SellerError))
    console.error("Treido buyer library unavailable.");
  return {
    ok: false,
    subject,
    code: error instanceof SellerError ? error.code : "NOT_AVAILABLE",
  } as const;
}
export async function readLibraryAction(
  input: unknown,
): Promise<PrivateResult<LibraryView>> {
  let subject: string | null = null;
  try {
    const actor = await requireVerifiedIdentity();
    subject = actor.subject;
    return {
      ok: true,
      subject,
      data: await readLibrary(getDatabase(), actor, input),
    };
  } catch (error) {
    return failure(error, subject);
  }
}
export async function changeLibraryAction(
  command: unknown,
  query: unknown,
  expectedSubject: string,
): Promise<PrivateResult<{ change: LibraryChange; view: LibraryView }>> {
  let subject: string | null = null;
  try {
    const input = parseLibraryQuery(query),
      actor = await requireVerifiedIdentity();
    subject = actor.subject;
    if (subject !== expectedSubject) throw new SellerError("FORBIDDEN");
    const database = getDatabase();
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
      subject,
      data: { change, view: await readLibrary(database, actor, input) },
    };
  } catch (error) {
    return failure(error, subject);
  }
}
