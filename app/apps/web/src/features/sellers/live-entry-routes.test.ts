import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  reference: vi.fn(),
  catalog: vi.fn(),
  locale: vi.fn(),
  profile: vi.fn(),
  discovery: vi.fn(),
}));
vi.mock("../catalog/queries.server", () => ({
  readCatalog: state.catalog,
}));
vi.mock("../catalog/buyer-data-mode.server", () => ({
  readBuyerReferenceMode: state.reference,
}));
vi.mock("../catalog/buyer-entry.server", () => ({
  readBuyerPublicView: state.discovery,
}));
vi.mock("../account/public-profile.server", () => ({
  readPublicProfile: state.profile,
}));
vi.mock("../account/public-profile", () => ({
  PublishedProfile: "published-profile",
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
  state.profile.mockResolvedValue({ state: "guest" });
  state.discovery.mockResolvedValue({ input: { locale: "bg" } });
  state.locale.mockImplementation(async (lang) =>
    lang === "bg" ? "bg" : "en",
  );
});
it.each([
  [Login, "/sign-in?lang=bg"],
  [Onboarding, "/app/intent?lang=bg"],
] as const)(
  "routes the live entry to its current human flow",
  async (page, target) => {
    await expect(
      page({ searchParams: Promise.resolve({ lang: "bg" }) }),
    ).rejects.toThrow("redirect:" + target);
    expect(state.catalog).not.toHaveBeenCalled();
  },
);
it.each([
  [Profile, false],
  [Account, true],
] as const)(
  "renders the genuine profile with its current data",
  async (page, details) => {
    const query = { lang: "bg" };
    const result = await page({ searchParams: Promise.resolve(query) });
    expect(result.type).toBe("published-profile");
    expect(result.props.view).toEqual({ state: "guest" });
    expect(result.props.discovery).toEqual({ input: { locale: "bg" } });
    expect(result.props.details === true).toBe(details);
    expect(state.profile).toHaveBeenCalledOnce();
    expect(state.discovery).toHaveBeenCalledWith(query);
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
    expect(state.profile).not.toHaveBeenCalled();
    expect(state.discovery).not.toHaveBeenCalled();
  },
);
