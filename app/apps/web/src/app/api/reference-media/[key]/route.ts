import { referencePreviewEnabled } from "@/features/catalog/queries.server";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  if (!referencePreviewEnabled()) return new Response(null, { status: 404 });
  const { key } = await params;
  // Compile-time separation keeps private reference archives out of production.
  const readers =
    process.env.NODE_ENV === "production"
      ? undefined
      : await Promise.all([
          import("@/features/catalog/reference/media.server"),
          import("@/features/catalog/reference/following-media.server"),
          import("@/features/catalog/reference/saved-media.server"),
          import("@/features/catalog/reference/store-media.server"),
          import("@/features/catalog/reference/sol-media.server"),
          import("@/features/catalog/reference/order-media.server"),
          import("@/features/catalog/reference/search-media.server"),
          import("@/features/catalog/reference/live-onboarding-media.server"),
          import("@/features/catalog/reference/live-shop-media.server"),
          import("@/features/catalog/reference/live-explore-media.server"),
          import("@/features/catalog/reference/merchant-media.server"),
        ]);
  if (!readers) return new Response(null, { status: 404 });
  const [
    { readReferenceMedia },
    { readFollowingMedia },
    { readSavedMedia },
    { readStoreMedia },
    { readSolMedia },
    { readOrderMedia },
    { readSearchMedia },
    { readLiveOnboardingMedia },
    { readLiveShopMedia },
    { readLiveExploreMedia },
    { readMerchantMedia },
  ] = readers;
  const media =
    readMerchantMedia(key) ??
    readLiveExploreMedia(key) ??
    readLiveShopMedia(key) ??
    readLiveOnboardingMedia(key) ??
    readOrderMedia(key) ??
    readSolMedia(key) ??
    readStoreMedia(key) ??
    readSavedMedia(key) ??
    readFollowingMedia(key) ??
    readSearchMedia(key) ??
    readReferenceMedia(key);
  if (!media) return new Response(null, { status: 404 });
  try {
    return new Response(new Uint8Array(await media), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-cache",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch {
    return new Response("Reference media is unavailable in this checkout.", {
      status: 503,
    });
  }
}
