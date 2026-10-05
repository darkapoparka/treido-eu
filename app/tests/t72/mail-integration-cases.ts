import { describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { SellerDatabase } from "../../apps/web/src/server/db/database";
import { createBusinessSeller } from "../../apps/web/src/features/sellers/persistence.server";
import {
  changeTeam,
  readTeam,
} from "../../apps/web/src/features/team/persistence.server";
import {
  createInvitationMailHandler,
  maintainInvitationMail,
} from "../../apps/web/src/features/team/mail-jobs.server";
import {
  invitationMailConfig,
  serializeInvitationMailPayload,
  type InvitationMailPayload,
} from "../../apps/web/src/features/team/mail-model";
import { InvitationMailProviderError } from "../../apps/web/src/features/team/mail-provider.server";
import { executeJob } from "../../apps/web/src/server/jobs/execution.server";
const binding = { environment: "test", applicationId: "treido-t72" };
const origin = "https://treido.example.test";
/** Synthetic acknowledged provider, actual current issuer authority and outbox persistence. No network calls. */
export function defineMailIntegrationCases(
  get: () => {
    database: SellerDatabase;
    admin: Pool;
    owner: { subject: string };
    other: { subject: string };
  },
) {
  async function invite() {
    const { database, admin, owner } = get();
    const sellerId = await createBusinessSeller(database, owner, {
      name: "T72 isolated invitation business",
      requestId: randomUUID(),
    });
    const recipient = "recipient-" + randomUUID() + "@example.test";
    const current = await readTeam(database, owner, sellerId);
    const view = await changeTeam(database, owner, {
      kind: "invite",
      sellerId,
      expectedRevision: current.revision,
      requestId: randomUUID(),
      recipient,
      language: "bg",
      access: { role: "member", grants: ["seller.read"] },
    });
    const invitation = view.invitations[0];
    const job = (
      await admin.query<{ id: string; generation: number; deliveryId: string }>(
        "SELECT j.id,j.generation,j.resource_id AS \"deliveryId\" FROM treido.outbox_jobs j JOIN treido.invitation_deliveries d ON d.id=j.resource_id WHERE j.kind='team.invitation' AND d.invitation_id=$1",
        [invitation.id],
      )
    ).rows[0];
    const config = invitationMailConfig(
      {
        TREIDO_ENV: "test",
        TREIDO_APP_ORIGIN: origin,
        RESEND_API_KEY: "re_SyntheticNotARealProviderCredential",
        TREIDO_INVITATION_MAIL_ENV: "test",
        TREIDO_INVITATION_MAIL_APPLICATION_ID: binding.applicationId,
        TREIDO_INVITATION_MAIL_JOB_ENV: binding.environment,
        TREIDO_INVITATION_MAIL_ORIGIN: origin,
        TREIDO_INVITATION_MAIL_PURPOSE: "team.invitation",
        TREIDO_INVITATION_MAIL_SENDER: "invite@example.test",
        TREIDO_INVITATION_MAIL_DOMAIN: "example.test",
        TREIDO_INVITATION_MAIL_DOMAIN_ID: randomUUID(),
        TREIDO_INVITATION_MAIL_ACCOUNT_BINDING: "t72-synthetic",
        TREIDO_INVITATION_MAIL_TEST_RECIPIENTS: recipient,
      },
      { ...binding, origin },
    );
    if (!config) throw Error("Invalid synthetic mail configuration");
    const event = {
      schemaVersion: 1,
      jobId: job.id,
      sellerId,
      generation: job.generation,
      ...binding,
    };
    return {
      database,
      admin,
      owner,
      sellerId,
      recipient,
      invitation,
      job,
      config,
      event,
    };
  }
  describe("T72 real invitation outbox and recovery commands", () => {
    it("commits provider acceptance once, distinguishes delivered state, and fences immutable delivery identity", async () => {
      const f = await invite(),
        providerId = randomUUID();
      const provider = {
        verifySender: vi.fn(async () => {}),
        send: vi.fn(async () => providerId),
        retrieve: vi.fn(async () => "delivered" as const),
      };
      const handler = createInvitationMailHandler(
        f.database,
        f.config,
        provider,
      );
      expect(
        await executeJob(f.database, f.event, binding, "mail:" + randomUUID(), {
          "team.invitation": handler,
        }),
      ).toEqual({ jobId: f.job.id, status: "completed" });
      expect(
        await executeJob(f.database, f.event, binding, "mail:" + randomUUID(), {
          "team.invitation": handler,
        }),
      ).toEqual({ jobId: f.job.id, status: "completed" });
      expect(provider.send).toHaveBeenCalledTimes(1);
      const delivery = (
        await f.admin.query(
          "SELECT state,provider_id,request_payload,provider_key FROM treido.invitation_deliveries WHERE id=$1",
          [f.job.deliveryId],
        )
      ).rows[0];
      expect(delivery.state).toBe("submitted");
      expect(delivery.provider_id).toBe(providerId);
      expect(delivery.request_payload.to).toEqual([f.recipient]);
      expect(delivery.request_payload.text).toContain(
        "/app/invitations/" + f.invitation.id + "?lang=bg",
      );
      expect(
        (await readTeam(f.database, f.owner, f.sellerId)).invitations[0]
          .delivery,
      ).toBe("submitted");
      await expect(
        f.database.pool.query(
          "UPDATE treido.invitation_deliveries SET provider_key='forged' WHERE id=$1",
          [f.job.deliveryId],
        ),
      ).rejects.toThrow("immutable");
      await maintainInvitationMail(f.database, f.config, provider);
      expect(
        (await readTeam(f.database, f.owner, f.sellerId)).invitations[0]
          .delivery,
      ).toBe("delivered");
      expect(provider.send).toHaveBeenCalledTimes(1);
    });
    it("recovers a lost provider acknowledgement with the original request and key, without queuing a replacement send", async () => {
      const f = await invite(),
        providerId = randomUUID();
      const accepted = new Map<string, string>();
      const send = vi.fn(
        async (payload: InvitationMailPayload, key: string) => {
          if (!accepted.has(key)) {
            accepted.set(key, serializeInvitationMailPayload(payload));
            throw new InvitationMailProviderError("uncertain");
          }
          expect(serializeInvitationMailPayload(payload)).toBe(
            accepted.get(key),
          );
          return providerId;
        },
      );
      const handler = createInvitationMailHandler(f.database, f.config, {
        verifySender: async () => {},
        send,
        retrieve: async () => null,
      });
      await expect(
        executeJob(f.database, f.event, binding, "uncertain:" + randomUUID(), {
          "team.invitation": handler,
        }),
      ).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
      const view = await readTeam(f.database, f.owner, f.sellerId);
      expect(view.invitations[0]).toMatchObject({
        delivery: "uncertain",
        canResendMail: false,
      });
      expect(
        await executeJob(
          f.database,
          f.event,
          binding,
          "recover:" + randomUUID(),
          { "team.invitation": handler },
        ),
      ).toMatchObject({ status: "completed" });
      expect(send).toHaveBeenCalledTimes(2);
      expect(accepted.size).toBe(1);
      expect(
        (
          await f.admin.query(
            "SELECT count(*)::int AS count FROM treido.invitation_deliveries WHERE invitation_id=$1",
            [f.invitation.id],
          )
        ).rows[0].count,
      ).toBe(1);
    });
    it("rejects a foreign seller event before invoking the provider", async () => {
      const f = await invite(),
        send = vi.fn(async () => randomUUID());
      const handler = createInvitationMailHandler(f.database, f.config, {
        verifySender: async () => {},
        send,
        retrieve: async () => null,
      });
      await expect(
        executeJob(
          f.database,
          { ...f.event, sellerId: randomUUID() },
          binding,
          "foreign:" + randomUUID(),
          { "team.invitation": handler },
        ),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(send).not.toHaveBeenCalled();
    });

    it("unrelated frozen mail bindings cannot starve the current delivery page", async () => {
      const receipts = [];
      for (let index = 0; index < 6; index++) {
        const f = await invite();
        const providerId = randomUUID();
        await executeJob(
          f.database,
          f.event,
          binding,
          "scope:" + randomUUID(),
          {
            "team.invitation": createInvitationMailHandler(
              f.database,
              f.config,
              {
                verifySender: async () => {},
                send: async () => providerId,
                retrieve: async () => null,
              },
            ),
          },
        );
        receipts.push({ ...f, providerId });
      }
      const current = receipts[5];
      const retrieve = vi.fn(async () => "delivered" as const);
      const send = vi.fn(async () => {
        throw Error("Reconciliation must not send");
      });
      expect(
        await maintainInvitationMail(current.database, current.config, {
          verifySender: async () => {},
          send,
          retrieve,
        }),
      ).toEqual({ available: true, checked: 1 });
      expect(retrieve).toHaveBeenCalledExactlyOnceWith(
        current.providerId,
        expect.objectContaining({ to: [current.recipient] }),
      );
      const rows = (
        await current.admin.query(
          "SELECT id,state,last_checked_at FROM treido.invitation_deliveries WHERE id=ANY($1::uuid[])",
          [receipts.map((f) => f.job.deliveryId)],
        )
      ).rows;
      expect(
        rows.find((row) => row.id === current.job.deliveryId),
      ).toMatchObject({
        state: "delivered",
        last_checked_at: expect.any(Date),
      });
      expect(
        rows.filter((row) => row.id !== current.job.deliveryId),
      ).toHaveLength(5);
      for (const row of rows.filter((row) => row.id !== current.job.deliveryId))
        expect(row).toMatchObject({
          state: "submitted",
          last_checked_at: null,
        });
      expect(
        await maintainInvitationMail(current.database, current.config, {
          verifySender: async () => {},
          send,
          retrieve,
        }),
      ).toEqual({ available: true, checked: 0 });
      expect(send).not.toHaveBeenCalled();
    });
    it("failed provider lookups leave acknowledgements intact and permit the sixth due receipt to advance", async () => {
      const receipts = [];
      for (let index = 0; index < 6; index++) receipts.push(await invite());
      const config = {
        ...receipts[0].config,
        recipients: receipts.map((f) => f.recipient),
      };
      for (const f of receipts)
        await executeJob(f.database, f.event, binding, "fair:" + randomUUID(), {
          "team.invitation": createInvitationMailHandler(f.database, config, {
            verifySender: async () => {},
            send: async () => randomUUID(),
            retrieve: async () => null,
          }),
        });
      const current = receipts[0],
        attempted = new Set<string>();
      const retrieve = vi.fn(async (id: string) => {
        attempted.add(id);
        throw Error("Synthetic provider unavailable");
      });
      const provider = {
        verifySender: async () => {},
        send: vi.fn(async () => randomUUID()),
        retrieve,
      };
      expect(
        await maintainInvitationMail(current.database, config, provider),
      ).toEqual({ available: true, checked: 0 });
      expect(retrieve).toHaveBeenCalledTimes(5);
      expect(
        await maintainInvitationMail(current.database, config, provider),
      ).toEqual({ available: true, checked: 0 });
      expect(retrieve).toHaveBeenCalledTimes(6);
      expect(attempted.size).toBe(6);
      const rows = (
        await current.admin.query(
          "SELECT state,provider_id,last_checked_at FROM treido.invitation_deliveries WHERE id=ANY($1::uuid[])",
          [receipts.map((f) => f.job.deliveryId)],
        )
      ).rows;
      expect(rows).toHaveLength(6);
      for (const row of rows)
        expect(row).toMatchObject({
          state: "submitted",
          provider_id: expect.any(String),
          last_checked_at: expect.any(Date),
        });
      expect(provider.send).not.toHaveBeenCalled();
    });

    it("does not send after restriction arrives during sender verification", async () => {
      const f = await invite(),
        send = vi.fn(async () => randomUUID());
      const handler = createInvitationMailHandler(f.database, f.config, {
        verifySender: async () => {
          await f.admin.query(
            "UPDATE treido.users SET status='restricted' WHERE clerk_subject=$1",
            [f.owner.subject],
          );
        },
        send,
        retrieve: async () => null,
      });
      try {
        await expect(
          executeJob(
            f.database,
            f.event,
            binding,
            "restricted:" + randomUUID(),
            { "team.invitation": handler },
          ),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
        expect(send).not.toHaveBeenCalled();
        expect(
          (
            await f.admin.query(
              "SELECT status FROM treido.seller_invitations WHERE id=$1",
              [f.invitation.id],
            )
          ).rows[0].status,
        ).toBe("cancelled");
      } finally {
        await f.admin.query(
          "UPDATE treido.users SET status='active' WHERE clerk_subject=$1",
          [f.owner.subject],
        );
      }
    });
  });
}
