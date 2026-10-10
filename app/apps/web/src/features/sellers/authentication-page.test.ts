import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  vi.stubEnv("TREIDO_APP_ORIGIN", "http://127.0.0.1:6419");
});
afterEach(() => vi.unstubAllEnvs());
describe("localized real authentication entry", () => {
  it.each(
    (["sign-in", "sign-up"] as const).flatMap((mode) =>
      ["/profile?lang=en", "/account?lang=bg"].flatMap((target) =>
        ["returnTo", "callback"].map((source) => ({ mode, target, source })),
      ),
    ),
  )(
    "preserves $target through the $mode widget and links from $source",
    async ({ mode, target, source }) => {
      mock.configured.mockReturnValue(true);
      const language = new URL(
        target,
        "https://treido.invalid",
      ).searchParams.get("lang");
      const page = await AuthenticationPage({
        mode,
        searchParams: Promise.resolve(
          source === "returnTo"
            ? { returnTo: target }
            : {
                [`${mode.replace("-", "_")}_force_redirect_url`]: `http://127.0.0.1:6419${target}`,
              },
        ),
      });
      expect(page.props.signInForceRedirectUrl).toBe(target);
      expect(page.props.signUpForceRedirectUrl).toBe(target);
      expect(page.props.children.props.children.props.forceRedirectUrl).toBe(
        target,
      );
      expect(page.props.children.props.back).toBe(target);
      expect(page.props.children.props.language).toBe(language);
      expect(mock.locale).toHaveBeenCalledWith(language);
      for (const href of [
        page.props.signInUrl,
        page.props.signUpUrl,
        mode === "sign-in"
          ? page.props.children.props.children.props.signUpUrl
          : page.props.children.props.children.props.signInUrl,
      ]) {
        const link = new URL(href, "https://treido.invalid");
        expect(link.searchParams.get("lang")).toBe(language);
        expect(link.searchParams.get("returnTo")).toBe(target);
      }
    },
  );
  it.each(["/profile", "/account"])(
    "retains explicit language precedence for %s",
    async (path) => {
      mock.configured.mockReturnValue(true);
      const page = await AuthenticationPage({
        mode: "sign-in",
        searchParams: Promise.resolve({
          returnTo: `${path}?lang=bg`,
          lang: "en",
          sign_in_force_redirect_url:
            "http://127.0.0.1:6419/app/intent?lang=bg",
        }),
      });
      expect(page.props.signInForceRedirectUrl).toBe(`${path}?lang=en`);
      expect(page.props.children.props.back).toBe(`${path}?lang=en`);
    },
  );
  it.each(["/profile", "/account"])(
    "keeps untrusted account continuations on the safe fallback for %s",
    async (path) => {
      mock.configured.mockReturnValue(true);
      for (const target of [
        `${path}?lang=bg&role=owner`,
        `/untrusted/..${path}?lang=bg`,
        `${path}?lang=bg&lang=en`,
        `${path}#save`,
      ]) {
        for (const params of [
          { returnTo: target },
          { sign_in_force_redirect_url: `http://127.0.0.1:6419${target}` },
        ]) {
          const page = await AuthenticationPage({
            mode: "sign-in",
            searchParams: Promise.resolve(params),
          });
          expect(page.props.signInForceRedirectUrl).toBe("/app?lang=en");
        }
      }
      const foreign = await AuthenticationPage({
        mode: "sign-in",
        searchParams: Promise.resolve({
          sign_in_force_redirect_url: `https://outside.invalid${path}?lang=bg`,
        }),
      });
      expect(foreign.props.signInForceRedirectUrl).toBe("/app?lang=en");
    },
  );
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
  it.each(["sign-in", "sign-up"] as const)(
    "retains the validated Bulgarian OAuth callback target on %s",
    async (mode) => {
      mock.configured.mockReturnValue(true);
      const page = await AuthenticationPage({
        mode,
        searchParams: Promise.resolve({
          [`${mode.replace("-", "_")}_force_redirect_url`]:
            "http://127.0.0.1:6419/app/intent?lang=bg",
        }),
      });
      expect(page.props.signInForceRedirectUrl).toBe("/app/intent?lang=bg");
      expect(page.props.signUpForceRedirectUrl).toBe("/app/intent?lang=bg");
      expect(page.props.localization.locale).toBe("bg-BG");
      expect(page.props.children.props.children.props.forceRedirectUrl).toBe(
        "/app/intent?lang=bg",
      );
      for (const href of [page.props.signInUrl, page.props.signUpUrl]) {
        const link = new URL(href, "https://treido.invalid");
        expect(link.searchParams.get("lang")).toBe("bg");
        expect(link.searchParams.get("returnTo")).toBe("/app/intent?lang=bg");
      }
    },
  );
  it("prefers an explicit valid returnTo and language over callback parameters", async () => {
    mock.configured.mockReturnValue(true);
    const page = await AuthenticationPage({
      mode: "sign-in",
      searchParams: Promise.resolve({
        returnTo: "/sell?intent=business&lang=bg",
        lang: "en",
        sign_in_force_redirect_url: "http://127.0.0.1:6419/app/intent?lang=bg",
      }),
    });
    expect(page.props.signInForceRedirectUrl).toBe(
      "/sell?intent=business&lang=en",
    );
  });
  it("lets an explicit language override the callback language", async () => {
    mock.configured.mockReturnValue(true);
    const page = await AuthenticationPage({
      mode: "sign-up",
      searchParams: Promise.resolve({
        lang: "en",
        sign_up_force_redirect_url: "http://127.0.0.1:6419/app/intent?lang=bg",
      }),
    });
    expect(page.props.signUpForceRedirectUrl).toBe("/app/intent?lang=en");
  });
  it("discards invalid returnTo before considering a validated callback", async () => {
    mock.configured.mockReturnValue(true);
    const page = await AuthenticationPage({
      mode: "sign-in",
      searchParams: Promise.resolve({
        returnTo: "https://outside.invalid/app?lang=en",
        sign_in_force_redirect_url: "http://127.0.0.1:6419/app/intent?lang=bg",
      }),
    });
    expect(page.props.signInForceRedirectUrl).toBe("/app/intent?lang=bg");
  });
  it("does not recover callback URLs without an explicit configured origin", async () => {
    vi.stubEnv("TREIDO_APP_ORIGIN", "");
    mock.configured.mockReturnValue(true);
    const page = await AuthenticationPage({
      mode: "sign-in",
      searchParams: Promise.resolve({
        sign_in_force_redirect_url: "http://127.0.0.1:6419/app/intent?lang=bg",
      }),
    });
    expect(page.props.signInForceRedirectUrl).toBe("/app?lang=en");
  });
  it("uses the existing buyer parser and back destination for a callback", async () => {
    mock.configured.mockReturnValue(true);
    const page = await AuthenticationPage({
      mode: "sign-in",
      searchParams: Promise.resolve({
        sign_in_force_redirect_url:
          "http://127.0.0.1:6419/account/privacy/preferences?lang=bg",
      }),
    });
    expect(page.props.children.props.back).toBe(
      "/account/privacy/preferences?lang=bg",
    );
  });
  it("accepts only the configured production origin, independently of development", async () => {
    vi.stubEnv("TREIDO_APP_ORIGIN", "https://treido.eu");
    mock.configured.mockReturnValue(true);
    const page = await AuthenticationPage({
      mode: "sign-in",
      searchParams: Promise.resolve({
        sign_in_force_redirect_url: "https://treido.eu/app/intent?lang=bg",
      }),
    });
    expect(page.props.signInForceRedirectUrl).toBe("/app/intent?lang=bg");
    const development = await AuthenticationPage({
      mode: "sign-in",
      searchParams: Promise.resolve({
        sign_in_force_redirect_url: "http://127.0.0.1:6419/app/intent?lang=bg",
      }),
    });
    expect(development.props.signInForceRedirectUrl).toBe("/app?lang=en");
  });
  it.each(
    [
      "https://outside.invalid/app/intent?lang=bg",
      "https://treido.eu/app/intent?lang=bg",
      "http://localhost:6419/app/intent?lang=bg",
      "http://2130706433:6419/app/intent?lang=bg",
      "http://127.0.0.1:6420/app/intent?lang=bg",
      "https://127.0.0.1:6419/app/intent?lang=bg",
      "//127.0.0.1:6419/app/intent?lang=bg",
      "javascript:alert(1)",
      "data:text/html,anything",
      "http://user:pass@127.0.0.1:6419/app/intent?lang=bg",
      "http://@127.0.0.1:6419/app/intent?lang=bg",
      "http://127.0.0.1:6419/app/intent?lang=bg#section",
      "http://127.0.0.1:6419/app\\intent?lang=bg",
      "http://127.0.0.1:6419/app/intent?lang=bg\n",
      "http://127.0.0.1:6419/api/internal?lang=bg",
      "http://127.0.0.1:6419/app?lang=bg&role=owner",
      "http://127.0.0.1:6419/app/intent?lang=bg&returnTo=https://outside.invalid",
      "http://127.0.0.1:6419/untrusted/../app/intent?lang=bg",
      "http://127.0.0.1:6419/%61pp/intent?lang=bg",
      ["http://127.0.0.1:6419/app/intent?lang=bg"],
    ].map((callback) => ({ callback })),
  )("rejects an untrusted callback target: $callback", async ({ callback }) => {
    mock.configured.mockReturnValue(true);
    const page = await AuthenticationPage({
      mode: "sign-in",
      searchParams: Promise.resolve({ sign_in_force_redirect_url: callback }),
    });
    expect(page.props.signInForceRedirectUrl).toBe("/app?lang=en");
    expect(mock.locale).toHaveBeenCalledWith(null);
  });
  it("does not infer a destination from the other authentication mode", async () => {
    mock.configured.mockReturnValue(true);
    const page = await AuthenticationPage({
      mode: "sign-in",
      searchParams: Promise.resolve({
        sign_up_force_redirect_url: "http://127.0.0.1:6419/app/intent?lang=bg",
      }),
    });
    expect(page.props.signInForceRedirectUrl).toBe("/app?lang=en");
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
