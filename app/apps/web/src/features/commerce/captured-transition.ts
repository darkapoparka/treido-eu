"use client";

import { useCallback, useEffect, useState } from "react";

// Elapsed stages from flow 21's recording. These animate the explicitly
// selected captured preview; they never authorize a payment or create an order.
export const reviewStageEnds = [1000, 1750, 2250, 3000, 3500] as const;
const confirmationStageEnds = [2000, 2250] as const;

export function useCapturedTransition(
  deadlines: readonly number[],
  initiallyRunning = false,
) {
  const [started, setStarted] = useState<number | null>(() =>
    initiallyRunning ? Date.now() : null,
  );
  const [stage, setStage] = useState(initiallyRunning ? 1 : 0);
  useEffect(() => {
    if (started === null) return;
    let timer: ReturnType<typeof setTimeout>;
    const advance = () => {
      const elapsed = Date.now() - started;
      const index = deadlines.findIndex((deadline) => elapsed < deadline);
      setStage(index < 0 ? 0 : index + 1);
      if (index >= 0) timer = setTimeout(advance, deadlines[index] - elapsed);
    };
    timer = setTimeout(advance, 0);
    return () => clearTimeout(timer);
  }, [started, deadlines]);
  const start = useCallback(() => {
    setStage(1);
    setStarted(Date.now());
  }, []);
  const cancel = useCallback(() => {
    setStage(0);
    setStarted(null);
  }, []);
  return { stage, start, cancel };
}

let pendingConfirmation: { id: string; expires: number } | null = null;

export function armCapturedConfirmation(id: string) {
  pendingConfirmation = { id, expires: Date.now() + 30_000 };
}

export function useCapturedConfirmation(id: string) {
  // Peek during initialization and consume in the effect so Strict Mode's
  // repeated initializer cannot eat the request before the mounted owner sees it.
  const [request] = useState(() =>
    pendingConfirmation?.id === id && pendingConfirmation.expires > Date.now()
      ? pendingConfirmation
      : null,
  );
  const transition = useCapturedTransition(confirmationStageEnds, !!request);
  useEffect(() => {
    if (pendingConfirmation === request) pendingConfirmation = null;
  }, [request]);
  return transition.stage;
}
