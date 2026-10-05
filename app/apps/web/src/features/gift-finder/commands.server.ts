import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman, inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { observe, type ToolListing } from "../shopping-tools/model";
import {
  assistantActorKey,
  requireAssistantActor,
  requireAssistantStorage,
  checkAssistantBudget,
} from "../assistant-tools/storage.server";
import { giftCatalogue } from "./catalogue.server";
import {
  giftWorkspace,
  giftObservations,
  requireGiftStorage,
} from "./storage.server";
import {
  giftSnapshot,
  parseGiftBrief,
  parseGiftCommand,
  unsupportedGiftFields,
  type GiftChange,
  type GiftView,
} from "./model";

export async function readGift(
  database: SellerDatabase,
  identity: VerifiedIdentity,
): Promise<GiftView> {
  return inTransaction(database, async (tx) => {
    await requireGiftStorage(tx);
    await requireAssistantStorage(tx);
    const empty: GiftView = {
      actorKey: assistantActorKey(identity),
      revision: 0,
      brief: null,
      briefHash: inputHash(null),
      nextCursor: null,
      unsupported: [],
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
    const workspace = await giftWorkspace(tx, user.id);
    if (!workspace) return empty;
    const brief = workspace.brief ? parseGiftBrief(workspace.brief) : null;
    const observations = await giftObservations(tx, user.id);
    const current =
      brief && observations.length
        ? await giftCatalogue(
            tx,
            user.id,
            brief,
            null,
            observations.map((row) => row.snapshot.observation.listingId),
          )
        : { items: [], nextCursor: null };
    const facts = new Map(current.items.map((item) => [item.card.id, item]));
    return {
      ...empty,
      revision: workspace.revision,
      brief,
      briefHash: inputHash(brief),
      nextCursor: workspace.nextCursor,
      unsupported: brief ? unsupportedGiftFields(brief) : [],
      items: observations.map((row) => {
        const id = row.snapshot.observation.listingId,
          fact = facts.get(id) ?? null;
        return {
          listingId: id,
          position: row.position,
          observedAt: row.observedAt.toISOString(),
          current: fact,
          observed: fact ? row.snapshot : null,
          changed:
            !fact || inputHash(giftSnapshot(fact)) !== inputHash(row.snapshot),
          selected: workspace.selectedIds.includes(id),
        };
      }),
    };
  });
}

/** Current human -> workspace -> immutable receipt -> expected revision ->
 * shared budget -> fixed public catalogue. One connection and lock order. */
export async function changeGift(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
): Promise<GiftChange> {
  const command = parseGiftCommand(raw);
  requireAssistantActor(identity, command.actorKey);
  return inTransaction(database, async (tx) => {
    await requireGiftStorage(tx);
    await requireAssistantStorage(tx);
    const user = await authorizeHuman(tx, identity, true);
    await tx.client.query(
      "INSERT INTO treido.buyer_gift_workspaces(user_id) VALUES($1) ON CONFLICT DO NOTHING",
      [user.id],
    );
    const workspace = await giftWorkspace(tx, user.id, true);
    const hash = inputHash(command);
    const prior = (
      await tx.client.query<{ hash: string; revision: number; count: number }>(
        "SELECT input_hash AS hash,accepted_revision AS revision,result_count AS count FROM treido.buyer_gift_receipts WHERE user_id=$1 AND request_id=$2",
        [user.id, command.requestId],
      )
    ).rows[0];
    if (prior) {
      if (prior.hash !== hash) throw new SellerError("CONFLICT");
      return { revision: prior.revision, count: prior.count, replayed: true };
    }
    if (!workspace || workspace.revision !== command.expectedRevision)
      throw new SellerError("CONFLICT");
    const op = command.operation,
      saved = await giftObservations(tx, user.id);
    const savedIds = saved
      .map((row) => row.snapshot.observation.listingId)
      .sort();
    let brief = workspace.brief ? parseGiftBrief(workspace.brief) : null;
    if ("briefHash" in op && inputHash(brief) !== op.briefHash)
      throw new SellerError("CONFLICT");
    if (
      (op.kind === "refresh" || op.kind === "clear") &&
      inputHash(savedIds) !== inputHash(op.listingIds)
    )
      throw new SellerError("CONFLICT");
    await checkAssistantBudget(
      tx,
      user.id,
      ["find", "page", "refresh"].includes(op.kind),
    );
    let selectedIds = workspace.selectedIds,
      nextCursor = workspace.nextCursor,
      count = saved.length;
    if (op.kind === "choose") {
      if (!brief || op.listingIds.some((id) => !savedIds.includes(id)))
        throw new SellerError("CONFLICT");
      const { items } = await giftCatalogue(
        tx,
        user.id,
        brief,
        null,
        op.listingIds,
      );
      const current = new Map(items.map((item) => [item.card.id, item]));
      for (const id of op.listingIds) {
        const fact = current.get(id),
          old = saved.find((row) => row.snapshot.observation.listingId === id);
        if (
          !fact ||
          !old ||
          inputHash(giftSnapshot(fact)) !== inputHash(old.snapshot)
        )
          throw new SellerError("CONFLICT");
      }
      selectedIds = op.listingIds;
    } else {
      let items: ToolListing[];
      if (op.kind === "clear") {
        brief = null;
        selectedIds = [];
        nextCursor = null;
        items = [];
      } else {
        if (op.kind === "find") brief = op.brief;
        if (!brief) throw new SellerError("CONFLICT");
        if (
          op.kind === "page" &&
          (!workspace.nextCursor || op.cursor !== workspace.nextCursor)
        )
          throw new SellerError("CONFLICT");
        const result = await giftCatalogue(
          tx,
          user.id,
          brief,
          op.kind === "page" ? op.cursor : null,
          op.kind === "refresh" ? savedIds : undefined,
        );
        items = result.items;
        nextCursor = result.nextCursor;
        if (op.kind === "refresh") {
          const facts = new Map(items.map((item) => [item.card.id, item]));
          for (const expected of op.expected) {
            const fact = facts.get(expected.listingId);
            if (
              inputHash(fact ? observe(fact) : null) !==
              inputHash(expected.observation)
            )
              throw new SellerError("CONFLICT");
          }
          items = saved.flatMap((row) => {
            const fact = facts.get(row.snapshot.observation.listingId);
            return fact ? [fact] : [];
          });
          selectedIds = selectedIds.filter((id) => facts.has(id));
        } else selectedIds = [];
      }
      await tx.client.query(
        "DELETE FROM treido.buyer_gift_observations WHERE user_id=$1",
        [user.id],
      );
      for (const [index, item] of items.entries()) {
        const snapshot = giftSnapshot(item),
          o = snapshot.observation;
        await tx.client.query(
          "INSERT INTO treido.buyer_gift_observations(user_id,position,seller_id,listing_id,publication_revision,sku_id,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7)",
          [
            user.id,
            index + 1,
            item.card.seller.id,
            o.listingId,
            o.publicationRevision,
            o.skuId,
            snapshot,
          ],
        );
      }
      count = items.length;
    }
    const revision = workspace.revision + 1;
    await tx.client.query(
      "UPDATE treido.buyer_gift_workspaces SET revision=$2,brief=$3,selected_ids=$4,next_cursor=$5,updated_at=clock_timestamp() WHERE user_id=$1",
      [user.id, revision, brief, selectedIds, nextCursor],
    );
    await tx.client.query(
      "INSERT INTO treido.buyer_gift_receipts(user_id,request_id,input_hash,accepted_revision,operation,result_count) VALUES($1,$2,$3,$4,$5,$6)",
      [user.id, command.requestId, hash, revision, op.kind, count],
    );
    return { revision, count, replayed: false };
  });
}
