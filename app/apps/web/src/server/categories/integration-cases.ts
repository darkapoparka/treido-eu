import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Client } from "pg";
import { inTransaction, type SellerDatabase } from "../db/database";
import {
  listPublishedCategoryLeaves,
  readCategoryPublicationPolicy,
} from "./catalogue.server";
import {
  createListingDraft,
  readListingDraft,
  saveListingDraft,
} from "../../features/selling/drafts.server";
import { emptyDraft } from "../../features/selling/draft-model";
import { createBusinessSeller } from "../../features/sellers/persistence.server";
import { applyReviewedMigration } from "../../../scripts/identity-draft-migration.mjs";

export function defineCategoryIntegrationCases(
  get: () => {
    database: SellerDatabase;
    admin: Client;
    owner: { subject: string };
    other: { subject: string };
  },
) {
  describe("persisted category policy (isolated synthetic review facts only)", () => {
    it("persists exact bilingual roots, leaves and pending policies without public exposure", async () => {
      const { database, admin } = get();
      expect(
        (
          await admin.query(
            "SELECT kind,count(*)::integer AS total FROM treido.categories GROUP BY kind ORDER BY kind",
          )
        ).rows,
      ).toEqual([
        { kind: "leaf", total: 152 },
        { kind: "root", total: 16 },
      ]);
      expect(
        (
          await admin.query(
            "SELECT count(*)::integer AS total FROM treido.category_policies WHERE state='pending' AND NOT enabled_for_publish",
          )
        ).rows[0].total,
      ).toBe(152);
      expect(await listPublishedCategoryLeaves(database, "bg")).toEqual([]);
      expect(await listPublishedCategoryLeaves(database, "en")).toEqual([]);
    });
    it("runtime cannot create, replace, activate or delete catalogue policy", async () => {
      const { database } = get();
      for (const sql of [
        "UPDATE treido.category_policies SET enabled_for_publish=true",
        "UPDATE treido.categories SET slug='changed'",
        "DELETE FROM treido.category_policies",
        "INSERT INTO treido.category_registry_versions(version,content_hash) VALUES(9,repeat('a',64))",
      ])
        await expect(database.pool.query(sql)).rejects.toMatchObject({
          code: "42501",
        });
    });
    it("database prevents unreviewed activation and invalid leaf ancestry/labels", async () => {
      const { admin } = get();
      await expect(
        admin.query(
          "UPDATE treido.category_policies SET enabled_for_publish=true WHERE category_id='cat:electronics/phones'",
        ),
      ).rejects.toMatchObject({ code: "23514" });
      await expect(
        admin.query(
          "UPDATE treido.categories SET parent_id='cat:electronics/phones' WHERE id='cat:electronics/tablets'",
        ),
      ).rejects.toMatchObject({ code: "23503" });
      await expect(
        admin.query(
          "UPDATE treido.categories SET labels='{}' WHERE id='cat:electronics'",
        ),
      ).rejects.toMatchObject({ code: "23514" });
    });
    it("pending/unknown/root/version-mismatched policies cannot permit publication", async () => {
      const { database } = get();
      expect(
        (
          await inTransaction(database, (tx) =>
            readCategoryPublicationPolicy(tx, "cat:electronics/phones", 1, 1),
          )
        ).allowed,
      ).toBe(false);
      for (const [id, version] of [
        ["cat:electronics", 1],
        ["cat:missing", 1],
        ["cat:electronics/phones", 2],
      ] as const)
        await expect(
          inTransaction(database, (tx) =>
            readCategoryPublicationPolicy(tx, id, version, 1),
          ),
        ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    });
    it("reviewed exposure is minimal and migration replay never overwrites review state", async () => {
      const { database, admin } = get();
      const id = "cat:electronics/phones";
      // Test-only state written by the native harness admin, never by a seed/route.
      await admin.query(
        "UPDATE treido.category_policies SET state='reviewed',enabled_for_publish=true,review_reference='SYNTHETIC TEST ONLY',reviewed_at=now() WHERE category_id=$1",
        [id],
      );
      try {
        const source = await readFile(
          resolve(
            process.cwd(),
            "apps/web/migrations/0005_category_catalogue.sql",
          ),
          "utf8",
        );
        expect(
          await applyReviewedMigration(
            admin,
            "0005_category_catalogue",
            source,
          ),
        ).toBe("already-applied");
        const publicRows = await listPublishedCategoryLeaves(database, "bg");
        expect(publicRows).toHaveLength(1);
        expect(publicRows[0].id).toBe(id);
        expect(Object.keys(publicRows[0]).sort()).toEqual(["id", "label"]);
        expect(
          (
            await inTransaction(database, (tx) =>
              readCategoryPublicationPolicy(tx, id, 1, 1),
            )
          ).allowed,
        ).toBe(true);
        await admin.query(
          "INSERT INTO treido.category_policies(registry_version,category_id,country,version,rules) SELECT registry_version,category_id,country,2,rules FROM treido.category_policies WHERE category_id=$1 AND version=1",
          [id],
        );
        expect(await listPublishedCategoryLeaves(database, "bg")).toEqual([]);
        await expect(
          inTransaction(database, (tx) =>
            readCategoryPublicationPolicy(tx, id, 1, 1),
          ),
        ).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
      } finally {
        await admin.query(
          "DELETE FROM treido.category_policies WHERE category_id=$1 AND version=2",
          [id],
        );
        await admin.query(
          "UPDATE treido.category_policies SET state='pending',enabled_for_publish=false,review_reference=NULL,reviewed_at=NULL WHERE category_id=$1",
          [id],
        );
      }
    });
    it("draft create/save reuse persisted stable IDs but pending policy grants no publication", async () => {
      const { database, owner, other } = get();
      const sellerId = await createBusinessSeller(database, owner, {
        name: "Category persistence",
        requestId: randomUUID(),
      });
      const draft = await createListingDraft(database, owner, {
        sellerId,
        requestId: randomUUID(),
        payload: {
          ...emptyDraft,
          categoryId: "cat:electronics/phones",
          condition: "good",
        },
      });
      await saveListingDraft(database, owner, {
        sellerId,
        draftId: draft.id,
        expectedRevision: 1,
        requestId: randomUUID(),
        payload: {
          ...emptyDraft,
          categoryId: "cat:electronics/tablets",
          condition: "good",
        },
      });
      expect(
        (await readListingDraft(database, owner, sellerId, draft.id)).payload
          .categoryId,
      ).toBe("cat:electronics/tablets");
      await expect(
        readListingDraft(database, other, sellerId, draft.id),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });
}
