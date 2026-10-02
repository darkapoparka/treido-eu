import "server-only";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { MEDIA_LIMITS } from "../../features/selling/media-model";
import { SellerError } from "../../features/sellers/errors";

export async function processPhoto(bytes: Buffer, checksum: string) {
  if (
    bytes.length < 1 ||
    bytes.length > MEDIA_LIMITS.bytes ||
    createHash("sha256").update(bytes).digest("hex") !== checksum
  )
    throw new SellerError("INVALID_INPUT");
  try {
    const input = sharp(bytes, {
      limitInputPixels: MEDIA_LIMITS.pixels,
      failOn: "error",
      sequentialRead: true,
    }).timeout({ seconds: 10 });
    const info = await input.metadata();
    if (
      !["jpeg", "png", "webp"].includes(info.format ?? "") ||
      !info.width ||
      !info.height ||
      info.width * info.height > MEDIA_LIMITS.pixels ||
      (info.pages ?? 1) > 1
    )
      throw new SellerError("INVALID_INPUT");
    const result = await input
      .rotate()
      .resize({
        width: MEDIA_LIMITS.edge,
        height: MEDIA_LIMITS.edge,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    return {
      bytes: result.data,
      width: result.info.width,
      height: result.info.height,
      checksum: createHash("sha256").update(result.data).digest("hex"),
    };
  } catch {
    throw new SellerError("INVALID_INPUT");
  }
}
