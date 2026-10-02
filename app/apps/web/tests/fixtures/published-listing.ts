import { randomUUID } from "node:crypto";
import type { Client } from "pg";
/** Older participant/moderation cases seed accepted state, not publication behavior.
 * This fixture never approves a category and is never imported by application code.
 * The publication integration suite exercises the actual command and Sharp pipeline. */
export async function seedPublishedSnapshot(admin: Client, listingId: string) {
  const row = (
    await admin.query<{
      sellerId: string;
      kind: "personal" | "business";
      revision: number;
      payload: Record<string, unknown>;
      actor: string;
    }>(
      'SELECT l.seller_id AS "sellerId",s.kind,l.revision,d.payload,d.created_by AS actor FROM treido.listings l JOIN treido.listing_drafts d ON d.listing_id=l.id JOIN treido.seller_accounts s ON s.id=l.seller_id WHERE l.id=$1',
      [listingId],
    )
  ).rows[0];
  if (!row) throw Error("Missing test listing");
  let declarationRevision: number | null = null;
  if (row.kind === "business") {
    const declaration = (
      await admin.query<{ revision: number }>(
        "SELECT revision FROM treido.seller_declarations WHERE seller_id=$1 ORDER BY revision DESC LIMIT 1",
        [row.sellerId],
      )
    ).rows[0];
    declarationRevision = declaration?.revision ?? 1;
    if (!declaration)
      await admin.query(
        "INSERT INTO treido.seller_declarations(id,seller_id,revision,requirement_version,country,legal_name,registration_number,contact_email,contact_address,accurate,status,submitted_by,submitted_at) VALUES($1,$2,1,1,'BG','Synthetic Test Trader','TEST-ONLY','test@example.test','Synthetic address',true,'accepted',$3,now())",
        [randomUUID(), row.sellerId, row.actor],
      );
  }
  const payload: Record<string, unknown> = {
    ...row.payload,
    condition: row.payload.condition || "good",
  };
  const revision = row.revision + 1;
  const assetId = randomUUID();
  // Standalone fixture rows retain the same media/job ownership constraints.
  const job = randomUUID();
  await admin.query(
    "INSERT INTO treido.outbox_jobs(id,kind,seller_id,resource_id,operation_key,actor_id,authority,intent_hash) VALUES($1,'media.process',$2,$3,$4,$5,'member',repeat('a',64))",
    [job, row.sellerId, assetId, randomUUID(), row.actor],
  );
  await admin.query(
    "INSERT INTO treido.media_assets(id,seller_id,listing_id,created_by,request_id,input_hash,state,expected_bytes,content_type,expected_checksum,staging_key,immutable_key,source_etag,derivative_key,derivative_checksum,width,height,position,expires_at,job_id) VALUES($1,$2,$3,$4,$5,repeat('a',64),'ready',100,'image/png',repeat('a',64),$6,$7,'fixture',$8,repeat('b',64),10,10,0,now()+interval '1 hour',$9)",
    [
      assetId,
      row.sellerId,
      listingId,
      row.actor,
      randomUUID(),
      "test/staged/" + assetId,
      "test/input/" + assetId,
      "test/ready/" + assetId,
      job,
    ],
  );
  const terms = {
    version: 1,
    country: "BG",
    purchaseMode: "contact",
    handover: ["pickup"],
    deliveryDetails: "",
    defects: "",
    ownsItem: true,
    photoRights: true,
    accurateDetails: true,
    personalSale: row.kind === "personal",
  };
  await admin.query(
    "INSERT INTO treido.listing_publications(seller_id,listing_id,revision,draft_revision,actor_id,request_id,input_hash,payload,terms,seller_kind,registry_version,category_id,category_policy_version,country,declaration_revision) VALUES($1,$2,$3,$4,$5,$6,repeat('a',64),$7,$8,$9,1,$10,1,'BG',$11)",
    [
      row.sellerId,
      listingId,
      revision,
      row.revision,
      row.actor,
      randomUUID(),
      JSON.stringify(payload),
      JSON.stringify(terms),
      row.kind,
      payload.categoryId,
      declarationRevision,
    ],
  );
  await admin.query(
    "INSERT INTO treido.listing_publication_media(seller_id,listing_id,publication_revision,asset_id,asset_revision,position,checksum,width,height) VALUES($1,$2,$3,$4,1,0,repeat('b',64),10,10)",
    [row.sellerId, listingId, revision, assetId],
  );
  await admin.query(
    "UPDATE treido.listings SET publication='published',revision=$2,current_publication_revision=$2 WHERE id=$1",
    [listingId, revision],
  );
  await admin.query(
    "UPDATE treido.listing_drafts SET revision=$2 WHERE listing_id=$1",
    [listingId, revision],
  );
  return { revision, assetId };
}
