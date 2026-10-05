import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
vi.mock("server-only", () => ({}));
import {
  LIBRARY_LIMITS,
  parseLibraryCommand,
  parseLibraryOperation,
  parseLibraryQuery,
} from "./model";
import {
  decodeLibraryCursor,
  encodeLibraryCursor,
  libraryActorKey,
} from "./cursor.server";
import { parseBuyerContinuation } from "./buyer-continuation";
import messages from "./messages.json";

describe("buyer library input and cursor contracts", () => {
  const actor = { subject: "user_library_contract" },
    another = { subject: "user_library_other" };
  const previousKey = process.env.TREIDO_DISCOVERY_CURSOR_KEY;
  beforeAll(() => {
    process.env.TREIDO_DISCOVERY_CURSOR_KEY = randomBytes(32).toString("hex");
  });
  afterAll(() => {
    if (previousKey === undefined)
      delete process.env.TREIDO_DISCOVERY_CURSOR_KEY;
    else process.env.TREIDO_DISCOVERY_CURSOR_KEY = previousKey;
  });
  it("accepts bounded explicit operations and normalizes collection names without trusting actor IDs", () => {
    const listingId = randomUUID();
    expect(
      parseLibraryOperation({
        kind: "createCollection",
        name: "  За дома  ",
        listingId,
      }),
    ).toEqual({ kind: "createCollection", name: "За дома", listingId });
    const command = {
      requestId: randomUUID(),
      expectedRevision: 0,
      actorKey: libraryActorKey(actor),
      operation: { kind: "save", listingId, saved: true },
    };
    expect(parseLibraryCommand(command)).toEqual(command);
    for (const invalid of [
      { ...command, userId: randomUUID() },
      { ...command, expectedRevision: -1 },
      { ...command, expectedRevision: 2147483647 },
      { ...command, actorKey: "user_spoof" },
    ])
      expect(() => parseLibraryCommand(invalid)).toThrow("INVALID_INPUT");
    for (const invalid of [
      { kind: "save", listingId, saved: "true" },
      { kind: "save", listingId: "invalid", saved: true },
      { kind: "createCollection", name: "   " },
      { kind: "createCollection", name: "x".repeat(81) },
      { kind: "createCollection", name: "a\u0000b" },
      {
        kind: "renameCollection",
        name: "A",
        collectionId: listingId,
        userId: randomUUID(),
      },
    ])
      expect(() => parseLibraryOperation(invalid)).toThrow("INVALID_INPUT");
  });
  it("bounds and deduplicates selection queries and rejects unrecognized fields", () => {
    const id = randomUUID();
    expect(parseLibraryQuery({ listingIds: [id, id] }).listingIds).toEqual([
      id,
    ]);
    for (const raw of [
      {
        listingIds: Array.from(
          { length: LIBRARY_LIMITS.selection + 1 },
          () => id,
        ),
      },
      { collectionId: "foreign" },
      { view: "everything" },
      { cursor: "x".repeat(1025) },
      { sellerId: id },
    ])
      expect(() => parseLibraryQuery(raw)).toThrow("INVALID_INPUT");
  });
  it("keeps exact cursor microseconds and binds cursors to human, view and collection", () => {
    const query = parseLibraryQuery({ view: "saved" });
    const actorKey = libraryActorKey(actor),
      position = { id: randomUUID(), at: "2026-10-03T00:00:00.123456Z" };
    const cursor = encodeLibraryCursor(position, actorKey, query);
    expect(decodeLibraryCursor(cursor, actorKey, query)).toEqual(position);
    expect(() =>
      decodeLibraryCursor(cursor, libraryActorKey(another), query),
    ).toThrow("INVALID_INPUT");
    expect(() =>
      decodeLibraryCursor(cursor, actorKey, { ...query, view: "following" }),
    ).toThrow("INVALID_INPUT");
    expect(() =>
      decodeLibraryCursor(cursor, actorKey, {
        ...query,
        collectionId: randomUUID(),
      }),
    ).toThrow("INVALID_INPUT");
    expect(() => decodeLibraryCursor("x" + cursor, actorKey, query)).toThrow(
      "INVALID_INPUT",
    );
  });
  it("returns sign-in to known buyer routes only and preserves BG/EN queries", () => {
    const id = randomUUID();
    for (const href of [
      "/",
      "/saved?lang=bg&collection=" + id,
      "/following?lang=en",
      "/products/" + id + "?lang=bg",
      "/stores/" + id + "/search?q=phone",
    ])
      expect(parseBuyerContinuation(href)).toBe(href);
    for (const href of [
      "//example.com/saved",
      "https://example.com",
      "/\\example.com",
      "/app/sellers/" + id,
      "/api/inngest",
      "/saved#secret",
      "/saved\n",
      "/%2fexample.com",
      "/products/not-a-listing",
    ])
      expect(parseBuyerContinuation(href)).toBeNull();
    expect(Object.keys(messages.bg).sort()).toEqual(
      Object.keys(messages.en).sort(),
    );
  });
});
