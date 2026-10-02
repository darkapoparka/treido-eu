import "server-only";
import { timingSafeEqual } from "node:crypto";

export function authorizedService(
  request: Request,
  secret: string | undefined,
) {
  if (!secret || secret.length < 32 || request.url.includes("?")) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}
export function jobResponse(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "cache-control": "private, no-store" },
  });
}
export async function boundedJson(
  request: Request,
  maximum = 2048,
): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new Error("Invalid content type.");
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > maximum))
    throw new Error("Invalid length.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body.");
  let count = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      count += value.byteLength;
      if (count > maximum) {
        await reader.cancel();
        throw new Error("Body too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
