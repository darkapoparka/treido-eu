import { clerkMiddleware } from "@clerk/nextjs/server";
import {
  NextResponse,
  type NextRequest,
  type NextFetchEvent,
} from "next/server";
import { validateBackendBindings } from "./server/config/backend-bindings";
import {
  detectLocation,
  localeCookie,
  localeHeader,
  localeSourceHeader,
  resolveLocale,
} from "./features/locale/locale";

function requestHeaders(request: NextRequest) {
  const headers = new Headers(request.headers);
  const preference = resolveLocale({
    explicit: request.nextUrl.searchParams.get("lang"),
    saved: request.cookies.get(localeCookie)?.value,
    acceptLanguage: headers.get("accept-language"),
    country: detectLocation(headers, process.env.VERCEL === "1")?.country,
  });
  // Overwrite caller-supplied hints. Locale has no authentication authority.
  headers.set(localeHeader, preference.locale);
  headers.set(localeSourceHeader, preference.source);
  return headers;
}

const authenticate = clerkMiddleware(
  async (_auth, request) => {
    const headers = requestHeaders(request);
    headers.set(
      "x-treido-entry",
      request.nextUrl.pathname + request.nextUrl.search,
    );
    return NextResponse.next({ request: { headers } });
  },
  { signInUrl: "/sign-in", signUpUrl: "/sign-up" },
);

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  const privateEntry =
    /^\/(app|ops|messages|sign-in|sign-up)(\/|$)/.test(
      request.nextUrl.pathname,
    ) || request.nextUrl.pathname === "/sell";
  if (!privateEntry || !validateBackendBindings(process.env).ok)
    return NextResponse.next({ request: { headers: requestHeaders(request) } });
  return authenticate(request, event);
}
export const config = {
  matcher: ["/((?!api|_next|favicon.ico|robots.txt|sitemap.xml|fonts/).*)"],
};
