import "server-only";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

let pending: Promise<Buffer> | undefined;
export function readSolMedia(key: string): Promise<Buffer> | undefined {
  if (key !== "sol-hush-partial") return undefined;
  if (!pending) {
    pending = (async () => {
      const bytes = await readFile(
        resolve(
          process.cwd(),
          "../../references/shop/flows/ae7711ef-6c54-4aa1-bb56-bee25cf3bef7/005.webp",
        ),
      );
      if (
        createHash("sha256").update(bytes).digest("hex") !==
        "750883afd1d3f05e70ef264ce74d01458d6066cd565e853d86bb52d3a5082944"
      )
        throw new Error("Sol result source does not match frozen provenance");
      // Only the visible left fragment of HUSH's photograph. No merchant text,
      // price, rating, card border or button pixels are included or invented.
      const normalized = await sharp(bytes)
        .resize(393, 892, { fit: "fill", kernel: sharp.kernel.lanczos3 })
        .png()
        .toBuffer();
      return sharp(normalized)
        .extract({ left: 345, top: 385, width: 48, height: 156 })
        .webp({ lossless: true })
        .toBuffer();
    })();
    void pending.catch(() => {
      pending = undefined;
    });
  }
  return pending;
}
