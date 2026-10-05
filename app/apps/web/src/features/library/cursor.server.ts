import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { publicDiscoveryKey } from "../catalog/public-discovery.server";
import { validId } from "../selling/draft-model";
import { SellerError } from "../sellers/errors";
import type { LibraryQuery } from "./model";
export function libraryActorKey(identity: VerifiedIdentity): string {
  return createHmac("sha256", publicDiscoveryKey())
    .update("buyer-library-actor-v1:" + identity.subject)
    .digest("hex");
}
export type LibraryPosition = { id: string; at: string };
function signature(value: string, actorKey: string, query: LibraryQuery) {
  return createHmac("sha256", publicDiscoveryKey())
    .update(
      "buyer-library-page-v1:" +
        actorKey +
        ":" +
        query.view +
        ":" +
        (query.collectionId ?? "all") +
        ":" +
        value,
    )
    .digest();
}
export function encodeLibraryCursor(
  position: LibraryPosition,
  actorKey: string,
  query: LibraryQuery,
): string {
  const value = Buffer.from(JSON.stringify(position)).toString("base64url");
  return value + "." + signature(value, actorKey, query).toString("base64url");
}
export function decodeLibraryCursor(
  value: string | null,
  actorKey: string,
  query: LibraryQuery,
): LibraryPosition | null {
  if (!value) return null;
  try {
    if (
      value.length > 1024 ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(value)
    )
      throw new Error();
    const [body, mac] = value.split(".");
    const expected = signature(body, actorKey, query),
      received = Buffer.from(mac, "base64url");
    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    )
      throw new Error();
    const result = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as LibraryPosition;
    if (
      !result ||
      !validId(result.id) ||
      typeof result.at !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(result.at) ||
      !Number.isFinite(Date.parse(result.at))
    )
      throw new Error();
    return result;
  } catch {
    throw new SellerError("INVALID_INPUT");
  }
}
