import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { inTransaction, type SellerDatabase, type SellerTransaction } from "../../apps/web/src/server/db/database";
import { executeJob, type EffectResult, type JobHandlers } from "../../apps/web/src/server/jobs/execution.server";
import type { JobEvent } from "../../apps/web/src/server/jobs/model";
import type { MediaStorage } from "../../apps/web/src/server/media/storage.server";
import { processClosureJob } from "../../apps/web/src/features/account-closure/jobs.server";
import { processSavedSearchJob } from "../../apps/web/src/features/saved-searches/jobs.server";
import { processMediaJob } from "../../apps/web/src/features/selling/media.server";
import { processPaymentObservation } from "../../apps/web/src/features/payments/jobs.server";
import { processOrderRefund } from "../../apps/web/src/features/order-aftercare/jobs.server";

export const executorCompletionKinds = ["account.closure", "buyer.saved-search", "media.process", "payment.reconcile", "payment.aftercare"] as const;
export type ExecutorCompletionKind = (typeof executorCompletionKinds)[number];
export type ExecutorCompletionFixture = {
  database: SellerDatabase;
  admin: Pool;
  event: JobEvent;
  binding: { environment: string; applicationId: string };
  // Only the original MediaStorage boundary is supplied, never a fake processor.
  mediaStorage?: MediaStorage;
  domainSnapshot: (tx: SellerTransaction) => Promise<unknown>;
  assertApplied: (before: unknown, after: unknown) => void;
};

/** Registered in remediation.integration.ts with fresh actual native relational fixtures
 * and original feature processors for EACH kind/case after canonical adoption.
 * Saved-search fixtures must actually generate their original notifications;
 * closure fixtures need an accepted original plan with all effects confirmed;
 * media uses real byte processing and only an isolated object transport; payment
 * processors use original SDK/parser through an isolated read transport. These
 * tests qualify local transaction ordering, never a real provider/closure effect.
 */
