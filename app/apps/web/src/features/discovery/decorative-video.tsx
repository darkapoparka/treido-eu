"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { useReducedMotion } from "./motion-preference";
import styles from "./decorative-video.module.css";

type Clip = {
  key: string;
  className: string;
  mask?: {
    fps: number;
    steps: readonly { frame: number; polygon: string }[];
  };
};

// Only decorative layers participate: all copy, controls and state remain DOM.
// A local owner can synchronize several crops from the same source recording.
export function DecorativeVideo({
  clips,
  enabled = true,
  loop = false,
  initialTime = 0,
  onTimeChange,
}: {
  clips: readonly Clip[];
  enabled?: boolean;
  loop?: boolean;
  initialTime?: number;
  onTimeChange?: (seconds: number) => void;
}) {
  const reducedMotion = useReducedMotion();
  const elements = useRef<(HTMLVideoElement | null)[]>([]);
  const keys = clips.map((clip) => clip.key).join(",");
  const notifyTime = useEffectEvent((time: number) => onTimeChange?.(time));
  const readEntryTime = useEffectEvent(() => initialTime);
  const maskFrame = useEffectEvent((time: number, index: number) => {
    const clip = clips[index];
    if (!clip?.mask) return;
    const video = elements.current[index];
    const sourceFrame = Math.floor(time * clip.mask.fps + 0.001);
    const step = clip.mask.steps.findLast((step) => step.frame <= sourceFrame);
    if (video && step && video.dataset.videoMaskFrame !== String(step.frame)) {
      video.style.clipPath = step.polygon;
      video.dataset.videoMaskFrame = String(step.frame);
    }
  });
  const allowed = enabled && !reducedMotion;
  useEffect(() => {
    if (!allowed) return;
    const videos = elements.current.filter((video): video is HTMLVideoElement =>
      Boolean(video),
    );
    if (!videos.length) return;
    const primary = videos[0];
    let disposed = false;
    let failed = false;
    let requested = false;
    let entryTime = 0;
    let starting = false;
    const frames = new Map<HTMLVideoElement, number>();
    const visible = new Set<Element>();
    const positioned = new Set<HTMLVideoElement>();
    const shouldPlay = () =>
      !disposed && !failed && visible.size > 0 && !document.hidden;
    const pause = () => videos.forEach((video) => video.pause());
    const fail = () => {
      failed = true;
      pause();
      videos.forEach((video) => delete video.dataset.videoReady);
    };
    const updateTime = (time = primary.currentTime) => {
      if (disposed) return;
      notifyTime(time);
      for (const companion of videos.slice(1)) {
        if (Math.abs(companion.currentTime - primary.currentTime) > 0.08)
          companion.currentTime = primary.currentTime;
      }
    };
    const resume = () => {
      if (!shouldPlay()) {
        pause();
        return;
      }
      if (!requested) {
        requested = true;
        // Choose the settled entry variant only when playback first loads.
        // Later Follow/state changes must not restart an already playing reel.
        entryTime = readEntryTime();
        videos.forEach((video) => {
          video.src = `/api/reference-video/${video.dataset.videoKey}`;
          video.load();
        });
      }
      for (const video of videos) {
        if (video.readyState < 1) return;
        if (!positioned.has(video)) {
          positioned.add(video);
          if (entryTime > 0)
            video.currentTime = Math.min(entryTime, video.duration);
        }
      }
      if (
        starting ||
        videos.some((video) => video.readyState < 2 || video.seeking)
      )
        return;
      updateTime();
      videos.forEach((video, index) => {
        maskFrame(video.currentTime, index);
        video.dataset.videoReady = "true";
      });
      if (primary.ended && !loop) return;
      starting = true;
      void Promise.all(videos.map((video) => video.play()))
        .then(() => {
          starting = false;
          if (!shouldPlay()) pause();
        })
        .catch(() => {
          starting = false;
          // Leaving the viewport can interrupt a pending play promise. It is a
          // pause, not a decoding failure; a later visible interval can resume.
          if (shouldPlay()) fail();
        });
    };
    const timeChanged = () => {
      updateTime();
      videos.forEach((video, index) => {
        if (!video.requestVideoFrameCallback)
          maskFrame(video.currentTime, index);
      });
    };
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      }
      resume();
    });
    for (const video of videos) {
      observer.observe(video);
      video.addEventListener("loadedmetadata", resume);
      video.addEventListener("canplay", resume);
      video.addEventListener("seeked", resume);
      video.addEventListener("error", fail);
    }
    primary.addEventListener("timeupdate", timeChanged);
    primary.addEventListener("ended", timeChanged);
    document.addEventListener("visibilitychange", resume);
    videos.forEach((video, index) => {
      if (!video.requestVideoFrameCallback) return;
      const tick = (_now: number, metadata: VideoFrameCallbackMetadata) => {
        if (disposed) return;
        if (index === 0) updateTime(metadata.mediaTime);
        // Each cropped layer masks the actual decoded frame it is displaying,
        // even during a companion seek or a one-frame decoder delay.
        maskFrame(metadata.mediaTime, index);
        frames.set(video, video.requestVideoFrameCallback(tick));
      };
      frames.set(video, video.requestVideoFrameCallback(tick));
    });
    return () => {
      disposed = true;
      pause();
      observer.disconnect();
      frames.forEach((frame, video) => video.cancelVideoFrameCallback(frame));
      for (const video of videos) {
        video.removeEventListener("loadedmetadata", resume);
        video.removeEventListener("canplay", resume);
        video.removeEventListener("seeked", resume);
        video.removeEventListener("error", fail);
        delete video.dataset.videoReady;
        video.removeAttribute("src");
        video.load();
      }
      primary.removeEventListener("timeupdate", timeChanged);
      primary.removeEventListener("ended", timeChanged);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [allowed, keys, loop]);
  if (!allowed) return null;
  return clips.map((clip, index) => (
    <video
      key={clip.key}
      ref={(video) => {
        elements.current[index] = video;
      }}
      className={`${styles.clip} ${clip.className}`}
      data-video-key={clip.key}
      muted
      playsInline
      loop={loop}
      preload="none"
      disablePictureInPicture
      aria-hidden="true"
      tabIndex={-1}
    />
  ));
}
