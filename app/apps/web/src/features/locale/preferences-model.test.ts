import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import { messages } from "./messages";
import studio from "../sellers/preview/studio-messages.json";
import {
  parseLocalizationPreference,
  readRegionCookie,
} from "./preferences-model";
import { countryOptions, parseCountry, parseTimeZone } from "./regions";
import { parseDeviceCity } from "./device-location";
import { preferenceDestination, resolveLocale } from "./locale";

describe("international preferences", () => {
  it("keeps explicit language and saved choices independent of physical country", () => {
    expect(resolveLocale({ country: "BG", acceptLanguage: "fr" }).locale).toBe(
      "bg",
    );
    expect(resolveLocale({ country: "US", acceptLanguage: "fr" }).locale).toBe(
      "en",
    );
    expect(
      resolveLocale({ country: "BG", acceptLanguage: "en-US" }).locale,
    ).toBe("en");
    expect(
      resolveLocale({ explicit: "en", saved: "bg", country: "BG" }).locale,
    ).toBe("en");
    expect(resolveLocale({ saved: "bg", country: "US" }).locale).toBe("bg");
  });
  it("persists a country, city and time zone without coordinates or seller authority", () => {
    const input = {
      locale: "bg",
      country: "DE",
      locality: " Berlin ",
      timeZone: "Europe/Berlin",
    };
    expect(parseLocalizationPreference(input)).toEqual({
      ...input,
      locality: "Berlin",
    });
    expect(parseLocalizationPreference({ ...input, latitude: 52 })).toBeNull();
    expect(
      parseLocalizationPreference({ ...input, sellerId: "business" }),
    ).toBeNull();
    expect(parseLocalizationPreference({ ...input, country: "ZZ" })).toBeNull();
    expect(parseLocalizationPreference({ ...input, locale: "fr" })).toBeNull();
    expect(
      parseLocalizationPreference({ ...input, locality: "x".repeat(81) }),
    ).toBeNull();
    expect(
      parseLocalizationPreference({ ...input, timeZone: "Not/AZone" }),
    ).toBeNull();
    expect(
      readRegionCookie(
        encodeURIComponent(
          JSON.stringify({
            country: "BG",
            locality: "София",
            timeZone: "Europe/Sofia",
          }),
        ),
      ),
    ).toEqual({ country: "BG", locality: "София", timeZone: "Europe/Sofia" });
    expect(readRegionCookie("%not-valid")).toBeNull();
  });
  it("provides country labels rather than inferring an allowed selling market", () => {
    expect(countryOptions("en").length).toBeGreaterThan(240);
    expect(new Set(countryOptions("bg").map((row) => row.code)).size).toBe(
      countryOptions("bg").length,
    );
    expect(countryOptions("bg").find((row) => row.code === "BG")?.name).toBe(
      "България",
    );
    expect(parseCountry("bg")).toBeNull();
    expect(parseTimeZone("UTC")).toBe("UTC");
  });
  it("changes private display language without injecting public filters or changing the seller", () => {
    const result = new URL(
      preferenceDestination(
        "/app/sellers/test/listings?q=shirt&cursor=next&lang=en",
        "bg",
        "София",
      ),
      "https://treido.invalid",
    );
    expect(result.pathname).toBe("/app/sellers/test/listings");
    expect(Object.fromEntries(result.searchParams)).toEqual({
      q: "shirt",
      cursor: "next",
      lang: "bg",
    });
  });
  it("accepts only useful bounded city results from device lookup", () => {
    expect(
      parseDeviceCity({ countryCode: "BG", city: "София", latitude: 42 }),
    ).toEqual({ country: "BG", city: "София" });
    expect(
      parseDeviceCity({ countryCode: "DE", city: "", locality: "Berlin" }),
    ).toEqual({ country: "DE", city: "Berlin" });
    expect(parseDeviceCity({ countryCode: "ZZ", city: "City" })).toBeNull();
    expect(parseDeviceCity({ countryCode: "BG", city: "<script>" })).toBeNull();
  });
  it("keeps every published message key translated and formats plural counts", () => {
    const keys = (value: object, prefix = ""): string[] =>
      Object.entries(value).flatMap(([key, entry]) =>
        typeof entry === "string"
          ? [prefix + key]
          : keys(entry, prefix + key + "."),
      );
    expect(keys(messages.bg).sort()).toEqual(keys(messages.en).sort());
    expect(keys(studio.bg).sort()).toEqual(keys(studio.en).sort());
    const t = createTranslator({
      locale: "bg",
      messages: studio.bg,
      namespace: "studioUi",
    });
    expect(t("results", { count: 1 })).toBe("1 резултат");
    expect(t("results", { count: 3 })).toBe("3 резултата");
  });
});
