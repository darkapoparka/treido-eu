import { describe, expect, it, vi } from "vitest";
import { randomBytes, randomUUID, createHmac } from "node:crypto";
vi.mock("server-only", () => ({}));
import { encodeDiscoveryCursor, decodeDiscoveryCursor } from "./cursor.server";
import {
  readDiscoveryInput,
  discoverySearchParams,
} from "../../features/catalog/discovery-input";
const key = randomBytes(32),
  now = Date.parse("2026-10-01T12:00:00.000Z");
const base = readDiscoveryInput(
  "q=Pixel&category=cat:electronics/phones&seller=personal&condition=good&minPrice=10&location=София&lang=en&attr.storageGB=256",
).input;
const position = {
  id: randomUUID(),
  createdAt: "2026-10-01T11:00:00.000Z",
  rank: 0.5,
};
describe("bounded signed discovery cursors", () => {
  it("round trips a ranked stable tie-breaker through a canonical share URL", () => {
    const cursor = encodeDiscoveryCursor(base, position, key, now);
    const reopened = readDiscoveryInput(discoverySearchParams(base, cursor));
    expect(
      decodeDiscoveryCursor(reopened.cursor, reopened.input, key, now),
    ).toEqual(position);
    expect(cursor).not.toContain("Pixel");
    expect(cursor).not.toContain("София");
  });
  it.each(["newest", "price_asc", "price_desc"] as const)(
    "uses the exact %s position shape",
    (sort) => {
      const input = { ...base, sort };
      const anchor = {
        id: position.id,
        createdAt: position.createdAt,
        ...(sort.startsWith("price_") ? { priceMinor: 1999 } : {}),
      };
      expect(
        decodeDiscoveryCursor(
          encodeDiscoveryCursor(input, anchor, key, now),
          input,
          key,
          now,
        ),
      ).toEqual(anchor);
      expect(() => encodeDiscoveryCursor(input, position, key, now)).toThrow(
        "Invalid discovery position",
      );
    },
  );
  it("invalidates after every query/scope/condition/category/locale/price/location/attribute/sort change", () => {
    const cursor = encodeDiscoveryCursor(base, position, key, now);
    const changes = [
      { q: "iPhone" },
      { seller: "business" as const },
      { condition: "new" as const },
      { category: "cat:electronics/tablets" as const },
      { locale: "bg" as const },
      { minPriceMinor: 1001 },
      { maxPriceMinor: 2000 },
      { location: "Пловдив" },
      { attributes: { storageGB: 128 } },
      { sort: "newest" as const },
    ];
    for (const change of changes)
      expect(
        decodeDiscoveryCursor(cursor, { ...base, ...change }, key, now),
      ).toBeNull();
  });
  it("rejects tampering, wrong keys, malformed/oversized/base64 variants and expired/future cursors", () => {
    const cursor = encodeDiscoveryCursor(base, position, key, now);
    const [payload, signature] = cursor.split(".");
    for (const raw of [
      `${payload.slice(0, -1)}x.${signature}`,
      `${payload}.${signature.slice(0, -1)}x`,
      `${payload}=.${signature}`,
      "plain",
      "x".repeat(900),
      null,
    ])
      expect(decodeDiscoveryCursor(raw, base, key, now)).toBeNull();
    expect(
      decodeDiscoveryCursor(cursor, base, randomBytes(32), now),
    ).toBeNull();
    expect(
      decodeDiscoveryCursor(cursor, base, key, now + 24 * 60 * 60 * 1000 + 1),
    ).toBeNull();
    expect(
      decodeDiscoveryCursor(
        encodeDiscoveryCursor(base, position, key, now + 60001),
        base,
        key,
        now,
      ),
    ).toBeNull();
  });
  it("cannot grant seller authority or add unbounded/unknown position fields even with a valid signature", () => {
    const cursor = encodeDiscoveryCursor(base, position, key, now);
    const data = JSON.parse(
      Buffer.from(cursor.split(".")[0], "base64url").toString(),
    );
    for (const invalid of [
      { ...data, role: "owner" },
      { ...data, position: { ...position, sellerId: randomUUID() } },
      { ...data, position: { ...position, rank: Infinity } },
      { ...data, position: { ...position, id: "invalid" } },
      {
        ...data,
        position: { ...position, createdAt: "2026-02-30T11:00:00.000Z" },
      },
    ]) {
      const payload = Buffer.from(JSON.stringify(invalid)).toString(
        "base64url",
      );
      const signed = `${payload}.${createHmac("sha256", key).update(payload).digest("base64url")}`;
      expect(decodeDiscoveryCursor(signed, base, key, now)).toBeNull();
    }
  });
  it("requires a configured signing key, never substituting an unsigned cursor", () => {
    expect(() =>
      encodeDiscoveryCursor(base, position, new Uint8Array(0), now),
    ).toThrow("qualified cursor key");
    expect(() =>
      decodeDiscoveryCursor("anything", base, new Uint8Array(1), now),
    ).toThrow("qualified cursor key");
  });
});
