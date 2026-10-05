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

export async function AuthenticationPage({
  searchParams,
  mode,
}: {
  searchParams: Promise<{ returnTo?: string; lang?: string }>;
  mode: "sign-in" | "sign-up";
}) {
  const { returnTo, lang } = await searchParams;
  const parsed = parseSellContinuation(returnTo);
  const buyerTarget = parseBuyerContinuation(returnTo);
  const validatedTarget = parsed.ok
    ? parsed.continuation.target
    : (buyerTarget ??
      parseWorkspaceContinuation(returnTo) ??
      (mode === "sign-up" ? "/app/intent" : "/app"));
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
