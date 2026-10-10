import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { startLaunchCluster } from "../t72/native-fixture.mjs";
import { imageLifecycleFixture } from "../t72/message-lifecycle-fixture";
import { createDatabase, inTransaction } from "../../apps/web/src/server/db/database";
import { authorizeHuman } from "../../apps/web/src/features/sellers/persistence.server";
import { libraryActorKey } from "../../apps/web/src/features/library/cursor.server";
import { changeSupport, readSupport, markSupportRead } from "../../apps/web/src/features/support/persistence.server";
import { ownSupportExport } from "../../apps/web/src/features/support/export.server";
import { readSupportUpdates } from "../../apps/web/src/features/support/updates.server";
import { createResourceReport, readOperatorReports } from "../../apps/web/src/features/trust/reports.server";
import { readReportImageEvidence, deliverReportImage } from "../../apps/web/src/features/trust/image-evidence.server";
import { deliverAttachment } from "../../apps/web/src/features/message-attachments/delivery.server";
import { checksumOf } from "../../apps/web/src/features/message-attachments/raster.server";
import type { VerifiedIdentity } from "../../apps/web/src/server/identity/clerk.server";
import type { LifecycleNativeContext } from "../t61/lifecycle-fixture";
import type { SupportKind } from "../../apps/web/src/features/support/model";

const auth = vi.hoisted(() => ({ recent: new Set<string>() }));
vi.mock("../../apps/web/src/server/identity/clerk.server", () => ({
  hasVerifiedRecentAuthentication: (identity: VerifiedIdentity) => auth.recent.has(identity.subject),
}));
vi.mock("../../apps/web/src/server/config/backend-bindings.server", () => ({
  requireBackendBindings: () => ({ environment: "test", identity: { provider: "clerk", applicationId: "app_T61Native", mode: "test" } }),
}));
let native: Awaited<ReturnType<typeof startLaunchCluster>>;
let context: LifecycleNativeContext;
let externalAttempts = 0;
const identity = (): VerifiedIdentity => ({ subject: "user_pro_a_" + randomUUID().replaceAll("-", "") });
beforeAll(async () => {
  vi.stubGlobal("fetch", async () => { externalAttempts++; throw Error("No external provider calls in the current-platform packet"); });
  native = await startLaunchCluster({ currentPlatform: true });
  context = { database: createDatabase(native.runtime), admin: native.admin, registerRecent: person => { auth.recent.add(person.subject); } };
});
afterAll(async () => {
  try { await native?.stop(); } finally { vi.unstubAllGlobals(); }
  expect(externalAttempts).toBe(0);
});
const db = () => context.database;
async function person() {
  const who = identity();
  const user = await inTransaction(db(), tx => authorizeHuman(tx, who, true));
  return { identity: who, userId: user.id };
}
async function operator(write = true) {
  const who = await person();
  await native.admin.query("INSERT INTO treido.operator_grants(user_id,capability) VALUES($1,'reports.read')", [who.userId]);
  if (write) await native.admin.query("INSERT INTO treido.operator_grants(user_id,capability) VALUES($1,'moderation.write')", [who.userId]);
  return who;
}
const command = (who: VerifiedIdentity, kind: SupportKind = "create", ticketId: string | null = null, expectedRevision = 0, body = "Synthetic isolated request") => ({
  actorKey: libraryActorKey(who), requestId: randomUUID(), kind, ticketId, expectedRevision, title: "TEST ONLY private support", topic: "technical", body,
});
const feed = (userId: string) => inTransaction(db(), tx => readSupportUpdates(tx, userId, { filter: "unread", q: "" }));

