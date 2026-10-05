import { expect, it } from "vitest";
import { legacyAssistantDestination } from "./legacy-routes";
it.each([
  ["assistant", {}, "/minis/find-for-me?lang=bg"],
  ["assistant", { example: "photo" }, "/minis/photo-match?lang=bg"],
  ["sol", {}, "/minis/find-for-me/voice?lang=bg"],
  ["look", {}, "/minis/photo-match?lang=bg"],
] as const)("maps %s to the real product tool", (kind, source, target) => {
  expect(legacyAssistantDestination(kind, source, "bg")).toBe(target);
});
it("retains locale and every valid human hard filter rather than replaying recorded reference answers", () => {
  const destination = legacyAssistantDestination(
    "assistant",
    {
      example: "photo",
      q: "Sony",
      seller: "business",
      condition: "good",
      maxPrice: "100",
      lang: "en",
    },
    "bg",
  )!;
  expect(destination.startsWith("/minis/photo-match?")).toBe(true);
  const params = new URL(destination, "https://treido.test").searchParams;
  for (const [key, value] of Object.entries({
    q: "Sony",
    seller: "business",
    condition: "good",
    maxPrice: "100.00",
    lang: "en",
  }))
    expect(params.get(key)).toBe(value);
  expect(params.has("example")).toBe(false);
});
it.each([
  { example: ["photo", "jeans"] },
  { example: "medical" },
  { seller: "business", maxPrice: "garbage" },
  { lang: ["bg", "en"] },
  { sellerId: "foreign" },
  { target: "https://foreign.test" },
  { cursor: "unreviewed" },
])(
  "rejects unsupported criteria instead of redirecting with weakened filters: %#",
  (source) => {
    expect(legacyAssistantDestination("assistant", source, "bg")).toBeNull();
  },
);
