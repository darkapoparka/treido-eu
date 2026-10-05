import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { publicDiscoveryKey } from "../catalog/public-discovery.server";
import { validId } from "../selling/draft-model";
import { SellerError } from "../sellers/errors";
import { object } from "../purchase-reviews/model";
import type { NotificationQuery } from "./model";
export type NotificationPosition = { at: string; id: string; ceiling: string };
const stamp = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value) &&
  Number.isFinite(Date.parse(value));
function signature(body: string, actorKey: string, query: NotificationQuery) {
  return createHmac("sha256", publicDiscoveryKey())
    .update(
      JSON.stringify([
        "notification-page-v1",
        actorKey,
        query.sellerId,
        query.filter,
        query.kind,
        query.q,
        body,
      ]),
    )
    .digest();
}
export function encodeNotificationCursor(
  position: NotificationPosition,
  actorKey: string,
  query: NotificationQuery,
) {
  const body = Buffer.from(JSON.stringify(position)).toString("base64url");
  return body + "." + signature(body, actorKey, query).toString("base64url");
}
export function decodeNotificationCursor(
  actorKey: string,
  query: NotificationQuery,
): NotificationPosition | null {
  if (!query.before) return null;
  try {
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(query.before))
      throw Error();
    const [body, mac] = query.before.split("."),
      expected = signature(body, actorKey, query),
      received = Buffer.from(mac, "base64url");
    if (
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    )
      throw Error();
    const value: unknown = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    );
    if (
      !object(value) ||
      !validId(value.id) ||
      !stamp(value.at) ||
      !stamp(value.ceiling) ||
      value.at > value.ceiling
    )
      throw Error();
    return { id: value.id, at: value.at, ceiling: value.ceiling };
  } catch {
    throw new SellerError("INVALID_INPUT");
  }
}
