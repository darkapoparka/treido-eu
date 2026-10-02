import "server-only";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { liveMerchantMedia } from "./live-merchant-media";
import { liveMerchantContinuationMedia } from "./live-merchant-continuation-media";
import { merchantSystemMedia } from "./merchant-system-media";
import { liveMerchantVideo } from "./live-merchant-video";

type Photograph = {
  file: string;
  sha256: string;
  rect?: readonly [number, number, number, number];
};
const photos: Readonly<Record<string, Photograph>> = {
  ...liveMerchantMedia,
  ...liveMerchantContinuationMedia,
  ...merchantSystemMedia,
};
const pending = new Map<string, Promise<Buffer>>();

async function verifiedBytes(file: string, sha256: string) {
  const bytes = await readFile(
    resolve(
      process.cwd(),
      "../../.local/shop-reference/live/android-explore-20260926",
      file,
    ),
  );
  if (createHash("sha256").update(bytes).digest("hex") !== sha256) {
    throw new Error("Seller reference asset checksum mismatch");
  }
  return bytes;
}

/** Keys come only from the checked manifest. No filesystem path is supplied by a request. */
export function readMerchantMedia(key: string): Promise<Buffer> | undefined {
  const sourceKey = key.endsWith("-3x") ? key.slice(0, -3) : key;
  if (!Object.hasOwn(photos, sourceKey)) return;
  const cached = pending.get(sourceKey);
  if (cached) return cached;
  const photo = photos[sourceKey];
  const job = (async () => {
    const image = sharp(await verifiedBytes(photo.file, photo.sha256));
    if (photo.rect) {
      const [left, top, width, height] = photo.rect;
      image.extract({ left, top, width, height });
    } else if (Object.hasOwn(liveMerchantContinuationMedia, sourceKey)) {
      image.resize({ width: 1280, withoutEnlargement: true });
    }
    return image.webp({ lossless: true }).toBuffer();
  })();
  pending.set(sourceKey, job);
  void job.catch(() => pending.delete(sourceKey));
  return job;
}

export function readMerchantVideo(key: string): Promise<Buffer> | undefined {
  if (!Object.hasOwn(liveMerchantVideo, key)) return;
  const cached = pending.get(key);
  if (cached) return cached;
  const clip = liveMerchantVideo[key as keyof typeof liveMerchantVideo];
  const job = verifiedBytes(clip.file, clip.sha256);
  pending.set(key, job);
  void job.catch(() => pending.delete(key));
  return job;
}
