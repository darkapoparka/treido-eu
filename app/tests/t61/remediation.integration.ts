import { afterAll, afterEach, beforeAll, beforeEach, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Pool } from "pg";
import type { VerifiedIdentity } from "../../apps/web/src/server/identity/clerk.server";
import type { BackendBindings } from "../../apps/web/src/server/config/backend-bindings";
import { createDatabase, inTransaction, type SellerDatabase } from "../../apps/web/src/server/db/database";
import { authorizeHuman, ensurePersonalSeller } from "../../apps/web/src/features/sellers/persistence.server";
import * as backend from "../../apps/web/src/server/config/backend-bindings.server";
import * as jobs from "../../apps/web/src/server/jobs/config.server";
import * as closureProcessor from "../../apps/web/src/features/account-closure/jobs.server";
import * as searchProcessor from "../../apps/web/src/features/saved-searches/jobs.server";
import * as mediaProcessor from "../../apps/web/src/features/selling/media.server";
import * as paymentProcessor from "../../apps/web/src/features/payments/jobs.server";
import * as refundProcessor from "../../apps/web/src/features/order-aftercare/jobs.server";
import { startNativeCluster } from "./native-cluster.mjs";
import { loadVerifiedRemediationFreeze } from "./remediation-freeze.mjs";
import { definePricePersistenceCases } from "./price-cases";
import { defineAssistantInputPersistenceCases } from "./assistant-input-cases";
import { defineClosureBoundaryPersistenceCases } from "./closure-boundary-cases";
import { defineAftercareFeedbackPersistenceCases } from "./aftercare-feedback-cases";
import { defineExecutorCompletionPersistenceCases } from "./executor-completion-cases";
import { createExecutorCompletionFixture } from "./executor-completion-fixture";
import { aftercareNamespace } from "./aftercare-fixture";
import { defineAftercareBoundaryCases } from "../../apps/web/src/features/order-aftercare/boundary-integration-cases";
import { defineAftercareRegistryCases } from "../../apps/web/src/features/order-aftercare/registry-integration-cases";
import { createOwnerAftercareFixture, createOwnerAftercareRegistryFixture } from "./owner-aftercare-fixture";
import { defineAccountClosureIntegrationCases } from "../../apps/web/src/features/account-closure/integration-cases";
import { createOwnerClosureIntegrationFixture } from "./owner-closure-integration-fixture";
import { defineAdaptedClosureBoundaryCases } from "./closure-adapted-cases";
import { createAdaptedClosureFixture } from "./closure-adapted-fixture";
import { definePartialExportCases } from "./partial-export-cases";
import { createPartialExportFixture } from "./partial-export-fixture";
import { defineClosureLockPersistenceCases } from "./closure-lock-cases";

const auth = vi.hoisted(() => ({ recent: new WeakSet<object>() }));
vi.mock("../../apps/web/src/server/identity/clerk.server", () => ({
  hasVerifiedRecentAuthentication: (identity: object) => auth.recent.has(identity),
}));
// Separate NEW integration entry. The historical entry retains all original30
// registrations/negative cases; its receipt assertion now checks exact original33
// plus the actual qualified canonical additions through the same bootstrap.
let native: Awaited<ReturnType<typeof startNativeCluster>>;
let database: SellerDatabase;
let admin: Pool;
const identities: [VerifiedIdentity, VerifiedIdentity] = [
  { subject: "user_t61_remediation_owner_" + randomUUID().replaceAll("-", "") },
  { subject: "user_t61_remediation_other_" + randomUUID().replaceAll("-", "") },
];
let userIds: [string, string];
let closureIntegrationFixture: Awaited<ReturnType<typeof createOwnerClosureIntegrationFixture>>;
const cleanups: (() => void | Promise<void>)[] = [];
const adapterCounters: { label: string; read: () => Record<string, number> }[] = [];
const effectEvidence: unknown[] = [];
const evidencePath = resolve("../.qa/t61/remediation-native-effects-" + randomUUID() + ".json");
let processorCounts = (): Record<string, number> => ({});
let unexpectedExternalFetchAttempts = 0;
const context = () => ({ database, admin, identities, userIds,
  registerRecent: (identity: VerifiedIdentity) => { auth.recent.add(identity); },
  registerCleanup: (cleanup: () => void | Promise<void>) => { cleanups.push(cleanup); },
  recordAdapterCounters: (label: string, read: () => Record<string, number>) => { adapterCounters.push({ label, read }); },
});
const binding: BackendBindings = { environment: "test", application: { origin: "http://127.0.0.1", region: "isolated-test" },
  identity: { provider: "clerk", applicationId: "app_T61Native", mode: "test" },
  database: { provider: "neon", projectId: "synthetic-t61", branchId: "synthetic-t61", purpose: "test", region: "isolated-test",
    databaseName: "treido_t61", runtimeRole: "treido_runtime", loginRole: "treido_runtime", localBridge: false } };

