import "server-only";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

// Photograph-only rectangles in the normalized source. No card border, price,
// label, heart, dock or other interface pixels form part of these assets.
const photographs: Record<string, readonly [number, number, number, number]> = {
  "saved-glazing-milk": [79, 402, 55, 143],
  "saved-eye": [273, 397, 38, 148],
  // The lower tube is genuinely hidden. This is the visible fragment, not an
  // invented full product image; its unresolved remainder is never score-masked.
  "saved-pink-partial": [86, 672, 36, 91],
};
const pending = new Map<string, Promise<Buffer>>();
export function readSavedMedia(key: string): Promise<Buffer> | undefined {
  if (!Object.hasOwn(photographs, key)) return undefined;
  if (!pending.has(key)) {
    const job = (async () => {
      const input = await readFile(
        resolve(
          process.cwd(),
          "../../references/shop/flows/75b26fee-826f-4403-9288-be499890cd72/004.webp",
        ),
      );
      const [left, top, width, height] = photographs[key].map(
        (value) => value * 3,
      );
      const normalized = await sharp(input)
        .resize(1179, 2676, { fit: "fill", kernel: sharp.kernel.lanczos3 })
        .toBuffer();
      return sharp(normalized)
        .extract({ left, top, width, height })
        .webp({ quality: 100 })
        .toBuffer();
    })();
    pending.set(key, job);
    void job.catch(() => pending.delete(key));
  }
  return pending.get(key);
}
