import { beforeAll, afterAll, vi, it, expect } from "vitest";
import { createDatabase } from "../../apps/web/src/server/db/database";
import { startLaunchCluster } from "./native-fixture.mjs";
import { defineMailIntegrationCases } from "./mail-integration-cases";
import { defineAttachmentIntegrationCases } from "./attachments-integration-cases";
vi.mock("../../apps/web/src/server/config/backend-bindings.server", () => ({
  requireBackendBindings: () => ({
    environment: "test",
    identity: {
      provider: "clerk",
      applicationId: "app_T72Synthetic",
      mode: "test",
    },
  }),
}));
const human = vi.hoisted(() => ({
  subjects: new Set(["user_t72_owner", "user_t72_buyer"]),
}));
vi.mock("../../apps/web/src/server/identity/clerk.server", () => ({
  hasVerifiedRecentAuthentication: (identity: { subject: string }) =>
    human.subjects.has(identity.subject),
}));
let native: Awaited<ReturnType<typeof startLaunchCluster>>,
  database: ReturnType<typeof createDatabase>;
const owner = { subject: "user_t72_owner" },
  other = { subject: "user_t72_buyer" };
beforeAll(async () => {
  vi.stubGlobal("fetch", async () => {
    throw Error("External provider calls forbidden in isolated T72 tests");
  });
  native = await startLaunchCluster();
  database = createDatabase(native.runtime);
});
afterAll(async () => {
  await native?.stop();
  vi.unstubAllGlobals();
});
defineAttachmentIntegrationCases(() => ({
  database,
  admin: native.admin,
  owner,
  other,
}));
it("applies the full additive source and least-privilege integration grants", async () => {
  const ready = await native.runtime.query(
    "SELECT has_table_privilege(current_user,'treido.message_attachment_objects','SELECT') AS attachment_read,has_table_privilege(current_user,'treido.message_attachment_objects','DELETE') AS attachment_delete,has_column_privilege(current_user,'treido.invitation_deliveries','mail_binding','UPDATE') AS mail_binding,has_column_privilege(current_user,'treido.billing_intents','change_invoice_id','UPDATE') AS billing_invoice",
  );
  expect(ready.rows[0]).toEqual({
    attachment_read: true,
    attachment_delete: false,
    mail_binding: true,
    billing_invoice: true,
  });
});

defineMailIntegrationCases(() => ({
  database,
  admin: native.admin,
  owner,
  other,
}));
