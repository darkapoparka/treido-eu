const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
const loopbackPeers = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

function isLoopbackAuthority(authority: string | null): boolean {
  if (!authority) return false;
  try {
    const url = new URL(`http://${authority}`);
    return (
      loopbackHosts.has(url.hostname) &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

// Local verification can add latency to the existing catalog read so its real
// Suspense fallback can be inspected. It never changes catalog data or UI.
// The caller must pass the actual server-owned reference-preview opt-in.
export function referenceCatalogDelay(
  requestHeaders: Pick<Headers, "get">,
  previewEnabled: boolean,
): number {
  if (!previewEnabled) return 0;
  const raw = requestHeaders.get("x-shop-reference-catalog-delay-ms");
  if (!raw || !/^[1-9]\d{0,4}$/.test(raw)) return 0;
  const ms = Number(raw);
  if (ms > 10_000) return 0;
  if (!isLoopbackAuthority(requestHeaders.get("host"))) return 0;
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  if (forwardedHost && !isLoopbackAuthority(forwardedHost)) return 0;
  const peers = requestHeaders.get("x-forwarded-for")?.split(",");
  if (!peers?.length || peers.some((peer) => !loopbackPeers.has(peer.trim())))
    return 0;
  return ms;
}
