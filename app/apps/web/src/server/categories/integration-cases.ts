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
import {
  emptyDraft,
  type DraftPayload,
} from "../../features/selling/draft-model";
import { createPublicationFixture } from "../../../tests/fixtures/publication-flow";
import {
  readPublicationReview,
  withdrawListing,
} from "../../features/selling/publication.server";
import { publishListing } from "../../features/selling/publish.server";
import { readPublishedListing } from "../../features/catalog/published.server";
import { createBusinessSeller } from "../../features/sellers/persistence.server";
import { applyReviewedMigration } from "../../../scripts/identity-draft-migration.mjs";
import {
  maintenanceHash,
  parseReviewedPacket,
  createMaintenancePlan,
  applyMaintenancePlan,
} from "../../../scripts/category-policy-maintenance-core.mjs";

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
    it("explicit draft saves adopt current appended policy without approving pending versions or changing exact retries", async () => {
      const ctx = get(),
        id = "cat:books-media/fiction";
      const fixture = await createPublicationFixture(ctx, "personal");
      const data: DraftPayload = {
        ...(
          await readListingDraft(
            ctx.database,
            ctx.owner,
            fixture.sellerId,
            fixture.draft.id,
          )
        ).payload,
        title: "SYNTHETIC Fiction policy transition",
        categoryId: id,
        fields: {
          workTitle: "SYNTHETIC book",
          language: "bg",
          format: "paperback",
        },
      };
      const save = (expectedRevision: number, requestId = randomUUID()) => ({
        sellerId: fixture.sellerId,
        draftId: fixture.draft.id,
        expectedRevision,
        requestId,
        payload: data,
      });
      const boundVersion = async (listingId = fixture.draft.id) =>
        (
          await ctx.admin.query<{ version: number }>(
            "SELECT category_policy_version AS version FROM treido.listing_drafts WHERE listing_id=$1",
            [listingId],
          )
        ).rows[0].version;
      const first = await saveListingDraft(
        ctx.database,
        ctx.owner,
        save(fixture.draft.revision),
      );
      expect(await boundVersion()).toBe(1);
      const original = (
        await ctx.admin.query(
          "SELECT to_jsonb(p) AS policy FROM treido.category_policies p WHERE category_id=$1 AND version=1",
          [id],
        )
      ).rows[0].policy;
      await ctx.admin.query(
        "INSERT INTO treido.category_policies(registry_version,category_id,country,version,state,enabled_for_publish,rules,review_reference,reviewed_at) SELECT registry_version,category_id,country,2,'reviewed',true,rules || jsonb_build_object('sellerKinds',jsonb_build_array('personal'),'conditions',jsonb_build_array('good'),'handoverModes',jsonb_build_array('pickup'),'purchaseModes',jsonb_build_array('contact')),'SYNTHETIC APPENDED POLICY TEST ONLY',clock_timestamp() FROM treido.category_policies WHERE category_id=$1 AND version=1",
        [id],
      );
      let publishedRevision: number | null = null;
      try {
        const stale = await readPublicationReview(
          ctx.database,
          ctx.owner,
          fixture.sellerId,
          fixture.draft.id,
        );
        expect(stale.readiness.reasonCodes).toContain("CATEGORY_POLICY_STALE");
        expect(stale.canPublish).toBe(false);
        const command = save(first.revision);
        const saved = await saveListingDraft(ctx.database, ctx.owner, command);
        expect(await boundVersion()).toBe(2);
        const review = await readPublicationReview(
          ctx.database,
          ctx.owner,
          fixture.sellerId,
          fixture.draft.id,
        );
        expect(review.canPublish).toBe(true);
        const creation = {
          sellerId: fixture.sellerId,
          requestId: randomUUID(),
          payload: data,
        };
        const created = await createListingDraft(
          ctx.database,
          ctx.owner,
          creation,
        );
        expect(await boundVersion(created.id)).toBe(2);
        const input = { ...fixture.input, expectedRevision: saved.revision };
        const accepted = await publishListing(ctx.database, ctx.owner, input);
        publishedRevision = accepted.revision;
        expect(await publishListing(ctx.database, ctx.owner, input)).toEqual(
          accepted,
        );
        expect(
          await readPublishedListing(ctx.database, fixture.draft.id),
        ).toMatchObject({
          title: data.title,
          categoryId: id,
          purchaseMode: "contact",
        });
        expect(
          (
            await ctx.admin.query(
              "SELECT category_policy_version AS version FROM treido.listing_publications WHERE listing_id=$1 AND revision=$2",
              [fixture.draft.id, accepted.revision],
            )
          ).rows[0].version,
        ).toBe(2);
        await ctx.admin.query(
          "INSERT INTO treido.category_policies(registry_version,category_id,country,version,rules) SELECT registry_version,category_id,country,3,rules FROM treido.category_policies WHERE category_id=$1 AND version=2",
          [id],
        );
        expect(
          await readPublishedListing(ctx.database, fixture.draft.id),
        ).toBeNull();
        await expect(
          publishListing(ctx.database, ctx.owner, input),
        ).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
        expect(
          await createListingDraft(ctx.database, ctx.owner, creation),
        ).toEqual(created);
        expect(await boundVersion(created.id)).toBe(2);
        const withdrawn = await withdrawListing(ctx.database, ctx.owner, {
          sellerId: fixture.sellerId,
          listingId: fixture.draft.id,
          expectedRevision: accepted.revision,
          requestId: randomUUID(),
        });
        publishedRevision = null;
        const newer = save(withdrawn.revision);
        const pending = await saveListingDraft(ctx.database, ctx.owner, newer);
        expect(await boundVersion()).toBe(3);
        await ctx.admin.query(
          "INSERT INTO treido.category_policies(registry_version,category_id,country,version,rules) SELECT registry_version,category_id,country,4,rules FROM treido.category_policies WHERE category_id=$1 AND version=3",
          [id],
        );
        expect(await saveListingDraft(ctx.database, ctx.owner, newer)).toEqual(
          pending,
        );
        expect(await boundVersion()).toBe(3);
        expect(
          (
            await readPublicationReview(
              ctx.database,
              ctx.owner,
              fixture.sellerId,
              fixture.draft.id,
            )
          ).readiness.reasonCodes,
        ).toContain("CATEGORY_POLICY_STALE");
        const current = await saveListingDraft(
          ctx.database,
          ctx.owner,
          save(pending.revision),
        );
        expect(current.revision).toBe(pending.revision + 1);
        expect(await boundVersion()).toBe(4);
        const blocked = await readPublicationReview(
          ctx.database,
          ctx.owner,
          fixture.sellerId,
          fixture.draft.id,
        );
        expect(blocked.readiness.reasonCodes).toContain("CATEGORY_UNREVIEWED");
        expect(blocked.canPublish).toBe(false);
        expect(
          (
            await ctx.admin.query(
              "SELECT to_jsonb(p) AS policy FROM treido.category_policies p WHERE category_id=$1 AND version=1",
              [id],
            )
          ).rows[0].policy,
        ).toEqual(original);
      } finally {
        if (publishedRevision !== null)
          await withdrawListing(ctx.database, ctx.owner, {
            sellerId: fixture.sellerId,
            listingId: fixture.draft.id,
            expectedRevision: publishedRevision,
            requestId: randomUUID(),
          });
        await ctx.admin.query(
          "DELETE FROM treido.category_policies WHERE category_id=$1 AND version IN (3,4)",
          [id],
        );
        // The accepted snapshot retains v2 through its FK; withdraw the isolated
        // test policy instead of deleting or rewriting its original v1 source.
        await ctx.admin.query(
          "UPDATE treido.category_policies SET state='withdrawn',enabled_for_publish=false WHERE category_id=$1 AND version=2",
          [id],
        );
      }
    });
  });
  describe("reviewed category maintenance (isolated synthetic authorization only)", () => {
    const id = "cat:books-media/fiction";
    async function reviewPacket(admin: Client) {
      const actual = (
        await admin.query(
          "SELECT current_database() AS database,current_user AS role",
        )
      ).rows[0];
      // A hypothetical review for the isolated native database only. This does
      // not constitute actual business/legal review or any shared authorization.
      const bytes = Buffer.from(
        JSON.stringify({
          format: "treido-category-review-v1",
          target: {
            application: "treido-eu",
            environment: "test",
            projectId: "isolated-native-test",
            branchId: "br-isolated-native-test",
            database: actual.database,
            region: "eu-central-1",
            runtimeRole: "treido_runtime",
            maintenanceRole: actual.role,
            country: "BG",
          },
          authorizationReference: `native-test-target-authorization-${randomUUID()}`,
          decision: {
            reference: `native-test-decision-${randomUUID()}`,
            reviewedBy: "isolated-test-maintainer",
            reviewedAt: new Date().toISOString(),
            goodsScope: "ordinary-physical-nonregulated",
          },
          policies: [
            {
              categoryId: id,
              sellerKinds: ["personal"],
              conditions: ["good"],
              handoverModes: ["pickup"],
              purchaseModes: ["contact"],
            },
          ],
        }),
      );
      return parseReviewedPacket(bytes, maintenanceHash(bytes));
    }
    async function policies(admin: Client) {
      return (
        await admin.query(
          "SELECT to_jsonb(p) AS value FROM treido.category_policies p WHERE category_id=$1 ORDER BY version",
          [id],
        )
      ).rows.map((row) => row.value);
    }
    it("plans without writes, rejects runtime, appends once and replays the exact reviewed version", async () => {
      const { admin, database } = get();
      const review = await reviewPacket(admin);
      const original = await policies(admin);
      const plan = await createMaintenancePlan(admin, review);
      expect(await policies(admin)).toEqual(original);
      const runtime = await database.pool.connect();
      try {
        await expect(
          applyMaintenancePlan(runtime, plan, review),
        ).rejects.toMatchObject({ message: "MAINTENANCE_AUTHORITY_DENIED" });
      } finally {
        runtime.release();
      }
      expect(await policies(admin)).toEqual(original);
      const next = plan.proposals[0].version;
      try {
        const lockedAdmin = {
          async query(sql: string, params?: unknown[]) {
            const result = await admin.query(sql, params);
            if (sql.startsWith("LOCK TABLE")) {
              const locks = await admin.query(
                "SELECT c.relname FROM pg_locks l JOIN pg_class c ON c.oid=l.relation JOIN pg_namespace n ON n.oid=c.relnamespace WHERE l.pid=pg_backend_pid() AND n.nspname='treido' AND l.mode='ShareRowExclusiveLock' AND l.granted ORDER BY c.relname",
              );
              expect(locks.rows.map((row) => row.relname)).toEqual([
                "categories",
                "category_policies",
                "category_registry_versions",
              ]);
            }
            return result;
          },
        };
        const result = await applyMaintenancePlan(lockedAdmin, plan, review);
        expect(result.status).toBe("applied");
        expect(result.policies[0]).toMatchObject(plan.proposals[0]);
        expect(result.policies[0].reviewed_at).toEqual(expect.any(String));
        expect(result.policies[0].rules.restrictions).toEqual(
          plan.preimages[0].rules.restrictions,
        );
        expect(
          await inTransaction(database, (tx) =>
            readCategoryPublicationPolicy(tx, id, 1, next),
          ),
        ).toMatchObject({ allowed: true, policyVersion: next });
        expect((await policies(admin)).slice(0, -1)).toEqual(original);
        const replay = await applyMaintenancePlan(admin, plan, review);
        expect(replay.status).toBe("already-applied");
        expect(replay.policies).toEqual(result.policies);
        expect(await policies(admin)).toHaveLength(original.length + 1);
        await expect(
          createMaintenancePlan(admin, review),
        ).rejects.toMatchObject({
          message: "REVIEW_ALREADY_RECORDED_REPLAY_ORIGINAL_PLAN",
        });
      } finally {
        await admin.query(
          "DELETE FROM treido.category_policies WHERE category_id=$1 AND version=$2",
          [id, next],
        );
      }
      expect(await policies(admin)).toEqual(original);
    });
    it("rejects runtime column-write and truncate grants on every catalogue table", async () => {
      const { admin } = get();
      const review = await reviewPacket(admin);
      const original = await policies(admin);
      const plan = await createMaintenancePlan(admin, review);
      const temporaryGrants = [
        [
          "GRANT UPDATE(enabled_for_publish) ON treido.category_policies TO treido_runtime",
          "REVOKE UPDATE(enabled_for_publish) ON treido.category_policies FROM treido_runtime",
        ],
        [
          "GRANT UPDATE(profile) ON treido.categories TO treido_runtime",
          "REVOKE UPDATE(profile) ON treido.categories FROM treido_runtime",
        ],
        [
          "GRANT UPDATE(content_hash) ON treido.category_registry_versions TO treido_runtime",
          "REVOKE UPDATE(content_hash) ON treido.category_registry_versions FROM treido_runtime",
        ],
        [
          "GRANT TRUNCATE ON treido.category_policies TO treido_runtime",
          "REVOKE TRUNCATE ON treido.category_policies FROM treido_runtime",
        ],
      ];
      // Deliberately unsafe role capabilities in this isolated native fixture;
      // each is restored, with no grant-source/shared-database change.
      for (const [grant, revoke] of temporaryGrants) {
        await admin.query(grant);
        try {
          await expect(
            createMaintenancePlan(admin, review),
          ).rejects.toMatchObject({ message: "MAINTENANCE_AUTHORITY_DENIED" });
          await expect(
            applyMaintenancePlan(admin, plan, review),
          ).rejects.toMatchObject({ message: "MAINTENANCE_AUTHORITY_DENIED" });
          expect(await policies(admin)).toEqual(original);
        } finally {
          await admin.query(revoke);
        }
      }
      expect(await createMaintenancePlan(admin, review)).toEqual(plan);
    });
    it("stale policy/category packets abort atomically and cannot add reviewed rows", async () => {
      const { admin } = get();
      const original = await policies(admin);
      const review = await reviewPacket(admin);
      const plan = await createMaintenancePlan(admin, review);
      const next = plan.proposals[0].version;
      try {
        await admin.query(
          "INSERT INTO treido.category_policies(registry_version,category_id,country,version,rules) SELECT registry_version,category_id,country,$2,rules FROM treido.category_policies WHERE category_id=$1 AND version=$3",
          [id, next, next - 1],
        );
        const stale = await policies(admin);
        await expect(
          applyMaintenancePlan(admin, plan, review),
        ).rejects.toMatchObject({ message: "POLICY_PREIMAGE_MISMATCH" });
        expect(await policies(admin)).toEqual(stale);
      } finally {
        await admin.query(
          "DELETE FROM treido.category_policies WHERE category_id=$1 AND version=$2",
          [id, next],
        );
      }
      const labels = plan.categories[0].labels;
      try {
        await admin.query(
          'UPDATE treido.categories SET labels=labels || \'{"en":"Changed native label"}\'::jsonb WHERE id=$1',
          [id],
        );
        await expect(
          applyMaintenancePlan(admin, plan, review),
        ).rejects.toMatchObject({ message: "CATEGORY_PREIMAGE_MISMATCH" });
        expect(await policies(admin)).toEqual(original);
      } finally {
        await admin.query(
          "UPDATE treido.categories SET labels=$2::jsonb WHERE id=$1",
          [id, JSON.stringify(labels)],
        );
      }
      expect(await policies(admin)).toEqual(original);
    });
  });
}
