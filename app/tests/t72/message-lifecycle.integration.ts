import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { startLaunchCluster } from "./native-fixture.mjs";
import { imageLifecycleFixture } from "./message-lifecycle-fixture";
import { createDatabase } from "../../apps/web/src/server/db/database";
import {
  createLifecyclePlan,
  type LifecycleNativeContext,
} from "../t61/lifecycle-fixture";
import { createResourceReport } from "../../apps/web/src/features/trust/reports.server";
import { stageAttachment } from "../../apps/web/src/features/message-attachments/commands.server";
import { removeAttachment } from "../../apps/web/src/features/message-attachments/commands.server";
import { deliverAttachment } from "../../apps/web/src/features/message-attachments/delivery.server";
import { purgeAttachmentObjects } from "../../apps/web/src/features/message-attachments/retention.server";
import { readConversation } from "../../apps/web/src/features/messaging/inbox.server";
import { readParticipantAttachment } from "../../apps/web/src/features/messaging/participants.server";
import { ownCommunicationMetadata } from "../../apps/web/src/features/account-privacy/communication-export.server";
import { projectExport } from "../../apps/web/src/features/account-privacy/projections.server";
import { readPrivateDownload } from "../../apps/web/src/features/account-privacy/queries.server";
import { privacyActorKey } from "../../apps/web/src/features/account-privacy/storage.server";
import { checksumOf } from "../../apps/web/src/features/message-attachments/raster.server";

vi.mock("../../apps/web/src/server/config/backend-bindings.server", () => ({
  requireBackendBindings: () => ({
    environment: "test",
    identity: {
      provider: "clerk",
      applicationId: "app_T61Native",
      mode: "test",
    },
  }),
}));
const auth = vi.hoisted(() => ({ recent: new Set<string>() }));
vi.mock("../../apps/web/src/server/identity/clerk.server", () => ({
  hasVerifiedRecentAuthentication: (identity: { subject: string }) =>
    auth.recent.has(identity.subject),
}));
let native: Awaited<ReturnType<typeof startLaunchCluster>>,
  context: LifecycleNativeContext;
beforeAll(async () => {
  vi.stubGlobal("fetch", async () => {
    throw Error("No external provider IO in native lifecycle tests");
  });
  native = await startLaunchCluster({ messageLifecycle: true });
  context = {
    database: createDatabase(native.runtime),
    admin: native.admin,
    registerRecent: (identity) => {
      auth.recent.add(identity.subject);
    },
  };
});
afterAll(async () => {
  await native?.stop();
  vi.unstubAllGlobals();
});
const fixture = () => imageLifecycleFixture(context);
async function claim(
  effectId: string,
  proof: { jobId: string; executionToken: string },
  token = randomUUID(),
) {
  const result = (
    await native.runtime.query(
      "SELECT treido.account_claim_effect($1,$2,$3,$4) AS claim",
      [effectId, token, proof.jobId, proof.executionToken],
    )
  ).rows[0].claim;
  return { token, result };
}
async function hold(f: Awaited<ReturnType<typeof fixture>>, imageId: string) {
  await native.admin.query(
    "INSERT INTO treido.message_image_legal_holds(id,attachment_id,approved_at,approval_reference) VALUES($1,$2,clock_timestamp(),'SYNTHETIC LOCAL LEGAL HOLD')",
    [randomUUID(), imageId],
  );
}

it("applies 0048 with finite execute seams and no runtime approval/tombstone authority", async () => {
  expect(native.state.migrations.at(-1)).toBe(
    "0049_message_image_executor_fence.sql",
  );
  const grants = (
    await native.runtime
      .query(`SELECT has_table_privilege(current_user,'treido.message_image_lifecycle_policies','INSERT') AS approve,
    has_table_privilege(current_user,'treido.message_image_tombstones','INSERT') AS tombstone,
    has_table_privilege(current_user,'treido.message_image_legal_holds','UPDATE') AS hold,
    has_function_privilege(current_user,'treido.account_claim_message_image(uuid,uuid)','EXECUTE') AS private_mutation`)
  ).rows[0];
  expect(grants).toEqual({
    approve: false,
    tombstone: false,
    hold: false,
    private_mutation: false,
  });
});

