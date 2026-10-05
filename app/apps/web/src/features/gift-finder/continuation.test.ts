import { expect, it } from "vitest";
import { parseGiftContinuation } from "./continuation";
it.each(["bg", "en"])("keeps exact read-only Gift route in %s", (lang) =>
  expect(parseGiftContinuation("/minis/gift-finder?lang=" + lang)).toBe(
    "/minis/gift-finder?lang=" + lang,
  ),
);
it("defaults only the missing locale", () =>
  expect(parseGiftContinuation("/minis/gift-finder")).toBe(
    "/minis/gift-finder?lang=bg",
  ));
it.each([
  undefined,
  null,
  {},
  "https://treido.invalid/minis/gift-finder",
  "//treido.invalid/minis/gift-finder",
  "/minis/gift",
  "/minis/gift-finder/",
  "/minis/gift-finder/../gift-finder",
  "/minis/gift-finder/%2e%2e/gift-finder",
  "/minis/gift-finder?lang=en&lang=bg",
  "/minis/gift-finder?lang=de",
  "/minis/gift-finder?recipient=Alice",
  "/minis/gift-finder?find=true",
  "/minis/gift-finder?confirmed=true",
  "/minis/gift-finder#find",
  "/minis/gift-finder\\",
  "/minis/gift-finder?lang=en" + "a".repeat(120),
])("rejects foreign/normalized/effect/private continuation %#", (bad) =>
  expect(parseGiftContinuation(bad)).toBeNull(),
);
it.each([...Array.from({ length: 33 }, (_, i) => (i === 32 ? 127 : i))])(
  "rejects raw control %d before URL normalization",
  (code) =>
    expect(
      parseGiftContinuation(
        "/minis/gift-finder?lang=e" + String.fromCharCode(code) + "n",
      ),
    ).toBeNull(),
);
