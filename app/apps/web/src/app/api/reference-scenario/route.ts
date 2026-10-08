import { NextResponse } from "next/server";
import { referencePreviewEnabled } from "../../../features/catalog/queries.server";
import { referenceScenarioCookie } from "../../../features/catalog/reference/scenarios";

function loopback(host: string) {
  return ["localhost", "127.0.0.1", "[::1]"].includes(host);
}

/** Local QA transport only. Selects real data for the same buyer view owners. */
export async function GET(request: Request) {
  if (!referencePreviewEnabled()) return new Response(null, { status: 404 });
  const url = new URL(request.url);
  if (url.protocol !== "http:" || !loopback(url.hostname))
    return new Response(null, { status: 404 });
  for (const key of ["host", "x-forwarded-host"]) {
    const value = request.headers.get(key);
    if (value) {
      try {
        if (!loopback(new URL(`http://${value}`).hostname))
          return new Response(null, { status: 404 });
      } catch {
        return new Response(null, { status: 404 });
      }
    }
  }
  const query = url.searchParams;
  if (
    [...query.keys()].some(
      (key) => !["action", "target", "lang"].includes(key),
    ) ||
    ["action", "target", "lang"].some((key) => query.getAll(key).length > 1)
  )
    return new Response(null, { status: 404 });
  const action = query.get("action"),
    target = query.get("target") ?? "home",
    lang = query.get("lang") ?? "bg";
  if (
    !["public-data", "reset"].includes(action ?? "") ||
    !["home", "explore"].includes(target) ||
    !["bg", "en"].includes(lang)
  )
    return new Response(null, { status: 404 });
  // Next may normalize request.url to localhost even for a 127.0.0.1 caller.
  // Preserve the already validated incoming Host so its QA cookie survives.
  const origin = request.headers.get("host")
    ? new URL(`http://${request.headers.get("host")}`).origin
    : url.origin;
  const destination = new URL(target === "home" ? "/" : "/explore", origin);
  destination.searchParams.set("lang", lang);
  const response = NextResponse.redirect(destination, 303);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Robots-Tag", "noindex");
  response.cookies.set(
    referenceScenarioCookie,
    action === "reset" ? "" : "public-data",
    {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: action === "reset" ? 0 : 3600,
    },
  );
  return response;
}
