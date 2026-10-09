"use client";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
import { usePathname, useSearchParams } from "next/navigation";
import { useInboxRefresh } from "../messaging/use-inbox-refresh";
import type { SellerResult } from "../sellers/errors";
import type { ServiceCommand, ServiceView } from "./model";
import type {
  PersonalProfileCommand,
  PersonalProfileView,
} from "./personal-profile-model";

type View = ServiceView | PersonalProfileView;
type Command = ServiceCommand | PersonalProfileCommand;
type Frame<T> = {
  source: T;
  actor: string;
  key: string;
  path: string;
  user: unknown;
  session: unknown;
  sessionId: string;
  authorized: boolean;
};
type Scope<T> = { frame: Frame<T>; beforeRead: T };
type Attempt<C, T> = {
  command: C;
  hash: string;
  inFlight: boolean;
  uncertain: boolean;
  beforeRead: T | null;
};

/** These settings editors retain human-owned drafts and exact command journals
 * in memory. Scope-tagged presentation never renders a former private owner. */
export function useSettingsSession<T extends View, C extends Command>(
  initial: T,
  actorSubject: string,
  load: () => Promise<SellerResult<T>>,
  save: (command: C) => Promise<SellerResult<T>>,
) {
  const clerk = useClerk(),
    auth = useAuth();
  usePathname();
  useSearchParams();
  const key =
      initial.sellerId +
      ("section" in initial ? ":" + initial.section : ":profile"),
    user = clerk.user,
    session = clerk.session,
    sessionStatus = session?.status,
    entry =
      typeof location === "undefined"
        ? ""
        : location.pathname + location.search;
  const frame = useMemo<Frame<T>>(
    () => ({
      source: initial,
      actor: actorSubject,
      key,
      path: entry,
      user,
      session,
      sessionId: auth.sessionId ?? "",
      authorized:
        auth.isLoaded &&
        auth.isSignedIn === true &&
        auth.userId === actorSubject &&
        user?.id === actorSubject &&
        !!auth.sessionId &&
        session?.id === auth.sessionId &&
        sessionStatus === "active",
    }),
    [
      initial,
      actorSubject,
      key,
      entry,
      user,
      session,
      sessionStatus,
      auth.isLoaded,
      auth.isSignedIn,
      auth.userId,
      auth.sessionId,
    ],
  );
  const { data, status, refresh } = useInboxRefresh(
    initial,
    actorSubject,
    load,
  );
  const visible =
    typeof document !== "undefined" && document.visibilityState === "visible";
  const [owned, setOwned] = useState({
      frame,
      scope:
        frame.authorized && visible
          ? ({ frame, beforeRead: initial } as Scope<T>)
          : null,
    }),
    [presentation, setPresentation] = useState({
      owner: null as Scope<T> | null,
      hidden: true,
      pending: false,
      notice: null as string | null,
      latest: null as T | null,
    }),
    [blockedAt, setBlockedAt] = useState<T | null>(null),
    // A snapshot exists throughout an uncertain/in-flight attempt. Known
    // outcomes remove it; interrupted frames keep its exact original fields.
    [journals, setJournals] = useState(
      new Map<string, { actor: string; command: C }>(),
    ),
    [discarded, setDiscarded] = useState(0);
  const attempts = useRef(new Map<string, Attempt<C, T>>());
  const scope = owned.frame === frame ? owned.scope : null;
  if (owned.frame !== frame) {
    setOwned({
      frame,
      scope: frame.authorized && visible ? { frame, beforeRead: data } : null,
    });
  }
  const life = useRef({
    mounted: false,
    visible: false,
    ready: false,
    generation: 0,
    nextOperation: 0,
    operation: null as number | null,
    frame,
    scope,
    key,
    data: initial,
    actor: actorSubject as string | null,
    restore: null as (() => void) | null,
  });
  const owns = (value: T) =>
    value.sellerId === initial.sellerId &&
    (!("section" in initial) ||
      ("section" in value && value.section === initial.section));
  const frameCurrent = () =>
    frame.authorized &&
    clerk.user === user &&
    clerk.user?.id === actorSubject &&
    clerk.session === session &&
    clerk.session?.id === frame.sessionId &&
    clerk.session.status === "active" &&
    typeof document !== "undefined" &&
    document.visibilityState === "visible" &&
    location.pathname + location.search === frame.path;
  const hidden =
    status !== "ready" ||
    !scope ||
    scope.frame !== frame ||
    !frameCurrent() ||
    !owns(data) ||
    data === scope.beforeRead ||
    blockedAt === data;
  if (presentation.owner !== scope || presentation.hidden !== hidden) {
    setPresentation({
      owner: scope,
      hidden,
      pending: false,
      notice: null,
      latest: null,
    });
  }
  const currentPresentation =
      presentation.owner === scope && presentation.hidden === hidden,
    retained =
      journals.get(key)?.actor === actorSubject
        ? journals.get(key)!.command
        : null,
    pending = !hidden && currentPresentation && presentation.pending,
    latest = !hidden && currentPresentation ? presentation.latest : null,
    notice =
      !hidden && currentPresentation
        ? (presentation.notice ??
          (!pending && retained ? "NOT_AVAILABLE" : null))
        : null;
  useLayoutEffect(() => {
    const current = life.current;
    if (current.frame !== frame || current.scope !== scope || hidden) {
      ++current.generation;
      current.operation = null;
      const attempt = attempts.current.get(current.key);
      if (attempt?.inFlight) {
        attempt.inFlight = false;
        attempt.uncertain = true;
        attempt.beforeRead = current.data;
      }
    }
    current.frame = frame;
    current.scope = scope;
    current.key = key;
    current.data = data;
    current.ready = !hidden;
    current.visible = scope !== null;
  }, [frame, scope, key, data, hidden]);
  useLayoutEffect(() => {
    const current = life.current;
    current.mounted = true;
    const invalidate = () => {
      ++current.generation;
      current.operation = null;
      current.ready = false;
      current.visible = false;
      const attempt = attempts.current.get(frame.key);
      if (attempt?.inFlight) {
        attempt.inFlight = false;
        attempt.uncertain = true;
        attempt.beforeRead = current.data;
      }
    };
    const conceal = () => {
      invalidate();
      setOwned({ frame, scope: null });
    };
    const checkHuman = () => {
      const subject = clerk.user?.id ?? null;
      if (subject !== current.actor) {
        attempts.current.clear();
        setJournals(new Map());
        setDiscarded((value) => value + 1);
        current.actor = subject;
      }
    };
    const restore = () => {
      if (
        !current.mounted ||
        current.frame !== frame ||
        !frame.authorized ||
        clerk.user !== frame.user ||
        clerk.session !== frame.session ||
        clerk.user?.id !== frame.actor ||
        clerk.session?.status !== "active" ||
        document.visibilityState !== "visible" ||
        location.pathname + location.search !== frame.path
      )
        return;
      const next: Scope<T> = { frame, beforeRead: current.data };
      current.scope = next;
      current.visible = true;
      setOwned({ frame, scope: next });
      setBlockedAt(null);
    };
    const resources = () => [
      clerk.user,
      clerk.session,
      clerk.user?.id,
      clerk.session?.id,
      clerk.session?.status,
    ];
    let previous = resources();
    current.restore = restore;
    const unsubscribe = clerk.addListener(() => {
      const next = resources();
      if (
        !current.mounted ||
        next.every((value, index) => value === previous[index])
      )
        return;
      previous = next;
      conceal();
      checkHuman();
      restore();
    });
    const restored = () => {
      conceal();
      restore();
    };
    const focus = () => {
      if (!current.visible) restore();
    };
    const pageshow = (event: PageTransitionEvent) => {
      if (event.persisted) restored();
    };
    document.addEventListener("visibilitychange", restored);
    window.addEventListener("blur", conceal);
    window.addEventListener("focus", focus);
    window.addEventListener("popstate", restored);
    window.addEventListener("pageshow", pageshow);
    return () => {
      // Cleanup invalidates external ownership only; it never resets React state.
      invalidate();
      current.mounted = false;
      current.restore = null;
      unsubscribe();
      document.removeEventListener("visibilitychange", restored);
      window.removeEventListener("blur", conceal);
      window.removeEventListener("focus", focus);
      window.removeEventListener("popstate", restored);
      window.removeEventListener("pageshow", pageshow);
    };
  }, [frame, clerk]);
  const callbackCurrent = () => {
    const current = life.current;
    return (
      current.mounted &&
      current.frame === frame &&
      current.scope === scope &&
      frameCurrent()
    );
  };
  const canEdit = () =>
    callbackCurrent() &&
    life.current.visible &&
    life.current.ready &&
    life.current.operation === null;
  const refreshSettings = () => {
    if (!callbackCurrent()) return;
    life.current.restore?.();
    void refresh(true);
  };
  const updatePresentation = (
    value: Partial<Omit<typeof presentation, "owner" | "hidden">>,
  ) => {
    const owner = life.current.scope;
    setPresentation((previous) => ({ ...previous, owner, ...value }));
  };
  const begin = () => {
    if (!canEdit() || !scope) return null;
    const current = life.current,
      operation = {
        scope,
        generation: current.generation,
        id: ++current.nextOperation,
      };
    current.operation = operation.id;
    updatePresentation({ pending: true, notice: null });
    return operation;
  };
  const here = (operation: NonNullable<ReturnType<typeof begin>>) => {
    const current = life.current;
    return (
      callbackCurrent() &&
      current.visible &&
      current.ready &&
      current.scope === operation.scope &&
      current.generation === operation.generation &&
      current.operation === operation.id
    );
  };
  const finish = (operation: NonNullable<ReturnType<typeof begin>>) => {
    if (!here(operation)) return;
    life.current.operation = null;
    updatePresentation({ pending: false });
  };
  const forget = () =>
    setJournals((previous) => {
      const next = new Map(previous);
      next.delete(key);
      return next;
    });
  const fail = (code: string) => {
    updatePresentation({ notice: code });
    if (["FORBIDDEN", "UNAUTHENTICATED", "NOT_FOUND"].includes(code))
      setBlockedAt(life.current.data);
  };
  async function submit(command: C, accept: (value: T) => void) {
    if (!canEdit()) return;
    let attempt = attempts.current.get(key);
    if (attempt?.uncertain && attempt.beforeRead === data) return;
    const hash = JSON.stringify({
      sellerId: command.sellerId,
      expectedRevision: command.expectedRevision,
      ...("section" in command
        ? { section: command.section, payload: command.payload }
        : { profile: command.profile }),
    });
    if (!attempt || (!attempt.uncertain && attempt.hash !== hash)) {
      attempt = {
        command: JSON.parse(JSON.stringify(command)) as C,
        hash,
        inFlight: false,
        uncertain: false,
        beforeRead: null,
      };
      attempts.current.set(key, attempt);
    }
    const operation = begin();
    if (!operation) return;
    const journal = attempt;
    journal.inFlight = true;
    setJournals((previous) =>
      new Map(previous).set(key, {
        actor: actorSubject,
        command: journal.command,
      }),
    );
    const uncertain = () => {
      journal.inFlight = false;
      journal.uncertain = true;
      journal.beforeRead = life.current.data;
      ++life.current.generation;
      life.current.operation = null;
      life.current.ready = false;
      const next: Scope<T> = { frame, beforeRead: life.current.data };
      life.current.scope = next;
      setOwned({ frame, scope: next });
      void refresh(true);
    };
    try {
      const result = await save(journal.command);
      if (!here(operation)) return;
      journal.inFlight = false;
      if (!result.ok) {
        if (result.code === "NOT_AVAILABLE") uncertain();
        else if (journal.uncertain) {
          // A denied retry does not identify the original request's outcome.
          // Keep its exact journal and require another current read.
          uncertain();
          fail(result.code);
        } else {
          journal.uncertain = false;
          forget();
          fail(result.code);
        }
        return;
      }
      if (!owns(result.data)) {
        uncertain();
        return;
      }
      accept(result.data);
      attempts.current.delete(key);
      forget();
      updatePresentation({ latest: null, notice: "SAVED" });
      await refresh();
    } catch {
      if (here(operation)) uncertain();
    } finally {
      finish(operation);
    }
  }
  async function compare() {
    const operation = begin();
    if (!operation) return;
    try {
      const result = await load();
      if (!here(operation)) return;
      if (result.ok && owns(result.data))
        updatePresentation({ latest: result.data });
      else fail(result.ok ? "NOT_AVAILABLE" : result.code);
    } catch {
      if (here(operation)) updatePresentation({ notice: "NOT_AVAILABLE" });
    } finally {
      finish(operation);
    }
  }
  function clearAttempt() {
    if (!canEdit()) return false;
    attempts.current.delete(key);
    forget();
    updatePresentation({ latest: null, notice: null });
    return true;
  }
  function edit() {
    if (retained || !canEdit()) return false;
    updatePresentation({ notice: null });
    return true;
  }
  return {
    data,
    status,
    hidden,
    denied: status === "denied" || blockedAt === data,
    pending,
    notice,
    latest,
    retained,
    uncertain: retained !== null,
    editKey: actorSubject + "\0" + key + "\0" + discarded,
    canEdit,
    edit,
    refresh: refreshSettings,
    submit,
    compare,
    clearAttempt,
  };
}
