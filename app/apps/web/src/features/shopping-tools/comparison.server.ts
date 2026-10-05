import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman, inputHash } from "../sellers/persistence.server";
import { publicDiscoveryKey } from "../catalog/public-discovery.server";
import { SellerError } from "../sellers/errors";
import { readToolFacts } from "./catalogue.server";
import { TOOL_LIMITS } from "./intent";
import {
  observe,
  parseComparisonCommand,
  type ComparisonView,
  type ComparisonChange,
  type Observation,
} from "./model";

function actorKey(identity: VerifiedIdentity) {
  return createHmac("sha256", publicDiscoveryKey())
    .update("buyer-comparison-actor-v1:" + identity.subject)
    .digest("hex");
}
/** An unintegrated schema is a service-unavailable state, never an empty shortlist.
 * Check before authorizeHuman(create=true), so blocked storage cannot create users. */
async function requireStorage(tx: SellerTransaction) {
  const row = (
    await tx.client.query<{ ready: boolean }>(
      "SELECT to_regclass('treido.buyer_comparison_workspaces') IS NOT NULL AND to_regclass('treido.buyer_comparison_selections') IS NOT NULL AND to_regclass('treido.buyer_comparison_receipts') IS NOT NULL AS ready",
    )
  ).rows[0];
  if (!row?.ready) throw new SellerError("NOT_AVAILABLE");
}
type SelectionRow = {
  id: string;
  position: number;
  listingId: string;
  publicationRevision: number;
  skuId: string | null;
  priceMinor: number;
  stock: Observation["stock"];
  observedAt: Date;
};
const selectionSql =
  'SELECT id,position,listing_id AS "listingId",publication_revision AS "publicationRevision",sku_id AS "skuId",price_minor AS "priceMinor",stock_state AS stock,observed_at AS "observedAt" FROM treido.buyer_comparison_selections WHERE user_id=$1 ORDER BY position LIMIT 4';
/** No GET creates a workspace. The human share lock serializes this projection
 * with its own mutations, while facts are one fresh public-eligibility query. */
export async function readComparison(
  database: SellerDatabase,
  identity: VerifiedIdentity,
): Promise<ComparisonView> {
  return inTransaction(database, async (tx) => {
    await requireStorage(tx);
    const empty: ComparisonView = {
      actorKey: actorKey(identity),
      revision: 0,
      items: [],
      checkedAt: new Date().toISOString(),
    };
    let user;
    try {
      user = await authorizeHuman(tx, identity, false);
    } catch (error) {
      if (error instanceof SellerError && error.code === "NOT_FOUND")
        return empty;
      throw error;
    }
    const revision =
      (
        await tx.client.query<{ revision: number }>(
          "SELECT revision FROM treido.buyer_comparison_workspaces WHERE user_id=$1",
          [user.id],
        )
      ).rows[0]?.revision ?? 0;
    const selected = (
      await tx.client.query<SelectionRow>(selectionSql, [user.id])
    ).rows;
    const facts = await readToolFacts(
      tx,
      selected.map((row) => row.listingId),
    );
    return {
      ...empty,
      revision,
      items: selected.map((row) => ({
        id: row.id,
        position: row.position,
        observation: {
          listingId: row.listingId,
          publicationRevision: row.publicationRevision,
          skuId: row.skuId,
          priceMinor: row.priceMinor,
          stock: row.stock,
        },
        observedAt: row.observedAt.toISOString(),
        current: facts.get(row.listingId) ?? null,
      })),
    };
  });
}
/** The immutable receipt acknowledges a past command; it never asserts that
 * a superseded revision is current and never restores an old selection. */
