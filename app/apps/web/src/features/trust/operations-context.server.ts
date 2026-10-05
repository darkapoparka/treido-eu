import "server-only";
import type {
  SellerTransaction,
  SellerDatabase,
} from "../../server/db/database";
import { inTransaction } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { libraryActorKey } from "../library/cursor.server";
import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { authorizeOperator } from "./reports.server";
import type {
  ModerationContext,
  OperationListing,
  OperationDecision,
} from "./operations-model";
export async function readOperationContextInTransaction(
  tx: SellerTransaction,
  identity: VerifiedIdentity,
  listingId: string,
  reportId: string | null,
) {
  if (!validId(listingId) || (reportId !== null && !validId(reportId)))
    throw new SellerError("INVALID_INPUT");
  const user = await authorizeOperator(tx, identity, "reports.read");
  const listing = (
    await tx.client.query<OperationListing>(
      `SELECT l.id,p.payload->>'title' AS title,s.name AS "sellerName",l.publication,l.moderation_state AS state,l.moderation_revision AS revision
     FROM treido.listings l JOIN treido.seller_accounts s ON s.id=l.seller_id
     LEFT JOIN treido.listing_publications p ON p.seller_id=l.seller_id AND p.listing_id=l.id AND p.revision=l.current_publication_revision
     WHERE l.id=$1 FOR SHARE OF l`,
      [listingId],
    )
  ).rows[0];
  if (!listing) throw new SellerError("NOT_FOUND");
  let reportState: ModerationContext["reportState"] = null;
  if (reportId) {
    const report = (
      await tx.client.query<{ state: "open" | "reviewed" }>(
        "SELECT state FROM treido.reports WHERE id=$1 AND resource_kind='listing' AND resource_id=$2 FOR SHARE",
        [reportId, listingId],
      )
    ).rows[0];
    if (!report) throw new SellerError("NOT_FOUND");
    reportState = report.state;
  }
  const grant = (
    await tx.client.query<{ allowed: boolean }>(
      "SELECT treido.lock_operator_grant($1,'moderation.write') AS allowed",
      [user.id],
    )
  ).rows[0];
  const context: ModerationContext = {
    actorKey: libraryActorKey(identity),
    listingId,
    reportId,
    revision: listing.revision,
    state: listing.state,
    reportState,
    canModerate: grant?.allowed === true,
  };
  return { context, listing, userId: user.id };
}
export async function readOperationContext(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  listingId: string,
  reportId: string | null,
) {
  return inTransaction(
    database,
    async (tx) =>
      (
        await readOperationContextInTransaction(
          tx,
          identity,
          listingId,
          reportId,
        )
      ).context,
  );
}
export async function readOperationDecisions(
  tx: SellerTransaction,
  userId: string,
  listingId: string,
  reportId: string | null = null,
): Promise<OperationDecision[]> {
  return (
    await tx.client.query<OperationDecision>(
      `SELECT id,report_id AS "reportId",prior_state AS "from",next_state AS "to",accepted_revision AS revision,reason,
     to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at,actor_id=$1 AS own
     FROM treido.moderation_actions WHERE listing_id=$2 AND ($3::uuid IS NULL OR report_id=$3)
     ORDER BY accepted_revision DESC LIMIT 50`,
      [userId, listingId, reportId],
    )
  ).rows;
}
// Literal BG/EN matching. Callers supply only fixed expressions, never browser SQL.
export function moderationSearch(expression: string, parameter: string) {
  const fold = (value: string) =>
    `lower(translate(${value},'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЬЮЯЍ','абвгдежзийклмнопрстуфхцчшщъьюяѝ'))`;
  return `strpos(${fold(expression)},${fold(parameter)})>0`;
}
