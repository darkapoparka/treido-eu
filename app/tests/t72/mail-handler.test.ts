import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("../../apps/web/node_modules/server-only/index.js", () => ({}));
vi.mock("../../apps/web/src/server/db/database", () => ({
  inTransaction: async (_db: unknown, work: (tx: unknown) => unknown) =>
    work({ client: { query: query } }),
}));
vi.mock("../../apps/web/src/features/team/mail-persistence.server", () => ({
  lockInvitationMail: async () => {
    if (revoked) throw new Error("revoked");
    return structuredClone(row);
  },
  sameMailBinding: (a: unknown, b: unknown) =>
    JSON.stringify(a) === JSON.stringify(b),
  recordMailAcknowledgement: async (_tx: unknown, r: unknown, id: string) => {
    row.providerId = id;
    row.state = "submitted";
  },
}));
import {
  createInvitationMailHandler,
  maintainInvitationMail,
} from "../../apps/web/src/features/team/mail-jobs.server";
import type { InvitationDeliveryRow } from "../../apps/web/src/features/team/mail-persistence.server";
import type { EffectContext } from "../../apps/web/src/server/jobs/execution.server";
import type { SellerDatabase } from "../../apps/web/src/server/db/database";
import {
  InvitationMailProviderError,
  type InvitationMailProvider,
} from "../../apps/web/src/features/team/mail-provider.server";
import {
  publicMailBinding,
  type InvitationMailConfig,
} from "../../apps/web/src/features/team/mail-model";
const { query } = vi.hoisted(() => ({ query: vi.fn() }));
let row: InvitationDeliveryRow,
  revoked = false;
