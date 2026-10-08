import "server-only";
import { randomUUID } from "node:crypto";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeOperator } from "../trust/reports.server";
import { authorizeSeller, inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import {
  BUSINESS_SETUP_VERSION,
  declarationComplete,
  type DeclarationStatus,
  type TraderDeclaration,
} from "../sellers/setup-model";
import { validId } from "../selling/draft-model";
import {
  parseDeclarationQueueQuery,
  parseReviewDeclarationInput,
  type DeclarationDecision,
  type DeclarationQueue,
  type DeclarationReviewAcknowledgement,
  type DeclarationReviewView,
  type OwnDeclarationDecision,
} from "./model";

type Snapshot = TraderDeclaration & {
  id: string;
  sellerId: string;
  revision: number;
  requirementVersion: number;
  status: DeclarationStatus;
  submittedBy: string;
  submittedAt: Date | null;
};
type ReviewRow = {
  id: string;
  sourceDeclarationId: string;
  reviewedDeclarationId: string;
  revision: number;
  decision: DeclarationDecision;
  reviewedAt: Date;
  reason: string;
  hash: string;
};
const declarationColumns = `id,seller_id AS "sellerId",revision,requirement_version AS "requirementVersion",status,country,
 legal_name AS "legalName",registration_number AS "registrationNumber",contact_email AS "contactEmail",contact_address AS "contactAddress",
 accurate,submitted_by AS "submittedBy",submitted_at AS "submittedAt"`;
const reviewColumns = `id,source_declaration_id AS "sourceDeclarationId",reviewed_declaration_id AS "reviewedDeclarationId",
 reviewed_revision AS revision,decision,created_at AS "reviewedAt",reason,input_hash AS hash`;
function acknowledgement(row: ReviewRow): DeclarationReviewAcknowledgement {
  return {
    id: row.id,
    sourceDeclarationId: row.sourceDeclarationId,
    reviewedDeclarationId: row.reviewedDeclarationId,
    revision: row.revision,
    decision: row.decision,
    reviewedAt: row.reviewedAt.toISOString(),
  };
}
function facts(row: Snapshot): TraderDeclaration {
  return {
    country: row.country,
    legalName: row.legalName,
    registrationNumber: row.registrationNumber,
    contactEmail: row.contactEmail,
    contactAddress: row.contactAddress,
    accurate: row.accurate,
  };
}
async function currentSetup(
  tx: SellerTransaction,
  sellerId: string,
  write: boolean,
) {
  const seller = (
    await tx.client.query<{ kind: string; status: string; name: string }>(
      `SELECT kind,status,name FROM treido.seller_accounts WHERE id=$1 FOR ${write ? "UPDATE" : "SHARE"}`,
      [sellerId],
    )
  ).rows[0];
  if (!seller || seller.kind !== "business") throw new SellerError("NOT_FOUND");
  const setup = (
    await tx.client.query<{ revision: number }>(
      `SELECT revision FROM treido.seller_onboarding_progress WHERE seller_id=$1 FOR ${write ? "UPDATE" : "SHARE"}`,
      [sellerId],
    )
  ).rows[0];
  if (!setup) throw new SellerError("NOT_FOUND");
  // Submissions and reviews hold the business lock. Declaration UPDATE remains revoked.
  const latest = (
    await tx.client.query<Snapshot>(
      `SELECT ${declarationColumns} FROM treido.seller_declarations WHERE seller_id=$1 ORDER BY revision DESC LIMIT 1`,
      [sellerId],
    )
  ).rows[0];
  if (!latest) throw new SellerError("NOT_FOUND");
  return { seller, setup, latest };
}
async function independentReviewer(
  tx: SellerTransaction,
  actorId: string,
  snapshot: Snapshot,
) {
  if (snapshot.submittedBy === actorId) return false;
  return (
    (
      await tx.client.query(
        "SELECT 1 FROM treido.seller_memberships WHERE seller_id=$1 AND user_id=$2 AND status='active'",
        [snapshot.sellerId, actorId],
      )
    ).rowCount === 0
  );
}
export async function readDeclarationQueue(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown = {},
): Promise<DeclarationQueue> {
  const query = parseDeclarationQueueQuery(raw);
  if (!query) throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    await authorizeOperator(tx, identity, "reports.read");
    const before = query.before
      ? (
          await tx.client.query<{ at: Date; id: string }>(
            "SELECT created_at AS at,id FROM treido.seller_declarations WHERE id=$1",
            [query.before],
          )
        ).rows[0]
      : null;
    if (query.before && !before) throw new SellerError("INVALID_INPUT");
    const rows = await tx.client.query<
      Omit<DeclarationQueue["items"][number], "submittedAt"> & {
        submittedAt: Date | null;
      }
    >(
      `SELECT d.id,d.seller_id AS "sellerId",s.name AS "sellerName",d.revision,d.requirement_version AS "requirementVersion",d.status,d.submitted_at AS "submittedAt"
       FROM treido.seller_declarations d JOIN treido.seller_accounts s ON s.id=d.seller_id
       WHERE s.kind='business' AND d.id=(SELECT newest.id FROM treido.seller_declarations newest WHERE newest.seller_id=d.seller_id ORDER BY newest.revision DESC LIMIT 1)
       AND ($1='all' OR d.status=$1) AND ($2='' OR position(lower($2) in lower(s.name))>0)
       AND ($3::timestamptz IS NULL OR (d.created_at,d.id)<($3::timestamptz,$4::uuid))
       ORDER BY d.created_at DESC,d.id DESC LIMIT 31`,
      [query.state, query.q, before?.at ?? null, before?.id ?? null],
    );
    const visible = rows.rows.slice(0, 30);
    return {
      query,
      items: visible.map((row) => ({
        ...row,
        submittedAt: row.submittedAt?.toISOString() ?? null,
      })),
      nextCursor: rows.rows.length > 30 ? visible.at(-1)!.id : null,
    };
  });
}
export async function readDeclarationReview(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  declarationId: string,
): Promise<DeclarationReviewView> {
  if (!validId(declarationId)) throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    const actor = await authorizeOperator(tx, identity, "reports.read");
    const source = (
      await tx.client.query<Snapshot>(
        `SELECT ${declarationColumns} FROM treido.seller_declarations WHERE id=$1`,
        [declarationId],
      )
    ).rows[0];
    if (!source) throw new SellerError("NOT_FOUND");
    const { seller, setup, latest } = await currentSetup(
      tx,
      source.sellerId,
      false,
    );
    const allowed =
      (
        await tx.client.query<{ allowed: boolean }>(
          "SELECT treido.lock_operator_grant($1,$2) AS allowed",
          [actor.id, "moderation.write"],
        )
      ).rows[0]?.allowed === true;
    const history = (
      await tx.client.query<ReviewRow>(
        `SELECT ${reviewColumns} FROM treido.seller_declaration_reviews WHERE seller_id=$1 ORDER BY reviewed_revision DESC LIMIT 20`,
        [source.sellerId],
      )
    ).rows;
    return {
      id: source.id,
      sellerId: source.sellerId,
      sellerName: seller.name,
      revision: source.revision,
      setupRevision: setup.revision,
      requirementVersion: source.requirementVersion,
      status: source.status,
      facts: facts(source),
      submittedAt: source.submittedAt?.toISOString() ?? null,
      currentDeclarationId: latest.id,
      isCurrent: latest.id === source.id,
      canReview:
        allowed &&
        seller.status === "active" &&
        latest.id === source.id &&
        source.status === "review_required" &&
        source.requirementVersion === BUSINESS_SETUP_VERSION &&
        source.country === "BG" &&
        declarationComplete(facts(source)) &&
        (await independentReviewer(tx, actor.id, source)),
      history: history.map((row) => ({
        ...acknowledgement(row),
        reason: row.reason,
      })),
    };
  });
}
export async function reviewSellerDeclaration(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
): Promise<DeclarationReviewAcknowledgement> {
  const input = parseReviewDeclarationInput(raw);
  if (!input) throw new SellerError("INVALID_INPUT");
  return inTransaction(database, async (tx) => {
    const actor = await authorizeOperator(tx, identity, "reports.read");
    await authorizeOperator(tx, identity, "moderation.write");
    const { seller, setup, latest } = await currentSetup(
      tx,
      input.sellerId,
      true,
    );
    if (
      seller.status !== "active" ||
      !(await independentReviewer(tx, actor.id, latest))
    )
      throw new SellerError("FORBIDDEN");
    const hash = inputHash(input);
    const previous = (
      await tx.client.query<ReviewRow>(
        `SELECT ${reviewColumns} FROM treido.seller_declaration_reviews WHERE actor_id=$1 AND request_id=$2`,
        [actor.id, input.requestId],
      )
    ).rows[0];
    if (previous) {
      if (
        previous.hash !== hash ||
        previous.reviewedDeclarationId !== latest.id ||
        previous.revision !== setup.revision ||
        latest.revision !== previous.revision ||
        latest.status !== previous.decision ||
        latest.requirementVersion !== input.expectedRequirementVersion
      )
        throw new SellerError("CONFLICT");
      return acknowledgement(previous);
    }
    if (
      setup.revision !== input.expectedSetupRevision ||
      latest.id !== input.declarationId ||
      latest.revision !== input.expectedDeclarationRevision ||
      latest.requirementVersion !== input.expectedRequirementVersion ||
      latest.country !== "BG" ||
      latest.status !== "review_required" ||
      !declarationComplete(facts(latest))
    )
      throw new SellerError("CONFLICT");
    const reviewedId = randomUUID(),
      reviewId = randomUUID(),
      revision = setup.revision + 1;
    await tx.client.query(
      `INSERT INTO treido.seller_declarations(id,seller_id,seller_kind,revision,requirement_version,country,legal_name,registration_number,contact_email,contact_address,accurate,status,submitted_by,submitted_at)
      SELECT $1,seller_id,seller_kind,$2,requirement_version,country,legal_name,registration_number,contact_email,contact_address,accurate,$3,submitted_by,submitted_at
      FROM treido.seller_declarations WHERE seller_id=$4 AND id=$5`,
      [reviewedId, revision, input.decision, input.sellerId, latest.id],
    );
    await tx.client.query(
      "UPDATE treido.seller_onboarding_progress SET revision=$2,last_step='review',updated_at=clock_timestamp() WHERE seller_id=$1",
      [input.sellerId, revision],
    );
    const inserted = await tx.client.query<ReviewRow>(
      `INSERT INTO treido.seller_declaration_reviews(id,seller_id,source_declaration_id,source_revision,source_setup_revision,requirement_version,reviewed_declaration_id,reviewed_revision,actor_id,request_id,input_hash,decision,reason)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT(actor_id,request_id) DO NOTHING RETURNING ${reviewColumns}`,
      [
        reviewId,
        input.sellerId,
        latest.id,
        latest.revision,
        setup.revision,
        input.expectedRequirementVersion,
        reviewedId,
        revision,
        actor.id,
        input.requestId,
        hash,
        input.decision,
        input.reason,
      ],
    );
    if (inserted.rowCount !== 1) throw new SellerError("CONFLICT");
    return acknowledgement(inserted.rows[0]);
  });
}
/** Seller-facing rejection/acceptance reason, without the operator's identity or other businesses. */
export function readOwnDeclarationDecision(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  sellerId: string,
): Promise<OwnDeclarationDecision | null> {
  return inTransaction(database, (tx) =>
    readOwnDeclarationDecisionInTransaction(tx, identity, sellerId),
  );
}

/** Current declaration authority on the caller's existing transaction and locks. */
export async function readOwnDeclarationDecisionInTransaction(
  tx: SellerTransaction,
  identity: VerifiedIdentity,
  sellerId: string,
): Promise<OwnDeclarationDecision | null> {
  if (!validId(sellerId)) throw new SellerError("INVALID_INPUT");
  const { seller } = await authorizeSeller(
    tx,
    identity,
    sellerId,
    "declaration.manage",
  );
  if (seller.kind !== "business") throw new SellerError("NOT_FOUND");
  const result = (
    await tx.client.query<ReviewRow>(
      `SELECT ${reviewColumns} FROM treido.seller_declaration_reviews WHERE seller_id=$1 AND reviewed_declaration_id=(SELECT id FROM treido.seller_declarations WHERE seller_id=$1 ORDER BY revision DESC LIMIT 1)`,
      [sellerId],
    )
  ).rows[0];
  return result
    ? {
        decision: result.decision,
        reason: result.reason,
        revision: result.revision,
        reviewedAt: result.reviewedAt.toISOString(),
      }
    : null;
}
