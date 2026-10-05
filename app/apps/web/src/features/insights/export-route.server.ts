import "server-only";
import { readVerifiedIdentity } from "../../server/identity/clerk.server";
import { getDatabase } from "../../server/db/database";
import { backendConfigured } from "../sellers/backend-status.server";
import { SellerError } from "../sellers/errors";
import { InsightError, type InsightScope } from "./model";
import { readInsights } from "./queries.server";
import { insightFilename, insightsCsv } from "./csv.server";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
};
function failure(code: string, status: number) {
  return Response.json(
    { ok: false, code },
    { status, headers: privateHeaders },
  );
}
/** Explicit user-triggered same-origin download, never prefetched and never
 * built from client-supplied rows, a cached dashboard or a stored entitlement. */
export async function exportInsights(
  request: Request,
  scope: InsightScope,
): Promise<Response> {
  try {
    const site = request.headers.get("sec-fetch-site");
    if (site && !["same-origin", "none"].includes(site))
      return failure("FORBIDDEN", 403);
    const url = new URL(request.url),
      origin = request.headers.get("origin");
    if (origin && origin !== url.origin) return failure("FORBIDDEN", 403);
    if (url.search.length > 2000) return failure("INVALID_INPUT", 400);
    if (!backendConfigured()) return failure("NOT_AVAILABLE", 503);
    const identity = await readVerifiedIdentity();
    if (!identity) return failure("UNAUTHENTICATED", 401);
    const seen = new Set<string>();
    for (const [key] of url.searchParams) {
      if (seen.has(key)) return failure("INVALID_INPUT", 400);
      seen.add(key);
    }
    const raw = Object.fromEntries(url.searchParams);
    const actor = raw.actor;
    delete raw.actor;
    if (!actor || !/^[a-f0-9]{64}$/.test(actor))
      return failure("FORBIDDEN", 403);
    const view = await readInsights(getDatabase(), identity, scope, raw, actor);
    if (!view.report)
      return failure(
        view.problem ?? "NOT_AVAILABLE",
        view.problem === "INVALID_INPUT"
          ? 400
          : view.problem === "EXPORT_TOO_LARGE" ||
              view.problem === "SCOPE_TOO_LARGE"
            ? 413
            : 503,
      );
    const language = raw.lang === "bg" ? "bg" : "en",
      body = insightsCsv(view.report, language);
    return new Response(body, {
      status: 200,
      headers: {
        ...privateHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="' +
          insightFilename(view.report, language) +
          '"',
      },
    });
  } catch (error) {
    if (error instanceof InsightError)
      return failure(
        error.code,
        error.code === "EXPORT_TOO_LARGE"
          ? 413
          : error.code === "INVALID_INPUT"
            ? 400
            : 503,
      );
    if (error instanceof SellerError) {
      if (error.code === "INVALID_INPUT") return failure("INVALID_INPUT", 400);
      if (["FORBIDDEN", "NOT_FOUND"].includes(error.code))
        return failure("FORBIDDEN", 403);
    }
    // No database/provider messages or private record contents in HTTP failures.
    return failure("NOT_AVAILABLE", 503);
  }
}
