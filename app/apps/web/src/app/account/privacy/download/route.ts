import { getDatabase } from "../../../../server/db/database";
import { requireVerifiedIdentity } from "../../../../server/identity/clerk.server";
import { backendConfigured } from "../../../../features/sellers/backend-status.server";
import { readBuyerReferenceMode } from "../../../../features/catalog/buyer-data-mode.server";
import { SellerError } from "../../../../features/sellers/errors";
import {
  parseDownloadQuery,
  PrivacyError,
} from "../../../../features/account-privacy/model";
import { readPrivateDownload } from "../../../../features/account-privacy/queries.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; sandbox",
  "Referrer-Policy": "no-referrer",
};
export async function GET(request: Request) {
  try {
    if ((await readBuyerReferenceMode()) || !backendConfigured())
      throw new PrivacyError("NOT_AVAILABLE");
    const input = parseDownloadQuery(new URL(request.url).searchParams),
      identity = await requireVerifiedIdentity();
    const body = await readPrivateDownload(
      getDatabase(),
      identity,
      input.id,
      input.actorKey,
    );
    return new Response(body, {
      headers: {
        ...headers,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="treido-personal-data.json"',
      },
    });
  } catch (error) {
    const code =
      error instanceof PrivacyError || error instanceof SellerError
        ? error.code
        : "NOT_AVAILABLE";
    const status =
      code === "UNAUTHENTICATED"
        ? 401
        : ["FORBIDDEN", "RECENT_AUTH_REQUIRED"].includes(code)
          ? 403
          : code === "NOT_FOUND"
            ? 404
            : code === "EXPIRED"
              ? 410
              : code === "INVALID_INPUT"
                ? 400
                : 503;
    return Response.json({ ok: false, code }, { status, headers });
  }
}
