import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import sharp from "../../apps/web/node_modules/sharp";
import type { Pool } from "pg";
import type { SellerDatabase } from "../../apps/web/src/server/db/database";
import { executeJob } from "../../apps/web/src/server/jobs/execution.server";
import {
  createBusinessSeller,
  ensurePersonalSeller,
} from "../../apps/web/src/features/sellers/persistence.server";
import { createListingDraft } from "../../apps/web/src/features/selling/drafts.server";
import { emptyDraft } from "../../apps/web/src/features/selling/draft-model";
import { seedPublishedSnapshot } from "../../apps/web/tests/fixtures/published-listing";
import {
  openListingConversation,
  sendConversationMessage,
} from "../../apps/web/src/features/messaging/participants.server";
import { sendRecoverableReply } from "../../apps/web/src/features/messaging/reply.server";
import {
  stageAttachment,
  uploadAttachment,
  attachmentStatus,
  removeAttachment,
} from "../../apps/web/src/features/message-attachments/commands.server";
import { checksumOf } from "../../apps/web/src/features/message-attachments/raster.server";
import { createAttachmentStorage } from "../../apps/web/src/features/message-attachments/storage.server";
import {
  processAttachmentJob,
  type AttachmentJob,
} from "../../apps/web/src/features/message-attachments/jobs.server";
import { deliverAttachment } from "../../apps/web/src/features/message-attachments/delivery.server";
import { purgeAttachmentObjects } from "../../apps/web/src/features/message-attachments/retention.server";
/** Parent calls once in its portable, isolated PostgreSQL harness AFTER 0046 and feature grants.
 * Real commands/persistence; in-memory storage is explicitly a byte-adapter fixture, not live provider acceptance. */
