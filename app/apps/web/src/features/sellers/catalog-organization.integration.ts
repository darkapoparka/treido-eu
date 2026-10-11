import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
vi.mock("server-only", () => ({}));
import { createCatalogNativeFixture } from "./catalog-native-fixture";
import { createDatabase } from "../../server/db/database";
import { ensurePersonalSeller, createBusinessSeller } from "./persistence.server";
import { createListingDraft, readListingDraft } from "../selling/drafts.server";
import { emptyDraft } from "../selling/draft-model";
import { executeCatalogCommand } from "./catalog-organization-commands.server";
import { readCatalogCollection, readCatalogCollections, readCatalogProducts, readProductOrganization } from "./catalog-organization.server";
import { readPrivateCatalogPreview, readPublicCatalogCollection } from "./catalog-public.server";
import { editBulkProducts, readBulkProductRows } from "./bulk-product-edit.server";
import { readOwnedProductMedia } from "../selling/product-media-read.server";
import { readAdminProducts } from "./admin-products.server";
let fixture: Awaited<ReturnType<typeof createCatalogNativeFixture>>;
const owner = { subject: `user_catalog_native_${randomUUID().replaceAll("-", "")}` };
const stranger = { subject: `user_catalog_native_other_${randomUUID().replaceAll("-", "")}` };
let personal: string, business: string;
const draft = (sellerId: string) => createListingDraft(fixture.database, owner, { sellerId, requestId: randomUUID(), payload: emptyDraft });
beforeAll(async () => {
  fixture = await createCatalogNativeFixture();
  personal = await ensurePersonalSeller(fixture.database, owner);
  business = await createBusinessSeller(fixture.database, owner, { name: "Controlled native business", requestId: randomUUID() });
  await ensurePersonalSeller(fixture.database, stranger);
});
afterAll(async () => { await fixture?.close(); }, 45000);
it("saves a seller collection, tags and membership across a new connection without changing the product or stock", async () => {
  const { database } = fixture, product = await draft(personal);
  const command = { kind: "createCollection", sellerId: personal, requestId: randomUUID(), title: "Summer", description: "Seller-owned collection", visible: false };
  const created = await executeCatalogCommand(database, owner, command);
  expect(await executeCatalogCommand(database, owner, command)).toEqual(created);
  const membership = { kind: "collectionProducts", sellerId: personal, requestId: randomUUID(), collectionId: created.collectionId, expectedRevision: 1, add: [product.id], remove: [] };
  expect(await executeCatalogCommand(database, owner, membership)).toMatchObject({ revision: 2 });
  await executeCatalogCommand(database, owner, { kind: "organizeProducts", sellerId: personal, requestId: randomUUID(), products: [{ listingId: product.id.toUpperCase(), expectedRevision: 1 }], tagsMode: "add", tags: ["Лято", "Summer"], addCollections: [], removeCollections: [] });
  const fresh = createDatabase(new Pool(fixture.config));
  try {
    expect(await readCatalogCollection(fresh, owner, personal, created.collectionId!)).toMatchObject({ title: "Summer", productCount: 1, revision: 2 });
    expect(await readProductOrganization(fresh, owner, personal, product.id)).toMatchObject({ tags: ["Лято", "Summer"], revision: 2, collectionIds: [created.collectionId] });
    expect((await readCatalogProducts(fresh, owner, personal, { q: "лято" })).items.map((row) => row.id)).toContain(product.id);
    expect((await readAdminProducts(fresh, owner, personal, { q: "SUMMER" })).items.map((row) => row.id)).toContain(product.id);
    expect((await readListingDraft(fresh, owner, personal, product.id)).payload).toEqual(emptyDraft);
    expect((await fresh.pool.query("SELECT count(*)::integer AS count FROM treido.inventory_skus WHERE seller_id=$1 AND listing_id=$2", [personal, product.id])).rows[0].count).toBe(0);
  } finally { await fresh.pool.end(); }
  expect((await readPrivateCatalogPreview(database, owner, personal, created.collectionId!))?.collection.title).toBe("Summer");
  expect((await readPrivateCatalogPreview(database, owner, personal, created.collectionId!))?.items).toEqual([]);
  expect(await readPublicCatalogCollection(database, personal, created.collectionId!)).toBeNull();
  await executeCatalogCommand(database, owner, { kind: "archiveCollection", sellerId: personal, requestId: randomUUID(), collectionId: created.collectionId, expectedRevision: 2 });
  expect((await readCatalogCollections(database, owner, personal)).items.some((item) => item.id === created.collectionId)).toBe(false);
  expect((await readProductOrganization(database, owner, personal, product.id)).collectionIds).toEqual([]);
  expect(await readListingDraft(database, owner, personal, product.id)).toMatchObject({ id: product.id, publication: "draft" });
});
it("keeps seller boundaries and resolves competing organization saves without replacing a newer version", async () => {
  const { database } = fixture, product = await draft(business), own = await draft(personal);
  const collection = await executeCatalogCommand(database, owner, { kind: "createCollection", sellerId: business, requestId: randomUUID(), title: "Business catalog", description: "", visible: false });
  await expect(executeCatalogCommand(database, owner, { kind: "collectionProducts", sellerId: business, requestId: randomUUID(), collectionId: collection.collectionId, expectedRevision: 1, add: [product.id, own.id], remove: [] })).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect((await readCatalogCollection(database, owner, business, collection.collectionId!)).productCount).toBe(0);
  await expect(readCatalogCollection(database, stranger, business, collection.collectionId!)).rejects.toMatchObject({ code: "FORBIDDEN" });
  const results = await Promise.allSettled(["First", "Second"].map((tag) => executeCatalogCommand(database, owner, { kind: "organizeProducts", sellerId: business, requestId: randomUUID(), products: [{ listingId: product.id, expectedRevision: 0 }], tagsMode: "replace", tags: [tag], addCollections: [], removeCollections: [] })));
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  expect((await readProductOrganization(database, owner, business, product.id)).revision).toBe(1);
});
it("bulk edits report real per-product outcomes and retry a saved row without making another revision", async () => {
  const { database } = fixture, first = await draft(personal), second = await draft(personal);
  const items = [
    { listingId: first.id, requestId: randomUUID(), expectedRevision: first.revision, title: "Saved title", priceMinor: 1250 },
    { listingId: second.id, requestId: randomUUID(), expectedRevision: second.revision + 1, title: "Stale title", priceMinor: 999 },
  ];
  const results = await editBulkProducts(database, owner, { sellerId: personal, items });
  expect(results.find((row) => row.listingId === first.id)?.result).toMatchObject({ ok: true, title: "Saved title", priceMinor: 1250 });
  expect(results.find((row) => row.listingId === second.id)?.result).toMatchObject({ ok: false, code: "CONFLICT" });
  const before = await readListingDraft(database, owner, personal, first.id);
  expect((await editBulkProducts(database, owner, { sellerId: personal, items: [items[0]] }))[0].result).toMatchObject({ ok: true, revision: before.revision });
  expect((await readListingDraft(database, owner, personal, first.id)).revision).toBe(before.revision);
  expect((await readListingDraft(database, owner, personal, second.id)).payload.title).toBe(emptyDraft.title);
  expect((await readBulkProductRows(database, owner, personal, `${first.id},${second.id}`)).find((row) => row.id === first.id)).toMatchObject({ title: "Saved title", priceMinor: 1250 });
});
it("merchant media remains readable after publication and stops being readable after removal", async () => {
  const { database, admin } = fixture, product = await draft(personal);
  const user = (await admin.query<{ id: string }>("SELECT id FROM treido.users WHERE clerk_subject=$1", [owner.subject])).rows[0].id;
  const assetId = randomUUID(), jobId = randomUUID(), operationId = randomUUID(), hash = "a".repeat(64);
  await admin.query("INSERT INTO treido.outbox_jobs(id,kind,seller_id,resource_id,operation_key,intent_hash,actor_id,authority,state) VALUES($1,'media.process',$2,$3,$4,$5,$6,'member','cancelled')", [jobId, personal, assetId, operationId, hash, user]);
  await admin.query(`INSERT INTO treido.media_assets(id,seller_id,listing_id,created_by,request_id,input_hash,state,expected_bytes,content_type,expected_checksum,staging_key,immutable_key,source_etag,derivative_key,derivative_checksum,width,height,position,job_id,expires_at)
    VALUES($1,$2,$3,$4,$5,$6,'ready',1,'image/webp',$6,$7,$8,'fixture-etag',$9,$6,1,1,0,$10,clock_timestamp()+interval '1 hour')`,
    [assetId, personal, product.id, user, randomUUID(), hash, `stage/${assetId}`, `source/${assetId}`, `ready/${assetId}`, jobId]);
  await admin.query("UPDATE treido.listings SET publication='published' WHERE seller_id=$1 AND id=$2", [personal, product.id]);
  expect(await readOwnedProductMedia(database, owner, personal, assetId)).toMatchObject({ key: `ready/${assetId}`, checksum: hash });
  await expect(readOwnedProductMedia(database, stranger, personal, assetId)).rejects.toMatchObject({ code: "FORBIDDEN" });
  await admin.query("UPDATE treido.media_assets SET state='detached',revision=revision+1 WHERE id=$1", [assetId]);
  await expect(readOwnedProductMedia(database, owner, personal, assetId)).rejects.toMatchObject({ code: "NOT_FOUND" });
});
it("collection pagination keeps microseconds and does not skip same-timestamp groups", async () => {
  const { database, admin } = fixture;
  const actor = (await admin.query<{ id: string }>("SELECT id FROM treido.users WHERE clerk_subject=$1", [owner.subject])).rows[0].id;
  const ids = Array.from({ length: 31 }, () => randomUUID());
  await admin.query(`INSERT INTO treido.seller_catalog_collections(id,seller_id,title,created_by,updated_at)
    SELECT id,$2,'Paging fixture',$3,'2026-10-11T00:00:00.123456Z'::timestamptz FROM unnest($1::uuid[]) id`, [ids, business, actor]);
  const first = await readCatalogCollections(database, owner, business, { q: "Paging fixture" });
  expect(first.items).toHaveLength(30);
  const last = await readCatalogCollections(database, owner, business, { q: "Paging fixture", after: first.nextCursor! });
  expect(last.items).toHaveLength(1);
  expect(new Set([...first.items, ...last.items].map((item) => item.id)).size).toBe(31);
});
