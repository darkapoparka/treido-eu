import { describe, expect, it } from "vitest";
import { parseBuyerContinuation } from "../../apps/web/src/features/library/buyer-continuation";
import { parseAssistantContinuation } from "../../apps/web/src/features/assistant-tools/continuation";
import { privacyContinuation } from "../../apps/web/src/features/account-privacy/model";

const id = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
describe("T56 T54/T55 shared sign-in entry integration", () => {
  it.each(Array.from({ length: 33 }, (_, index) => (index < 32 ? index : 127)))(
    "rejects raw control character code %i before URL normalization",
    (code) => {
      for (const href of [
        "/search?query=телефон",
        "/minis/compare?lang=en",
        "/minis/saved-searches?lang=bg",
        "/minis/compatibility?lang=en",
        "/account/privacy/data?lang=bg",
      ]) {
        expect(
          parseBuyerContinuation(href + String.fromCharCode(code)),
        ).toBeNull();
      }
    },
  );
  it("preserves safe Unicode browsing and rejects raw backslashes", () => {
    expect(parseBuyerContinuation("/search?query=телефон")).toBe(
      "/search?query=%D1%82%D0%B5%D0%BB%D0%B5%D1%84%D0%BE%D0%BD",
    );
    expect(parseBuyerContinuation("/search\\?query=phone")).toBeNull();
  });
  it.each(["bg", "en"])("preserves %s privacy navigation only", (lang) => {
    const href = "/account/privacy/data?lang=" + lang;
    expect(privacyContinuation(href)).toBe(href);
    expect(parseBuyerContinuation(href)).toBe(href);
  });
  it.each([
    "/account/privacy/download?id=" + id,
    "/account/privacy/data?lang=en&review=true",
    "/account/privacy/data?lang=bg&lang=en",
    "/account/privacy/data?lang=%65n",
    "/account/privacy/%64ata?lang=en",
    "/account/privacy/data?lang=xx",
    "/account/privacy/data#submit",
    "/account/privacy/data/",
    "https://evil.test/account/privacy/data",
    "//evil.test/account/privacy/data",
    "/account/privacy/data?requestId=" + id,
    "/account/privacy/data?export=account",
  ])("rejects unsafe/mutation privacy continuation %s", (href) => {
    expect(privacyContinuation(href)).toBeNull();
    expect(parseBuyerContinuation(href)).toBeNull();
  });
  it.each(["bg", "en"])(
    "accepts bounded typed compatibility navigation in %s",
    (lang) => {
      const href =
        "/minis/compatibility?lang=" +
        lang +
        "&listing=" +
        id +
        "&listing=" +
        other +
        "&categoryId=cat%3Aelectronics%2Fphones";
      const canonical =
        "/minis/compatibility?lang=" +
        lang +
        "&categoryId=cat%3Aelectronics%2Fphones&listing=" +
        id +
        "&listing=" +
        other;
      expect(parseAssistantContinuation(href)).toBe(canonical);
      expect(parseBuyerContinuation(href)).toBe(canonical);
    },
  );
  it.each([
    "/minis/compatibility?listing=" + id + "&listing=" + id,
    "/minis/compatibility?" +
      Array(5)
        .fill("listing=" + id)
        .join("&"),
    "/minis/compatibility?listing=foreign",
    "/minis/compatibility?categoryId=cat%3Aelectronics",
    "/minis/compatibility?categoryId=invented",
    "/minis/compatibility?save=true",
    "/minis/compatibility?lang=en&lang=bg",
    "/minis/compatibility#accept",
    "/minis/%63ompatibility?lang=en",
    "/minis/compatibility?%73ave=true",
    "/minis/sell-helper?draftId=" + id,
    "/minis/sell-helper?sellerId=foreign",
    "/minis/sell-helper?sellerId=" + id + "&draftId=foreign",
    "/minis/sell-helper?sellerId=" + id + "&sellerId=" + other,
    "/minis/sell-helper?sellerId=" + id + "&apply=true",
    "/minis/sell-helper?sellerId=" + id + "&accept=true",
    "/minis/sell-helper?sellerId=" + id + "&lang=xx",
    "https://evil.test/minis/sell-helper",
    "//evil.test/minis/compatibility",
    "/minis/compatibility\\?lang=en",
  ])("rejects foreign/encoded-command/ambiguous assistant hints %s", (href) => {
    expect(parseAssistantContinuation(href)).toBeNull();
    expect(parseBuyerContinuation(href)).toBeNull();
  });
  it("accepts seller+draft hints without producing a command or seller authority", () => {
    const href =
      "/minis/sell-helper?lang=bg&sellerId=" + id + "&draftId=" + other;
    expect(parseBuyerContinuation(href)).toBe(href);
  });
  it("normalizes UUID casing while retaining safe explicit repeated selections", () => {
    const upper = "A0000000-0000-4000-8000-000000000001";
    expect(
      parseAssistantContinuation("/minis/compatibility?listing=" + upper),
    ).toBe("/minis/compatibility?listing=" + upper.toLowerCase());
  });
  it.each([
    "/minis",
    "/minis/compare?lang=en",
    "/minis/saved-searches?lang=bg",
    "/minis/find-for-me?maxPrice=100",
    "/search?lang=bg&seller=personal",
    "/saved?lang=en",
  ])("preserves delivered buyer continuation %s", (href) => {
    expect(parseBuyerContinuation(href)).not.toBeNull();
  });
});
