import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { CATEGORY_REGISTRY_VERSION } from "@treido/contracts/categories";
import {
  discoverySearchParams,
  DISCOVERY_LIMITS,
  type DiscoveryInput,
} from "../../features/catalog/discovery-input";
import { validId } from "../../features/selling/draft-model";

export type DiscoveryPosition = Readonly<{
  id: string;
  createdAt: string;
  priceMinor?: number;
  rank?: number;
}>;
const fingerprint = (input: DiscoveryInput) =>
  createHash("sha256")
    .update(
      `discovery-v1:${CATEGORY_REGISTRY_VERSION}:${discoverySearchParams(input).toString()}`,
    )
    .digest("hex");
function signingKey(secret: Uint8Array) {
  if (
    !(secret instanceof Uint8Array) ||
    secret.byteLength < 32 ||
    secret.byteLength > 128
  )
    throw new Error("A qualified cursor key is required.");
  return secret;
}
function validPosition(
  value: unknown,
  input: DiscoveryInput,
): value is DiscoveryPosition {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  const keys = [
    "id",
    "createdAt",
    ...(input.sort.startsWith("price_")
      ? ["priceMinor"]
      : input.sort === "relevance"
        ? ["rank"]
        : []),
  ];
  if (
    Object.keys(item).length !== keys.length ||
    Object.keys(item).some((key) => !keys.includes(key)) ||
    !validId(item.id) ||
    typeof item.createdAt !== "string"
  )
    return false;
  const date = Date.parse(item.createdAt);
  if (!Number.isFinite(date) || new Date(date).toISOString() !== item.createdAt)
    return false;
  if (input.sort.startsWith("price_"))
    return (
      Number.isSafeInteger(item.priceMinor) &&
      (item.priceMinor as number) >= 0 &&
      (item.priceMinor as number) <= DISCOVERY_LIMITS.priceMinor
    );
  return (
    input.sort !== "relevance" ||
    (typeof item.rank === "number" &&
      Number.isFinite(item.rank) &&
      item.rank >= 0 &&
      item.rank <= 1_000_000)
  );
}
/** Signing protects bounded pagination data, never listing eligibility or authority. */
export function encodeDiscoveryCursor(
  input: DiscoveryInput,
  position: DiscoveryPosition,
  secret: Uint8Array,
  now = Date.now(),
) {
  signingKey(secret);
  if (!validPosition(position, input) || !Number.isSafeInteger(now) || now < 0)
    throw new Error("Invalid discovery position.");
  const payload = Buffer.from(
    JSON.stringify({
      v: 1,
      binding: fingerprint(input),
      issuedAt: now,
      position,
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}
export function decodeDiscoveryCursor(
  raw: unknown,
  input: DiscoveryInput,
  secret: Uint8Array,
  now = Date.now(),
): DiscoveryPosition | null {
  signingKey(secret);
  if (
    typeof raw !== "string" ||
    raw.length > DISCOVERY_LIMITS.cursor ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(raw) ||
    !Number.isSafeInteger(now) ||
    now < 0
  )
    return null;
  const [payload, supplied] = raw.split(".");
  const expected = createHmac("sha256", secret).update(payload).digest();
  const actual = Buffer.from(supplied, "base64url");
  if (
    actual.byteLength !== expected.byteLength ||
    actual.toString("base64url") !== supplied ||
    !timingSafeEqual(actual, expected)
  )
    return null;
  try {
    const bytes = Buffer.from(payload, "base64url");
    if (bytes.toString("base64url") !== payload) return null;
    const data = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    if (
      !data ||
      Object.keys(data).length !== 4 ||
      data.v !== 1 ||
      data.binding !== fingerprint(input) ||
      !Number.isSafeInteger(data.issuedAt) ||
      data.issuedAt > now + 60_000 ||
      data.issuedAt < now - 24 * 60 * 60 * 1000 ||
      !validPosition(data.position, input)
    )
      return null;
    return data.position;
  } catch {
    return null;
  }
}
