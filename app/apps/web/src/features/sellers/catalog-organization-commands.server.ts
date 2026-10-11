import "server-only";
import { randomUUID } from "node:crypto";
import { inTransaction, type SellerDatabase, type SellerTransaction } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeSeller, inputHash } from "./persistence.server";
import { SellerError } from "./errors";
import { applyCatalogTags, parseCatalogCommand, type CatalogAcknowledgement, type CatalogCommand } from "./catalog-organization-model";

async function ownedProducts(tx: SellerTransaction, sellerId: string, ids: string[], writable: boolean) {
  if (!ids.length) return;
  const rows = (await tx.client.query<{ id: string; moderation: string }>(
    "SELECT id,moderation_state AS moderation FROM treido.listings WHERE seller_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR SHARE", [sellerId, ids],
  )).rows;
  if (rows.length !== ids.length) throw new SellerError("NOT_FOUND");
  if (writable && rows.some((row) => row.moderation !== "clear")) throw new SellerError("FORBIDDEN");
}
async function bumpProducts(tx: SellerTransaction, sellerId: string, ids: string[]) {
  if (!ids.length) return;
  await tx.client.query(
    `INSERT INTO treido.seller_catalog_product_organization(seller_id,listing_id)
     SELECT $1,id FROM unnest($2::uuid[]) id
     ON CONFLICT(seller_id,listing_id) DO UPDATE SET revision=treido.seller_catalog_product_organization.revision+1,updated_at=clock_timestamp()`, [sellerId, [...new Set(ids)].sort()],
  );
}
async function collectionCommand(tx: SellerTransaction, userId: string, command: Exclude<CatalogCommand, { kind: "organizeProducts" }>): Promise<CatalogAcknowledgement> {
  const sellerId = command.sellerId;
  if (command.kind === "createCollection") {
    const id = randomUUID();
    await tx.client.query(
      "INSERT INTO treido.seller_catalog_collections(id,seller_id,title,description,visible,created_by) VALUES($1,$2,$3,$4,$5,$6)",
      [id, sellerId, command.title, command.description, command.visible, userId],
    );
    return { collectionId: id, revision: 1 };
  }
  const collection = (await tx.client.query<{ revision: number; archived: boolean }>(
    "SELECT revision,archived FROM treido.seller_catalog_collections WHERE seller_id=$1 AND id=$2 FOR UPDATE", [sellerId, command.collectionId],
  )).rows[0];
  if (!collection) throw new SellerError("NOT_FOUND");
  if (collection.archived || collection.revision !== command.expectedRevision) throw new SellerError("CONFLICT");
  if (command.kind === "saveCollection") {
    await tx.client.query(
      "UPDATE treido.seller_catalog_collections SET title=$3,description=$4,visible=$5,revision=revision+1,updated_at=clock_timestamp() WHERE seller_id=$1 AND id=$2",
      [sellerId, command.collectionId, command.title, command.description, command.visible],
    );
  } else if (command.kind === "archiveCollection") {
    // Bump every affected product's organization revision before removing its membership.
    // A product editor opened before this command must reload rather than restore the group.
    await tx.client.query(
      `INSERT INTO treido.seller_catalog_product_organization(seller_id,listing_id)
       SELECT seller_id,listing_id FROM treido.seller_catalog_collection_items WHERE seller_id=$1 AND collection_id=$2
       ON CONFLICT(seller_id,listing_id) DO UPDATE SET revision=treido.seller_catalog_product_organization.revision+1,updated_at=clock_timestamp()`,
      [sellerId, command.collectionId],
    );
    await tx.client.query("DELETE FROM treido.seller_catalog_collection_items WHERE seller_id=$1 AND collection_id=$2", [sellerId, command.collectionId]);
    await tx.client.query(
      "UPDATE treido.seller_catalog_collections SET archived=true,visible=false,revision=revision+1,updated_at=clock_timestamp() WHERE seller_id=$1 AND id=$2", [sellerId, command.collectionId],
    );
  } else {
    await ownedProducts(tx, sellerId, command.add, true);
    await ownedProducts(tx, sellerId, command.remove, false);
    const added = (await tx.client.query<{ listingId: string }>(
      `INSERT INTO treido.seller_catalog_collection_items(seller_id,collection_id,listing_id)
       SELECT $1,$2,id FROM unnest($3::uuid[]) id ON CONFLICT DO NOTHING RETURNING listing_id AS "listingId"`,
      [sellerId, command.collectionId, command.add],
    )).rows;
    const removed = (await tx.client.query<{ listingId: string }>(
      'DELETE FROM treido.seller_catalog_collection_items WHERE seller_id=$1 AND collection_id=$2 AND listing_id=ANY($3::uuid[]) RETURNING listing_id AS "listingId"',
      [sellerId, command.collectionId, command.remove],
    )).rows;
    const changed = [...added, ...removed].map((row) => row.listingId);
    if (!changed.length) return { collectionId: command.collectionId, revision: collection.revision };
    await bumpProducts(tx, sellerId, changed);
    await tx.client.query(
      "UPDATE treido.seller_catalog_collections SET revision=revision+1,updated_at=clock_timestamp() WHERE seller_id=$1 AND id=$2", [sellerId, command.collectionId],
    );
  }
  return { collectionId: command.collectionId, revision: collection.revision + 1 };
}
async function organizeProducts(tx: SellerTransaction, command: Extract<CatalogCommand, { kind: "organizeProducts" }>): Promise<CatalogAcknowledgement> {
  const { sellerId } = command;
  const listingIds = command.products.map((product) => product.listingId);
  await ownedProducts(tx, sellerId, listingIds, true);
  const collectionIds = [...command.addCollections, ...command.removeCollections].sort();
  if (collectionIds.length) {
    const collections = (await tx.client.query<{ id: string; archived: boolean }>(
      "SELECT id,archived FROM treido.seller_catalog_collections WHERE seller_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR UPDATE", [sellerId, collectionIds],
    )).rows;
    if (collections.length !== collectionIds.length) throw new SellerError("NOT_FOUND");
    if (collections.some((collection) => collection.archived && command.addCollections.includes(collection.id))) throw new SellerError("CONFLICT");
  }
  const current = (await tx.client.query<{ listingId: string; revision: number; tags: string[] }>(
    'SELECT listing_id AS "listingId",revision,tags FROM treido.seller_catalog_product_organization WHERE seller_id=$1 AND listing_id=ANY($2::uuid[]) ORDER BY listing_id FOR UPDATE', [sellerId, listingIds],
  )).rows;
  const updates = command.products.map((product) => {
    const saved = current.find((row) => row.listingId === product.listingId);
    if ((saved?.revision ?? 0) !== product.expectedRevision) throw new SellerError("CONFLICT");
    const tags = applyCatalogTags(saved?.tags ?? [], command.tagsMode, command.tags);
    if (!tags) throw new SellerError("INVALID_INPUT");
    return { ...product, tags, changedTags: JSON.stringify(tags) !== JSON.stringify(saved?.tags ?? []) };
  });
  const changedCollections = new Set<string>();
  for (const product of updates) {
    const added = (await tx.client.query<{ id: string }>(
      `INSERT INTO treido.seller_catalog_collection_items(seller_id,collection_id,listing_id)
       SELECT $1,id,$2 FROM unnest($3::uuid[]) id ON CONFLICT DO NOTHING RETURNING collection_id AS id`,
      [sellerId, product.listingId, command.addCollections],
    )).rows;
    const removed = (await tx.client.query<{ id: string }>(
      "DELETE FROM treido.seller_catalog_collection_items WHERE seller_id=$1 AND listing_id=$2 AND collection_id=ANY($3::uuid[]) RETURNING collection_id AS id",
      [sellerId, product.listingId, command.removeCollections],
    )).rows;
    for (const row of [...added, ...removed]) changedCollections.add(row.id);
    if (product.changedTags || added.length || removed.length) {
      await tx.client.query(
        `INSERT INTO treido.seller_catalog_product_organization(seller_id,listing_id,tags) VALUES($1,$2,$3::text[])
         ON CONFLICT(seller_id,listing_id) DO UPDATE SET tags=excluded.tags,revision=treido.seller_catalog_product_organization.revision+1,updated_at=clock_timestamp()`,
        [sellerId, product.listingId, product.tags],
      );
    }
  }
  if (changedCollections.size) await tx.client.query(
    "UPDATE treido.seller_catalog_collections SET revision=revision+1,updated_at=clock_timestamp() WHERE seller_id=$1 AND id=ANY($2::uuid[])", [sellerId, [...changedCollections].sort()],
  );
  return { listingIds };
}
export async function executeCatalogCommand(database: SellerDatabase, identity: VerifiedIdentity, input: unknown): Promise<CatalogAcknowledgement> {
  const command = parseCatalogCommand(input);
  if (!command) throw new SellerError("INVALID_INPUT");
  const hash = inputHash(command);
  return inTransaction(database, async (tx) => {
    await authorizeSeller(tx, identity, command.sellerId, "listing.read");
    const { user } = await authorizeSeller(tx, identity, command.sellerId, "listing.write");
    // A catalog-only mutex gives edits from collections, product editors and bulk
    // actions one lock order without touching stock, purchase terms or plan usage.
    await tx.client.query("INSERT INTO treido.seller_catalog_state(seller_id) VALUES($1) ON CONFLICT DO NOTHING", [command.sellerId]);
    await tx.client.query("SELECT revision FROM treido.seller_catalog_state WHERE seller_id=$1 FOR UPDATE", [command.sellerId]);
    const previous = (await tx.client.query<{ hash: string; result: CatalogAcknowledgement }>(
      "SELECT input_hash AS hash,result FROM treido.seller_catalog_command_receipts WHERE seller_id=$1 AND actor_id=$2 AND request_id=$3", [command.sellerId, user.id, command.requestId],
    )).rows[0];
    if (previous) {
      if (previous.hash !== hash) throw new SellerError("CONFLICT");
      return previous.result;
    }
    const result = command.kind === "organizeProducts"
      ? await organizeProducts(tx, command)
      : await collectionCommand(tx, user.id, command);
    await tx.client.query("UPDATE treido.seller_catalog_state SET revision=revision+1 WHERE seller_id=$1", [command.sellerId]);
    await tx.client.query(
      "INSERT INTO treido.seller_catalog_command_receipts(seller_id,actor_id,request_id,input_hash,result) VALUES($1,$2,$3,$4,$5::jsonb)",
      [command.sellerId, user.id, command.requestId, hash, JSON.stringify(result)],
    );
    return result;
  });
}
