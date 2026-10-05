"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { useClerk, useReverification } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { validId } from "../selling/draft-model";
import {
  shippingCommandAction,
  recoverShippingAction,
  stopShippingRequestAction,
} from "./actions";
import { shippingReviewHref } from "./integration";
import { shippingText } from "./messages";
import type { Language } from "./model";
const event = "treido-shipping-request";
function subscribe(listener: () => void) {
  window.addEventListener(event, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(event, listener);
    window.removeEventListener("storage", listener);
  };
}
export function useShippingRequest(scope: {
  key: string;
  actorKey: string;
  actorSubject: string;
  language: Language;
}) {
  const clerk = useClerk(),
    router = useRouter(),
    action = useReverification(shippingCommandAction);
  const live = useRef(false),
    activeScope = useRef<string | null>(scope.key),
    busy = useRef(false),
    memory = useRef<string | null>(null),
    memoryScope = useRef(scope.key);
  const [pending, start] = useTransition(),
    [status, setStatus] = useState<string | null>(null),
    t = shippingText(scope.language);
  useEffect(() => {
    live.current = true;
    activeScope.current = scope.key;
    return () => {
      live.current = false;
      activeScope.current = null;
    };
  }, [scope.key]);
  const read = useCallback(() => {
    try {
      const id = sessionStorage.getItem(scope.key);
      return id && validId(id)
        ? id
        : memoryScope.current === scope.key
          ? memory.current
          : null;
    } catch {
      return memoryScope.current === scope.key ? memory.current : null;
    }
  }, [scope.key]);
  const original = useSyncExternalStore(subscribe, read, () => null);
  const current = () =>
    live.current &&
    activeScope.current === scope.key &&
    clerk.user?.id === scope.actorSubject;
  function save(id: string | null) {
    memory.current = id;
    memoryScope.current = scope.key;
    try {
      if (id) sessionStorage.setItem(scope.key, id);
      else sessionStorage.removeItem(scope.key);
    } catch {}
    window.dispatchEvent(new Event(event));
  }
  function run(payload: Record<string, unknown>) {
    if (busy.current || !current() || read()) return;
    const requestId = crypto.randomUUID();
    save(requestId);
    busy.current = true;
    setStatus(null);
    start(async () => {
      try {
        const result = await action({
          ...payload,
          actorKey: scope.actorKey,
          requestId,
        });
        if (!current()) return;
        if (result?.ok === true) {
          save(null);
          router.push(shippingReviewHref(result.data.id, scope.language));
          router.refresh();
        } else {
          setStatus(t.unknown);
        }
      } catch {
        if (current()) setStatus(t.unknown);
      } finally {
        busy.current = false;
      }
    });
  }
  function recover(stop = false) {
    const requestId = read();
    if (!requestId || busy.current || !current()) return;
    busy.current = true;
    setStatus(null);
    start(async () => {
      try {
        const raw = { actorKey: scope.actorKey, requestId };
        const result = stop
          ? await stopShippingRequestAction(raw)
          : await recoverShippingAction(raw);
        if (!current()) return;
        if (result.ok && result.data.found) {
          if (result.data.canceled) {
            save(null);
            setStatus(t.canceled);
          } else if (result.data.id) {
            save(null);
            router.push(shippingReviewHref(result.data.id, scope.language));
            router.refresh();
          }
        } else setStatus(t.unknown);
      } catch {
        if (current()) setStatus(t.unknown);
      } finally {
        busy.current = false;
      }
    });
  }
  return {
    run,
    recover,
    pending,
    original,
    status,
    disabled: pending || original !== null,
  };
}
