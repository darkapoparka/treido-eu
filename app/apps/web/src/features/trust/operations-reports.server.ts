import { readCaseContextInTransaction } from "./case-context.server";
import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { libraryActorKey } from "../library/cursor.server";
import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { authorizeOperator } from "./reports.server";
import {
  readOperationContextInTransaction,
  readOperationDecisions,
  moderationSearch,
} from "./operations-context.server";
import {
  parseReportQuery,
  type ReportItem,
  type ReportDetail,
} from "./operations-model";
const reportFrom = `FROM treido.reports r
 LEFT JOIN treido.messages m ON r.resource_kind='message' AND m.id=r.resource_id
 LEFT JOIN treido.conversation_threads t ON t.id=m.thread_id
 JOIN treido.listings l ON l.id=CASE WHEN r.resource_kind='listing' THEN r.resource_id ELSE t.listing_id END
 LEFT JOIN treido.listing_publications p ON p.seller_id=l.seller_id AND p.listing_id=l.id AND p.revision=l.current_publication_revision`;
const reportColumns = `r.id,r.resource_kind AS "resourceKind",r.resource_id AS "resourceId",l.id AS "listingId",p.payload->>'title' AS title,r.reason,r.state,r.revision,
 to_char(r.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt",left(r.details,240) AS summary`;
export async function readReportQueue(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
) {
  const query = parseReportQuery(raw);
  return inTransaction(database, async (tx) => {
    await authorizeOperator(tx, identity, "reports.read");
    if (
      query.before &&
      !(
        await tx.client.query("SELECT id FROM treido.reports WHERE id=$1", [
          query.before,
        ])
      ).rowCount
    )
      throw new SellerError("INVALID_INPUT");
    const rows = (
      await tx.client.query<ReportItem>(
        `SELECT ${reportColumns} ${reportFrom}
       WHERE ($1='all' OR r.state=$1 OR ($1='resolved' AND r.state='reviewed')) AND ($2='all' OR r.resource_kind=$2) AND ($3='all' OR r.reason=$3)
       AND ($4='' OR ${moderationSearch("coalesce(p.payload->>'title','') || ' ' || r.details", "$4")})
       AND ($5::uuid IS NULL OR (r.created_at,r.id)<(SELECT created_at,id FROM treido.reports WHERE id=$5))
       ORDER BY r.created_at DESC,r.id DESC LIMIT 21`,
        [query.state, query.kind, query.reason, query.q, query.before],
      )
    ).rows;
    const counts = (
      await tx.client.query<{ open: number; reviewed: number }>(
        "SELECT count(*) FILTER(WHERE state='open')::int AS open,count(*) FILTER(WHERE state='reviewed')::int AS reviewed FROM treido.reports",
      )
    ).rows[0];
    return {
      actorKey: libraryActorKey(identity),
      query,
      items: rows.slice(0, 20),
      nextBefore: rows.length > 20 ? rows[19].id : null,
      counts,
    };
  });
}
export async function readOperationReport(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  reportId: string,
): Promise<ReportDetail> {
  if (!validId(reportId)) throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    const user = await authorizeOperator(tx, identity, "reports.read");
    const report = (
      await tx.client.query<ReportItem & { details: string }>(
        `SELECT ${reportColumns},r.details ${reportFrom} WHERE r.id=$1`,
        [reportId],
      )
    ).rows[0];
    if (!report) throw new SellerError("NOT_FOUND");
    const { listing, context } = await readOperationContextInTransaction(
      tx,
      identity,
      report.listingId,
      report.resourceKind === "listing" ? reportId : null,
    );
    const reportedMessage =
      report.resourceKind === "message"
        ? ((
            await tx.client.query<NonNullable<ReportDetail["reportedMessage"]>>(
              `SELECT m.id,m.body,to_char(m.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at,
       (SELECT count(*)::int FROM treido.message_attachment_links a WHERE a.message_id=m.id) AS attachments
       FROM treido.messages m WHERE m.id=$1`,
              [report.resourceId],
            )
          ).rows[0] ?? null)
        : null;
    return {
      caseContext:
        report.resourceKind === "message"
          ? await readCaseContextInTransaction(
              tx,
              identity,
              "message_report",
              report.id,
            )
          : null,
      actorKey: libraryActorKey(identity),
      report: { ...report, state: context.reportState ?? report.state },
      listing,
      context,
      reportedMessage,
      decisions: await readOperationDecisions(
        tx,
        user.id,
        listing.id,
        report.resourceKind === "listing" ? report.id : null,
      ),
    };
  });
}
