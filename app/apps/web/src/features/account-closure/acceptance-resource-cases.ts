import { describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import {
  createLifecycleActor,
  createLifecycleRegistry,
  createLifecyclePlan,
  type LifecycleNativeContext,
} from "../../../../../tests/t61/lifecycle-fixture";
import { createListingDraft } from "../selling/drafts.server";
import { emptyDraft } from "../selling/draft-model";
import {
  createMediaIntent,
  completeMediaUpload,
  processMediaJob,
} from "../selling/media.server";
import type { MediaStorage } from "../../server/media/storage.server";
import { executeJob } from "../../server/jobs/execution.server";
import { jobColumns, type SellerJobRow } from "../../server/jobs/outbox.server";
import { changeClosure } from "./commands.server";
import { actorKey, type PlanPayload } from "./storage.server";
import { inputHash } from "../sellers/persistence.server";

export function defineAcceptanceResourceCases(
  get: () => LifecycleNativeContext,
) {
  const scope = "a".repeat(64);
  const prepare = async () => {
    const context = get(),
      owner = await createLifecycleActor(context, true),
      registry = await createLifecycleRegistry(context);
    const policyId = randomUUID();
    const value = {
      ...registry.value,
      version: "t71-" + policyId,
      rules: registry.value.rules.map((rule) =>
        rule.category === "personalMedia"
          ? {
              ...rule,
              handling: "remove" as const,
              trigger: "closure" as const,
              delaySeconds: 0,
            }
          : rule,
      ),
    };
    await context.admin.query(
      `INSERT INTO treido.account_closure_policies(id,version,payload,approved_at) VALUES($1,$2,$3::jsonb,clock_timestamp())`,
      [policyId, value.version, JSON.stringify(value)],
    );
    const bindingId = randomUUID();
    await context.admin.query(
      `INSERT INTO treido.account_lifecycle_bindings(id,environment,application_id,clerk_instance_id,clerk_mode,media_scope,media_unversioned,assistant_lifecycle_version,aftercare_lifecycle_version,security_enabled,closure_enabled,approved_at) SELECT $2,environment,application_id,clerk_instance_id,clerk_mode,$3,true,assistant_lifecycle_version,aftercare_lifecycle_version,security_enabled,closure_enabled,clock_timestamp() FROM treido.account_lifecycle_bindings WHERE id=$1`,
      [registry.bindingId, bindingId, scope],
    );
    const rules = {
      ...registry,
      policyId,
      bindingId,
      value,
      binding: {
        ...registry.binding,
        id: bindingId,
        mediaScope: scope,
        mediaUnversioned: true,
      },
    };
    const draft = await createListingDraft(context.database, owner.identity, {
      sellerId: owner.sellerId,
      requestId: randomUUID(),
      payload: { ...emptyDraft },
    });
    const plan = await createLifecyclePlan(context, owner, rules);
    return { context, owner, rules, draft, plan };
  };
  const upload = async (f: Awaited<ReturnType<typeof prepare>>) => {
    const bytes = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    const objects = new Map<string, Buffer>();
    const storage: MediaStorage = {
      scope,
      prefix: "t71/",
      remove: async (key) => {
        objects.delete(key);
      },
      upload: async (key) => {
        objects.set(key, bytes);
        return { url: "http://local.invalid", headers: {} };
      },
      head: async (key) => ({
        bytes: objects.get(key)!.length,
        etag: "synthetic-etag",
      }),
      freeze: async (source, _etag, destination) => {
        objects.set(destination, objects.get(source)!);
      },
      read: async (key) => objects.get(key)!,
      put: async (key, body) => {
        objects.set(key, body);
      },
    };
    const intent = await createMediaIntent(
      f.context.database,
      f.owner.identity,
      {
        sellerId: f.draft.sellerId,
        draftId: f.draft.id,
        requestId: randomUUID(),
        bytes: bytes.length,
        contentType: "image/png",
        checksum: createHash("sha256").update(bytes).digest("hex"),
      },
      storage,
    );
    await completeMediaUpload(
      f.context.database,
      f.owner.identity,
      {
        sellerId: f.draft.sellerId,
        draftId: f.draft.id,
        assetId: intent.assetId,
      },
      storage,
    );
    const job = (
      await f.context.admin.query<SellerJobRow>(
        `SELECT ${jobColumns} FROM treido.outbox_jobs WHERE kind='media.process' AND resource_id=$1`,
        [intent.assetId],
      )
    ).rows[0];
    const namespace = {
      environment: "test",
      applicationId: "treido-t71-isolated",
    };
    expect(
      await executeJob(
        f.context.database,
        {
          ...namespace,
          schemaVersion: 1,
          jobId: job.id,
          sellerId: job.sellerId,
          generation: job.generation,
        },
        namespace,
        "t71-process-photo",
        {
          "media.process": (ctx) =>
            processMediaJob(f.context.database, ctx, storage),
        },
      ),
    ).toMatchObject({ status: "completed" });
    await f.context.admin.query(
      `UPDATE treido.media_storage_objects SET write_until=clock_timestamp()-interval '1 second',retain_until=clock_timestamp()-interval '1 second' WHERE asset_id=$1`,
      [intent.assetId],
    );
    return intent.assetId;
  };
  const confirm = (f: Awaited<ReturnType<typeof prepare>>, plan = f.plan) =>
    changeClosure(f.context.database, f.owner.identity, {
      version: 1,
      actorKey: actorKey(f.owner.identity),
      requestId: randomUUID(),
      expectedRevision: 0,
      operation: {
        kind: "confirm",
        planId: plan.id,
        planHash: plan.hash,
        acknowledged: true,
      },
    });
  const noEffects = async (f: Awaited<ReturnType<typeof prepare>>) => {
    expect(
      (
        await f.context.admin.query(
          `SELECT state,accepted_at,(SELECT count(*)::int FROM treido.account_lifecycle_effects WHERE plan_id=p.id) AS effects,(SELECT count(*)::int FROM treido.outbox_jobs WHERE kind='account.closure' AND resource_id=p.id) AS jobs,(SELECT count(*)::int FROM treido.account_lifecycle_receipts WHERE user_id=p.user_id) AS receipts FROM treido.account_execution_plans p WHERE id=$1`,
          [f.plan.id],
        )
      ).rows[0],
    ).toEqual({
      state: "reviewed",
      accepted_at: null,
      effects: 0,
      jobs: 0,
      receipts: 0,
    });
    expect(
      (
        await f.context.admin.query(
          `SELECT status FROM treido.users WHERE id=$1`,
          [f.owner.userId],
        )
      ).rows[0].status,
    ).toBe("active");
  };
  describe("T71 closure cleanup inventory under canonical acceptance locks", () => {
    it("rejects review/upload/process/lease-expiry at command and direct SQL; rereview freezes every new object", async () => {
      const f = await prepare(),
        assetId = await upload(f);
      expect(
        (
          await f.context.admin.query(
            `SELECT treido.account_closure_obligations($1::uuid)->>'mediaWriters' AS writers`,
            [f.owner.userId],
          )
        ).rows[0].writers,
      ).toBe("0");
      await expect(confirm(f)).rejects.toMatchObject({ code: "CONFLICT" });
      await noEffects(f);
      await expect(
        f.context.database.pool.query(
          `SELECT treido.account_accept_closure($1::uuid,$2::uuid,$3::text,$4::uuid)`,
          [f.owner.userId, f.plan.id, f.plan.hash, randomUUID()],
        ),
      ).rejects.toMatchObject({ code: "23514" });
      await noEffects(f);
      const fresh = await createLifecyclePlan(f.context, f.owner, f.rules);
      const payload = (
        await f.context.admin.query<{ payload: PlanPayload }>(
          `SELECT payload FROM treido.account_execution_plans WHERE id=$1`,
          [fresh.id],
        )
      ).rows[0].payload;
      const current = (
        await f.context.admin.query(
          `SELECT object_key FROM treido.media_storage_objects WHERE asset_id=$1 AND state<>'deleted' ORDER BY object_key`,
          [assetId],
        )
      ).rows
        .map((row) => row.object_key)
        .sort();
      expect(current).toHaveLength(3);
      expect(
        payload.targets
          .filter((t) => t.kind === "media.delete")
          .map((t) => t.target.objectKey)
          .sort(),
      ).toEqual(current);
      expect(payload.cleanupResources).toHaveLength(3);
      await confirm(f, fresh);
      expect(
        (
          await f.context.admin.query(
            `SELECT count(*)::int AS n FROM treido.account_lifecycle_effects WHERE plan_id=$1 AND kind='media.delete' AND state='prepared'`,
            [fresh.id],
          )
        ).rows[0].n,
      ).toBe(3);
      const job = (
        await f.context.admin.query(
          `SELECT id FROM treido.outbox_jobs WHERE kind='account.closure' AND resource_id=$1`,
          [fresh.id],
        )
      ).rows[0];
      const token = randomUUID();
      await f.context.admin.query(
        `UPDATE treido.job_effects SET state='running',execution_token=$2,execution_until=clock_timestamp()+interval '1 minute',executor_run_id='t71-pending-cleanup' WHERE job_id=$1`,
        [job.id, token],
      );
      await expect(
        f.context.database.pool.query(
          `SELECT treido.account_finish_closure($1::uuid,$2::uuid,$3::uuid,$4::uuid)`,
          [f.owner.userId, fresh.id, job.id, token],
        ),
      ).rejects.toMatchObject({ code: "23514" });
    });
    it.each(["key", "scope", "revision"])(
      "rejects changed resource %s after a complete review",
      async (kind) => {
        const f = await prepare(),
          assetId = await upload(f),
          plan = await createLifecyclePlan(f.context, f.owner, f.rules);
        f.plan = plan;
        if (kind === "revision")
          await f.context.admin.query(
            `UPDATE treido.media_assets SET revision=revision+1 WHERE id=$1`,
            [assetId],
          );
        else if (kind === "key")
          await f.context.admin.query(
            `UPDATE treido.media_storage_objects SET object_key=object_key||'_changed' WHERE asset_id=$1 AND kind='ready'`,
            [assetId],
          );
        else
          await f.context.admin.query(
            `UPDATE treido.media_storage_objects SET storage_scope=$2 WHERE asset_id=$1 AND kind='ready'`,
            [assetId, "b".repeat(64)],
          );
        await expect(confirm(f)).rejects.toMatchObject({ code: "CONFLICT" });
        await noEffects(f);
      },
    );
    it("accepts unchanged empty cleanup inventories", async () => {
      const f = await prepare();
      expect((await confirm(f)).acknowledgment.state).toBe("accepted");
    });
    it("requires a new review for legacy removal plans without a cleanup snapshot", async () => {
      const f = await prepare();
      const payload = (
        await f.context.admin.query<{ payload: PlanPayload }>(
          `SELECT payload FROM treido.account_execution_plans WHERE id=$1`,
          [f.plan.id],
        )
      ).rows[0].payload;
      delete payload.cleanupResources;
      const id = randomUUID(),
        hash = inputHash(payload);
      await f.context.database.pool.query(
        `INSERT INTO treido.account_execution_plans(id,user_id,closure_request_id,policy_id,binding_id,plan_hash,payload,state,created_at,expires_at) SELECT $2,user_id,closure_request_id,policy_id,binding_id,$3,$4::jsonb,'reviewed',created_at,expires_at FROM treido.account_execution_plans WHERE id=$1`,
        [f.plan.id, id, hash, JSON.stringify(payload)],
      );
      f.plan = { id, hash };
      await expect(confirm(f)).rejects.toMatchObject({ code: "CONFLICT" });
      await noEffects(f);
    });
  });
}
