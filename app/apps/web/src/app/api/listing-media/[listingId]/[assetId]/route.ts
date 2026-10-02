import { validId } from "@/features/selling/draft-model";
import { getDatabase } from "@/server/db/database";
import { requireMediaStorage } from "@/server/media/storage.server";
import { readPublishedPhoto } from "@/features/catalog/published.server";
import { SellerError } from "@/features/sellers/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ listingId: string; assetId: string }> },
) {
  try {
    const { listingId, assetId } = await params;
    if (!validId(listingId) || !validId(assetId))
      throw new SellerError("NOT_FOUND");
    const revision = new URL(request.url).searchParams.get("v");
    if (!revision || !/^\d{1,10}$/.test(revision))
      throw new SellerError("NOT_FOUND");
    const bytes = await readPublishedPhoto(
      getDatabase(),
      requireMediaStorage(),
      listingId,
      assetId,
      Number(revision),
    );
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": "image/webp",
        "content-length": String(bytes.byteLength),
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    const denied =
      error instanceof SellerError &&
      ["NOT_FOUND", "INVALID_INPUT", "FORBIDDEN"].includes(error.code);
    return Response.json(
      { code: denied ? "NOT_FOUND" : "NOT_AVAILABLE" },
      {
        status: denied ? 404 : 503,
        headers: { "cache-control": "private, no-store" },
      },
    );
  }
}