export function defineExecutorCompletionPersistenceCases(
  get: (kind: ExecutorCompletionKind) => Promise<ExecutorCompletionFixture>,
) {
  const readDomain = (f: ExecutorCompletionFixture) => inTransaction(f.database, f.domainSnapshot);
  const state = async (f: ExecutorCompletionFixture) => (await f.admin.query(
    `SELECT j.kind,j.state AS "jobState",j.generation,j.operation_key AS "operationKey",e.state AS "effectState",e.execution_token AS token,e.execution_until AS until,e.result_id AS "resultId",e.completed_at AS "completedAt" FROM treido.outbox_jobs j JOIN treido.job_effects e ON e.job_id=j.id WHERE j.id=$1`,
    [f.event.jobId],
  )).rows[0];
  const handlers = (f: ExecutorCompletionFixture, instrument: (result: EffectResult) => Promise<EffectResult>): JobHandlers => {
    const original: JobHandlers = {
      "account.closure": context => processClosureJob(f.database, context),
      "buyer.saved-search": context => processSavedSearchJob(f.database, context),
      "media.process": context => {
        if (!f.mediaStorage) throw new Error("Missing explicit isolated media transport");
        return processMediaJob(f.database, context, f.mediaStorage);
      },
      "payment.reconcile": context => processPaymentObservation(f.database, context),
      "payment.aftercare": context => processOrderRefund(f.database, context),
    };
    const wrap = <C,>(handler: ((context: C) => Promise<EffectResult>) | undefined) =>
      handler ? async (context: C) => instrument(await handler(context)) : undefined;
    return {
      "account.closure": wrap(original["account.closure"]),
      "buyer.saved-search": wrap(original["buyer.saved-search"]),
      "media.process": wrap(original["media.process"]),
      "payment.reconcile": wrap(original["payment.reconcile"]),
      "payment.aftercare": wrap(original["payment.aftercare"]),
    };
  };
  const run = (f: ExecutorCompletionFixture, h: JobHandlers) => executeJob(f.database, f.event, f.binding, randomUUID(), h);
  const fixture = async (kind: ExecutorCompletionKind) => {
    const f = await get(kind);
    expect((await state(f)).kind).toBe(kind);
    return f;
  };

  describe("original feature completion through the shared native executor", () => {
    for (const kind of executorCompletionKinds) {
      it(`${kind}: applies under the original live lease, completes atomically and replays without another handler`, async () => {
        const f = await fixture(kind), before = await readDomain(f), initial = await state(f);
        let calls = 0, applies = 0;
        const h = handlers(f, async result => {
          calls++;
          expect(result.apply).toBeTypeOf("function");
          return { ...result, apply: async tx => {
            const live = (await tx.client.query(`SELECT state,execution_token,execution_until>clock_timestamp() AS live FROM treido.job_effects WHERE job_id=$1`, [f.event.jobId])).rows[0];
            expect(live).toMatchObject({ state: "running", live: true });
            expect(live.execution_token).toBeTypeOf("string");
            applies++;
            await result.apply?.(tx);
          } };
        });
        expect((await run(f, h)).status).toBe("completed");
        const after = await readDomain(f), completed = await state(f);
        f.assertApplied(before, after);
        expect(completed).toMatchObject({ jobState: "completed", effectState: "completed", generation: initial.generation, operationKey: initial.operationKey, token: null, until: null });
        expect(completed.completedAt).not.toBeNull();
        expect((await run(f, h)).status).toBe("completed");
        expect(await state(f)).toEqual(completed);
        expect(await readDomain(f)).toEqual(after);
        expect(calls).toBe(1);
        expect(applies).toBe(1);
      });

      it(`${kind}: an error after original local apply rolls back both domain completion and executor receipt`, async () => {
        const f = await fixture(kind);
        let beforeApply: unknown, reached = false;
        const h = handlers(f, async result => ({ ...result, apply: async tx => {
          beforeApply = await f.domainSnapshot(tx);
          reached = true;
          expect(result.apply).toBeTypeOf("function");
          await result.apply?.(tx);
          throw new Error("SYNTHETIC T61 after-local-apply rollback");
        } }));
        await expect(run(f, h)).rejects.toThrow("SYNTHETIC T61 after-local-apply rollback");
        expect(reached).toBe(true);
        expect(await readDomain(f)).toEqual(beforeApply);
        expect(await state(f)).toMatchObject({ effectState: "pending", token: null, until: null, resultId: null, completedAt: null });
        // Original processor IO before apply is intentionally not asserted
        // rolled back; only this shared local completion transaction is atomic.
      });

      for (const fault of ["expired-lease", "new-generation"] as const) {
        it(`${kind}: rejects ${fault} after the original processor and before local apply`, async () => {
          const f = await fixture(kind);
          let applies = 0, beforeApply: unknown, faultApplied = false;
          const h = handlers(f, async result => {
            beforeApply = await readDomain(f);
            // Explicit synthetic native fault, never a shared runtime mutation
            // or a replacement of production redrive/expiry authorization.
            const changed = fault === "expired-lease"
              ? await f.admin.query(`UPDATE treido.job_effects SET execution_until=clock_timestamp()-interval '1 second' WHERE job_id=$1 AND state='running'`, [f.event.jobId])
              : await (async () => {
                const client = await f.admin.connect();
                try {
                  await client.query("BEGIN");
                  // The original lifecycle guard requires the exact prior/next
                  // generation journal even for this explicit owned admin fault.
                  // This does not claim a runtime-authorized live-job redrive.
                  await client.query(`INSERT INTO treido.job_redrives(id,job_id,service_id,reason,from_generation,to_generation)
                    SELECT $2,id,'t61-isolated-admin-fault','SYNTHETIC stale-generation completion boundary',generation,generation+1
                    FROM treido.outbox_jobs WHERE id=$1 AND generation=$3 FOR UPDATE`, [f.event.jobId, randomUUID(), f.event.generation]);
                  const updated = await client.query(`UPDATE treido.outbox_jobs SET generation=generation+1 WHERE id=$1 AND generation=$2`, [f.event.jobId, f.event.generation]);
                  await client.query("COMMIT");
                  return updated;
                } catch (error) { await client.query("ROLLBACK"); throw error; }
                finally { client.release(); }
              })();
            expect(changed.rowCount).toBe(1);
            faultApplied = true;
            return { ...result, apply: async tx => { applies++; await result.apply?.(tx); } };
          });
          await expect(run(f, h)).rejects.toMatchObject({ code: expect.stringMatching(/^(STALE_LEASE|FORBIDDEN)$/) });
          expect(faultApplied).toBe(true);
          expect(applies).toBe(0);
          expect(await readDomain(f)).toEqual(beforeApply);
          const rejected = await state(f);
          expect(rejected.effectState).not.toBe("completed");
          expect(rejected.completedAt).toBeNull();
          if (fault === "new-generation") {
            expect(rejected.generation).toBe(f.event.generation + 1);
            expect((await run(f, h)).status).toBe("stale");
          }
        });
      }

      it(`${kind}: a lease expiring during original apply rejects the final CAS and rolls local writes back`, async () => {
        const f = await fixture(kind);
        let beforeApply: unknown, applied = false;
        const h = handlers(f, async result => ({ ...result, apply: async tx => {
          beforeApply = await f.domainSnapshot(tx);
          expect(result.apply).toBeTypeOf("function");
          await result.apply?.(tx);
          applied = true;
          // Same locked transaction makes expiry deterministic without sleeps,
          // cross-connection lock deadlocks or changing executionSeconds.
          await tx.client.query(`UPDATE treido.job_effects SET execution_until=clock_timestamp()-interval '1 second' WHERE job_id=$1 AND state='running'`, [f.event.jobId]);
        } }));
        await expect(run(f, h)).rejects.toMatchObject({ code: "STALE_LEASE" });
        expect(applied).toBe(true);
        expect(await readDomain(f)).toEqual(beforeApply);
        expect(await state(f)).toMatchObject({ effectState: "pending", token: null, until: null, resultId: null, completedAt: null });
      });
    }
  });
}