export async function changeComparison(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
): Promise<ComparisonChange> {
  const input = parseComparisonCommand(raw);
  if (input.actorKey !== actorKey(identity))
    throw new SellerError("UNAUTHENTICATED");
  return inTransaction(database, async (tx) => {
    await requireStorage(tx);
    const user = await authorizeHuman(tx, identity, true);
    await tx.client.query(
      "INSERT INTO treido.buyer_comparison_workspaces(user_id) VALUES($1) ON CONFLICT DO NOTHING",
      [user.id],
    );
    const current = (
      await tx.client.query<{ revision: number }>(
        "SELECT revision FROM treido.buyer_comparison_workspaces WHERE user_id=$1 FOR UPDATE",
        [user.id],
      )
    ).rows[0];
    const hash = inputHash(input);
    const receipt = (
      await tx.client.query<{
        hash: string;
        revision: number;
        selectionId: string | null;
      }>(
        'SELECT input_hash AS hash,accepted_revision AS revision,selection_id AS "selectionId" FROM treido.buyer_comparison_receipts WHERE user_id=$1 AND request_id=$2',
        [user.id, input.requestId],
      )
    ).rows[0];
    if (receipt) {
      if (receipt.hash !== hash) throw new SellerError("CONFLICT");
      return {
        revision: receipt.revision,
        selectionId: receipt.selectionId,
        replayed: true,
      };
    }
    if (current.revision !== input.expectedRevision)
      throw new SellerError("CONFLICT");
    const rate = (
      await tx.client.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM treido.buyer_comparison_receipts WHERE user_id=$1 AND created_at>clock_timestamp()-interval '1 minute'",
        [user.id],
      )
    ).rows[0].count;
    if (rate >= TOOL_LIMITS.commandsPerMinute)
      throw new SellerError("QUOTA_EXCEEDED");
    const rows = (await tx.client.query<SelectionRow>(selectionSql, [user.id]))
        .rows,
      op = input.operation;
    let selectionId: string | null = null;
    if (op.kind === "add" || op.kind === "refresh") {
      const old =
        op.kind === "refresh"
          ? rows.find((row) => row.id === op.selectionId)
          : null;
      if (
        op.kind === "refresh" &&
        (!old || old.listingId !== op.observation.listingId)
      )
        throw new SellerError("NOT_FOUND");
      if (
        op.kind === "add" &&
        (rows.length >= TOOL_LIMITS.selections ||
          rows.some((row) => row.listingId === op.observation.listingId))
      )
        throw new SellerError(
          rows.length >= TOOL_LIMITS.selections ? "QUOTA_EXCEEDED" : "CONFLICT",
        );
      const fact = (await readToolFacts(tx, [op.observation.listingId])).get(
        op.observation.listingId,
      );
      if (!fact) throw new SellerError("NOT_FOUND");
      if (
        op.kind === "add" &&
        !["unknown", "available"].includes(fact.inventory.state)
      )
        throw new SellerError("NOT_AVAILABLE");
      if (inputHash(observe(fact)) !== inputHash(op.observation))
        throw new SellerError("CONFLICT");
      selectionId = old?.id ?? randomUUID();
      const position = old?.position ?? rows.length + 1;
      if (old)
        await tx.client.query(
          "DELETE FROM treido.buyer_comparison_selections WHERE user_id=$1 AND id=$2",
          [user.id, old.id],
        );
      await tx.client.query(
        "INSERT INTO treido.buyer_comparison_selections(user_id,id,position,seller_id,listing_id,publication_revision,sku_id,price_minor,stock_state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [
          user.id,
          selectionId,
          position,
          fact.card.seller.id,
          fact.card.id,
          fact.revision,
          fact.variant?.id ?? null,
          fact.card.price.amount,
          fact.inventory.state,
        ],
      );
    } else if (op.kind === "remove") {
      const row = rows.find((row) => row.id === op.selectionId);
      if (!row) throw new SellerError("NOT_FOUND");
      await tx.client.query(
        "DELETE FROM treido.buyer_comparison_selections WHERE user_id=$1 AND id=$2",
        [user.id, row.id],
      );
      await tx.client.query(
        "UPDATE treido.buyer_comparison_selections SET position=position-1 WHERE user_id=$1 AND position>$2",
        [user.id, row.position],
      );
      selectionId = row.id;
    } else {
      if (
        op.selectionIds.length !== rows.length ||
        op.selectionIds.some((id) => !rows.some((row) => row.id === id))
      )
        throw new SellerError("CONFLICT");
      if (op.kind === "clear")
        await tx.client.query(
          "DELETE FROM treido.buyer_comparison_selections WHERE user_id=$1",
          [user.id],
        );
      else
        for (const [index, id] of op.selectionIds.entries())
          await tx.client.query(
            "UPDATE treido.buyer_comparison_selections SET position=$3 WHERE user_id=$1 AND id=$2",
            [user.id, id, index + 1],
          );
    }
    const revision = current.revision + 1;
    await tx.client.query(
      "UPDATE treido.buyer_comparison_workspaces SET revision=$2 WHERE user_id=$1",
      [user.id, revision],
    );
    await tx.client.query(
      "INSERT INTO treido.buyer_comparison_receipts(user_id,request_id,input_hash,accepted_revision,operation,selection_id) VALUES($1,$2,$3,$4,$5,$6)",
      [user.id, input.requestId, hash, revision, op.kind, selectionId],
    );
    return { revision, selectionId, replayed: false };
  });
}
