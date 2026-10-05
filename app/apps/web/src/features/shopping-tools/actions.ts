"use server";
import { inTransaction, getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { readLibrary } from "../library/queries.server";
import type { LibraryItem } from "../library/model";
import { SellerError, type SellerResult } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { readComparison, changeComparison } from "./comparison.server";
import { readToolFacts } from "./catalogue.server";
import type { ComparisonView, ComparisonChange, ToolListing } from "./model";
function failure(error: unknown) {
  if (!(error instanceof SellerError))
    console.error("Treido shopping tools unavailable.");
  return {
    ok: false as const,
    code:
      error instanceof SellerError ? error.code : ("NOT_AVAILABLE" as const),
  };
}
export async function readComparisonAction(): Promise<
  SellerResult<{ subject: string; view: ComparisonView }>
> {
  try {
    const actor = await requireVerifiedIdentity();
    return {
      ok: true,
      data: {
        subject: actor.subject,
        view: await readComparison(getDatabase(), actor),
      },
    };
  } catch (error) {
    return failure(error);
  }
}
export async function changeComparisonAction(
  raw: unknown,
): Promise<SellerResult<{ subject: string; change: ComparisonChange }>> {
  try {
    const actor = await requireVerifiedIdentity();
    const change = await changeComparison(getDatabase(), actor, raw);
    return { ok: true, data: { subject: actor.subject, change } };
  } catch (error) {
    return failure(error);
  }
}
/** Fresh fact read for saved-item selection and explicit downstream review.
 * Neither this action nor a successful read places a stock hold or sends contact. */
export async function readCurrentToolListingAction(
  raw: unknown,
): Promise<SellerResult<ToolListing>> {
  try {
    if (!validId(raw)) throw new SellerError("INVALID_INPUT");
    const item = await inTransaction(getDatabase(), async (tx) =>
      (await readToolFacts(tx, [raw.toLowerCase()])).get(raw.toLowerCase()),
    );
    if (!item) throw new SellerError("NOT_FOUND");
    return { ok: true, data: item };
  } catch (error) {
    return failure(error);
  }
}

export async function readSavedComparisonCandidatesAction(
  cursor: unknown,
): Promise<
  SellerResult<{
    subject: string;
    items: LibraryItem[];
    nextCursor: string | null;
  }>
> {
  try {
    const actor = await requireVerifiedIdentity();
    const page = await readLibrary(getDatabase(), actor, {
      view: "saved",
      cursor,
    });
    return {
      ok: true,
      data: {
        subject: actor.subject,
        items: page.items,
        nextCursor: page.nextCursor,
      },
    };
  } catch (error) {
    return failure(error);
  }
}
