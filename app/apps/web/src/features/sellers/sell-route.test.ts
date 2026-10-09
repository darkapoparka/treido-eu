import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  configured: vi.fn(),
  identity: vi.fn(),
  sellers: vi.fn(),
  database: vi.fn(),
  locale: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error("redirect:" + path);
  },
  notFound: () => {
    throw new Error("not-found");
  },
}));
vi.mock("@clerk/nextjs", () => ({ ClerkProvider: "clerk-provider" }));
vi.mock("@/features/locale/page-locale.server", () => ({
  pageLocale: state.locale,
}));
vi.mock("@/features/locale/clerk-localization.server", () => ({
  clerkLocalization: async () => ({}),
}));
vi.mock("@/features/sellers/backend-status.server", () => ({
  backendConfigured: state.configured,
}));
vi.mock("@/features/sellers/page-context.server", async () => ({
  ...(await import("./page-context.server")),
  requirePageIdentity: state.identity,
}));
vi.mock("@/features/sellers/persistence.server", () => ({
  listOwnedSellers: state.sellers,
}));
vi.mock("@/server/db/database", () => ({ getDatabase: state.database }));
vi.mock("@/features/sellers/workspace", () => ({ Workspace: "workspace" }));
vi.mock("@/features/selling/draft-editor", () => ({
  DraftEditor: "draft-editor",
}));
vi.mock("@/features/selling/selling-form", () => ({
  SellingForm: "selling-preparation",
}));
vi.mock(
  "@/features/selling/draft-model",
  async () => await import("../selling/draft-model"),
);
vi.mock("../../server/identity/clerk.server", () => ({
  readVerifiedIdentity: vi.fn(),
}));

import SellPage from "../../app/sell/page";
import { SellerError } from "./errors";

const actor = { subject: "synthetic-sell-entry-human" };
const database = { adapter: "isolated-route-test" };
const sellerId = "10000000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.resetAllMocks();
  state.configured.mockReturnValue(true);
  state.identity.mockResolvedValue(actor);
  state.sellers.mockResolvedValue([]);
  state.database.mockReturnValue(database);
  state.locale.mockImplementation(async (lang) =>
    lang === "bg" ? "bg" : "en",
  );
});

describe("actual personal Sell entry route (synthetic session/data boundaries)", () => {
  it("keeps the original direct editor for a verified human with no personal seller", async () => {
    const result = await SellPage({
      searchParams: Promise.resolve({ lang: "bg" }),
    });
    const workspace = result.props.children;
    const editor = workspace.props.children;
    expect(result.type).toBe("clerk-provider");
    expect(workspace.type).toBe("workspace");
    expect(workspace.props.title).toBe("Продай артикул");
    expect(editor.type).toBe("draft-editor");
    expect(editor.props.sellerId).toBeNull();
    expect(editor.props.actorSubject).toBe(actor.subject);
    expect(editor.props.language).toBe("bg");
    expect(state.sellers).toHaveBeenCalledExactlyOnceWith(database, actor);
    expect(state.identity).toHaveBeenCalledWith("/sell?lang=bg");
  });
  it("defaults to personal selling even when the human also owns a business", async () => {
    state.sellers.mockResolvedValue([
      { sellerId: "20000000-0000-4000-8000-000000000002", kind: "business" },
      { sellerId, kind: "personal" },
    ]);
    await expect(
      SellPage({ searchParams: Promise.resolve({ lang: "en" }) }),
    ).rejects.toThrow(`redirect:/app/sellers/${sellerId}/listings/new?lang=en`);
  });
  it("continues an explicit business intent without reading or creating a seller", async () => {
    await expect(
      SellPage({
        searchParams: Promise.resolve({ intent: "business", lang: "bg" }),
      }),
    ).rejects.toThrow("redirect:/app/onboarding?lang=bg");
    expect(state.identity).toHaveBeenCalledWith(
      "/sell?intent=business&lang=bg",
    );
    expect(state.database).not.toHaveBeenCalled();
    expect(state.sellers).not.toHaveBeenCalled();
  });
  it("stops at verified sign-in before reading any personal seller", async () => {
    state.identity.mockRejectedValue(new Error("redirect:verified-sign-in"));
    await expect(
      SellPage({ searchParams: Promise.resolve({ lang: "bg" }) }),
    ).rejects.toThrow("redirect:verified-sign-in");
    expect(state.database).not.toHaveBeenCalled();
    expect(state.sellers).not.toHaveBeenCalled();
  });
  it("uses the established unavailable boundary when the actual personal-seller read fails", async () => {
    state.sellers.mockRejectedValue(
      new Error("SYNTHETIC private adapter failure detail"),
    );
    await expect(
      SellPage({ searchParams: Promise.resolve({ lang: "en" }) }),
    ).rejects.toThrow(/^Selling is temporarily unavailable\.$/);
  });
  it("uses the current-human denial boundary instead of treating a restricted account as a new seller", async () => {
    state.sellers.mockRejectedValue(new SellerError("FORBIDDEN"));
    await expect(
      SellPage({ searchParams: Promise.resolve({ lang: "bg" }) }),
    ).rejects.toThrow("not-found");
  });
});
