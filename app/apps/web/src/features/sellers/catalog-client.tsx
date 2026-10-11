"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { changeCatalogAction } from "./catalog-organization-actions";
import { parseCatalogCommand, type CatalogAcknowledgement, type CatalogCommand } from "./catalog-organization-model";
import { clearPrivateBuffers, registerPrivateBuffer } from "./private-recovery";
import type { SellerErrorCode } from "./errors";
import admin from "./admin.module.css";
import management from "./admin-product-management.module.css";

type Edit<T> = T extends unknown ? Omit<T, "sellerId" | "requestId"> : never;
export type CatalogEdit = Edit<CatalogCommand>;
type Ticket = { route: string; sessionId: string };
const messages: Record<SellerErrorCode, readonly [string, string]> = {
  UNAUTHENTICATED: ["Sign in again to continue.", "Влез отново, за да продължиш."],
  FORBIDDEN: ["You no longer have access to this seller action.", "Вече нямаш достъп до това действие."],
  NOT_FOUND: ["This product or collection is no longer available. Reload to see the current catalog.", "Продуктът или колекцията вече не е достъпен. Презареди актуалния каталог."],
  INVALID_INPUT: ["Check the fields and selection. Use up to 20 tags, each no longer than 40 characters.", "Провери полетата и избора. Използвай до 20 етикета, всеки до 40 знака."],
  CONFLICT: ["The saved version changed. Reload before editing it again. An unconfirmed save must be retried first.", "Запазената версия е променена. Презареди я преди нова редакция. Първо повтори непотвърденото запазване."],
  QUOTA_EXCEEDED: ["This action exceeds the account's current allowance.", "Действието надвишава текущите възможности на акаунта."],
  NOT_AVAILABLE: ["The save could not be confirmed. Retry confirmation; the same request cannot run twice.", "Запазването не е потвърдено. Повтори потвърждението; същата заявка няма да се изпълни два пъти."],
};
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("treido-draft-buffer-changed", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("treido-draft-buffer-changed", listener);
  };
}
function stored(key: string): string | null {
  try {
    const raw = localStorage.getItem(key);
    return raw && raw.length <= 32768 ? raw : null;
  } catch { return null; }
}
function decode(raw: string | null, sellerId: string): CatalogCommand | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    const command = parseCatalogCommand(value);
    return command?.sellerId === sellerId ? command : null;
  } catch { return null; }
}
export function useCatalogMutation(actorSubject: string, sellerId: string, bufferKey: string) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const clerk = useClerk();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<SellerErrorCode | null>(null);
  const [denied, setDenied] = useState(false);
  const mounted = useRef(false);
  const busy = useRef(false);
  const memory = useRef<CatalogCommand | null>(null);
  const key = `treido-draft:${bufferKey}`;
  const raw = useSyncExternalStore(subscribe, () => stored(key), () => null);
  const recovered = decode(raw, sellerId);
  const changedActor = isLoaded && (!isSignedIn || userId !== actorSubject || clerk.user?.id !== actorSubject);
  const ready = isLoaded && isSignedIn && !changedActor && !denied && clerk.session?.status === "active";
  useEffect(() => {
    mounted.current = true;
    registerPrivateBuffer(actorSubject, key, sellerId);
    return () => { mounted.current = false; };
  }, [actorSubject, key, sellerId]);
  useEffect(() => {
    if (changedActor || denied) {
      memory.current = null;
      clearPrivateBuffers(actorSubject, sellerId);
    }
  }, [changedActor, denied, actorSubject, sellerId]);
  function capture(): Ticket | null {
    if (!ready || !clerk.session?.id) return null;
    return { route: location.pathname + location.search, sessionId: clerk.session.id };
  }
  function current(ticket: Ticket | null) {
    return !!ticket && mounted.current && clerk.user?.id === actorSubject && clerk.session?.id === ticket.sessionId && clerk.session?.status === "active" && location.pathname + location.search === ticket.route;
  }
  function report(code: SellerErrorCode) {
    setError(code);
    if (["FORBIDDEN", "UNAUTHENTICATED"].includes(code)) setDenied(true);
  }
  function persist(command: CatalogCommand | null) {
    memory.current = command;
    try {
      if (command) localStorage.setItem(key, JSON.stringify(command));
      else localStorage.removeItem(key);
      window.dispatchEvent(new Event("treido-draft-buffer-changed"));
    } catch { /* A blocked browser store never substitutes for server persistence. */ }
  }
  async function send(command: CatalogCommand): Promise<CatalogAcknowledgement | null> {
    const ticket = capture();
    if (!ticket || busy.current) return null;
    busy.current = true;
    setPending(true);
    setError(null);
    persist(command);
    try {
      const result = await changeCatalogAction(command);
      if (!current(ticket)) return null;
      if (!result.ok) {
        if (result.code !== "NOT_AVAILABLE") persist(null);
        report(result.code);
        return null;
      }
      persist(null);
      return result.data;
    } catch {
      if (current(ticket)) report("NOT_AVAILABLE");
      return null;
    } finally {
      busy.current = false;
      if (current(ticket)) setPending(false);
    }
  }
  async function run(edit: CatalogEdit) {
    const previous = memory.current ?? decode(stored(key), sellerId);
    const command = parseCatalogCommand({ ...edit, sellerId, requestId: previous?.requestId ?? crypto.randomUUID() });
    if (!command) { report("INVALID_INPUT"); return null; }
    if (previous && JSON.stringify(previous) !== JSON.stringify(command)) { report("CONFLICT"); return null; }
    return send(previous ?? command);
  }
  async function retry() {
    const command = memory.current ?? decode(stored(key), sellerId);
    return command ? send(command) : null;
  }
  return { ready, denied: denied || changedActor, pending, error, recovered: recovered ?? memory.current, capture, current, report, run, retry };
}
export function CatalogFeedback({ task, language, onRecovered }: {
  task: ReturnType<typeof useCatalogMutation>;
  language: "bg" | "en";
  onRecovered: (result: CatalogAcknowledgement) => void | Promise<void>;
}) {
  const bg = language === "bg";
  return <>
    {task.error && <p className={management.feedback} role="alert">{messages[task.error][bg ? 1 : 0]}</p>}
    {task.recovered && !task.pending && !task.denied && <div className={management.feedback}>
      <p>{bg ? "Има непотвърдено запазване. Потвърди резултата преди нови промени." : "A save is awaiting confirmation. Confirm its result before making more changes."}</p>
      <button type="button" className={admin.secondary} disabled={!task.ready} onClick={async () => {
        const result = await task.retry();
        if (result) await onRecovered(result);
      }}>{bg ? "Потвърди запазването" : "Retry confirmation"}</button>
    </div>}
  </>;
}
