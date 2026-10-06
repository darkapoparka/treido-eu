/** Draft text is never a published policy, regardless of query or env flags. */
export function legalReviewAllowed(
  review: unknown,
  host: string | null,
  env: Readonly<Record<string, string | undefined>>,
) {
  if (
    review !== "1" ||
    env.NODE_ENV !== "development" ||
    env.TREIDO_ENV !== "development" ||
    env.VERCEL ||
    env.VERCEL_ENV ||
    env.CI ||
    (env.SHOP_REFERENCE_PREVIEW && env.SHOP_REFERENCE_PREVIEW !== "0")
  )
    return false;
  try {
    const origin = new URL(env.TREIDO_APP_ORIGIN ?? "");
    return (
      origin.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname) &&
      origin.origin === env.TREIDO_APP_ORIGIN &&
      !!origin.port &&
      origin.host === host
    );
  } catch {
    return false;
  }
}
