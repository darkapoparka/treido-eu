import { describe, expect, it } from "vitest";
import {
  parseInputCommand,
  parseInputResponse,
  parseInterpretation,
  preserveConstraints,
  criteria,
} from "./model";
const id = "10000000-0000-4000-8000-000000000001",
  base = "q=Sony&seller=business&maxPrice=100&availability=known&lang=bg",
  envelope = {
    actorKey: "a".repeat(64),
    requestId: id,
    expectedRevision: 0,
    mode: "text",
    operation: {
      kind: "prepare",
      policyId: id,
      criteria: base,
      prompt: "Фотоапарат",
      mediaId: null,
      confirmed: true,
    },
  };
it("strict intent canonicalization preserves all hard selections across refinement", () => {
  const proposed = base + "&category=cat%3Aelectronics%2Fcameras-lenses";
  expect(preserveConstraints(base, proposed)).toBe(criteria(proposed));
  for (const parameter of ["q", "seller", "maxPrice", "availability"]) {
    const params = new URLSearchParams(base);
    params.delete(parameter);
    expect(() => preserveConstraints(base, params.toString())).toThrow(
      "INVALID_INPUT",
    );
  }
  expect(() =>
    preserveConstraints(base, base.replace("lang=bg", "lang=en")),
  ).toThrow("INVALID_INPUT");
});
it("preserves every selected multi-value attribute without adding alternatives to its match", () => {
  const selected =
    "category=cat%3Aelectronics%2Fcameras-lenses&attr.includedAccessories=charger&attr.includedAccessories=case&lang=en";
  expect(preserveConstraints(selected, selected + "&seller=personal")).toBe(
    criteria(selected + "&seller=personal"),
  );
  for (const changed of [
    selected.replace("&attr.includedAccessories=case", ""),
    selected.replace("=case", "=battery"),
    selected + "&attr.includedAccessories=box",
  ]) {
    expect(() => preserveConstraints(selected, changed)).toThrow(
      "INVALID_INPUT",
    );
  }
});
it("accepts only exact minimal HTTP acknowledgments and leaves malformed replies pending", () => {
  const response = {
    ok: true,
    data: {
      subject: "user_alice",
      value: { revision: 1, runId: id, assetId: null, replayed: false },
    },
  };
  expect(parseInputResponse(response)).toEqual(response);
  for (const value of [
    { revision: 0 },
    { runId: "foreign-display-key" },
    { replayed: "yes" },
    { next: "https://evil.test" },
  ])
    expect(() =>
      parseInputResponse({
        ...response,
        data: { ...response.data, value: { ...response.data.value, ...value } },
      }),
    ).toThrow("INVALID_INPUT");
  for (const raw of [
    { ok: true },
    { ok: true, data: { ...response.data, role: "owner" } },
    { ok: false, code: "approved" },
    { ok: false, code: "NOT_AVAILABLE", data: response.data },
  ])
    expect(() => parseInputResponse(raw)).toThrow("INVALID_INPUT");
  expect(parseInputResponse({ ok: false, code: "NOT_AVAILABLE" })).toEqual({
    ok: false,
    code: "NOT_AVAILABLE",
  });
});
it("rejects effects, duplicate filters, cursor, unknown keys and foreign actor envelope shapes", () => {
  for (const extra of [
    "&href=https%3A%2F%2Fevil.test",
    "&maxPrice=1000",
    "&cursor=opaque",
  ]) {
    expect(() => criteria(base + extra)).toThrow("INVALID_INPUT");
  }
  expect(() => parseInputCommand({ ...envelope, sellerId: id })).toThrow(
    "INVALID_INPUT",
  );
  expect(() =>
    parseInputCommand({ ...envelope, actorKey: "browser-role" }),
  ).toThrow("INVALID_INPUT");
  expect(() =>
    parseInputCommand({
      ...envelope,
      operation: { ...envelope.operation, confirmed: false },
    }),
  ).toThrow("INVALID_INPUT");
});
it("photo/voice require owned media and text requires actual supplied text", () => {
  expect(() => parseInputCommand({ ...envelope, mode: "photo" })).toThrow(
    "INVALID_INPUT",
  );
  expect(() =>
    parseInputCommand({
      ...envelope,
      operation: { ...envelope.operation, prompt: "" },
    }),
  ).toThrow("INVALID_INPUT");
  expect(
    parseInputCommand({
      ...envelope,
      mode: "voice",
      operation: { ...envelope.operation, mediaId: id, prompt: "" },
    }).mode,
  ).toBe("voice");
});
it("media size and claimed format are strict, and there is no audio URL input", () => {
  const stage = {
    kind: "stage",
    policyId: id,
    bytes: 100,
    contentType: "audio/wav",
    checksum: "b".repeat(64),
    confirmed: true,
  };
  expect(
    parseInputCommand({ ...envelope, mode: "voice", operation: stage })
      .operation.kind,
  ).toBe("stage");
  for (const changed of [
    { bytes: 12582913 },
    { contentType: "audio/mpeg" },
    { url: "https://evil.test/audio" },
  ])
    expect(() =>
      parseInputCommand({
        ...envelope,
        mode: "voice",
        operation: { ...stage, ...changed },
      }),
    ).toThrow("INVALID_INPUT");
});
describe("model interpretation is only a bounded editable proposal", () => {
  const proposal = {
    criteria: base,
    itemType: "camera",
    colour: null,
    style: null,
    transcript: null,
  };
  it("cannot supply authoritative IDs, prices, hrefs, tools or raw actions", () => {
    for (const [key, value] of Object.entries({
      listingId: id,
      price: 1,
      href: "https://evil.test",
      tool_calls: [],
      purchase: true,
    }))
      expect(() =>
        parseInterpretation({ ...proposal, [key]: value }, "text", base),
      ).toThrow("INVALID_INPUT");
  });
  it("cannot relax a filter or call typed text a recognized transcript", () => {
    expect(() =>
      parseInterpretation(
        { ...proposal, criteria: "q=Sony&lang=bg" },
        "photo",
        base,
      ),
    ).toThrow("INVALID_INPUT");
    expect(() =>
      parseInterpretation(
        { ...proposal, transcript: "Typed text" },
        "text",
        base,
      ),
    ).toThrow("INVALID_INPUT");
    expect(() =>
      parseInterpretation(
        { ...proposal, itemType: "x".repeat(121) },
        "photo",
        base,
      ),
    ).toThrow("INVALID_INPUT");
  });
  it.each([
    ["condition=new", "lang=bg"],
    ["minPrice=10", "lang=bg"],
    ["maxPrice=100", "lang=bg"],
    ["handover=shipping", "lang=bg"],
    ["location=Sofia", "lang=bg"],
    ["seller=business", "lang=bg"],
    ["availability=known", "lang=bg"],
    ["sort=price_asc", "lang=bg"],
    ["category=cat%3Aelectronics%2Fcameras-lenses", "lang=bg"],
    [
      "attr.includedAccessories=charger",
      "category=cat%3Aelectronics%2Fcameras-lenses&lang=bg",
    ],
  ])("photo cannot add an unselected %s", (added, original) => {
    const proposed = original + "&" + added;
    // These are valid catalogue criteria; rejection belongs to photo scope.
    expect(preserveConstraints(original, proposed)).toBe(criteria(proposed));
    expect(() =>
      parseInterpretation(
        { ...proposal, criteria: proposed },
        "photo",
        original,
      ),
    ).toThrow("INVALID_INPUT");
  });
  it("photo keeps every explicit original criterion, including selected condition and attributes", () => {
    const original =
      base +
      "&condition=new&location=Sofia&handover=shipping&sort=price_asc&category=cat%3Aelectronics%2Fcameras-lenses&attr.includedAccessories=charger&attr.includedAccessories=case";
    expect(
      parseInterpretation(
        { ...proposal, criteria: original },
        "photo",
        original,
      ),
    ).toEqual({ ...proposal, criteria: criteria(original) });
  });
  it("a new photo query contains exactly its editable type, colour and style search terms", () => {
    const visual = {
      ...proposal,
      itemType: "camera",
      colour: "black",
      style: "retro",
    };
    const original = "seller=business&maxPrice=100&lang=en",
      proposed = original + "&q=RETRO+black+camera";
    expect(
      parseInterpretation({ ...visual, criteria: proposed }, "photo", original)
        .criteria,
    ).toBe(criteria(proposed));
    const localized = "lang=bg&q=CHEREN+fotoaparat";
    expect(
      parseInterpretation(
        {
          ...proposal,
          criteria: localized,
          itemType: "Фотоапарат",
          colour: "Черен",
        },
        "photo",
        "lang=bg",
      ).criteria,
    ).toBe(criteria(localized));
    for (const q of ["new black retro camera", "black camera", "bargain"]) {
      expect(() =>
        parseInterpretation(
          { ...visual, criteria: original + "&q=" + encodeURIComponent(q) },
          "photo",
          original,
        ),
      ).toThrow("INVALID_INPUT");
    }
    expect(() =>
      parseInterpretation(
        {
          ...proposal,
          criteria: "q=camera&lang=bg",
          itemType: null,
          colour: null,
          style: null,
        },
        "photo",
        "lang=bg",
      ),
    ).toThrow("INVALID_INPUT");
  });
  it("keeps deliberate human photo edits and text/voice interpretation available", () => {
    const expanded = base + "&condition=new&location=Sofia";
    expect(preserveConstraints(base, expanded)).toBe(criteria(expanded));
    expect(
      parseInputCommand({
        ...envelope,
        mode: "photo",
        operation: {
          kind: "accept",
          runId: id,
          criteria: expanded,
          confirmed: true,
        },
      }).operation,
    ).toEqual({
      kind: "accept",
      runId: id,
      criteria: criteria(expanded),
      confirmed: true,
    });
    for (const inputMode of ["text", "voice"] as const) {
      expect(
        parseInterpretation(
          {
            ...proposal,
            criteria: expanded,
            transcript:
              inputMode === "voice" ? "Търся нов фотоапарат в София." : null,
          },
          inputMode,
          base,
        ).criteria,
      ).toBe(criteria(expanded));
    }
  });
});
