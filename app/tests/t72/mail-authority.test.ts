import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../apps/web/node_modules/server-only/index.js", () => ({}));
vi.mock("../../apps/web/src/features/sellers/persistence.server", () => ({
  authorizeSeller: authorize,
  inputHash: (value: unknown) => JSON.stringify(value),
}));
import {
  lockInvitationMail,
  authorizeInvitationMailJob,
} from "../../apps/web/src/features/team/mail-persistence.server";
import { retryInvitationMail } from "../../apps/web/src/features/team/mail-jobs.server";
import type { EffectContext } from "../../apps/web/src/server/jobs/execution.server";
import type { InvitationDeliveryRow } from "../../apps/web/src/features/team/mail-persistence.server";
const { authorize } = vi.hoisted(() => ({ authorize: vi.fn() }));
const context = {
  id: "11111111-1111-4111-8111-111111111111",
  resourceId: "22222222-2222-4222-8222-222222222222",
  sellerId: "33333333-3333-4333-8333-333333333333",
  actorId: "44444444-4444-4444-8444-444444444444",
  kind: "team.invitation",
  authority: "member",
  generation: 1,
  operationKey: "22222222-2222-4222-8222-222222222222",
  executionToken: "88888888-8888-4888-8888-888888888888",
} as EffectContext;
let row: InvitationDeliveryRow,
  query: ReturnType<typeof vi.fn>,
  lease = true,
  foreign = false;
