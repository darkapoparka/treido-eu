import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { inTransaction } from "../../server/db/database";
import { authorizeHuman } from "../sellers/persistence.server";
import { libraryActorKey } from "../library/cursor.server";
import {
  openListingConversation,
  sendConversationMessage,
} from "../messaging/participants.server";
import { scheduleNotificationEmails } from "./scheduler.server";
import { changeNotificationPreferences } from "./commands.server";
import { readNotificationPreferences } from "./preferences.server";
import { maintainNotificationEmails } from "./jobs.server";
import {
  createNotificationFixture,
  type NotificationFixtureContext,
} from "../../../../../tests/t61/notification-fixture";

/** Actual isolated PostgreSQL/runtime grants and original executor bodies.
 * External recipient/domain/SMTP facts use visibly synthetic boundaries only. */
export function defineNotificationDeliveryCases(
  context: () => NotificationFixtureContext,
) {
  const fixture = (
    kind: "message" | "saved-search" = "message",
    schedule = true,
  ) => createNotificationFixture(context(), kind, schedule);
  const reconcile = async (f: Awaited<ReturnType<typeof fixture>>) => {
    // Other native cases retain their own known IDs. The bounded consumer must
    // record failed checks as attempts so another original recipient is reached.
    for (let n = 0; n < 8; n++) {
      await maintainNotificationEmails(f.database, {
        config: f.mail,
        provider: f.provider,
      });
      if ((await f.snapshot())?.delivery.last_checked_at) return;
    }
    throw Error("Bounded provider observation never reached current fixture");
  };
  describe("notification delivery on actual isolated PostgreSQL", () => {
    it("applies one original mail through the shared executor and replays without another POST", async () => {
      const f = await fixture();
      expect((await f.run()).status).toBe("completed");
      const receipt = await f.snapshot();
      expect(receipt).toMatchObject({
        jobState: "completed",
        effectState: "completed",
        delivery: { state: "submitted" },
      });
      expect(receipt.effectProviderId).toBe(receipt.delivery.provider_id);
      expect((await f.run()).status).toBe("completed");
      expect(f.counts().posts).toBe(1);
      expect(f.sent[0].payload.text).not.toContain("PRIVATE");
      expect(f.sent[0].payload.text).not.toContain("Телефон");
    });
    it("keeps the original pending effect through a readiness outage and retries that same event", async () => {
      const f = await fixture(),
        original = await f.snapshot(),
        event = { ...f.event };
      expect(original).toMatchObject({
        jobState: "pending",
        effectState: "pending",
        delivery: { state: "pending", provider_id: null },
      });
      // Genuine isolated schema-readiness fault: the original authorizer and
      // executor run unchanged, without disabling any ownership constraint.
      await f.admin.query(
        "ALTER TABLE treido.notification_email_receipts RENAME TO notification_email_receipts_native_readiness",
      );
      try {
        await expect(f.run()).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
        expect(await f.snapshot()).toEqual(original);
        expect(f.event).toEqual(event);
        expect(f.counts()).toEqual({ posts: 0, verified: 0, reads: 0 });
      } finally {
        await f.admin.query(
          "ALTER TABLE treido.notification_email_receipts_native_readiness RENAME TO notification_email_receipts",
        );
      }
      expect(f.event).toEqual(event);
      expect((await f.run()).status).toBe("completed");
      expect(await f.snapshot()).toMatchObject({
        jobState: "completed",
        effectState: "completed",
        delivery: { id: original.delivery.id, state: "submitted" },
      });
      expect(
        (
          await f.admin.query<{ generation: number }>(
            "SELECT generation FROM treido.outbox_jobs WHERE id=$1",
            [event.jobId],
          )
        ).rows[0].generation,
      ).toBe(event.generation);
      expect(f.counts()).toEqual({ posts: 1, verified: 1, reads: 0 });
    });
    it("permits per-channel opt-out and exact acknowledgment recovery during provider outage", async () => {
      const f = await fixture();
      f.configured.mockReturnValue(null);
      f.projected.mockRejectedValue(Error("Synthetic recipient outage"));
      expect(
        await changeNotificationPreferences(
          f.database,
          f.buyer.identity,
          f.originalCommand,
        ),
      ).toEqual(f.originalAck);
      const command = f.command(false, true);
      const off = await changeNotificationPreferences(
        f.database,
        f.buyer.identity,
        command,
      );
      expect(off.settings).toEqual({
        savedSearchEmail: false,
        messageEmail: true,
      });
      expect(
        await changeNotificationPreferences(
          f.database,
          f.buyer.identity,
          command,
        ),
      ).toEqual(off);
      expect((await f.snapshot()).delivery.state).toBe("cancelled");
      await expect(
        changeNotificationPreferences(
          f.database,
          f.buyer.identity,
          f.command(true, true, 2),
        ),
      ).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
      expect(f.counts().posts).toBe(0);
    });
    it("keeps recipient facts server-side and denies a non-allowlisted current primary", async () => {
      const f = await fixture();
      f.projected.mockResolvedValue("foreign@example.test");
      const view = await readNotificationPreferences(
        f.database,
        f.buyer.identity,
        "en",
      );
      expect(view.recipient).toBe("unavailable");
      expect(JSON.stringify(view)).not.toContain("@example.test");
      await changeNotificationPreferences(
        f.database,
        f.buyer.identity,
        f.command(false, true),
      );
      await expect(
        changeNotificationPreferences(
          f.database,
          f.buyer.identity,
          f.command(true, true, 2),
        ),
      ).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
    });
    for (const kind of ["message", "saved-search"] as const) {
      it(`${kind}: cancels a current source revoked after scheduling, before provider IO`, async () => {
        const f = await fixture(kind);
        await f.cancelSource();
        expect((await f.run()).status).toBe("cancelled");
        expect((await f.snapshot()).jobState).toBe("cancelled");
        expect(f.counts()).toEqual({ posts: 0, verified: 0, reads: 0 });
      });
    }
    it("rejects a stale consent generation and a different actor's preference command", async () => {
      const f = await fixture();
      await expect(
        changeNotificationPreferences(
          f.database,
          f.foreign.identity,
          f.command(false, false),
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await changeNotificationPreferences(
        f.database,
        f.buyer.identity,
        f.command(true, false),
      );
      expect((await f.run()).status).toBe("cancelled");
      expect(f.counts().posts).toBe(0);
    });
    it("retries an unknown acknowledgment with the exact frozen original key and bytes", async () => {
      const f = await fixture();
      f.lost(true);
      await expect(f.run()).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
      const first = await f.snapshot();
      expect(first.delivery).toMatchObject({
        state: "uncertain",
        provider_id: null,
      });
      f.lost(false);
      expect((await f.run()).status).toBe("completed");
      expect(f.sent).toHaveLength(2);
      expect(f.sent[1]).toEqual(f.sent[0]);
      expect((await f.snapshot()).delivery.first_attempt_at).toEqual(
        first.delivery.first_attempt_at,
      );
      await expect(
        f.database.pool.query(
          `UPDATE treido.notification_email_deliveries SET request_payload=jsonb_set(request_payload,'{to}', '["foreign@example.test"]'::jsonb) WHERE id=$1`,
          [f.deliveryId],
        ),
      ).rejects.toMatchObject({ code: "23514" });
    });
    it("does not retry an original unknown acknowledgment at or beyond the 23-hour bound", async () => {
      const f = await fixture();
      f.lost(true);
      await expect(f.run()).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
      await f.ageUnknownAcknowledgement();
      f.lost(false);
      await expect(f.run()).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
      expect(f.counts().posts).toBe(1);
      expect((await f.snapshot()).delivery.provider_id).toBeNull();
    });
    it("completes a known original receipt during later binding/recipient outage", async () => {
      const f = await fixture();
      await expect(
        f.run(async () => {
          throw Error("Synthetic post-ack local completion failure");
        }),
      ).rejects.toThrow("post-ack");
      const original = await f.snapshot();
      expect(original.delivery.provider_id).toBeTypeOf("string");
      f.configured.mockReturnValue(null);
      f.projected.mockRejectedValue(Error("Synthetic recipient outage"));
      expect((await f.run()).status).toBe("completed");
      expect((await f.snapshot()).delivery.provider_id).toBe(
        original.delivery.provider_id,
      );
      expect(f.counts().posts).toBe(1);
    });
    it("retains factual in-flight acknowledgment after opt-out and blocks later delivery", async () => {
      const f = await fixture();
      f.onSend(async () => {
        await changeNotificationPreferences(
          f.database,
          f.buyer.identity,
          f.command(false, false),
        );
      });
      expect((await f.run()).status).toBe("cancelled");
      expect((await f.snapshot()).delivery).toMatchObject({
        state: "cancelled",
        provider_state: "submitted",
        provider_id: expect.any(String),
      });
      expect((await f.run()).status).toBe("cancelled");
      expect(f.counts().posts).toBe(1);
    });
    it("preserves delivered and terminal provider observations against older accepted/sent reads", async () => {
      const f = await fixture();
      await f.run();
      await reconcile(f);
      expect((await f.snapshot()).delivery.provider_state).toBe("delivered");
      await f.admin.query(
        `UPDATE treido.notification_email_deliveries SET last_checked_at=NULL WHERE id=$1`,
        [f.deliveryId],
      );
      f.observe("submitted");
      await reconcile(f);
      expect((await f.snapshot()).delivery.provider_state).toBe("delivered");
      await f.admin.query(
        `UPDATE treido.notification_email_deliveries SET last_checked_at=NULL WHERE id=$1`,
        [f.deliveryId],
      );
      f.observe("complained");
      await reconcile(f);
      expect((await f.snapshot()).delivery.provider_state).toBe("complained");
      const preference = (
        await f.admin.query(
          `SELECT saved_search_email,message_email FROM treido.notification_email_preferences WHERE user_id=$1`,
          [f.buyer.userId],
        )
      ).rows[0];
      expect(preference).toEqual({
        saved_search_email: false,
        message_email: false,
      });
      await f.admin.query(
        `UPDATE treido.notification_email_deliveries SET state='cancelled',last_checked_at=NULL WHERE id=$1`,
        [f.deliveryId],
      );
      f.observe("sent");
      await reconcile(f);
      expect((await f.snapshot()).delivery).toMatchObject({
        state: "cancelled",
        provider_state: "complained",
      });
      expect(f.counts().posts).toBe(1);
    });
    it("serializes the current human/preference lock before delivery without a reverse upgrade", async () => {
      const f = await fixture(),
        holder = await f.database.pool.connect();
      let reached = false,
        discard = false,
        running: ReturnType<typeof f.run> | null = null;
      try {
        await holder.query("BEGIN");
        const holderPid = (
          await holder.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
        ).rows[0].pid;
        await holder.query(
          `SELECT user_id FROM treido.notification_email_preferences WHERE user_id=$1 FOR UPDATE`,
          [f.buyer.userId],
        );
        running = f.run().then((value) => {
          reached = true;
          return value;
        });
        // Attach rejection handling immediately; the original promise is still
        // awaited below and is settled after releasing the holder on every path.
        void running.catch(() => {});
        // Only an observed blocker from this exact holder satisfies the wait.
        // Its deadline bounds failure; elapsed time can never establish a pass.
        await expect
          .poll(
            async () =>
              (
                await f.admin.query<{ blocked: boolean }>(
                  `SELECT EXISTS(SELECT 1 FROM pg_stat_activity a WHERE a.datname=current_database() AND a.wait_event_type='Lock' AND $1::integer=ANY(pg_blocking_pids(a.pid)) AND a.query LIKE '%notification_email_preferences%') AS blocked`,
                  [holderPid],
                )
              ).rows[0].blocked,
            { timeout: 4000, interval: 25 },
          )
          .toBe(true);
        expect(reached).toBe(false);
        await holder.query("COMMIT");
        expect((await running).status).toBe("completed");
      } finally {
        try {
          await holder.query("ROLLBACK");
        } catch {
          discard = true;
        } finally {
          holder.release(discard);
          await running?.catch(() => {});
        }
      }
      expect(f.counts().posts).toBe(1);
    });
    it("prevents direct runtime deletion/old-helper use and removes only the accepted profile owner", async () => {
      const f = await fixture();
      await changeNotificationPreferences(f.database, f.foreign.identity, {
        ...f.command(true, true, 0),
        actorKey: libraryActorKey(f.foreign.identity),
      });
      const otherThread = await openListingConversation(
        f.database,
        f.foreign.identity,
        f.listingId,
      );
      await sendConversationMessage(
        f.database,
        f.owner.identity,
        {
          threadId: otherThread.id,
          requestId: randomUUID(),
          body: "PRIVATE foreign native message",
        },
        { sellerId: f.sellerId },
      );
      await scheduleNotificationEmails(f.database);
      const foreignNotifications = async () =>
        (
          await f.admin.query(
            `SELECT jsonb_build_object('preferences',(SELECT to_jsonb(p) FROM treido.notification_email_preferences p WHERE p.user_id=$1),'deliveries',(SELECT jsonb_agg(to_jsonb(d) ORDER BY d.id) FROM treido.notification_email_deliveries d WHERE d.user_id=$1),'receipts',(SELECT jsonb_agg(to_jsonb(r) ORDER BY r.request_id) FROM treido.notification_email_receipts r WHERE r.user_id=$1)) AS value`,
            [f.foreign.userId],
          )
        ).rows[0].value;
      const foreignBefore = await foreignNotifications();
      expect(foreignBefore.deliveries).toHaveLength(1);
      await expect(
        f.database.pool.query(
          `DELETE FROM treido.notification_email_deliveries WHERE id=$1`,
          [f.deliveryId],
        ),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        f.database.pool.query(
          `SELECT treido.account_remove_optional_data_before_notification($1::uuid,$2::uuid)`,
          [randomUUID(), randomUUID()],
        ),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        f.database.pool.query(
          `SELECT treido.account_remove_optional_data($1::uuid,$2::uuid)`,
          [randomUUID(), randomUUID()],
        ),
      ).rejects.toBeDefined();
      const foreign = await inTransaction(f.database, async (tx) => {
        const user = await authorizeHuman(tx, f.foreign.identity, false);
        return (
          await tx.client.query(
            `SELECT to_jsonb(u) AS row FROM treido.users u WHERE id=$1`,
            [user.id],
          )
        ).rows[0].row;
      });
      const accepted = await f.close("profile");
      expect((await accepted.execute()).status).toBe("completed");
      expect(
        (
          await f.admin.query(
            `SELECT count(*)::int AS count FROM treido.notification_email_deliveries WHERE user_id=$1`,
            [f.buyer.userId],
          )
        ).rows[0].count,
      ).toBe(0);
      expect(
        (
          await f.admin.query(
            `SELECT count(*)::int AS count FROM treido.notification_email_preferences WHERE user_id=$1`,
            [f.buyer.userId],
          )
        ).rows[0].count,
      ).toBe(0);
      expect(
        (
          await f.admin.query(
            `SELECT count(*)::int AS count FROM treido.notification_email_receipts WHERE user_id=$1`,
            [f.buyer.userId],
          )
        ).rows[0].count,
      ).toBe(0);
      expect(
        (
          await f.admin.query(
            `SELECT to_jsonb(u) AS row FROM treido.users u WHERE id=$1`,
            [f.foreign.userId],
          )
        ).rows[0].row,
      ).toEqual(foreign);
      expect(await foreignNotifications()).toEqual(foreignBefore);
      expect((await accepted.execute()).status).toBe("completed");
      expect(f.counts().posts).toBe(0);
    });
    it("removes accepted saved-search mail and preserves the separate message preference", async () => {
      const f = await fixture("saved-search"),
        accepted = await f.close("searches");
      expect((await accepted.execute()).status).toBe("completed");
      expect(
        (
          await f.admin.query(
            `SELECT saved_search_email,message_email FROM treido.notification_email_preferences WHERE user_id=$1`,
            [f.buyer.userId],
          )
        ).rows[0],
      ).toEqual({ saved_search_email: false, message_email: true });
      expect(
        (
          await f.admin.query(
            `SELECT count(*)::int AS count FROM treido.notification_email_deliveries WHERE user_id=$1 AND kind='saved-search'`,
            [f.buyer.userId],
          )
        ).rows[0].count,
      ).toBe(0);
    });
    it("v2 repair due includes an undispatched current source and a known-ID observation", async () => {
      const f = await fixture("message", false);
      const client = await f.admin.connect();
      try {
        await client.query("BEGIN");
        // Rollback-only isolated fixture quiescence: original SQL runs against
        // real relational facts; no v1/v2 function or predicate is mocked.
        await client.query(
          `UPDATE treido.outbox_jobs SET available_at=clock_timestamp()+interval '2 days' WHERE state IN ('pending','accepted')`,
        );
        await client.query(
          `UPDATE treido.notification_email_deliveries SET last_checked_at=clock_timestamp() WHERE provider_id IS NOT NULL`,
        );
        const due = async () =>
          (
            await client.query<{ v1: boolean; v2: boolean }>(
              `SELECT treido.repair_any_due_v1() AS v1,treido.repair_any_due_v2() AS v2`,
            )
          ).rows[0];
        expect(await due()).toEqual({ v1: false, v2: true });
        await f.dispatch();
        expect(f.deliveryId).toBeTypeOf("string");
        expect((await f.run()).status).toBe("completed");
        expect((await f.snapshot()).delivery).toMatchObject({
          provider_id: expect.any(String),
          last_checked_at: null,
        });
        expect(await due()).toEqual({ v1: false, v2: true });
      } finally {
        await client.query("ROLLBACK");
        client.release();
      }
    });
  });
}