beforeAll(async () => {
  const freeze = await loadVerifiedRemediationFreeze();
  // Exact actual adopted SQL only; original guarded cluster/resource/runtime
  // role/bootstrap/apply/grant helpers are reused. No shared database connection.
  native = await startNativeCluster({ reviewedAdditionalMigrations: freeze.reviewedAdditionalMigrations });
  admin = native.admin;
  database = createDatabase(native.runtime);
  for (const identity of identities) {
    auth.recent.add(identity);
    await ensurePersonalSeller(database, identity);
  }
  const first = await inTransaction(database, tx => authorizeHuman(tx, identities[0], false));
  const second = await inTransaction(database, tx => authorizeHuman(tx, identities[1], false));
  userIds = [first.id, second.id];
  await admin.query("UPDATE treido.category_policies SET state='reviewed',enabled_for_publish=true,review_reference='SYNTHETIC ISOLATED T61 ONLY',reviewed_at=clock_timestamp() WHERE category_id='cat:electronics/phones' AND version=1");
  closureIntegrationFixture = await createOwnerClosureIntegrationFixture(context());
});
beforeEach(() => {
  vi.spyOn(backend, "requireBackendBindings").mockReturnValue(binding);
  vi.spyOn(jobs, "requireJobBindings").mockReturnValue({ ...aftercareNamespace, origin: binding.application.origin, repairServiceId: "t61-isolated" });
  // Call-through spies ONLY: every actual processor body and result callback runs.
  const closure = vi.spyOn(closureProcessor, "processClosureJob"), search = vi.spyOn(searchProcessor, "processSavedSearchJob"),
    media = vi.spyOn(mediaProcessor, "processMediaJob"), payment = vi.spyOn(paymentProcessor, "processPaymentObservation"),
    refund = vi.spyOn(refundProcessor, "processOrderRefund");
  processorCounts = () => ({ closure: closure.mock.calls.length, search: search.mock.calls.length, media: media.mock.calls.length, payment: payment.mock.calls.length, refund: refund.mock.calls.length });
  unexpectedExternalFetchAttempts = 0;
  // SDK/Gateway use their explicit injected local fetch; every unexpected global
  // fetch is refused before network emission and is a native-test failure.
  vi.stubGlobal("fetch", async () => { unexpectedExternalFetchAttempts++; throw Error("Unexpected external fetch refused in isolated T61 fixture"); });
});
afterEach(async () => {
  effectEvidence.push({ test: expect.getState().currentTestName, originalProcessorCalls: processorCounts(),
    syntheticAdapterCalls: adapterCounters.map(row => ({ label: row.label, ...row.read() })),
    unexpectedExternalFetchAttempts, actualExternalProviderCalls: 0 });
  adapterCounters.length = 0;
  while (cleanups.length) await cleanups.pop()?.();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (native) await writeFile(evidencePath, JSON.stringify({ scope: "ACTUAL isolated native invocation counters; processor call-through and synthetic SDK transport calls are separate from external provider calls", cases: effectEvidence }, null, 2) + "\n");
  expect(unexpectedExternalFetchAttempts).toBe(0);
});
afterAll(async () => { await native?.stop(); });

// Actual executable definitions:5 price+4 input+5 closure+18 aftercare/feedback
// +25 original shared-executor pipeline cases +13 owner aftercare +6 registry
// +5 owner closure integration +33 adapted original closure boundaries
// =114 NEW registrations (UNRUN), alongside the preserved original30.
definePricePersistenceCases(context);
defineAssistantInputPersistenceCases(context);
defineClosureBoundaryPersistenceCases(context);
defineAftercareFeedbackPersistenceCases(context);
defineExecutorCompletionPersistenceCases(kind => createExecutorCompletionFixture(context(), kind));
defineAftercareBoundaryCases(name => createOwnerAftercareFixture(context(), name));
defineAftercareRegistryCases(() => createOwnerAftercareRegistryFixture(context()));
defineAccountClosureIntegrationCases(() => closureIntegrationFixture);
defineAdaptedClosureBoundaryCases(name => createAdaptedClosureFixture(context(), name));
// Eight additional real runtime optional-namespace rollback cases. Original
//114+30 definitions remain registered, unchanged and awaiting a fresh run.
definePartialExportCases((namespace, present) => createPartialExportFixture(context(), namespace, present));
// Five additive connected-reader/retired-catalogue regressions; original122
// remediation plus30 shipping plus30 historical definitions remain intact.
defineClosureLockPersistenceCases(context);
