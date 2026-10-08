import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mock = vi.hoisted(() => ({
  identity: vi.fn(),
  database: vi.fn(),
  key: vi.fn(),
  read: vi.fn(),
  review: vi.fn(),
}));
vi.mock("../../server/identity/clerk.server", () => ({
  requireVerifiedIdentity: mock.identity,
}));
vi.mock("../../server/db/database", () => ({ getDatabase: mock.database }));
vi.mock("../library/cursor.server", () => ({ libraryActorKey: mock.key }));
vi.mock("./persistence.server", () => ({
  readDeclarationReview: mock.read,
  reviewSellerDeclaration: mock.review,
}));
import {
  readDeclarationReviewAction,
  reviewSellerDeclarationAction,
} from "./actions";
import { SellerError } from "../sellers/errors";
const declarationId = "10000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.clearAllMocks();
  mock.identity.mockResolvedValue({ subject: "user_current_operator" });
  mock.database.mockReturnValue("restricted-database");
  mock.key.mockReturnValue("current-actor-key");
});
it("rechecks provider identity and forwards only its current authority", async () => {
  const receipt = { id: declarationId, revision: 2 };
  mock.review.mockResolvedValue(receipt);
  const input = { sellerId: declarationId, reason: "Reviewed facts" };
  expect(
    await reviewSellerDeclarationAction({
      actorKey: "current-actor-key",
      input,
    }),
  ).toEqual({ ok: true, data: receipt });
  expect(mock.identity).toHaveBeenCalledOnce();
  expect(mock.review).toHaveBeenCalledWith(
    "restricted-database",
    { subject: "user_current_operator" },
    input,
  );
});
it.each([readDeclarationReviewAction, reviewSellerDeclarationAction])(
  "rejects a different actor before reading or deciding",
  async (action) => {
    const raw = {
      actorKey: "prior-actor-key",
      ...(action === readDeclarationReviewAction
        ? { declarationId }
        : { input: {} }),
    };
    expect(await action(raw)).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(mock.read).not.toHaveBeenCalled();
    expect(mock.review).not.toHaveBeenCalled();
  },
);
it("rejects browser operator roles and foreign extra envelope fields", async () => {
  expect(
    await readDeclarationReviewAction({
      actorKey: "current-actor-key",
      declarationId,
      role: "operator",
    }),
  ).toEqual({ ok: false, code: "INVALID_INPUT" });
  expect(mock.read).not.toHaveBeenCalled();
});
it("returns current revocation without success or fixture fallback", async () => {
  mock.review.mockRejectedValue(new SellerError("FORBIDDEN"));
  expect(
    await reviewSellerDeclarationAction({
      actorKey: "current-actor-key",
      input: {},
    }),
  ).toEqual({ ok: false, code: "FORBIDDEN" });
});
it("requires a current session before any envelope handling", async () => {
  mock.identity.mockRejectedValue(new SellerError("UNAUTHENTICATED"));
  expect(
    await readDeclarationReviewAction({
      actorKey: "current-actor-key",
      declarationId,
    }),
  ).toEqual({ ok: false, code: "UNAUTHENTICATED" });
  expect(mock.read).not.toHaveBeenCalled();
});
