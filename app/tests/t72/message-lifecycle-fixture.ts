import { randomUUID } from "node:crypto";
import sharp from "../../apps/web/node_modules/sharp";
import {
  createLifecycleActor,
  createLifecycleRegistry,
  createLifecyclePlan,
  type LifecycleNativeContext,
} from "../t61/lifecycle-fixture";
import { createBusinessSeller } from "../../apps/web/src/features/sellers/persistence.server";
import { createListingDraft } from "../../apps/web/src/features/selling/drafts.server";
import { emptyDraft } from "../../apps/web/src/features/selling/draft-model";
import { seedPublishedSnapshot } from "../../apps/web/tests/fixtures/published-listing";
import {
  openListingConversation,
  sendConversationMessage,
} from "../../apps/web/src/features/messaging/participants.server";
import { createAttachmentStorage } from "../../apps/web/src/features/message-attachments/storage.server";
import {
  stageAttachment,
  uploadAttachment,
} from "../../apps/web/src/features/message-attachments/commands.server";
import { checksumOf } from "../../apps/web/src/features/message-attachments/raster.server";
import {
  processAttachmentJob,
  type AttachmentJob,
} from "../../apps/web/src/features/message-attachments/jobs.server";
import { executeJob } from "../../apps/web/src/server/jobs/execution.server";
import { inTransaction } from "../../apps/web/src/server/db/database";
import {
  approvedBinding,
  type PlanPayload,
  type EffectRow,
  effectColumns,
} from "../../apps/web/src/features/account-closure/storage.server";
import { createPlanEffects } from "../../apps/web/src/features/account-closure/planning.server";
import type { MediaStorage } from "../../apps/web/src/server/media/storage.server";

