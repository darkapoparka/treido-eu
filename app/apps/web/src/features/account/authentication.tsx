"use client";
/* eslint-disable @next/next/no-img-element -- Allowlisted reference artwork. */
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AccountPage, CodeInput } from "./forms";
import { consumeSheetHistory, Sheet } from "../discovery/components";
import { Icon } from "../discovery/icons";
import { useAccount } from "./state";

type AuthScreen =
  "track" | "email" | "email-code" | "phone-code" | "passkey" | "signing-in";
type CodePhase = "idle" | "pending" | "verified";
const screens: readonly string[] = [
  "track",
  "email",
  "email-code",
  "phone-code",
  "passkey",
  "signing-in",
];
const sourceEmail = "alexsmith.mobbin+3@gmail.com";
function authHref(
  screen: AuthScreen,
  captured: boolean,
  journey: string,
  phase: CodePhase = "idle",
) {
  const query = new URLSearchParams({ screen });
  if (captured) query.set("reference", "captured");
  if (journey === "new") query.set("journey", "new");
  if (phase !== "idle") query.set("phase", phase);
  return "/login?" + query;
}

export function LoginPage() {
  const ui = useTranslations("accountUI");
  const params = useSearchParams(),
    router = useRouter();
  const { updateProfile } = useAccount();
  const returnTo = params.get("returnTo");
  const returnHref =
    returnTo === "/profile" || returnTo === "/orders"
      ? returnTo
      : "/onboarding";
  const requested = params.get("screen") ?? "email";
  const screen = (
    screens.includes(requested) &&
    (requested !== "signing-in" || params.get("reference") === "captured")
      ? requested
      : "email"
  ) as AuthScreen;
  const [replayRequested, setReplayRequested] = useState(false);
  const captured = params.get("reference") === "captured" || replayRequested;
  const journey = params.get("journey") === "new" ? "new" : "returning";
  const phase = (
    captured && ["pending", "verified"].includes(params.get("phase") ?? "")
      ? params.get("phase")
      : "idle"
  ) as CodePhase;
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [boundary, setBoundary] = useState(false);
  const [language, setLanguage] = useState(false);
  const emailCode = screen === "email-code";
  const codeScreen = emailCode || screen === "phone-code";
  const go = (next: AuthScreen) =>
    router.push(authHref(next, captured, journey), { scroll: false });

  // Only an explicitly selected captured scenario can advance through these
  // source-only provider outcomes. Ordinary entry never sends a code, creates
  // a passkey, or claims to authenticate an account.
  useEffect(() => {
    if (!captured) return;
    let next: string | undefined;
    if (codeScreen && phase === "pending")
      next = authHref(screen, true, journey, "verified");
    else if (codeScreen && phase === "verified")
      next = authHref(emailCode ? "signing-in" : "passkey", true, journey);
    else if (screen === "passkey") next = authHref("signing-in", true, journey);
    else if (screen === "signing-in")
      next =
        "/onboarding?step=" +
        (journey === "new" ? "preferences" : "tracking") +
        "&reference=captured&journey=" +
        journey;
    if (!next) return;
    const destination = next;
    const timer = window.setTimeout(() => {
      if (screen === "signing-in")
        updateProfile({
          firstName: "Alex",
          lastName: "Smith",
          email: sourceEmail,
          avatar:
            journey === "returning"
              ? "/api/reference-media/auth-reference-avatar"
              : "",
        });
      router.replace(destination, { scroll: false });
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [
    captured,
    codeScreen,
    emailCode,
    journey,
    phase,
    router,
    screen,
    updateProfile,
  ]);

  if (screen === "track") {
    const currentTrackIntro = journey === "new" && !captured;
    return (
      <AccountPage
        dock={false}
        className={`returning-login${currentTrackIntro ? " current-track-intro" : ""}`}
      >
        <Link
          className="onboarding-skip"
          href={
            currentTrackIntro
              ? "/login?journey=new"
              : "/onboarding?step=tracking"
          }
        >
          {ui("skip")}
        </Link>
        <h1>{ui("letSTrackYourRecentOrder")}</h1>
        <p>
          {currentTrackIntro
            ? ui("selectAllowPasteToCheckForOrderInformation")
            : ui("selectAllowPasteToCheckForOrderInformation_a8eb30")}
        </p>
        <img
          src={
            currentTrackIntro
              ? "/api/reference-media/live-onboarding-track-parcel"
              : "/api/reference-media/auth-returning-package"
          }
          alt=""
        />
        <button
          className="primary form-submit"
          onClick={() => go("phone-code")}
        >
          {ui("trackMyOrder")}
        </button>
      </AccountPage>
    );
  }

  const showingSignIn = screen === "signing-in" && captured;
  const passkey = screen === "passkey";
  const displayedCode =
    code ||
    (captured && phase !== "idle" ? (emailCode ? "530547" : "840125") : "");
  return (
    <AccountPage
      dock={false}
      className={
        "login-page " +
        (codeScreen
          ? "auth-code"
          : showingSignIn
            ? "auth-signing"
            : passkey
              ? "auth-passkey"
              : "auth-email") +
        " auth-phase-" +
        phase +
        " auth-screen-" +
        screen +
        " auth-journey-" +
        journey
      }
    >
      <Link
        className="auth-close"
        href={returnHref}
        aria-label={ui("closeSignIn")}
        data-ui-label="closeSignIn"
      >
        <Icon name="close" />
      </Link>
      <div className="auth-content">
        {showingSignIn ? (
          journey === "returning" ? (
            <img
              className="auth-signing-avatar"
              src="/api/reference-media/auth-reference-avatar"
              alt={ui("referenceProfile")}
            />
          ) : (
            <span className="auth-signing-avatar initial" aria-hidden="true">
              A
            </span>
          )
        ) : (
          <img
            className={
              "auth-art " + (!codeScreen && !passkey ? "auth-loop" : "")
            }
            src={
              "/api/reference-media/" +
              (passkey
                ? "auth-passkey"
                : codeScreen
                  ? emailCode
                    ? "auth-email-phone"
                    : "auth-phone"
                  : "auth-loop")
            }
            alt=""
          />
        )}
        <h1>
          {showingSignIn ? (
            ui("signingYouIn")
          ) : passkey ? (
            <>
              {ui("signInFasterWith")}
              <br />
              {ui("aPasskey")}
            </>
          ) : screen === "email" ? (
            ui("signInToShop")
          ) : emailCode ? (
            ui("verifyYourEmail")
          ) : (
            ui("confirmItSYou")
          )}
        </h1>
        <p>
          {showingSignIn ? (
            sourceEmail
          ) : passkey ? (
            <>
              {ui("fastAndSecureLoginAtMillionsOfStores")}
              <br />
              {ui("acrossAllYourDevices")}
            </>
          ) : screen === "email" ? (
            ui("orCreateAnAccount")
          ) : emailCode ? (
            <>
              {ui("enterCodeSentTo")}
              <br />
              <strong>{email || sourceEmail}</strong>
            </>
          ) : (
            <>
              {ui("enterCodeSentTo")} <strong>+1 ••• ••• •552</strong>
            </>
          )}
        </p>
        {!showingSignIn && !passkey && (
          <form
            className="auth-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (screen === "email") go("email-code");
              else setBoundary(true);
            }}
          >
            {screen === "email" ? (
              <>
                <input
                  className="auth-email-input"
                  aria-label={ui("email")}
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={ui("enterYourEmail")}
                  autoComplete="email"
                  data-ui-label="email"
                />
                <button className="primary auth-continue">
                  {ui("continue")}
                </button>
              </>
            ) : (
              <CodeInput
                label={ui("verificationCode")}
                value={displayedCode}
                onChange={(value) => {
                  if (phase !== "idle") return;
                  setCode(value);
                  if (value.length !== 6) return;
                  if (captured && value === (emailCode ? "530547" : "840125"))
                    router.replace(authHref(screen, true, journey, "pending"), {
                      scroll: false,
                    });
                  else setBoundary(true);
                }}
              />
            )}
          </form>
        )}
        {codeScreen &&
          (emailCode ? (
            phase === "idle" && (
              <button
                className="auth-change"
                onClick={() => {
                  setCode("");
                  go("email");
                }}
              >
                {ui("changeEmailAddress")}
              </button>
            )
          ) : (
            <div className="auth-phone-alternatives">
              {phase !== "idle" ? (
                <p>
                  {ui("didnTReceiveACode")}{" "}
                  <button onClick={() => setBoundary(true)}>
                    {ui("resend")}
                  </button>
                  {ui("orTryAnotherOption")}
                </p>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setCode("");
                      go("email-code");
                    }}
                  >
                    <Icon name="mail" />
                    {ui("emailMeCodeInstead")}
                  </button>
                  <button
                    onClick={() => {
                      setCode("");
                      go("email");
                    }}
                  >
                    <Icon name="arrow" />
                    {ui("useADifferentAccount")}
                  </button>
                </>
              )}
            </div>
          ))}
        {screen === "email" && (
          <p className="auth-terms">
            {ui("byContinuingYouAgreeToThe")}{" "}
            <Link href="https://shop.app/terms-of-service">{ui("terms")}</Link>{" "}
            {ui("andAcknowledgeThe")}{" "}
            <Link href="https://www.shopify.com/legal/privacy/consumers">
              {ui("privacyPolicy_2b7281")}
            </Link>
            .
          </p>
        )}
        {passkey && !captured && (
          <button
            className="primary form-submit"
            onClick={() => setBoundary(true)}
          >
            {ui("addPasskey")}
          </button>
        )}
        {showingSignIn && (
          <span className="sr-only">
            {ui("capturedSignInAnimationNoLiveAccountWasAuthenticated")}
          </span>
        )}
      </div>
      {screen !== "email" && (
        <button className="auth-language" onClick={() => setLanguage(true)}>
          English <span aria-hidden="true">⌄</span>
        </button>
      )}
      <Sheet
        open={language}
        title={ui("language")}
        onClose={() => setLanguage(false)}
      >
        <button className="account-row" onClick={() => setLanguage(false)}>
          English <Icon name="check" />
        </button>
      </Sheet>
      <Sheet
        open={boundary}
        title={
          passkey
            ? ui("passkeysAreNotConnected")
            : ui("authenticationIsNotConnected")
        }
        onClose={() => setBoundary(false)}
      >
        <p>
          {passkey
            ? ui("noPasskeyWasCreatedAndNoAccountWasSignedIn")
            : ui("noCodeWasSentAndNoAccountWasSignedIn")}
        </p>
        <button
          className="form-cancel"
          onClick={() => {
            consumeSheetHistory();
            // Opt-in and clearing commit with this click, not a later navigation.
            setReplayRequested(true);
            setCode("");
            setBoundary(false);
            router.replace(authHref("phone-code", true, "returning"), {
              scroll: false,
            });
          }}
        >
          {ui("replayCapturedSignIn")}
        </button>
        <Link className="form-cancel" href="/login?screen=passkey">
          {ui("previewPasskeyScreen")}
        </Link>
        <Link
          className="primary form-submit"
          href={
            passkey
              ? "/onboarding?step=tracking"
              : "/onboarding?step=preferences"
          }
        >
          {ui("continueInReferencePreview")}
        </Link>
        <button className="form-cancel" onClick={() => setBoundary(false)}>
          {ui("back")}
        </button>
      </Sheet>
    </AccountPage>
  );
}
