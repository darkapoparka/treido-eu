import { describe, expect, it } from "vitest";
import {
  languagePromptEligible,
  languageSwitchDestination,
} from "./language-prompt-model";

describe("language suggestion and explicit choice", () => {
  it("offers a choice above buyer navigation, not inside private workflows", () => {
    for (const route of [
      "/",
      "/search",
      "/profile",
      "/products/item",
      "/stores/shop",
    ])
      expect(languagePromptEligible(route, null, false)).toBe(true);
    for (const route of [
      "/app",
      "/admin-preview",
      "/checkout",
      "/sell",
      "/sign-in",
    ])
      expect(languagePromptEligible(route, null, false)).toBe(false);
    expect(languagePromptEligible("/", "bg", false)).toBe(false);
    expect(languagePromptEligible("/", null, true)).toBe(false);
  });
  it("keeps public filters, scroll anchors and account context unchanged", () => {
    const target = new URL(
      languageSwitchDestination(
        "/search?q=phone&seller=personal&condition=good&location=Sofia&cursor=old#results",
        "bg",
      ),
      "https://treido.invalid",
    );
    expect(Object.fromEntries(target.searchParams)).toEqual({
      q: "phone",
      seller: "personal",
      condition: "good",
      location: "Sofia",
      lang: "bg",
    });
    expect(target.hash).toBe("#results");
    expect(languageSwitchDestination("/stores/a?lang=bg", "en")).toBe(
      "/stores/a?lang=en",
    );
  });
  it("never turns a language selection into an external redirect", () => {
    for (const href of [
      "https://outside.invalid/",
      "//outside.invalid/",
      "/\\outside.invalid",
      "/search\n",
    ])
      expect(languageSwitchDestination(href, "bg")).toBe("/?lang=bg");
  });
});
