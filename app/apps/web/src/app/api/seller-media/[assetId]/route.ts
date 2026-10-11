import { getDatabase } from "../../../../server/db/database";
import { requireVerifiedIdentity } from "../../../../server/identity/clerk.server";
import { requireMediaStorage } from "../../../../server/media/storage.server";
import { assertMediaStorageScope } from "../../../../server/media/retention.server";
import { readOwnedProductMedia as readOwnedMedia } from "../../../../features/selling/product-media-read.server";
import { SellerError } from "../../../../features/sellers/errors";
import { MEDIA_LIMITS } from "../../../../features/selling/media-model";
import { createHash } from "node:crypto";

export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ assetId: string }> },
) {
  try {
    const identity = await requireVerifiedIdentity();
    const { assetId } = await context.params;
    const sellerId = new URL(request.url).searchParams.get("sellerId") ?? "";
    const database = getDatabase();
    const media = await readOwnedMedia(database, identity, sellerId, assetId);
    const storage = requireMediaStorage();
    assertMediaStorageScope(media.storageScope, storage);
    const bytes = await storage.read(media.key, MEDIA_LIMITS.bytes);
    if (createHash("sha256").update(bytes).digest("hex") !== media.checksum)
      throw new SellerError("NOT_AVAILABLE");
    // Recheck eligibility after storage I/O; removed/foreign/revoked reads have no response bytes.
    await readOwnedMedia(database, identity, sellerId, assetId);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": "image/webp",
        "content-length": String(bytes.length),
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    const denied =
      error instanceof SellerError &&
      ["FORBIDDEN", "NOT_FOUND", "INVALID_INPUT", "UNAUTHENTICATED"].includes(
        error.code,
      );
    return Response.json(
      { code: denied ? "NOT_FOUND" : "NOT_AVAILABLE" },
      {
        status: denied ? 404 : 503,
        headers: { "cache-control": "private, no-store" },
      },
    );
  }
}