const config: InvitationMailConfig = {
  environment: "test",
  applicationId: "treido-mail",
  jobEnvironment: "test-mail",
  origin: "https://example.test",
  sender: "team@mail.example.test",
  domain: "mail.example.test",
  domainId: "00112233-4455-4677-8899-aabbccddeeff",
  accountBinding: "mock-only",
  purpose: "team.invitation",
  recipients: ["recipient@example.test"],
  apiKey: "re_isolated_mock_only",
};
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
const database = { pool: { query } } as unknown as SellerDatabase;
let provider: InvitationMailProvider;
beforeEach(() => {
  revoked = false;
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
    recipient: config.recipients[0],
    role: "member",
    grants: ["seller.read"],
    language: "en",
    status: "pending",
    expiresAt: new Date("2026-10-12Z"),
    now: new Date("2026-10-05Z"),
  };
  query
    .mockReset()
    .mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes("first_attempt_at=COALESCE")) {
        row.firstAttempt = row.now;
        row.payload = JSON.parse(params[1] as string);
        row.binding = JSON.parse(params[2] as string);
        row.providerKey = params[3] as string;
        row.state = "uncertain";
      }
      if (sql.includes("SET state='unavailable'") && !row.firstAttempt)
        row.state = "unavailable";
      if (sql.includes("SET state='failed'")) row.state = "failed";
      return { rowCount: 1, rows: [] };
    });
  provider = {
    verifySender: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockResolvedValue("66666666-6666-4666-8666-666666666666"),
    retrieve: vi.fn().mockResolvedValue("sent"),
  };
});
describe("persisted invitation effect recovery with isolated mocks", () => {
  it("builds an unattempted payload from the real invitation and refuses an inconsistent frozen key", async () => {
    row.payload = {
      from: config.sender,
      to: ["foreign@example.test"],
      subject: "old",
      text: "old",
      tags: [],
    };
    await createInvitationMailHandler(database, config, provider)(context);
    expect(provider.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: [row.recipient] }),
      expect.any(String),
    );
    row.providerId = null;
    row.state = "uncertain";
    row.providerKey = "foreign-key";
    await expect(
      createInvitationMailHandler(database, config, provider)(context),
    ).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
    expect(provider.send).toHaveBeenCalledTimes(1);
  });
  it("freezes uncertain intent before POST, then records acceptance without claiming delivery", async () => {
    provider.send = vi.fn(async () => {
      expect(row.state).toBe("uncertain");
      expect(row.firstAttempt).not.toBeNull();
      return "66666666-6666-4666-8666-666666666666";
    });
    await createInvitationMailHandler(database, config, provider)(context);
    expect(row.state).toBe("submitted");
    expect(row.binding).toEqual(publicMailBinding(config));
    expect(row.binding).not.toHaveProperty("apiKey");
  });
  it("recovers a lost acknowledgement using the identical payload and key and never sends a known duplicate", async () => {
    provider.send = vi
      .fn()
      .mockRejectedValueOnce(new InvitationMailProviderError("uncertain"))
      .mockResolvedValue("66666666-6666-4666-8666-666666666666");
    const handler = createInvitationMailHandler(database, config, provider);
    await expect(handler(context)).rejects.toMatchObject({
      code: "NOT_AVAILABLE",
    });
    expect(row.state).toBe("uncertain");
    const original = structuredClone(row.payload),
      key = row.providerKey;
    await handler(context);
    expect(provider.send).toHaveBeenNthCalledWith(2, original, key);
    await handler(context);
    expect(provider.send).toHaveBeenCalledTimes(2);
  });
  it("never blindly replays expired unknown intent, or sends under a changed binding", async () => {
    row.firstAttempt = new Date(+row.now - 24 * 3600000);
    row.binding = publicMailBinding(config);
    row.state = "uncertain";
    await expect(
      createInvitationMailHandler(database, config, provider)(context),
    ).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
    expect(provider.send).not.toHaveBeenCalled();
    row.providerId = "66666666-6666-4666-8666-666666666666";
    expect(
      (await createInvitationMailHandler(database, config, provider)(context))
        .providerObjectId,
    ).toBe(row.providerId);
    row.firstAttempt = row.now;
    row.binding = { ...publicMailBinding(config), applicationId: "foreign" };
    await expect(
      createInvitationMailHandler(database, config, provider)(context),
    ).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
    expect(provider.send).not.toHaveBeenCalled();
  });
  it("denies revocation before POST and again at executor completion without losing the factual receipt", async () => {
    provider.verifySender = vi.fn(async () => {
      revoked = true;
    });
    await expect(
      createInvitationMailHandler(database, config, provider)(context),
    ).rejects.toThrow("revoked");
    expect(provider.send).not.toHaveBeenCalled();
    revoked = false;
    provider.verifySender = vi.fn().mockResolvedValue(undefined);
    provider.send = vi.fn(async () => {
      revoked = true;
      return "66666666-6666-4666-8666-666666666666";
    });
    const result = await createInvitationMailHandler(
      database,
      config,
      provider,
    )(context);
    expect(row.state).toBe("submitted");
    await expect(result.lock!({} as never)).rejects.toThrow("revoked");
    await expect(result.apply!({} as never)).rejects.toThrow("revoked");
  });
  it("keeps missing binding unavailable and disallows a foreign non-production recipient", async () => {
    await expect(
      createInvitationMailHandler(database, null, provider)(context),
    ).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
    expect(row.state).toBe("unavailable");
    row.recipient = "foreign@example.test";
    await expect(
      createInvitationMailHandler(database, config, provider)(context),
    ).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
    expect(provider.send).not.toHaveBeenCalled();
  });
  it("reconciles known provider IDs without any send and keeps unavailable maintenance finite", async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          id: row.id,
          sellerId: row.sellerId,
          providerId: "66666666-6666-4666-8666-666666666666",
          payload: {
            from: config.sender,
            to: [row.recipient],
            subject: "mock",
            text: "mock",
            tags: [],
          },
          binding: publicMailBinding(config),
        },
      ],
      rowCount: 1,
    });
    expect(await maintainInvitationMail(database, config, provider)).toEqual({
      available: true,
      checked: 1,
    });
    expect(provider.send).not.toHaveBeenCalled();
    expect(await maintainInvitationMail(database, null, provider)).toEqual({
      available: false,
      checked: 0,
    });
  });
});
