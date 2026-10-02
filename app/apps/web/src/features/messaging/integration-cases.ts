import { seedPublishedSnapshot } from "../../../tests/fixtures/published-listing";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import type { SellerDatabase } from "../../server/db/database";
import {
  createBusinessSeller,
  ensurePersonalSeller,
} from "../sellers/persistence.server";
import { createListingDraft } from "../selling/drafts.server";
import { emptyDraft } from "../selling/draft-model";
import {
  openListingConversation,
  sendConversationMessage,
  readConversationMessages,
  readParticipantAttachment,
} from "./participants.server";
import {
  createResourceReport,
  readOwnedReport,
  readOperatorReports,
} from "../trust/reports.server";

export function defineParticipantIntegrationCases(
  get: () => {
    database: SellerDatabase;
    admin: Client;
    owner: { subject: string };
    other: { subject: string };
  },
) {
  describe("private participants and explicit operator grants", () => {
    let sellerId: string,
      listingId: string,
      threadId: string,
      staffId: string,
      intruderId: string;
    const staff = { subject: `user_staff_${randomUUID().replaceAll("-", "")}` };
    const intruder = {
      subject: `user_intruder_${randomUUID().replaceAll("-", "")}`,
    };
    beforeAll(async () => {
      const { database, admin, owner, other } = get();
      sellerId = await createBusinessSeller(database, owner, {
        name: "Participant isolation",
        requestId: randomUUID(),
      });
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
      await ensurePersonalSeller(database, staff);
      await ensurePersonalSeller(database, intruder);
      staffId = (
        await admin.query(
          "SELECT id FROM treido.users WHERE clerk_subject=$1",
          [staff.subject],
        )
      ).rows[0].id;
      intruderId = (
        await admin.query(
          "SELECT id FROM treido.users WHERE clerk_subject=$1",
          [intruder.subject],
        )
      ).rows[0].id;
      await expect(
        openListingConversation(database, other, listingId),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      // Explicit synthetic fixture only; no publication/approval API is bypassed in the app.
      await admin.query(
        "UPDATE treido.category_policies SET state='reviewed',enabled_for_publish=true,review_reference='SYNTHETIC PARTICIPANT TEST',reviewed_at=now() WHERE category_id='cat:electronics/phones' AND version=1",
      );
      await seedPublishedSnapshot(admin, listingId);
      threadId = (await openListingConversation(database, other, listingId)).id;
    });
    afterAll(async () => {
      await get().admin.query(
        "UPDATE treido.category_policies SET state='pending',enabled_for_publish=false,review_reference=NULL,reviewed_at=NULL WHERE category_id='cat:electronics/phones' AND version=1",
      );
    });
    it("reuses the participant/listing thread, rejects self-contact and foreign readers", async () => {
      const { database, owner, other } = get();
      expect(
        (await openListingConversation(database, other, listingId)).id,
      ).toBe(threadId);
      await expect(
        openListingConversation(database, owner, listingId),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        readConversationMessages(database, intruder, threadId),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
    it("persists plain text before acknowledging, deduplicates and orders concurrent messages", async () => {
      const { database, other, owner } = get();
      const input = {
        threadId,
        requestId: randomUUID(),
        body: "<b>Здравейте</b>",
      };
      const sent = await sendConversationMessage(database, other, input);
      expect(await sendConversationMessage(database, other, input)).toEqual(
        sent,
      );
      await expect(
        sendConversationMessage(database, other, { ...input, body: "Changed" }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      const pair = await Promise.all(
        ["one", "two"].map((body) =>
          sendConversationMessage(database, other, {
            threadId,
            requestId: randomUUID(),
            body,
          }),
        ),
      );
      expect(new Set(pair.map((row) => row.sequence)).size).toBe(2);
      const rows = await readConversationMessages(database, owner, threadId);
      expect(rows[0].body).toBe(input.body);
      expect(rows.map((row) => row.sequence)).toEqual([1, 2, 3]);
      expect(
        await readConversationMessages(database, other, threadId, 3),
      ).toEqual([]);
    });
    it("current inbox capabilities and revocation protect reads, writes and replay", async () => {
      const { database, admin } = get();
      await admin.query(
        "INSERT INTO treido.seller_memberships(seller_id,user_id,role,grants) VALUES($1,$2,'member','[\"inbox.read\"]')",
        [sellerId, staffId],
      );
      expect(
        (await readConversationMessages(database, staff, threadId)).length,
      ).toBe(3);
      await expect(
        sendConversationMessage(database, staff, {
          threadId,
          requestId: randomUUID(),
          body: "deny",
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await admin.query(
        'UPDATE treido.seller_memberships SET grants=\'["inbox.read","inbox.reply"]\' WHERE seller_id=$1 AND user_id=$2',
        [sellerId, staffId],
      );
      const input = { threadId, requestId: randomUUID(), body: "staff reply" };
      await sendConversationMessage(database, staff, input);
      await admin.query(
        "UPDATE treido.seller_memberships SET status='revoked' WHERE seller_id=$1 AND user_id=$2",
        [sellerId, staffId],
      );
      await expect(
        readConversationMessages(database, staff, threadId),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        sendConversationMessage(database, staff, input),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
    it("owned ready attachments stay participant-authorized and object keys remain server-only", async () => {
      const { database, admin, other } = get();
      const buyerId = (
        await admin.query(
          "SELECT id FROM treido.users WHERE clerk_subject=$1",
          [other.subject],
        )
      ).rows[0].id;
      const attachmentId = randomUUID();
      await admin.query(
        "INSERT INTO treido.message_attachments(id,thread_id,created_by,state,content_type,bytes,object_key) VALUES($1,$2,$3,'ready','image/jpeg',100,$4)",
        [attachmentId, threadId, buyerId, `private/test/${attachmentId}`],
      );
      await sendConversationMessage(database, other, {
        threadId,
        requestId: randomUUID(),
        body: "photo",
        attachmentIds: [attachmentId],
      });
      expect(
        (
          await readParticipantAttachment(
            database,
            other,
            threadId,
            attachmentId,
          )
        ).objectKey,
      ).toContain("private/test/");
      await expect(
        readParticipantAttachment(database, intruder, threadId, attachmentId),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        readParticipantAttachment(database, staff, threadId, attachmentId),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(
        JSON.stringify(
          await readConversationMessages(database, other, threadId),
        ),
      ).not.toContain("objectKey");
      await expect(
        sendConversationMessage(database, other, {
          threadId,
          requestId: randomUUID(),
          body: "reuse",
          attachmentIds: [attachmentId],
        }),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    });
    it("report receipt is durable, owned, and separate from seller or operator authority", async () => {
      const { database, other, owner } = get();
      const input = {
        resourceKind: "listing" as const,
        resourceId: listingId,
        requestId: randomUUID(),
        reason: "misleading",
        details: "A participant report",
      };
      const receipt = await createResourceReport(database, other, input);
      expect(await createResourceReport(database, other, input)).toEqual(
        receipt,
      );
      expect((await readOwnedReport(database, other, receipt.id)).state).toBe(
        "open",
      );
      await expect(
        readOwnedReport(database, owner, receipt.id),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(readOperatorReports(database, owner)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      const message = (
        await readConversationMessages(database, other, threadId)
      )[0];
      await expect(
        createResourceReport(database, intruder, {
          ...input,
          resourceKind: "message",
          resourceId: message.id,
          requestId: randomUUID(),
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
    it("runtime cannot grant operators; a read-only operator cannot enter private threads", async () => {
      const { database, admin } = get();
      await expect(
        database.pool.query(
          "INSERT INTO treido.operator_grants(user_id,capability) VALUES($1,'reports.read')",
          [intruderId],
        ),
      ).rejects.toMatchObject({ code: "42501" });
      await admin.query(
        "INSERT INTO treido.operator_grants(user_id,capability) VALUES($1,'reports.read')",
        [intruderId],
      );
      expect(
        (await readOperatorReports(database, intruder)).length,
      ).toBeGreaterThan(0);
      await expect(
        readConversationMessages(database, intruder, threadId),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await admin.query(
        "UPDATE treido.operator_grants SET active=false WHERE user_id=$1",
        [intruderId],
      );
      await expect(
        readOperatorReports(database, intruder),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });
}
