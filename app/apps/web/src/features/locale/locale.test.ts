import { describe, expect, it } from "vitest";
import {
  browserLocale,
  detectLocation,
  languageSettingsReturn,
  localeDestination,
  preferenceDestination,
  resolveLocale,
} from "./locale";

describe("buyer language preferences", () => {
  it.each([
    ["en-US,en;q=0.8,bg;q=0.9", "en"],
    ["de-DE,bg-BG;q=0.9,en;q=0.8", "bg"],
    ["en;q=0.4,bg;q=0.9", "bg"],
    ["en;q=0,bg;q=0.2", "bg"],
    ["en;q=invalid,bg;q=0.5", "bg"],
    ["bg;q=2,en;q=1", "en"],
    ["EN-gb", "en"],
    ["fr-FR,*;q=0.5", null],
    ["en_US", null],
  ])(
    "negotiates %s without unsupported or zero-quality languages",
    (header, expected) => {
      expect(browserLocale(header)).toBe(expected);
    },
  );
  it("prioritizes a URL then saved choice then browser, with an international English fallback", () => {
    expect(
      resolveLocale({ explicit: "bg", saved: "en", acceptLanguage: "en-US" }),
    ).toEqual({ locale: "bg", source: "url" });
    expect(resolveLocale({ saved: "bg", acceptLanguage: "en-US" })).toEqual({
      locale: "bg",
      source: "saved",
    });
    expect(
      resolveLocale({
        explicit: "<script>",
        saved: "de",
        acceptLanguage: "en-GB",
      }),
    ).toEqual({ locale: "en", source: "browser" });
    expect(resolveLocale({ acceptLanguage: "fr-FR" })).toEqual({
      locale: "en",
      source: "default",
    });
  });
  it("carries explicit language independently from private seller/filter context", () => {
    expect(localeDestination("/profile", "bg")).toBe("/profile?lang=bg");
    expect(localeDestination("/sell?intent=business#start", "en")).toBe(
      "/sell?intent=business&lang=en#start",
    );
    expect(localeDestination("/search?lang=bg", "en")).toBe("/search?lang=bg");
    for (const href of [
      "//outside.invalid",
      "https://outside.invalid",
      "/api/products",
      "javascript:alert(1)",
      "/\\outside.invalid",
    ])
      expect(localeDestination(href, "bg")).toBe(href);
  });
  it.each([
    "//outside.invalid",
    "https://outside.invalid",
    "http://[",
    "/sign-in",
    "/api/products",
    "/\\outside.invalid",
    "/profile\n",
  ])("rejects unsafe or private preference returns %s", (href) => {
    expect(languageSettingsReturn(href)).toBe("/profile");
  });
  it("changing language keeps scope, geography and filters while retiring pagination", () => {
    const href = preferenceDestination(
      "/search?q=phone&seller=business&condition=good&location=София&page=3&cursor=old&lang=en#results",
      "bg",
      "София",
    );
    const url = new URL(href, "https://treido.invalid");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: "phone",
      seller: "business",
      condition: "good",
      location: "София",
      lang: "bg",
    });
    expect(url.hash).toBe("#results");
  });
});
describe("approximate location suggestions", () => {
  const headers = new Headers({
    "x-vercel-ip-country": "BG",
    "x-vercel-ip-city": "%D0%A1%D0%BE%D1%84%D0%B8%D1%8F",
  });
  it("reads a hosting hint independently of language, never a local forged header", () => {
    expect(detectLocation(headers, true)).toEqual({
      country: "BG",
      city: "София",
    });
    expect(detectLocation(headers, false)).toBeNull();
    expect(resolveLocale({ acceptLanguage: "en-US" }).locale).toBe("en");
  });
  it("handles missing/invalid country, city encoding, length and control input", () => {
    for (const value of ["", "ZZ", "bg", "BGR", "<script>"])
      expect(
        detectLocation(new Headers({ "x-vercel-ip-country": value }), true),
      ).toBeNull();
    for (const city of ["%invalid", "x".repeat(81), "%00", "<script>"])
      expect(
        detectLocation(
          new Headers({
            "x-vercel-ip-country": "BG",
            "x-vercel-ip-city": city,
          }),
          true,
        ),
      ).toEqual({ country: "BG", city: null });
  });
});
