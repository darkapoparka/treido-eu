import { describe, expect, it } from "vitest";
import {
  purchaseFeedbackHref,
  purchaseFeedbackPage,
} from "./purchase-feedback-model";

const seller = "b3db8275-e48a-4f4c-8a9e-b2805ab04631";
describe("bounded public purchase feedback navigation", () => {
  it("rejects duplicate, effect-bearing, malformed and out-of-bound paging", () => {
    expect(purchaseFeedbackPage(undefined)).toBe(0);
    expect(purchaseFeedbackPage("0")).toBe(0);
    expect(purchaseFeedbackPage("9")).toBe(9);
    for (const value of [
      ["0", "1"],
      ["0"],
      "10",
      "-1",
      "01",
      "1.0",
      "1&consent=true",
      "1#confirm",
      " 1",
      1,
      null,
    ])
      expect(purchaseFeedbackPage(value)).toBeNull();
  });
  it("builds only a validated public seller-info destination with language and paging", () => {
    expect(purchaseFeedbackHref(seller, "bg", 0)).toBe(
      `/stores/${seller}/info?lang=bg`,
    );
    expect(purchaseFeedbackHref(seller, "en", 9)).toBe(
      `/stores/${seller}/info?lang=en&feedbackPage=9`,
    );
    for (const page of [-1, 10, 1.5, Infinity])
      expect(() => purchaseFeedbackHref(seller, "bg", page)).toThrow(
        "INVALID_FEEDBACK_PAGE",
      );
    for (const id of [
      "foreign",
      `${seller}/../orders`,
      `${seller}?refund=true`,
    ])
      expect(() => purchaseFeedbackHref(id, "bg", 0)).toThrow(
        "INVALID_FEEDBACK_PAGE",
      );
  });
});
