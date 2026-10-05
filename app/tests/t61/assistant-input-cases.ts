import { describe, expect, it, vi } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { inTransaction, type SellerDatabase } from "../../apps/web/src/server/db/database";
import type { VerifiedIdentity } from "../../apps/web/src/server/identity/clerk.server";
import type { BackendBindings } from "../../apps/web/src/server/config/backend-bindings";
import * as backend from "../../apps/web/src/server/config/backend-bindings.server";
import * as jobs from "../../apps/web/src/server/jobs/config.server";
import { authorizeHuman } from "../../apps/web/src/features/sellers/persistence.server";
import { assistantActorKey } from "../../apps/web/src/features/assistant-tools/storage.server";
import { changeAssistantInput } from "../../apps/web/src/features/assistant-runs/commands.server";
import { performAssistantInput } from "../../apps/web/src/features/assistant-runs/execution.server";
import { reserveInputMoney } from "../../apps/web/src/features/assistant-runs/storage.server";
import type { InputCommand } from "../../apps/web/src/features/assistant-runs/model";
import { parsePolicyConfig, type RuntimePolicy } from "../../apps/web/src/features/assistant-runs/policy.server";
import * as provider from "../../apps/web/src/features/assistant-runs/provider.server";

/** Registered in remediation.integration.ts; execution remains held. Run only on T61's disposable native database after
 * actual canonical adoption/freeze. SQL, authorization, commands, locks and
 * Gateway parsing remain original. Only backend target metadata and provider
 * transport are explicit synthetic adapters: no secret/env installation, real
 * model, approved shared policy, upload or external HTTP occurs. */
