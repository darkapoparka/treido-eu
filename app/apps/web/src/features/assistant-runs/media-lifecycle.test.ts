import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  query: vi.fn(),
  human: vi.fn(),
  owned: vi.fn(),
  consent: vi.fn(),
  policy: vi.fn(),
  lifecycle: vi.fn(),
  process: vi.fn(),
  head: vi.fn(),
  read: vi.fn(),
  freeze: vi.fn(),
  put: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("../../server/db/database", () => ({
  inTransaction: async (
    _db: unknown,
    work: (tx: unknown) => Promise<unknown>,
  ) => work({ client: { query: m.query } }),
}));
vi.mock("../sellers/persistence.server", () => ({ authorizeHuman: m.human }));
vi.mock("../../server/media/storage.server", () => ({
  requireMediaStorage: () => ({
    scope: "a".repeat(64),
    prefix: "isolated/",
    head: m.head,
    read: m.read,
    freeze: m.freeze,
    put: m.put,
    upload: m.upload,
    remove: m.remove,
  }),
}));
vi.mock("../../server/media/process.server", () => ({
  processPhoto: m.process,
}));
vi.mock("./storage.server", () => ({
  requireInputStorage: vi.fn(),
  requireInputLifecycle: m.lifecycle,
  ownedInputMedia: m.owned,
  requireInputConsent: m.consent,
}));
vi.mock("./policy.server", async () => {
  const { SellerError } = await import("../sellers/errors");
  return {
    runtimePolicy: m.policy,
    requirePolicy: (value: unknown) => {
      if (!value) throw new SellerError("NOT_AVAILABLE");
      return value;
    },
  };
});
import {
  completeInputMedia,
  readOwnedInputBytes,
  signInputUpload,
} from "./media.server";
import { SellerError } from "../sellers/errors";
import { isolatedPolicy } from "./test-fixtures";
import type { SellerDatabase } from "../../server/db/database";
import type { InputMedia } from "./storage.server";
const database = {} as SellerDatabase,
  identity = { subject: "user_alice" },
  userId = "10000000-0000-4000-8000-000000000002",
  assetId = "10000000-0000-4000-8000-000000000003";
const original = Buffer.from([255, 216, 255, 1, 2, 3, 4, 5]),
  processed = Buffer.from("RIFF0000WEBP"),
  digest = (value: Buffer) => createHash("sha256").update(value).digest("hex");
