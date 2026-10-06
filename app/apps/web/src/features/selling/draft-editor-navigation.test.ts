import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyDraft, type DraftView } from "./draft-model";

const state = vi.hoisted(() => ({ notice: null as string | null, slot: 0 }));
vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  return {
    ...actual,
    // Seed the editor's save-result notice without performing a private mutation.
    useState: (initial: unknown) => {
      const slot = state.slot++;
      return actual.useState(
        slot === 3 && state.notice ? state.notice : initial,
      );
    },
  };
});
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true, userId: "human-test" }),
  useClerk: () => ({ user: { id: "human-test" } }),
}));
vi.mock("../sellers/actions", () => ({ persistDraftAction: vi.fn() }));
vi.mock("../sellers/admin-draft-form", () => ({ AdminDraftForm: () => null }));
vi.mock("./category-picker", () => ({ CategoryPicker: () => null }));
vi.mock("./attribute-fields", () => ({ AttributeFields: () => null }));
vi.mock("./media-picker", () => ({ MediaPicker: () => null }));
import { DraftEditor } from "./draft-editor";
import { parseSellContinuation } from "../sellers/sell-entry";

const sellerId = "10000000-0000-4000-8000-000000000001";
const draftId = "10000000-0000-4000-8000-000000000002";
const saved: DraftView = {
  id: draftId,
  sellerId,
  revision: 1,
  updatedAt: "2026-10-06T00:00:00.000Z",
  payload: { ...emptyDraft, title: "Private draft" },
};
const cases = [
  ["bg", false],
  ["bg", true],
  ["en", false],
  ["en", true],
] as const;
function anchors(language: "bg" | "en", isSaved: boolean) {
  const markup = renderToStaticMarkup(
    createElement(DraftEditor, {
      initial: isSaved ? saved : emptyDraft,
      sellerId,
      requestId: "10000000-0000-4000-8000-000000000003",
      language,
      bufferKey: "test-draft",
      actorSubject: "human-test",
    }),
  );
  return [
    ...markup.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g),
  ].map(([, href, label]) => ({ href: href.replaceAll("&amp;", "&"), label }));
}
beforeEach(() => {
  state.notice = null;
  state.slot = 0;
});
describe("draft editor locale navigation", () => {
  it.each(cases)(
    "keeps %s on My selling from saved=%s",
    (language, isSaved) => {
      const links = anchors(language, isSaved);
      const label = language === "bg" ? "Моите продажби" : "My selling";
      expect(links.find((link) => link.label === label)?.href).toBe(
        `/app?lang=${language}`,
      );
    },
  );
  it.each(cases)(
    "keeps %s and exact draft identity in recovery from saved=%s",
    (language, isSaved) => {
      state.notice = "UNAUTHENTICATED";
      const links = anchors(language, isSaved);
      const href = links.find(
        (link) => link.label === (language === "bg" ? "Вход" : "Sign in"),
      )?.href;
      expect(href).toBeDefined();
      const signIn = new URL(href!, "https://treido.invalid");
      const target = signIn.searchParams.get("returnTo");
      const path = isSaved
        ? `/app/sellers/${sellerId}/listings/${draftId}/edit`
        : "/sell";
      expect(signIn.pathname).toBe("/sign-in");
      expect(target).toBe(`${path}?lang=${language}`);
      expect(parseSellContinuation(target)).toEqual({
        ok: true,
        continuation: {
          intent: isSaved
            ? { kind: "edit_draft", sellerId, draftId }
            : { kind: "personal" },
          language,
          target: `${path}?lang=${language}`,
        },
      });
    },
  );
});
