import "server-only";
import type { SellerTransaction } from "../../server/db/database";
import { ClosureError, obligationNames, type Obligations } from "./model";
/** Same current-human lock used by all ordinary commands; accepted obligations are never erased. */
export async function readObligations(
  tx: SellerTransaction,
  userId: string,
): Promise<Obligations> {
  const ready = (
    await tx.client.query<{ ready: boolean }>(
      "SELECT to_regprocedure('treido.account_closure_obligations(uuid)') IS NOT NULL AS ready",
    )
  ).rows[0]?.ready;
  if (!ready) throw new ClosureError("NOT_AVAILABLE");
  const facts = (
    await tx.client.query<{ facts: Obligations }>(
      "SELECT treido.account_closure_obligations($1::uuid) AS facts",
      [userId],
    )
  ).rows[0]?.facts;
  if (
    !facts ||
    obligationNames.some(
      (key) => !Number.isSafeInteger(facts[key]) || facts[key] < 0,
    )
  )
    throw new ClosureError("NOT_AVAILABLE");
  return facts;
}