export function defineAttachmentIntegrationCases(
  get: () => {
    database: SellerDatabase;
    admin: Pool;
    owner: { subject: string };
    other: { subject: string };
  },
) {
  describe("T72 participant image attachment real commands", () => {
    let sellerId: string, threadId: string, png: Buffer;
    const objects = new Map<string, Buffer>();
    const base = {
      scope: "a".repeat(64),
      prefix: "test-private/",
      async read(key: string, max: number) {
        const bytes = objects.get(key);
        if (!bytes || bytes.length > max)
          throw Error("Unavailable fixture object");
        return Buffer.from(bytes);
      },
      async put(key: string, bytes: Buffer) {
        objects.set(key, Buffer.from(bytes));
      },
      async remove(key: string) {
        objects.delete(key);
      },
      async head() {
        throw Error("Unused");
      },
      async freeze() {
        throw Error("Unused");
      },
      async upload() {
        throw Error("Unused");
      },
    };
    const storage = createAttachmentStorage(base);
    const scope = () => ({ sellerId: null, threadId });
    const raw = () => ({
      ...scope(),
      requestId: randomUUID(),
      bytes: png.length,
      contentType: "image/png",
      checksum: checksumOf(png),
    });
    beforeAll(async () => {
      const { database, admin, owner, other } = get();
      sellerId = await createBusinessSeller(database, owner, {
        name: "Synthetic isolated attachment seller",
        requestId: randomUUID(),
      });
      const listing = (
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
      await ensurePersonalSeller(database, other);
      await admin.query(
        "UPDATE treido.category_policies SET state='reviewed',enabled_for_publish=true,review_reference='SYNTHETIC ATTACHMENT TEST',reviewed_at=now() WHERE category_id='cat:electronics/phones' AND version=1",
      );
      await seedPublishedSnapshot(admin, listing);
      threadId = (await openListingConversation(database, other, listing)).id;
      png = await sharp({
        create: { width: 12, height: 8, channels: 3, background: "blue" },
      })
        .png()
        .toBuffer();
    });
    const stage = async () =>
      stageAttachment(get().database, get().other, raw(), storage);
    async function ready() {
      const { database, admin, other } = get(),
        staged = await stage();
      await uploadAttachment(
        database,
        other,
        { ...scope(), id: staged.id, revision: staged.revision },
        png,
        storage,
      );
      const original = (
        await admin.query(
          'SELECT id,kind,seller_id AS "sellerId",buyer_id AS "buyerId",resource_id AS "resourceId",operation_key AS "operationKey",actor_id AS "actorId",authority,generation FROM treido.outbox_jobs WHERE kind=\'message-attachment.process\' AND resource_id=$1',
          [staged.id],
        )
      ).rows[0] as AttachmentJob;
      const binding = { environment: "test", applicationId: "treido-t72" };
      const event = {
        schemaVersion: 1,
        jobId: original.id,
        sellerId: original.sellerId,
        generation: original.generation,
        ...binding,
      };
      const handler = (job: AttachmentJob) =>
        processAttachmentJob(database, job, storage);
      expect(
        await executeJob(
          database,
          event,
          binding,
          "attachment:" + randomUUID(),
          { "message-attachment.process": handler },
        ),
      ).toEqual({ jobId: original.id, status: "completed" });
      expect(
        await executeJob(
          database,
          event,
          binding,
          "attachment-replay:" + randomUUID(),
          { "message-attachment.process": handler },
        ),
      ).toEqual({ jobId: original.id, status: "completed" });
      return attachmentStatus(database, other, {
        ...scope(),
        id: staged.id,
        revision: 1,
      });
    }
    it("deduplicates stage and rejects a changed checksum/replayed request", async () => {
      const command = raw(),
        { database, other } = get();
      const [a, b] = await Promise.all([
        stageAttachment(database, other, command, storage),
        stageAttachment(database, other, command, storage),
      ]);
      expect(a.id).toBe(b.id);
      await expect(
        stageAttachment(
          database,
          other,
          { ...command, checksum: "b".repeat(64) },
          storage,
        ),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });
    it("cannot attach staged/forged ready assets", async () => {
      const a = await stage(),
        { database, admin, other } = get();
      await expect(
        sendConversationMessage(
          database,
          other,
          {
            threadId,
            requestId: randomUUID(),
            body: "",
            attachmentIds: [a.id],
          },
          { sellerId: null },
        ),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
      await expect(
        admin.query(
          "UPDATE treido.message_attachments SET state='ready',revision=revision+1 WHERE id=$1",
          [a.id],
        ),
      ).rejects.toThrow();
      await removeAttachment(database, other, {
        ...scope(),
        id: a.id,
        revision: a.revision,
      });
    });
    it("binds ordinary sends atomically, delivers only current participants and recovers exact retry", async () => {
      const a = await ready(),
        { database, other, owner } = get(),
        command = {
          actorSubject: other.subject,
          ...scope(),
          body: "Image",
          requestId: randomUUID(),
          attachmentIds: [a.id],
        };
      const first = await sendRecoverableReply(database, other, command);
      const second = await sendRecoverableReply(database, other, command);
      expect(second.id).toBe(first.id);
      expect(second.recovered).toBe(true);
      expect(
        (
          await deliverAttachment(
            database,
            other,
            { ...scope(), id: a.id, revision: 1 },
            storage,
          )
        ).length,
      ).toBeGreaterThan(0);
      expect(
        (
          await deliverAttachment(
            database,
            owner,
            { sellerId, threadId, id: a.id, revision: 1 },
            storage,
          )
        ).length,
      ).toBeGreaterThan(0);
      await expect(
        deliverAttachment(
          database,
          owner,
          { ...scope(), id: a.id, revision: 1 },
          storage,
        ),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        removeAttachment(database, other, {
          ...scope(),
          id: a.id,
          revision: a.revision,
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(
        sendRecoverableReply(database, other, {
          ...command,
          attachmentIds: [],
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });
    it("denies foreign unbound preview and detects stored-byte substitution", async () => {
      const a = await ready(),
        { database, other, owner, admin } = get();
      await expect(
        deliverAttachment(
          database,
          owner,
          { sellerId, threadId, id: a.id, revision: 1 },
          storage,
        ),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      const key = (
        await admin.query(
          "SELECT object_key FROM treido.message_attachments WHERE id=$1",
          [a.id],
        )
      ).rows[0].object_key;
      const original = objects.get(key)!;
      objects.set(key, Buffer.from("substituted"));
      await expect(
        deliverAttachment(
          database,
          other,
          { ...scope(), id: a.id, revision: 1 },
          storage,
        ),
      ).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
      objects.set(key, original);
      await removeAttachment(database, other, {
        ...scope(),
        id: a.id,
        revision: a.revision,
      });
    });
    it("serializes detach against send; only one wins and tombstones never revive", async () => {
      const a = await ready(),
        { database, other, admin } = get();
      const results = await Promise.allSettled([
        sendConversationMessage(
          database,
          other,
          {
            threadId,
            requestId: randomUUID(),
            body: "Race",
            attachmentIds: [a.id],
          },
          { sellerId: null },
        ),
        removeAttachment(database, other, {
          ...scope(),
          id: a.id,
          revision: a.revision,
        }),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const row = (
        await admin.query(
          "SELECT state FROM treido.message_attachments WHERE id=$1",
          [a.id],
        )
      ).rows[0];
      if (row.state === "removed")
        await expect(
          admin.query(
            "UPDATE treido.message_attachments SET state='staged',revision=revision+1 WHERE id=$1",
            [a.id],
          ),
        ).rejects.toThrow();
    });
    it("bounds a conversation's outstanding uploads across humans under concurrent intake", async () => {
      const { database, other, admin } = get();
      const before = Number(
        (
          await admin.query(
            "SELECT count(*) FROM treido.message_attachments a WHERE thread_id=$1 AND state<>'removed' AND expires_at>now() AND NOT EXISTS(SELECT 1 FROM treido.message_attachment_links WHERE attachment_id=a.id)",
            [threadId],
          )
        ).rows[0].count,
      );
      const results = await Promise.allSettled(
        Array.from({ length: 14 }, () => stage()),
      );
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(
        12 - before,
      );
      expect(
        results.some(
          (r) => r.status === "rejected" && r.reason.code === "QUOTA_EXCEEDED",
        ),
      ).toBe(true);
      const unbound = (
        await admin.query(
          "SELECT id,revision FROM treido.message_attachments a WHERE thread_id=$1 AND state<>'removed' AND NOT EXISTS(SELECT 1 FROM treido.message_attachment_links WHERE attachment_id=a.id)",
          [threadId],
        )
      ).rows;
      for (const a of unbound)
        await removeAttachment(database, other, { ...scope(), ...a });
    });
    it("does not delete linked completed images when registry retention becomes due", async () => {
      const { admin, database, other } = get();
      const a = await ready();
      await sendConversationMessage(
        database,
        other,
        {
          threadId,
          requestId: randomUUID(),
          body: "Keep",
          attachmentIds: [a.id],
        },
        { sellerId: null },
      );
      // An isolated admin can move object deadlines only with this test disabling the immutable registry trigger.
      await admin.query(
        "ALTER TABLE treido.message_attachment_objects DISABLE TRIGGER message_attachment_object_original",
      );
      try {
        await admin.query(
          "UPDATE treido.message_attachment_objects SET write_until=now()-interval '2 days',retain_until=now()-interval '1 day' WHERE attachment_id=$1",
          [a.id],
        );
      } finally {
        await admin.query(
          "ALTER TABLE treido.message_attachment_objects ENABLE TRIGGER message_attachment_object_original",
        );
      }
      await purgeAttachmentObjects(database, storage, a.id);
      expect(
        (
          await deliverAttachment(
            database,
            other,
            { ...scope(), id: a.id, revision: 1 },
            storage,
          )
        ).length,
      ).toBeGreaterThan(0);
    });
  });
}
