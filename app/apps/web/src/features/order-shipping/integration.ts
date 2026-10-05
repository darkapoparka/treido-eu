import type { ReviewSource } from "../purchase-reviews/model";
import { validId } from "../selling/draft-model";
import { parseSource, type Language } from "./model";
export function shippingStartHref(source: ReviewSource, language: Language) {
  const parsed = parseSource(source, language),
    params = new URLSearchParams({
      lang: parsed.language,
      source: parsed.source.kind,
    });
  if (parsed.source.kind === "cart") {
    params.set("sellerId", parsed.source.sellerId);
    params.set("cartRevision", String(parsed.source.cartRevision));
  } else {
    params.set("threadId", parsed.source.threadId);
    params.set("offerId", parsed.source.offerId);
  }
  return "/checkout/payments/shipping?" + params.toString();
}
export function shippingReviewHref(id: string, language: Language) {
  if (!validId(id) || (language !== "bg" && language !== "en"))
    throw new Error("Invalid shipping continuation.");
  return "/checkout/payments/shipping/" + id + "?lang=" + language;
}
export function parseShippingStart(
  params: URLSearchParams,
): { source: ReviewSource; language: Language } | null {
  try {
    const kind = params.get("source"),
      language = params.get("lang");
    const keys =
      kind === "cart"
        ? ["source", "lang", "sellerId", "cartRevision"]
        : ["source", "lang", "threadId", "offerId"];
    if (
      [...params.keys()].some(
        (key) => !keys.includes(key) || params.getAll(key).length !== 1,
      ) ||
      keys.some((key) => !params.has(key))
    )
      return null;
    if (kind === "cart") {
      const revision = params.get("cartRevision");
      if (!revision || !/^[1-9][0-9]{0,9}$/.test(revision)) return null;
      return parseSource(
        {
          kind,
          sellerId: params.get("sellerId"),
          cartRevision: Number(revision),
        },
        language,
      );
    }
    if (kind !== "offer") return null;
    return parseSource(
      {
        kind,
        threadId: params.get("threadId"),
        offerId: params.get("offerId"),
      },
      language,
    );
  } catch {
    return null;
  }
}
/** Pure allowlist for root's existing sign-in continuation. No consent/write authority. */
export function parseShippingContinuation(raw: unknown): string | null {
  if (
    typeof raw !== "string" ||
    raw.length > 800 ||
    !raw.startsWith("/checkout/payments/shipping") ||
    /[\u0000-\u0020\u007f]/.test(raw) ||
    raw.includes("\\") ||
    raw.includes("%") ||
    raw.includes("#")
  )
    return null;
  const url = new URL(raw, "https://treido.invalid");
  if (url.origin !== "https://treido.invalid") return null;
  if (raw.split("?")[0] !== url.pathname) return null;
  if (url.pathname === "/checkout/payments/shipping") {
    const input = parseShippingStart(url.searchParams);
    return input ? shippingStartHref(input.source, input.language) : null;
  }
  const match = /^\/checkout\/payments\/shipping\/([^/]+)$/.exec(url.pathname),
    params = url.searchParams;
  if (
    !match ||
    !validId(match[1]) ||
    [...params.keys()].some((key) => key !== "lang") ||
    params.getAll("lang").length !== 1 ||
    !["bg", "en"].includes(params.get("lang") ?? "")
  )
    return null;
  return shippingReviewHref(match[1], params.get("lang") as Language);
}
