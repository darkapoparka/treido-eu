import { seedPublishedSnapshot } from "../../../tests/fixtures/published-listing";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import type { SellerDatabase } from "../../server/db/database";
import {
  createBusinessSeller,
  ensurePersonalSeller,
  revokeSellerMembership,
} from "../sellers/persistence.server";
import { createListingDraft } from "../selling/drafts.server";
import { emptyDraft } from "../selling/draft-model";
import {
  openListingConversation,
  sendConversationMessage,
} from "./participants.server";
import {
  readInbox,
  readConversation,
  markConversationRead,
  setContactBlocked,
} from "./inbox.server";
import { createResourceReport } from "../trust/reports.server";
import { moderateListing, appealModeration } from "../trust/moderation.server";
import {
  listOwnReports,
  readReportDetail,
  readSellerDecisions,
} from "../trust/report-views.server";
export function defineInboxIntegrationCases(
  get: () => {
    database: SellerDatabase;
    admin: Client;
    owner: { subject: string };
    other: { subject: string };
  },
) {
  const buyerScope = { sellerId: null };
  async function fixture(title = "Телефон 100%_ " + randomUUID()) {
    const { database, admin, owner, other } = get();
    const sellerId = await createBusinessSeller(database, owner, {
      name: "Inbox " + randomUUID().slice(0, 8),
      requestId: randomUUID(),
    });
    const ids: string[] = [];
    for (const item of [title, title + " second"]) {
      const draft = await createListingDraft(database, owner, {
        sellerId,
        requestId: randomUUID(),
        payload: {
          ...emptyDraft,
          title: item,
          categoryId: "cat:electronics/phones",
          condition: "good",
        },
      });
      ids.push(draft.id);
    }
    // Synthetic published supply exists only in this isolated database fixture.
    for (const id of ids) await seedPublishedSnapshot(admin, id);
    const threadId = (await openListingConversation(database, other, ids[0]))
      .id;
    return {
      sellerId,
      listingId: ids[0],
      secondListingId: ids[1],
      threadId,
      title,
    };
  }
  describe("durable buyer and seller inboxes", () => {
    beforeAll(async () => {
      await get().admin.query(
        "UPDATE treido.category_policies SET state='reviewed',enabled_for_publish=true,review_reference='SYNTHETIC INBOX TEST',reviewed_at=now() WHERE category_id='cat:electronics/phones' AND version=1",
      );
    });
    afterAll(async () => {
      await get().admin.query(
        "UPDATE treido.category_policies SET state='pending',enabled_for_publish=false,review_reference=NULL,reviewed_at=NULL WHERE category_id='cat:electronics/phones' AND version=1",
      );
    });
    it("keeps public browse choices and operating accounts separate; new-buyer GET creates nothing", async () => {
      const { database, admin, owner, other } = get(),
        f = await fixture();
      const stranger = {
        subject: "user_inbox_new_" + randomUUID().replaceAll("-", ""),
      };
      expect(
        (await readInbox(database, stranger, { sellerId: null })).items,
      ).toEqual([]);
      expect(
        (
          await admin.query(
            "SELECT id FROM treido.users WHERE clerk_subject=$1",
            [stranger.subject],
          )
        ).rowCount,
      ).toBe(0);
      expect(
        (
          await readConversation(database, other, {
            ...buyerScope,
            threadId: f.threadId,
          })
        ).side,
      ).toBe("buyer");
      expect(
        (
          await readConversation(database, owner, {
            sellerId: f.sellerId,
            threadId: f.threadId,
          })
        ).side,
      ).toBe("seller");
      await expect(
        readConversation(database, owner, {
          ...buyerScope,
          threadId: f.threadId,
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        readConversation(database, other, {
          sellerId: f.sellerId,
          threadId: f.threadId,
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      const second = await createBusinessSeller(database, owner, {
        name: "Separate business",
        requestId: randomUUID(),
      });
      expect(
        (await readInbox(database, owner, { sellerId: second })).items,
      ).toEqual([]);
      await expect(
        readConversation(database, owner, {
          sellerId: second,
          threadId: f.threadId,
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
    it("commits one message and one content-free notification intent through concurrent retries", async () => {
      const { database, admin, owner, other } = get(),
        f = await fixture();
      const command = {
        threadId: f.threadId,
        requestId: randomUUID(),
        body: "<b>Здравейте</b>",
      };
      const results = await Promise.all([
        sendConversationMessage(database, other, command, buyerScope),
        sendConversationMessage(database, other, command, buyerScope),
      ]);
      expect(results[0]).toEqual(results[1]);
      expect(
        (
          await admin.query(
            "SELECT count(*)::int AS count FROM treido.message_notification_intents WHERE message_id=$1",
            [results[0].id],
          )
        ).rows[0].count,
      ).toBe(1);
      const view = await readConversation(database, owner, {
        sellerId: f.sellerId,
        threadId: f.threadId,
      });
      expect(view.messages[0]).toMatchObject({
        body: command.body,
        from: "buyer",
        mine: false,
        sequence: 1,
      });
      expect(JSON.stringify(view)).not.toContain("clerk_subject");
      expect(JSON.stringify(view)).not.toContain("authorId");
      await expect(
        sendConversationMessage(
          database,
          other,
          { ...command, body: "changed" },
          buyerScope,
        ),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });
    it("tracks unread per human, never moves a read cursor backwards, and rejects future acknowledgements", async () => {
      const { database, owner, other } = get(),
        f = await fixture();
      for (const body of ["one", "two"])
        await sendConversationMessage(
          database,
          other,
          { threadId: f.threadId, body, requestId: randomUUID() },
          buyerScope,
        );
      const scoped = { sellerId: f.sellerId, threadId: f.threadId };
      expect(
        (
          await readInbox(database, owner, {
            sellerId: f.sellerId,
            filter: "unread",
          })
        ).items[0].unread,
      ).toBe(2);
      expect(
        await markConversationRead(database, owner, { ...scoped, sequence: 2 }),
      ).toEqual({ sequence: 2 });
      expect(
        await markConversationRead(database, owner, { ...scoped, sequence: 1 }),
      ).toEqual({ sequence: 2 });
      expect(
        (
          await readInbox(database, owner, {
            sellerId: f.sellerId,
            filter: "unread",
          })
        ).items,
      ).toEqual([]);
      await expect(
        markConversationRead(database, owner, { ...scoped, sequence: 3 }),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
      await sendConversationMessage(
        database,
        owner,
        { threadId: f.threadId, body: "reply", requestId: randomUUID() },
        { sellerId: f.sellerId },
      );
      expect(
        (
          await readInbox(database, other, { sellerId: null, q: f.title })
        ).items.find((row) => row.id === f.threadId)?.unread,
      ).toBe(1);
    });
    it("enforces both contact blocks across all listings and only lets each party remove its own", async () => {
      const { database, owner, other } = get(),
        f = await fixture();
      const secondThread = (
        await openListingConversation(database, other, f.secondListingId)
      ).id;
      const buyerCommand = {
        sellerId: null,
        threadId: f.threadId,
        blocked: true,
        requestId: randomUUID(),
        expectedRevision: 1,
      };
      expect(await setContactBlocked(database, other, buyerCommand)).toEqual({
        revision: 2,
      });
      expect(await setContactBlocked(database, other, buyerCommand)).toEqual({
        revision: 2,
      });
      await expect(
        openListingConversation(database, other, f.secondListingId),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        sendConversationMessage(
          database,
          owner,
          { threadId: secondThread, body: "blocked", requestId: randomUUID() },
          { sellerId: f.sellerId },
        ),
      ).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
      await setContactBlocked(database, owner, {
        sellerId: f.sellerId,
        threadId: f.threadId,
        blocked: true,
        requestId: randomUUID(),
        expectedRevision: 2,
      });
      await setContactBlocked(database, other, {
        ...buyerCommand,
        blocked: false,
        requestId: randomUUID(),
        expectedRevision: 3,
      });
      expect(
        await readConversation(database, other, {
          sellerId: null,
          threadId: secondThread,
        }),
      ).toMatchObject({
        blockedByYou: false,
        blockedByOther: true,
        canReply: false,
      });
      await expect(
        setContactBlocked(database, other, buyerCommand),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await setContactBlocked(database, owner, {
        sellerId: f.sellerId,
        threadId: f.threadId,
        blocked: false,
        requestId: randomUUID(),
        expectedRevision: 4,
      });
      expect(
        (
          await readConversation(database, other, {
            sellerId: null,
            threadId: secondThread,
          })
        ).canReply,
      ).toBe(true);
    });
    it("rechecks staff capabilities, revocation and buyer-to-staff transitions", async () => {
      const { database, admin, owner, other } = get(),
        f = await fixture();
      const staff = {
        subject: "user_inbox_staff_" + randomUUID().replaceAll("-", ""),
      };
      await ensurePersonalSeller(database, staff);
      const staffId = (
        await admin.query(
          "SELECT id FROM treido.users WHERE clerk_subject=$1",
          [staff.subject],
        )
      ).rows[0].id;
      await admin.query(
        "INSERT INTO treido.seller_memberships(seller_id,user_id,role,grants) VALUES($1,$2,'member',$3::jsonb)",
        [f.sellerId, staffId, JSON.stringify(["inbox.read"])],
      );
      expect(
        (
          await readConversation(database, staff, {
            sellerId: f.sellerId,
            threadId: f.threadId,
          })
        ).canReply,
      ).toBe(false);
      await expect(
        setContactBlocked(database, staff, {
          sellerId: f.sellerId,
          threadId: f.threadId,
          blocked: true,
          expectedRevision: 1,
          requestId: randomUUID(),
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await admin.query(
        "UPDATE treido.seller_memberships SET grants=$3::jsonb WHERE seller_id=$1 AND user_id=$2",
        [f.sellerId, staffId, JSON.stringify(["inbox.read", "inbox.reply"])],
      );
      const command = {
        threadId: f.threadId,
        body: "staff",
        requestId: randomUUID(),
      };
      await sendConversationMessage(database, staff, command, {
        sellerId: f.sellerId,
      });
      await revokeSellerMembership(database, owner, {
        sellerId: f.sellerId,
        userId: staffId,
      });
      await expect(
        readInbox(database, staff, { sellerId: f.sellerId }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        sendConversationMessage(database, staff, command, {
          sellerId: f.sellerId,
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      const buyerId = (
        await admin.query(
          "SELECT id FROM treido.users WHERE clerk_subject=$1",
          [other.subject],
        )
      ).rows[0].id;
      await admin.query(
        "INSERT INTO treido.seller_memberships(seller_id,user_id,role,grants) VALUES($1,$2,'manager','[]')",
        [f.sellerId, buyerId],
      );
      expect(
        (
          await readConversation(database, other, {
            sellerId: null,
            threadId: f.threadId,
          })
        ).canReply,
      ).toBe(false);
      expect(
        (await readInbox(database, other, { sellerId: f.sellerId })).items,
      ).toEqual([]);
      await expect(
        readConversation(database, other, {
          sellerId: f.sellerId,
          threadId: f.threadId,
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
    it("paginates tied microsecond inbox timestamps and treats percent/underscore search literally", async () => {
      const { database, admin, owner, other } = get(),
        f = await fixture();
      for (let i = 0; i < 32; i++) {
        const draft = await createListingDraft(database, owner, {
          sellerId: f.sellerId,
          requestId: randomUUID(),
          payload: {
            ...emptyDraft,
            categoryId: "cat:electronics/phones",
            title: "Row " + i,
          },
        });
        await seedPublishedSnapshot(admin, draft.id);
        await openListingConversation(database, other, draft.id);
      }
      await admin.query(
        "UPDATE treido.conversation_threads SET last_message_at='2026-10-02T12:00:00.123456Z' WHERE seller_id=$1",
        [f.sellerId],
      );
      const first = await readInbox(database, owner, { sellerId: f.sellerId });
      expect(first.items).toHaveLength(30);
      expect(first.nextCursor).not.toBeNull();
      const second = await readInbox(database, owner, {
        sellerId: f.sellerId,
        cursor: first.nextCursor,
      });
      expect(second.items).toHaveLength(3);
      expect(
        new Set([...first.items, ...second.items].map((row) => row.id)).size,
      ).toBe(33);
      expect(
        (await readInbox(database, owner, { sellerId: f.sellerId, q: "%_" }))
          .items,
      ).toHaveLength(1);
      await expect(
        readInbox(database, owner, {
          sellerId: f.sellerId,
          q: "changed",
          cursor: first.nextCursor,
        }),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    });
    it("bounds message history, enforces the sending limit and retains history after withdrawal/removal", async () => {
      const { database, admin, owner, other } = get(),
        f = await fixture();
      for (let i = 0; i < 30; i++)
        await sendConversationMessage(
          database,
          other,
          {
            threadId: f.threadId,
            body: "message " + i,
            requestId: randomUUID(),
          },
          buyerScope,
        );
      await expect(
        sendConversationMessage(
          database,
          other,
          { threadId: f.threadId, body: "too fast", requestId: randomUUID() },
          buyerScope,
        ),
      ).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" });
      for (let i = 0; i < 25; i++)
        await sendConversationMessage(
          database,
          owner,
          { threadId: f.threadId, body: "reply " + i, requestId: randomUUID() },
          { sellerId: f.sellerId },
        );
      const recent = await readConversation(database, other, {
        sellerId: null,
        threadId: f.threadId,
      });
      expect(recent.messages).toHaveLength(50);
      expect(recent.messages[0].sequence).toBe(6);
      const older = await readConversation(database, other, {
        sellerId: null,
        threadId: f.threadId,
        before: recent.olderBefore,
      });
      expect(older.messages.map((m) => m.sequence)).toEqual([1, 2, 3, 4, 5]);
      await admin.query(
        "UPDATE treido.listings SET publication='withdrawn',moderation_state='removed' WHERE id=$1",
        [f.listingId],
      );
      expect(
        await readConversation(database, other, {
          sellerId: null,
          threadId: f.threadId,
        }),
      ).toMatchObject({ title: null, canReply: false });
      await expect(
        sendConversationMessage(
          database,
          owner,
          { threadId: f.threadId, body: "no", requestId: randomUUID() },
          { sellerId: f.sellerId },
        ),
      ).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
    });
    it("keeps report receipts private and supports actual affected-party appeals without lifting restrictions", async () => {
      const { database, admin, owner, other } = get(),
        f = await fixture();
      const input = {
        resourceKind: "listing" as const,
        resourceId: f.listingId,
        reason: "misleading",
        details: "Actual isolated report",
        requestId: randomUUID(),
      };
      const report = await createResourceReport(database, other, input);
      expect(await createResourceReport(database, other, input)).toEqual(
        report,
      );
      expect(
        (await listOwnReports(database, other)).items.some(
          (r) => r.id === report.id,
        ),
      ).toBe(true);
      await expect(
        readReportDetail(database, owner, report.id),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      const operator = {
        subject: "user_inbox_operator_" + randomUUID().replaceAll("-", ""),
      };
      await ensurePersonalSeller(database, operator);
      const operatorId = (
        await admin.query(
          "SELECT id FROM treido.users WHERE clerk_subject=$1",
          [operator.subject],
        )
      ).rows[0].id;
      await admin.query(
        "INSERT INTO treido.operator_grants(user_id,capability) VALUES($1,'reports.read'),($1,'moderation.write')",
        [operatorId],
      );
      const decision = await moderateListing(database, operator, {
        listingId: f.listingId,
        reportId: report.id,
        expectedRevision: 1,
        state: "restricted",
        reason: "Synthetic review decision",
        requestId: randomUUID(),
      });
      const appealInput = {
        actionId: decision.id,
        requestId: randomUUID(),
        details: "Please review this decision.",
      };
      const appeal = await appealModeration(database, owner, appealInput);
      expect(await appealModeration(database, owner, appealInput)).toEqual(
        appeal,
      );
      const sellerDecisions = await readSellerDecisions(
        database,
        owner,
        f.sellerId,
        f.listingId,
      );
      expect(sellerDecisions[0].appeals[0].id).toBe(appeal.id);
      expect(JSON.stringify(sellerDecisions)).not.toContain("reporterId");
      const ownReceipt = await readReportDetail(database, other, report.id);
      expect(ownReceipt.report.state).toBe("reviewed");
      expect(ownReceipt.decisions[0].appeals).toEqual([]);
      expect(
        (
          await admin.query(
            "SELECT moderation_state FROM treido.listings WHERE id=$1",
            [f.listingId],
          )
        ).rows[0].moderation_state,
      ).toBe("restricted");
    });
    it("prevents runtime rewriting accepted notification/contact receipts", async () => {
      const { database } = get();
      for (const table of [
        "message_notification_intents",
        "contact_preference_receipts",
      ])
        await expect(
          database.pool.query(
            "UPDATE treido." + table + " SET created_at=now() WHERE false",
          ),
        ).rejects.toMatchObject({ code: "42501" });
    });
  });
}
