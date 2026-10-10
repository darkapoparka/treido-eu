import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  database: vi.fn(),
  quote: vi.fn(),
  begin: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ reverificationError: vi.fn() }));
vi.mock("../../server/identity/clerk.server", () => ({
  requireVerifiedIdentity: mocks.identity,
  hasVerifiedRecentAuthentication: vi.fn(),
}));
vi.mock("../../server/db/database", () => ({ getDatabase: mocks.database }));
vi.mock("./quotes.server", () => ({ createPayableQuote: mocks.quote }));
vi.mock("./attempts.server", () => ({
  beginPayment: mocks.begin,
  requestPaymentCancellation: mocks.cancel,
}));
vi.mock("./orders.server", () => ({ changePaidOrder: vi.fn() }));
vi.mock("./connect.server", () => ({ createConnectOnboarding: vi.fn() }));

import {
  createQuoteAction,
  beginPaymentAction,
  cancelPaymentAction,
} from "./actions";
import { SellerError } from "../sellers/errors";

beforeEach(() => vi.resetAllMocks());

for (const [name, action, command] of [
  ["create quote", createQuoteAction, mocks.quote],
  ["begin payment", beginPaymentAction, mocks.begin],
  ["cancel payment", cancelPaymentAction, mocks.cancel],
] as const) {
  describe(`${name} action authority`, () => {
    for (const code of ["UNAUTHENTICATED", "FORBIDDEN"] as const) {
      it(`preserves ${code} without initializing the database`, async () => {
        mocks.identity.mockRejectedValue(new SellerError(code));
        expect(await action({})).toEqual({ ok: false, code });
        expect(mocks.database).not.toHaveBeenCalled();
        expect(command).not.toHaveBeenCalled();
      });
    }

    it("waits for verified identity before touching persistence", async () => {
      let resolveIdentity!: (identity: { subject: string }) => void;
      mocks.identity.mockReturnValue(
        new Promise((resolve) => {
          resolveIdentity = resolve;
        }),
      );
      const actor = { subject: "SYNTHETIC-payment-action" },
        database = { fixture: "isolated" },
        raw = { requestId: "original-request" },
        receipt = { id: "original-receipt" };
      mocks.database.mockReturnValue(database);
      command.mockResolvedValue(receipt);
      const pending = action(raw);
      expect(mocks.identity).toHaveBeenCalledOnce();
      expect(mocks.database).not.toHaveBeenCalled();
      expect(command).not.toHaveBeenCalled();
      resolveIdentity(actor);
      expect(await pending).toEqual({ ok: true, data: receipt });
      expect(command).toHaveBeenCalledWith(database, actor, raw);
    });

    it("delegates the exact identity, database and immutable request", async () => {
      const actor = { subject: "SYNTHETIC-payment-action" },
        database = { fixture: "isolated" },
        raw = { requestId: "original-request", id: "original-resource" },
        receipt = { id: "original-receipt" };
      mocks.identity.mockResolvedValue(actor);
      mocks.database.mockReturnValue(database);
      command.mockResolvedValue(receipt);
      expect(await action(raw)).toEqual({ ok: true, data: receipt });
      expect(mocks.identity.mock.invocationCallOrder[0]).toBeLessThan(
        mocks.database.mock.invocationCallOrder[0],
      );
      expect(command).toHaveBeenCalledOnce();
      expect(command.mock.calls[0][0]).toBe(database);
      expect(command.mock.calls[0][1]).toBe(actor);
      expect(command.mock.calls[0][2]).toBe(raw);
    });

    it("sanitizes initialization failure after identity verification", async () => {
      mocks.identity.mockResolvedValue({ subject: "SYNTHETIC-payment-action" });
      mocks.database.mockImplementation(() => {
        throw new Error("private-database-sentinel");
      });
      expect(await action({})).toEqual({ ok: false, code: "NOT_AVAILABLE" });
      expect(mocks.identity).toHaveBeenCalledOnce();
      expect(command).not.toHaveBeenCalled();
    });

    it("preserves the command's domain failure without changing retry input", async () => {
      const raw = Object.freeze({ requestId: "original-request" });
      mocks.identity.mockResolvedValue({ subject: "SYNTHETIC-payment-action" });
      mocks.database.mockReturnValue({ fixture: "isolated" });
      command.mockRejectedValue(new SellerError("CONFLICT"));
      expect(await action(raw)).toEqual({ ok: false, code: "CONFLICT" });
      expect(command.mock.calls[0][2]).toBe(raw);
    });
  });
}