it("old policy and binding fail closed when live image objects exist", async () => {
  const f = await fixture();
  await f.image();
  await expect(f.review()).rejects.toMatchObject({ code: "POLICY_REQUIRED" });
});

it("removes only frozen owned personal bytes; history and counterpart business images survive", async () => {
  const f = await fixture(),
    own = await f.image(),
    counterpart = await f.image(f.counterpart, f.sellerId);
  await f.approve();
  const plan = await f.review(),
    proof = await f.accept(plan);
  expect(proof.effects).toHaveLength(2);
  expect(
    proof.effects.every((effect) => effect.target.assetId === own.id),
  ).toBe(true);
  // Ordinary current participant authority works until effect tombstoning.
  expect(
    (
      await deliverAttachment(
        context.database,
        f.counterpart.identity,
        { ...own.scope, sellerId: f.sellerId, id: own.id, revision: 1 },
        f.storage,
      )
    ).length,
  ).toBeGreaterThan(0);
  const effect = proof.effects[0],
    lease = await claim(effect.id, proof);
  expect(lease.result.claimed).toBe(true);
  await expect(
    deliverAttachment(
      context.database,
      f.counterpart.identity,
      { sellerId: f.sellerId, threadId: f.threadId, id: own.id, revision: 1 },
      f.storage,
    ),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(
    readParticipantAttachment(
      context.database,
      f.counterpart.identity,
      f.threadId,
      own.id,
    ),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  const view = await readConversation(
    context.database,
    f.counterpart.identity,
    { sellerId: f.sellerId, threadId: f.threadId, before: null },
  );
  const message = view.messages.find(
    (message) => message.id === own.messageId,
  )!;
  expect(message.body).toBe("Own authored synthetic text");
  expect(message.attachments).toBe(1);
  expect(message.attachmentIds).toEqual([]);
  expect(
    view.messages.some((message) =>
      message.attachmentIds?.includes(counterpart.id),
    ),
  ).toBe(true);
  await native.runtime.query("SELECT treido.account_message_image_io($1,$2)", [
    effect.id,
    lease.token,
  ]);
  await native.runtime.query(
    "SELECT treido.account_record_effect($1,$2,'confirmed',$3,'provider')",
    [effect.id, lease.token, "c".repeat(64)],
  );
  await expect(
    native.runtime.query(
      "UPDATE treido.message_attachments SET state='removed',revision=revision+1 WHERE id=$1",
      [own.id],
    ),
  ).rejects.toThrow();
  await expect(
    native.runtime.query(
      "DELETE FROM treido.message_attachment_links WHERE attachment_id=$1",
      [own.id],
    ),
  ).rejects.toThrow();
});

it("business-authored images stay retained and old membership grants no private export", async () => {
  const f = await fixture();
  const image = await f.image(f.counterpart, f.sellerId);
  await f.approve();
  await native.admin.query(
    "INSERT INTO treido.seller_memberships(seller_id,user_id,role,status) VALUES($1,$2,'owner','active')",
    [f.sellerId, f.buyer.userId],
  );
  const plan = await createLifecyclePlan(context, f.counterpart, f.rules);
  const payload = (
    await native.admin.query(
      "SELECT payload FROM treido.account_execution_plans WHERE id=$1",
      [plan.id],
    )
  ).rows[0].payload;
  expect(payload.targets).toEqual([]);
  expect(
    payload.messageImages.resources.every(
      (r: { retentionReason: string }) => r.retentionReason === "business",
    ),
  ).toBe(true);
  await native.admin.query(
    "UPDATE treido.seller_memberships SET status='revoked',revision=revision+1 WHERE seller_id=$1 AND user_id=$2",
    [f.sellerId, f.counterpart.userId],
  );
  expect(
    await ownCommunicationMetadata(native.runtime, f.counterpart.userId),
  ).toEqual([]);
  await expect(
    deliverAttachment(
      context.database,
      f.counterpart.identity,
      { sellerId: f.sellerId, threadId: f.threadId, id: image.id, revision: 1 },
      f.storage,
    ),
  ).rejects.toThrow();
});

it("pending writes cannot be reviewed or silently folded into acceptance", async () => {
  const f = await fixture();
  const a = await f.image();
  await f.approve();
  await native.admin.query(
    "ALTER TABLE treido.message_attachment_objects DISABLE TRIGGER message_attachment_object_original",
  );
  try {
    await native.admin.query(
      "UPDATE treido.message_attachment_objects SET write_until=clock_timestamp()+interval '10 minutes' WHERE attachment_id=$1",
      [a.id],
    );
  } finally {
    await native.admin.query(
      "ALTER TABLE treido.message_attachment_objects ENABLE TRIGGER message_attachment_object_original",
    );
  }
  await expect(f.review()).rejects.toMatchObject({ code: "POLICY_REQUIRED" });
});

it("new upload and state/revision changes after review require a new review", async () => {
  const f = await fixture();
  await f.image();
  await f.approve();
  const plan = await f.review();
  await f.image();
  await expect(f.accept(plan)).rejects.toThrow(
    "Changed message image resources",
  );
  expect(
    (
      await native.admin.query("SELECT status FROM treido.users WHERE id=$1", [
        f.buyer.userId,
      ])
    ).rows[0].status,
  ).toBe("active");
  const second = await f.review();
  const unsent = await f.image(f.buyer, null, false);
  await expect(f.accept(second)).rejects.toThrow(
    "Changed message image resources",
  );
  expect(unsent.id).toBeTruthy();
});

it("legal holds before review retain images; reports retain reviewed case evidence", async () => {
  const f = await fixture(),
    image = await f.image();
  await hold(f, image.id);
  await f.approve();
  const plan = await f.review(),
    proof = await f.accept(plan);
  expect(proof.effects).toEqual([]);
  expect(
    proof.payload.messageImages?.resources.every(
      (resource) => resource.retentionReason === "legal-hold",
    ),
  ).toBe(true);
  const caseFixture = await fixture(),
    reported = await caseFixture.image();
  await caseFixture.approve();
  const report = await createResourceReport(
    context.database,
    caseFixture.counterpart.identity,
    {
      resourceKind: "message",
      resourceId: reported.messageId!,
      requestId: randomUUID(),
      reason: "unsafe",
      details: "Synthetic case evidence",
    },
  );
  await native.admin.query(
    "UPDATE treido.reports SET state='reviewed',revision=revision+1 WHERE id=$1",
    [report.id],
  );
  const casePlan = await caseFixture.review(),
    caseProof = await caseFixture.accept(casePlan);
  expect(caseProof.effects).toEqual([]);
  expect(
    caseProof.payload.messageImages?.resources.every(
      (resource) => resource.retentionReason === "case",
    ),
  ).toBe(true);
});

it("holds after review require re-review, and holds after acceptance block external deletion", async () => {
  const f = await fixture(),
    image = await f.image();
  await f.approve();
  const plan = await f.review();
  await hold(f, image.id);
  await expect(f.accept(plan)).rejects.toThrow(
    "Changed message image resources",
  );
  const after = await fixture(),
    a = await after.image();
  await after.approve();
  const accepted = await after.accept(await after.review());
  await hold(after, a.id);
  await expect(claim(accepted.effects[0].id, accepted)).rejects.toThrow("held");
  expect(
    (
      await native.admin.query(
        "SELECT count(*)::int AS n FROM treido.message_image_tombstones WHERE attachment_id=$1",
        [a.id],
      )
    ).rows[0].n,
  ).toBe(0);
});

it("a hold arriving during IO denies acknowledgement and never marks erased", async () => {
  const f = await fixture(),
    image = await f.image();
  await f.approve();
  const proof = await f.accept(await f.review()),
    effect = proof.effects[0];
  const lease = await claim(effect.id, proof);
  await hold(f, image.id);
  await expect(
    native.runtime.query("SELECT treido.account_message_image_io($1,$2)", [
      effect.id,
      lease.token,
    ]),
  ).rejects.toThrow("hold");
  await expect(
    native.runtime.query(
      "SELECT treido.account_record_effect($1,$2,'confirmed',$3,'provider')",
      [effect.id, lease.token, "d".repeat(64)],
    ),
  ).rejects.toThrow("hold");
  expect(
    (
      await native.admin.query(
        "SELECT state FROM treido.account_lifecycle_effects WHERE id=$1",
        [effect.id],
      )
    ).rows[0].state,
  ).toBe("attempting");
});

it("revoked rules and stale service/subject identities cannot delete", async () => {
  const f = await fixture();
  await f.image();
  await f.approve();
  const proof = await f.accept(await f.review());
  await expect(
    claim(proof.effects[0].id, { ...proof, executionToken: randomUUID() }),
  ).rejects.toThrow("lease");
  await native.admin.query(
    "UPDATE treido.message_image_lifecycle_policies SET revoked_at=clock_timestamp() WHERE id=$1",
    [f.ruleId],
  );
  await expect(claim(proof.effects[0].id, proof)).rejects.toThrow("extension");
  const stale = await fixture();
  await stale.image();
  await stale.approve();
  const p = await stale.accept(await stale.review());
  await native.admin.query(
    "UPDATE treido.users SET clerk_subject=$2 WHERE id=$1",
    [stale.buyer.userId, "user_stale_" + randomUUID().replaceAll("-", "")],
  );
  await expect(claim(p.effects[0].id, p)).rejects.toThrow("subject");
});

it("unknown deletion remains retryable under the original effect; no duplicate tombstone or erased claim", async () => {
  const f = await fixture(),
    image = await f.image();
  await f.approve();
  const proof = await f.accept(await f.review()),
    effect = proof.effects[0];
  const first = await claim(effect.id, proof);
  await native.runtime.query(
    "SELECT treido.account_record_effect($1,$2,'unknown',$3,'provider')",
    [effect.id, first.token, "e".repeat(64)],
  );
  expect(
    (
      await native.admin.query(
        "SELECT state FROM treido.message_attachment_objects WHERE storage_scope=$1 AND object_key=$2",
        [effect.target.storageScope, effect.target.objectKey],
      )
    ).rows[0].state,
  ).toBe("deleting");
  await purgeAttachmentObjects(context.database, f.storage, image.id);
  await native.admin.query(
    "UPDATE treido.message_attachment_objects SET deletion_until=clock_timestamp()-interval '1 second' WHERE attachment_id=$1 AND state='deleting'",
    [image.id],
  );
  const second = await claim(effect.id, proof);
  expect(second.result).toMatchObject({ claimed: true, execute: false });
  await native.runtime.query(
    "SELECT treido.account_record_effect($1,$2,'confirmed',$3,'provider')",
    [effect.id, second.token, "f".repeat(64)],
  );
  expect((await claim(effect.id, proof)).result).toEqual({
    claimed: false,
    confirmed: true,
  });
  expect(
    (
      await native.admin.query(
        "SELECT count(*)::int AS n FROM treido.message_image_tombstones WHERE attachment_id=$1",
        [image.id],
      )
    ).rows[0].n,
  ).toBe(1);
});

it("cancellation before effects restores ordinary access without image tombstones", async () => {
  const f = await fixture(),
    image = await f.image();
  await f.approve();
  const plan = await f.review();
  await f.accept(plan);
  await native.runtime.query("SELECT treido.account_cancel_closure($1,$2)", [
    f.buyer.userId,
    plan.id,
  ]);
  expect(
    (
      await deliverAttachment(
        context.database,
        f.buyer.identity,
        { ...image.scope, id: image.id, revision: 1 },
        f.storage,
      )
    ).length,
  ).toBeGreaterThan(0);
  expect(
    (
      await native.admin.query(
        "SELECT count(*)::int AS n FROM treido.message_image_tombstones WHERE attachment_id=$1",
        [image.id],
      )
    ).rows[0].n,
  ).toBe(0);
});

it("personal-seller communication uses the same explicit reviewed removal authority", async () => {
  const f = await fixture(),
    thread = await f.personalConversation();
  const own = await f.image(f.buyer, f.buyer.sellerId!, true, thread);
  await f.approve();
  const proof = await f.accept(await f.review());
  expect(proof.effects).toHaveLength(2);
  expect(
    proof.effects.every(
      (effect) =>
        effect.target.assetId === own.id &&
        effect.target.ownerUserId === f.buyer.userId,
    ),
  ).toBe(true);
});

it("an unlinked revision change after review requires re-review and restriction denies new intake", async () => {
  const f = await fixture(),
    own = await f.image(f.buyer, null, false);
  await f.approve();
  const plan = await f.review();
  const revision = (
    await native.admin.query(
      "SELECT revision FROM treido.message_attachments WHERE id=$1",
      [own.id],
    )
  ).rows[0].revision;
  await removeAttachment(context.database, f.buyer.identity, {
    ...own.scope,
    id: own.id,
    revision,
  });
  await expect(f.accept(plan)).rejects.toThrow(
    "Changed message image resources",
  );
  const current = await f.review();
  await f.accept(current);
  await expect(
    stageAttachment(
      context.database,
      f.buyer.identity,
      {
        sellerId: null,
        threadId: f.threadId,
        requestId: randomUUID(),
        contentType: "image/png",
        bytes: f.png.length,
        checksum: checksumOf(f.png),
      },
      f.storage,
    ),
  ).rejects.toThrow();
});

it.each(["account_lifecycle_bindings", "account_closure_policies"])(
  "current %s revocation before IO blocks the original lease",
  async (table) => {
    const f = await fixture();
    await f.image();
    await f.approve();
    const proof = await f.accept(await f.review()),
      effect = proof.effects[0];
    const lease = await claim(effect.id, proof);
    const id =
      table === "account_lifecycle_bindings"
        ? f.rules.bindingId
        : f.rules.policyId;
    await native.admin.query(
      `UPDATE treido.${table} SET revoked_at=clock_timestamp() WHERE id=$1`,
      [id],
    );
    await expect(
      native.runtime.query("SELECT treido.account_message_image_io($1,$2)", [
        effect.id,
        lease.token,
      ]),
    ).rejects.toThrow("binding or policy");
  },
);

it("accepted commerce history remains protected after an offer has been cancelled", async () => {
  const f = await fixture();
  await f.image();
  await f.approve();
  const sku = randomUUID(),
    offer = randomUUID(),
    allocation = randomUUID();
  const revision = (
    await native.admin.query(
      "SELECT current_publication_revision FROM treido.listings WHERE id=$1",
      [f.listingId],
    )
  ).rows[0].current_publication_revision;
  await native.admin.query(
    "INSERT INTO treido.inventory_catalogues(seller_id,listing_id,seller_kind,mode) VALUES($1,$2,'business','stocked')",
    [f.sellerId, f.listingId],
  );
  await native.admin.query(
    "INSERT INTO treido.inventory_skus(id,seller_id,listing_id,mode,option_key,price_minor,on_hand) VALUES($1,$2,$3,'stocked',$4,100,1)",
    [sku, f.sellerId, f.listingId, "a".repeat(64)],
  );
  await native.admin.query(
    "INSERT INTO treido.inventory_publications(seller_id,listing_id,publication_revision,mode,inventory_revision) VALUES($1,$2,$3,'stocked',1)",
    [f.sellerId, f.listingId, revision],
  );
  await native.admin.query(
    "INSERT INTO treido.inventory_publication_skus(seller_id,listing_id,publication_revision,sku_id,options,price_minor,currency) VALUES($1,$2,$3,$4,'{}',100,'EUR')",
    [f.sellerId, f.listingId, revision, sku],
  );
  await native.admin.query(
    "INSERT INTO treido.inventory_allocations(id,seller_id,buyer_id,purpose,source_id,input_hash,state,expires_at) VALUES($1,$2,$3,'offer',$4,$5,'released',clock_timestamp()+interval '1 hour')",
    [allocation, f.sellerId, f.buyer.userId, offer, "a".repeat(64)],
  );
  await native.admin.query(
    "INSERT INTO treido.listing_offers(id,thread_id,seller_id,listing_id,buyer_id,proposer_id,proposer_side,publication_revision,sku_id,quantity,unit_price_minor,expires_at,state,sequence,allocation_id) VALUES($1,$2,$3,$4,$5,$5,'buyer',$6,$7,1,100,clock_timestamp()+interval '1 hour','cancelled',1,$8)",
    [
      offer,
      f.threadId,
      f.sellerId,
      f.listingId,
      f.buyer.userId,
      revision,
      sku,
      allocation,
    ],
  );
  await native.admin.query(
    "INSERT INTO treido.offer_events(id,thread_id,offer_id,actor_id,kind) VALUES($1,$2,$3,$4,'accepted')",
    [randomUUID(), f.threadId, offer, f.counterpart.userId],
  );
  const proof = await f.accept(await f.review());
  expect(proof.effects).toEqual([]);
  expect(
    proof.payload.messageImages?.resources.every(
      (resource) => resource.retentionReason === "commerce",
    ),
  ).toBe(true);
});

it("namespace substitution and direct linked object deletion fail closed", async () => {
  const f = await fixture(),
    image = await f.image();
  await f.approve();
  await expect(
    deliverAttachment(
      context.database,
      f.buyer.identity,
      { ...image.scope, id: image.id, revision: 1 },
      { ...f.storage, scope: "b".repeat(64) },
    ),
  ).rejects.toThrow();
  await expect(
    native.runtime.query(
      "UPDATE treido.message_attachment_objects SET state='deleted',deleted_at=clock_timestamp() WHERE attachment_id=$1",
      [image.id],
    ),
  ).rejects.toThrow("lifecycle authority");
  await expect(
    native.runtime.query(
      "INSERT INTO treido.message_attachment_objects(storage_scope,object_key,attachment_id,kind,write_until,retain_until) VALUES($1,$2,$3,'source',clock_timestamp(),clock_timestamp())",
      [f.storage.scope, "test-private/listing/" + randomUUID(), image.id],
    ),
  ).rejects.toThrow("namespace");
});

it("bounded free personal export redacts counterpart, business, text, keys and bytes; prior snapshots download unchanged", async () => {
  const f = await fixture();
  const own = await f.image();
  const counterpart = await f.image(f.counterpart, f.sellerId);
  const sections = await projectExport(native.runtime, f.buyer.userId, [
      "account",
    ]),
    text = JSON.stringify(sections);
  expect(text).toContain(own.id);
  expect(text).not.toContain(counterpart.id);
  expect(text).toContain("ownCommunicationMetadataV1");
  for (const secret of [
    "Own authored synthetic text",
    "objectKey",
    "storage_scope",
    "source_key",
    "test-private/",
    "checksum",
    "provider",
    "http",
    "filename",
  ])
    expect(text).not.toContain(secret);
  const id = randomUUID(),
    prior = {
      format: "treido-personal-data-v1",
      accountId: f.buyer.userId,
      generatedAt: new Date().toISOString(),
      scope: "supported-current-snapshot",
      sections: [
        {
          category: "account",
          records: [{ id: f.buyer.userId }],
          limited: false,
        },
      ],
      excluded: [],
    };
  await native.admin.query(
    "INSERT INTO treido.account_privacy_exports(user_id,id,categories,snapshot,expires_at) VALUES($1,$2,'[\"account\"]',$3,clock_timestamp()+interval '15 minutes')",
    [f.buyer.userId, id, prior],
  );
  expect(
    JSON.parse(
      await readPrivateDownload(
        context.database,
        f.buyer.identity,
        id,
        privacyActorKey(f.buyer.identity),
      ),
    ),
  ).toEqual(prior);
  auth.recent.delete(f.buyer.identity.subject);
  await expect(async () =>
    readPrivateDownload(
      context.database,
      f.buyer.identity,
      id,
      privacyActorKey(f.buyer.identity),
    ),
  ).rejects.toMatchObject({ code: "RECENT_AUTH_REQUIRED" });
  auth.recent.add(f.buyer.identity.subject);
  for (let i = 0; i < 60; i++)
    await native.admin.query(
      "INSERT INTO treido.messages(id,thread_id,author_id,sequence,body,request_id,input_hash) VALUES($1,$2,$3,$4,'Own bounded text',$5,$6)",
      [
        randomUUID(),
        f.threadId,
        f.buyer.userId,
        100 + i,
        randomUUID(),
        "a".repeat(64),
      ],
    );
  const bounded = (
    await projectExport(native.runtime, f.buyer.userId, ["account"])
  )[0];
  expect(bounded.records.length).toBeLessThanOrEqual(50);
  expect(bounded.limited).toBe(true);
});

it("a pre-extension frozen plan cannot accept newly linked image resources or complete", async () => {
  const f = await fixture();
  const old = await f.review();
  await f.image();
  await f.approve();
  await expect(f.accept(old)).rejects.toThrow(
    "Changed message image resources",
  );
  await expect(
    native.admin.query(
      "UPDATE treido.account_execution_plans SET state='completed',completed_at=clock_timestamp() WHERE id=$1",
      [old.id],
    ),
  ).rejects.toThrow("extension");
});

it("cleans a linked raw upload after its registered deadline without deleting the sent processed image", async () => {
  const f = await fixture(),
    image = await f.image();
  const before = (
    await native.admin.query<{ kind: string; key: string }>(
      "SELECT kind,object_key AS key FROM treido.message_attachment_objects WHERE attachment_id=$1 ORDER BY kind",
      [image.id],
    )
  ).rows;
  expect(before).toHaveLength(2);
  const source = before.find((row) => row.kind === "source")!;
  const ready = before.find((row) => row.kind === "ready")!;
  expect(f.objects.has(source.key)).toBe(true);
  expect(
    await purgeAttachmentObjects(context.database, f.storage, image.id),
  ).toEqual({ deleted: 1, pending: 0 });
  expect(f.objects.has(source.key)).toBe(false);
  expect(f.objects.has(ready.key)).toBe(true);
  expect(
    (
      await deliverAttachment(
        context.database,
        f.buyer.identity,
        { ...image.scope, id: image.id, revision: 1 },
        f.storage,
      )
    ).length,
  ).toBeGreaterThan(0);
  expect(
    (
      await native.admin.query(
        "SELECT state FROM treido.message_attachments WHERE id=$1",
        [image.id],
      )
    ).rows[0].state,
  ).toBe("ready");
});

it("legacy session receipts reject null, missing, wrong, expired and already consumed leases", async () => {
  const f = await fixture(),
    id = randomUUID(),
    token = randomUUID();
  await native.admin.query(
    "INSERT INTO treido.account_lifecycle_effects(id,user_id,binding_id,subject,kind,target,target_hash,operation_key,due_at) VALUES($1,$2,$3,$4,'session.revoke',$5,$6,$7,clock_timestamp())",
    [
      id,
      f.buyer.userId,
      f.rules.bindingId,
      f.buyer.identity.subject,
      { sessionId: "sess_synthetic_review" },
      "a".repeat(64),
      randomUUID(),
    ],
  );
  const record = (lease: string | null) =>
    native.runtime.query(
      "SELECT treido.account_record_effect($1,$2,'confirmed',$3,'provider')",
      [id, lease, "b".repeat(64)],
    );
  await expect(record(null)).rejects.toMatchObject({ code: "23514" });
  await expect(record(token)).rejects.toMatchObject({ code: "23514" });
  await expect(
    native.runtime.query(
      "SELECT treido.account_claim_effect($1,NULL,NULL,NULL)",
      [id],
    ),
  ).rejects.toMatchObject({ code: "23514" });
  expect(
    (
      await native.admin.query(
        "SELECT state FROM treido.account_lifecycle_effects WHERE id=$1",
        [id],
      )
    ).rows[0].state,
  ).toBe("prepared");
  expect(
    (
      await native.runtime.query(
        "SELECT treido.account_claim_effect($1,$2,NULL,NULL) AS claim",
        [id, token],
      )
    ).rows[0].claim.claimed,
  ).toBe(true);
  await expect(record(randomUUID())).rejects.toMatchObject({ code: "23514" });
  await native.admin.query(
    "UPDATE treido.account_lifecycle_effects SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",
    [id],
  );
  await expect(record(token)).rejects.toMatchObject({ code: "23514" });
  const fresh = randomUUID();
  await native.runtime.query(
    "SELECT treido.account_claim_effect($1,$2,NULL,NULL)",
    [id, fresh],
  );
  await record(fresh);
  await expect(record(fresh)).rejects.toMatchObject({ code: "23514" });
  expect(
    (
      await native.admin.query(
        "SELECT count(*)::int AS n FROM treido.account_effect_observations WHERE effect_id=$1",
        [id],
      )
    ).rows[0].n,
  ).toBe(1);
});

it("optional-data removal cannot execute from an unclaimed accepted effect with a null token", async () => {
  const f = await fixture(),
    plan = await f.review();
  await f.accept(plan);
  const id = randomUUID();
  await native.admin.query(
    "INSERT INTO treido.account_lifecycle_effects(id,user_id,plan_id,binding_id,subject,kind,target,target_hash,operation_key,due_at) VALUES($1,$2,$3,$4,$5,'data.remove',$6,$7,$8,clock_timestamp())",
    [
      id,
      f.buyer.userId,
      plan.id,
      f.rules.bindingId,
      f.buyer.identity.subject,
      { category: "library" },
      "c".repeat(64),
      randomUUID(),
    ],
  );
  await expect(
    native.runtime.query(
      "SELECT treido.account_remove_optional_data($1,NULL)",
      [id],
    ),
  ).rejects.toMatchObject({ code: "23514" });
  expect(
    (
      await native.admin.query(
        "SELECT state,first_attempt_at FROM treido.account_lifecycle_effects WHERE id=$1",
        [id],
      )
    ).rows[0],
  ).toEqual({ state: "prepared", first_attempt_at: null });
});

it.each(["io", "receipt"])(
  "replacement closure executor cannot inherit an earlier effect lease: %s",
  async (operation) => {
    const f = await fixture();
    await f.image();
    await f.approve();
    const proof = await f.accept(await f.review());
    const effect = proof.effects[0];
    const lease = await claim(effect.id, proof);
    expect(lease.result.claimed).toBe(true);
    // A separate administrator connection models expiry and genuine redelivery;
    // the original effect's lease has not expired or been handed to the new job.
    await native.admin.query(
      "UPDATE treido.job_effects SET execution_until=clock_timestamp()-interval '1 second' WHERE job_id=$1",
      [proof.jobId],
    );
    await native.admin.query(
      "UPDATE treido.job_effects SET execution_token=$2,execution_until=clock_timestamp()+interval '5 minutes' WHERE job_id=$1",
      [proof.jobId, randomUUID()],
    );
    const request =
      operation === "io"
        ? native.runtime.query(
            "SELECT treido.account_message_image_io($1,$2)",
            [effect.id, lease.token],
          )
        : native.runtime.query(
            "SELECT treido.account_record_effect($1,$2,'confirmed',$3,'provider')",
            [effect.id, lease.token, "a".repeat(64)],
          );
    await expect(request).rejects.toMatchObject({ code: "23514" });
    expect(
      (
        await native.admin.query(
          "SELECT state FROM treido.account_lifecycle_effects WHERE id=$1",
          [effect.id],
        )
      ).rows[0].state,
    ).toBe("attempting");
  },
);

it("original image executor provenance is immutable and unavailable to runtime SQL", async () => {
  const f = await fixture();
  await f.image();
  await f.approve();
  const proof = await f.accept(await f.review());
  const effect = proof.effects[0];
  const lease = await claim(effect.id, proof);
  expect(lease.result.claimed).toBe(true);
  expect(
    (
      await native.admin.query(
        "SELECT job_id,execution_token FROM treido.message_image_execution_leases WHERE effect_id=$1 AND effect_token=$2",
        [effect.id, lease.token],
      )
    ).rows,
  ).toEqual([{ job_id: proof.jobId, execution_token: proof.executionToken }]);
  for (const statement of [
    "SELECT * FROM treido.message_image_execution_leases",
    "INSERT INTO treido.message_image_execution_leases(effect_id,effect_token,job_id,execution_token) VALUES(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid())",
    "UPDATE treido.message_image_execution_leases SET execution_token=gen_random_uuid()",
    "DELETE FROM treido.message_image_execution_leases",
  ])
    await expect(native.runtime.query(statement)).rejects.toMatchObject({
      code: "42501",
    });
  await expect(
    native.admin.query(
      "UPDATE treido.message_image_execution_leases SET execution_token=$1 WHERE effect_id=$2",
      [randomUUID(), effect.id],
    ),
  ).rejects.toMatchObject({ code: "23514" });
});
