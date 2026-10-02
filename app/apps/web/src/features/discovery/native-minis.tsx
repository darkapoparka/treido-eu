"use client";
/* eslint-disable @next/next/no-img-element */
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MiniShell, NativeMiniPhotoAccess } from "./mini-frame";
import { liveMiniInformation } from "./mini-model";
import { Icon } from "./icons";
import { LocalPhotoPicker, useMiniRoute } from "./minis";
import { ContextualCloseLink } from "./return-navigation";
import "./native-minis.css";

/** The installed guest Mini stops here. No registry or authentication is simulated. */
export function NativeMiniSignIn({ name }: { name: string }) {
  const ui = useTranslations("discoveryUI");
  return (
    <MiniShell
      name={name}
      showBack={false}
      className="android-mini"
      nativeInfo={
        liveMiniInformation[name === "Picnic Gift Registry" ? "picnic" : "gift"]
      }
    >
      <section className="native-mini-access">
        <div>
          <img src="/api/reference-media/live-mini-signin" alt="" />
          <h1>{ui("signInRequired")}</h1>
          <p>
            {ui("pleaseSignInToYourShopAccountToLoad")} {name}.
          </p>
          <ContextualCloseLink href="/minis" className="native-mini-close">
            {ui("close")}
          </ContextualCloseLink>
        </div>
      </section>
    </MiniShell>
  );
}

export function MakeupMaster() {
  const ui = useTranslations("discoveryUI");
  const router = useRouter();
  const { params, change } = useMiniRoute("/minis/makeup");
  const requested = params.get("makeup");
  const phase =
    requested === "upload" || requested === "history" ? requested : "welcome";
  const [access, setAccess] = useState(false);
  const [picker, setPicker] = useState(false);
  const back = () => {
    if (window.history.state?.makeupStep) router.back();
    else change({ makeup: null }, true);
  };
  return (
    <MiniShell
      name="Makeup Master"
      className="android-mini"
      nativeInfo={liveMiniInformation.makeup}
      showBack={false}
    >
      <section
        className={"makeup-surface makeup-" + phase}
        data-makeup-phase={phase}
      >
        {phase === "welcome" ? (
          <>
            <h1 className="sr-only">Makeup Master</h1>
            <img
              className="makeup-welcome-art"
              src="/api/reference-media/live-makeup-welcome-art"
              alt={ui("makeupMasterBeautyInspiration")}
              data-media-state="source-still"
            />
            <div className="makeup-welcome-actions">
              <button
                type="button"
                aria-label={ui("yourPastMakeups")}
                onClick={() =>
                  change({ makeup: "history" }, false, { makeupStep: true })
                }
                data-ui-label="yourPastMakeups"
              >
                <Icon name="history" />
              </button>
              <button
                type="button"
                onClick={() =>
                  change({ makeup: "upload" }, false, { makeupStep: true })
                }
              >
                {ui("getStarted")}
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              className="makeup-step-back"
              aria-label={ui("backToMakeupMaster")}
              onClick={back}
              data-ui-label="backToMakeupMaster"
            >
              <Icon name="back" />
            </button>
            {phase === "history" ? (
              <h1>
                <img
                  src="/api/reference-media/live-makeup-history-wordmark"
                  alt={ui("yourPastMakeups")}
                />
              </h1>
            ) : (
              <>
                <h1>
                  <img
                    src="/api/reference-media/live-makeup-upload-wordmark"
                    alt={ui("uploadYourBestSelfie")}
                  />
                </h1>
                <p className="makeup-introduction">
                  {ui("forTheMostAccurateMakeupTryOnPleaseUploadA")}
                </p>
                <img
                  className="makeup-selfie"
                  src="/api/reference-media/live-makeup-selfie"
                  alt={ui("exampleOfAFrontFacingSelfie")}
                />
                <button
                  className="makeup-upload-action"
                  type="button"
                  onClick={() => setAccess(true)}
                >
                  {ui("uploadImage")}
                </button>
                <p className="makeup-privacy">
                  <img src="/api/reference-media/live-makeup-lipstick" alt="" />
                  <span>
                    {ui("yourNoMakeupSelfieIsHereForTheGlowUp")}
                    <br />
                    {ui("neverSavedNeverShared")}
                  </span>
                </p>
              </>
            )}
          </>
        )}
      </section>
      <NativeMiniPhotoAccess
        open={access}
        onClose={() => setAccess(false)}
        onContinue={() => {
          setAccess(false);
          setPicker(true);
        }}
        icon="/api/reference-media/live-mini-makeup-icon"
      />
      <LocalPhotoPicker
        open={picker}
        onClose={() => setPicker(false)}
        title={ui("chooseAPhoto")}
        referenceExamples={false}
        anchorSelector=".makeup-upload-action"
      />
    </MiniShell>
  );
}
