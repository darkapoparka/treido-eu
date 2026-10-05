import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import type { Client } from "pg";
import type { SellerDatabase } from "../../src/server/db/database";
import type { MediaStorage } from "../../src/server/media/storage.server";
import {
  createBusinessSeller,
  ensurePersonalSeller,
} from "../../src/features/sellers/persistence.server";
import { createListingDraft } from "../../src/features/selling/drafts.server";
import { emptyDraft } from "../../src/features/selling/draft-model";
import {
  createMediaIntent,
  completeMediaUpload,
  listDraftMedia,
  processMediaJob,
} from "../../src/features/selling/media.server";
import { executeJob } from "../../src/server/jobs/execution.server";
import type { PublishInput } from "../../src/features/selling/publish-model";
export type PublicationFixtureContext = {
  database: SellerDatabase;
  admin: Client;
  owner: { subject: string };
};
export async function createPublicationFixture(
  ctx: PublicationFixtureContext,
  kind: "personal" | "business" = "business",
  existingSellerId?: string,
) {
  const { database, admin, owner } = ctx;
  const sellerId =
    existingSellerId ??
    (kind === "personal"
      ? await ensurePersonalSeller(database, owner)
      : await createBusinessSeller(database, owner, {
          name: "Publication test store",
          requestId: randomUUID(),
        }));
  const draft = await createListingDraft(database, owner, {
    sellerId,
    requestId: randomUUID(),
    payload: {
      ...emptyDraft,
      title: "Телефон за тест",
      description: "Реално запазено описание на синтетичен артикул.",
      categoryId: "cat:electronics/phones",
      condition: "good",
      priceMinor: 12900,
      locality: "София",
      fields: {
        brand: "Apple",
        model: "iPhone",
        storageGB: "128",
        workingStatus: "working",
      },
    },
  });
  const objects = new Map<string, Buffer>();
  const storage: MediaStorage = {
    scope: createHash("sha256")
      .update("test-publication/" + sellerId)
      .digest("hex"),
    prefix: "test-publication/",
    async remove(key) {
      objects.delete(key);
    },
    async upload(key) {
      return {
        url: "http://fixture.invalid/" + key,
        headers: { "content-type": "image/png" },
      };
    },
    async head(key) {
      const bytes = objects.get(key);
      if (!bytes) throw Error("Missing fixture bytes");
      return {
        bytes: bytes.length,
        etag: '"' + createHash("md5").update(bytes).digest("hex") + '"',
      };
    },
    async freeze(source, etag, destination) {
      const bytes = objects.get(source);
      if (
        !bytes ||
        etag !== '"' + createHash("md5").update(bytes).digest("hex") + '"' ||
        objects.has(destination)
      )
        throw Error("Invalid frozen fixture");
      objects.set(destination, Buffer.from(bytes));
    },
    async read(key, max) {
      const bytes = objects.get(key);
      if (!bytes || bytes.length > max) throw Error("Invalid bounded read");
      return Buffer.from(bytes);
    },
    async put(key, bytes) {
      objects.set(key, Buffer.from(bytes));
    },
  };
  const photo = await sharp({
    create: {
      width: 600,
      height: 480,
      channels: 3,
      background: { r: 222, g: 226, b: 230 },
    },
  })
    .png()
    .toBuffer();
  const intent = await createMediaIntent(
    database,
    owner,
    {
      sellerId,
      draftId: draft.id,
      requestId: randomUUID(),
      bytes: photo.length,
      contentType: "image/png",
      checksum: createHash("sha256").update(photo).digest("hex"),
    },
    storage,
  );
  const key = (
    await admin.query(
      "SELECT staging_key FROM treido.media_assets WHERE id=$1",
      [intent.assetId],
    )
  ).rows[0].staging_key;
  objects.set(key, photo);
  await completeMediaUpload(
    database,
    owner,
    { sellerId, draftId: draft.id, assetId: intent.assetId },
    storage,
  );
  const jobId = (
    await admin.query("SELECT job_id FROM treido.media_assets WHERE id=$1", [
      intent.assetId,
    ])
  ).rows[0].job_id;
  const binding = {
    applicationId: "treido-publication-test",
    environment: "test",
  };
  await executeJob(
    database,
    { jobId, sellerId, generation: 1, schemaVersion: 1, ...binding },
    binding,
    randomUUID(),
    { "media.process": (job) => processMediaJob(database, job, storage) },
  );
  if (kind === "business") {
    const actor = (
      await admin.query("SELECT id FROM treido.users WHERE clerk_subject=$1", [
        owner.subject,
      ])
    ).rows[0].id;
    await admin.query(
      "INSERT INTO treido.seller_declarations(id,seller_id,revision,requirement_version,country,legal_name,registration_number,contact_email,contact_address,accurate,status,submitted_by,submitted_at) SELECT $1,$2,1,1,'BG','Synthetic trader','TEST-ONLY','private@example.test','PRIVATE TEST ADDRESS',true,'accepted',$3,now() WHERE NOT EXISTS(SELECT 1 FROM treido.seller_declarations WHERE seller_id=$2)",
      [randomUUID(), sellerId, actor],
    );
  }
  const media = (await listDraftMedia(database, owner, sellerId, draft.id)).map(
    (a) => ({ id: a.id, revision: a.revision }),
  );
  const input: PublishInput = {
    sellerId,
    listingId: draft.id,
    expectedRevision: draft.revision,
    requestId: randomUUID(),
    media,
    terms: {
      version: 1,
      country: "BG",
      purchaseMode: "contact",
      handover: ["pickup"],
      deliveryDetails: "Уговорка в чата",
      defects: "Следи от употреба",
      ownsItem: true,
      photoRights: true,
      accurateDetails: true,
      personalSale: kind === "personal",
    },
  };
  return { sellerId, draft, assetId: intent.assetId, input, storage, objects };
}
