import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { createTranslator } from "next-intl";
import {
  parsePublishInput,
  parsePublicationTerms,
  policyAllowsContact,
} from "./publish-model";
import messages from "../locale/publication-messages.json";
const terms = {
  version: 1,
  country: "BG",
  purchaseMode: "contact",
  handover: ["pickup"],
  deliveryDetails: "",
  defects: "",
  ownsItem: true,
  photoRights: true,
  accurateDetails: true,
  personalSale: true,
};
const input = () => ({
  sellerId: randomUUID(),
  listingId: randomUUID(),
  requestId: randomUUID(),
  expectedRevision: 1,
  media: [{ id: randomUUID(), revision: 1 }],
  terms,
});
describe("publication input and translations", () => {
  it("requires explicit truthful acknowledgements, bounded handover terms and real revision IDs", () => {
    expect(parsePublishInput(input())).not.toBeNull();
    for (const key of ["ownsItem", "photoRights", "accurateDetails"])
      expect(parsePublicationTerms({ ...terms, [key]: false })).toBeNull();
  });
  it("rejects payment activation, invented countries, duplicate or empty modes and unbounded text", () => {
    for (const change of [
      { purchaseMode: "checkout" },
      { country: "DE" },
      { handover: [] },
      { handover: ["pickup", "pickup"] },
      { handover: ["shipping"], deliveryDetails: " " },
      { deliveryDetails: "x".repeat(1001) },
      { defects: "bad\u0000" },
      { approved: true },
    ])
      expect(parsePublicationTerms({ ...terms, ...change })).toBeNull();
  });
  it("binds every accepted photo revision and rejects duplicate/foreign control fields", () => {
    const data = input();
    for (const change of [
      { media: [] },
      { media: [data.media[0], data.media[0]] },
      { media: [{ id: randomUUID(), revision: 0 }] },
      { expectedRevision: 2147483647 },
      { sellerKind: "business" },
      { price: 1 },
    ])
      expect(parsePublishInput({ ...data, ...change })).toBeNull();
  });
  it("enforces current policy arrays independently of frontend choices", () => {
    const value = parsePublicationTerms(terms)!;
    const rules = {
      sellerKinds: ["personal"],
      conditions: ["good"],
      countries: ["BG"],
      purchaseModes: ["contact"],
      handoverModes: ["pickup"],
    };
    expect(policyAllowsContact(rules, "personal", "good", value)).toBe(true);
    expect(policyAllowsContact(rules, "business", "good", value)).toBe(false);
    expect(policyAllowsContact(rules, "personal", "new", value)).toBe(false);
    expect(
      policyAllowsContact(rules, "personal", "good", {
        ...value,
        personalSale: false,
      }),
    ).toBe(false);
  });
  it("keeps complete valid Bulgarian and English message catalogues", () => {
    expect(Object.keys(messages.bg).sort()).toEqual(
      Object.keys(messages.en).sort(),
    );
    for (const locale of ["bg", "en"] as const) {
      const errors: unknown[] = [];
      const t = createTranslator({
        locale,
        messages: messages[locale],
        onError: (e) => errors.push(e),
      });
      for (const key of Object.keys(messages[locale]))
        expect(t(key as keyof typeof messages.en).length).toBeGreaterThan(0);
      expect(errors).toEqual([]);
    }
  });
});
