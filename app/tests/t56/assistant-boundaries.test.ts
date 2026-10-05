import { describe, expect, it, vi } from "vitest";
vi.mock("../../apps/web/node_modules/server-only/index.js", () => ({}));
import { CATEGORY_REGISTRY_VERSION } from "@treido/contracts/categories";
import {
  parseToolIntent,
  parseShoppingToolContinuation,
  toolParams,
} from "../../apps/web/src/features/shopping-tools/intent";
import {
  comparisonChanges,
  parseComparisonCommand,
  type ToolListing,
} from "../../apps/web/src/features/shopping-tools/model";
import { buildToolQuery } from "../../apps/web/src/features/shopping-tools/catalogue-sql.server";
import {
  criteriaIntent,
  parseCriteria,
  parseSearchCommand,
  parseSearchContinuation,
  reviewedCriteria,
} from "../../apps/web/src/features/saved-searches/model";
import {
  InsightError,
  insightRange,
  parseInsightQuery,
  parseInsightsContinuation,
  type InsightRow,
} from "../../apps/web/src/features/insights/model";
import {
  summarizeInsights,
  type InsightContext,
} from "../../apps/web/src/features/insights/summary";
import { insightsCsv } from "../../apps/web/src/features/insights/csv.server";

const id = "00000000-0000-4000-8000-000000000001";
const actorKey = "a".repeat(64);
const envelope = { actorKey, expectedRevision: 0, requestId: id };
const criteria = reviewedCriteria(
  parseToolIntent(
    "q=телефон&seller=personal&condition=good&maxPrice=200&lang=bg",
    "find-for-me",
  ),
  "find-for-me",
);

