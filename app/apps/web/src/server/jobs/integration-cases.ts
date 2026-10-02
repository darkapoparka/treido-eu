import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import { inTransaction, type SellerDatabase } from "../db/database";
import {
  createBusinessSeller,
  authorizeSeller,
  revokeSellerMembership,
} from "../../features/sellers/persistence.server";
import {
  enqueueJob,
  leaseJobs,
  recordHandoff,
  releaseDispatch,
  redriveJob,
} from "./outbox.server";
import { executeJob, markExecutorFailure } from "./execution.server";
import { dispatchOutbox } from "./dispatch.server";
import { JOB_EVENT, type JobAuthority, type JobEvent } from "./model";

export function defineJobIntegrationCases(
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
    origin: "http://127.0.0.1:6419",
    repairServiceId: "test-repair",
  };
  const event = (
    jobId: string,
    sellerId: string,
    generation = 1,
  ): JobEvent => ({
    jobId,
    sellerId,
    generation,
    schemaVersion: 1,
    ...{
      environment: binding.environment,
      applicationId: binding.applicationId,
    },
  });
  async function create(authority: JobAuthority = "service") {
    const { database, owner } = get();
    const sellerId = await createBusinessSeller(database, owner, {
      name: "Job test",
      requestId: randomUUID(),
    });
    const resourceId = randomUUID(),
      operationKey = randomUUID();
    const intent = await inTransaction(database, async (tx) => {
      const { user } = await authorizeSeller(
        tx,
        owner,
        sellerId,
        "listing.write",
      );
      return {
        kind: "system.probe" as const,
        sellerId,
        resourceId,
        operationKey,
        authority,
        actorId: authority === "member" ? user.id : null,
      };
    });
    const jobId = await inTransaction(database, (tx) => enqueueJob(tx, intent));
    return {
      jobId,
      sellerId,
      resourceId,
      intent,
      event: event(jobId, sellerId),
    };
  }
  async function state(jobId: string) {
    return (
      await get().admin.query(
        "SELECT state,generation,attempts,last_error FROM treido.outbox_jobs WHERE id=$1",
        [jobId],
      )
    ).rows[0];
  }
  async function lease(jobId: string) {
    await get().admin.query(
      "UPDATE treido.outbox_jobs SET available_at=clock_timestamp()-interval '1 second' WHERE id=$1",
      [jobId],
    );
    const jobs = await leaseJobs(get().database);
    const target = jobs.find((job) => job.id === jobId);
    expect(target).toBeDefined();
    return target!;
  }
  describe("durable jobs with native PostgreSQL and the runtime role", () => {
    it("rolls back domain writes and outbox intent together", async () => {
      const item = await create();
      const key = randomUUID();
      await expect(
        inTransaction(get().database, async (tx) => {
          await tx.client.query(
            "UPDATE treido.seller_accounts SET name='rollback' WHERE id=$1",
            [item.sellerId],
          );
          await enqueueJob(tx, { ...item.intent, operationKey: key });
          throw new Error("crash before commit");
        }),
      ).rejects.toThrow("crash before commit");
      expect(
        (
          await get().admin.query(
            "SELECT name FROM treido.seller_accounts WHERE id=$1",
            [item.sellerId],
          )
        ).rows[0].name,
      ).toBe("Job test");
      expect(
        (
          await get().admin.query(
            "SELECT id FROM treido.outbox_jobs WHERE operation_key=$1",
            [key],
          )
        ).rowCount,
      ).toBe(0);
    });
    it("concurrent identical retries claim one job and reject changed intent", async () => {
      const item = await create();
      const results = await Promise.all(
        [1, 2].map(() =>
          inTransaction(get().database, (tx) => enqueueJob(tx, item.intent)),
        ),
      );
      expect(results).toEqual([item.jobId, item.jobId]);
      await expect(
        inTransaction(get().database, (tx) =>
          enqueueJob(tx, { ...item.intent, resourceId: randomUUID() }),
        ),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });
    it("recovers a committed job after a crash before dispatch", async () => {
      const item = await create();
      const leased = await lease(item.jobId);
      expect(leased.attempts).toBe(1);
      expect((await state(item.jobId)).state).toBe("pending");
      expect(
        await recordHandoff(get().database, leased, "accepted-event-1"),
      ).toBe(true);
      expect((await state(item.jobId)).state).toBe("accepted");
      expect(
        (
          await get().admin.query(
            "SELECT state FROM treido.job_effects WHERE job_id=$1",
            [item.jobId],
          )
        ).rows[0].state,
      ).toBe("pending");
    });
    it("two dispatchers lease disjoint rows and respect an active lease", async () => {
      const item = await create();
      const groups = await Promise.all([
        leaseJobs(get().database, 1),
        leaseJobs(get().database, 1),
      ]);
      expect(new Set(groups.flat().map((job) => job.id)).size).toBe(
        groups.flat().length,
      );
      const claimed = groups.flat().some((job) => job.id === item.jobId);
      if (!claimed) await lease(item.jobId);
      expect(
        (await leaseJobs(get().database)).some((job) => job.id === item.jobId),
      ).toBe(false);
    });
    it("reclaims expired leases and rejects late handoff acknowledgements", async () => {
      const item = await create(),
        first = await lease(item.jobId);
      await get().admin.query(
        "UPDATE treido.outbox_jobs SET dispatch_until=clock_timestamp()-interval '1 second' WHERE id=$1",
        [item.jobId],
      );
      const second = await lease(item.jobId);
      expect(second.dispatchToken).not.toBe(first.dispatchToken);
      expect(await recordHandoff(get().database, first, "old-acceptance")).toBe(
        false,
      );
      expect(
        await recordHandoff(get().database, second, "new-acceptance"),
      ).toBe(true);
    });
    it("redelivers the same minimized event after executor acceptance precedes local acknowledgement", async () => {
      const item = await create();
      const events: unknown[] = [];
      const first = await lease(item.jobId);
      // Simulate send success, then process death before recordHandoff.
      events.push({ id: `${item.jobId}:1`, name: JOB_EVENT, data: item.event });
      await get().admin.query(
        "UPDATE treido.outbox_jobs SET dispatch_until=clock_timestamp()-interval '1 second' WHERE id=$1",
        [item.jobId],
      );
      await dispatchOutbox(get().database, binding, async (input) => {
        events.push(input);
        return { ids: ["durable-event"] };
      });
      const last = events.at(-1) as { id: string; data: JobEvent };
      expect(last.id).toBe(`${first.id}:1`);
      expect(Object.keys(last.data).sort()).toEqual([
        "applicationId",
        "environment",
        "generation",
        "jobId",
        "schemaVersion",
        "sellerId",
      ]);
      expect((await state(item.jobId)).state).toBe("accepted");
    });
    it("repairs accepted but stalled jobs and never dispatches a running effect", async () => {
      const item = await create();
      await recordHandoff(
        get().database,
        await lease(item.jobId),
        "accepted-stalled",
      );
      expect(
        (await leaseJobs(get().database)).some((job) => job.id === item.jobId),
      ).toBe(false);
      await get().admin.query(
        "UPDATE treido.outbox_jobs SET available_at=clock_timestamp()-interval '1 second' WHERE id=$1",
        [item.jobId],
      );
      expect(
        (await leaseJobs(get().database)).some((job) => job.id === item.jobId),
      ).toBe(true);
    });
    it("duplicate executor callbacks produce one observed durable effect", async () => {
      const item = await create();
      let calls = 0;
      const handlers = {
        "system.probe": async () => {
          calls++;
          return { resultId: item.resourceId };
        },
      };
      expect(
        (
          await executeJob(
            get().database,
            item.event,
            binding,
            "run-one",
            handlers,
          )
        ).status,
      ).toBe("completed");
      expect(
        (
          await executeJob(
            get().database,
            item.event,
            binding,
            "run-two",
            handlers,
          )
        ).status,
      ).toBe("completed");
      expect(calls).toBe(1);
      expect((await state(item.jobId)).state).toBe("completed");
    });
    it("an active execution blocks duplicate execution and dispatch", async () => {
      const item = await create();
      let release!: () => void;
      let entered!: () => void;
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const barrier = new Promise<void>((resolve) => {
        release = resolve;
      });
      const first = executeJob(
        get().database,
        item.event,
        binding,
        "run-blocked",
        {
          "system.probe": async () => {
            entered();
            await barrier;
            return { resultId: item.resourceId };
          },
        },
      );
      await started;
      try {
        await expect(
          executeJob(get().database, item.event, binding, "run-duplicate", {
            "system.probe": async () => ({ resultId: item.resourceId }),
          }),
        ).rejects.toMatchObject({ code: "BUSY" });
        await get().admin.query(
          "UPDATE treido.outbox_jobs SET available_at=clock_timestamp()-interval '1 second' WHERE id=$1",
          [item.jobId],
        );
        expect(
          (await leaseJobs(get().database)).some(
            (job) => job.id === item.jobId,
          ),
        ).toBe(false);
      } finally {
        release();
      }
      expect((await first).status).toBe("completed");
    });
    it("provider-success/local-result failure retries with the original effect key", async () => {
      const item = await create();
      const provider = new Map<string, string>();
      let attempts = 0;
      const handler = async (context: { operationKey: string }) => {
        provider.set(context.operationKey, item.resourceId);
        attempts++;
        if (attempts === 1) throw new Error("crash after provider success");
        return { resultId: provider.get(context.operationKey)! };
      };
      await expect(
        executeJob(get().database, item.event, binding, "run-crash", {
          "system.probe": handler,
        }),
      ).rejects.toThrow("crash");
      expect(
        (
          await executeJob(
            get().database,
            item.event,
            binding,
            "run-reconcile",
            { "system.probe": handler },
          )
        ).status,
      ).toBe("completed");
      expect(provider.size).toBe(1);
    });
    it("revoked discretionary work is cancelled before its handler and on private replay", async () => {
      const item = await create("member");
      const { database, owner, other } = get();
      const userId = (
        await get().admin.query(
          "SELECT id FROM treido.users WHERE clerk_subject=$1",
          [other.subject],
        )
      ).rows[0].id;
      await get().admin.query(
        "INSERT INTO treido.seller_memberships(seller_id,user_id,role,status,grants) VALUES($1,$2,'manager','active','[]')",
        [item.sellerId, userId],
      );
      const jobId = await inTransaction(database, (tx) =>
        enqueueJob(tx, {
          ...item.intent,
          operationKey: randomUUID(),
          actorId: userId,
        }),
      );
      await revokeSellerMembership(database, owner, {
        sellerId: item.sellerId,
        userId,
      });
      let calls = 0;
      expect(
        (
          await executeJob(
            database,
            event(jobId, item.sellerId),
            binding,
            "run-revoked",
            {
              "system.probe": async () => {
                calls++;
                return { resultId: item.resourceId };
              },
            },
          )
        ).status,
      ).toBe("cancelled");
      expect(calls).toBe(0);
    });
    it("service recovery survives staff removal and validates environment/resource identity", async () => {
      const item = await create();
      await expect(
        executeJob(
          get().database,
          { ...item.event, environment: "foreign" },
          binding,
          "wrong-env",
          {},
        ),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
      await expect(
        executeJob(
          get().database,
          { ...item.event, sellerId: randomUUID() },
          binding,
          "wrong-seller",
          {},
        ),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await get().admin.query(
        "UPDATE treido.seller_accounts SET status='restricted' WHERE id=$1",
        [item.sellerId],
      );
      expect(
        (
          await executeJob(
            get().database,
            item.event,
            binding,
            "service-repair",
            { "system.probe": async () => ({ resultId: item.resourceId }) },
          )
        ).status,
      ).toBe("completed");
    });
    it("exhausts bounded dispatch then redrives once with reason and a new event generation", async () => {
      const item = await create(),
        first = await lease(item.jobId);
      await get().admin.query(
        "UPDATE treido.outbox_jobs SET attempts=8 WHERE id=$1",
        [item.jobId],
      );
      expect(await releaseDispatch(get().database, first)).toBe(true);
      expect((await state(item.jobId)).state).toBe("dead");
      const input = {
        jobId: item.jobId,
        expectedGeneration: 1,
        serviceId: "test-repair",
        reason: "Provider recovered after outage",
      };
      expect(await redriveJob(get().database, input)).toEqual({
        jobId: item.jobId,
        generation: 2,
      });
      await expect(redriveJob(get().database, input)).rejects.toMatchObject({
        code: "CONFLICT",
      });
      expect(
        (
          await executeJob(
            get().database,
            item.event,
            binding,
            "old-generation",
            {},
          )
        ).status,
      ).toBe("stale");
      expect(
        (
          await executeJob(
            get().database,
            event(item.jobId, item.sellerId, 2),
            binding,
            "new-generation",
            { "system.probe": async () => ({ resultId: item.resourceId }) },
          )
        ).status,
      ).toBe("completed");
      expect(
        (
          await get().admin.query(
            "SELECT count(*)::int AS count FROM treido.job_redrives WHERE job_id=$1",
            [item.jobId],
          )
        ).rows[0].count,
      ).toBe(1);
    });
    it("terminal executor failure leaves a dead letter and immutable audit", async () => {
      const item = await create();
      await markExecutorFailure(get().database, item.event, binding);
      expect((await state(item.jobId)).state).toBe("dead");
      await redriveJob(get().database, {
        jobId: item.jobId,
        expectedGeneration: 1,
        serviceId: "test-repair",
        reason: "Reviewed poison job configuration",
      });
      await expect(
        get().database.pool.query(
          "UPDATE treido.job_redrives SET reason='hide failure' WHERE job_id=$1",
          [item.jobId],
        ),
      ).rejects.toMatchObject({ code: "42501" });
    });
  });
}
