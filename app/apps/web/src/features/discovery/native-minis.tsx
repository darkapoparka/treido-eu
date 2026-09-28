"use client";
/* eslint-disable @next/next/no-img-element */
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
          <h1>Sign in required</h1>
          <p>Please sign in to your Shop account to load {name}.</p>
          <ContextualCloseLink href="/minis" className="native-mini-close">
            Close
          </ContextualCloseLink>
        </div>
      </section>
    </MiniShell>
  );
}

export function MakeupMaster() {
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
              alt="Makeup Master beauty inspiration"
              data-media-state="source-still"
            />
            <div className="makeup-welcome-actions">
              <button
                type="button"
                aria-label="Your past makeups"
                onClick={() =>
                  change({ makeup: "history" }, false, { makeupStep: true })
                }
              >
                <Icon name="history" />
              </button>
              <button
                type="button"
                onClick={() =>
                  change({ makeup: "upload" }, false, { makeupStep: true })
                }
              >
                Get started
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              className="makeup-step-back"
              aria-label="Back to Makeup Master"
              onClick={back}
            >
              <Icon name="back" />
            </button>
            {phase === "history" ? (
              <h1>
                <img
                  src="/api/reference-media/live-makeup-history-wordmark"
                  alt="Your past makeups"
                />
              </h1>
            ) : (
              <>
                <h1>
                  <img
                    src="/api/reference-media/live-makeup-upload-wordmark"
                    alt="Upload your best selfie"
                  />
                </h1>
                <p className="makeup-introduction">
                  For the most accurate makeup try-on, please upload a no-makeup
                  selfie. Look straight into the camera, keep your face relaxed,
                  and avoid strong shadows or filters.
                </p>
                <img
                  className="makeup-selfie"
                  src="/api/reference-media/live-makeup-selfie"
                  alt="Example of a front-facing selfie"
                />
                <button
                  className="makeup-upload-action"
                  type="button"
                  onClick={() => setAccess(true)}
                >
                  Upload image
                </button>
                <p className="makeup-privacy">
                  <img src="/api/reference-media/live-makeup-lipstick" alt="" />
                  <span>
                    Your no-makeup selfie is here for the glow-up only —<br />
                    never saved, never shared
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
        title="Choose a photo"
        referenceExamples={false}
        anchorSelector=".makeup-upload-action"
      />
    </MiniShell>
  );
}
