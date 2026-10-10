import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import type { SellerDatabase } from "../../server/db/database";
import { createPublicationFixture } from "../../../tests/fixtures/publication-flow";
import { publishListing } from "../selling/publish.server";
import { withdrawListing } from "../selling/publication.server";
import {
  paymentMaintenanceHash,
  parsePaymentReview,
  createPaymentMaintenancePlan,
  applyPaymentMaintenancePlan,
} from "../../../scripts/payment-registry-maintenance-core.mjs";

export function definePaymentMaintenanceIntegrationCases(
  get: () => {
    database: SellerDatabase;
    admin: Client;
    owner: { subject: string };
    other: { subject: string };
  },
) {
  describe("reviewed TEST payment maintenance (isolated synthetic decisions/provider only)", () => {
    async function fixture() {
      const { database, admin } = get();
      const category = "cat:electronics/phones";
      const original = (
        await admin.query(
          "SELECT state,enabled_for_publish,review_reference,reviewed_at FROM treido.category_policies WHERE category_id=$1 AND version=1",
          [category],
        )
      ).rows[0];
      // Synthetic native policy authorizations never qualify shared/live supply.
      await admin.query(
        "UPDATE treido.category_policies SET state='reviewed',enabled_for_publish=true,review_reference='SYNTHETIC NATIVE PAYMENT TEST ONLY',reviewed_at=now() WHERE category_id=$1 AND version=1",
        [category],
      );
      const owner = {
        subject: "user_native_payment_" + randomUUID().replaceAll("-", ""),
      };
      const media = await createPublicationFixture(
        { database, admin, owner },
        "personal",
      );
      const published = await publishListing(database, owner, media.input);
      const actual = (
        await admin.query(
          "SELECT current_database() AS database,current_user AS role",
        )
      ).rows[0];
      const ownerId = (
        await admin.query(
          "SELECT id FROM treido.users WHERE clerk_subject=$1",
          [owner.subject],
        )
      ).rows[0].id;
      const decision = () => ({
        reference: "native-test-reviewed-" + randomUUID(),
        reviewedBy: "isolated-test-maintainer",
        reviewedAt: new Date().toISOString(),
      });
      const packet = {
        format: "treido-test-payment-review-v1",
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
          appOrigin: "http://127.0.0.1:6500",
          stripeApplicationId: "treido-native-test",
          stripePlatformAccount: "acct_NativeTestPlatform",
          livemode: false,
        },
        authorizationReference: "native-test-target-" + randomUUID(),
        policy: {
          id: randomUUID(),
          feeBps: 300,
          feeFixedMinor: 30,
          settlementMerchant: "platform",
          buyerTerms: {
            bg: "Само за изолирана тестова проверка, без реална продажба.",
            en: "Isolated native test only; no real sale or policy approval.",
          },
          decision: decision(),
        },
        mapping: {
          id: randomUUID(),
          sellerId: media.sellerId,
          ownerUserId: ownerId,
          connectedAccount: "acct_Native" + randomUUID().replaceAll("-", ""),
          decision: decision(),
        },
        listing: {
          id: media.draft.id,
          publicationRevision: published.revision,
          decision: decision(),
        },
      };
      const bytes = Buffer.from(JSON.stringify(packet));
      const review = parsePaymentReview(bytes, paymentMaintenanceHash(bytes));
      const connected = {
        id: packet.mapping.connectedAccount,
        country: "BG",
        default_currency: "eur",
        type: "express",
        controller: {
          is_controller: true,
          stripe_dashboard: { type: "express" },
          requirement_collection: "stripe",
          fees: { payer: "application" },
          losses: { payments: "application" },
        },
        details_submitted: false,
        requirements: { currently_due: ["business_type"] },
        email: "PRIVATE MUST NOT LEAVE PROVIDER",
      };
      const calls: Array<string | null> = [];
      const stripe = {
        accounts: {
          async retrieve(id: string | null) {
            calls.push(id);
            return id === null
              ? {
                  id: packet.target.stripePlatformAccount,
                  country: "BG",
                  default_currency: "eur",
                }
              : connected;
          },
        },
      };
      const counts = async () =>
        (
          await admin.query(
            "SELECT (SELECT count(*)::integer FROM treido.payment_policies WHERE id=$1) AS policies,(SELECT count(*)::integer FROM treido.seller_payment_bindings WHERE seller_id=$2) AS bindings,(SELECT count(*)::integer FROM treido.payable_listing_terms WHERE seller_id=$2 AND listing_id=$3) AS terms",
            [packet.policy.id, packet.mapping.sellerId, packet.listing.id],
          )
        ).rows[0];
      const cleanup = async () => {
        const row = (
          await admin.query(
            "SELECT revision,publication FROM treido.listings WHERE id=$1",
            [media.draft.id],
          )
        ).rows[0];
        if (row.publication === "published")
          await withdrawListing(database, owner, {
            sellerId: media.sellerId,
            listingId: media.draft.id,
            expectedRevision: row.revision,
            requestId: randomUUID(),
          });
        await admin.query(
          "UPDATE treido.category_policies SET state=$2,enabled_for_publish=$3,review_reference=$4,reviewed_at=$5 WHERE category_id=$1 AND version=1",
          [
            category,
            original.state,
            original.enabled_for_publish,
            original.review_reference,
            original.reviewed_at,
          ],
        );
      };
      return {
        admin,
        database,
        review,
        packet,
        stripe,
        connected,
        calls,
        counts,
        cleanup,
      };
    }
    it("plans without writes, locks real eligibility and three registries, appends once and preserves exact replay", async () => {
      const ctx = await fixture();
      try {
        expect(ctx.packet.listing.publicationRevision).toBe(2);
        const plan = await createPaymentMaintenancePlan(
          ctx.admin,
          ctx.review,
          ctx.stripe,
        );
        expect(await ctx.counts()).toEqual({
          policies: 0,
          bindings: 0,
          terms: 0,
        });
        expect(ctx.calls).toEqual([null, ctx.packet.mapping.connectedAccount]);
        let locked = false;
        const checked = {
          async query(sql: string, params?: unknown[]) {
            const result = await ctx.admin.query(sql, params);
            if (sql.endsWith("IN SHARE ROW EXCLUSIVE MODE")) {
              const locks = (
                await ctx.admin.query(
                  "SELECT c.relname,l.mode FROM pg_locks l JOIN pg_class c ON c.oid=l.relation JOIN pg_namespace n ON n.oid=c.relnamespace WHERE l.pid=pg_backend_pid() AND l.granted AND n.nspname='treido' AND l.mode IN ('ShareLock','ShareRowExclusiveLock') ORDER BY c.relname",
                )
              ).rows;
              for (const name of [
                "payment_policies",
                "seller_payment_bindings",
                "payable_listing_terms",
              ])
                expect(locks).toContainEqual({
                  relname: name,
                  mode: "ShareRowExclusiveLock",
                });
              for (const name of [
                "users",
                "seller_accounts",
                "seller_memberships",
                "personal_seller_owners",
                "listings",
                "listing_publications",
                "category_policies",
                "seller_declarations",
                "media_assets",
                "listing_publication_media",
              ])
                expect(locks).toContainEqual({
                  relname: name,
                  mode: "ShareLock",
                });
              locked = true;
            }
            return result;
          },
        };
        const applied = await applyPaymentMaintenancePlan(
          checked,
          plan,
          ctx.review,
          ctx.stripe,
        );
        expect(locked).toBe(true);
        expect(applied.status).toBe("applied");
        expect(applied.collectionChanged).toBe(false);
        expect(applied.aftercareQualified).toBe(false);
        expect(JSON.stringify(applied)).not.toContain("PRIVATE MUST NOT LEAVE");
        expect(await ctx.counts()).toEqual({
          policies: 1,
          bindings: 1,
          terms: 1,
        });
        ctx.connected.details_submitted = true;
        ctx.connected.requirements.currently_due = [];
        const replay = await applyPaymentMaintenancePlan(
          ctx.admin,
          plan,
          ctx.review,
          ctx.stripe,
        );
        expect(replay.status).toBe("already-applied");
        expect(replay.records).toEqual(applied.records);
        expect(await ctx.counts()).toEqual({
          policies: 1,
          bindings: 1,
          terms: 1,
        });
        await expect(
          createPaymentMaintenancePlan(ctx.admin, ctx.review, ctx.stripe),
        ).rejects.toThrow("EXISTING_REGISTRY_REPLAY_OR_REVIEW_REQUIRED");
        await ctx.admin.query(
          "UPDATE treido.seller_payment_bindings SET revoked_at=now() WHERE id=$1",
          [ctx.packet.mapping.id],
        );
        await expect(
          applyPaymentMaintenancePlan(ctx.admin, plan, ctx.review, ctx.stripe),
        ).rejects.toThrow("REGISTRY_PREIMAGE_MISMATCH");
      } finally {
        await ctx.cleanup();
      }
    });
    it("denies direct/column/TRUNCATE and SET-only alternate-role writes before any registry append", async () => {
      const ctx = await fixture();
      try {
        const plan = await createPaymentMaintenancePlan(
          ctx.admin,
          ctx.review,
          ctx.stripe,
        );
        for (const [grant, revoke] of [
          [
            "GRANT UPDATE(fee_bps) ON treido.payment_policies TO treido_runtime",
            "REVOKE UPDATE(fee_bps) ON treido.payment_policies FROM treido_runtime",
          ],
          [
            "GRANT INSERT(approval_reference) ON treido.seller_payment_bindings TO treido_runtime",
            "REVOKE INSERT(approval_reference) ON treido.seller_payment_bindings FROM treido_runtime",
          ],
          [
            "GRANT TRUNCATE ON treido.payable_listing_terms TO treido_runtime",
            "REVOKE TRUNCATE ON treido.payable_listing_terms FROM treido_runtime",
          ],
        ]) {
          await ctx.admin.query(grant);
          try {
            await expect(
              createPaymentMaintenancePlan(ctx.admin, ctx.review, ctx.stripe),
            ).rejects.toThrow("MAINTENANCE_AUTHORITY_DENIED");
            await expect(
              applyPaymentMaintenancePlan(
                ctx.admin,
                plan,
                ctx.review,
                ctx.stripe,
              ),
            ).rejects.toThrow("MAINTENANCE_AUTHORITY_DENIED");
            expect(await ctx.counts()).toEqual({
              policies: 0,
              bindings: 0,
              terms: 0,
            });
          } finally {
            await ctx.admin.query(revoke);
          }
        }
        const role = "payment_test_writer_" + randomUUID().replaceAll("-", "");
        await ctx.admin.query(
          `CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT`,
        );
        try {
          await ctx.admin.query(`GRANT USAGE ON SCHEMA treido TO ${role}`);
          await ctx.admin.query(
            `GRANT UPDATE(fee_bps) ON treido.payment_policies TO ${role}`,
          );
          await ctx.admin.query(
            `GRANT ${role} TO treido_runtime WITH INHERIT FALSE, SET TRUE`,
          );
          expect(
            (
              await ctx.admin.query(
                "SELECT has_any_column_privilege('treido_runtime','treido.payment_policies','UPDATE') AS inherited",
              )
            ).rows[0].inherited,
          ).toBe(false);
          await expect(
            applyPaymentMaintenancePlan(
              ctx.admin,
              plan,
              ctx.review,
              ctx.stripe,
            ),
          ).rejects.toThrow("MAINTENANCE_AUTHORITY_DENIED");
          expect(await ctx.counts()).toEqual({
            policies: 0,
            bindings: 0,
            terms: 0,
          });
        } finally {
          await ctx.admin.query(`REVOKE ${role} FROM treido_runtime`);
          await ctx.admin.query(
            `REVOKE UPDATE(fee_bps) ON treido.payment_policies FROM ${role}`,
          );
          await ctx.admin.query(`REVOKE USAGE ON SCHEMA treido FROM ${role}`);
          await ctx.admin.query(`DROP ROLE ${role}`);
        }
        expect(
          await createPaymentMaintenancePlan(ctx.admin, ctx.review, ctx.stripe),
        ).toEqual(plan);
      } finally {
        await ctx.cleanup();
      }
    });
    it("stale latest policy, ready-photo revision and current owner abort the entire packet", async () => {
      const ctx = await fixture();
      try {
        const plan = await createPaymentMaintenancePlan(
          ctx.admin,
          ctx.review,
          ctx.stripe,
        );
        const category = plan.resources.category;
        await ctx.admin.query(
          "INSERT INTO treido.category_policies(registry_version,category_id,category_kind,country,version,state,enabled_for_publish,rules) VALUES($1,$2,'leaf','BG',$3,'pending',false,$4)",
          [
            category.registry_version,
            category.category_id,
            category.version + 1,
            JSON.stringify(category.rules),
          ],
        );
        try {
          await expect(
            applyPaymentMaintenancePlan(
              ctx.admin,
              plan,
              ctx.review,
              ctx.stripe,
            ),
          ).rejects.toThrow("CURRENT_PICKUP_PUBLICATION_REQUIRED");
          expect(await ctx.counts()).toEqual({
            policies: 0,
            bindings: 0,
            terms: 0,
          });
        } finally {
          await ctx.admin.query(
            "DELETE FROM treido.category_policies WHERE registry_version=$1 AND category_id=$2 AND version=$3",
            [
              category.registry_version,
              category.category_id,
              category.version + 1,
            ],
          );
        }
        const assetId = plan.resources.media[0].assetId;
        await ctx.admin.query(
          "UPDATE treido.media_assets SET revision=revision+1 WHERE id=$1",
          [assetId],
        );
        try {
          await expect(
            applyPaymentMaintenancePlan(
              ctx.admin,
              plan,
              ctx.review,
              ctx.stripe,
            ),
          ).rejects.toThrow("CURRENT_PICKUP_PUBLICATION_REQUIRED");
        } finally {
          await ctx.admin.query(
            "UPDATE treido.media_assets SET revision=revision-1 WHERE id=$1",
            [assetId],
          );
        }
        await ctx.admin.query(
          "UPDATE treido.users SET status='restricted' WHERE id=$1",
          [ctx.packet.mapping.ownerUserId],
        );
        try {
          await expect(
            applyPaymentMaintenancePlan(
              ctx.admin,
              plan,
              ctx.review,
              ctx.stripe,
            ),
          ).rejects.toThrow("CURRENT_SELLER_OWNER_REQUIRED");
        } finally {
          await ctx.admin.query(
            "UPDATE treido.users SET status='active' WHERE id=$1",
            [ctx.packet.mapping.ownerUserId],
          );
        }
        expect(await ctx.counts()).toEqual({
          policies: 0,
          bindings: 0,
          terms: 0,
        });
      } finally {
        await ctx.cleanup();
      }
    });
    it("rolls back an actual last-insert failure and detects another policy's terms for the same publication", async () => {
      const ctx = await fixture();
      try {
        const plan = await createPaymentMaintenancePlan(
          ctx.admin,
          ctx.review,
          ctx.stripe,
        );
        const failing = {
          async query(sql: string, params?: unknown[]) {
            if (sql.startsWith("INSERT INTO treido.payable_listing_terms"))
              return ctx.admin.query("SELECT 1/0");
            return ctx.admin.query(sql, params);
          },
        };
        await expect(
          applyPaymentMaintenancePlan(failing, plan, ctx.review, ctx.stripe),
        ).rejects.toMatchObject({ code: "22012" });
        expect(await ctx.counts()).toEqual({
          policies: 0,
          bindings: 0,
          terms: 0,
        });
        const foreign = randomUUID();
        await ctx.admin.query(
          "INSERT INTO treido.payment_policies(id,platform_account,livemode,environment,application_id,currency,fee_bps,fee_fixed_minor,tax_policy,handover,settlement_merchant,refund_policy,buyer_terms,approval_reference,approved_at) VALUES($1,'acct_NativeOtherPolicy',false,'test','treido-native-test','EUR',0,0,'inclusive','pickup','platform','full_fee_and_transfer_reversal',$2,'SYNTHETIC TEST ONLY',now())",
          [
            foreign,
            JSON.stringify({ bg: "Тестови условия", en: "Test only terms" }),
          ],
        );
        await ctx.admin.query(
          "INSERT INTO treido.payable_listing_terms(seller_id,listing_id,publication_revision,policy_id,approval_reference,approved_at) VALUES($1,$2,$3,$4,'SYNTHETIC TEST ONLY',now())",
          [
            ctx.packet.mapping.sellerId,
            ctx.packet.listing.id,
            ctx.packet.listing.publicationRevision,
            foreign,
          ],
        );
        await expect(
          applyPaymentMaintenancePlan(ctx.admin, plan, ctx.review, ctx.stripe),
        ).rejects.toThrow("REGISTRY_PREIMAGE_MISMATCH");
        expect(await ctx.counts()).toEqual({
          policies: 0,
          bindings: 0,
          terms: 1,
        });
      } finally {
        await ctx.cleanup();
      }
    });
  });
}
