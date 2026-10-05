import { describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
// Match the actual web importer package, not a missing root dependency.
vi.mock("../../apps/web/node_modules/server-only/index.js", () => ({}));
vi.mock("../../apps/web/src/server/media/storage.server", () => ({
  requireMediaStorage: () => {
    throw Error("No live provider in the byte-adapter unit test");
  },
}));
import sharp from "../../apps/web/node_modules/sharp";
import {
  intakeInput,
  assetInput,
  ATTACHMENT_LIMITS,
  ATTACHMENT_PURPOSE,
} from "../../apps/web/src/features/message-attachments/model";
import {
  reencodeAttachment,
  checksumOf,
  rasterType,
} from "../../apps/web/src/features/message-attachments/raster.server";
import { createAttachmentStorage } from "../../apps/web/src/features/message-attachments/storage.server";
import {
  parseReplyCommand,
  parseReplyDraft,
} from "../../apps/web/src/features/messaging/reply-model";
const scope = { sellerId: null, threadId: randomUUID() };
const intake = {
  ...scope,
  requestId: randomUUID(),
  bytes: 12,
  checksum: "a".repeat(64),
  contentType: "image/png",
};
describe("private attachment input and raster boundary", () => {
  it("rejects forged readiness, immutable keys, documents and excessive bytes", () => {
    for (const patch of [
      { state: "ready" },
      { sourceKey: "private" },
      { contentType: "image/svg+xml" },
      { contentType: "application/pdf" },
      { bytes: ATTACHMENT_LIMITS.bytes + 1 },
      { checksum: "bad" },
      { bytes: 0 },
    ])
      expect(() => intakeInput({ ...intake, ...patch })).toThrow();
    expect(intakeInput(intake).checksum).toBe(intake.checksum);
    expect(() =>
      assetInput({ ...scope, id: randomUUID(), revision: 1, state: "ready" }),
    ).toThrow();
  });
  it.each(["jpeg", "png", "webp"] as const)(
    "decodes %s and emits metadata-free bounded WebP",
    async (format) => {
      const bytes = await sharp({
        create: { width: 64, height: 32, channels: 3, background: "red" },
      })
        .withMetadata({ orientation: 6 })
        .toFormat(format)
        .toBuffer();
      const result = await reencodeAttachment(bytes, {
        bytes: bytes.length,
        checksum: checksumOf(bytes),
        contentType: "image/" + format,
      });
      const info = await sharp(result.bytes).metadata();
      expect(info.format).toBe("webp");
      expect(info.exif).toBeUndefined();
      expect(info.icc).toBeUndefined();
      expect(info.orientation).toBeUndefined();
      expect(result.width).toBeLessThanOrEqual(2048);
      expect(result.height).toBeLessThanOrEqual(2048);
      expect(checksumOf(result.bytes)).toBe(result.checksum);
    },
  );
  it("rejects checksum substitution, MIME spoofing, executable payload and corrupt raster", async () => {
    const bytes = await sharp({
      create: { width: 1, height: 1, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    await expect(
      reencodeAttachment(bytes, {
        bytes: bytes.length,
        checksum: "b".repeat(64),
        contentType: "image/png",
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      reencodeAttachment(bytes, {
        bytes: bytes.length,
        checksum: checksumOf(bytes),
        contentType: "image/jpeg",
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(() =>
      rasterType(Buffer.from("<svg><script>evil</script></svg>")),
    ).toThrow();
    const corrupt = Buffer.from([255, 216, 255, 0]);
    await expect(
      reencodeAttachment(corrupt, {
        bytes: 4,
        checksum: checksumOf(corrupt),
        contentType: "image/jpeg",
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("rejects APNG markers and oversized decompression before conversion", async () => {
    const bytes = await sharp({
      create: { width: 1, height: 1, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    const animation = Buffer.alloc(20);
    animation.writeUInt32BE(8, 0);
    animation.write("acTL", 4, "ascii");
    const animated = Buffer.concat([
      bytes.subarray(0, 8),
      animation,
      bytes.subarray(8),
    ]);
    await expect(
      reencodeAttachment(animated, {
        bytes: animated.length,
        checksum: checksumOf(animated),
        contentType: "image/png",
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    const large = await sharp({
      create: { width: 5000, height: 5000, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    await expect(
      reencodeAttachment(large, {
        bytes: large.length,
        checksum: checksumOf(large),
        contentType: "image/png",
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("uses a separate purpose/scope and rejects listing or another prefix keys", async () => {
    const base = {
      scope: "a".repeat(64),
      prefix: "test-private/",
      put: vi.fn(),
      read: vi.fn(),
      remove: vi.fn(),
      head: vi.fn(),
      freeze: vi.fn(),
      upload: vi.fn(),
    };
    const storage = createAttachmentStorage(base);
    expect(storage.scope).not.toBe(base.scope);
    expect(storage.purpose).toBe(ATTACHMENT_PURPOSE);
    await storage.put(storage.prefix + "source/id/token", Buffer.from("x"));
    expect(base.put).toHaveBeenCalledOnce();
    expect(() =>
      storage.read(base.prefix + "ready/listing/image.webp", 100),
    ).toThrow();
    expect(() =>
      storage.remove("other-private/message-attachments/source/id"),
    ).toThrow();
  });
  it("retains the exact attachment IDs in uncertain ordinary-send recovery", () => {
    const ids = [randomUUID(), randomUUID()],
      command = parseReplyCommand({
        actorSubject: "user_buyer",
        ...scope,
        requestId: randomUUID(),
        body: "",
        attachmentIds: ids,
      });
    expect(command.attachmentIds).toEqual(ids);
    const draft = parseReplyDraft(
      JSON.stringify({
        version: 1,
        body: "",
        attempt: command,
        rejected: false,
        code: "NOT_AVAILABLE",
        receipt: null,
      }),
      command,
    );
    expect(draft.invalid).toBe(false);
    expect(draft.draft.attempt?.attachmentIds).toEqual(ids);
    expect(() =>
      parseReplyCommand({ ...command, attachmentIds: [ids[0], ids[0]] }),
    ).toThrow();
    expect(
      parseReplyDraft(
        JSON.stringify({
          version: 1,
          body: "",
          attempt: command,
          rejected: false,
          code: null,
          receipt: null,
        }),
        { ...command, threadId: randomUUID() },
      ).invalid,
    ).toBe(true);
  });
});
