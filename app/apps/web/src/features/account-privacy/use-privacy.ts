"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useClerk, useReverification } from "@clerk/nextjs";
import {
  changePrivacyAction,
  downloadPrivacyAction,
  readPrivacyAction,
} from "./actions";
import {
  decodePending,
  parsePrivacyCommand,
  type Acknowledgment,
  type PrivacyCode,
  type PrivacyCommand,
  type PrivacyOperation,
  type PrivacyView,
  PRIVACY_LIMITS,
} from "./model";
const recoveryKey = (actor: string) => "treido-privacy-request-v1:" + actor;
export function usePrivacy(subject: string) {
  const clerk = useClerk(),
    readVerified = useReverification(readPrivacyAction),
    changeVerified = useReverification(changePrivacyAction),
    downloadVerified = useReverification(downloadPrivacyAction);
  const [view, setView] = useState<PrivacyView | null>(null),
    [code, setCode] = useState<PrivacyCode | "STORAGE" | null>(null),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState<PrivacyCommand | null>(null),
    [acknowledgment, setAcknowledgment] = useState<Acknowledgment | null>(null);
  const live = useRef(false),
    started = useRef(false),
    working = useRef(false),
    pendingRef = useRef<PrivacyCommand | null>(null);
  const current = useCallback(
    () => live.current && clerk.user?.id === subject,
    [clerk, subject],
  );
  const acceptView = useCallback(
    (next: PrivacyView) => {
      if (!current()) return;
      setView(next);
      try {
        const recovered = decodePending(
          sessionStorage.getItem(recoveryKey(next.actorKey)),
        );
        if (recovered && recovered.actorKey === next.actorKey) {
          pendingRef.current = recovered;
          setPending(recovered);
        }
      } catch {
        setCode("STORAGE");
      }
    },
    [current],
  );
  const refresh = useCallback(
    async (prompt = true) => {
      if (working.current || !current()) return;
      working.current = true;
      setBusy(true);
      setCode(null);
      setView(null);
      try {
        const result = prompt
          ? await readVerified(true)
          : await readPrivacyAction(false);
        if (!current()) return;
        if (result && "ok" in result) {
          if (result.ok && result.data.subject === subject)
            acceptView(result.data.view);
          else if (!result.ok) setCode(result.code);
          else setCode("UNAUTHENTICATED");
        } else setCode("RECENT_AUTH_REQUIRED");
      } catch {
        if (current()) setCode("NOT_AVAILABLE");
      } finally {
        working.current = false;
        if (current()) setBusy(false);
      }
    },
    [current, readVerified, subject, acceptView],
  );
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void refresh(false);
  }, [refresh]);
  const execute = async (operation?: PrivacyOperation) => {
    if (
      working.current ||
      !current() ||
      !view ||
      (!operation && !pendingRef.current)
    )
      return;
    if (operation && pendingRef.current) return;
    let command: PrivacyCommand;
    try {
      command =
        pendingRef.current ??
        parsePrivacyCommand({
          version: 1,
          actorKey: view.actorKey,
          requestId: crypto.randomUUID(),
          expectedRevision: view.revision,
          operation,
        });
      if (command.actorKey !== view.actorKey) return;
      sessionStorage.setItem(
        recoveryKey(command.actorKey),
        JSON.stringify(command),
      );
      // Verify storage before the first server mutation; never send an unrecoverable new request.
      if (
        JSON.stringify(
          decodePending(sessionStorage.getItem(recoveryKey(command.actorKey))),
        ) !== JSON.stringify(command)
      )
        throw new Error("Recovery unavailable");
    } catch {
      setCode("STORAGE");
      return;
    }
    pendingRef.current = command;
    setPending(command);
    working.current = true;
    setBusy(true);
    setCode(null);
    setAcknowledgment(null);
    try {
      const result = await changeVerified(command);
      if (!current()) return;
      if (!result) {
        setCode("RECENT_AUTH_REQUIRED");
        return;
      }
      if (result.ok && result.data.subject === subject) {
        setAcknowledgment(result.data.change.acknowledgment);
        sessionStorage.removeItem(recoveryKey(command.actorKey));
        pendingRef.current = null;
        setPending(null);
        // An acknowledgment is immutable; separately fetch current state instead of substituting it.
        setView(null);
        const read = await readPrivacyAction(false);
        if (current() && "ok" in read) {
          if (read.ok && read.data.subject === subject)
            acceptView(read.data.view);
          else if (!read.ok) setCode(read.code);
        }
      } else if (!result.ok) {
        setCode(result.code);
        if (
          [
            "INVALID_INPUT",
            "CONFLICT",
            "NOT_FOUND",
            "EXPIRED",
            "QUOTA_EXCEEDED",
          ].includes(result.code)
        ) {
          sessionStorage.removeItem(recoveryKey(command.actorKey));
          pendingRef.current = null;
          setPending(null);
          setView(null);
        }
      } else {
        setView(null);
        setCode("UNAUTHENTICATED");
      }
    } catch {
      if (current()) setCode("NOT_AVAILABLE");
    } finally {
      working.current = false;
      if (current()) setBusy(false);
    }
  };
  const download = async (id: string) => {
    if (working.current || pendingRef.current || !current() || !view) return;
    working.current = true;
    setBusy(true);
    setCode(null);
    try {
      const result = await downloadVerified({ id, actorKey: view.actorKey });
      if (!current()) return;
      if (!result) {
        setCode("RECENT_AUTH_REQUIRED");
        return;
      }
      if (!result.ok) {
        setCode(result.code);
        return;
      }
      if (
        result.data.subject !== subject ||
        new TextEncoder().encode(result.data.body).byteLength >
          PRIVACY_LIMITS.bytes
      ) {
        setView(null);
        setCode("UNAUTHENTICATED");
        return;
      }
      const url = URL.createObjectURL(
        new Blob([result.data.body], { type: "application/json" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "treido-personal-data.json";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      if (current()) setCode("NOT_AVAILABLE");
    } finally {
      working.current = false;
      if (current()) setBusy(false);
    }
  };
  return {
    view,
    code,
    busy,
    pending,
    acknowledgment,
    refresh,
    execute,
    download,
  };
}
