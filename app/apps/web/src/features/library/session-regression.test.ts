import { describe, expect, it, vi, beforeEach } from "vitest";
const boundary = vi.hoisted(() => ({
  identity: vi.fn(),
  database: vi.fn(() => ({ testOnly: true })),
  libraryRead: vi.fn(),
  libraryChange: vi.fn(),
  cartRead: vi.fn(),
  cartChange: vi.fn(),
}));
vi.mock("../../server/db/database", () => ({ getDatabase: boundary.database }));
vi.mock("../../server/identity/clerk.server", () => ({
  requireVerifiedIdentity: boundary.identity,
}));
vi.mock("./queries.server", () => ({ readLibrary: boundary.libraryRead }));
vi.mock("./commands.server", () => ({ changeLibrary: boundary.libraryChange }));
vi.mock("../buyer-cart/cart.server", () => ({
  readBuyerCart: boundary.cartRead,
  changeBuyerCart: boundary.cartChange,
}));
import { readLibraryAction, changeLibraryAction } from "./actions";
import {
  readBuyerCartAction,
  changeBuyerCartAction,
} from "../buyer-cart/actions";
import { SellerError } from "../sellers/errors";
import { acceptsPrivateResult } from "./private-session";

describe("T71 verified private response envelopes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    boundary.identity.mockResolvedValue({ subject: "synthetic-B" });
  });
  it("binds library and cart reads to the verified server subject and actor projection", async () => {
    boundary.libraryRead.mockResolvedValue({ actorKey: "B-library" });
    boundary.cartRead.mockResolvedValue({ actorKey: "B-cart" });
    expect(await readLibraryAction({})).toEqual({
      ok: true,
      subject: "synthetic-B",
      data: { actorKey: "B-library" },
    });
    expect(await readBuyerCartAction()).toEqual({
      ok: true,
      subject: "synthetic-B",
      data: { actorKey: "B-cart" },
    });
  });
  it("denies A library recovery under B before any database command", async () => {
    expect(await changeLibraryAction({}, {}, "synthetic-A")).toEqual({
      ok: false,
      subject: "synthetic-B",
      code: "FORBIDDEN",
    });
    expect(boundary.database).not.toHaveBeenCalled();
    expect(boundary.libraryChange).not.toHaveBeenCalled();
  });
  it("denies A cart recovery under B before any database command", async () => {
    expect(await changeBuyerCartAction({}, "synthetic-A")).toEqual({
      ok: false,
      subject: "synthetic-B",
      code: "FORBIDDEN",
    });
    expect(boundary.database).not.toHaveBeenCalled();
    expect(boundary.cartChange).not.toHaveBeenCalled();
  });
  it("permits current B library and cart commands and returns B envelopes", async () => {
    boundary.libraryChange.mockResolvedValue({ revision: 2, resultId: null });
    boundary.libraryRead.mockResolvedValue({
      actorKey: "B-library",
      revision: 2,
    });
    boundary.cartRead.mockResolvedValue({ actorKey: "B-cart", revision: 2 });
    expect(await changeLibraryAction({}, {}, "synthetic-B")).toMatchObject({
      ok: true,
      subject: "synthetic-B",
    });
    expect(await changeBuyerCartAction({}, "synthetic-B")).toMatchObject({
      ok: true,
      subject: "synthetic-B",
    });
    expect(boundary.libraryChange).toHaveBeenCalledOnce();
    expect(boundary.cartChange).toHaveBeenCalledOnce();
  });
  it("keeps unauthenticated denial explicit with no fabricated subject", async () => {
    boundary.identity.mockRejectedValue(new SellerError("UNAUTHENTICATED"));
    expect(await readLibraryAction({})).toEqual({
      ok: false,
      subject: null,
      code: "UNAUTHENTICATED",
    });
    expect(await readBuyerCartAction()).toEqual({
      ok: false,
      subject: null,
      code: "UNAUTHENTICATED",
    });
  });
  it("retains real read failures under their verified scope", async () => {
    boundary.libraryRead.mockRejectedValue(new SellerError("FORBIDDEN"));
    expect(await readLibraryAction({})).toEqual({
      ok: false,
      subject: "synthetic-B",
      code: "FORBIDDEN",
    });
  });
  it("rejects foreign or invalidated scopes while accepting current B", () => {
    const current = {
      key: "B",
      identityKey: "B",
      subject: "synthetic-B",
      isCurrent: () => true,
    };
    expect(
      acceptsPrivateResult(current, {
        ok: true,
        subject: "synthetic-A",
        data: {},
      }),
    ).toBe(false);
    expect(
      acceptsPrivateResult(
        { ...current, isCurrent: () => false },
        { ok: true, subject: "synthetic-B", data: {} },
      ),
    ).toBe(false);
    expect(
      acceptsPrivateResult(current, {
        ok: true,
        subject: "synthetic-B",
        data: {},
      }),
    ).toBe(true);
  });
  it("keeps a delayed library response bound to A after the next request becomes B", async () => {
    boundary.identity.mockResolvedValueOnce({ subject: "synthetic-A" });
    let finish!: (view: { actorKey: string }) => void;
    boundary.libraryRead.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = readLibraryAction({});
    await vi.waitFor(() => expect(boundary.libraryRead).toHaveBeenCalled());
    finish({ actorKey: "A-library" });
    const result = await pending;
    expect(result.subject).toBe("synthetic-A");
    expect(
      acceptsPrivateResult(
        {
          key: "B",
          identityKey: "B",
          subject: "synthetic-B",
          isCurrent: () => true,
        },
        result,
      ),
    ).toBe(false);
  });
  it("keeps a delayed cart response bound to A and rejects it after sign-out", async () => {
    boundary.identity.mockResolvedValueOnce({ subject: "synthetic-A" });
    let finish!: (cart: { actorKey: string }) => void;
    boundary.cartRead.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = readBuyerCartAction();
    await vi.waitFor(() => expect(boundary.cartRead).toHaveBeenCalled());
    finish({ actorKey: "A-cart" });
    const result = await pending;
    expect(result.subject).toBe("synthetic-A");
    expect(
      acceptsPrivateResult(
        {
          key: "guest",
          identityKey: "guest",
          subject: null,
          isCurrent: () => true,
        },
        result,
      ),
    ).toBe(false);
  });
});
