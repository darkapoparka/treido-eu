import { describe, expect, it } from "vitest";
import { localeSchema } from "@treido/contracts";

describe("client-safe locale contract", () => {
  it.each(["bg", "en"])("accepts supported language %s", (locale) => {
    expect(localeSchema.parse(locale)).toBe(locale);
  });

  it.each([
    "BG",
    "bg-BG",
    "EUR",
    "Europe/Sofia",
    "",
    null,
    undefined,
    { locale: "bg" },
  ])("rejects unsupported or non-language input %j", (input) => {
    expect(localeSchema.safeParse(input).success).toBe(false);
  });
});
