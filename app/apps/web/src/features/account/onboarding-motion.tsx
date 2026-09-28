"use client";
/* eslint-disable @next/next/no-img-element -- Inherited decorative artwork. */
import { useState, type CSSProperties } from "react";
import { useOnboardingClock } from "./onboarding-clock";
import { DecorativeVideo } from "../discovery/decorative-video";

const headlines = [
  null,
  <>
    Track your orders
    <br />
    every step of the way
  </>,
  <>
    Discover your next
    <br />
    favorite brand
  </>,
  <>
    Supercharge your
    <br />
    online shopping
  </>,
];

export type IntroPhase = 0 | 1 | 2 | 3;

export function IntroHeadline({
  motion,
  onPhaseChange,
}: {
  motion: boolean;
  onPhaseChange?: (phase: IntroPhase) => void;
}) {
  const index = useOnboardingClock(motion, 2000, true, (phase) =>
    onPhaseChange?.(phase as IntroPhase),
  );
  const visible = motion ? index : 0;
  return (
    <h1
      className={visible ? "intro-cycle-copy" : undefined}
      data-intro-headline={visible}
    >
      {visible ? (
        <span key={visible}>{headlines[visible]}</span>
      ) : (
        <img
          src="/api/reference-media/shop-wordmark"
          alt="Shop"
          width="123"
          height="51"
        />
      )}
    </h1>
  );
}

const trackingStages = [
  ["Order placed", "Standard delivery", "onboarding-order-parcel", "0%"],
  ["In transit", "ETA: Monday Sep 1", "onboarding-transit-plane", "25%"],
  ["Out for delivery", "Between 2-3 pm", "onboarding-delivery-vehicle", "55%"],
  ["Delivered", "Delivered 2 hours ago", "onboarding-delivered-parcel", "100%"],
] as const;

export function TrackingIllustration({
  motion,
  native = false,
}: {
  motion: boolean;
  native?: boolean;
}) {
  const [recordedIndex, setRecordedIndex] = useState(0);
  const nativeIndex = useOnboardingClock(native && motion, 4000, false);
  const index = native ? nativeIndex : recordedIndex;
  const [title, caption, art, progress] = trackingStages[motion ? index : 3];
  return (
    <div
      className="tracking-onboarding-card"
      data-motion={motion}
      data-native-tracking={native || undefined}
      data-tracking-demo={title}
    >
      <img
        className="tracking-shoe"
        src={
          native
            ? "/api/reference-media/live-onboarding-shoe"
            : "/api/reference-media/onboarding-shoe"
        }
        alt=""
      />
      <span>
        <small>Online store</small>
        <strong>{title}</strong>
        <i style={{ "--tracking-progress": progress } as CSSProperties} />
        <small>{caption}</small>
      </span>
      <img
        key={art}
        className="tracking-parcel"
        src={
          native
            ? `/api/reference-media/${!motion || index === 3 ? "live-onboarding-delivered" : "live-onboarding-parcel"}`
            : `/api/reference-media/${art}`
        }
        alt=""
      />
      <DecorativeVideo
        enabled={motion}
        clips={[
          {
            key: native
              ? `live-smart-onboarding-light-${["order-placed", "in-transit", "out-for-delivery", "delivered"][index]}`
              : "onboarding-status-motion",
            className: "tracking-art-video",
          },
        ]}
        onTimeChange={(seconds) =>
          !native &&
          setRecordedIndex(
            seconds >= 7.25 ? 3 : seconds >= 5 ? 2 : seconds >= 3 ? 1 : 0,
          )
        }
      />
    </div>
  );
}
