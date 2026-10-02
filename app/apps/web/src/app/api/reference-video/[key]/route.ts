import { referencePreviewEnabled } from "@/features/catalog/queries.server";
import { referenceVideoResponse } from "@/features/catalog/reference/video-response";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  if (!referencePreviewEnabled()) return new Response(null, { status: 404 });
  // Runtime denial alone does not remove private archive paths from the build graph.
  const readers =
    process.env.NODE_ENV === "production"
      ? undefined
      : await Promise.all([
          import("@/features/catalog/reference/video.server"),
          import("@/features/catalog/reference/live-explore-video.server"),
          import("@/features/catalog/reference/merchant-media.server"),
        ]);
  if (!readers) return new Response(null, { status: 404 });
  const [
    { readReferenceVideo },
    { readLiveExploreVideo },
    { readMerchantVideo },
  ] = readers;
  const { key } = await params;
  const live = readLiveExploreVideo(key);
  const merchant = readMerchantVideo(key);
  const pending = merchant ?? live ?? readReferenceVideo(key);
  if (!pending) return new Response(null, { status: 404 });
  try {
    const response = referenceVideoResponse(await pending, request);
    if (merchant) response.headers.set("Content-Type", "video/mp4");
    else if (live) response.headers.set("Content-Type", "video/webm");
    return response;
  } catch {
    return new Response("Reference video is unavailable in this checkout.", {
      status: 503,
    });
  }
}

export const HEAD = GET;
