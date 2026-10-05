import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { publicDiscoveryKey } from "../catalog/public-discovery.server";
import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { object } from "../purchase-reviews/model";
import type { OwnCaseQuery } from "./own-case-query";
export type OwnCasePosition = { id: string; at: string; ceiling: string };
export type OwnCaseTopic = "reports" | "appeals";
const stamp = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value) &&
  Number.isFinite(Date.parse(value));
function signature(
  body: string,
  actorKey: string,
  topic: OwnCaseTopic,
  query: OwnCaseQuery,
) {
  return createHmac("sha256", publicDiscoveryKey())
    .update(
      JSON.stringify([
        "own-trust-case-v1",
        actorKey,
        topic,
        query.state,
        query.kind,
        query.q,
        body,
      ]),
    )
    .digest();
}
export function encodeOwnCaseCursor(
  position: OwnCasePosition,
  actorKey: string,
  topic: OwnCaseTopic,
  query: OwnCaseQuery,
) {
  const body = Buffer.from(JSON.stringify(position)).toString("base64url");
  return (
    body + "." + signature(body, actorKey, topic, query).toString("base64url")
  );
}
export function decodeOwnCaseCursor(
  actorKey: string,
  topic: OwnCaseTopic,
  query: OwnCaseQuery,
): OwnCasePosition | null {
  if (!query.before) return null;
  try {
    const [body, mac] = query.before.split("."),
      expected = signature(body, actorKey, topic, query),
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
