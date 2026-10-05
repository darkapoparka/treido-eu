import { afterAll, afterEach, beforeAll, beforeEach, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Pool } from "pg";
import { createDatabase, type SellerDatabase } from "../../apps/web/src/server/db/database";
import type { VerifiedIdentity } from "../../apps/web/src/server/identity/clerk.server";
import type { BackendBindings } from "../../apps/web/src/server/config/backend-bindings";
import * as backend from "../../apps/web/src/server/config/backend-bindings.server";
import * as jobs from "../../apps/web/src/server/jobs/config.server";
import { aftercareNamespace } from "./aftercare-fixture";
import { startNativeCluster } from "./native-cluster.mjs";
import { loadVerifiedRemediationFreeze } from "./remediation-freeze.mjs";
import { createShippingQualificationFixture, type ShippingFixtureEvidence } from "./shipping-qualification-fixture";
import { createShippingSourceFixture } from "./shipping-source-fixture";
import { defineShippingSourceCases } from "./shipping-source-cases";
import { createShippingPaymentFixture, createShippingRuntimeObligationFixture } from "./shipping-payment-fixture";
import { defineShippingPaymentCases } from "./shipping-payment-cases";
import { defineShippingRuntimeObligationCases } from "./shipping-runtime-obligation-cases";

const auth = vi.hoisted(() => ({ recent: new WeakSet<object>() }));
vi.mock("../../apps/web/src/server/identity/clerk.server", () => ({ hasVerifiedRecentAuthentication: (identity: object) => auth.recent.has(identity) }));
let native: Awaited<ReturnType<typeof startNativeCluster>>, admin: Pool, database: SellerDatabase;
let qualificationEvidence: ShippingFixtureEvidence;
const cleanups: (() => void | Promise<void>)[] = [], counters: { label: string; read: () => Record<string, number> }[] = [];
const evidence: unknown[] = [];
const evidencePath = resolve("../.qa/t61/shipping-native-effects-" + randomUUID() + ".json");
let externalAttempts = 0;
const binding: BackendBindings = { environment: "test", application: { origin: "http://127.0.0.1", region: "isolated-test" },
  identity: { provider: "clerk", applicationId: "app_T61Native", mode: "test" },
  database: { provider: "neon", projectId: "synthetic-t61", branchId: "synthetic-t61", purpose: "test", region: "isolated-test",
    databaseName: "t61_isolated", runtimeRole: "treido_runtime", loginRole: "treido_runtime", localBridge: false } };
const context = () => ({ admin, database, qualificationEvidence,
  registerRecent: (identity: VerifiedIdentity) => { auth.recent.add(identity); },
  registerCleanup: (cleanup: () => void | Promise<void>) => { cleanups.push(cleanup); },
  recordAdapterCounters: (label: string, read: () => Record<string, number>) => { counters.push({ label, read }); } });

beforeAll(async () => {
  const freeze = await loadVerifiedRemediationFreeze();
  // Separate fresh owned cluster keeps synthetic shipping-v2 approval distinct
  // from original144's exactly-one old lifecycle contract; no approval rewrite.
  native = await startNativeCluster({ reviewedAdditionalMigrations: freeze.reviewedAdditionalMigrations });
  admin = native.admin; database = createDatabase(native.runtime);
  qualificationEvidence = await createShippingQualificationFixture(admin, native.runtime);
  await admin.query("UPDATE treido.category_policies SET state='reviewed',enabled_for_publish=true,review_reference='SYNTHETIC ISOLATED T61 ONLY',reviewed_at=clock_timestamp() WHERE category_id='cat:electronics/phones' AND version=1");
});
beforeEach(() => {
  vi.spyOn(backend, "requireBackendBindings").mockReturnValue(binding);
  vi.spyOn(jobs, "requireJobBindings").mockReturnValue({ ...aftercareNamespace, origin: binding.application.origin, repairServiceId: "t61-isolated" });
  externalAttempts = 0;
  vi.stubGlobal("fetch", async () => { externalAttempts++; throw Error("Unexpected external request refused in isolated shipping fixture"); });
});
afterEach(async () => {
  evidence.push({ test: expect.getState().currentTestName, syntheticSdkCalls: counters.map(row => ({ label: row.label, ...row.read() })),
    unexpectedExternalFetchAttempts: externalAttempts, externalProviderCalls: 0, qualificationScope: qualificationEvidence?.scope });
  counters.length = 0;
  while (cleanups.length) await cleanups.pop()?.();
  vi.restoreAllMocks(); vi.unstubAllGlobals();
  if (native) await writeFile(evidencePath, JSON.stringify({ scope: "Original native commands/executor with explicitly synthetic local SDK only; preflight and final journeys are distinct", cases: evidence }, null, 2) + "\n");
  expect(externalAttempts).toBe(0);
});
afterAll(async () => { await native?.stop(); });
//30 NEW definitions:8 exact source+21 canonical journey+1 runtime obligation.
//All are UNRUN until original guarded native launch after actual frozen checks.
defineShippingSourceCases((kind, pickupOnly) => createShippingSourceFixture(context(), kind, pickupOnly));
defineShippingPaymentCases((kind, options) => createShippingPaymentFixture(context(), kind, options));
defineShippingRuntimeObligationCases(() => createShippingRuntimeObligationFixture(context()));
