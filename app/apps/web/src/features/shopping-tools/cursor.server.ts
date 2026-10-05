import "server-only";
import { CATEGORY_REGISTRY_VERSION } from "@treido/contracts/categories";
import { createHmac, timingSafeEqual } from "node:crypto";
import { publicDiscoveryKey } from "../catalog/public-discovery.server";
import { validId } from "../selling/draft-model";
import { onlyKeys, whole } from "../inventory/model";
import { SellerError } from "../sellers/errors";
import { toolParams, type ToolIntent } from "./intent";
export type ToolPosition = {
  id: string;
  at: string;
  price: number;
  rank: number;
};
function signature(body: string, input: ToolIntent) {
  return createHmac("sha256", publicDiscoveryKey())
    .update(
      "shopping-tools-page-v2:" +
        CATEGORY_REGISTRY_VERSION +
        ":" +
        toolParams(input) +
        ":" +
        body,
    )
    .digest();
}
export function encodeToolCursor(position: ToolPosition, input: ToolIntent) {
  const body = Buffer.from(
    JSON.stringify({ ...position, issuedAt: Date.now() }),
  ).toString("base64url");
  return body + "." + signature(body, input).toString("base64url");
}
export function decodeToolCursor(input: ToolIntent): ToolPosition | null {
  if (!input.cursor) return null;
  try {
    const [body, mac, ...rest] = input.cursor.split(".");
    const received = Buffer.from(mac ?? "", "base64url"),
      expected = signature(body, input);
    if (
      rest.length ||
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    )
      throw Error();
    const p: unknown = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    );
    if (
      !onlyKeys(p, ["id", "at", "price", "rank", "issuedAt"]) ||
      !validId(p.id) ||
      typeof p.at !== "string" ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/.test(p.at) ||
      !Number.isFinite(Date.parse(p.at)) ||
      !whole(p.price, 0, 1000000000) ||
      !whole(p.rank, 0, 1000) ||
      !whole(p.issuedAt, 0, Number.MAX_SAFE_INTEGER) ||
      Date.now() - p.issuedAt > 24 * 60 * 60 * 1000 ||
      p.issuedAt > Date.now() + 30000
    )
      throw Error();
    return { id: p.id, at: p.at, price: p.price, rank: p.rank };
  } catch {
    throw new SellerError("INVALID_INPUT");
  }
}
