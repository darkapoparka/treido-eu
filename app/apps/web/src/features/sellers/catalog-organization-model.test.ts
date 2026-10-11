import assert from "node:assert/strict";
import test from "node:test";
import { applyCatalogTags, parseCatalogCommand, normalizeCatalogTags } from "./catalog-organization-model";
import { parseCatalogContinuation, parseCatalogSelection } from "./catalog-navigation";
import { parseBulkProductEdits } from "./bulk-product-edit-model";
const sellerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", listingId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", collectionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc", requestId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const organize = { kind: "organizeProducts", sellerId, requestId, products: [{ listingId, expectedRevision: 3 }], tagsMode: "add", tags: ["Лято"], addCollections: [collectionId], removeCollections: [] };
test("catalog commands retain exact revisions while normalizing UUID identity", () => {
  const parsed = parseCatalogCommand({ ...organize, sellerId: sellerId.toUpperCase(), requestId: requestId.toUpperCase(), products: [{ listingId: listingId.toUpperCase(), expectedRevision: 3 }], addCollections: [collectionId.toUpperCase()] });
  assert.deepEqual(parsed, organize);
  assert.equal(parseCatalogCommand({ ...organize, products: [...organize.products, { listingId: listingId.toUpperCase(), expectedRevision: 0 }] }), null);
  assert.equal(parseCatalogCommand({ ...organize, removeCollections: [collectionId.toUpperCase()] }), null);
  assert.equal(parseCatalogCommand({ ...organize, products: [{ listingId, expectedRevision: 0.5 }] }), null);
});
test("tag updates preserve unrelated tags and enforce merged limits", () => {
  assert.deepEqual(normalizeCatalogTags(["  Лято ", "лято", "Summer"]), ["Лято", "Summer"]);
  assert.deepEqual(applyCatalogTags(["Лято", "Sale"], "add", ["лято", "New"]), ["Лято", "Sale", "New"]);
  assert.deepEqual(applyCatalogTags(["Лято", "Sale"], "remove", ["лято"]), ["Sale"]);
  assert.equal(applyCatalogTags(Array.from({ length: 20 }, (_, i) => String(i)), "add", ["extra"]), null);
  assert.deepEqual(applyCatalogTags(["Old"], "replace", []), []);
});
test("collection edits validate names and bounded membership differences", () => {
  assert.deepEqual(parseCatalogCommand({ kind: "createCollection", sellerId, requestId, title: "  Summer  ", description: "  Saved group  ", visible: false }), { kind: "createCollection", sellerId, requestId, title: "Summer", description: "Saved group", visible: false });
  assert.equal(parseCatalogCommand({ kind: "createCollection", sellerId, requestId, title: "  ", description: "", visible: true }), null);
  assert.equal(parseCatalogCommand({ kind: "collectionProducts", sellerId, requestId, collectionId, expectedRevision: 1, add: [listingId], remove: [listingId.toUpperCase()] }), null);
});
test("bulk draft edits keep integer EUR amounts and canonical request identities", () => {
  const row = { listingId, requestId, expectedRevision: 2, title: "Changed", priceMinor: 1250 };
  assert.deepEqual(parseBulkProductEdits({ sellerId: sellerId.toUpperCase(), items: [{ ...row, listingId: listingId.toUpperCase() }] }), { sellerId, items: [row] });
  assert.equal(parseBulkProductEdits({ sellerId, items: [{ ...row, priceMinor: 12.5 }] }), null);
  assert.equal(parseBulkProductEdits({ sellerId, items: [row, { ...row, listingId: listingId.toUpperCase() }] }), null);
});
test("catalog, preview and customer history continuations remain scoped read destinations", () => {
  assert.equal(parseCatalogContinuation(`/app/sellers/${sellerId}/collections/${collectionId}/preview?lang=bg`), `/app/sellers/${sellerId}/collections/${collectionId}/preview?lang=bg`);
  assert.equal(parseCatalogContinuation(`/app/sellers/${sellerId}/customers/${listingId}?lang=en&before=${requestId}`), `/app/sellers/${sellerId}/customers/${listingId}?lang=en&before=${requestId}`);
  assert.equal(parseCatalogContinuation(`/app/sellers/${sellerId}/catalog/edit?lang=en&ids=${listingId.toUpperCase()}`), `/app/sellers/${sellerId}/catalog/edit?lang=en&ids=${listingId}`);
  assert.equal(parseCatalogContinuation(`/app/sellers/${sellerId}/collections/${collectionId}/preview?visible=true`), null);
  assert.equal(parseCatalogContinuation(`/app/sellers/${sellerId}/customers/${listingId}/export`), null);
  assert.equal(parseCatalogSelection(`${listingId},${listingId.toUpperCase()}`), null);
});
