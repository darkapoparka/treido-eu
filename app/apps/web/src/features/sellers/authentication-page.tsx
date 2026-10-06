import { parseBuyerContinuation } from "../library/buyer-continuation";
import { ClerkProvider, SignIn, SignUp } from "@clerk/nextjs";
import { getTranslations } from "next-intl/server";
import { clerkLocalization } from "../locale/clerk-localization.server";
import { pageLocale } from "../locale/page-locale.server";
import { parseLocale } from "../locale/locale";
import { backendConfigured } from "./backend-status.server";
import { BackendUnavailable, Workspace } from "./workspace";
import { parseSellContinuation } from "./sell-entry";
import { parseWorkspaceContinuation } from "./workspace-continuation";

function authenticationTarget(value: unknown): string | null {
  const sell = parseSellContinuation(value);
  return sell.ok
    ? sell.continuation.target
    : (parseBuyerContinuation(value) ?? parseWorkspaceContinuation(value));
}

function callbackTarget(value: unknown): string | null {
  const configuredOrigin = process.env.TREIDO_APP_ORIGIN;
  if (
    typeof value !== "string" ||
    value.length > 4096 ||
    /[\\\s\u0000-\u001f\u007f]/.test(value) ||
    !configuredOrigin
  )
    return null;
  try {
    const origin = new URL(configuredOrigin);
    const callback = new URL(value);
    const authority = /^https?:\/\/[^/?#]+/.exec(value)?.[0];
    if (
      !authority ||
      authority.includes("@") ||
      !["http:", "https:"].includes(origin.protocol) ||
      origin.href !== `${origin.origin}/` ||
      authority !== origin.origin ||
      callback.origin !== origin.origin ||
      callback.username ||
      callback.password ||
      callback.hash
    )
      return null;
    // Keep the raw path for the existing route parsers; URL normalization must
    // not turn an otherwise disallowed continuation into an allowed one.
    const target = value.slice(authority.length) || "/";
    if (target !== callback.pathname + callback.search) return null;
    return authenticationTarget(target);
  } catch {
    return null;
  }
}

export async function AuthenticationPage({
  searchParams,
  mode,
}: {
  searchParams: Promise<{
    returnTo?: string;
    lang?: string;
    sign_in_force_redirect_url?: string | string[];
    sign_up_force_redirect_url?: string | string[];
  }>;
  mode: "sign-in" | "sign-up";
}) {
  const params = await searchParams;
  const { returnTo, lang } = params;
  const validatedTarget =
    authenticationTarget(returnTo) ??
    callbackTarget(
      mode === "sign-up"
        ? params.sign_up_force_redirect_url
        : params.sign_in_force_redirect_url,
    ) ??
    (mode === "sign-up" ? "/app/intent" : "/app");
  const buyerTarget = parseBuyerContinuation(validatedTarget);
  const destination = new URL(validatedTarget, "https://treido.invalid");
  const language = await pageLocale(
    parseLocale(lang) ?? parseLocale(destination.searchParams.get("lang")),
  );
  destination.searchParams.set("lang", language);
  const target = destination.pathname + destination.search;
  if (!backendConfigured()) return <BackendUnavailable language={language} />;
  const t = await getTranslations({ locale: language, namespace: "accountUI" });
  const signInUrl = `/sign-in?lang=${language}&returnTo=${encodeURIComponent(target)}`;
  const signUpUrl = `/sign-up?lang=${language}&returnTo=${encodeURIComponent(target)}`;
  return (
    <ClerkProvider
      localization={await clerkLocalization(language)}
      signInUrl={signInUrl}
      signUpUrl={signUpUrl}
      signInForceRedirectUrl={target}
      signUpForceRedirectUrl={target}
    >
      <Workspace
        title={
          mode === "sign-in"
            ? t("signInToTreido")
            : t("createYourTreidoAccount")
        }
        back={buyerTarget ? target : `/sell?lang=${language}`}
        language={language}
      >
        {mode === "sign-in" ? (
          <SignIn
            routing="path"
            path="/sign-in"
            forceRedirectUrl={target}
            signUpUrl={signUpUrl}
          />
        ) : (
          <SignUp
            routing="path"
            path="/sign-up"
            forceRedirectUrl={target}
            signInUrl={signInUrl}
          />
        )}
      </Workspace>
    </ClerkProvider>
  );
}
