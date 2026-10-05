import { beforeAll, afterAll, vi } from "vitest";
import { createDatabase } from "../../apps/web/src/server/db/database";
import { startSecurityCluster } from "./native-fixture.mjs";
import { defineIssuerConsistencyCases } from "../../apps/web/src/features/team/issuer-integration-cases";
import { defineAcceptanceResourceCases } from "../../apps/web/src/features/account-closure/acceptance-resource-cases";
// Explicit isolated deployment configuration, not identity/authority evidence.
// The legacy lifecycle fixture registers this exact synthetic namespace in PG.
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
const auth = vi.hoisted(() => ({ recent: new WeakSet<object>() }));
vi.mock("../../apps/web/src/server/identity/clerk.server", () => ({
  hasVerifiedRecentAuthentication: (identity: object) =>
    auth.recent.has(identity),
}));
// This packet reviews plans with the original fixture's explicit empty session
// inventory. Any unexpected real identity-provider interaction fails locally.
vi.mock(
  "../../apps/web/src/features/account-closure/clerk-adapter.server",
  () => ({
    ownSessions: async () => {
      throw Error("Unexpected provider session read");
    },
  }),
);
let native: Awaited<ReturnType<typeof startSecurityCluster>>;
let database: ReturnType<typeof createDatabase>;
beforeAll(async () => {
  vi.stubGlobal("fetch", async () => {
    throw Error("External fetch forbidden in T71 isolated fixture");
  });
  native = await startSecurityCluster();
  database = createDatabase(native.runtime);
});
afterAll(async () => {
  await native?.stop();
  vi.unstubAllGlobals();
});
const context = () => ({
  database,
  admin: native.admin,
  registerRecent: (identity: object) => {
    auth.recent.add(identity);
  },
});
defineIssuerConsistencyCases(context);
defineAcceptanceResourceCases(context);

import { defineNumericDiscoveryCases } from "../../apps/web/src/features/catalog/numeric-discovery-integration-cases";
const numericOwner = { subject: "user_t71_numeric_publications" };
beforeAll(() => {
  auth.recent.add(numericOwner);
});
defineNumericDiscoveryCases(() => ({
  database,
  admin: native.admin,
  owner: numericOwner,
}));
