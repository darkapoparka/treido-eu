import { describe, expect, it } from "vitest";
import { legalReviewAllowed } from "./review-policy";

const local = {
  NODE_ENV: "development",
  TREIDO_ENV: "development",
  TREIDO_APP_ORIGIN: "http://127.0.0.1:6419",
};

describe("unapproved legal text isolation", () => {
  it("allows an explicit review on the exact configured local development host", () => {
    expect(legalReviewAllowed("1", "127.0.0.1:6419", local)).toBe(true);
  });
  it("accepts the explicit disabled reference flag forced by dev:platform", () => {
    expect(
      legalReviewAllowed("1", "127.0.0.1:6419", {
        ...local,
        SHOP_REFERENCE_PREVIEW: "0",
      }),
    ).toBe(true);
  });
  it.each([undefined, "true", "0", ["1"], ["1", "1"]])(
    "denies absent, loose or repeated review input %j",
    (review) => {
      expect(legalReviewAllowed(review, "127.0.0.1:6419", local)).toBe(false);
    },
  );
  it.each([
    { NODE_ENV: "production" },
    { NODE_ENV: "test" },
    { TREIDO_ENV: "production" },
    { TREIDO_ENV: "preview" },
    { TREIDO_ENV: undefined },
    { VERCEL: "1" },
    { VERCEL_ENV: "preview" },
    { VERCEL_ENV: "production" },
    { CI: "true" },
    { SHOP_REFERENCE_PREVIEW: "1" },
    { SHOP_REFERENCE_PREVIEW: "unknown" },
  ])("cannot expose a draft in hosted/production/reference mode %j", (env) => {
    expect(
      legalReviewAllowed("1", "127.0.0.1:6419", {
        ...local,
        SHOP_REFERENCE_PREVIEW: "0",
        ...env,
        TREIDO_LEGAL_APPROVED: "true",
      }),
    ).toBe(false);
  });
  it.each([
    "https://treido.eu",
    "http://treido.eu:6419",
    "http://localhost.evil.test:6419",
    "https://127.0.0.1:6419",
    "http://user@127.0.0.1:6419",
    "http://127.0.0.1:6419/",
    "http://127.0.0.1:6419?approved=1",
    "http://127.0.0.1",
    "invalid",
    "",
  ])("denies unsuitable or noncanonical configured origin %s", (origin) => {
    expect(
      legalReviewAllowed("1", "127.0.0.1:6419", {
        ...local,
        TREIDO_APP_ORIGIN: origin,
      }),
    ).toBe(false);
  });
  it.each([null, "treido.eu", "localhost:6419", "127.0.0.1:6420"])(
    "denies a missing/foreign request host %s",
    (host) => {
      expect(legalReviewAllowed("1", host, local)).toBe(false);
    },
  );
});
