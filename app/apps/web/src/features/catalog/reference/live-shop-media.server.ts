import "server-only";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp, { type OverlayOptions } from "sharp";
import { liveShopPhotos } from "./live-shop-media-manifest";

const pending = new Map<string, Promise<Buffer>>();
export function readLiveShopMedia(key: string): Promise<Buffer> | undefined {
  const retina = key.endsWith("-3x");
  const variant = retina ? key.slice(0, -3) : key;
  const shelf = variant.startsWith("live-shelf-");
  const grid = variant.startsWith("live-grid-");
  const sourceKey = variant.replace(/^live-(shelf|grid)-/, "live-");
  if (!Object.hasOwn(liveShopPhotos, sourceKey)) return undefined;
  const photo = liveShopPhotos[sourceKey];
  const existing = pending.get(key);
  if (existing) return existing;
  const job = (async () => {
    const input = await readFile(
      resolve(
        process.cwd(),
        "../../.local/shop-reference/live/android-home-20260926",
        photo.file,
      ),
    );
    if (createHash("sha256").update(input).digest("hex") !== photo.sha256)
      throw new Error("Live Shop photograph source has changed");
    const meta = await sharp(input).metadata();
    if (meta.width !== 1280 || meta.height !== 2856)
      throw new Error("Live Shop photograph dimensions do not match");
    const [left, top, width, height] = photo.rect;
    const size =
      (shelf ? 150 : grid ? 192 : (photo.displayWidth ?? 395)) *
      (retina ? 3 : 1);
    let source = await sharp(input)
      .extract({ left, top, width, height })
      .png()
      .toBuffer();
    if ((shelf || grid) && photo.thumbnail) {
      const thumbnail = photo.thumbnail;
      const bytes = await readFile(
        resolve(
          process.cwd(),
          "../../.local/shop-reference/live/android-home-20260926",
          thumbnail.file,
        ),
      );
      if (createHash("sha256").update(bytes).digest("hex") !== thumbnail.sha256)
        throw new Error("Live Shop thumbnail source has changed");
      const metadata = await sharp(bytes).metadata();
      if (metadata.width !== 1280 || metadata.height !== 2856)
        throw new Error("Live Shop thumbnail dimensions do not match");
      const [x, y, w, h] = thumbnail.rect;
      // Remove the source Save control completely, restoring only the same
      // product photograph beneath it. The clickable heart remains live DOM.
      const cutout = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><circle cx="${w - 82}" cy="${h - 82}" r="60" fill="white"/></svg>`,
      );
      const photoLayers: OverlayOptions[] = [
        { input: cutout, blend: "dest-out" },
      ];
      if (thumbnail.inset) {
        const inset = thumbnail.inset;
        // Exclude the recorded tile border. Only photographic pixels survive;
        // the native radius, frame, price and Save button remain live owners.
        photoLayers.push({
          input: Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect x="${inset}" y="${inset}" width="${w - 2 * inset}" height="${h - 2 * inset}" rx="${60 - inset}" fill="white"/></svg>`,
          ),
          blend: "dest-in",
        });
      }
      const topPhoto = await sharp(bytes)
        .extract({ left: x, top: y, width: w, height: h })
        .ensureAlpha()
        .composite(photoLayers)
        .png()
        .toBuffer();
      source = await sharp(source)
        .resize(w, h, { fit: "cover" })
        .composite([{ input: topPhoto }])
        .png()
        .toBuffer();
    }
    return sharp(source)
      .resize({
        width: Math.min(size, width),
        height: shelf || grid ? size : undefined,
        fit: "cover",
        kernel: sharp.kernel.lanczos3,
        withoutEnlargement: true,
      })
      .webp({ lossless: true })
      .toBuffer();
  })();
  pending.set(key, job);
  void job.catch(() => pending.delete(key));
  return job;
}
