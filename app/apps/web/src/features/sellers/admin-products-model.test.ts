import { expect, it } from "vitest";
import { parseProductQuery, productHref } from "./admin-products-model";

it("rejects ambiguous or unbounded product filters", () => {
  for (const value of [
    { q: ["one", "two"] },
    { status: ["all"] },
    { status: "active" },
    { sort: "random" },
    { cursor: "../../../secret" },
    { q: "x".repeat(161) },
    { q: "bad\nquery" },
    { sellerId: "other" },
    { lang: ["bg", "en"] },
  ])
    expect(parseProductQuery(value)).toBeNull();
  expect(
    parseProductQuery({
      q: "  100%_ Телефон  ",
      status: "restricted",
      lang: "bg",
    }),
  ).toEqual({
    q: "100%_ Телефон",
    status: "restricted",
    sort: "newest",
    cursor: null,
  });
});
it("resets pagination when changing filters and encodes literal query text", () => {
  const query = {
    q: "100%_ телефон",
    status: "draft" as const,
    sort: "oldest" as const,
    cursor: "opaque",
  };
  const url = new URL(
    productHref("/app/products", "bg", query, { status: "all" }),
    "https://treido.test",
  );
  expect(url.searchParams.get("q")).toBe(query.q);
  expect(url.searchParams.has("cursor")).toBe(false);
  expect(url.searchParams.has("status")).toBe(false);
  expect(url.searchParams.get("sort")).toBe("oldest");
});
