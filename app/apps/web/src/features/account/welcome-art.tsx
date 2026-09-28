"use client";
/* eslint-disable @next/next/no-img-element -- Private verified decorative source. */
import { DecorativeVideo } from "../discovery/decorative-video";
import type { IntroPhase } from "./onboarding-motion";

/** Only the native decorative ring is recorded. Heading and actions remain DOM. */
export function WelcomeArt({
  motion,
  phase,
}: {
  motion: boolean;
  phase: IntroPhase;
}) {
  return (
    <div
      className="live-welcome-art"
      data-intro-phase={phase}
      aria-hidden="true"
    >
      <img
        className="live-welcome-poster"
        src="/api/reference-media/live-welcome-orbit-poster"
        alt=""
        width={854}
        height={1200}
        data-media-state="source-still"
      />
      <DecorativeVideo
        enabled={motion}
        loop
        clips={[{ key: "live-welcome-orbit", className: "live-welcome-video" }]}
      />
    </div>
  );
}