describe("T56 strict Finder and consent boundaries (pure/source qualification)", () => {
  it.each([
    "maxPrice=100&maxPrice=",
    "maxPrice=abc",
    "maxPrice=0.001",
    "minPrice=200&maxPrice=100",
    "currency=USD",
    "seller=admin",
    "sellerId=" + id,
    "condition=fictional",
    "category=invalid",
    "attr.invented=yes",
    "handover=teleport",
    "availability=guaranteed",
    "lang=xx",
    "lang=en&lang=bg",
    "handover=pickup&handover=",
    "q=%20phone%20",
    "q=" + "x".repeat(121),
    "q=one+two+three+four+five+six+seven+eight+nine",
    "unsupported=",
    "cursor=" + "x".repeat(769),
  ])("refuses hard constraint repair for %s", (query) => {
    expect(() => parseToolIntent(query, "find-for-me")).toThrow(
      "INVALID_INPUT",
    );
  });
  it.each(["bg", "en"])(
    "round trips valid independent seller/condition criteria in %s",
    (lang) => {
      const input = parseToolIntent(
        "seller=business&condition=good&maxPrice=100,01&minPrice=0&handover=shipping&availability=known&lang=" +
          lang,
        "find-for-me",
      );
      expect(input.discovery).toMatchObject({
        seller: "business",
        condition: "good",
        minPriceMinor: 0,
        maxPriceMinor: 10001,
        currency: "EUR",
        locale: lang,
      });
      expect(
        parseToolIntent(toolParams(input).toString(), "find-for-me"),
      ).toEqual(input);
    },
  );
  it("forces Deal Finder item-price order and rejects a conflicting requested order", () => {
    expect(parseToolIntent("maxPrice=150", "deal-finder").discovery.sort).toBe(
      "price_asc",
    );
    expect(() => parseToolIntent("sort=newest", "deal-finder")).toThrow(
      "INVALID_INPUT",
    );
  });
  it("binds publication/price/stock query parameters without interpolating input", () => {
    const intent = parseToolIntent(
      "q=phone&seller=personal&condition=good&minPrice=100&maxPrice=200&handover=pickup&availability=known",
      "find-for-me",
    );
    const query = buildToolQuery(intent, null, {
      ids: [id],
      ceiling: "2026-10-04T00:00:00.000000Z",
    });
    expect(query.values).toEqual(
      expect.arrayContaining([
        "personal",
        "good",
        "pickup",
        "phone",
        10000,
        20000,
        [id],
        "2026-10-04T00:00:00.000000Z",
        21,
      ]),
    );
    expect(query.text).toContain("current_publication_revision");
    expect(query.text).toContain("stock.available>0 AND ip.mode IS NOT NULL");
    expect(query.text).not.toContain(id);
  });
  it("default save explicitly remains paused without consent", () => {
    expect(
      parseSearchCommand({
        ...envelope,
        operation: {
          kind: "save",
          name: "  Телефон   до 200  ",
          criteria,
          enable: false,
          frequency: 1440,
        },
      }).operation,
    ).toMatchObject({ name: "Телефон до 200", enable: false });
  });
  it.each([true, false])("consent boolean is explicit: %s", (enable) => {
    expect(
      parseSearchCommand({
        ...envelope,
        operation: {
          kind: "save",
          name: "Phone",
          criteria,
          enable,
          frequency: 60,
        },
      }).operation,
    ).toMatchObject({ enable });
  });
  it.each([
    { kind: "save", name: "Phone", criteria, frequency: 60 },
    { kind: "save", name: "Phone", criteria, enable: "true", frequency: 60 },
    { kind: "save", name: "Phone", criteria, enable: false, frequency: 1 },
    {
      kind: "save",
      name: "x".repeat(81),
      criteria,
      enable: false,
      frequency: 60,
    },
    { kind: "save", name: "x\n", criteria, enable: false, frequency: 60 },
    { kind: "pause", searchId: id, frequency: 60 },
    { kind: "remove", searchId: id, enable: true },
    { kind: "read", notificationIds: [id, id] },
    { kind: "read", notificationIds: [] },
  ])("rejects malformed or ambiguous operation %#", (operation) => {
    expect(() => parseSearchCommand({ ...envelope, operation })).toThrow(
      "INVALID_INPUT",
    );
  });
  it.each([-1, 0.5, 2147483647, "0"])(
    "refuses invalid revision %s",
    (expectedRevision) => {
      expect(() =>
        parseSearchCommand({
          ...envelope,
          expectedRevision,
          operation: { kind: "pause", searchId: id },
        }),
      ).toThrow("INVALID_INPUT");
    },
  );
  it("retains immutable historical criteria only for recovery parsing", () => {
    const historic = {
      ...criteria,
      registry: CATEGORY_REGISTRY_VERSION + 1,
      query: "unsupported=original",
    };
    const command = {
      ...envelope,
      operation: {
        kind: "save",
        name: "Original",
        criteria: historic,
        enable: false,
        frequency: 1440,
      },
    };
    expect(parseSearchCommand(command, true).operation).toEqual(
      command.operation,
    );
    expect(() => parseSearchCommand(command)).toThrow("INVALID_INPUT");
    expect(criteriaIntent(historic)).toBeNull();
  });
  it("refuses saving pagination as matching criteria", () => {
    expect(() => parseCriteria({ ...criteria, query: "cursor=valid" })).toThrow(
      "INVALID_INPUT",
    );
  });
  it.each([
    "//evil.test/minis",
    "https://evil.test/minis",
    "/minis/find-for-me?maxPrice=abc",
    "/minis/find-for-me?add=" + id,
    "/minis/compare#clear",
    "/minis/compare?lang=en&lang=bg",
  ])("safe sign-in continuation refuses %s", (value) => {
    expect(parseShoppingToolContinuation(value)).toBeNull();
  });
  it.each([
    "/minis/saved-searches?enable=true",
    "/minis/saved-searches?search=bad",
    "/minis/saved-searches?lang=en&lang=bg",
    "/minis/saved-searches#remove",
    "/minis/saved-searches/other",
  ])("saved-search URL never executes %s", (value) => {
    expect(parseSearchContinuation(value)).toBeNull();
  });
  it("permits only read-only saved-search continuation", () => {
    expect(
      parseSearchContinuation(
        "/minis/saved-searches?search=" + id + "&lang=en",
      ),
    ).toBe("/minis/saved-searches?lang=en&search=" + id);
  });
});

describe("T56 comparison frozen selection and current facts", () => {
  it("copies an exact bounded clear selection, independent of later input changes", () => {
    const selectionIds = [id];
    const parsed = parseComparisonCommand({
      ...envelope,
      operation: { kind: "clear", selectionIds },
    });
    selectionIds.push("00000000-0000-4000-8000-000000000002");
    expect(parsed.operation).toEqual({ kind: "clear", selectionIds: [id] });
  });
  it.each([[id, id], Array(5).fill(id), ["not-a-uuid"]])(
    "refuses duplicate/oversized/invalid frozen selection %#",
    (selectionIds) => {
      expect(() =>
        parseComparisonCommand({
          ...envelope,
          operation: { kind: "clear", selectionIds },
        }),
      ).toThrow("INVALID_INPUT");
    },
  );
  it("redacts unavailable publication comparison", () => {
    expect(
      comparisonChanges({
        id,
        position: 0,
        observedAt: "2026-10-04T00:00:00Z",
        observation: {
          listingId: id,
          publicationRevision: 2,
          skuId: null,
          priceMinor: 10000,
          stock: "unknown",
        },
        current: null,
      }),
    ).toEqual(["publicationUnavailable"]);
  });
  it("distinguishes publication, SKU, item price and stock changes", () => {
    const current = {
      card: { id, price: { amount: 9000 } },
      revision: 3,
      variant: { id },
      inventory: { state: "available" },
    } as ToolListing;
    expect(
      comparisonChanges({
        id,
        position: 0,
        observedAt: "2026-10-04T00:00:00Z",
        observation: {
          listingId: id,
          publicationRevision: 2,
          skuId: null,
          priceMinor: 10000,
          stock: "unknown",
        },
        current,
      }),
    ).toEqual([
      "publicationChanged",
      "variantChanged",
      "priceChanged",
      "stockChanged",
    ]);
  });
});

