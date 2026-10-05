import { expect, it } from "vitest";
import { parseBuyerContinuation } from "./buyer-continuation";

it("returns to the original read-only shipping source or review without accepting consent or effects", () => {
  const uuid = "00000000-0000-4000-8000-000000000001";
  const cart = `/checkout/payments/shipping?lang=bg&source=cart&sellerId=${uuid}&cartRevision=2`;
  const offer = `/checkout/payments/shipping?lang=en&source=offer&threadId=${uuid}&offerId=${uuid}`;
  const review = `/checkout/payments/shipping/${uuid}?lang=bg`;
  for (const path of [cart, offer, review]) {
    expect(parseBuyerContinuation(path)).toBe(path);
    for (const suffix of [
      "&consent=true",
      "&execute=1",
      "&lang=en",
      "&recipient=private",
      "#accept",
      "\n",
    ])
      expect(parseBuyerContinuation(path + suffix)).toBeNull();
  }
  for (const path of [
    `/checkout/payments/shipping/../shipping/${uuid}?lang=bg`,
    `/checkout/payments/shipping/${uuid}?lang=b\ng`,
    `/checkout/payments/shipping?lang=bg&source=cart&sellerId=${uuid}&cartRevision=0`,
    `/checkout/payments/shipping?lang=bg&source=cart&sellerId=foreign&cartRevision=2`,
    "//foreign.invalid/checkout/payments/shipping",
  ])
    expect(parseBuyerContinuation(path)).toBeNull();
});

it.each(["closure", "preferences", "security"])(
  "preserves only read-only account %s routes after sign-in",
  (path) => {
    expect(parseBuyerContinuation(`/account/privacy/${path}?lang=bg`)).toBe(
      `/account/privacy/${path}?lang=bg`,
    );
    for (const suffix of [
      "?confirmed=true",
      "?planId=00000000-0000-4000-8000-000000000001",
      "?sessionId=foreign",
      "?lang=bg&lang=en",
      "?lang=en&consent=true",
      "?lang=fr",
      "/../security",
      "#close",
      "\\",
      "\n",
    ])
      expect(
        parseBuyerContinuation(`/account/privacy/${path}${suffix}`),
      ).toBeNull();
  },
);

it.each(["photo-match", "find-for-me/voice"])(
  "accepts only read-only %s input continuations",
  (path) => {
    expect(parseBuyerContinuation(`/minis/${path}?lang=en`)).toBe(
      `/minis/${path}?lang=en`,
    );
    for (const suffix of [
      "?consent=true",
      "?runId=00000000-0000-4000-8000-000000000001",
      "?lang=bg&lang=en",
      "?lang=en&execute=true",
      "#record",
      "/../photo-match?lang=en",
      "?media=foreign",
      "?lang=fr",
    ])
      expect(parseBuyerContinuation(`/minis/${path}${suffix}`)).toBeNull();
  },
);

it.each(["", "?lang=bg", "?lang=en"])(
  "preserves the read-only promotion privacy continuation %s",
  (suffix) => {
    const value = "/account/privacy/promotions" + suffix;
    expect(parseBuyerContinuation(value)).toBe(value);
  },
);
it.each([
  "?lang=bg&lang=en",
  "?allowed=true",
  "?requestId=00000000-0000-4000-8000-000000000001",
  "?policyId=00000000-0000-4000-8000-000000000001",
  "?lang=bg&consent=1",
  "?lang=fr",
  "/",
  "/../data",
  "#enable",
  "\n",
  "\\",
  "%0a",
])(
  "rejects effect-bearing or normalized promotion privacy continuations %s",
  (suffix) => {
    expect(
      parseBuyerContinuation("/account/privacy/promotions" + suffix),
    ).toBeNull();
  },
);
it("preserves reviewed Gift and current privacy return paths without accepting supplied private context", () => {
  expect(parseBuyerContinuation("/minis/gift-finder?lang=en")).toBe(
    "/minis/gift-finder?lang=en",
  );
  expect(parseBuyerContinuation("/account/privacy/data?lang=bg")).toBe(
    "/account/privacy/data?lang=bg",
  );
  for (const value of [
    "/minis/gift-finder?age=adult",
    "https://foreign.invalid/account/privacy/promotions",
    "//foreign.invalid/minis/gift-finder",
  ]) {
    expect(parseBuyerContinuation(value)).toBeNull();
  }
});
