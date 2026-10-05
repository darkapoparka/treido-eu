import { describe, expect, it } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import sharp from "sharp";
import type { Client } from "pg";
import type { SellerDatabase } from "../../server/db/database";
import {
  createBusinessSeller,
  revokeSellerMembership,
} from "../sellers/persistence.server";
import {
  createListingDraft,
  readListingDraft,
  saveListingDraft,
} from "./drafts.server";
import { emptyDraft } from "./draft-model";
import {
  createMediaIntent,
  completeMediaUpload,
  listDraftMedia,
  changeDraftMedia,
  processMediaJob,
  readOwnedMedia,
} from "./media.server";
import { executeJob } from "../../server/jobs/execution.server";
import type { MediaStorage } from "../../server/media/storage.server";
import { MEDIA_LIMITS } from "./media-model";
import { cleanupMediaObjects } from "../../server/media/retention.server";

export function defineMediaIntegrationCases(
  get: () => {
    database: SellerDatabase;
    admin: Client;
    owner: { subject: string };
    other: { subject: string };
  },
) {
  const binding = {
    applicationId: "treido-local-contract",
    environment: "test",
  };
  async function setup() {
    const { database, owner } = get();
    const sellerId = await createBusinessSeller(database, owner, {
      name: "Photo seller",
      requestId: randomUUID(),
    });
    const draft = await createListingDraft(database, owner, {
      sellerId,
      requestId: randomUUID(),
      payload: { ...emptyDraft, title: "Снимки на личен артикул" },
    });
    const objects = new Map<string, Buffer>();
    const storage: MediaStorage = {
      scope: createHash("sha256")
        .update("test-treido/" + sellerId)
        .digest("hex"),
      prefix: "test-treido/",
      async remove(key) {
        objects.delete(key);
      },
      async upload(key) {
        return {
          url: `http://isolated-storage.invalid/${key}`,
          headers: { "content-type": "image/png" },
        };
      },
      async head(key) {
        const bytes = objects.get(key);
        if (!bytes) throw new Error("Missing staged bytes");
        return {
          bytes: bytes.length,
          etag: `"${createHash("md5").update(bytes).digest("hex")}"`,
        };
      },
      async freeze(source, etag, destination) {
        const bytes = objects.get(source)!;
        expect(etag).toBe(`"${createHash("md5").update(bytes).digest("hex")}"`);
        if (objects.has(destination)) throw new Error("Frozen input replaced");
        objects.set(destination, Buffer.from(bytes));
      },
      async read(key, maximum) {
        const bytes = objects.get(key)!;
        if (!bytes || bytes.length > maximum)
          throw new Error("Invalid bounded read");
        return Buffer.from(bytes);
      },
      async put(key, bytes) {
        objects.set(key, Buffer.from(bytes));
      },
    };
    const photo = await sharp({
      create: { width: 240, height: 160, channels: 3, background: "#5433eb" },
    })
      .png()
      .toBuffer();
    const checksum = createHash("sha256").update(photo).digest("hex");
    const uploadInput = {
      sellerId,
      draftId: draft.id,
      requestId: randomUUID(),
      bytes: photo.length,
      contentType: "image/png",
      checksum,
    };
    return { sellerId, draft, objects, storage, photo, uploadInput };
  }
  async function stage(item: Awaited<ReturnType<typeof setup>>) {
    const intent = await createMediaIntent(
      get().database,
      get().owner,
      item.uploadInput,
      item.storage,
    );
    const key = (
      await get().admin.query(
        "SELECT staging_key FROM treido.media_assets WHERE id=$1",
        [intent.assetId],
      )
    ).rows[0].staging_key;
    item.objects.set(key, item.photo);
    return { intent, key };
  }
  async function processAsset(
    item: Awaited<ReturnType<typeof setup>>,
    assetId: string,
  ) {
    const jobId = (
      await get().admin.query(
        "SELECT job_id FROM treido.media_assets WHERE id=$1",
        [assetId],
      )
    ).rows[0].job_id;
    const event = {
      jobId,
      sellerId: item.sellerId,
      generation: 1,
      schemaVersion: 1,
      ...binding,
    };
    return executeJob(get().database, event, binding, randomUUID(), {
      "media.process": (job) =>
        processMediaJob(get().database, job, item.storage),
    });
  }
  describe("draft photos with native PostgreSQL and actual Sharp processing (isolated storage contract)", () => {
    it("persists a bounded intent without changing the draft and deduplicates retry", async () => {
      const item = await setup();
      const { intent } = await stage(item);
      expect(
        (
          await createMediaIntent(
            get().database,
            get().owner,
            item.uploadInput,
            item.storage,
          )
        ).assetId,
      ).toBe(intent.assetId);
      expect(
        (
          await readListingDraft(
            get().database,
            get().owner,
            item.sellerId,
            item.draft.id,
          )
        ).revision,
      ).toBe(item.draft.revision);
      expect(
        (
          await listDraftMedia(
            get().database,
            get().owner,
            item.sellerId,
            item.draft.id,
          )
        )[0].state,
      ).toBe("staged");
      await expect(
        createMediaIntent(
          get().database,
          get().owner,
          { ...item.uploadInput, checksum: "f".repeat(64) },
          item.storage,
        ),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });
    it("denies foreign seller/draft/asset access and signed-intent retries", async () => {
      const item = await setup();
      const { intent } = await stage(item);
      await expect(
        listDraftMedia(
          get().database,
          get().other,
          item.sellerId,
          item.draft.id,
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        createMediaIntent(
          get().database,
          get().other,
          item.uploadInput,
          item.storage,
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        completeMediaUpload(
          get().database,
          get().other,
          {
            sellerId: item.sellerId,
            draftId: item.draft.id,
            assetId: intent.assetId,
          },
          item.storage,
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        completeMediaUpload(
          get().database,
          get().owner,
          {
            sellerId: item.sellerId,
            draftId: item.draft.id,
            assetId: randomUUID(),
          },
          item.storage,
        ),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
    it("two final-slot uploads admit only one, and oversize claims fail", async () => {
      const item = await setup();
      for (let i = 0; i < 11; i++)
        await createMediaIntent(
          get().database,
          get().owner,
          { ...item.uploadInput, requestId: randomUUID() },
          item.storage,
        );
      const race = await Promise.allSettled(
        [1, 2].map(() =>
          createMediaIntent(
            get().database,
            get().owner,
            { ...item.uploadInput, requestId: randomUUID() },
            item.storage,
          ),
        ),
      );
      expect(
        race.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        await listDraftMedia(
          get().database,
          get().owner,
          item.sellerId,
          item.draft.id,
        ),
      ).toHaveLength(12);
      await expect(
        createMediaIntent(
          get().database,
          get().owner,
          { ...item.uploadInput, bytes: MEDIA_LIMITS.bytes + 1 },
          item.storage,
        ),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    });
    it("upload completion and durable processing intent commit once", async () => {
      const item = await setup();
      const { intent } = await stage(item);
      const input = {
        sellerId: item.sellerId,
        draftId: item.draft.id,
        assetId: intent.assetId,
      };
      const completed = await Promise.all(
        [1, 2].map(() =>
          completeMediaUpload(get().database, get().owner, input, item.storage),
        ),
      );
      expect(completed.map((result) => result.state)).toEqual([
        "processing",
        "processing",
      ]);
      expect(
        (
          await get().admin.query(
            "SELECT count(*)::int AS count FROM treido.outbox_jobs WHERE resource_id=$1",
            [intent.assetId],
          )
        ).rows[0].count,
      ).toBe(1);
      const row = (
        await get().admin.query(
          "SELECT immutable_key,job_id,state FROM treido.media_assets WHERE id=$1",
          [intent.assetId],
        )
      ).rows[0];
      expect(row.immutable_key).toContain("immutable/");
      expect(row.job_id).toBeTruthy();
      expect((await processAsset(item, intent.assetId)).status).toBe(
        "completed",
      );
      const photos = await listDraftMedia(
        get().database,
        get().owner,
        item.sellerId,
        item.draft.id,
      );
      expect(photos[0]).toMatchObject({
        state: "ready",
        width: 240,
        height: 160,
      });
      const visible = await readOwnedMedia(
        get().database,
        get().owner,
        item.sellerId,
        intent.assetId,
      );
      const encoded = await sharp(item.objects.get(visible.key)).metadata();
      expect(encoded.format).toBe("webp");
      expect(encoded.exif).toBeUndefined();
    });
    it("replacement of the staged object cannot change frozen processing input", async () => {
      const item = await setup();
      const { intent, key } = await stage(item);
      await completeMediaUpload(
        get().database,
        get().owner,
        {
          sellerId: item.sellerId,
          draftId: item.draft.id,
          assetId: intent.assetId,
        },
        item.storage,
      );
      item.objects.set(
        key,
        await sharp({
          create: { width: 90, height: 90, channels: 3, background: "red" },
        })
          .png()
          .toBuffer(),
      );
      await processAsset(item, intent.assetId);
      expect(
        (
          await listDraftMedia(
            get().database,
            get().owner,
            item.sellerId,
            item.draft.id,
          )
        )[0],
      ).toMatchObject({ state: "ready", width: 240, height: 160 });
      expect(
        (
          await completeMediaUpload(
            get().database,
            get().owner,
            {
              sellerId: item.sellerId,
              draftId: item.draft.id,
              assetId: intent.assetId,
            },
            item.storage,
          )
        ).state,
      ).toBe("ready");
    });
    it("invalid bytes/checksum never become ready; failed processing preserves the draft", async () => {
      const item = await setup();
      const { intent, key } = await stage(item);
      item.objects.set(key, Buffer.alloc(item.photo.length, 120));
      await completeMediaUpload(
        get().database,
        get().owner,
        {
          sellerId: item.sellerId,
          draftId: item.draft.id,
          assetId: intent.assetId,
        },
        item.storage,
      );
      await expect(processAsset(item, intent.assetId)).rejects.toMatchObject({
        code: "INVALID_INPUT",
      });
      expect(
        (
          await listDraftMedia(
            get().database,
            get().owner,
            item.sellerId,
            item.draft.id,
          )
        )[0],
      ).toMatchObject({ state: "failed", error: "invalid_bytes" });
      expect(
        (
          await readListingDraft(
            get().database,
            get().owner,
            item.sellerId,
            item.draft.id,
          )
        ).payload.title,
      ).toBe("Снимки на личен артикул");
      await expect(
        readOwnedMedia(
          get().database,
          get().owner,
          item.sellerId,
          intent.assetId,
        ),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
    it("reorders with revisions, rejects stale/foreign lists, and removal frees one slot", async () => {
      const item = await setup();
      await stage(item);
      await createMediaIntent(
        get().database,
        get().owner,
        { ...item.uploadInput, requestId: randomUUID() },
        item.storage,
      );
      const original = await listDraftMedia(
        get().database,
        get().owner,
        item.sellerId,
        item.draft.id,
      );
      await changeDraftMedia(get().database, get().owner, {
        sellerId: item.sellerId,
        draftId: item.draft.id,
        assets: [...original].reverse(),
      });
      expect(
        (
          await listDraftMedia(
            get().database,
            get().owner,
            item.sellerId,
            item.draft.id,
          )
        )[0].id,
      ).toBe(original[1].id);
      await expect(
        changeDraftMedia(get().database, get().owner, {
          sellerId: item.sellerId,
          draftId: item.draft.id,
          assets: original,
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      const current = await listDraftMedia(
        get().database,
        get().owner,
        item.sellerId,
        item.draft.id,
      );
      await changeDraftMedia(get().database, get().owner, {
        sellerId: item.sellerId,
        draftId: item.draft.id,
        assets: current,
        removeId: current[0].id,
      });
      expect(
        await listDraftMedia(
          get().database,
          get().owner,
          item.sellerId,
          item.draft.id,
        ),
      ).toHaveLength(1);
    });
    it("revocation cancels processing and current reads even after a previous ready result", async () => {
      const item = await setup();
      const { intent } = await stage(item);
      const { database, owner, other, admin } = get();
      const userId = (
        await admin.query(
          "SELECT id FROM treido.users WHERE clerk_subject=$1",
          [other.subject],
        )
      ).rows[0].id;
      await admin.query(
        "INSERT INTO treido.seller_memberships(seller_id,user_id,role,status,grants) VALUES($1,$2,'manager','active','[]')",
        [item.sellerId, userId],
      );
      await completeMediaUpload(
        database,
        other,
        {
          sellerId: item.sellerId,
          draftId: item.draft.id,
          assetId: intent.assetId,
        },
        item.storage,
      );
      await revokeSellerMembership(database, owner, {
        sellerId: item.sellerId,
        userId,
      });
      expect((await processAsset(item, intent.assetId)).status).toBe(
        "cancelled",
      );
      await expect(
        listDraftMedia(database, other, item.sellerId, item.draft.id),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(
        (await listDraftMedia(database, owner, item.sellerId, item.draft.id))[0]
          .state,
      ).toBe("failed");
    });
    it("remove wins against an in-flight processor and denies derivative delivery", async () => {
      const item = await setup();
      const { intent } = await stage(item);
      await completeMediaUpload(
        get().database,
        get().owner,
        {
          sellerId: item.sellerId,
          draftId: item.draft.id,
          assetId: intent.assetId,
        },
        item.storage,
      );
      let entered!: () => void, release!: () => void;
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const barrier = new Promise<void>((resolve) => {
        release = resolve;
      });
      const put = item.storage.put;
      item.storage.put = async (key, bytes) => {
        await put(key, bytes);
        entered();
        await barrier;
      };
      const processing = processAsset(item, intent.assetId);
      await started;
      const assets = await listDraftMedia(
        get().database,
        get().owner,
        item.sellerId,
        item.draft.id,
      );
      await changeDraftMedia(get().database, get().owner, {
        sellerId: item.sellerId,
        draftId: item.draft.id,
        assets,
        removeId: intent.assetId,
      });
      release();
      await expect(processing).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        readOwnedMedia(
          get().database,
          get().owner,
          item.sellerId,
          intent.assetId,
        ),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(
        await listDraftMedia(
          get().database,
          get().owner,
          item.sellerId,
          item.draft.id,
        ),
      ).toEqual([]);
    });
    it("denies runtime ownership/input mutation and forged ready state", async () => {
      const item = await setup();
      const { intent } = await stage(item);
      await expect(
        get().database.pool.query(
          "UPDATE treido.media_assets SET expected_checksum=$2 WHERE id=$1",
          [intent.assetId, "f".repeat(64)],
        ),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        get().database.pool.query(
          "UPDATE treido.media_assets SET state='ready' WHERE id=$1",
          [intent.assetId],
        ),
      ).rejects.toMatchObject({ code: "23514" });
    });
    it("retains live processing/ready images while expiring scoped raw files after their retention", async () => {
      const item = await setup(),
        ctx = get(),
        { intent } = await stage(item);
      await completeMediaUpload(
        ctx.database,
        ctx.owner,
        {
          sellerId: item.sellerId,
          draftId: item.draft.id,
          assetId: intent.assetId,
        },
        item.storage,
      );
      await ctx.admin.query(
        "UPDATE treido.media_storage_objects SET write_until=clock_timestamp()-interval '1 hour',retain_until=clock_timestamp()-interval '1 hour' WHERE storage_scope=$1",
        [item.storage.scope],
      );
      expect(
        (await cleanupMediaObjects(ctx.database, item.storage)).deleted,
      ).toBe(1);
      expect(await processAsset(item, intent.assetId)).toMatchObject({
        status: "completed",
      });
      const original = (
        await ctx.admin.query(
          "SELECT retain_until>clock_timestamp()+interval '6 days' AS retained FROM treido.media_storage_objects WHERE storage_scope=$1 AND kind='immutable'",
          [item.storage.scope],
        )
      ).rows[0];
      expect(original.retained).toBe(true);
      expect(
        (await cleanupMediaObjects(ctx.database, item.storage)).deleted,
      ).toBe(0);
      await ctx.admin.query(
        "UPDATE treido.media_storage_objects SET write_until=clock_timestamp()-interval '1 hour',retain_until=clock_timestamp()-interval '1 hour' WHERE storage_scope=$1",
        [item.storage.scope],
      );
      expect(
        await cleanupMediaObjects(ctx.database, {
          ...item.storage,
          scope: "f".repeat(64),
        }),
      ).toEqual({ deleted: 0, pending: 0, skipped: 0 });
      expect(
        (await cleanupMediaObjects(ctx.database, item.storage)).deleted,
      ).toBe(1);
      const ready = await readOwnedMedia(
        ctx.database,
        ctx.owner,
        item.sellerId,
        intent.assetId,
      );
      expect(item.objects.has(ready.key)).toBe(true);
      expect(
        (
          await listDraftMedia(
            ctx.database,
            ctx.owner,
            item.sellerId,
            item.draft.id,
          )
        )[0].state,
      ).toBe("ready");
      expect(
        (await cleanupMediaObjects(ctx.database, item.storage)).deleted,
      ).toBe(0);
    });
    it("keeps uncertain deletion retryable and expires the upload without pretending its photo was processed", async () => {
      const ctx = get(),
        item = await setup(),
        { intent } = await stage(item);
      await ctx.admin.query(
        "UPDATE treido.media_assets SET expires_at=clock_timestamp()-interval '2 days' WHERE id=$1",
        [intent.assetId],
      );
      await ctx.admin.query(
        "UPDATE treido.media_storage_objects SET write_until=clock_timestamp()-interval '1 hour',retain_until=clock_timestamp()-interval '1 hour' WHERE storage_scope=$1",
        [item.storage.scope],
      );
      let lost = true;
      const remove = item.storage.remove;
      item.storage.remove = async (key) => {
        await remove(key);
        if (lost) {
          lost = false;
          throw new Error("Lost deletion response");
        }
      };
      expect(
        (await cleanupMediaObjects(ctx.database, item.storage)).pending,
      ).toBe(1);
      expect(
        (
          await ctx.admin.query(
            "SELECT state FROM treido.media_storage_objects WHERE storage_scope=$1",
            [item.storage.scope],
          )
        ).rows[0].state,
      ).toBe("deleting");
      expect(
        (
          await listDraftMedia(
            ctx.database,
            ctx.owner,
            item.sellerId,
            item.draft.id,
          )
        )[0],
      ).toMatchObject({ state: "failed", error: "upload_expired" });
      await ctx.admin.query(
        "UPDATE treido.media_storage_objects SET available_at=clock_timestamp()-interval '1 second' WHERE storage_scope=$1",
        [item.storage.scope],
      );
      expect(
        (await cleanupMediaObjects(ctx.database, item.storage)).deleted,
      ).toBe(1);
      await expect(
        completeMediaUpload(
          ctx.database,
          ctx.owner,
          {
            sellerId: item.sellerId,
            draftId: item.draft.id,
            assetId: intent.assetId,
          },
          item.storage,
        ),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(
        ctx.database.pool.query(
          "UPDATE treido.media_storage_objects SET object_key=object_key",
        ),
      ).rejects.toMatchObject({ code: "42501" });
    });
    it("records a frozen candidate before provider I/O so a lost completion does not leak an untracked original", async () => {
      const ctx = get(),
        item = await setup(),
        { intent } = await stage(item),
        freeze = item.storage.freeze;
      item.storage.freeze = async (...args) => {
        await freeze(...args);
        throw new Error("Lost freeze response");
      };
      await expect(
        completeMediaUpload(
          ctx.database,
          ctx.owner,
          {
            sellerId: item.sellerId,
            draftId: item.draft.id,
            assetId: intent.assetId,
          },
          item.storage,
        ),
      ).rejects.toThrow("Lost freeze response");
      expect(
        (
          await ctx.admin.query(
            "SELECT count(*)::int AS n FROM treido.media_storage_objects WHERE storage_scope=$1",
            [item.storage.scope],
          )
        ).rows[0].n,
      ).toBe(2);
      await ctx.admin.query(
        "UPDATE treido.media_assets SET expires_at=clock_timestamp()-interval '2 days' WHERE id=$1",
        [intent.assetId],
      );
      await ctx.admin.query(
        "UPDATE treido.media_storage_objects SET write_until=clock_timestamp()-interval '1 hour',retain_until=clock_timestamp()-interval '1 hour' WHERE storage_scope=$1",
        [item.storage.scope],
      );
      expect(
        (await cleanupMediaObjects(ctx.database, item.storage)).deleted,
      ).toBe(2);
      expect(item.objects.size).toBe(0);
    });

    if (process.env.TREIDO_MEDIA_BROWSER_HELPER)
      it("actual photo picker with native PostgreSQL (synthetic session/storage; no live Clerk/R2)", async () => {
        const item = await setup();
        const helper = await import(process.env.TREIDO_MEDIA_BROWSER_HELPER!);
        const result = await helper.runMediaBrowserChecks({
          ...get(),
          ...item,
          api: {
            createMediaIntent,
            completeMediaUpload,
            listDraftMedia,
            changeDraftMedia,
            processMediaJob,
            executeJob,
            readOwnedMedia,
            readListingDraft,
            saveListingDraft,
          },
        });
        expect(result.checks).toBeGreaterThanOrEqual(10);
      }, 120000);
  });
}