describe("T56 insights bounded factual reports/export", () => {
  const scope = { kind: "seller", sellerId: id } as const;
  const now = new Date("2026-10-04T12:00:00Z");
  it.each([
    { from: "2026-02-30" },
    { from: "2026-10-05" },
    { to: "2026-10-05" },
    { from: "2026-07-01" },
    { dataset: "report_backlog" },
    { page: "81" },
    { page: "1.5" },
    { sellerId: id },
    { lang: "xx" },
    { q: "x".repeat(81) },
  ])("refuses invalid/foreign/oversized query %#", (raw) => {
    expect(() => parseInsightQuery(raw, scope, now)).toThrow("INVALID_INPUT");
  });
  it("uses an inclusive whole-day date range", () => {
    expect(
      insightRange(
        parseInsightQuery({ from: "2026-10-03", to: "2026-10-04" }, scope, now),
      ),
    ).toEqual({
      from: "2026-10-03T00:00:00.000Z",
      until: "2026-10-05T00:00:00.000Z",
    });
  });
  const query = parseInsightQuery({ dataset: "stock", page: "2" }, scope, now);
  const context: InsightContext = {
    scope,
    sellerName: "Seller",
    actorKey,
    query,
    observedAt: now.toISOString(),
    basis: "snapshot",
    availableDatasets: ["stock"],
    formalStorage: true,
  };
  const rows: InsightRow[] = Array.from({ length: 30 }, (_, index) => ({
    id,
    resourceId: id,
    label: index ? "Owned" : '=HYPERLINK("https://evil.invalid")',
    status: "available",
    kind: "unique",
    at: "2026-10-04T00:00:00.000Z",
    href: "/app/sellers/" + id,
    reason: "",
    values: { available: index ? 1 : null },
  }));
  it("summarizes the complete bounded set while returning only the requested page", () => {
    const report = summarizeInsights(context, rows, false);
    expect(report).toMatchObject({
      total: 30,
      pages: 2,
      daily: [],
      statuses: [{ key: "available", count: 30 }],
    });
    expect(report.rows).toHaveLength(5);
    expect(report.values.find((value) => value.key === "available")).toEqual({
      key: "available",
      total: 29,
      known: 29,
      unknown: 1,
    });
  });
  it.each([NaN, -1, 0.5, Number.MAX_SAFE_INTEGER + 1])(
    "refuses fabricated unsafe numeric totals %s",
    (available) => {
      expect(() =>
        summarizeInsights(
          context,
          [{ ...rows[0], values: { available } }],
          true,
        ),
      ).toThrow("NOT_AVAILABLE");
    },
  );
  it("refuses invalid timestamps", () => {
    expect(() =>
      summarizeInsights(context, [{ ...rows[0], at: "invalid" }], true),
    ).toThrow(InsightError);
  });
  it.each(["bg", "en"] as const)(
    "exports safe source labels and explicit unknown counts in %s",
    (lang) => {
      const report = summarizeInsights(context, rows, true);
      const csv = insightsCsv(report, lang);
      expect(csv).toContain('text: =HYPERLINK(""https://evil.invalid"")');
      expect(csv).toContain("F17-v1");
      expect(csv.startsWith("\uFEFF")).toBe(true);
      expect(() => insightsCsv({ ...report, total: 1001 }, lang)).toThrow(
        "EXPORT_TOO_LARGE",
      );
      expect(() =>
        insightsCsv({ ...report, rows: report.rows.slice(0, 25) }, lang),
      ).toThrow("EXPORT_TOO_LARGE");
    },
  );
  it.each([
    "/ops/insights?dataset=reports&dataset=appeals",
    "/ops/insights?grant=admin",
    "//evil.test/ops/insights",
    "/app/sellers/foreign/insights",
  ])("refuses unsafe insights continuation %s", (value) => {
    expect(parseInsightsContinuation(value)).toBeNull();
  });
});
