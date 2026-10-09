"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useClerk } from "@clerk/nextjs";
import {
  notificationPreferenceAction,
  readNotificationPreferenceAction,
} from "./actions";
import {
  parseNotificationPreference,
  type NotificationPreferenceCode,
  type NotificationPreferenceCommand,
  type NotificationPreferenceView,
} from "./model";

const recoveryKey = (actor: string) => `treido-email-preference-v1:${actor}`;
function recovered(raw: string | null): NotificationPreferenceCommand | null {
  if (raw === null) return null;
  if (raw.length > 2048) throw new Error("Recovery size");
  return parseNotificationPreference(JSON.parse(raw));
}

export function useNotificationPreferences(
  subject: string,
  language: "bg" | "en",
) {
  const clerk = useClerk();
  const [view, setView] = useState<NotificationPreferenceView | null>(null),
    [pending, setPending] = useState<NotificationPreferenceCommand | null>(
      null,
    ),
    [error, setError] = useState<NotificationPreferenceCode | "STORAGE" | null>(
      null,
    ),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false);
  const life = useRef({
      mounted: false,
      generation: 0,
      slot: null as number | null,
      visible: true,
    }),
    attempt = useRef<NotificationPreferenceCommand | null>(null);
  const active = useCallback(
    () =>
      life.current.mounted &&
      life.current.visible &&
      document.visibilityState === "visible" &&
      clerk.user?.id === subject &&
      clerk.session?.status === "active",
    [clerk, subject],
  );
  const current = useCallback(
    (ticket: number, sessionId: string | undefined) =>
      active() &&
      life.current.generation === ticket &&
      clerk.session?.id === sessionId,
    [active, clerk],
  );
  const finish = useCallback((ticket: number) => {
    if (life.current.slot !== ticket) return;
    life.current.slot = null;
    if (life.current.mounted) setBusy(false);
  }, []);
  const accept = useCallback(
    (next: NotificationPreferenceView) => {
      if (next.actorSubject !== subject) {
        setError("FORBIDDEN");
        return false;
      }
      if (attempt.current?.actorKey !== next.actorKey) {
        attempt.current = null;
        setPending(null);
      }
      const stored = recovered(
        sessionStorage.getItem(recoveryKey(next.actorKey)),
      );
      if (stored) {
        if (stored.actorKey !== next.actorKey)
          throw new Error("Recovery actor");
        attempt.current = stored;
        setPending(stored);
      }
      setView(next);
      return true;
    },
    [subject],
  );
  const refresh = useCallback(async () => {
    if (
      life.current.mounted &&
      document.visibilityState === "visible" &&
      clerk.user?.id === subject &&
      clerk.session?.status === "active"
    )
      life.current.visible = true;
    if (!active() || life.current.slot !== null) return;
    const ticket = ++life.current.generation,
      sessionId = clerk.session?.id;
    life.current.slot = ticket;
    setView(null);
    setSaved(false);
    setBusy(true);
    setError(null);
    try {
      const result = await readNotificationPreferenceAction(language);
      if (!current(ticket, sessionId)) return;
      if (!result.ok) setError(result.code);
      else {
        try {
          accept(result.data);
        } catch {
          setError("STORAGE");
        }
      }
    } catch {
      if (current(ticket, sessionId)) setError("NOT_AVAILABLE");
    } finally {
      finish(ticket);
    }
  }, [active, clerk, subject, language, current, accept, finish]);
  useEffect(() => {
    const lifecycle = life.current;
    life.current.mounted = true;
    life.current.visible = document.visibilityState === "visible";
    let previous: string | null = null,
      observed = false;
    const conceal = () => {
      ++life.current.generation;
      life.current.slot = null;
      life.current.visible = false;
      setView(null);
      setSaved(false);
      setBusy(false);
      setError(null);
    };
    const restore = () => {
      if (document.visibilityState !== "visible") return;
      life.current.visible = true;
      void refresh();
    };
    const unsubscribe = clerk.addListener((resources) => {
      observed = true;
      const identity = [
        resources.user?.id ?? "",
        resources.session?.id ?? "",
        resources.session?.status ?? "",
      ].join(":");
      if (identity === previous) return;
      const changed = previous !== null;
      previous = identity;
      if (
        changed ||
        resources.user?.id !== subject ||
        resources.session?.status !== "active"
      )
        conceal();
      if (
        resources.user?.id === subject &&
        resources.session?.status === "active"
      )
        restore();
    });
    const visibility = () => {
      if (document.visibilityState === "hidden") conceal();
      else restore();
    };
    const restored = () => {
      conceal();
      restore();
    };
    const online = () => {
      if (life.current.visible) restore();
    };
    if (!observed) void refresh();
    window.addEventListener("blur", conceal);
    window.addEventListener("focus", restore);
    window.addEventListener("pageshow", restored);
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      lifecycle.mounted = false;
      ++lifecycle.generation;
      // A replacement effect owns a fresh read; an obsolete finalizer cannot release its slot.
      lifecycle.slot = null;
      unsubscribe();
      window.removeEventListener("blur", conceal);
      window.removeEventListener("focus", restore);
      window.removeEventListener("pageshow", restored);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [clerk, subject, refresh]);
  const change = async (settings?: NotificationPreferenceView["settings"]) => {
    if (
      !active() ||
      life.current.slot !== null ||
      !view ||
      (settings && attempt.current)
    )
      return;
    const command =
      attempt.current ??
      (settings
        ? {
            actorKey: view.actorKey,
            requestId: crypto.randomUUID(),
            expectedRevision: view.revision,
            language,
            ...settings,
            consentVersion: "email-notifications-v1" as const,
          }
        : null);
    if (!command || command.actorKey !== view.actorKey) return;
    try {
      sessionStorage.setItem(
        recoveryKey(command.actorKey),
        JSON.stringify(command),
      );
      if (
        JSON.stringify(
          recovered(sessionStorage.getItem(recoveryKey(command.actorKey))),
        ) !== JSON.stringify(command)
      )
        throw new Error("Recovery write");
    } catch {
      setError("STORAGE");
      return;
    }
    attempt.current = command;
    setPending(command);
    const ticket = ++life.current.generation,
      sessionId = clerk.session?.id;
    life.current.slot = ticket;
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      const result = await notificationPreferenceAction(command);
      if (!current(ticket, sessionId)) return;
      if (!result.ok) {
        setError(result.code);
        if (["INVALID_INPUT", "CONFLICT", "NOT_FOUND"].includes(result.code)) {
          sessionStorage.removeItem(recoveryKey(command.actorKey));
          attempt.current = null;
          setPending(null);
        }
        if (result.code !== "NOT_AVAILABLE") setView(null);
        return;
      }
      if (
        result.data.actorKey !== command.actorKey ||
        result.data.actorSubject !== subject ||
        result.data.requestId !== command.requestId
      ) {
        setView(null);
        setError("FORBIDDEN");
        return;
      }
      sessionStorage.removeItem(recoveryKey(command.actorKey));
      attempt.current = null;
      setPending(null);
      setView(null);
      const updated = await readNotificationPreferenceAction(language);
      if (!current(ticket, sessionId)) return;
      if (!updated.ok) setError(updated.code);
      else {
        try {
          if (accept(updated.data)) setSaved(true);
        } catch {
          setError("STORAGE");
        }
      }
    } catch {
      if (current(ticket, sessionId)) setError("NOT_AVAILABLE");
    } finally {
      finish(ticket);
    }
  };
  return { view, pending, error, busy, saved, refresh, change };
}
