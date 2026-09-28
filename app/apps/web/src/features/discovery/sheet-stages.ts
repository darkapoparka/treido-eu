"use client";

import { useEffect, useId, useRef, useSyncExternalStore } from "react";

type StageEntry = { owner: string; path: string; stage: string; depth: number };
function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener("shop-flow-stage", listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener("shop-flow-stage", listener);
  };
}

/** A mounted flow owns every local stage, including its closed Forward entry. */
export function useSheetStages<T extends string>({
  open,
  initial,
  onClose,
  onReopen,
  onStart,
}: {
  open: boolean;
  initial: T;
  onClose: () => void;
  onReopen: () => void;
  onStart: () => void;
}) {
  const owner = useId();
  const activeStage = useSyncExternalStore(
    subscribe,
    () => {
      const current = window.history.state?.shopFlowStage as
        StageEntry | undefined;
      return current?.owner === owner && current.path === location.pathname
        ? (current.stage as T)
        : null;
    },
    () => null,
  );
  const callbacks = useRef({ onClose, onReopen, onStart });
  const wasOpen = useRef(false);
  const retiring = useRef(false);
  useEffect(() => {
    callbacks.current = { onClose, onReopen, onStart };
  }, [onClose, onReopen, onStart]);
  function entry(): StageEntry | undefined {
    const current = window.history.state?.shopFlowStage as
      StageEntry | undefined;
    return current?.owner === owner && current.path === location.pathname
      ? current
      : undefined;
  }
  function write(next: T, depth: number) {
    const state = { ...window.history.state };
    delete state.__NA;
    delete state._N;
    window.history.pushState(
      {
        ...state,
        shopFlowStage: { owner, path: location.pathname, stage: next, depth },
      },
      "",
      location.href,
    );
    window.dispatchEvent(new Event("shop-flow-stage"));
  }
  useEffect(() => {
    if (open && !wasOpen.current) {
      const current = window.history.state?.shopFlowStage as
        StageEntry | undefined;
      if (current?.owner !== owner || current.path !== location.pathname) {
        callbacks.current.onStart();
        const state = { ...window.history.state };
        delete state.__NA;
        delete state._N;
        window.history.pushState(
          {
            ...state,
            shopFlowStage: {
              owner,
              path: location.pathname,
              stage: initial,
              depth: 1,
            },
          },
          "",
          location.href,
        );
        window.dispatchEvent(new Event("shop-flow-stage"));
      }
    }
    wasOpen.current = open;
  }, [open, initial, owner]);
  useEffect(() => {
    const restore = () => {
      const current = window.history.state?.shopFlowStage as
        StageEntry | undefined;
      retiring.current = false;
      if (current?.owner === owner && current.path === location.pathname) {
        callbacks.current.onReopen();
      } else callbacks.current.onClose();
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [owner]);
  function close(after?: () => void) {
    if (retiring.current) return;
    const current = entry();
    if (current) {
      retiring.current = true;
      if (after) window.addEventListener("popstate", after, { once: true });
      window.history.go(-current.depth);
    } else {
      callbacks.current.onClose();
      after?.();
    }
  }
  return {
    stage: activeStage ?? initial,
    active: activeStage !== null,
    navigate: (next: T) => write(next, (entry()?.depth ?? 0) + 1),
    back: () => window.history.back(),
    close,
  };
}
