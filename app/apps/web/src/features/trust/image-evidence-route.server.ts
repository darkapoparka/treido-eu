import "server-only";
import { getDatabase } from "../../server/db/database";
import { readVerifiedIdentity } from "../../server/identity/clerk.server";
import { SellerError } from "../sellers/errors";
import { deliverReportImage } from "./image-evidence.server";
export const evidenceHeaders = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "Vary": "Cookie, Authorization",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
export async function reportImageGET(request: Request, {params}: {params: Promise<{reportId: string; attachmentId: string}>}) {
  try {
    if (request.headers.get("sec-fetch-site") === "cross-site") return new Response(null,{status:404,headers:evidenceHeaders});
    const identity = await readVerifiedIdentity();
    if (!identity) return new Response(null,{status:404,headers:evidenceHeaders});
    const {reportId, attachmentId} = await params;
    const bytes = await deliverReportImage(getDatabase(), identity, reportId, attachmentId);
    return new Response(new Uint8Array(bytes),{headers:{...evidenceHeaders,"Content-Type":"image/webp","Content-Length":String(bytes.length),"Content-Disposition":"inline"}});
  } catch (error) {
    const denied = error instanceof SellerError && ["INVALID_INPUT","UNAUTHENTICATED","FORBIDDEN","NOT_FOUND"].includes(error.code);
    if (!denied) console.error("Treido private report evidence unavailable.");
    return new Response(null,{status:denied?404:503,headers:evidenceHeaders});
  }
}
