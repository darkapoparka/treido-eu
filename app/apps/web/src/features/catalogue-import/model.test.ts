import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { existsSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseCsv, csvCell, csvDocument, CSV_COLUMNS } from "./csv";
import { validateImportRow, importCommand, type ImportView } from "./model";
import { parseWorkspaceContinuation } from "../sellers/workspace-continuation";
const navigation = vi.hoisted(() => ({ locale: "bg", actor: "test-seller" }));
vi.mock("next-intl", () => ({
  useLocale: () => navigation.locale,
  useTranslations: () => (key: string) => key,
}));
vi.mock("@clerk/nextjs", () => {
  const clerk = {
    user: { id: "test-seller" },
    session: { id: "navigation-session", status: "active" },
    addListener: () => () => {},
  };
  return {
    useClerk: () => clerk,
    useAuth: () => ({
      isLoaded: true,
      isSignedIn: true,
      userId: clerk.user.id,
      sessionId: clerk.session.id,
    }),
  };
});
vi.mock("next/navigation", () => ({
  usePathname: () =>
    "/app/sellers/10000000-0000-4000-8000-000000000001/imports/10000000-0000-4000-8000-000000000003",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("../messaging/use-inbox-refresh", () => ({
  useInboxRefresh: (initial: ImportView) => ({
    // This presentation-only unit receives an explicit accepted read. Actual
    // session/read qualification is exercised by the deferred browser packet.
    data: { ...initial },
    status: "ready",
    refresh: vi.fn(),
  }),
}));
vi.mock("./actions", () => ({
  readCatalogueImportAction: vi.fn(),
  changeCatalogueImportAction: vi.fn(),
  exportImportReportAction: vi.fn(),
}));
// The unit configuration deliberately has no Next @ alias. These exact page
// seams resolve its existing imports without changing application resolution.
vi.mock("@/features/locale/page-locale.server", () => ({
  pageLocale: async () => "en",
}));
vi.mock("@/features/sellers/backend-status.server", () => ({
  backendConfigured: () => true,
}));
vi.mock("@/features/sellers/workspace", () => ({
  BackendUnavailable: () => null,
}));
vi.mock("@/features/sellers/page-context.server", () => ({
  requirePageIdentity: async () => ({ subject: navigation.actor }),
  readPrivatePage: async (work: () => Promise<unknown>) => work(),
}));
vi.mock("@/server/db/database", () => ({ getDatabase: () => ({}) }));
vi.mock("@/features/catalogue-import/queries.server", () => ({
  readCatalogueImport: async (
    _database: unknown,
    _actor: unknown,
    input: { sellerId: string; importId: string; after: number },
  ) => ({ sellerId: input.sellerId, id: input.importId, after: input.after }),
}));
vi.mock("@/features/catalogue-import/detail", async () => import("./detail"));
import { CatalogueImportDetail } from "./detail";
import ImportPage from "../../app/app/sellers/[sellerId]/imports/[importId]/page";
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
beforeEach(() => {
  vi.stubGlobal("document", { visibilityState: "visible" });
  vi.stubGlobal("location", {
    pathname:
      "/app/sellers/10000000-0000-4000-8000-000000000001/imports/10000000-0000-4000-8000-000000000003",
    search: "",
  });
});
afterEach(() => vi.unstubAllGlobals());
describe("private import page editor ownership", () => {
  const sellerId = "10000000-0000-4000-8000-000000000001",
    importId = "10000000-0000-4000-8000-000000000003";
  const renderPage = async (
    after: string,
    seller = sellerId,
    id = importId,
    actor = "route-human",
  ) => {
    navigation.actor = actor;
    return ImportPage({
      params: Promise.resolve({ sellerId: seller, importId: id }),
      searchParams: Promise.resolve({ lang: "en", after }),
    });
  };
  it("keeps the same actual editor instance across same-import pagination", async () => {
    const first = await renderPage("0"),
      next = await renderPage("1"),
      back = await renderPage("0");
    expect(next.type).toBe(first.type);
    expect(next.key).toBe(first.key);
    expect(back.key).toBe(first.key);
    expect(first.props.initial.after).toBe(0);
    expect(next.props.initial.after).toBe(1);
  });
  it.each(["seller", "import", "human"])(
    "remounts the actual editor for a changed %s owner",
    async (owner) => {
      const first = await renderPage("0");
      const next = await renderPage(
        "0",
        owner === "seller" ? "20000000-0000-4000-8000-000000000001" : sellerId,
        owner === "import" ? "20000000-0000-4000-8000-000000000003" : importId,
        owner === "human" ? "another-human" : "route-human",
      );
      expect(next.key).not.toBe(first.key);
    },
  );
});
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
