import { describe, it, expect, vi } from "vitest";
import { existsSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseCsv, csvCell, csvDocument, CSV_COLUMNS } from "./csv";
import { validateImportRow, importCommand, type ImportView } from "./model";
import { parseWorkspaceContinuation } from "../sellers/workspace-continuation";
const navigation = vi.hoisted(() => ({ locale: "bg" }));
vi.mock("next-intl", () => ({
  useLocale: () => navigation.locale,
  useTranslations: () => (key: string) => key,
}));
vi.mock("@clerk/nextjs", () => ({ useClerk: () => ({ user: null }) }));
vi.mock("../messaging/use-inbox-refresh", () => ({
  useInboxRefresh: (initial: ImportView) => ({
    data: initial,
    status: "ready",
    refresh: vi.fn(),
  }),
}));
vi.mock("./actions", () => ({
  readCatalogueImportAction: vi.fn(),
  changeCatalogueImportAction: vi.fn(),
  exportImportReportAction: vi.fn(),
}));
import { CatalogueImportDetail } from "./detail";
const row = {
  external_id: "phone-1",
  title: "Телефон",
  description: 'Ред първи\nРед втори, с "кавычки"',
  category_id: "cat:electronics/phones",
  condition: "good",
  price: "129.50",
  currency: "EUR",
  locality: "София",
  attributes_json: JSON.stringify({
    brand: "Apple",
    model: "iPhone",
    storageGB: 128,
    workingStatus: "working",
  }),
  inventory_mode: "stocked",
  quantity: "3",
  sku: "PHONE-1",
  options_json: '{"Color":"Blue"}',
};
describe("imported draft navigation", () => {
  it.each(["bg", "en"])(
    "opens the created draft at the existing editor route in %s",
    (locale) => {
      navigation.locale = locale;
      const sellerId = "10000000-0000-4000-8000-000000000001";
      const draftId = "10000000-0000-4000-8000-000000000002";
      const initial: ImportView = {
        id: "10000000-0000-4000-8000-000000000003",
        sellerId,
        name: "Seller-uploaded catalogue.csv",
        state: "completed",
        revision: 1,
        total: 1,
        created: 1,
        ready: 0,
        invalid: 0,
        selected: 0,
        error: null,
        createdAt: "2026-10-05T00:00:00.000Z",
        rows: [
          {
            ...validateImportRow(row, 1),
            selected: false,
            state: "created",
            listingId: draftId,
          },
        ],
        after: 0,
        nextAfter: null,
        rowLimit: 1000,
        draftsRemaining: 10,
        canManage: true,
        uploaded: [0],
        sourceBytes: 100,
        sourceHash: "a".repeat(64),
      };
      const markup = renderToStaticMarkup(
        createElement(CatalogueImportDetail, {
          initial,
          actorSubject: "test-seller",
        }),
      );
      const base = `/app/sellers/${sellerId}/listings/${draftId}`;
      expect(markup).toContain(`href="${base}/edit?lang=${locale}"`);
      expect(markup).not.toContain(`href="${base}?lang=${locale}"`);
      expect(
        existsSync(
          new URL(
            "../../app/app/sellers/[sellerId]/listings/[draftId]/edit/page.tsx",
            import.meta.url,
          ),
        ),
      ).toBe(true);
    },
  );
});
describe("business CSV parsing and row contracts", () => {
  it("round trips Bulgarian, quoted commas, escaped quotes, BOM and multiline fields", () => {
    const csv = csvDocument(CSV_COLUMNS, [
      CSV_COLUMNS.map((key) => row[key as keyof typeof row] ?? ""),
    ]);
    expect(parseCsv(csv)).toEqual([row]);
    expect(validateImportRow(row, 1)).toMatchObject({
      errors: [],
      payload: { priceMinor: 12950, fields: { storageGB: "128" } },
      inventory: { quantity: 3, options: { Color: "Blue" } },
    });
  });
  it("keeps omitted stock unknown and rejects unsupported currency, root categories and invalid typed attributes", () => {
    const plain = {
      ...row,
      inventory_mode: "",
      quantity: "",
      sku: "",
      options_json: "",
    };
    expect(validateImportRow(plain, 1).inventory).toBeNull();
    for (const change of [
      { currency: "USD" },
      { category_id: "cat:electronics" },
      { attributes_json: '{"storageGB":"invalid"}' },
      { quantity: "-1" },
      { inventory_mode: "unique", quantity: "2" },
      { price: "1.234" },
    ])
      expect(
        validateImportRow({ ...row, ...change }, 1).errors.length,
      ).toBeGreaterThan(0);
  });
  it("rejects malformed, duplicate or unsupported columns and bounded inputs", () => {
    for (const value of [
      "title,title\na,b",
      'external_id,title,category_id,condition,price,currency\n"unterminated',
      "external_id,title,category_id,condition,price,currency\nx,x,x,x,1,EUR,extra",
      'external_id,title,category_id,condition,price,currency\n"x"bad,x,x,x,1,EUR',
    ])
      expect(() => parseCsv(value)).toThrow();
    expect(() => parseCsv("x".repeat(24001))).toThrow();
    expect(() =>
      parseCsv(
        "external_id,title,category_id,condition,price,currency\n" +
          Array(1001).fill("x,x,x,x,1,EUR").join("\n"),
      ),
    ).toThrow("too_many_rows");
  });
  it("neutralizes spreadsheet formulas without treating seller text as code", () => {
    for (const value of ["=SUM(1,2)", "  +CMD", "@SUM", "-10", "\t=CMD"])
      expect(csvCell(value)).toMatch(/^"'/);
    expect(csvCell('Ordinary "title"')).toBe('"Ordinary ""title"""');
  });
  it("validates explicit selection bounds and private continuations", () => {
    const sellerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      importId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      base = {
        sellerId,
        importId,
        expectedRevision: 1,
        requestId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      };
    expect(
      importCommand({ ...base, operation: { kind: "choose_valid", count: 25 } })
        .operation,
    ).toEqual({ kind: "choose_valid", count: 25 });
    expect(() =>
      importCommand({
        ...base,
        operation: { kind: "select", rows: [1, 1], selected: true },
      }),
    ).toThrow();
    expect(
      parseWorkspaceContinuation(
        "/app/sellers/" + sellerId + "/imports/" + importId + "?lang=bg",
      ),
    ).toContain(importId);
    expect(
      parseWorkspaceContinuation(
        "/app/sellers/" + sellerId + "/inventory?lang=en",
      ),
    ).toContain("inventory");
    expect(
      parseWorkspaceContinuation(
        "/app/sellers/" + sellerId + "/imports/foreign",
      ),
    ).toBeNull();
  });
});
