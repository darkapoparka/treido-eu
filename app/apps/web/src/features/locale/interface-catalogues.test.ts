import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import discovery from "./discoveryUI-messages.json";
import account from "./accountUI-messages.json";
import commerce from "./commerceUI-messages.json";
import merchant from "./merchantUI-messages.json";
import captions from "./caption-messages.json";
import prompt from "./language-prompt-messages.json";
import { formatMoney } from "../catalog/types";

const catalogues = { discovery, account, commerce, merchant, captions, prompt };
describe("web interface translation catalogues", () => {
  for (const [name, catalogue] of Object.entries(catalogues)) {
    it(name + " has matching BG/EN keys and valid ICU messages", () => {
      expect(Object.keys(catalogue.bg).sort()).toEqual(
        Object.keys(catalogue.en).sort(),
      );
      for (const locale of ["bg", "en"] as const) {
        const errors: unknown[] = [];
        const translate = createTranslator({
          locale,
          messages: catalogue[locale] as Record<string, string>,
          onError: (error) => errors.push(error),
        });
        for (const key of Object.keys(catalogue[locale])) {
          expect(
            translate(key, {
              value1: 2,
              value2: 4,
              rating: 4.5,
              label: "Example",
              savings: "$20",
              minimum: "$50",
              offer: "Example offer",
              terms: "Example terms",
            }).length,
          ).toBeGreaterThan(0);
        }
        expect(errors).toEqual([]);
      }
    });
  }
  it("formats the original money and currency instead of performing conversion", () => {
    expect(formatMoney({ amount: 123450, currency: "EUR" }, "bg")).toContain(
      "1234,50",
    );
    expect(formatMoney({ amount: 123450, currency: "USD" }, "en")).toBe(
      "$1,234.50",
    );
  });
});
