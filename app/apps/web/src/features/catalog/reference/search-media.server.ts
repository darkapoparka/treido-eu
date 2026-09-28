import "server-only";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

type SearchMedia = {
  frame: "003" | "005";
  rect: readonly [number, number, number, number];
};

// These are deliberately bounded fragments from the photo-search capture. The
// source does not expose the rest of either card, so no unseen product art,
// destination, seller metadata, or lower card extent is synthesized here.
const media: Readonly<Record<string, SearchMedia>> = {
  "search-photo-recent-fragment": {
    frame: "003",
    rect: [377, 98, 16, 112],
  },
  "assistant-bounded-third-photo": {
    frame: "005",
    rect: [338, 468, 55, 148],
  },
};

const pending = new Map<string, Promise<Buffer>>();

export function readSearchMedia(key: string): Promise<Buffer> | undefined {
  if (!Object.hasOwn(media, key)) return undefined;
  if (!pending.has(key)) {
    const entry = media[key];
    const job = (async () => {
      const input = await readFile(
        resolve(
          process.cwd(),
          "../../references/shop/flows/d6910bbb-655d-44ad-842e-11da062a1e66",
          `${entry.frame}.webp`,
        ),
      );
      const metadata = await sharp(input).metadata();
      if (!metadata.width)
        throw new Error("Photo-search source image has no dimensions");
      const scale = metadata.width / 393;
      const [left, top, width, height] = entry.rect.map((value) =>
        Math.round(value * scale),
      );
      return sharp(input)
        .extract({ left, top, width, height })
        .webp({ quality: 95 })
        .toBuffer();
    })();
    pending.set(key, job);
    void job.catch(() => pending.delete(key));
  }
  return pending.get(key);
}
