"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { validId } from "../selling/draft-model";
import { object } from "../purchase-reviews/model";
import { aftercareText } from "./messages";
const eventName = "treido-order-request-changed";
function subscribe(listener: () => void) {
  window.addEventListener(eventName, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(eventName, listener);
    window.removeEventListener("storage", listener);
  };
}
export function useDurableRequest(options: {
  key: string;
  actorSubject: string;
  language: "bg" | "en";
  scope: Record<string, unknown>;
  recovery: Record<string, unknown>;
  action: (raw: unknown) => Promise<unknown>;
  recover: (raw: unknown) => Promise<unknown>;
}) {
  const clerk = useClerk(),
    router = useRouter(),
    busy = useRef(false),
    live = useRef(false),
    memory = useRef<string | null>(null),
    [status, setStatus] = useState<string | null>(null),
    [pending, start] = useTransition();
  const text = aftercareText(options.language);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const read = useCallback(() => {
    try {
      const value = sessionStorage.getItem(options.key);
      return value && validId(value) ? value : null;
    } catch {
      return memory.current;
    }
  }, [options.key]);
  const original = useSyncExternalStore(subscribe, read, () => null);
  const current = () => live.current && clerk.user?.id === options.actorSubject;
  function save(id: string | null) {
    memory.current = id;
    try {
      if (id) sessionStorage.setItem(options.key, id);
      else sessionStorage.removeItem(options.key);
    } catch {}
    window.dispatchEvent(new Event(eventName));
  }
  function run(payload: Record<string, unknown>) {
    if (busy.current || !current() || read()) return;
    const id = crypto.randomUUID();
    save(id);
    busy.current = true;
    setStatus(null);
    const command = { ...payload, ...options.scope, requestId: id };
    start(async () => {
      try {
        const result = await options.action(command);
        if (!current()) return;
        if (object(result) && result.ok === true) {
          save(null);
          setStatus(text.done);
          router.refresh();
        } else setStatus(text.unknown);
      } catch {
        if (current()) setStatus(text.unknown);
      } finally {
        busy.current = false;
      }
    });
  }
  function recover() {
    const id = read();
    if (!id || busy.current || !current()) return;
    busy.current = true;
    setStatus(null);
    start(async () => {
      try {
        const result = await options.recover({
          ...options.recovery,
          requestId: id,
        });
        if (!current()) return;
        if (object(result) && result.ok === true) {
          save(null);
          setStatus(text.done);
          router.refresh();
        } else if (object(result) && result.code === "NOT_FOUND") {
          save(null);
          setStatus(text.failed);
          router.refresh();
        } else setStatus(text.unknown);
      } catch {
        if (current()) setStatus(text.unknown);
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
