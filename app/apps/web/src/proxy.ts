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

function isPrivacyEntry(pathname: string) {
  return /^\/account\/privacy(?:\/(?:data|download|preferences|security|closure|promotions))?$/.test(
    pathname,
  );
}

function isSessionApi(pathname: string) {
  return /^\/api\/(?:seller-media|message-attachments|assistants\/(?:runs|media))(?:\/|$)/.test(
    pathname,
  );
}

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
    const response = NextResponse.next({ request: { headers } });
    if (isPrivacyEntry(request.nextUrl.pathname)) {
      response.headers.set("Cache-Control", "private, no-store");
      response.headers.append("Vary", "Cookie");
    }
    return response;
  },
  { signInUrl: "/sign-in", signUpUrl: "/sign-up" },
);

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  const privateEntry =
    /^\/(app|ops|messages|sign-in|sign-up)(\/|$)/.test(
      request.nextUrl.pathname,
    ) || request.nextUrl.pathname === "/sell";
  const reference =
    process.env.SHOP_REFERENCE_PREVIEW === "1" &&
    !process.env.VERCEL &&
    process.env.VERCEL_ENV !== "production" &&
    process.env.NODE_ENV !== "production";
  const buyerEntry =
    !reference &&
    (request.nextUrl.pathname === "/" ||
      /^\/(products|stores|search|saved|following|cart|notifications|minis)(\/|$)/.test(
        request.nextUrl.pathname,
      ));
  const contactEntry =
    !reference &&
    (request.nextUrl.pathname === "/checkout" ||
      /^\/(?:checkout\/reviews|reservations)(\/|$)/.test(
        request.nextUrl.pathname,
      ));
  const paymentEntry = /^\/(?:checkout\/payments|orders)(\/|$)/.test(
    request.nextUrl.pathname,
  );
  const privacyEntry = !reference && isPrivacyEntry(request.nextUrl.pathname);
  const sessionApi = !reference && isSessionApi(request.nextUrl.pathname);
  if (
    !(
      privateEntry ||
      buyerEntry ||
      contactEntry ||
      paymentEntry ||
      privacyEntry ||
      sessionApi
    ) ||
    !validateBackendBindings(process.env).ok
  ) {
    const response = NextResponse.next({
      request: { headers: requestHeaders(request) },
    });
    if (privacyEntry) {
      response.headers.set("Cache-Control", "private, no-store");
      response.headers.append("Vary", "Cookie");
    }
    return response;
  }
  return authenticate(request, event);
}
export const config = {
  matcher: [
    "/((?!api|_next|favicon.ico|robots.txt|sitemap.xml|fonts/).*)",
    "/api/seller-media/:path*",
    "/api/message-attachments/:path*",
    "/api/assistants/runs",
    "/api/assistants/media/:path*",
  ],
};
