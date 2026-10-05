import "server-only";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { SellerError } from "../sellers/errors";
import { ATTACHMENT_LIMITS } from "./model";
export const checksumOf = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
export function rasterType(bytes: Buffer) {
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (
    bytes.length >= 3 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    return "image/jpeg";
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  throw new SellerError("INVALID_INPUT");
}
export async function reencodeAttachment(
  bytes: Buffer,
  expected: { checksum: string; contentType: string; bytes: number },
) {
  if (
    !bytes.length ||
    bytes.length > ATTACHMENT_LIMITS.bytes ||
    bytes.length !== expected.bytes ||
    checksumOf(bytes) !== expected.checksum ||
    rasterType(bytes) !== expected.contentType
  )
    throw new SellerError("INVALID_INPUT");
  // Reject animation markers even on decoder builds that expose only a first frame.
  if (expected.contentType === "image/png") {
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const size = bytes.readUInt32BE(offset),
        kind = bytes.toString("ascii", offset + 4, offset + 8);
      if (kind === "acTL" || kind === "fcTL" || kind === "fdAT")
        throw new SellerError("INVALID_INPUT");
      if (size > bytes.length - offset - 12)
        throw new SellerError("INVALID_INPUT");
      offset += size + 12;
    }
  }
  if (expected.contentType === "image/webp") {
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const size = bytes.readUInt32LE(offset + 4),
        kind = bytes.toString("ascii", offset, offset + 4);
      if (
        kind === "ANIM" ||
        kind === "ANMF" ||
        (kind === "VP8X" && size >= 1 && bytes[offset + 8] & 2)
      )
        throw new SellerError("INVALID_INPUT");
      if (size > bytes.length - offset - 8)
        throw new SellerError("INVALID_INPUT");
      offset += size + 8 + (size % 2);
    }
  }
  try {
    const image = sharp(bytes, {
      limitInputPixels: ATTACHMENT_LIMITS.pixels,
      failOn: "error",
      sequentialRead: true,
    }).timeout({ seconds: 10 });
    const info = await image.metadata();
    if (
      !["jpeg", "png", "webp"].includes(info.format ?? "") ||
      !info.width ||
      !info.height ||
      info.width * info.height > ATTACHMENT_LIMITS.pixels ||
      (info.pages ?? 1) !== 1
    )
      throw Error();
    // Default sharp output strips EXIF, ICC, XMP and comments.
    const result = await image
      .rotate()
      .resize({
        width: ATTACHMENT_LIMITS.edge,
        height: ATTACHMENT_LIMITS.edge,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    if (result.data.length > ATTACHMENT_LIMITS.bytes) throw Error();
    return {
      bytes: result.data,
      checksum: checksumOf(result.data),
      width: result.info.width,
      height: result.info.height,
    };
  } catch {
    throw new SellerError("INVALID_INPUT");
  }
}
