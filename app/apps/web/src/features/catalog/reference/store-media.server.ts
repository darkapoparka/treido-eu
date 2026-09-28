import "server-only";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

let sugar: Promise<Buffer> | undefined;
export function readStoreMedia(key: string): Promise<Buffer> | undefined {
  if (key !== "store-sugar-partial") return undefined;
  if (!sugar) {
    sugar = (async () => {
      const input = await readFile(
        resolve(
          process.cwd(),
          "../../references/shop/flows/e85d0150-4fe9-4ee0-bde4-de17fe6da7df/001.webp",
        ),
      );
      const { width } = await sharp(input).metadata();
      if (!width) throw new Error("Store photograph has no dimensions");
      const scale = width / 393;
      // Packaging only: no rounded card boundary, heart, price or title. The
      // transparent remainder is unknown artwork, not reconstructed pixels.
      const photo = await sharp(input)
        .extract({
          left: Math.round(324 * scale),
          top: Math.round(215 * scale),
          width: Math.round(53 * scale),
          height: Math.round(80 * scale),
        })
        .resize(159, 240)
        .png()
        .toBuffer();
      return sharp({
        create: {
          width: 402,
          height: 402,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .composite([{ input: photo, left: 18, top: 69 }])
        .webp({ quality: 95 })
        .toBuffer();
    })();
    void sugar.catch(() => {
      sugar = undefined;
    });
  }
  return sugar;
}