beforeEach(() => {
  lease = true;
  foreign = false;
  row = {
    id: context.resourceId,
    sellerId: context.sellerId,
    actorId: context.actorId!,
    invitationId: "55555555-5555-4555-8555-555555555555",
    createdBy: context.actorId!,
    sellerName: "Mock only",
    state: "pending",
    providerId: null,
    payload: null,
    firstAttempt: null,
    binding: null,
    providerKey: null,
    invitationRevision: 1,
    revision: 1,
    recipient: "recipient@example.test",
    role: "member",
    grants: ["seller.read"],
    language: "en",
    status: "pending",
    expiresAt: new Date("2026-10-12Z"),
    now: new Date("2026-10-05Z"),
  };
  authorize.mockReset().mockResolvedValue({
    seller: { kind: "business" },
    authority: {
      actor: {
        userId: row.actorId,
        status: "active",
        session: "verified",
        recentlyAuthenticated: false,
      },
      sellerId: row.sellerId,
      seller: { id: row.sellerId, kind: "business", status: "active" },
      membership: {
        userId: row.actorId,
        sellerId: row.sellerId,
        status: "active",
        role: "owner",
        grants: [],
      },
    },
  });
  query = vi.fn(async (sql: string) => {
    if (sql.includes("FROM treido.users"))
      return {
        rows: [
          { id: row.createdBy, subject: "user_mock_issuer", status: "active" },
        ],
        rowCount: 1,
      };
    if (sql.includes("FROM treido.invitation_deliveries d JOIN"))
      return { rows: foreign ? [] : [row], rowCount: foreign ? 0 : 1 };
    if (sql.includes("FROM treido.outbox_jobs j JOIN"))
      return { rows: [], rowCount: lease ? 1 : 0 };
    return { rows: [], rowCount: 0 };
  });
});
describe("invitation persisted scope/issuer/revision fencing", () => {
  it("provides parent pre-claim authority while refusing missing or malformed handler leases", async () => {
    await authorizeInvitationMailJob({ client: { query } } as never, context);
    expect(query.mock.calls.at(-1)![0]).not.toContain("e.execution_token=$6");
    expect(() =>
      lockInvitationMail({ client: { query } } as never, {
        ...context,
        executionToken: "",
      }),
    ).toThrow();
    expect(() =>
      lockInvitationMail({ client: { query } } as never, {
        ...context,
        executionToken: "invalid",
      }),
    ).toThrow();
  });
  it("requires the exact delivery/seller/actor and member intent", async () => {
    await lockInvitationMail({ client: { query } } as never, context);
    expect(query.mock.calls[0][0]).toContain(
      "d.seller_id=$2 AND d.actor_id=$3",
    );
    foreign = true;
    await expect(
      lockInvitationMail({ client: { query } } as never, context),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      lockInvitationMail({ client: { query } } as never, {
        ...context,
        authority: "service",
        actorId: null,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it.each(["accepted", "declined", "cancelled", "expired"])(
    "denies %s invitation before send/completion",
    async (status) => {
      row.status = status;
      await expect(
        lockInvitationMail({ client: { query } } as never, context),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    },
  );
  it("rejects expiry, revision changes and expired execution leases", async () => {
    row.revision = 2;
    await expect(
      lockInvitationMail({ client: { query } } as never, context),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    row.revision = 1;
    row.expiresAt = row.now;
    await expect(
      lockInvitationMail({ client: { query } } as never, context),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    row.expiresAt = new Date(+row.now + 10000);
    lease = false;
    await expect(
      lockInvitationMail({ client: { query } } as never, context),
    ).rejects.toMatchObject({ code: "STALE_LEASE" });
  });
  it("rechecks original issuer and resend actor separately; cannot delegate beyond current access", async () => {
    row.createdBy = "77777777-7777-4777-8777-777777777777";
    query.mockImplementation(async (sql: string) =>
      sql.includes("FROM treido.users")
        ? {
            rows: [
              { id: row.actorId, subject: "user_mock_actor", status: "active" },
              {
                id: row.createdBy,
                subject: "user_mock_issuer",
                status: "active",
              },
            ],
            rowCount: 2,
          }
        : sql.includes("FROM treido.invitation_deliveries")
          ? { rows: [row], rowCount: 1 }
          : { rows: [], rowCount: 1 },
    );
    await lockInvitationMail({ client: { query } } as never, context);
    expect(authorize).toHaveBeenCalledWith(
      expect.anything(),
      { subject: "user_mock_actor" },
      row.sellerId,
      "team.manage",
    );
    expect(authorize).toHaveBeenCalledWith(
      expect.anything(),
      { subject: "user_mock_issuer" },
      row.sellerId,
      "team.manage",
    );
    const authority = authorize.mock.results[0].value;
    const current = await authority;
    authorize.mockResolvedValue({
      ...current,
      authority: {
        ...current.authority,
        membership: {
          ...current.authority.membership,
          role: "manager",
          grants: ["team.manage"],
        },
      },
    });
    row.grants = ["seller.read", "billing.manage"];
    await expect(
      lockInvitationMail({ client: { query } } as never, context),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("retry never mints a new delivery or service identity, and refuses foreign/expired/active effects", async () => {
    const delivery = {
      id: row.id,
      actorId: row.actorId,
      state: "uncertain",
      providerId: null,
      replay: true,
    };
    query.mockImplementation(async (sql: string) =>
      sql.includes("FROM treido.invitation_deliveries")
        ? { rows: [delivery], rowCount: 1 }
        : sql.includes("FROM treido.outbox_jobs")
          ? { rows: [{ id: context.id, state: "dead" }], rowCount: 1 }
          : sql.includes("FROM treido.team_command_receipts")
            ? { rows: [], rowCount: 0 }
            : { rows: [], rowCount: 1 },
    );
    expect(
      await retryInvitationMail(
        { client: { query } } as never,
        row.sellerId,
        row.invitationId,
        row.actorId,
      ),
    ).toBe(row.id);
    expect(query.mock.calls.some(([sql]) => sql.includes("INSERT"))).toBe(
      false,
    );
    expect(
      query.mock.calls.some(([sql]) => sql.includes("generation=generation+1")),
    ).toBe(true);
    delivery.replay = false;
    await expect(
      retryInvitationMail(
        { client: { query } } as never,
        row.sellerId,
        row.invitationId,
        row.actorId,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    delivery.replay = true;
    await expect(
      retryInvitationMail(
        { client: { query } } as never,
        row.sellerId,
        row.invitationId,
        "foreign",
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    query.mockImplementation(async (sql: string) =>
      sql.includes("FROM treido.invitation_deliveries")
        ? { rows: [delivery], rowCount: 1 }
        : sql.includes("FROM treido.outbox_jobs")
          ? { rows: [{ id: context.id, state: "dead" }], rowCount: 1 }
          : { rows: [], rowCount: 0 },
    );
    await expect(
      retryInvitationMail(
        { client: { query } } as never,
        row.sellerId,
        row.invitationId,
        row.actorId,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
