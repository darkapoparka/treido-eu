import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  reference: vi.fn(),
  catalog: vi.fn(),
  locale: vi.fn(),
}));
vi.mock("../catalog/queries.server", () => ({
  referencePreviewEnabled: state.reference,
  readCatalog: state.catalog,
}));
vi.mock("../locale/page-locale.server", () => ({ pageLocale: state.locale }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error("redirect:" + path);
  },
}));
vi.mock("../account/pages", () => ({
  AccountDetails: "account",
  ProfilePage: "profile",
}));
vi.mock("../account/support", () => ({
  LoginPage: "login",
  OnboardingPage: "onboarding",
}));
import Login from "../../app/login/page";
import Onboarding from "../../app/onboarding/page";
import Profile from "../../app/profile/page";
import Account from "../../app/account/page";

beforeEach(() => {
  vi.resetAllMocks();
  state.reference.mockReturnValue(false);
  state.catalog.mockResolvedValue({});
  state.locale.mockImplementation(async (lang) =>
    lang === "bg" ? "bg" : "en",
  );
});
it.each([
  [Login, "/sign-in?lang=bg"],
  [Onboarding, "/app/intent?lang=bg"],
  [Profile, "/account/privacy/preferences?lang=bg"],
  [Account, "/account/privacy/preferences?lang=bg"],
] as const)(
  "routes the live entry to its current human flow",
  async (page, target) => {
    await expect(
      page({ searchParams: Promise.resolve({ lang: "bg" }) }),
    ).rejects.toThrow("redirect:" + target);
    expect(state.catalog).not.toHaveBeenCalled();
  },
);
it("keeps login continuation inside the real authentication entry", async () => {
  const target = "/sell?intent=business&lang=bg";
  await expect(
    Login({ searchParams: Promise.resolve({ lang: "en", returnTo: target }) }),
  ).rejects.toThrow(
    "redirect:/sign-in?lang=en&returnTo=" + encodeURIComponent(target),
  );
  await expect(
    Login({
      searchParams: Promise.resolve({
        lang: "en",
        returnTo: "https://outside.invalid",
      }),
    }),
  ).rejects.toThrow("redirect:/sign-in?lang=en");
});
it.each([Login, Onboarding, Profile, Account])(
  "retains the original reference entry",
  async (page) => {
    state.reference.mockReturnValue(true);
    const result = await page({
      searchParams: Promise.resolve({ lang: "bg" }),
    });
    expect(result).toBeTruthy();
    expect(state.catalog).toHaveBeenCalledOnce();
    expect(state.locale).not.toHaveBeenCalled();
  },
);