export function defineAssistantInputPersistenceCases(get: () => { database: SellerDatabase; admin: Pool }) {
  const applicationId = "app_T61Native", environment = "test";
  const localTransportToken = "SYNTHETIC-T61-LOCAL-TRANSPORT-ONLY";
  const bindings: BackendBindings = {
    environment, application: { origin: "http://127.0.0.1", region: "isolated-test" },
    identity: { provider: "clerk", applicationId, mode: "test" },
    database: { provider: "neon", projectId: "synthetic-t61", branchId: "synthetic-t61", purpose: "test",
      region: "isolated-test", databaseName: "treido_t61", runtimeRole: "treido_runtime", loginRole: "treido_runtime", localBridge: false },
  };
  const criteria = "category=cat%3Aelectronics%2Fphones&currency=EUR&maxPrice=100";
  const freshActor = async () => {
    const identity: VerifiedIdentity = { subject: "user_t61_input_" + randomUUID().replaceAll("-", "") };
    const user = await inTransaction(get().database, tx => authorizeHuman(tx, identity, true));
    return { identity, userId: user.id };
  };
  const policy = async (): Promise<RuntimePolicy> => {
    const id = randomUUID();
    const config = parsePolicyConfig({ version: 1, gatewayAccountId: "team_T61Native", gatewayProjectId: "prj_T61Native",
      gatewayCredentialFingerprint: createHash("sha256").update("treido-gateway-binding-v1\0").update(localTransportToken).digest("hex"),
      approvalReference: "SYNTHETIC ISOLATED TEST ONLY", processorReference: "synthetic", retentionReference: "synthetic",
      noticeBg: "Синтетичен тест", noticeEn: "Synthetic test", models: { text: "openai/t61-local", photo: null, voice: null },
      responseModels: { text: "t61-local-response", photo: null, voice: null }, providers: ["openai"], budgetCurrency: "USD",
      runMinor: 7, humanDailyMinor: 7, platformDailyMinor: 1000000, inputBytes: 16000, outputTokens: 100,
      mediaSeconds: 600, inputSeconds: 600, consentSeconds: 600, audioSeconds: 60, mediaScope: "a".repeat(64),
      providerEnabled: true, mediaEnabled: false, retentionEnabled: true, evaluationRevision: "synthetic-t61" });
    // Registry mutation is confined to this caller's owned database. Revoke the
    // previous fixture to retain the original one-current-policy invariant.
    await get().admin.query("UPDATE treido.assistant_runtime_policies SET revoked_at=clock_timestamp() WHERE application_id=$1 AND environment=$2 AND revoked_at IS NULL", [applicationId, environment]);
    await get().admin.query("INSERT INTO treido.assistant_runtime_policies(id,application_id,environment,purpose,config,approved_at) VALUES($1,$2,$3,'shopping-input-v1',$4::jsonb,clock_timestamp())", [id, applicationId, environment, JSON.stringify(config)]);
    return { id, applicationId, environment, config };
  };
  const snapshot = async (runId: string) => (await get().admin.query<{ value: unknown }>(
    "SELECT jsonb_build_object('run',to_jsonb(r),'reservation',to_jsonb(b),'workspace',to_jsonb(w)) AS value FROM treido.assistant_runs r JOIN treido.assistant_run_reservations b ON b.run_id=r.id JOIN treido.buyer_assistant_workspaces w ON w.user_id=r.user_id AND w.mode=r.mode WHERE r.id=$1", [runId])).rows[0].value;
  const prepared = async (p: RuntimePolicy) => {
    const actor = await freshActor();
    const send = (revision: number, operation: InputCommand["operation"]): InputCommand => ({
      actorKey: assistantActorKey(actor.identity), requestId: randomUUID(), expectedRevision: revision, mode: "text", operation,
    });
    const consent = await changeAssistantInput(get().database, actor.identity, send(0, { kind: "consent", policyId: p.id, granted: true, confirmed: true }), async () => actor.identity);
    const reserved = await changeAssistantInput(get().database, actor.identity, send(consent.revision,
      { kind: "prepare", policyId: p.id, criteria, prompt: "SYNTHETIC private test input", mediaId: null, confirmed: true }), async () => actor.identity);
    if (!reserved.runId) throw Error("Original prepare did not reserve a run");
    return { ...actor, runId: reserved.runId, revision: reserved.revision, send };
  };
  const withAdapters = async (transport: typeof fetch, body: () => Promise<void>) => {
    const target = vi.spyOn(backend, "requireBackendBindings").mockReturnValue(bindings);
    const job = vi.spyOn(jobs, "requireJobBindings").mockReturnValue({ environment, applicationId, origin: "http://127.0.0.1", repairServiceId: "t61-isolated" });
    const adapter = vi.spyOn(provider, "gatewayAdapter").mockImplementation(p => provider.createGatewayAdapter(p, localTransportToken, transport));
    try { await body(); } finally { adapter.mockRestore(); job.mockRestore(); target.mockRestore(); }
  };
  const noTransport: typeof fetch = async () => { throw Error("Foreign/mismatched input attempted provider transport"); };
  const calling = (runId: string) => inTransaction(get().database, async tx => {
    // Exact internal handoff state after a durable execute acceptance, before
    // emission. No external effect or successful execution is fabricated.
    await tx.client.query("UPDATE treido.assistant_runs SET state='calling' WHERE id=$1 AND state='reserved'", [runId]);
    await tx.client.query("UPDATE treido.assistant_run_reservations SET status='calling' WHERE run_id=$1 AND status='reserved'", [runId]);
  });
  describe("T61 native assistant emission authority and durable uncertainty", () => {
    it("foreign actor and wrong mode reject without any mutation of the calling run/reservation/workspace", async () => {
      await withAdapters(noTransport, async () => {
        const p = await policy(), owner = await prepared(p), foreign = await freshActor();
        await calling(owner.runId);
        const before = await snapshot(owner.runId);
        await expect(performAssistantInput(get().database, foreign.identity, owner.runId, "text", async () => foreign.identity)).rejects.toMatchObject({ code: "NOT_FOUND" });
        expect(await snapshot(owner.runId)).toEqual(before);
        await expect(performAssistantInput(get().database, owner.identity, owner.runId, "voice", async () => owner.identity)).rejects.toMatchObject({ code: "NOT_FOUND" });
        expect(await snapshot(owner.runId)).toEqual(before);
      });
    });
    it("concurrent exact execute retries emit one POST and preserve the original durable receipt", async () => {
      let posts = 0;
      const transport: typeof fetch = async (_url, init) => {
        expect(init?.method).toBe("POST"); posts++;
        return Response.json({ id: "gen_" + "0".repeat(26), model: "t61-local-response", choices: [{ finish_reason: "stop", message: {
          content: JSON.stringify({ criteria, itemType: null, colour: null, style: null, transcript: null }),
        } }] });
      };
      await withAdapters(transport, async () => {
        const owner = await prepared(await policy());
        const command = owner.send(owner.revision, { kind: "execute", runId: owner.runId, confirmed: true });
        const result = await Promise.all([0, 1].map(() => changeAssistantInput(get().database, owner.identity, command, async () => owner.identity)));
        expect(result.filter(r => r.replayed)).toHaveLength(1);
        expect(posts).toBe(1);
        const run = (await get().admin.query("SELECT state,steps,emission_started_at,provider_id FROM treido.assistant_runs WHERE id=$1", [owner.runId])).rows[0];
        expect(run).toMatchObject({ state: "proposed", steps: 1, provider_id: "gen_" + "0".repeat(26) });
        expect(run.emission_started_at).toBeInstanceOf(Date);
        expect((await get().admin.query("SELECT count(*)::int AS n FROM treido.buyer_assistant_receipts WHERE user_id=$1 AND request_id=$2", [owner.userId, command.requestId])).rows[0].n).toBe(1);
        const before = await snapshot(owner.runId);
        expect((await changeAssistantInput(get().database, owner.identity, command, async () => owner.identity)).replayed).toBe(true);
        expect(posts).toBe(1); expect(await snapshot(owner.runId)).toEqual(before);
      });
    });
    it("two invocations observing steps0 race one emission claim; the loser cannot mutate the successful winner", async () => {
      let entered!: () => void, finish!: () => void;
      const entry = new Promise<void>(resolve => { entered = resolve; }), gate = new Promise<void>(resolve => { finish = resolve; });
      let posts = 0;
      const transport: typeof fetch = async () => {
        posts++; entered(); await gate;
        return Response.json({ id: "gen_" + "1".repeat(26), model: "t61-local-response", choices: [{ finish_reason: "stop", message: {
          content: JSON.stringify({ criteria, itemType: null, colour: null, style: null, transcript: null }),
        } }] });
      };
      await withAdapters(transport, async () => {
        const owner = await prepared(await policy()); await calling(owner.runId);
        let initialRefreshes = 0, releaseInitial!: () => void;
        const bothObservedZero = new Promise<void>(resolve => { releaseInitial = resolve; });
        const fresh = async () => {
          // This callback occurs AFTER the original context read and BEFORE
          // emission locking. Both invocations must have read steps=0 before
          // either can advance. The winner's final refresh does not wait.
          if (++initialRefreshes <= 2) {
            if (initialRefreshes === 2) releaseInitial();
            await bothObservedZero;
          }
          return owner.identity;
        };
        const executions = [0, 1].map(() => performAssistantInput(get().database, owner.identity, owner.runId, "text", fresh));
        // Attach handlers immediately so deliberate conflict cannot become an
        // unhandled rejection while the provider response remains gated.
        const outcomes = executions.map(promise => promise.then(
          () => ({ ok: true as const }), error => ({ ok: false as const, error }),
        ));
        try {
          const loser = await Promise.race(outcomes);
          expect(loser.ok).toBe(false);
          if (!loser.ok) expect(loser.error).toMatchObject({ code: "CONFLICT" });
          expect(initialRefreshes).toBe(2);
          expect(await Promise.race([entry.then(() => true), Promise.all(outcomes).then(() => false)])).toBe(true);
          expect(posts).toBe(1);
          expect((await get().admin.query("SELECT r.state,r.steps,b.status FROM treido.assistant_runs r JOIN treido.assistant_run_reservations b ON b.run_id=r.id WHERE r.id=$1", [owner.runId])).rows[0])
            .toMatchObject({ state: "calling", steps: 1, status: "calling" });
        } finally { releaseInitial(); finish(); await Promise.all(outcomes); }
        const results = await Promise.all(outcomes);
        expect(results.filter(result => result.ok)).toHaveLength(1);
        expect(results.filter(result => !result.ok)).toHaveLength(1);
        expect(posts).toBe(1);
        expect((await get().admin.query("SELECT state,steps FROM treido.assistant_runs WHERE id=$1", [owner.runId])).rows[0]).toMatchObject({ state: "proposed", steps: 1 });
      });
    });
    it("post-emission failure and cancellation retain unknown spending; replay cannot re-emit or create headroom", async () => {
      let posts = 0;
      const transport: typeof fetch = async () => { posts++; throw Error("SYNTHETIC response lost after emission"); };
      await withAdapters(transport, async () => {
        const p = await policy(), owner = await prepared(p);
        const command = owner.send(owner.revision, { kind: "execute", runId: owner.runId, confirmed: true });
        await expect(changeAssistantInput(get().database, owner.identity, command, async () => owner.identity)).rejects.toThrow("SYNTHETIC response lost");
        expect(posts).toBe(1);
        expect((await get().admin.query("SELECT r.state,r.steps,r.emission_started_at,b.status,b.reserved_minor,b.actual_minor FROM treido.assistant_runs r JOIN treido.assistant_run_reservations b ON b.run_id=r.id WHERE r.id=$1", [owner.runId])).rows[0]).toMatchObject({ state: "unknown", steps: 1, status: "unknown", reserved_minor: 7, actual_minor: null });
        const replay = await changeAssistantInput(get().database, owner.identity, command, async () => owner.identity);
        expect(replay.replayed).toBe(true); expect(posts).toBe(1);
        await changeAssistantInput(get().database, owner.identity, owner.send(replay.revision,
          { kind: "cancel", runId: owner.runId, assetId: null, confirmed: true }), async () => owner.identity);
        expect((await get().admin.query("SELECT r.state,r.input_json,r.proposal,b.status,b.reserved_minor FROM treido.assistant_runs r JOIN treido.assistant_run_reservations b ON b.run_id=r.id WHERE r.id=$1", [owner.runId])).rows[0]).toMatchObject({ state: "cancelled", input_json: null, proposal: null, status: "unknown", reserved_minor: 7 });
        await expect(inTransaction(get().database, tx => reserveInputMoney(tx, owner.userId, p))).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" });
        expect(posts).toBe(1);
      });
    });
  });
}
