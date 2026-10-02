import { seedPublishedSnapshot } from "../../../tests/fixtures/published-listing";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import {
  createBusinessSeller,
  ensurePersonalSeller,
} from "../sellers/persistence.server";
import { createListingDraft, saveListingDraft } from "../selling/drafts.server";
import { emptyDraft } from "../selling/draft-model";
import { readOwnedMedia } from "../selling/media.server";
import { openListingConversation } from "../messaging/participants.server";
import { enqueueJob } from "../../server/jobs/outbox.server";
import {
  authorizeOperator,
  createResourceReport,
  readOwnedReport,
} from "./reports.server";
import {
  moderateListing,
  appealModeration,
  readPublicListingState,
} from "./moderation.server";

export function defineModerationIntegrationCases(
  get: () => {
    database: SellerDatabase;
    admin: Client;
    owner: { subject: string };
    other: { subject: string };
  },
) {
  describe("audited moderation and current operator authority", () => {
    const operator = {
      subject: `user_operator_${randomUUID().replaceAll("-", "")}`,
    };
    let sellerId: string,
      draftId: string,
      listingId: string,
      operatorId: string,
      assetId: string,
      reportId: string,
      actionId: string;
    beforeAll(async () => {
      const { database, admin, owner, other } = get();
      await ensurePersonalSeller(database, operator);
      operatorId = (
        await admin.query(
          "SELECT id FROM treido.users WHERE clerk_subject=$1",
          [operator.subject],
        )
      ).rows[0].id;
      sellerId = await createBusinessSeller(database, owner, {
        name: "Moderation persistence",
        requestId: randomUUID(),
      });
      draftId = (
        await createListingDraft(database, owner, {
          sellerId,
          requestId: randomUUID(),
          payload: {
            ...emptyDraft,
            categoryId: "cat:electronics/phones",
            condition: "good",
          },
        })
      ).id;
      listingId = (
        await createListingDraft(database, owner, {
          sellerId,
          requestId: randomUUID(),
          payload: {
            ...emptyDraft,
            categoryId: "cat:electronics/phones",
            condition: "good",
          },
        })
      ).id;
      const ownerId = (
        await admin.query(
          "SELECT id FROM treido.users WHERE clerk_subject=$1",
          [owner.subject],
        )
      ).rows[0].id;
      assetId = randomUUID();
      const jobId = await inTransaction(database, (tx) =>
        enqueueJob(tx, {
          kind: "media.process",
          sellerId,
          resourceId: assetId,
          operationKey: assetId,
          actorId: ownerId,
          authority: "member",
        }),
      );
      await admin.query(
        `INSERT INTO treido.media_assets(id,seller_id,listing_id,created_by,request_id,input_hash,state,expected_bytes,content_type,expected_checksum,staging_key,immutable_key,source_etag,derivative_key,derivative_checksum,width,height,position,expires_at,job_id)
        VALUES($1,$2,$3,$4,$5,repeat('a',64),'ready',100,'image/jpeg',repeat('a',64),$6,$7,'fixture-etag',$8,repeat('b',64),10,10,0,now()+interval '1 hour',$9)`,
        [
          assetId,
          sellerId,
          draftId,
          ownerId,
          randomUUID(),
          `test/staged/${assetId}`,
          `test/input/${assetId}`,
          `test/ready/${assetId}`,
          jobId,
        ],
      );
      // Owned harness fixture only; actual application policies remain pending.
      await admin.query(
        "UPDATE treido.category_policies SET state='reviewed',enabled_for_publish=true,review_reference='SYNTHETIC MODERATION TEST',reviewed_at=now() WHERE category_id='cat:electronics/phones' AND version=1",
      );
      await seedPublishedSnapshot(admin, listingId);
      reportId = (
        await createResourceReport(database, other, {
          resourceKind: "listing",
          resourceId: listingId,
          requestId: randomUUID(),
          reason: "unsafe",
          details: "Synthetic report for authority checks",
        })
      ).id;
    });
    afterAll(async () => {
      await get().admin.query(
        "UPDATE treido.category_policies SET state='pending',enabled_for_publish=false,review_reference=NULL,reviewed_at=NULL WHERE category_id='cat:electronics/phones' AND version=1",
      );
    });
    it("seller and read-only operator cannot restrict a listing", async () => {
      const { database, admin, owner } = get();
      const input = {
        listingId: draftId,
        requestId: randomUUID(),
        expectedRevision: 1,
        state: "removed",
        reason: "Synthetic decision",
      };
      await expect(
        moderateListing(database, owner, input),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await admin.query(
        "INSERT INTO treido.operator_grants(user_id,capability) VALUES($1,'reports.read')",
        [operatorId],
      );
      await expect(
        moderateListing(database, operator, input),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await admin.query(
        "INSERT INTO treido.operator_grants(user_id,capability) VALUES($1,'moderation.write')",
        [operatorId],
      );
    });
    it("restriction denies private media and draft edits cannot clear it", async () => {
      const { database, admin, owner } = get();
      expect(
        (await readOwnedMedia(database, owner, sellerId, assetId)).key,
      ).toContain("test/ready/");
      await moderateListing(database, operator, {
        listingId: draftId,
        requestId: randomUUID(),
        expectedRevision: 1,
        state: "removed",
        reason: "Synthetic unsafe media decision",
      });
      await expect(
        readOwnedMedia(database, owner, sellerId, assetId),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await saveListingDraft(database, owner, {
        sellerId,
        draftId,
        expectedRevision: 1,
        requestId: randomUUID(),
        payload: {
          ...emptyDraft,
          title: "Edited text",
          categoryId: "cat:electronics/phones",
          condition: "good",
        },
      });
      expect(
        (
          await admin.query(
            "SELECT moderation_state FROM treido.listings WHERE id=$1",
            [draftId],
          )
        ).rows[0].moderation_state,
      ).toBe("removed");
    });
    it("decision, audit and report review commit once; removal denies public state and contact", async () => {
      const { database, other, admin } = get();
      expect((await readPublicListingState(database, listingId)).id).toBe(
        listingId,
      );
      const input = {
        listingId,
        reportId,
        requestId: randomUUID(),
        expectedRevision: 1,
        state: "restricted",
        reason: "Synthetic investigated report",
      };
      const result = await moderateListing(database, operator, input);
      actionId = result.id;
      expect(await moderateListing(database, operator, input)).toEqual(result);
      await expect(
        moderateListing(database, operator, { ...input, reason: "Changed" }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(
        moderateListing(database, operator, {
          ...input,
          requestId: randomUUID(),
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect((await readOwnedReport(database, other, reportId)).state).toBe(
        "reviewed",
      );
      expect(
        (
          await admin.query(
            "SELECT count(*)::integer AS total FROM treido.moderation_actions WHERE listing_id=$1",
            [listingId],
          )
        ).rows[0].total,
      ).toBe(1);
      await expect(
        readPublicListingState(database, listingId),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        openListingConversation(database, other, listingId),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
    it("affected seller and reporter can appeal with retry safety; unrelated operator cannot", async () => {
      const { database, owner, other } = get();
      const input = {
        actionId,
        requestId: randomUUID(),
        details: "Synthetic appeal",
      };
      const receipt = await appealModeration(database, owner, input);
      expect(await appealModeration(database, owner, input)).toEqual(receipt);
      await appealModeration(database, other, {
        ...input,
        requestId: randomUUID(),
      });
      await expect(
        appealModeration(database, operator, {
          ...input,
          requestId: randomUUID(),
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        appealModeration(database, owner, { ...input, details: "Changed" }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(
        database.pool.query(
          "UPDATE treido.moderation_actions SET reason='rewrite'",
        ),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        database.pool.query("DELETE FROM treido.moderation_appeals"),
      ).rejects.toMatchObject({ code: "42501" });
    });
    it("a racing reused operator retry key cannot mutate two different listings", async () => {
      const { database, admin, owner } = get();
      const ids: string[] = [];
      for (let count = 0; count < 2; count++)
        ids.push(
          (
            await createListingDraft(database, owner, {
              sellerId,
              requestId: randomUUID(),
              payload: emptyDraft,
            })
          ).id,
        );
      const requestId = randomUUID();
      const results = await Promise.allSettled(
        ids.map((id) =>
          moderateListing(database, operator, {
            listingId: id,
            requestId,
            expectedRevision: 1,
            state: "restricted",
            reason: "Synthetic competing retry",
          }),
        ),
      );
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        results.find((result) => result.status === "rejected"),
      ).toMatchObject({ status: "rejected", reason: { code: "CONFLICT" } });
      expect(
        (
          await admin.query(
            "SELECT count(*)::integer AS count FROM treido.listings WHERE id=ANY($1::uuid[]) AND moderation_state='restricted'",
            [ids],
          )
        ).rows[0].count,
      ).toBe(1);
    });
    it("operator revocation waits for an authorized transaction and denies the next command", async () => {
      const { database, admin } = get();
      let release!: () => void, entered!: () => void;
      const enteredPromise = new Promise<void>((done) => {
        entered = done;
      });
      const hold = new Promise<void>((done) => {
        release = done;
      });
      const locked = inTransaction(database, async (tx) => {
        await authorizeOperator(tx, operator, "moderation.write");
        entered();
        await hold;
      });
      await enteredPromise;
      const pid = (await admin.query("SELECT pg_backend_pid() AS pid")).rows[0]
        .pid;
      const revoke = admin.query(
        "UPDATE treido.operator_grants SET active=false,revision=revision+1 WHERE user_id=$1 AND capability='moderation.write'",
        [operatorId],
      );
      try {
        await expect
          .poll(async () =>
            Number(
              (
                await database.pool.query(
                  "SELECT count(*) AS total FROM pg_locks WHERE pid=$1 AND NOT granted",
                  [pid],
                )
              ).rows[0].total,
            ),
          )
          .toBeGreaterThan(0);
      } finally {
        release();
      }
      await locked;
      await revoke;
      await expect(
        moderateListing(database, operator, {
          listingId,
          requestId: randomUUID(),
          expectedRevision: 2,
          state: "clear",
          reason: "Denied after revocation",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    if (process.env.TREIDO_OPERATOR_BROWSER_HELPER)
      it("actual operator form over native PostgreSQL (synthetic identity and action transport)", async () => {
        const { database, admin, other } = get();
        await admin.query(
          "UPDATE treido.operator_grants SET active=true WHERE user_id=$1",
          [operatorId],
        );
        const current = (
          await admin.query(
            "SELECT moderation_revision FROM treido.listings WHERE id=$1",
            [listingId],
          )
        ).rows[0].moderation_revision;
        await moderateListing(database, operator, {
          listingId,
          reportId: null,
          requestId: randomUUID(),
          expectedRevision: current,
          state: "clear",
          reason: "Synthetic browser setup",
        });
        const browserReport = await createResourceReport(database, other, {
          resourceKind: "listing",
          resourceId: listingId,
          requestId: randomUUID(),
          reason: "unsafe",
          details: "Synthetic browser report",
        });
        const helper = await import(
          process.env.TREIDO_OPERATOR_BROWSER_HELPER!
        );
        const result = await helper.runOperatorBrowserChecks({
          database,
          admin,
          operator,
          other,
          listingId,
          reportId: browserReport.id,
          sellerId,
          api: { moderateListing, createResourceReport },
        });
        expect(result.checks).toBeGreaterThanOrEqual(5);
      }, 120000);
  });
}