export async function imageLifecycleFixture(
  context: LifecycleNativeContext,
  handling: "retain" | "remove" = "remove",
) {
  const buyer = await createLifecycleActor(context, true),
    counterpart = await createLifecycleActor(context);
  const sellerId = await createBusinessSeller(
    context.database,
    counterpart.identity,
    { name: "Synthetic image counterpart", requestId: randomUUID() },
  );
  const listing = await createListingDraft(
    context.database,
    counterpart.identity,
    {
      sellerId,
      requestId: randomUUID(),
      payload: {
        ...emptyDraft,
        categoryId: "cat:electronics/phones",
        condition: "good",
      },
    },
  );
  await context.admin.query(
    "UPDATE treido.category_policies SET state='reviewed',enabled_for_publish=true,review_reference='SYNTHETIC LOCAL IMAGE TEST',reviewed_at=now() WHERE category_id='cat:electronics/phones' AND version=1",
  );
  await seedPublishedSnapshot(context.admin, listing.id);
  const threadId = (
    await openListingConversation(context.database, buyer.identity, listing.id)
  ).id;
  const objects = new Map<string, Buffer>();
  const base: MediaStorage = {
    scope: "a".repeat(64),
    prefix: "test-private/",
    read: async (key) => {
      if (!objects.has(key)) throw Error("Missing local bytes");
      return objects.get(key)!;
    },
    put: async (key, bytes) => {
      objects.set(key, Buffer.from(bytes));
    },
    remove: async (key) => {
      objects.delete(key);
    },
    head: async () => {
      throw Error("Unused local method");
    },
    freeze: async () => {
      throw Error("Unused local method");
    },
    upload: async () => {
      throw Error("Unused local method");
    },
  };
  const storage = createAttachmentStorage(base);
  const png = await sharp({
    create: { width: 12, height: 8, channels: 3, background: "blue" },
  })
    .png()
    .toBuffer();
  async function image(
    author = buyer,
    operatingSellerId: string | null = null,
    linked = true,
    targetThreadId = threadId,
  ) {
    const scope = { threadId: targetThreadId, sellerId: operatingSellerId };
    const staged = await stageAttachment(
      context.database,
      author.identity,
      {
        ...scope,
        requestId: randomUUID(),
        bytes: png.length,
        checksum: checksumOf(png),
        contentType: "image/png",
      },
      storage,
    );
    await uploadAttachment(
      context.database,
      author.identity,
      { ...scope, id: staged.id, revision: staged.revision },
      png,
      storage,
    );
    const job = (
      await context.admin.query(
        'SELECT id,kind,seller_id AS "sellerId",buyer_id AS "buyerId",resource_id AS "resourceId",operation_key AS "operationKey",actor_id AS "actorId",authority,generation FROM treido.outbox_jobs WHERE kind=\'message-attachment.process\' AND resource_id=$1',
        [staged.id],
      )
    ).rows[0] as AttachmentJob;
    const namespace = { environment: "test", applicationId: "treido-t73-native" };
    await executeJob(
      context.database,
      {
        schemaVersion: 1,
        jobId: job.id,
        sellerId: job.sellerId,
        generation: job.generation,
        ...namespace,
      },
      namespace,
      "image-fixture:" + randomUUID(),
      {
        "message-attachment.process": (job) =>
          processAttachmentJob(context.database, job, storage),
      },
    );
    const message = linked
      ? await sendConversationMessage(
          context.database,
          author.identity,
          {
            threadId: targetThreadId,
            requestId: randomUUID(),
            body: "Own authored synthetic text",
            attachmentIds: [staged.id],
          },
          { sellerId: operatingSellerId },
        )
      : null;
    // Time travel belongs only to isolated admin fixture preparation, before review.
    await context.admin.query(
      "ALTER TABLE treido.message_attachment_objects DISABLE TRIGGER message_attachment_object_original",
    );
    try {
      await context.admin.query(
        "UPDATE treido.message_attachment_objects SET write_until=now()-interval '2 days',retain_until=now()-interval '1 day' WHERE attachment_id=$1",
        [staged.id],
      );
    } finally {
      await context.admin.query(
        "ALTER TABLE treido.message_attachment_objects ENABLE TRIGGER message_attachment_object_original",
      );
    }
    return { id: staged.id, messageId: message?.id, scope };
  }
  const registry = await createLifecycleRegistry(context);
  const bindingId = randomUUID();
  await context.admin.query(
    `INSERT INTO treido.account_lifecycle_bindings(id,environment,application_id,clerk_instance_id,clerk_mode,assistant_lifecycle_version,aftercare_lifecycle_version,security_enabled,closure_enabled,approved_at,media_scope,media_unversioned)
    SELECT $2,environment,application_id,clerk_instance_id,clerk_mode,assistant_lifecycle_version,aftercare_lifecycle_version,security_enabled,closure_enabled,clock_timestamp(),$3,true FROM treido.account_lifecycle_bindings WHERE id=$1`,
    [registry.bindingId, bindingId, base.scope],
  );
  const rules = {
    ...registry,
    bindingId,
    binding: await inTransaction(context.database, (tx) =>
      approvedBinding(tx, bindingId),
    ),
  };
  const ruleId = randomUUID();
  async function approve() {
    await context.admin.query(
      `INSERT INTO treido.message_image_lifecycle_policies(id,version,policy_id,binding_id,storage_scope,handling,delay_seconds,description,preserves_business,preserves_counterpart,preserves_case_commerce,legal_holds_reviewed,approved_at,approval_reference)
      VALUES($1,'message-image-lifecycle-v1',$2,$3,$4,$5,$6,$7,true,true,true,true,clock_timestamp(),'SYNTHETIC ISOLATED LOCAL RULE ONLY')`,
      [
        ruleId,
        rules.policyId,
        bindingId,
        storage.scope,
        handling,
        handling === "remove" ? 0 : null,
        {
          en: "Synthetic explicitly reviewed communication rule",
          bg: "Синтетично прегледано правило за комуникация",
        },
      ],
    );
  }
  const review = () => createLifecyclePlan(context, buyer, rules);
  async function personalConversation() {
    const draft = await createListingDraft(context.database, buyer.identity, {
      sellerId: buyer.sellerId!,
      requestId: randomUUID(),
      payload: {
        ...emptyDraft,
        categoryId: "cat:electronics/phones",
        condition: "good",
      },
    });
    await seedPublishedSnapshot(context.admin, draft.id);
    return (
      await openListingConversation(
        context.database,
        counterpart.identity,
        draft.id,
      )
    ).id;
  }
  async function accept(plan: { id: string; hash: string }) {
    await context.database.pool.query(
      "SELECT treido.account_accept_closure($1,$2,$3,$4)",
      [buyer.userId, plan.id, plan.hash, randomUUID()],
    );
    const payload = (
      await context.admin.query<{ payload: PlanPayload }>(
        "SELECT payload FROM treido.account_execution_plans WHERE id=$1",
        [plan.id],
      )
    ).rows[0].payload;
    await inTransaction(context.database, (tx) =>
      createPlanEffects(tx, plan.id, buyer.userId, payload),
    );
    const jobId = (
      await context.database.pool.query<{ id: string }>(
        "SELECT treido.account_enqueue_closure($1) AS id",
        [plan.id],
      )
    ).rows[0].id;
    const executionToken = randomUUID();
    // Genuine durable service lease, with the exact original enqueued job identity.
    await context.admin.query(
      "UPDATE treido.job_effects SET state='running',execution_token=$2,execution_until=clock_timestamp()+interval '5 minutes',executor_run_id='synthetic-local-service' WHERE job_id=$1",
      [jobId, executionToken],
    );
    const effects = (
      await context.admin.query<EffectRow>(
        "SELECT " +
          effectColumns +
          " FROM treido.account_lifecycle_effects WHERE plan_id=$1 ORDER BY id",
        [plan.id],
      )
    ).rows;
    return { jobId, executionToken, effects, payload };
  }
  return {
    context,
    buyer,
    counterpart,
    sellerId,
    threadId,
    listingId: listing.id,
    objects,
    base,
    storage,
    png,
    image,
    approve,
    ruleId,
    rules,
    review,
    personalConversation,
    accept,
  };
}
