"use client";

import { useEffect, useRef } from "react";

/* eslint-disable @next/next/no-img-element -- Reuses the chosen product photographs. */

// Keep the keyed final frame stable while rapid preference or selection changes can cancel it.
const PREVIEW_SETTLE_GRACE_MS = 1000;

export type SavedPreviewTransition = {
  id: number;
  previousImage?: string;
};

export function SavedSelectionPreview({
  image,
  count,
  transition,
  onComplete,
}: {
  image: string;
  count: number;
  transition: SavedPreviewTransition | null;
  onComplete: (id: number) => void;
}) {
  const completionTimer = useRef<number | null>(null);

  useEffect(() => {
    if (completionTimer.current !== null) {
      window.clearTimeout(completionTimer.current);
      completionTimer.current = null;
    }
  }, [transition?.id]);

  useEffect(
    () => () => {
      if (completionTimer.current !== null)
        window.clearTimeout(completionTimer.current);
    },
    [],
  );

  return (
    <span className="saved-selection-preview">
      {transition?.previousImage && (
        <img
          key={`previous-${transition.id}`}
          className="saved-preview-outgoing"
          src={transition.previousImage}
          alt=""
          aria-hidden="true"
        />
      )}
      <img
        key={transition?.id ?? "settled"}
        className={transition ? "saved-preview-incoming" : undefined}
        src={image}
        alt={`${count} selected items`}
        onAnimationEnd={(event) => {
          if (!transition || event.animationName !== "saved-preview-rise")
            return;
          if (completionTimer.current !== null)
            window.clearTimeout(completionTimer.current);
          const transitionId = transition.id;
          completionTimer.current = window.setTimeout(() => {
            completionTimer.current = null;
            onComplete(transitionId);
          }, PREVIEW_SETTLE_GRACE_MS);
        }}
      />
    </span>
  );
}
