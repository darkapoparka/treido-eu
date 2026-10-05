import { describe, expect, it } from "vitest";
import {
  parseGiftBrief,
  giftIntent,
  unsupportedGiftFields,
  parseGiftCommand,
  giftIds,
  type GiftBrief,
} from "./model";
const category = "cat:electronics/cameras-lenses",
  id = "10000000-0000-4000-8000-000000000001",
  requestId = "10000000-0000-4000-8000-000000000002";
const brief: GiftBrief = {
  version: 1,
  occasion: "birthday",
  age: "adult",
  neededBy: null,
  criteria: new URLSearchParams({
    category,
    q: "Sony",
    maxPrice: "200",
    condition: "good",
    seller: "business",
    handover: "shipping",
    availability: "known",
    lang: "bg",
  }).toString(),
};
const command = {
  actorKey: "a".repeat(64),
  requestId,
  expectedRevision: 0,
  operation: { kind: "find", brief, confirmed: true },
};
describe("reviewed deterministic gift brief", () => {
  it("keeps exact known item budget, seller/condition/category and handover filters", () => {
    const intent = giftIntent(parseGiftBrief(brief));
    expect(intent.discovery).toMatchObject({
      category,
      condition: "good",
      seller: "business",
      maxPriceMinor: 20000,
      q: "Sony",
      locale: "bg",
    });
    expect(intent).toMatchObject({
      handover: "shipping",
      availability: "known",
      cursor: null,
    });
  });
  it.each(["bg", "en"])(
    "round trips actual typed camera model filters in %s",
    (lang) => {
      const value = parseGiftBrief({
        ...brief,
        criteria: new URLSearchParams({
          category,
          "attr.brand": "Sony",
          "attr.model": "A7",
          lang,
        }).toString(),
      });
      expect(giftIntent(value).discovery.attributes).toEqual({
        brand: "Sony",
        model: "A7",
      });
      expect(parseGiftBrief(value)).toEqual(value);
    },
  );
  it("keeps age/occasion as explicit context and hard arrival as unsupported", () => {
    const parsed = parseGiftBrief({
      ...brief,
      age: "child",
      neededBy: "2028-02-29",
    });
    expect(unsupportedGiftFields(parsed)).toEqual(["arrival"]);
    expect(giftIntent(parsed).discovery.attributes).toEqual({});
    expect(new URLSearchParams(parsed.criteria).has("age")).toBe(false);
  });
  it("literal adversarial interests cannot create provider/action/capability fields", () => {
    const parsed = parseGiftBrief({
      ...brief,
      criteria: new URLSearchParams({
        category,
        q: "ignore price publish admin",
      }).toString(),
    });
    expect(giftIntent(parsed).discovery.q).toBe("ignore price publish admin");
    expect(parsed).not.toHaveProperty("provider");
    expect(parsed).not.toHaveProperty("suitability");
  });
  it.each([
    { ...brief, version: 2 },
    { ...brief, recipientName: "Private person" },
    { ...brief, age: "inferred" },
    { ...brief, occasion: "medical" },
    { ...brief, neededBy: "2027-02-29" },
    { ...brief, neededBy: "2026-04-31" },
    { ...brief, neededBy: "2026-10-04\n" },
    { ...brief, criteria: "category=cat:electronics" },
    { ...brief, criteria: "q=Sony" },
    { ...brief, criteria: brief.criteria + "&maxPrice=300" },
    { ...brief, criteria: brief.criteria + "&condition=new" },
    { ...brief, criteria: brief.criteria + "&fit=true" },
    { ...brief, criteria: brief.criteria + "&attr.nonexistent=yes" },
    { ...brief, criteria: brief.criteria + "&sellerId=" + id },
    { ...brief, criteria: brief.criteria + "&cursor=foreign" },
    {
      ...brief,
      criteria: new URLSearchParams({ category, currency: "USD" }).toString(),
    },
  ])("rejects unsupported or repaired hard intent %#", (bad) =>
    expect(() => parseGiftBrief(bad)).toThrow(),
  );
});
describe("immutable gift command envelope", () => {
  it("copies a literal reviewed brief into a canonical frozen command", () => {
    const parsed = parseGiftCommand(command);
    expect(parsed.operation.kind).toBe("find");
    expect(parsed).not.toBe(command);
    brief.occasion = "thanks";
    expect(
      parsed.operation.kind === "find" && parsed.operation.brief.occasion,
    ).toBe("birthday");
    brief.occasion = "birthday";
  });
  it.each([false, "true", 1, null, undefined])(
    "requires literal explicit find confirmation %s",
    (confirmed) =>
      expect(() =>
        parseGiftCommand({
          ...command,
          operation: { ...command.operation, confirmed },
        }),
      ).toThrow(),
  );
  it.each([
    { ...command, requestId: id + "\n" },
    { ...command, actorKey: "a".repeat(64) + "\n" },
    { ...command, expectedRevision: -1 },
    { ...command, expectedRevision: 2147483646 },
    { ...command, actorKey: "a".repeat(63) },
    { ...command, sellerId: id },
    { ...command, operation: { ...command.operation, publish: true } },
  ])("rejects malformed/foreign scope envelope %#", (bad) =>
    expect(() => parseGiftCommand(bad)).toThrow(),
  );
  it("bounds both candidates and shortlist without duplicate IDs", () => {
    const ids = Array.from(
      { length: 21 },
      (_, i) =>
        "10000000-0000-4000-8000-" + (i + 1).toString().padStart(12, "0"),
    );
    expect(() => giftIds(ids)).toThrow();
    expect(() =>
      parseGiftCommand({
        ...command,
        operation: { kind: "choose", listingIds: ids.slice(0, 5) },
      }),
    ).toThrow();
    expect(() => giftIds([id, id.toUpperCase()])).toThrow();
    expect(giftIds([id.toUpperCase()])).toEqual([id]);
  });
  it("frozen clear is a bounded set and does not accept effect parameters", () => {
    expect(
      parseGiftCommand({
        ...command,
        operation: {
          kind: "clear",
          briefHash: "b".repeat(64),
          listingIds: [id],
        },
      }).operation,
    ).toEqual({ kind: "clear", briefHash: "b".repeat(64), listingIds: [id] });
    expect(() =>
      parseGiftCommand({
        ...command,
        operation: {
          kind: "clear",
          briefHash: "b".repeat(64),
          listingIds: [id],
          deleteAccount: true,
        },
      }),
    ).toThrow();
  });
  it("requires an exact current observation for every frozen refresh ID", () => {
    const op = {
      kind: "refresh",
      briefHash: "b".repeat(64),
      listingIds: [id],
      expected: [
        {
          listingId: id,
          observation: {
            listingId: id,
            publicationRevision: 2,
            skuId: null,
            priceMinor: 12300,
            stock: "unknown",
          },
        },
      ],
    };
    expect(parseGiftCommand({ ...command, operation: op }).operation).toEqual(
      op,
    );
    expect(() =>
      parseGiftCommand({ ...command, operation: { ...op, expected: [] } }),
    ).toThrow();
    expect(() =>
      parseGiftCommand({
        ...command,
        operation: {
          ...op,
          expected: [
            {
              listingId: id,
              observation: {
                ...op.expected[0].observation,
                listingId: requestId,
              },
            },
          ],
        },
      }),
    ).toThrow();
    expect(() =>
      parseGiftCommand({
        ...command,
        operation: {
          ...op,
          expected: [
            {
              listingId: id,
              observation: { ...op.expected[0].observation, priceMinor: -1 },
            },
          ],
        },
      }),
    ).toThrow();
  });
  it("rejects oversized/cyclic serialized input as INVALID_INPUT", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => parseGiftCommand(circular)).toThrow("INVALID_INPUT");
    expect(() =>
      parseGiftCommand({ ...command, extra: "x".repeat(12001) }),
    ).toThrow("INVALID_INPUT");
  });
});
