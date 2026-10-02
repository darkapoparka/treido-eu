import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import type { SellerDatabase } from "../../server/db/database";
import { createPublicationFixture } from "../../../tests/fixtures/publication-flow";
import { publishListing } from "./publish.server";
import { readPublicationReview, withdrawListing } from "./publication.server";
import {
  readPublishedListing,
  readPublishedPhoto,
  readPublicMedia,
} from "../catalog/published.server";
import { readListingDraft, saveListingDraft } from "./drafts.server";
import {
  openListingConversation,
  sendConversationMessage,
  readConversationMessages,
} from "../messaging/participants.server";
import { createResourceReport, readOwnedReport } from "../trust/reports.server";
import {
  readConversation,
  markConversationRead,
} from "../messaging/inbox.server";
import {
  ensurePersonalSeller,
  revokeSellerMembership,
} from "../sellers/persistence.server";
export function definePublishIntegrationCases(
  get: () => {
    database: SellerDatabase;
    admin: Client;
    owner: { subject: string };
    other: { subject: string };
  },
) {
  describe("accepted publication to public detail and durable contact", () => {
    beforeAll(async () => {
      await get().admin.query(
        "UPDATE treido.category_policies SET state='reviewed',enabled_for_publish=true,review_reference='SYNTHETIC PUBLICATION TEST ONLY',reviewed_at=now() WHERE category_id='cat:electronics/phones' AND version=1",
      );
    });
    afterAll(async () => {
      await get().admin.query(
        "UPDATE treido.category_policies SET state='pending',enabled_for_publish=false,review_reference=NULL,reviewed_at=NULL WHERE category_id='cat:electronics/phones' AND version=1",
      );
    });
    it("publishes processed media once, renders only approved public fields and opens real contact", async () => {
      const ctx = get(),
        f = await createPublicationFixture(ctx);
      expect(
        (
          await readPublicationReview(
            ctx.database,
            ctx.owner,
            f.sellerId,
            f.draft.id,
          )
        ).canPublish,
      ).toBe(true);
      expect(await readPublishedListing(ctx.database, f.draft.id)).toBeNull();
      const results = await Promise.all([
        publishListing(ctx.database, ctx.owner, f.input),
        publishListing(ctx.database, ctx.owner, f.input),
      ]);
      expect(results[0]).toEqual(results[1]);
      expect(results[0].revision).toBe(2);
      const listing = await readPublishedListing(ctx.database, f.draft.id);
      expect(listing?.title).toBe("Телефон за тест");
      expect(listing?.photos).toHaveLength(1);
      expect(listing?.purchaseMode).toBe("contact");
      expect(JSON.stringify(listing)).not.toMatch(
        /private@example|PRIVATE TEST ADDRESS|derivative|clerk|objectKey|photoRights/,
      );
      const bytes = await readPublishedPhoto(
        ctx.database,
        f.storage,
        f.draft.id,
        f.assetId,
        2,
      );
      expect(bytes.subarray(0, 4).toString()).toBe("RIFF");
      const thread = await openListingConversation(
        ctx.database,
        ctx.other,
        f.draft.id,
      );
      await sendConversationMessage(ctx.database, ctx.other, {
        threadId: thread.id,
        requestId: randomUUID(),
        body: "Още ли е наличен?",
      });
      expect(
        (await readConversationMessages(ctx.database, ctx.owner, thread.id))[0]
          .body,
      ).toBe("Още ли е наличен?");
      const report = await createResourceReport(ctx.database, ctx.other, {
        resourceKind: "listing",
        resourceId: f.draft.id,
        requestId: randomUUID(),
        reason: "other",
        details: "Test report",
      });
      expect(
        (await readOwnedReport(ctx.database, ctx.other, report.id)).state,
      ).toBe("open");
      expect(
        (
          await ctx.admin.query(
            "SELECT count(*)::int AS n FROM treido.listing_publications WHERE listing_id=$1",
            [f.draft.id],
          )
        ).rows[0].n,
      ).toBe(1);
    });
    it("withdraws immediately, preserves history, allows revisioned edits and republishes without reviving old receipts", async () => {
      const ctx = get(),
        f = await createPublicationFixture(ctx);
      await publishListing(ctx.database, ctx.owner, f.input);
      const thread = await openListingConversation(
        ctx.database,
        ctx.other,
        f.draft.id,
      );
      await sendConversationMessage(ctx.database, ctx.other, {
        threadId: thread.id,
        requestId: randomUUID(),
        body: "Existing history",
      });
      await expect(
        saveListingDraft(ctx.database, ctx.owner, {
          sellerId: f.sellerId,
          draftId: f.draft.id,
          expectedRevision: 2,
          requestId: randomUUID(),
          payload: (
            await readListingDraft(
              ctx.database,
              ctx.owner,
              f.sellerId,
              f.draft.id,
            )
          ).payload,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      const withdrawn = await withdrawListing(ctx.database, ctx.owner, {
        sellerId: f.sellerId,
        listingId: f.draft.id,
        expectedRevision: 2,
        requestId: randomUUID(),
      });
      expect(withdrawn.revision).toBe(3);
      expect(await readPublishedListing(ctx.database, f.draft.id)).toBeNull();
      await expect(
        readPublishedPhoto(ctx.database, f.storage, f.draft.id, f.assetId, 2),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        openListingConversation(ctx.database, ctx.other, f.draft.id),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(
        await readConversationMessages(ctx.database, ctx.other, thread.id),
      ).toHaveLength(1);
      await expect(
        publishListing(ctx.database, ctx.owner, f.input),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      const draft = await readListingDraft(
        ctx.database,
        ctx.owner,
        f.sellerId,
        f.draft.id,
      );
      const saved = await saveListingDraft(ctx.database, ctx.owner, {
        sellerId: f.sellerId,
        draftId: f.draft.id,
        expectedRevision: 3,
        requestId: randomUUID(),
        payload: {
          ...draft.payload,
          title: "Обновена обява",
          priceMinor: 11900,
        },
      });
      const republished = await publishListing(ctx.database, ctx.owner, {
        ...f.input,
        requestId: randomUUID(),
        expectedRevision: saved.revision,
      });
      expect(republished.revision).toBe(5);
      expect(
        (await readPublishedListing(ctx.database, f.draft.id))?.price.amount,
      ).toBe(11900);
      expect(
        (
          await ctx.admin.query(
            "SELECT payload->>'title' AS title FROM treido.listing_publications WHERE listing_id=$1 AND revision=2",
            [f.draft.id],
          )
        ).rows[0].title,
      ).toBe("Телефон за тест");
      await expect(
        readPublicMedia(ctx.database, f.draft.id, f.assetId, 2),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
    it("supports personal publication without creating a business declaration and requires a personal-sale acknowledgement", async () => {
      const ctx = get(),
        owner = {
          subject: "user_personal_publish_" + randomUUID().replaceAll("-", ""),
        },
        f = await createPublicationFixture({ ...ctx, owner }, "personal");
      await expect(
        publishListing(ctx.database, owner, {
          ...f.input,
          terms: { ...f.input.terms, personalSale: false },
        }),
      ).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
      await publishListing(ctx.database, owner, f.input);
      expect(
        (await readPublishedListing(ctx.database, f.draft.id))?.seller.kind,
      ).toBe("personal");
      expect(
        (
          await ctx.admin.query(
            "SELECT count(*)::int AS n FROM treido.seller_declarations WHERE seller_id=$1",
            [f.sellerId],
          )
        ).rows[0].n,
      ).toBe(0);
    });
    it("rejects stale item/photo revisions, changed retry input, forged acknowledgements and foreign ownership", async () => {
      const ctx = get(),
        f = await createPublicationFixture(ctx);
      await expect(
        publishListing(ctx.database, ctx.other, f.input),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        publishListing(ctx.database, ctx.owner, {
          ...f.input,
          expectedRevision: 9,
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(
        publishListing(ctx.database, ctx.owner, {
          ...f.input,
          media: [{ id: f.assetId, revision: 99 }],
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(
        publishListing(ctx.database, ctx.owner, {
          ...f.input,
          terms: { ...f.input.terms, photoRights: false },
        }),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
      await publishListing(ctx.database, ctx.owner, f.input);
      await expect(
        publishListing(ctx.database, ctx.owner, {
          ...f.input,
          terms: { ...f.input.terms, defects: "Different" },
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });
    it("admits only one simultaneous publisher for the last active slot", async () => {
      const ctx = get(),
        first = await createPublicationFixture(ctx),
        second = await createPublicationFixture(
          ctx,
          "business",
          first.sellerId,
        );
      await ctx.admin.query(
        "INSERT INTO treido.listings(id,seller_id,publication,moderation_state) SELECT gen_random_uuid(),$1,'published','restricted' FROM generate_series(1,99)",
        [first.sellerId],
      );
      const pair = await Promise.allSettled([
        publishListing(ctx.database, ctx.owner, first.input),
        publishListing(ctx.database, ctx.owner, second.input),
      ]);
      expect(pair.filter((x) => x.status === "fulfilled")).toHaveLength(1);
      expect(
        pair.filter((x) => x.status === "rejected").map((x) => x.reason.code),
      ).toEqual(["QUOTA_EXCEEDED"]);
    });
    it("revoked staff cannot publish or replay an acknowledged publication", async () => {
      const ctx = get(),
        f = await createPublicationFixture(ctx);
      await ensurePersonalSeller(ctx.database, ctx.other);
      const user = (
        await ctx.admin.query(
          "SELECT id FROM treido.users WHERE clerk_subject=$1",
          [ctx.other.subject],
        )
      ).rows[0].id;
      await ctx.admin.query(
        "INSERT INTO treido.seller_memberships(seller_id,user_id,role,grants) VALUES($1,$2,'manager','[]')",
        [f.sellerId, user],
      );
      await publishListing(ctx.database, ctx.other, f.input);
      await revokeSellerMembership(ctx.database, ctx.owner, {
        sellerId: f.sellerId,
        userId: user,
      });
      await expect(
        publishListing(ctx.database, ctx.other, f.input),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it("policy/declaration changes and moderation remove public content and new contact without deleting messages", async () => {
      const ctx = get(),
        f = await createPublicationFixture(ctx);
      await publishListing(ctx.database, ctx.owner, f.input);
      await ctx.admin.query(
        "UPDATE treido.listings SET moderation_state='removed' WHERE id=$1",
        [f.draft.id],
      );
      expect(await readPublishedListing(ctx.database, f.draft.id)).toBeNull();
      await expect(
        openListingConversation(ctx.database, ctx.other, f.draft.id),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await ctx.admin.query(
        "UPDATE treido.listings SET moderation_state='clear' WHERE id=$1",
        [f.draft.id],
      );
      await ctx.admin.query(
        "UPDATE treido.seller_declarations SET status='rejected' WHERE seller_id=$1",
        [f.sellerId],
      );
      expect(await readPublishedListing(ctx.database, f.draft.id)).toBeNull();
      await ctx.admin.query(
        "UPDATE treido.seller_declarations SET status='accepted' WHERE seller_id=$1",
        [f.sellerId],
      );
      try {
        await ctx.admin.query(
          "UPDATE treido.category_policies SET enabled_for_publish=false WHERE category_id='cat:electronics/phones'",
        );
        expect(await readPublishedListing(ctx.database, f.draft.id)).toBeNull();
        await expect(
          openListingConversation(ctx.database, ctx.other, f.draft.id),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
      } finally {
        await ctx.admin.query(
          "UPDATE treido.category_policies SET enabled_for_publish=true WHERE category_id='cat:electronics/phones' AND version=1",
        );
      }
    });
    it("rejects corrupted bytes and rechecks withdrawal after the object read", async () => {
      const ctx = get(),
        f = await createPublicationFixture(ctx);
      await publishListing(ctx.database, ctx.owner, f.input);
      await expect(
        readPublishedPhoto(
          ctx.database,
          { read: async () => Buffer.from("wrong bytes") },
          f.draft.id,
          f.assetId,
          2,
        ),
      ).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
      await expect(
        readPublishedPhoto(
          ctx.database,
          {
            read: async (key, max) => {
              const bytes = await f.storage.read(key, max);
              await withdrawListing(ctx.database, ctx.owner, {
                sellerId: f.sellerId,
                listingId: f.draft.id,
                requestId: randomUUID(),
                expectedRevision: 2,
              });
              return bytes;
            },
          },
          f.draft.id,
          f.assetId,
          2,
        ),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
    it("prevents runtime rewriting snapshots, gallery membership or policy approval", async () => {
      const ctx = get();
      for (const sql of [
        "UPDATE treido.listing_publications SET payload='{}'",
        "DELETE FROM treido.listing_publication_media",
        "UPDATE treido.category_policies SET enabled_for_publish=true",
      ])
        await expect(ctx.database.pool.query(sql)).rejects.toMatchObject({
          code: "42501",
        });
    });
    if (process.env.TREIDO_PUBLISH_FLOW_BROWSER_HELPER)
      it("actual publication form, public photo and contact components with native PostgreSQL", async () => {
        const helper = await import(
          process.env.TREIDO_PUBLISH_FLOW_BROWSER_HELPER!
        );
        const ctx = get(),
          fixture = await createPublicationFixture(ctx);
        const result = await helper.runPublishFlowBrowserChecks({
          ...ctx,
          fixture,
          api: {
            publishListing,
            readPublicationReview,
            withdrawListing,
            readPublishedListing,
            readPublishedPhoto,
            openListingConversation,
            sendConversationMessage,
            readConversationMessages,
            readConversation,
            markConversationRead,
          },
        });
        expect(result.checks).toBeGreaterThanOrEqual(8);
      }, 180000);
  });
}
