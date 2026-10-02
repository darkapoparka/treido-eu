import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  configured: vi.fn(),
  locale: vi.fn(),
  translate: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs", () => ({
  ClerkProvider: "clerk-provider",
  SignIn: "sign-in",
  SignUp: "sign-up",
}));
vi.mock("./backend-status.server", () => ({
  backendConfigured: mock.configured,
}));
vi.mock("../locale/page-locale.server", () => ({ pageLocale: mock.locale }));
vi.mock("next-intl/server", () => ({ getTranslations: mock.translate }));
vi.mock("./workspace", () => ({
  BackendUnavailable: "unavailable",
  Workspace: "workspace",
}));
import { AuthenticationPage } from "./authentication-page";
beforeEach(() => {
  vi.resetAllMocks();
  mock.configured.mockReturnValue(false);
  mock.locale.mockImplementation(async (explicit) => explicit ?? "en");
  mock.translate.mockResolvedValue((key: string) => key);
});
describe("localized real authentication entry", () => {
  it("renders the unavailable state in the explicit language", async () => {
    const page = await AuthenticationPage({
      mode: "sign-in",
      searchParams: Promise.resolve({ lang: "bg" }),
    });
    expect(page.props.language).toBe("bg");
    expect(mock.locale).toHaveBeenCalledWith("bg");
  });
  it("honors a language carried by an already validated selling continuation", async () => {
    await AuthenticationPage({
      mode: "sign-in",
      searchParams: Promise.resolve({
        returnTo: "/sell?intent=business&lang=bg",
      }),
    });
    expect(mock.locale).toHaveBeenCalledWith("bg");
  });
  it("keeps explicit English across the widget links and post-login destination", async () => {
    mock.configured.mockReturnValue(true);
    const page = await AuthenticationPage({
      mode: "sign-in",
      searchParams: Promise.resolve({
        lang: "en",
        returnTo: "/sell?intent=business&lang=bg",
      }),
    });
    expect(page.props.signInForceRedirectUrl).toBe(
      "/sell?intent=business&lang=en",
    );
    expect(page.props.signUpForceRedirectUrl).toBe(
      page.props.signInForceRedirectUrl,
    );
    for (const href of [page.props.signInUrl, page.props.signUpUrl]) {
      const link = new URL(href, "https://treido.invalid");
      expect(link.searchParams.get("lang")).toBe("en");
      expect(link.searchParams.get("returnTo")).toBe(
        page.props.signInForceRedirectUrl,
      );
    }
    expect(page.props.localization.locale).toBe("en-US");
    expect(page.props.children.props.language).toBe("en");
    expect(page.props.children.props.back).toBe("/sell?lang=en");
    expect(mock.translate).toHaveBeenCalledWith({
      locale: "en",
      namespace: "accountUI",
    });
  });
  it("uses the saved request language for direct signup and retains the intent step", async () => {
    mock.configured.mockReturnValue(true);
    mock.locale.mockResolvedValue("bg");
    const page = await AuthenticationPage({
      mode: "sign-up",
      searchParams: Promise.resolve({}),
    });
    expect(page.props.signUpForceRedirectUrl).toBe("/app/intent?lang=bg");
    expect(page.props.localization.locale).toBe("bg-BG");
    expect(page.props.children.props.title).toBe("createYourTreidoAccount");
  });
  it.each([
    "https://outside.invalid/?lang=bg",
    "//outside.invalid",
    "/app?lang=bg&role=owner",
    "/api/preferences?lang=bg",
  ])(
    "does not use an unvalidated return target for language or navigation: %s",
    async (returnTo) => {
      mock.configured.mockReturnValue(true);
      const page = await AuthenticationPage({
        mode: "sign-in",
        searchParams: Promise.resolve({ returnTo }),
      });
      expect(page.props.signInForceRedirectUrl).toBe("/app?lang=en");
      expect(mock.locale).toHaveBeenCalledWith(null);
    },
  );
});
