import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({ locale: vi.fn(), headers: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: boundary.headers }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  },
}));
vi.mock("../locale/page-locale.server", () => ({
  pageLocale: boundary.locale,
}));
vi.mock("@/features/legal/page.server", async () => import("./page.server"));

import { LegalPage } from "./page.server";
import { legalDocuments, type LegalKind } from "./documents";
import PrivacyPage, {
  metadata as privacyMetadata,
} from "../../app/privacy/page";
import TermsPage, { metadata as termsMetadata } from "../../app/terms/page";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("TREIDO_ENV", "development");
  vi.stubEnv("TREIDO_APP_ORIGIN", "http://127.0.0.1:6419");
  for (const key of ["VERCEL", "VERCEL_ENV", "CI", "SHOP_REFERENCE_PREVIEW"])
    vi.stubEnv(key, "");
  vi.stubEnv("SHOP_REFERENCE_PREVIEW", "0");
  boundary.headers.mockResolvedValue(new Headers({ host: "127.0.0.1:6419" }));
  boundary.locale.mockImplementation(async (lang) => lang ?? "bg");
});
afterEach(() => vi.unstubAllEnvs());

describe("legal review routes", () => {
  it.each([
    ["privacy", "en"],
    ["privacy", "bg"],
    ["terms", "en"],
    ["terms", "bg"],
  ] as const)(
    "keeps owner-supplied names prospective in %s %s",
    (kind, lang) => {
      const document = legalDocuments[lang][kind];
      const text = document.sections[0].paragraphs.join(" ");
      expect(text).toContain("Valentin Radev, Antonia Nikolaeva");
      expect(text).toContain(
        lang === "en"
          ? "Owner-supplied prospective"
          : "Предоставени от собственика",
      );
      expect(text).toContain(
        lang === "en" ? "no company number" : "няма фирмен номер",
      );
      expect(document.status).toBe("draft");
      expect(document.sections[0].pending).toContain(
        lang === "en" ? "public" : "публич",
      );
      expect(document.sections[0].pending).toMatch(
        lang === "en" ? /contact|email/ : /контакт|имейл/,
      );
    },
  );
  it.each(["privacy", "terms"] as const)(
    "denies ordinary public %s without presenting a placeholder policy",
    async (kind) => {
      await expect(
        LegalPage({ kind, searchParams: Promise.resolve({ lang: "en" }) }),
      ).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
      expect(boundary.locale).not.toHaveBeenCalled();
    },
  );
  it.each(["privacy", "terms"] as const)(
    "denies production %s even with an explicit review query",
    async (kind) => {
      vi.stubEnv("TREIDO_ENV", "production");
      await expect(
        LegalPage({ kind, searchParams: Promise.resolve({ review: "1" }) }),
      ).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    },
  );
  it.each([
    ["privacy", "en"],
    ["privacy", "bg"],
    ["terms", "en"],
    ["terms", "bg"],
  ] as const)(
    "renders %s in %s as unapproved review with usable server links",
    async (kind, lang) => {
      const page = await LegalPage({
        kind,
        searchParams: Promise.resolve({ review: "1", lang }),
      });
      const html = renderToStaticMarkup(page);
      const document = legalDocuments[lang][kind];
      expect(html).toContain(`lang="${lang}"`);
      expect(html).toContain('data-legal-review="draft"');
      expect(html).toContain(`<h1>${document.title}</h1>`);
      expect(html).toContain(
        lang === "en"
          ? "not approved or published"
          : "не е одобрен или публикуван",
      );
      expect(html).toContain(`href="/?lang=${lang}"`);
      expect(html).toContain(
        `href="/${kind}?lang=${lang === "en" ? "bg" : "en"}&amp;review=1"`,
      );
      const other: LegalKind = kind === "privacy" ? "terms" : "privacy";
      expect(html).toContain(`href="/${other}?lang=${lang}&amp;review=1"`);
      expect(html.match(/class="account-panel"/g)).toHaveLength(
        document.sections.length,
      );
      for (const section of document.sections) {
        expect(section.pending.length).toBeGreaterThan(0);
        expect(html).toContain(section.title);
      }
      expect(html).not.toMatch(
        /shop\.app|shopify\.com|mailto:|<form|<fieldset/,
      );
    },
  );
  it("uses the shared locale resolver when no explicit language is supplied", async () => {
    const page = await LegalPage({
      kind: "privacy",
      searchParams: Promise.resolve({ review: "1" }),
    });
    expect(boundary.locale).toHaveBeenCalledWith(undefined);
    expect(page.props.lang).toBe("bg");
  });
  it("keeps both route compositions and metadata explicitly in review state", () => {
    const searchParams = Promise.resolve({ review: "1" });
    expect(PrivacyPage({ searchParams }).props.kind).toBe("privacy");
    expect(TermsPage({ searchParams }).props.kind).toBe("terms");
    for (const metadata of [privacyMetadata, termsMetadata]) {
      expect(metadata.robots).toEqual({ index: false, follow: false });
      expect(metadata.title).toContain("review");
      expect(metadata).not.toHaveProperty("alternates");
    }
  });
});