let current: InputMedia, remainingTime: boolean;
beforeEach(() => {
  vi.clearAllMocks();
  remainingTime = true;
  current = {
    id: assetId,
    userId,
    mode: "photo",
    policyId: isolatedPolicy.id,
    bytes: original.length,
    contentType: "image/jpeg",
    checksum: digest(original),
    scope: isolatedPolicy.config.mediaScope,
    staging: "isolated/staging/owned",
    immutable: "isolated/immutable/owned",
    ready: null,
    readyChecksum: null,
    readyBytes: null,
    state: "validating",
    expiresAt: new Date("2030-01-01T00:10:00Z"),
    writeUntil: new Date("2030-01-01T00:20:00Z"),
    expired: false,
  };
  m.human.mockResolvedValue({ id: userId });
  m.owned.mockImplementation(async () => ({ ...current }));
  m.policy.mockResolvedValue(isolatedPolicy);
  m.consent.mockResolvedValue(undefined);
  m.lifecycle.mockResolvedValue(undefined);
  m.head.mockResolvedValue({
    bytes: original.length,
    etag: '"' + "a".repeat(32) + '"',
  });
  m.freeze.mockResolvedValue(undefined);
  m.read.mockResolvedValue(original);
  m.process.mockResolvedValue({
    bytes: processed,
    checksum: digest(processed),
  });
  m.put.mockResolvedValue(undefined);
  m.upload.mockResolvedValue({
    url: "https://isolated.invalid/no-network",
    headers: {},
  });
  m.query.mockImplementation(async (sql: string) => {
    if (sql.includes("AS allowed"))
      return { rows: [{ allowed: remainingTime }] };
    if (sql.includes("SET state='unknown'") && current.state === "validating")
      current.state = "unknown";
    if (sql.includes("SET state='ready'")) current.state = "ready";
    return { rows: [], rowCount: 1 };
  });
});
it("foreign media rejection cannot perform IO or mutate recovery state", async () => {
  m.owned.mockRejectedValue(new SellerError("NOT_FOUND"));
  await expect(
    completeInputMedia(database, identity, assetId, async () => identity),
  ).rejects.toThrow("NOT_FOUND");
  expect(m.query).not.toHaveBeenCalled();
  expect(m.head).not.toHaveBeenCalled();
  expect(m.freeze).not.toHaveBeenCalled();
  expect(m.put).not.toHaveBeenCalled();
  expect(current.state).toBe("validating");
});
it("a mismatched original size is rejected before freeze with only the authorized original recovery predicate", async () => {
  m.head.mockResolvedValue({ bytes: original.length + 1, etag: "unused" });
  await expect(
    completeInputMedia(database, identity, assetId, async () => identity),
  ).rejects.toThrow("INVALID_INPUT");
  expect(m.freeze).not.toHaveBeenCalled();
  expect(m.process).not.toHaveBeenCalled();
  expect(m.put).not.toHaveBeenCalled();
  const recovery = m.query.mock.calls.find(([sql]) =>
    sql.includes("SET state='unknown'"),
  )!;
  expect(recovery[1]).toEqual([assetId, userId, "photo", current.immutable]);
  expect(recovery[0]).toContain("state='validating'");
});
it("mismatched actual checksum or image type cannot reach Sharp or ready storage", async () => {
  m.read.mockResolvedValue(Buffer.from("changed!"));
  await expect(
    completeInputMedia(database, identity, assetId, async () => identity),
  ).rejects.toThrow("INVALID_INPUT");
  expect(m.process).not.toHaveBeenCalled();
  expect(m.put).not.toHaveBeenCalled();
  current.state = "validating";
  current.contentType = "image/png";
  m.read.mockResolvedValue(original);
  await expect(
    completeInputMedia(database, identity, assetId, async () => identity),
  ).rejects.toThrow("INVALID_INPUT");
  expect(m.process).not.toHaveBeenCalled();
  expect(m.put).not.toHaveBeenCalled();
});
it("fresh account authority is checked again after processing and before the derivative write", async () => {
  let reads = 0;
  await expect(
    completeInputMedia(database, identity, assetId, async () =>
      ++reads === 1 ? identity : { subject: "user_bob" },
    ),
  ).rejects.toThrow("UNAUTHENTICATED");
  expect(m.process).toHaveBeenCalledTimes(1);
  expect(m.put).not.toHaveBeenCalled();
  expect(
    m.query.mock.calls.some(([sql]) =>
      sql.startsWith("INSERT INTO treido.assistant_media_objects"),
    ),
  ).toBe(false);
});
it("an accepted derivative is registered before IO under the same fixed original writer deadline", async () => {
  m.put.mockImplementation(async () => {
    expect(
      m.query.mock.calls.some(([sql]) =>
        sql.startsWith("INSERT INTO treido.assistant_media_objects"),
      ),
    ).toBe(true);
  });
  await completeInputMedia(database, identity, assetId, async () => identity);
  const registration = m.query.mock.calls.find(([sql]) =>
    sql.startsWith("INSERT INTO treido.assistant_media_objects"),
  )!;
  expect(registration[1][5]).toEqual(current.writeUntil);
  expect(m.freeze).toHaveBeenCalledTimes(1);
  expect(m.put).toHaveBeenCalledTimes(1);
  expect(current.state).toBe("ready");
  expect(m.human.mock.calls.every((call) => call[2] === false)).toBe(true);
});
it("a cancellation during IO cannot publish a late ready asset or undo the cancellation", async () => {
  m.put.mockImplementation(async () => {
    current.state = "cancelled";
  });
  await expect(
    completeInputMedia(database, identity, assetId, async () => identity),
  ).rejects.toThrow("CONFLICT");
  expect(current.state).toBe("cancelled");
  expect(
    m.query.mock.calls.some(([sql]) => sql.includes("SET state='ready'")),
  ).toBe(false);
  expect(m.put).toHaveBeenCalledTimes(1);
});
it("expired original signing time never creates another upload URL and a post-sign account switch withholds it", async () => {
  current.state = "staged";
  remainingTime = false;
  await expect(
    signInputUpload(database, identity, assetId, async () => identity),
  ).rejects.toThrow("NOT_AVAILABLE");
  expect(m.upload).not.toHaveBeenCalled();
  remainingTime = true;
  await expect(
    signInputUpload(database, identity, assetId, async () => ({
      subject: "user_bob",
    })),
  ).rejects.toThrow("UNAUTHENTICATED");
  expect(m.upload).toHaveBeenCalledTimes(1);
});
it("private bytes are withheld if consent is withdrawn during the authenticated read", async () => {
  current.state = "ready";
  current.ready = "isolated/ready/owned.webp";
  current.readyBytes = processed.length;
  current.readyChecksum = digest(processed);
  m.read.mockResolvedValue(processed);
  m.consent
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new SellerError("FORBIDDEN"));
  await expect(
    readOwnedInputBytes(database, identity, assetId),
  ).rejects.toThrow("FORBIDDEN");
  expect(m.read).toHaveBeenCalledTimes(1);
  expect(m.freeze).not.toHaveBeenCalled();
  expect(m.put).not.toHaveBeenCalled();
});
