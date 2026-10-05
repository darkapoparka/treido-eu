import "server-only";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman, inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import {
  assistantActorKey,
  checkAssistantBudget,
  requireAssistantActor,
  requireAssistantStorage,
  readAssistantFacts,
} from "./storage.server";
import {
  parseCompatibilityCommand,
  parseRequirements,
  snapshotCompatibility,
  compatibilityEvidence,
  type CompatibilitySnapshot,
  type CompatibilityView,
  type CompatibilityChange,
  type Requirements,
} from "./compatibility-model";
type ObservationRow = {
  position: number;
  snapshot: CompatibilitySnapshot;
  observedAt: Date;
};
async function observations(tx: SellerTransaction, userId: string) {
  return (
    await tx.client.query<ObservationRow>(
      'SELECT position,snapshot,observed_at AS "observedAt" FROM treido.buyer_compatibility_observations WHERE user_id=$1 ORDER BY position LIMIT 4',
      [userId],
    )
  ).rows;
}
export async function readCompatibility(
  database: SellerDatabase,
  identity: VerifiedIdentity,
): Promise<CompatibilityView> {
  return inTransaction(database, async (tx) => {
    await requireAssistantStorage(tx);
    const empty: CompatibilityView = {
      actorKey: assistantActorKey(identity),
      revision: 0,
      requirements: null,
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
    const workspace = (
      await tx.client.query<{
        revision: number;
        requirements: Requirements | null;
      }>(
        "SELECT revision,requirements FROM treido.buyer_compatibility_workspaces WHERE user_id=$1",
        [user.id],
      )
    ).rows[0];
    if (!workspace) return empty;
    const requirements = workspace.requirements
      ? parseRequirements(workspace.requirements)
      : null;
    const rows = await observations(tx, user.id),
      facts = await readAssistantFacts(
        tx,
        user.id,
        rows.map((row) => row.snapshot.observation.listingId),
      );
    return {
      ...empty,
      revision: workspace.revision,
      requirements,
      items: rows.map((row) => {
        const current = facts.get(row.snapshot.observation.listingId) ?? null;
        // Unavailable/blocked publications cannot disclose historical public facts.
        return {
          listingId: row.snapshot.observation.listingId,
          position: row.position,
          observedAt: row.observedAt.toISOString(),
          current,
          observed: current ? row.snapshot : null,
          evidence:
            current && requirements
              ? compatibilityEvidence(requirements, row.snapshot)
              : [],
          changed:
            !current ||
            inputHash(snapshotCompatibility(current)) !==
              inputHash(row.snapshot),
        };
      }),
    };
  });
}
export async function changeCompatibility(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
): Promise<CompatibilityChange> {
  const command = parseCompatibilityCommand(raw);
  requireAssistantActor(identity, command.actorKey);
  return inTransaction(database, async (tx) => {
    await requireAssistantStorage(tx);
    const user = await authorizeHuman(tx, identity, true);
    await tx.client.query(
      "INSERT INTO treido.buyer_compatibility_workspaces(user_id) VALUES($1) ON CONFLICT DO NOTHING",
      [user.id],
    );
    const workspace = (
      await tx.client.query<{
        revision: number;
        requirements: Requirements | null;
      }>(
        "SELECT revision,requirements FROM treido.buyer_compatibility_workspaces WHERE user_id=$1 FOR UPDATE",
        [user.id],
      )
    ).rows[0];
    const hash = inputHash(command),
      previous = (
        await tx.client.query<{ hash: string; revision: number }>(
          "SELECT input_hash AS hash,accepted_revision AS revision FROM treido.buyer_compatibility_receipts WHERE user_id=$1 AND request_id=$2",
          [user.id, command.requestId],
        )
      ).rows[0];
    if (previous) {
      if (previous.hash !== hash) throw new SellerError("CONFLICT");
      return { revision: previous.revision, replayed: true };
    }
    if (!workspace || workspace.revision !== command.expectedRevision)
      throw new SellerError("CONFLICT");
    const op = command.operation,
      saved = await observations(tx, user.id);
    await checkAssistantBudget(tx, user.id, op.kind !== "clear");
    let requirements: Requirements | null = null,
      snapshots: CompatibilitySnapshot[] = [];
    if (op.kind === "clear") {
      if (
        inputHash(
          saved.map((row) => row.snapshot.observation.listingId).sort(),
        ) !== inputHash(op.listingIds)
      )
        throw new SellerError("CONFLICT");
    } else {
      requirements =
        op.kind === "check"
          ? op.requirements
          : workspace.requirements
            ? parseRequirements(workspace.requirements)
            : null;
      if (!requirements) throw new SellerError("CONFLICT");
      if (
        op.kind === "refresh" &&
        inputHash(
          saved.map((row) => row.snapshot.observation.listingId).sort(),
        ) !==
          inputHash(op.snapshots.map((row) => row.observation.listingId).sort())
      )
        throw new SellerError("CONFLICT");
      const facts = await readAssistantFacts(
        tx,
        user.id,
        op.snapshots.map((s) => s.observation.listingId),
      );
      snapshots = op.snapshots.map((snapshot) => {
        const fact = facts.get(snapshot.observation.listingId);
        if (!fact || !["unknown", "available"].includes(fact.inventory.state))
          throw new SellerError("NOT_AVAILABLE");
        const current = snapshotCompatibility(fact);
        if (inputHash(current) !== inputHash(snapshot))
          throw new SellerError("CONFLICT");
        return current;
      });
    }
    await tx.client.query(
      "DELETE FROM treido.buyer_compatibility_observations WHERE user_id=$1",
      [user.id],
    );
    for (const [index, snapshot] of snapshots.entries()) {
      const o = snapshot.observation;
      const fact = (await readAssistantFacts(tx, user.id, [o.listingId])).get(
        o.listingId,
      );
      if (
        !fact ||
        inputHash(snapshotCompatibility(fact)) !== inputHash(snapshot)
      )
        throw new SellerError("CONFLICT");
      await tx.client.query(
        "INSERT INTO treido.buyer_compatibility_observations(user_id,position,seller_id,listing_id,publication_revision,sku_id,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          user.id,
          index + 1,
          fact.card.seller.id,
          o.listingId,
          o.publicationRevision,
          o.skuId,
          snapshot,
        ],
      );
    }
    const revision = workspace.revision + 1;
    await tx.client.query(
      "UPDATE treido.buyer_compatibility_workspaces SET revision=$2,requirements=$3,updated_at=clock_timestamp() WHERE user_id=$1",
      [user.id, revision, requirements],
    );
    await tx.client.query(
      "INSERT INTO treido.buyer_compatibility_receipts(user_id,request_id,input_hash,accepted_revision,operation) VALUES($1,$2,$3,$4,$5)",
      [user.id, command.requestId, hash, revision, op.kind],
    );
    return { revision, replayed: false };
  });
}
