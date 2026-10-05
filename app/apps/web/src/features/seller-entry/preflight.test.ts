import { describe, it, expect } from "vitest";
import {
  CSV_COLUMNS,
  CSV_LIMITS,
  csvDocument,
  type CsvRow,
} from "../catalogue-import/csv";
import { inspectSellerCsv, sellerCsvIssueReport } from "./preflight";
const row: CsvRow = {
  external_id: "phone-1",
  title: "Телефон",
  description: 'Описание, с "кавычки"\nВтори ред',
  category_id: "cat:electronics/phones",
  condition: "good",
  price: "129,50",
  currency: "EUR",
  locality: "София",
  attributes_json: JSON.stringify({
    brand: "Example",
    model: "One",
    storageGB: 128,
    workingStatus: "working",
  }),
  inventory_mode: "stocked",
  quantity: "3",
  sku: "PHONE-1",
  options_json: '{"Color":"Blue"}',
};
const bytes = (rows: CsvRow[]) =>
  new TextEncoder().encode(
    csvDocument(
      CSV_COLUMNS,
      rows.map((r) => CSV_COLUMNS.map((key) => r[key] ?? "")),
    ),
  );
describe("seller catalogue preparation without uploads or account mutations", () => {
  it("uses real import rules and preserves Bulgarian, quoted multiline descriptions and decimal commas", () => {
    const checked = inspectSellerCsv(bytes([row]));
    expect(checked).toMatchObject({
      valid: 1,
      invalid: 0,
      rows: [
        {
          number: 1,
          errors: [],
          payload: {
            priceMinor: 12950,
            title: "Телефон",
            fields: { storageGB: "128" },
          },
          inventory: { quantity: 3 },
        },
      ],
    });
    expect(checked.rows[0].raw.description).toBe(row.description);
  });
  it("rejects every duplicate external ID, including normalized padded IDs", () => {
    const checked = inspectSellerCsv(
      bytes([
        row,
        { ...row, external_id: " phone-1 " },
        { ...row, external_id: "phone-2" },
      ]),
    );
    expect(checked).toMatchObject({ valid: 1, invalid: 2 });
    for (const r of checked.rows.slice(0, 2))
      expect(r).toMatchObject({
        payload: null,
        inventory: null,
        errors: [{ field: "external_id", code: "duplicate_external_id" }],
      });
    expect(checked.rows[2].errors).toEqual([]);
  });
  it.each([
    { currency: "USD" },
    { category_id: "cat:electronics" },
    { attributes_json: '{"storageGB":"invalid"}' },
    { price: "1.234" },
    { inventory_mode: "unique", quantity: "2" },
    { title: "" },
  ])("retains the original row and explains invalid input %j", (change) => {
    const checked = inspectSellerCsv(bytes([{ ...row, ...change }]));
    expect(checked.valid).toBe(0);
    expect(checked.invalid).toBe(1);
    expect(checked.rows[0].errors.length).toBeGreaterThan(0);
    expect(checked.rows[0].payload).toBeNull();
  });
  it("distinguishes missing inventory from invented zero availability", () => {
    const checked = inspectSellerCsv(
      bytes([
        { ...row, inventory_mode: "", quantity: "", sku: "", options_json: "" },
      ]),
    );
    expect(checked.valid).toBe(1);
    expect(checked.rows[0].inventory).toBeNull();
  });
  it("rejects unsupported encoding and oversized bytes before CSV parsing", () => {
    expect(() => inspectSellerCsv(new Uint8Array([0xc3, 0x28]))).toThrow(
      "invalid_encoding",
    );
    expect(() =>
      inspectSellerCsv(new Uint8Array(CSV_LIMITS.bytes + 1)),
    ).toThrow("file_too_large");
  });
  it("requires actual rows and applies the existing row and column limits", () => {
    expect(() => inspectSellerCsv(bytes([]))).toThrow("empty_file");
    expect(() =>
      inspectSellerCsv(
        bytes(
          Array.from({ length: 1001 }, (_, i) => ({
            ...row,
            external_id: "p-" + i,
          })),
        ),
      ),
    ).toThrow("too_many_rows");
    expect(() =>
      inspectSellerCsv(new TextEncoder().encode("title,title\na,b")),
    ).toThrow("invalid_columns");
  });
  it("exports only issue coordinates and IDs, not descriptions or private row payloads", () => {
    const checked = inspectSellerCsv(bytes([{ ...row, title: "" }]));
    const report = sellerCsvIssueReport(checked);
    expect(report).toContain('"row","external_id","field","code"');
    expect(report).toContain('"1","phone-1","title","required"');
    expect(report).not.toContain("Описание");
    expect(report).not.toContain("storageGB");
  });
  it("neutralizes spreadsheet formulas in report identifiers", () => {
    const checked = inspectSellerCsv(bytes([{ ...row, title: "" }]));
    checked.rows[0].externalId = '=HYPERLINK("https://example.invalid")';
    expect(sellerCsvIssueReport(checked)).toContain("\"'=HYPERLINK");
  });
});
