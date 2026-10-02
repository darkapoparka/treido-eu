"use client";
/* eslint-disable @next/next/no-img-element */
import { useCaption } from "../locale/use-caption";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, type KeyboardEvent } from "react";
import type { Catalog } from "../catalog/types";
import { previewOnboardedCookie } from "../catalog/reference/session";
import { AccountIcon } from "./icons";
import { WelcomeArt } from "./welcome-art";
import { Icon } from "../discovery/icons";
import { Sheet, consumeSheetHistory } from "../discovery/components";
import { livePreferencePhotos } from "../catalog/reference/live-onboarding-media";
import { AccountPage, Boundary } from "./forms";
import { ShopSplash } from "./reference-transitions";
import { navigateAccountStage } from "./stage-history";
import { SourceLink } from "../discovery/return-navigation";
import { useReducedMotion } from "../discovery/motion-preference";
import {
  IntroHeadline,
  TrackingIllustration,
  type IntroPhase,
} from "./onboarding-motion";

const currentPreferenceObjects = livePreferencePhotos;

function LiveNotificationDialog({
  stage,
  onClose,
  onSkip,
  onTurnOn,
  onAllow,
  onDeny,
}: {
  stage: "skip" | "permission" | null;
  onClose: () => void;
  onSkip: () => void;
  onTurnOn: () => void;
  onAllow: () => void;
  onDeny: () => void;
}) {
  const ui = useTranslations("accountUI");
  const permission = stage === "permission";
  const cycleActions = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey)
      return;
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        "button:not([disabled])",
      ),
    );
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0 || !buttons.length) return;
    event.preventDefault();
    buttons[
      (index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length
    ].focus();
  };
  return (
    <Sheet
      open={stage !== null}
      title={
        permission
          ? ui("allowShopToSendYouNotifications")
          : ui("skipNotifications")
      }
      onClose={onClose}
      headerless
      className={`live-notification-dialog live-notification-${permission ? "permission" : "skip"}-dialog`}
    >
      {permission ? (
        <>
          <svg
            className="live-notification-permission-icon"
            aria-hidden="true"
            viewBox="0 0 24 24"
          >
            <path
              fill="currentColor"
              d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2Zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4a1.5 1.5 0 0 0-3 0v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2ZM7.58 4.08 6.15 2.65C3.75 4.48 2.17 7.3 2.03 10.5h2c.15-2.65 1.51-4.96 3.55-6.42ZM19.97 10.5h2c-.15-3.2-1.72-6.02-4.13-7.85l-1.42 1.43c2.03 1.46 3.4 3.77 3.55 6.42Z"
            />
          </svg>
          <h2 className="live-notification-heading" aria-hidden="true">
            {ui("allow")} <strong>Shop</strong> {ui("toSendYouNotifications")}
          </h2>
          <p className="sr-only">
            {ui("localReferencePreviewOnlyNeitherChoiceChangesYourBrowserOr")}
          </p>
          <div
            className="live-notification-permission-actions"
            onKeyDown={cycleActions}
          >
            <button type="button" autoFocus onClick={onAllow}>
              {ui("allow")}
            </button>
            <button type="button" onClick={onDeny}>
              {ui("donTAllow")}
            </button>
          </div>
        </>
      ) : (
        <>
          <h2 className="live-notification-heading" aria-hidden="true">
            {ui("skipNotifications")}
          </h2>
          <p>{ui("youWonTBeAbleToReceiveOrderUpdatesFrom")}</p>
          <div
            className="live-notification-skip-actions"
            onKeyDown={cycleActions}
          >
            <button
              className="live-notification-skip-action"
              type="button"
              autoFocus
              onClick={onSkip}
            >
              {ui("skip")}
            </button>
            <button
              className="live-notification-turn-on-action"
              type="button"
              onClick={onTurnOn}
            >
              {ui("turnOn")}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}

export function SupportPage({ android = false }: { android?: boolean }) {
  const ui = useTranslations("accountUI");
  return (
    <AccountPage
      android={android}
      title={ui("support")}
      className={`account-settings-page support-page${android ? " android-support" : ""}`}
    >
      <div className="support-links">
        <Link href="https://help.shop.app/en/shop">
          <AccountIcon name="person-question" />
          <div>
            {ui("helpCenter")}
            <small>
              {ui("learnMoreAboutYourAccountShopPayOrOrderTracking")}
            </small>
          </div>
        </Link>
        <SourceLink href="/support/chat">
          <AccountIcon name="support-chat" />
          <div>
            {ui("supportChat")}
            <small>{ui("askQuestionsAndGetSupportFromOurAIAssistant")}</small>
          </div>
        </SourceLink>
        <Link href="/about">
          <AccountIcon name="info" />
          <div>
            {ui("about")}
            <small>
              {ui("learnMoreAboutShopReadOurPrivacyPolicyAndTerms")}
            </small>
          </div>
        </Link>
      </div>
    </AccountPage>
  );
}
export function HelpPage() {
  const caption = useCaption();
  const ui = useTranslations("accountUI");
  return (
    <AccountPage title={ui("helpCenter")}>
      <div className="help-topics">
        {[
          [
            "Tracking an order",
            "Visit Orders to view a reference delivery timeline and edit a local tracking entry.",
            "/orders",
          ],
          [
            "Managing your account",
            "Update your reference name, address and shopping preferences.",
            "/account",
          ],
          [
            "Payments and refunds",
            "Payments are not connected in this preview. No purchase or refund can be submitted.",
            "/account/payments",
          ],
        ].map(([title, copy, href]) => (
          <details key={caption(title)}>
            <summary>{caption(title)}</summary>
            <p>{copy}</p>
            <Link href={href}>
              {ui("view")} {title.toLowerCase()} ›
            </Link>
          </details>
        ))}
      </div>
    </AccountPage>
  );
}
export { SupportChat } from "./support-chat";
export function AboutPage() {
  const caption = useCaption();
  const ui = useTranslations("accountUI");
  const [document, setDocument] = useState("");
  return (
    <AccountPage className="source-about">
      <div className="about-mark">
        <img
          src="/api/reference-media/shop-wordmark"
          width="123"
          height="51"
          alt="Shop"
        />
      </div>
      <p className="centered">
        {ui("payBetterTrackBetter")}
        <br />
        {ui("shopBetter")}
        <a href="https://shop.app">shop.app</a>
      </p>
      <div className="about-links">
        {["Terms and conditions", "Privacy policy", "Licenses"].map(
          (label, i) => (
            <button
              className="account-row"
              key={label}
              onClick={() =>
                label === "Licenses"
                  ? setDocument(label)
                  : window.open(
                      label === "Privacy policy"
                        ? "https://www.shopify.com/legal/privacy/consumers"
                        : "https://shop.app/terms-of-service?locale=en-US",
                      "_blank",
                      "noopener,noreferrer",
                    )
              }
            >
              <span>
                <AccountIcon
                  name={(["clipboard", "lock", "document-check"] as const)[i]}
                />
                {caption(label)}
              </span>
              <Icon name="chevron" />
            </button>
          ),
        )}
      </div>
      <div className="about-social">
        <a
          href="https://twitter.com/shop"
          aria-label={ui("shopOnTwitter")}
          data-ui-label="shopOnTwitter"
        >
          <AccountIcon name="twitter" />
        </a>
        <a
          href="https://www.instagram.com/shop"
          aria-label={ui("shopOnInstagram")}
          data-ui-label="shopOnInstagram"
        >
          <AccountIcon name="instagram" />
        </a>
      </div>
      <p className="about-legal">
        <span>{ui("byUsingShopYouAgreeToThe")}</span>
        <span>
          <a href="https://shop.app/terms-of-service?locale=en-US">
            {ui("termsAndConditions")}
          </a>{" "}
          {ui("and")}{" "}
          <a href="https://www.shopify.com/legal/privacy/consumers">
            {ui("privacyPolicy")}
          </a>
          .
        </span>
      </p>
      <small className="about-version">{ui("vERSION22660RELEASE377556")}</small>
      <Sheet
        open={!!document}
        title={caption(document)}
        onClose={() => setDocument("")}
      >
        <p>{ui("theSourceCaptureDoesNotIncludeTheAppSLicense")}</p>
        <button className="form-cancel" onClick={() => setDocument("")}>
          {ui("close")}
        </button>
      </Sheet>
    </AccountPage>
  );
}
export function NotificationsPage() {
  const ui = useTranslations("accountUI");
  return (
    <AccountPage title={ui("notifications")}>
      <div className="notification-empty">
        <h2>{ui("nothingToSeeYet")}</h2>
        <p>{ui("youLlGetUpdatesOnYourAccountAndShoppingActivity")}</p>
        <Link className="primary notification-shopping" href="/">
          {ui("startShopping")}
        </Link>
      </div>
    </AccountPage>
  );
}
export { LoginPage } from "./authentication";

export function OnboardingPage({
  initialStep = 0,
}: {
  catalog: Catalog;
  initialStep?: number;
}) {
  const caption = useCaption();
  const ui = useTranslations("accountUI");
  const params = useSearchParams();
  const stage = params.get("step");
  const step =
    stage === "preferences"
      ? 1
      : stage === "tracking"
        ? 2
        : stage === "updates"
          ? 3
          : stage
            ? initialStep
            : 0;
  const setStep = (next: number) => {
    const query = new URLSearchParams(params);
    query.set("step", ["intro", "preferences", "tracking", "updates"][next]);
    navigateAccountStage(`/onboarding?${query}`);
  };
  const router = useRouter();
  const finishPreviewOnboarding = (href = "/") => {
    document.cookie = `${previewOnboardedCookie}=1; Path=/; SameSite=Lax`;
    router.push(href);
  };
  const [choice, setChoice] = useState("");
  const [permission, setPermission] = useState(false);
  const [skipConfirmation, setSkipConfirmation] = useState(false);
  const [livePermissionPrompt, setLivePermissionPrompt] = useState(false);
  const liveSkipButtonRef = useRef<HTMLButtonElement>(null);
  const livePermissionButtonRef = useRef<HTMLButtonElement>(null);
  const [introPhase, setIntroPhase] = useState<IntroPhase>(0);
  const capturedReference = params.get("reference") === "captured";
  const reducedMotion = useReducedMotion();
  const motion = !reducedMotion && !capturedReference;
  const currentLiveIntro = !capturedReference;
  // Sign-out welcome has no guest Skip until the shopper cancels sign-in.
  const returningWelcome =
    currentLiveIntro && params.get("welcome") === "returning";
  const visibleIntroPhase = motion ? introPhase : 0;
  const closeSkipConfirmation = () => {
    setSkipConfirmation(false);
    window.requestAnimationFrame(() => liveSkipButtonRef.current?.focus());
  };
  const closeLivePermissionPrompt = () => {
    setLivePermissionPrompt(false);
    window.requestAnimationFrame(() =>
      livePermissionButtonRef.current?.focus(),
    );
  };
  const completeLivePermissionPrompt = () => {
    consumeSheetHistory();
    setLivePermissionPrompt(false);
    setStep(1);
  };
  if (params.get("step") === "splash" || params.get("step") === "signout")
    return (
      <ShopSplash
        newJourney={params.get("step") === "splash"}
        captured={params.get("reference") === "captured"}
      />
    );
  if (params.get("step") === "discover")
    return (
      <AccountPage dock={false} className="source-intro discover-intro">
        <small className="intro-powered">
          {ui("poweredBy_fdc5d2")}{" "}
          <b>
            <svg aria-hidden="true" viewBox="0 0 20 22">
              <path
                fill="currentColor"
                d="M4 5 15 3l3 17-16 1ZM7 5C7-1 13-1 13 4h-2c0-4-3-3-3 1Z"
              />
              <text x="6" y="16" fill="white" fontSize="11" fontStyle="italic">
                S
              </text>
            </svg>
            shopify
          </b>
        </small>
        <div className="discover-art">
          {[
            ["hat", 46, 174, 105, 122],
            ["basket", 177, 129, 78, 64],
            ["calculator", 320, 149, 47, 51],
            ["watering", 328, 247, 65, 113],
            ["ball", 102, 452, 92, 91],
            ["chair", 6, 446, 51, 79],
            ["candle", 234, 509, 53, 66],
            ["lipstick", 314, 409, 51, 92],
            ["clock", 0, 276, 63, 90],
          ].map(([id, x, y, w, h]) => (
            <img
              key={id}
              src={`/api/reference-media/discover-${id}`}
              alt=""
              style={{
                left: Number(x),
                top: `${(Number(y) / 793) * 100}dvh`,
                width: Number(w),
                height: Number(h),
              }}
            />
          ))}
        </div>
        <h1>
          {ui("discoverYourNext")}
          <br />
          {ui("favoriteBrand")}
        </h1>
        <div className="intro-actions">
          <Link
            className="primary form-submit"
            href={
              params.get("reference") === "captured"
                ? "/login?reference=captured&journey=new"
                : "/login?journey=new"
            }
            aria-label={ui("continueToSignIn")}
            data-ui-label="continueToSignIn"
          >
            <img
              className="discover-loading-mark"
              src="/api/reference-media/auth-loop"
              alt=""
            />
          </Link>
          <p>
            {ui("byProceedingToUseShopYouAgreeToOur")}
            <br />
            <Link href="https://shop.app/terms-of-service">
              {ui("termsOfService")}
            </Link>{" "}
            {ui("and")}{" "}
            <Link href="https://www.shopify.com/legal/privacy/consumers">
              {ui("privacyPolicy_2b7281")}
            </Link>
            .
          </p>
        </div>
      </AccountPage>
    );
  if (step === 0)
    return (
      <AccountPage
        dock={false}
        className={`source-intro ${motion ? "intro-motion" : ""} ${currentLiveIntro ? "current-live-intro" : ""} ${returningWelcome ? "current-returning-welcome" : ""}`}
      >
        <small className="intro-powered">
          {ui("poweredBy_fdc5d2")}{" "}
          <b>
            <svg aria-hidden="true" viewBox="0 0 20 22">
              <path
                fill="currentColor"
                d="M4 5 15 3l3 17-16 1ZM7 5C7-1 13-1 13 4h-2c0-4-3-3-3 1Z"
              />
              <text x="6" y="16" fill="white" fontSize="11" fontStyle="italic">
                S
              </text>
            </svg>
            shopify
          </b>
        </small>
        {currentLiveIntro && !returningWelcome && (
          <button
            type="button"
            className="onboarding-skip"
            aria-label={ui("skipGetStarted")}
            onClick={() => setStep(3)}
            data-ui-label="skipGetStarted"
          >
            {ui("skip")}
          </button>
        )}
        {currentLiveIntro ? (
          <WelcomeArt motion={motion} phase={visibleIntroPhase} />
        ) : (
          <div className="intro-objects" data-intro-phase={visibleIntroPhase}>
            {[
              ["chair", 180, 143, 51, 82],
              ["clock", 278, 214, 80, 81],
              ["ball", 58, 247, 93, 92],
              ["candle", 0, 334, 38, 64],
              ["hat", 330, 357, 63, 102],
              ["lipstick", 0, 465, 81, 69],
              ["watering", 84, 532, 127, 115],
              ["basket", 308, 509, 76, 68],
              ["calculator", 246, 606, 49, 52],
            ].map(([name, x, y, w, h]) => (
              <img
                key={name}
                data-intro-object={name}
                src={`/api/reference-media/intro-${name}`}
                alt=""
                style={{
                  left: `${(Number(x) / 393) * 100}%`,
                  top: `${((Number(y) - 59) / 793) * 100}dvh`,
                  width: Number(w),
                  height: Number(h),
                }}
              />
            ))}
          </div>
        )}
        <IntroHeadline motion={motion} onPhaseChange={setIntroPhase} />
        <div className="intro-actions">
          <Link
            className="primary form-submit"
            href={
              params.get("journey") === "new" || returningWelcome
                ? capturedReference
                  ? "/onboarding?step=discover&journey=new&reference=captured"
                  : "/login?screen=track&journey=new"
                : capturedReference
                  ? "/login?screen=track&reference=captured"
                  : "/login?screen=track"
            }
            onNavigate={(event) => {
              if (params.get("journey") !== "new" || !capturedReference) return;
              event.preventDefault();
              const query = new URLSearchParams(params);
              query.set("step", "discover");
              navigateAccountStage(`/onboarding?${query}`);
            }}
          >
            {ui("getStarted_983f31")}
          </Link>
          <p>
            {ui("byProceedingToUseShopYouAgreeToOur")}
            <br />
            <Link href="https://shop.app/terms-of-service">
              {ui("termsOfService")}
            </Link>{" "}
            {ui("and")}{" "}
            <Link href="https://www.shopify.com/legal/privacy/consumers">
              {ui("privacyPolicy_2b7281")}
            </Link>
            .
          </p>
        </div>
      </AccountPage>
    );
  return (
    <AccountPage dock={false}>
      <div
        className={`onboarding-page onboarding-step-${step} ${params.get("journey") === "returning" ? "returning-onboarding" : ""} ${step === 1 && currentLiveIntro ? "current-preferences-intro" : ""} ${step === 3 && currentLiveIntro ? "current-updates-intro" : ""}`}
      >
        <button
          ref={step === 3 && currentLiveIntro ? liveSkipButtonRef : undefined}
          className="onboarding-skip"
          onClick={() => {
            if (params.get("journey") === "returning") {
              finishPreviewOnboarding("/?journey=returning");
              return;
            }
            if (step === 3 && currentLiveIntro) {
              setSkipConfirmation(true);
              return;
            }
            if (step === 1 && currentLiveIntro) {
              finishPreviewOnboarding();
              return;
            }
            if (step < 3) setStep(step + 1);
            else finishPreviewOnboarding();
          }}
        >
          {ui("skip")}
        </button>
        {step === 0 && <small>{ui("poweredByShopify")}</small>}
        {step === 1 && (
          <div className="preference-onboarding-art">
            <div className="preference-onboarding-art-inner">
              {(currentLiveIntro
                ? currentPreferenceObjects
                : [
                    ["bottle", 0, 107, 51, 111],
                    ["vest", 60, 83, 85, 110],
                    ["woman", 155, 18, 85, 111],
                    ["game", 249, 69, 84, 110],
                    ["lotion", 343, 116, 50, 110],
                    ["robe", 0, 227, 51, 110],
                    ["camera", 60, 204, 85, 110],
                    ["man", 155, 139, 85, 110],
                    ["coat", 249, 190, 84, 110],
                    ["shoe", 155, 259, 85, 110],
                    ["bear", 343, 242, 50, 97],
                  ]
              ).map(([name, x, y, w, h]) => (
                <img
                  key={name}
                  src={
                    currentLiveIntro
                      ? `/api/reference-media/live-preference-${name}`
                      : `/api/reference-media/preference-${name}`
                  }
                  alt=""
                  style={{
                    left: currentLiveIntro
                      ? `${(Number(x) / 395) * 100}%`
                      : `${(Number(x) / 393) * 100}%`,
                    top: currentLiveIntro
                      ? `${(Number(y) / 358) * 100}%`
                      : Number(y) - 59,
                    width: currentLiveIntro
                      ? `${(Number(w) / 395) * 100}%`
                      : Number(w),
                    height: currentLiveIntro
                      ? `${(Number(h) / 358) * 100}%`
                      : Number(h),
                  }}
                />
              ))}
            </div>
          </div>
        )}
        <h1>
          {step === 0 ? (
            "shop"
          ) : step === 1 ? (
            ui("whatAreYouShoppingFor")
          ) : step === 2 ? (
            ui("trackAllOfYourOrdersInOnePlace")
          ) : (
            <>
              {ui("followYourOrderEveryStep")}
              <br />
              {ui("ofTheWay")}
            </>
          )}
        </h1>
        {step > 0 && step < 3 && (
          <p>
            {step === 1
              ? ui("weLlShowYouBrandsAndProductsThatMatchYour")
              : step === 2
                ? ui("connectTheEmailYouUseForOnlineShoppingToTrack")
                : ui("getUpdatesAboutYourOrders")}
          </p>
        )}
        {step === 1 && (
          <div className="onboarding-choices">
            {["Men's", "Women's", "Everything"].map((c) => (
              <button
                className="pill"
                key={c}
                aria-pressed={choice === c}
                onClick={() => setChoice(c)}
              >
                {caption(c)}
              </button>
            ))}
          </div>
        )}
        {step === 2 && (
          <div
            className="tracking-onboarding-art"
            data-motion={motion}
            aria-hidden="true"
          >
            {Array.from({ length: 9 }, (_, i) => (
              <img
                key={i}
                src={`/api/reference-media/${params.get("journey") === "returning" ? (i === 0 ? "auth-tracking-product" : "auth-tracking-package") : i === 0 ? "onboarding-shoe" : "onboarding-package"}`}
                alt=""
              />
            ))}
          </div>
        )}
        {step === 3 && (
          <TrackingIllustration motion={motion} native={currentLiveIntro} />
        )}
        <div className="onboarding-actions">
          {step === 0 ? (
            <>
              <Link className="primary form-submit" href="/login">
                {ui("getStarted_983f31")}
              </Link>
              <button className="form-cancel" onClick={() => setStep(1)}>
                {ui("exploreThePreview")}
              </button>
            </>
          ) : step === 1 ? (
            <button
              className="primary form-submit"
              disabled={!choice}
              onClick={() => {
                if (currentLiveIntro) finishPreviewOnboarding();
                else setStep(2);
              }}
            >
              {ui("next")}
            </button>
          ) : step === 2 ? (
            <>
              <Link
                className="primary form-submit"
                href="/account/connections?provider=gmail"
              >
                <img
                  className="onboarding-google-mark"
                  src="/api/reference-media/connection-google"
                  alt=""
                />{" "}
                {ui("connectGoogle")}
              </Link>
              <small>
                {ui("weLlOnlyUseShoppingRelatedEmailsForOrderTracking")}
              </small>
            </>
          ) : (
            <>
              <button
                ref={currentLiveIntro ? livePermissionButtonRef : undefined}
                className="primary form-submit"
                disabled={skipConfirmation || livePermissionPrompt}
                onClick={() => {
                  if (currentLiveIntro) setLivePermissionPrompt(true);
                  else setPermission(true);
                }}
              >
                {ui("getTrackingUpdates")}
              </button>
              <small>
                {ui("weWillAlsoSendYouUpdatesWithInformationAboutYour")}
              </small>
            </>
          )}
        </div>
      </div>
      <LiveNotificationDialog
        stage={
          step === 3 && currentLiveIntro
            ? livePermissionPrompt
              ? "permission"
              : skipConfirmation
                ? "skip"
                : null
            : null
        }
        onClose={
          livePermissionPrompt
            ? closeLivePermissionPrompt
            : closeSkipConfirmation
        }
        onSkip={() => {
          consumeSheetHistory();
          setSkipConfirmation(false);
          setStep(1);
        }}
        onTurnOn={() => {
          setSkipConfirmation(false);
          setLivePermissionPrompt(true);
        }}
        onAllow={completeLivePermissionPrompt}
        onDeny={completeLivePermissionPrompt}
      />
      <Boundary
        open={capturedReference && permission}
        onClose={() => setPermission(false)}
        kind="Notifications"
      />
    </AccountPage>
  );
}
