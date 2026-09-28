// Single byte ranges are sufficient for native HTML video seeking. Reject
// ambiguous/multipart ranges instead of allocating attacker-selected buffers.
export function referenceVideoResponse(bytes: Uint8Array, request: Request) {
  const size = bytes.byteLength;
  const headers = new Headers({
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-cache",
    "X-Robots-Tag": "noindex",
  });
  const range = request.headers.get("range");
  let start = 0;
  let end = size - 1;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    const invalid = () =>
      new Response(null, {
        status: 416,
        headers: {
          ...Object.fromEntries(headers),
          "Content-Range": `bytes */${size}`,
        },
      });
    if (!match || (!match[1] && !match[2])) return invalid();
    if (match[1]) {
      start = Number(match[1]);
      end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    } else {
      const suffix = Number(match[2]);
      if (!Number.isSafeInteger(suffix) || suffix <= 0) return invalid();
      start = Math.max(0, size - suffix);
    }
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start > end ||
      start >= size
    )
      return invalid();
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  }
  headers.set("Content-Length", String(end - start + 1));
  return new Response(
    request.method === "HEAD"
      ? null
      : new Uint8Array(bytes.subarray(start, end + 1)),
    { status: range ? 206 : 200, headers },
  );
}
