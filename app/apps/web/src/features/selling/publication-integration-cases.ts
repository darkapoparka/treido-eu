import { seedPublishedSnapshot } from "../../../tests/fixtures/published-listing";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import type { SellerDatabase } from "../../server/db/database";
import {
  createBusinessSeller,
  ensurePersonalSeller,
  revokeSellerMembership,
} from "../sellers/persistence.server";
import { createListingDraft } from "./drafts.server";
import { emptyDraft } from "./draft-model";
import { readPublicationReview, withdrawListing } from "./publication.server";
import { readPublicListingState } from "../trust/moderation.server";
import { openListingConversation } from "../messaging/participants.server";

export function definePublicationIntegrationCases(
  get: () => {
    database: SellerDatabase;
    admin: Client;
    owner: { subject: string };
    other: { subject: string };
  },
) {
  describe("saved publication review and withdrawal", () => {
    let sellerId: string,
      draftId: string,
      publishedId: string,
      memberId: string;
    const retry = randomUUID();
    beforeAll(async () => {
      const { database, admin, owner, other } = get();
      sellerId = await createBusinessSeller(database, owner, {
        name: "Review and withdrawal",
        requestId: randomUUID(),
      });
      await ensurePersonalSeller(database, other);
      memberId = (
        await admin.query(
          "SELECT id FROM treido.users WHERE clerk_subject=$1",
          [other.subject],
        )
      ).rows[0].id;
      for (const type of ["draft", "published"] as const) {
        const draft = await createListingDraft(database, owner, {
          sellerId,
          requestId: randomUUID(),
          payload: {
            ...emptyDraft,
            title: "Собствен телефон",
            description: "Синтетичен тестов артикул",
            categoryId: "cat:electronics/phones",
            condition: "good",
            priceMinor: 10000,
            locality: "София",
            fields: {
              brand: "Apple",
              model: "iPhone",
              storageGB: "128",
              workingStatus: "working",
            },
          },
        });
        if (type === "draft") draftId = draft.id;
        else {
          publishedId = draft.id;
          // Only an owned native fixture. This is not a production publish path.
          await admin.query(
            "UPDATE treido.listings SET publication='published' WHERE id=$1",
            [publishedId],
          );
        }
      }
    });
    afterAll(async () => {
      await get().admin.query(
        "UPDATE treido.category_policies SET state='pending',enabled_for_publish=false,review_reference=NULL,reviewed_at=NULL WHERE category_id='cat:electronics/phones' AND version=1",
      );
    });
    it("review is read-only, current-owner scoped and exposes actual blocking facts", async () => {
      const { database, admin, owner, other } = get();
      const count = (await admin.query("SELECT count(*) FROM treido.listings"))
        .rows[0].count;
      const review = await readPublicationReview(
        database,
        owner,
        sellerId,
        draftId,
      );
      expect(review.fieldIssues).toEqual([]);
      expect(review.readiness.status).toBe("blocked");
      expect(review.readiness.reasonCodes).toEqual(
        expect.arrayContaining([
          "CATEGORY_UNREVIEWED",
          "DECLARATION_REQUIRED",
          "MEDIA_NOT_READY",
        ]),
      );
      expect(review.canWithdraw).toBe(false);
      expect(JSON.stringify(review)).not.toMatch(
        /immutable_key|registrationNumber|derivativeKey/,
      );
      expect(
        (await admin.query("SELECT count(*) FROM treido.listings")).rows[0]
          .count,
      ).toBe(count);
      await expect(
        readPublicationReview(database, other, sellerId, draftId),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it("review uses held active usage and current moderation without approving publication", async () => {
      const { database, admin, owner } = get();
      const ids = Array.from({ length: 99 }, () => randomUUID());
      try {
        await admin.query(
          "INSERT INTO treido.listings(id,seller_id,publication,moderation_state) SELECT unnest($1::uuid[]),$2,'published','restricted'",
          [ids, sellerId],
        );
        await admin.query(
          "UPDATE treido.listings SET moderation_state='restricted' WHERE id=$1",
          [draftId],
        );
        const review = await readPublicationReview(
          database,
          owner,
          sellerId,
          draftId,
        );
        expect(review.readiness.reasonCodes).toContain(
          "PUBLICATION_QUOTA_EXCEEDED",
        );
        expect(review.readiness.reasonCodes).toContain("LISTING_RESTRICTED");
        expect(review.readiness.status).toBe("blocked");
      } finally {
        // Preserve fixture audit/records while releasing their active capacity.
        await admin.query(
          "UPDATE treido.listings SET publication='withdrawn' WHERE id=ANY($1::uuid[])",
          [ids],
        );
      }
    });
    it("concurrent equivalent withdrawal persists once and stops public reads/new contact", async () => {
      const { database, admin, owner, other } = get();
      await admin.query(
        "UPDATE treido.category_policies SET state='reviewed',enabled_for_publish=true,review_reference='SYNTHETIC WITHDRAWAL TEST',reviewed_at=now() WHERE category_id='cat:electronics/phones' AND version=1",
      );
      await seedPublishedSnapshot(admin, publishedId);
      expect((await readPublicListingState(database, publishedId)).id).toBe(
        publishedId,
      );
      const input = {
        sellerId,
        listingId: publishedId,
        requestId: retry,
        expectedRevision: 2,
      };
      const [first, second] = await Promise.all([
        withdrawListing(database, owner, input),
        withdrawListing(database, owner, input),
      ]);
      expect(first).toEqual({ revision: 3 });
      expect(second).toEqual(first);
      expect(await withdrawListing(database, owner, input)).toEqual(first);
      await expect(
        withdrawListing(database, owner, { ...input, requestId: randomUUID() }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(
        withdrawListing(database, owner, { ...input, expectedRevision: 3 }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(
        (
          await admin.query(
            "SELECT count(*)::integer AS count FROM treido.listing_withdrawal_receipts WHERE listing_id=$1",
            [publishedId],
          )
        ).rows[0].count,
      ).toBe(1);
      expect(
        (
          await admin.query(
            "SELECT revision,payload->>'title' AS title FROM treido.listing_drafts WHERE listing_id=$1",
            [publishedId],
          )
        ).rows[0],
      ).toEqual({ revision: 3, title: "Собствен телефон" });
      await expect(
        readPublicListingState(database, publishedId),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        openListingConversation(database, other, publishedId),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
    it("draft/foreign withdrawals are denied and accepted receipts are immutable", async () => {
      const { database, owner, other } = get();
      await expect(
        withdrawListing(database, owner, {
          sellerId,
          listingId: draftId,
          requestId: randomUUID(),
          expectedRevision: 1,
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(
        withdrawListing(database, other, {
          sellerId,
          listingId: publishedId,
          requestId: randomUUID(),
          expectedRevision: 2,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        database.pool.query(
          "UPDATE treido.listing_withdrawal_receipts SET accepted_revision=99",
        ),
      ).rejects.toMatchObject({ code: "42501" });
    });
    it("membership revocation also denies reads and equivalent withdrawal retries", async () => {
      const { database, admin, owner, other } = get();
      await admin.query(
        "INSERT INTO treido.seller_memberships(seller_id,user_id,role,grants) VALUES($1,$2,'manager','[]'::jsonb)",
        [sellerId, memberId],
      );
      const input = {
        sellerId,
        listingId: publishedId,
        requestId: randomUUID(),
        expectedRevision: 3,
      };
      expect(await withdrawListing(database, other, input)).toEqual({
        revision: 3,
      });
      await revokeSellerMembership(database, owner, {
        sellerId,
        userId: memberId,
      });
      await expect(
        withdrawListing(database, other, input),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        readPublicationReview(database, other, sellerId, publishedId),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    if (process.env.TREIDO_PUBLICATION_BROWSER_HELPER)
      it("actual saved-review/withdrawal controls over native PostgreSQL (synthetic transport)", async () => {
        const { database, admin, owner, other } = get();
        const helper = await import(
          process.env.TREIDO_PUBLICATION_BROWSER_HELPER!
        );
        const result = await helper.runPublicationBrowserChecks({
          database,
          admin,
          owner,
          other,
          sellerId,
          draftId,
          publishedId,
          api: { readPublicationReview, withdrawListing },
        });
        expect(result.checks).toBeGreaterThanOrEqual(6);
      }, 120000);
  });
}
