import { afterAll, afterEach, beforeAll, beforeEach, expect, vi } from "vitest";
import process from "node:process";
import type { Pool } from "pg";
import {
  createDatabase,
  type SellerDatabase,
} from "../../apps/web/src/server/db/database";
import * as backend from "../../apps/web/src/server/config/backend-bindings.server";
import * as jobs from "../../apps/web/src/server/jobs/config.server";
import { startLaunchCluster } from "../t72/native-fixture.mjs";
import { defineAftercareBoundaryCases } from "../../apps/web/src/features/order-aftercare/boundary-integration-cases";
import type { VerifiedIdentity } from "../../apps/web/src/server/identity/clerk.server";
import { aftercareNamespace } from "./aftercare-fixture";
import { createOwnerAftercareFixture } from "./owner-aftercare-fixture";

const auth = vi.hoisted(() => ({ recent: new WeakSet<object>() }));
vi.mock("../../apps/web/src/server/identity/clerk.server", () => ({
  hasVerifiedRecentAuthentication: (identity: object) =>
    auth.recent.has(identity),
}));
let native: Awaited<ReturnType<typeof startLaunchCluster>>;
let database: SellerDatabase;
let admin: Pool;
let externalAttempts = 0;
const cleanups: (() => void | Promise<void>)[] = [];
const context = () => ({
  database,
  admin,
  registerRecent: (identity: VerifiedIdentity) => {
    auth.recent.add(identity);
  },
  registerCleanup: (cleanup: () => void | Promise<void>) => {
    cleanups.push(cleanup);
  },
});
beforeAll(async () => {
  native = await startLaunchCluster({
    notificationDelivery: true,
    ...(process.env.TREIDO_AFTERCARE_NATIVE_EVIDENCE
      ? { evidenceDirectory: process.env.TREIDO_AFTERCARE_NATIVE_EVIDENCE }
      : {}),
  });
  admin = native.admin;
  database = createDatabase(native.runtime);
  await admin.query(
    "UPDATE treido.category_policies SET state='reviewed',enabled_for_publish=true,review_reference='SYNTHETIC ISOLATED AFTERCARE ONLY',reviewed_at=clock_timestamp() WHERE category_id='cat:electronics/phones' AND version=1",
  );
});
beforeEach(() => {
  externalAttempts = 0;
  vi.spyOn(backend, "requireBackendBindings").mockReturnValue({
    environment: "test",
    application: { origin: "http://127.0.0.1", region: "isolated-test" },
    identity: {
      provider: "clerk",
      applicationId: "app_T61Native",
      mode: "test",
    },
    database: {
      provider: "neon",
      projectId: "synthetic-t61",
      branchId: "synthetic-t61",
      purpose: "test",
      region: "isolated-test",
      databaseName: "treido_t61",
      runtimeRole: "treido_runtime",
      loginRole: "treido_runtime",
      localBridge: false,
    },
  });
  vi.spyOn(jobs, "requireJobBindings").mockReturnValue({
    ...aftercareNamespace,
    origin: "http://127.0.0.1",
    repairServiceId: "t61-aftercare-isolated",
    repairScheduler: "inngest-cron",
  });
  vi.stubGlobal("fetch", async () => {
    externalAttempts++;
    throw Error("External fetch refused in isolated aftercare qualification");
  });
});
afterEach(async () => {
  try {
    while (cleanups.length) await cleanups.pop()?.();
  } finally {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
  expect(externalAttempts).toBe(0);
});
afterAll(async () => {
  await native?.stop();
});
defineAftercareBoundaryCases((name) =>
  createOwnerAftercareFixture(context(), name),
);
