import { referencePreviewEnabled } from "@/features/catalog/queries.server";
import { readReferenceVideo } from "@/features/catalog/reference/video.server";
import { readLiveExploreVideo } from "@/features/catalog/reference/live-explore-video.server";
import { referenceVideoResponse } from "@/features/catalog/reference/video-response";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  if (!referencePreviewEnabled()) return new Response(null, { status: 404 });
  const { key } = await params;
  const live = readLiveExploreVideo(key);
  const pending = live ?? readReferenceVideo(key);
  if (!pending) return new Response(null, { status: 404 });
  try {
    const response = referenceVideoResponse(await pending, request);
    if (live) response.headers.set("Content-Type", "video/webm");
    return response;
  } catch {
    return new Response("Reference video is unavailable in this checkout.", {
      status: 503,
    });
  }
}

export const HEAD = GET;