it("uses every canonical migration and restricted support/evidence grants", async () => {
  expect(native.state.migrations).toContain("0056_private_support.sql");
  expect(native.state.migrations).toContain("0057_report_image_evidence.sql");
  const grants = (await native.runtime.query(`SELECT
    has_table_privilege(current_user,'treido.support_entries','UPDATE') AS edit_entry,
    has_table_privilege(current_user,'treido.support_command_receipts','DELETE') AS delete_receipt,
    has_table_privilege(current_user,'treido.report_image_accesses','UPDATE') AS edit_access,
    has_table_privilege(current_user,'treido.operator_grants','INSERT') AS promote_self`)).rows[0];
  expect(grants).toEqual({ edit_entry: false, delete_receipt: false, edit_access: false, promote_self: false });
});
it("a new signed-in buyer reads without creating a seller or implicit private records", async () => {
  const who = identity();
  expect(await readSupport(db(), who, {})).toMatchObject({ canWrite: true, tickets: [], entries: [] });
  expect((await native.admin.query("SELECT id FROM treido.users WHERE clerk_subject=$1", [who.subject])).rowCount).toBe(0);
  const input = command(who);
  const [first, duplicate] = await Promise.all([changeSupport(db(), who, input), changeSupport(db(), who, input)]);
  expect(duplicate).toEqual(first);
  expect((await native.admin.query("SELECT id FROM treido.support_tickets WHERE id=$1", [first.id])).rowCount).toBe(1);
  expect((await native.admin.query("SELECT o.seller_id FROM treido.personal_seller_owners o JOIN treido.users u ON u.id=o.user_id WHERE u.clerk_subject=$1", [who.subject])).rowCount).toBe(0);
  await expect(changeSupport(db(), who, { ...input, body: "Substituted command" })).rejects.toMatchObject({ code: "CONFLICT" });
});
it("delivers operator replies, keeps internal evidence private and marks only own public entries read", async () => {
  const buyer = await person(), foreign = await person(), ops = await operator();
  const ticket = await changeSupport(db(), buyer.identity, command(buyer.identity));
  await expect(readSupport(db(), foreign.identity, { ticketId: ticket.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(readSupport(db(), buyer.identity, {}, true)).rejects.toMatchObject({ code: "FORBIDDEN" });
  const replyCommand = command(ops.identity, "reply", ticket.id, 1, "PUBLIC addressed operator reply");
  const reply = await changeSupport(db(), ops.identity, replyCommand, true);
  expect(reply).toMatchObject({ sequence: 2, revision: 2, state: "waiting" });
  expect(await changeSupport(db(), ops.identity, replyCommand, true)).toEqual(reply);
  const note = await changeSupport(db(), ops.identity, command(ops.identity, "note", ticket.id, 2, "INTERNAL never exported or delivered"), true);
  const own = await readSupport(db(), buyer.identity, { ticketId: ticket.id });
  expect(own.entries.map(entry => entry.sequence)).toEqual([1, 2]);
  expect(JSON.stringify(own)).not.toContain("INTERNAL");
  expect((await readSupport(db(), ops.identity, { ticketId: ticket.id }, true)).entries).toHaveLength(3);
  expect((await feed(buyer.userId)).items).toMatchObject([{ ticketId: ticket.id, sequence: 2, unread: true }]);
  expect((await feed(foreign.userId)).items).toEqual([]);
  const exported = await ownSupportExport(native.runtime, buyer.userId);
  expect(exported).toHaveLength(2);
  expect(JSON.stringify(exported)).not.toContain("INTERNAL");
  expect(await ownSupportExport(native.runtime, foreign.userId)).toEqual([]);
  await expect(markSupportRead(db(), buyer.identity, { actorKey: libraryActorKey(buyer.identity), ticketId: ticket.id, sequence: note.sequence })).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(markSupportRead(db(), foreign.identity, { actorKey: libraryActorKey(foreign.identity), ticketId: ticket.id, sequence: 2 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  await markSupportRead(db(), buyer.identity, { actorKey: libraryActorKey(buyer.identity), ticketId: ticket.id, sequence: 2 });
  expect((await markSupportRead(db(), buyer.identity, { actorKey: libraryActorKey(buyer.identity), ticketId: ticket.id, sequence: 1 })).sequence).toBe(2);
  expect((await feed(buyer.userId)).unreadCount).toBe(0);
  await native.admin.query("UPDATE treido.operator_grants SET active=false,revision=revision+1 WHERE user_id=$1", [ops.userId]);
  await expect(changeSupport(db(), ops.identity, replyCommand, true)).rejects.toMatchObject({ code: "FORBIDDEN" });
});
it("one concurrent revision wins; resolved requests reopen without duplicate entries", async () => {
  const buyer = await person(), ops = await operator();
  const first = await changeSupport(db(), buyer.identity, command(buyer.identity));
  const attempts = await Promise.allSettled([
    changeSupport(db(), buyer.identity, command(buyer.identity, "reply", first.id, 1, "Buyer current reply")),
    changeSupport(db(), ops.identity, command(ops.identity, "resolve", first.id, 1, "Operator reviewed resolution"), true),
  ]);
  expect(attempts.filter(result => result.status === "fulfilled")).toHaveLength(1);
  expect(attempts.filter(result => result.status === "rejected")).toMatchObject([{ reason: { code: "CONFLICT" } }]);
  let current = (await readSupport(db(), buyer.identity, { ticketId: first.id })).ticket!;
  if (current.state !== "resolved") {
    await changeSupport(db(), buyer.identity, command(buyer.identity, "resolve", first.id, current.revision, "The request is now resolved"));
    current = (await readSupport(db(), buyer.identity, { ticketId: first.id })).ticket!;
  }
  const reopen = command(buyer.identity, "reopen", first.id, current.revision, "Additional information after resolution");
  const accepted = await changeSupport(db(), buyer.identity, reopen);
  expect(accepted.state).toBe("open");
  expect(await changeSupport(db(), buyer.identity, reopen)).toEqual(accepted);
  expect((await readSupport(db(), buyer.identity, { ticketId: first.id })).entries).toHaveLength(accepted.sequence);
});
it("restricted humans keep own support recovery but not another person's ticket", async () => {
  const buyer = await person(), other = await person();
  const ticket = await changeSupport(db(), buyer.identity, command(buyer.identity));
  await native.admin.query("UPDATE treido.users SET status='restricted' WHERE id=$1", [buyer.userId]);
  expect((await readSupport(db(), buyer.identity, { ticketId: ticket.id })).ticket?.id).toBe(ticket.id);
  expect((await changeSupport(db(), buyer.identity, command(buyer.identity, "reply", ticket.id, 1))).sequence).toBe(2);
  await expect(changeSupport(db(), other.identity, command(other.identity, "reply", ticket.id, 2))).rejects.toMatchObject({ code: "NOT_FOUND" });
});
it("reports reach the authorized queue and exact private image bytes remain report-scoped", async () => {
  const f = await imageLifecycleFixture(context), ops = await operator(), foreign = await person();
  const image = await f.image();
  const input = { resourceKind: "message" as const, resourceId: image.messageId!, requestId: randomUUID(), reason: "abuse", details: "SYNTHETIC isolated private-image report" };
  const report = await createResourceReport(db(), f.buyer.identity, input);
  expect(await createResourceReport(db(), f.buyer.identity, input)).toEqual(report);
  expect((await readOperatorReports(db(), ops.identity)).some(row => row.id === report.id)).toBe(true);
  expect(await readReportImageEvidence(db(), ops.identity, report.id)).toMatchObject([{ id: image.id, state: "available", width: 12, height: 8 }]);
  const access = { ...image.scope, id: image.id, revision: 1 };
  const buyerBytes = await deliverAttachment(db(), f.buyer.identity, access, f.storage);
  const recipientBytes = await deliverAttachment(db(), f.counterpart.identity, { ...access, sellerId: f.sellerId }, f.storage);
  const bytes = await deliverReportImage(db(), ops.identity, report.id, image.id, f.storage);
  expect(checksumOf(bytes)).toBe(checksumOf(buyerBytes));
  expect(checksumOf(recipientBytes)).toBe(checksumOf(buyerBytes));
  await expect(deliverReportImage(db(), foreign.identity, report.id, image.id, f.storage)).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(deliverAttachment(db(), foreign.identity, access, f.storage)).rejects.toBeDefined();
  const unrelated = await f.image();
  await expect(deliverReportImage(db(), ops.identity, report.id, unrelated.id, f.storage)).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect((await native.admin.query("SELECT id FROM treido.report_image_accesses WHERE report_id=$1 AND attachment_id=$2", [report.id, image.id])).rowCount).toBe(1);
  await expect(native.runtime.query("UPDATE treido.report_image_accesses SET checksum=$2 WHERE report_id=$1", [report.id, "b".repeat(64)])).rejects.toMatchObject({ code: "42501" });
  const storage = { ...f.storage, read: async (key: string, limit: number) => {
    const value = await f.storage.read(key, limit);
    await native.admin.query("UPDATE treido.operator_grants SET active=false,revision=revision+1 WHERE user_id=$1", [ops.userId]);
    return value;
  } };
  await expect(deliverReportImage(db(), ops.identity, report.id, image.id, storage)).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect((await native.admin.query("SELECT id FROM treido.report_image_accesses WHERE report_id=$1", [report.id])).rowCount).toBe(1);
});
