import { describe, expect, it, vi, afterEach } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
vi.mock("server-only", () => ({}));
import { processPhoto } from "./process.server";
import { createR2Storage } from "./storage.server";
import { validateMediaBindings } from "./bindings";
import { validUpload, MEDIA_LIMITS } from "../../features/selling/media-model";
const settings = {
  TREIDO_ENV: "test",
  TREIDO_R2_ACCOUNT_ID: "a".repeat(32),
  TREIDO_R2_BUCKET: "treido-test",
  TREIDO_R2_PREFIX: "test-treido/",
  TREIDO_R2_JURISDICTION: "eu",
  TREIDO_R2_PURPOSE: "test",
  R2_ACCESS_KEY_ID: "b".repeat(32),
  R2_SECRET_ACCESS_KEY: "c".repeat(64),
  TREIDO_APP_ORIGIN: "http://127.0.0.1:6419",
};
afterEach(() => vi.unstubAllGlobals());
describe("private R2 and bounded raster processing", () => {
  it("requires the exact declared purpose, EU jurisdiction and isolated prefix without leaking keys", () => {
    const parsed = validateMediaBindings(settings);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.bindings.endpoint).toBe(
        `https://${"a".repeat(32)}.eu.r2.cloudflarestorage.com`,
      );
      expect(JSON.stringify(parsed)).not.toContain("c".repeat(64));
    }
    for (const override of [
      { TREIDO_R2_JURISDICTION: "default" },
      { TREIDO_R2_PURPOSE: "production" },
      { TREIDO_R2_PREFIX: "production/" },
      { NEXT_PUBLIC_R2_SECRET: "secret" },
    ])
      expect(validateMediaBindings({ ...settings, ...override }).ok).toBe(
        false,
      );
  });
  it("signs a narrow short-lived PUT with matching type/length and prevents external keys", async () => {
    const configured = validateMediaBindings(settings);
    if (!configured.ok) throw new Error("Fixture invalid");
    const storage = createR2Storage(configured.bindings, {
      accessKeyId: settings.R2_ACCESS_KEY_ID,
      secretAccessKey: settings.R2_SECRET_ACCESS_KEY,
    });
    const put = await storage.upload(
      `test-treido/staging/${randomUUID()}/${randomUUID()}`,
      { bytes: 100, contentType: "image/png" },
    );
    const url = new URL(put.url);
    expect(url.hostname).toBe(`${"a".repeat(32)}.eu.r2.cloudflarestorage.com`);
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toContain(
      "content-type",
    );
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toContain(
      "content-length",
    );
    await expect(
      storage.upload("foreign/staging/object", {
        bytes: 100,
        contentType: "image/png",
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("validates actual bytes/checksum and reencodes without metadata", async () => {
    const photo = await sharp({
      create: { width: 2000, height: 1000, channels: 3, background: "red" },
    })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Artist: "PRIVATE PERSON" } } })
      .toBuffer();
    const digest = createHash("sha256").update(photo).digest("hex");
    const result = await processPhoto(photo, digest);
    const metadata = await sharp(result.bytes).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.exif).toBeUndefined();
    expect(result.width).toBe(1600);
    expect(result.height).toBe(800);
    await expect(processPhoto(photo, "f".repeat(64))).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>',
    );
    await expect(
      processPhoto(svg, createHash("sha256").update(svg).digest("hex")),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("rejects oversized claims and streamed storage responses regardless of MIME", async () => {
    const input = {
      sellerId: randomUUID(),
      draftId: randomUUID(),
      requestId: randomUUID(),
      bytes: 1,
      contentType: "image/png",
      checksum: "a".repeat(64),
    };
    expect(validUpload(input)).toBe(true);
    expect(validUpload({ ...input, bytes: MEDIA_LIMITS.bytes + 1 })).toBe(
      false,
    );
    expect(validUpload({ ...input, contentType: "image/svg+xml" })).toBe(false);
    const configured = validateMediaBindings(settings);
    if (!configured.ok) throw new Error("Fixture invalid");
    const storage = createR2Storage(configured.bindings, {
      accessKeyId: settings.R2_ACCESS_KEY_ID,
      secretAccessKey: settings.R2_SECRET_ACCESS_KEY,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("too long", { headers: { "content-length": "1" } }),
      ),
    );
    await expect(
      storage.read("test-treido/immutable/object", 4),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
