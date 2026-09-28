import "server-only";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

type Cutout = readonly [number, number, number, number, number];
type Photo = {
  frame: "002" | "003" | "004";
  rect: readonly [number, number, number, number];
  cutouts: readonly Cutout[];
  fullHeight?: number;
};
const offerAndSave: readonly Cutout[] = [
  [12, 12, 73, 17, 8.5],
  [132, 132, 32, 32, 16],
];
// The price/heart/navigation pixels are removed from the photograph, NOT
// reproduced by an image. ProductCard, SaveButton and FloatingNav own those
// controls. The one-pixel card boundary and rounded outer edge are also removed.
// Transparent occlusions and uncaptured lower image regions remain explicit
// visual obligations; this does not mask any pixels in a parity comparison.
const photos: Readonly<Record<string, Photo>> = {
  "following-photo-amber": {
    frame: "003",
    rect: [16, 283, 177, 177],
    cutouts: offerAndSave,
  },
  "following-photo-mandarin": {
    frame: "003",
    rect: [201, 283, 176, 177],
    cutouts: [
      [12, 12, 73, 17, 8.5],
      [131, 132, 32, 32, 16],
    ],
  },
  "following-photo-cashmere": {
    frame: "003",
    rect: [16, 518, 177, 177],
    cutouts: offerAndSave,
  },
  "following-photo-charcoal": {
    frame: "003",
    rect: [201, 518, 176, 177],
    cutouts: [
      [12, 12, 73, 17, 8.5],
      [131, 132, 32, 32, 16],
    ],
  },
  "following-photo-lemon": {
    frame: "003",
    rect: [16, 752, 177, 100],
    fullHeight: 177,
    cutouts: [
      [12, 12, 73, 17, 8.5],
      [0, 10, 60, 60, 30],
      [67, 10, 225, 60, 30],
    ],
  },
  "following-photo-santa-fe": {
    frame: "003",
    rect: [201, 752, 176, 100],
    fullHeight: 177,
    cutouts: [
      [12, 12, 73, 17, 8.5],
      [-118, 10, 225, 60, 30],
    ],
  },
  "following-photo-bow": {
    frame: "004",
    rect: [16, 169, 361, 361],
    cutouts: [[317, 317, 32, 32, 16]],
  },
  "following-photo-older-pura": {
    frame: "004",
    rect: [16, 673, 361, 179],
    fullHeight: 361,
    cutouts: [
      [12, 12, 73, 17, 8.5],
      [0, 89, 60, 60, 30],
      [67, 89, 225, 60, 30],
    ],
  },
  "following-photo-quilt": {
    frame: "002",
    rect: [16, 408, 361, 361],
    cutouts: [
      [12, 12, 49, 17, 8.5],
      [317, 317, 32, 32, 16],
    ],
  },
};
const pending = new Map<string, Promise<Buffer>>();
export function readFollowingMedia(key: string): Promise<Buffer> | undefined {
  if (!Object.hasOwn(photos, key)) return undefined;
  if (!pending.has(key)) {
    const photo = photos[key];
    const job = (async () => {
      const input = await readFile(
        resolve(
          process.cwd(),
          "../../references/shop/flows/d0ac7fdc-d174-4a9c-a18d-3136f358c5a7",
          `${photo.frame}.webp`,
        ),
      );
      const metadata = await sharp(input).metadata();
      if (
        ![1179, 1180].includes(metadata.width ?? 0) ||
        metadata.height !== 2676
      )
        throw new Error("Following source dimensions do not match its capture");
      const normalized = await sharp(input)
        .resize(393, 892, { fit: "fill", kernel: sharp.kernel.lanczos3 })
        .png()
        .toBuffer();
      const [left, top, width, height] = photo.rect;
      const cutouts = photo.cutouts
        .map(
          ([x, y, w, h, r]) =>
            `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="white"/>`,
        )
        .join("");
      const svg = (body: string) =>
        Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${body}</svg>`,
        );
      return sharp(normalized)
        .extract({ left, top, width, height })
        .ensureAlpha()
        .composite([
          { input: svg(cutouts), blend: "dest-out" },
          {
            input: svg(
              `<rect x="1" y="1" width="${width - 2}" height="${(photo.fullHeight ?? height) - 2}" rx="19" fill="white"/>`,
            ),
            blend: "dest-in",
          },
        ])
        .webp({ lossless: true })
        .toBuffer();
    })();
    pending.set(key, job);
    void job.catch(() => pending.delete(key));
  }
  return pending.get(key);
}
