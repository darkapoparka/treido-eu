"use client";
import { useEffect, useEffectEvent, useState } from "react";

/** Foreground elapsed time, not callback count, owns the four source phases. */
export function useOnboardingClock(
  enabled: boolean,
  interval: number,
  repeat: boolean,
  onChange?: (phase: number) => void,
) {
  const [phase, setPhase] = useState(0);
  const publish = useEffectEvent((next: number) => {
    setPhase(next);
    onChange?.(next);
  });
  useEffect(() => {
    let elapsed = 0,
      started = performance.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reset = setTimeout(() => publish(0), 0);
    if (!enabled) return () => clearTimeout(reset);
    const update = () => {
      const activeTime = elapsed + performance.now() - started;
      const step = Math.floor(activeTime / interval);
      publish(repeat ? step % 4 : Math.min(3, step));
      timer =
        !repeat && step >= 3
          ? undefined
          : setTimeout(update, interval - (activeTime % interval));
    };
    const visibilityChanged = () => {
      clearTimeout(timer);
      timer = undefined;
      if (document.hidden) elapsed += performance.now() - started;
      else {
        started = performance.now();
        update();
      }
    };
    if (!document.hidden) timer = setTimeout(update, interval);
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => {
      clearTimeout(reset);
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visibilityChanged);
    };
  }, [enabled, interval, repeat]);
  return phase;
}
