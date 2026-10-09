"use client";
import { capabilityMessageKey } from "./model";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
import { usePathname, useSearchParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useInboxRefresh } from "../messaging/use-inbox-refresh";
import { useUnsavedChanges } from "../sellers/use-unsaved-changes";
import type { SellerCapability } from "../sellers/capabilities";
import { changeTeamAction, readTeamAction } from "./actions";
import type { TeamCommand, TeamRole, TeamView } from "./model";
import a from "../sellers/admin.module.css";
import s from "./team.module.css";

type Edit = {
  kind: TeamCommand["kind"];
  expectedRevision: number;
  recipient: string;
  role: TeamRole;
  grants: SellerCapability[];
  language: "bg" | "en";
  userId?: string;
  invitationId?: string;
};
type Scope = {
  actor: string;
  seller: string;
  initial: TeamView;
  language: "bg" | "en";
  path: string;
  sessionId: string;
  session: unknown;
  user: unknown;
  beforeRead: TeamView;
};
type Attempt = {
  command: TeamCommand;
  edit: Edit;
  hash: string;
  uncertain: boolean;
  inFlight: boolean;
  beforeRetryRead: TeamView | null;
};
type Operation = { scope: Scope; generation: number; id: number };
type ViewFrame = { scope: Scope | null; status: string };
type OwnedValue<T> = { owner: ViewFrame; value: T };
type DraftValue<T> = { actor: string; seller: string; value: T };
type Recovery = {
  actor: string;
  scope: Scope;
  data: TeamView;
  edit: Edit;
  uncertain: boolean;
  inFlight: boolean;
  code: string | null;
};
export function teamError(code: string) {
  return code === "CONFLICT"
    ? "conflict"
    : code === "QUOTA_EXCEEDED"
      ? "quota"
      : code === "INVALID_INPUT"
        ? "invalid"
        : ["FORBIDDEN", "UNAUTHENTICATED", "NOT_FOUND"].includes(code)
          ? "denied"
          : "unavailable";
}
export function Team({
  initial,
  actorSubject,
  language,
}: {
  initial: TeamView;
  actorSubject: string;
  language: "bg" | "en";
}) {
  const t = useTranslations("team"),
    format = useFormatter(),
    clerk = useClerk(),
    auth = useAuth(),
    pathname = usePathname(),
    query = useSearchParams().toString();
  const sellerId = initial.sellerId;
  const load = useCallback(() => readTeamAction(sellerId), [sellerId]);
  const { data, status, refresh } = useInboxRefresh(
    initial,
    actorSubject,
    load,
  );
  const entry =
    typeof location === "undefined" ? "" : location.pathname + location.search;
  const frameScope = useMemo<Scope>(
    () => ({
      actor: actorSubject,
      seller: sellerId,
      initial,
      language,
      path: entry,
      sessionId: auth.sessionId ?? "",
      session: clerk.session,
      user: clerk.user,
      beforeRead: initial,
    }),
    [
      actorSubject,
      sellerId,
      initial,
      language,
      entry,
      auth.sessionId,
      clerk.session,
      clerk.user,
    ],
  );
  const [scopeState, setScopeState] = useState<{
      owner: Scope;
      value: Scope | null;
    } | null>(null),
    [editState, setEditState] = useState<DraftValue<Edit | null> | null>(null),
    [baselineState, setBaselineState] = useState<DraftValue<string> | null>(
      null,
    ),
    [uncertainState, setUncertainState] = useState<DraftValue<boolean> | null>(
      null,
    ),
    [recoveries, setRecoveries] = useState(() => new Map<string, Recovery>());
  const scope =
    scopeState?.owner === frameScope ? scopeState.value : frameScope;
  const viewFrame = useMemo(() => ({ scope, status }), [scope, status]);
  const [pendingState, setPendingState] = useState<OwnedValue<boolean> | null>(
      null,
    ),
    [errorState, setErrorState] = useState<OwnedValue<string | null> | null>(
      null,
    ),
    [noticeState, setNoticeState] = useState<OwnedValue<string> | null>(null),
    [latestState, setLatestState] =
      useState<OwnedValue<TeamView | null> | null>(null),
    [blockedState, setBlockedState] = useState<OwnedValue<boolean> | null>(
      null,
    );
  const recovery = recoveries.get(sellerId);
  const interrupted =
    !!recovery &&
    recovery.actor === actorSubject &&
    (recovery.uncertain ||
      (recovery.inFlight &&
        (recovery.scope !== scope || recovery.data !== data)));
  const ownsDraft = <T,>(value: DraftValue<T> | null): value is DraftValue<T> =>
    !!value && value.actor === actorSubject && value.seller === sellerId;
  const uncertain =
    interrupted || (ownsDraft(uncertainState) && !!uncertainState?.value);
  const edit =
    interrupted &&
    recovery &&
    !(ownsDraft(editState) && editState.value === null)
      ? recovery.edit
      : ownsDraft(editState)
        ? editState.value
        : null;
  const baseline =
    interrupted && recovery
      ? JSON.stringify(recovery.edit)
      : ownsDraft(baselineState)
        ? baselineState.value
        : "";
  const pending = pendingState?.owner === viewFrame && pendingState.value;
  const error =
    errorState?.owner === viewFrame
      ? errorState.value
      : uncertain
        ? recovery?.code === "CONFLICT"
          ? "CONFLICT"
          : "NOT_AVAILABLE"
        : null;
  const notice = noticeState?.owner === viewFrame ? noticeState.value : "";
  const latest = latestState?.owner === viewFrame ? latestState.value : null;
  const blocked = blockedState?.owner === viewFrame && blockedState.value;
  function setEdit(value: Edit | null) {
    if (!currentEditor()) return;
    setEditState({ actor: actorSubject, seller: sellerId, value });
  }
  function setBaseline(value: string) {
    if (!currentEditor()) return;
    setBaselineState({ actor: actorSubject, seller: sellerId, value });
  }
  function setUncertain(value: boolean) {
    if (!currentEditor()) return;
    setUncertainState({ actor: actorSubject, seller: sellerId, value });
  }
  function setPending(value: boolean) {
    setPendingState({ owner: viewFrame, value });
  }
  function setError(value: string | null) {
    setErrorState({ owner: viewFrame, value });
  }
  function setNotice(value: string) {
    setNoticeState({ owner: viewFrame, value });
  }
  function setLatest(value: TeamView | null) {
    setLatestState({ owner: viewFrame, value });
  }
  function setBlocked(value: boolean) {
    setBlockedState({ owner: viewFrame, value });
  }
  const life = useRef({
      mounted: false,
      visible: false,
      generation: 0,
      operation: null as number | null,
      nextOperation: 0,
      scope: null as Scope | null,
      ready: false,
      data: initial,
      actor: actorSubject,
      restore: null as (() => void) | null,
      frame: frameScope,
      view: viewFrame,
    }),
    dialog = useRef<HTMLDialogElement>(null),
    // Memory only, scoped to this human and seller. Never automatically resend.
    attempts = useRef(new Map<string, Attempt>());
  const matches = useCallback(
    (value: Scope) =>
      value.actor === actorSubject &&
      value.seller === sellerId &&
      value.initial === initial &&
      value.language === language &&
      value.path === entry &&
      auth.isLoaded &&
      auth.isSignedIn &&
      auth.userId === actorSubject &&
      auth.sessionId === value.sessionId &&
      clerk.user === value.user &&
      clerk.user?.id === actorSubject &&
      clerk.session === value.session &&
      clerk.session?.id === value.sessionId &&
      clerk.session.status === "active" &&
      typeof document !== "undefined" &&
      document.visibilityState === "visible" &&
      location.pathname + location.search === value.path,
    [
      actorSubject,
      sellerId,
      initial,
      language,
      entry,
      auth.isLoaded,
      auth.isSignedIn,
      auth.userId,
      auth.sessionId,
      clerk,
    ],
  );
  const hidden =
    status !== "ready" ||
    blocked ||
    !scope ||
    !matches(scope) ||
    data.sellerId !== sellerId ||
    data === scope.beforeRead;
  const dirty = Boolean(
    edit &&
    (edit.kind === "invite" || edit.kind === "change") &&
    JSON.stringify(edit) !== baseline,
  );
  useUnsavedChanges(dirty && !hidden, language);
  useLayoutEffect(() => {
    const current = life.current;
    current.data = data;
    current.view = viewFrame;
    current.scope = scope;
    current.ready = !hidden;
    if (hidden) {
      if (current.operation !== null) {
        ++current.generation;
        current.operation = null;
      }
      const attempt = attempts.current.get(sellerId);
      if (attempt?.inFlight) {
        attempt.inFlight = false;
        attempt.uncertain = true;
        attempt.beforeRetryRead = data;
      }
      dialog.current?.close();
    }
  }, [data, hidden, sellerId, scope, viewFrame]);
  useLayoutEffect(() => {
    const current = life.current;
    current.mounted = true;
    current.frame = frameScope;
    const invalidate = () => {
      ++current.generation;
      current.operation = null;
      current.ready = false;
      current.visible = false;
      const attempt = attempts.current.get(sellerId);
      if (attempt?.inFlight) {
        attempt.inFlight = false;
        attempt.uncertain = true;
        attempt.beforeRetryRead = current.data;
      }
      dialog.current?.close();
    };
    const conceal = () => {
      invalidate();
      setScopeState({ owner: frameScope, value: null });
      const attempt = attempts.current.get(sellerId);
      if (attempt?.uncertain) {
        setRecoveries((previous) => {
          const record = previous.get(sellerId);
          if (!record || record.actor !== actorSubject) return previous;
          const next = new Map(previous);
          next.set(sellerId, { ...record, uncertain: true, inFlight: false });
          return next;
        });
      }
    };
    const checkHuman = () => {
      const subject = clerk.user?.id;
      if (subject && subject !== current.actor) {
        attempts.current.clear();
        setRecoveries(new Map());
        setEditState(null);
        setBaselineState(null);
        setUncertainState(null);
        current.actor = subject;
      }
    };
    const restore = () => {
      if (!current.mounted || document.visibilityState !== "visible") return;
      const subject = clerk.user?.id;
      checkHuman();
      if (
        !auth.isLoaded ||
        subject !== actorSubject ||
        !clerk.session?.id ||
        clerk.session.status !== "active"
      )
        return;
      const next: Scope = {
        actor: actorSubject,
        seller: sellerId,
        initial,
        language,
        path: location.pathname + location.search,
        user: clerk.user,
        session: clerk.session,
        sessionId: clerk.session.id,
        beforeRead: current.data,
      };
      current.scope = next;
      current.visible = true;
      setScopeState({ owner: frameScope, value: next });
    };
    const resources = () => [
      clerk.user,
      clerk.session,
      clerk.user?.id,
      clerk.session?.id,
      clerk.session?.status,
    ];
    current.restore = restore;
    let previous = resources();
    const unsubscribe = clerk.addListener(() => {
      const next = resources();
      if (
        !current.mounted ||
        next.every((value, index) => value === previous[index])
      )
        return;
      previous = next;
      conceal();
      // Clear another human's private draft even while the document is hidden.
      checkHuman();
      restore();
    });
    const visibility = () => {
      conceal();
      restore();
    };
    const focus = () => {
      if (!current.visible) restore();
    };
    const pageshow = (event: PageTransitionEvent) => {
      if (event.persisted) visibility();
    };
    // Commit refs only. Rendered state belongs to scope/status owners; external
    // events and explicit actions update it, never an effect-time reset.
    invalidate();
    current.scope = scope;
    current.visible = document.visibilityState === "visible";
    current.ready = !hidden;
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", conceal);
    window.addEventListener("focus", focus);
    window.addEventListener("popstate", visibility);
    window.addEventListener("pageshow", pageshow);
    return () => {
      invalidate();
      current.mounted = false;
      current.restore = null;
      unsubscribe();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", conceal);
      window.removeEventListener("focus", focus);
      window.removeEventListener("popstate", visibility);
      window.removeEventListener("pageshow", pageshow);
    };
  }, [
    actorSubject,
    sellerId,
    initial,
    language,
    pathname,
    query,
    auth.isLoaded,
    auth.userId,
    auth.sessionId,
    clerk,
    frameScope,
    scope,
    hidden,
  ]);
  function currentEditor() {
    return (
      !!scope &&
      life.current.mounted &&
      life.current.visible &&
      life.current.ready &&
      life.current.view === viewFrame &&
      life.current.scope === scope &&
      matches(scope)
    );
  }
  function captureRecovery(
    attempt: Attempt,
    owner: Scope,
    code: string | null = null,
  ) {
    const record: Recovery = {
      actor: actorSubject,
      scope: owner,
      data,
      edit: { ...attempt.edit, grants: [...attempt.edit.grants] },
      uncertain: attempt.uncertain,
      inFlight: attempt.inFlight,
      code,
    };
    setRecoveries((previous) => {
      const next = new Map(previous);
      next.set(sellerId, record);
      return next;
    });
  }
  function clearRecovery() {
    setRecoveries((previous) => {
      const next = new Map(previous);
      next.delete(sellerId);
      return next;
    });
  }
  const editing = edit !== null;
  useEffect(() => {
    const node = dialog.current;
    if (editing && !hidden && !node?.open) node?.showModal();
    else if (hidden) node?.close();
    return () => node?.close();
  }, [editing, hidden]);
  const cap = (value: string) => t(capabilityMessageKey(value));
  function open(value: Partial<Edit> & { kind: Edit["kind"] }) {
    if (hidden || !currentEditor() || life.current.operation !== null) return;
    const retained = attempts.current.get(sellerId);
    if (retained?.uncertain) {
      setEdit(retained.edit);
      setBaseline(JSON.stringify(retained.edit));
      setError(recovery?.code === "CONFLICT" ? "CONFLICT" : "NOT_AVAILABLE");
      setUncertain(true);
      return;
    }
    const next: Edit = {
      expectedRevision: data.revision,
      recipient: "",
      role: "member",
      grants: ["seller.read"],
      language,
      ...value,
    };
    setBaseline(JSON.stringify(next));
    attempts.current.delete(sellerId);
    clearRecovery();
    setUncertain(false);
    setError(null);
    setNotice("");
    setLatest(null);
    setEdit(next);
  }
  function begin(): Operation | null {
    const current = life.current;
    if (
      hidden ||
      !current.mounted ||
      !current.visible ||
      !current.ready ||
      current.view !== viewFrame ||
      !scope ||
      current.scope !== scope ||
      !matches(scope) ||
      current.operation !== null
    )
      return null;
    const id = ++current.nextOperation;
    current.operation = id;
    setPending(true);
    return { scope, generation: current.generation, id };
  }
  function here(operation: Operation) {
    return (
      life.current.mounted &&
      life.current.visible &&
      life.current.ready &&
      life.current.scope === operation.scope &&
      life.current.generation === operation.generation &&
      life.current.operation === operation.id &&
      matches(operation.scope)
    );
  }
  function finish(operation: Operation) {
    if (!here(operation)) return;
    life.current.operation = null;
    setPending(false);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!edit) return;
    const retained = attempts.current.get(sellerId);
    if (retained?.uncertain && retained.beforeRetryRead === data) return;
    const operation = begin();
    if (!operation) return;
    const base = {
      sellerId,
      expectedRevision: edit.expectedRevision,
      requestId: crypto.randomUUID(),
    };
    const command: TeamCommand =
      edit.kind === "invite"
        ? {
            ...base,
            kind: "invite",
            recipient: edit.recipient,
            language: edit.language,
            access: { role: edit.role, grants: [...edit.grants] },
          }
        : edit.kind === "change"
          ? {
              ...base,
              kind: "change",
              userId: edit.userId!,
              access: { role: edit.role, grants: [...edit.grants] },
            }
          : edit.kind === "revoke"
            ? { ...base, kind: "revoke", userId: edit.userId! }
            : { ...base, kind: edit.kind, invitationId: edit.invitationId! };
    const hash = JSON.stringify({ ...command, requestId: null });
    let attempt = attempts.current.get(sellerId);
    if (!attempt || (!attempt.uncertain && attempt.hash !== hash)) {
      attempt = {
        hash,
        command,
        edit: { ...edit, grants: [...edit.grants] },
        uncertain: false,
        inFlight: false,
        beforeRetryRead: null,
      };
      attempts.current.set(sellerId, attempt);
    }
    attempt.inFlight = true;
    // An explicit retry restores this seller's original draft even if another
    // seller's editor was opened during the interruption.
    setEdit({ ...attempt.edit, grants: [...attempt.edit.grants] });
    captureRecovery(attempt, operation.scope);
    setError(null);
    try {
      const result = await changeTeamAction(attempt.command);
      if (!here(operation)) return;
      attempt.inFlight = false;
      if (!result.ok) {
        attempt.uncertain =
          attempt.uncertain ||
          !["CONFLICT", "INVALID_INPUT", "QUOTA_EXCEEDED"].includes(
            result.code,
          );
        setUncertain(attempt.uncertain);
        if (attempt.uncertain) attempt.beforeRetryRead = data;
        captureRecovery(attempt, operation.scope, result.code);
        setError(result.code);
        if (teamError(result.code) === "denied") setBlocked(true);
        else if (attempt.uncertain) void refresh(true);
        return;
      }
      if (result.data.sellerId !== sellerId) {
        attempt.uncertain = true;
        attempt.beforeRetryRead = data;
        captureRecovery(attempt, operation.scope, "NOT_AVAILABLE");
        setUncertain(true);
        setError("NOT_AVAILABLE");
        void refresh(true);
        return;
      }
      attempts.current.delete(sellerId);
      clearRecovery();
      setUncertain(false);
      setEdit(null);
      setNotice(t("done"));
      await refresh();
    } catch {
      if (here(operation)) {
        attempt.inFlight = false;
        attempt.uncertain = true;
        attempt.beforeRetryRead = data;
        captureRecovery(attempt, operation.scope, "NOT_AVAILABLE");
        setUncertain(true);
        setError("NOT_AVAILABLE");
        void refresh(true);
      }
    } finally {
      finish(operation);
    }
  }
  async function compare() {
    const operation = begin();
    if (!operation) return;
    try {
      const result = await readTeamAction(sellerId);
      if (!here(operation)) return;
      if (result.ok && result.data.sellerId === sellerId)
        setLatest(result.data);
      else if (result.ok) setError("NOT_AVAILABLE");
      else {
        setError(result.code);
        if (teamError(result.code) === "denied") setBlocked(true);
      }
    } catch {
      if (here(operation)) setError("NOT_AVAILABLE");
    } finally {
      finish(operation);
    }
  }
  async function copy(invitationId: string) {
    if (
      !data.invitations.some(
        (value) => value.id === invitationId && value.canManage,
      )
    )
      return;
    const operation = begin();
    if (!operation) return;
    try {
      await navigator.clipboard.writeText(
        location.origin +
          "/app/invitations/" +
          invitationId +
          "?lang=" +
          language,
      );
      if (here(operation)) setNotice(t("copied"));
    } catch {
      if (here(operation)) setError("NOT_AVAILABLE");
    } finally {
      finish(operation);
    }
  }
  return (
    <main>
      <header className={a.pageBar}>
        <h1>{t("title")}</h1>
        <div className={s.actions}>
          <button
            className={a.secondary}
            onClick={() => {
              if (
                life.current.frame !== frameScope ||
                life.current.view !== viewFrame ||
                !matches(frameScope)
              )
                return;
              life.current.restore?.();
              setBlocked(false);
              void refresh(true);
            }}
            disabled={pending}
          >
            {t("retry")}
          </button>
          <button
            className={a.primary}
            disabled={
              hidden ||
              pending ||
              (!uncertain && data.usedSeats + data.reservedSeats >= data.seats)
            }
            onClick={() => open({ kind: "invite" })}
          >
            {t("invite")}
          </button>
        </div>
      </header>
      <div className={a.pageBody}>
        {hidden && (
          <section className={s.card} role="status">
            <p>
              {t(
                blocked || status === "denied"
                  ? "denied"
                  : status === "checking"
                    ? "checking"
                    : "unavailable",
              )}
            </p>
            <Link href={"/app?lang=" + language}>{t("chooseBusiness")}</Link>
          </section>
        )}
        {!hidden && (
          <div className={s.stack} data-team>
            <section className={s.card}>
              <div className={s.toolbar}>
                <h2>{data.name}</h2>
                <span>
                  {t("seats", {
                    used: data.usedSeats,
                    reserved: data.reservedSeats,
                    limit: data.seats,
                  })}
                </span>
              </div>
              <p>{t("intro")}</p>
              <p className={s.muted}>{t("seatNote")}</p>
            </section>
            {notice && (
              <p className={s.notice} role="status">
                {notice}
              </p>
            )}
            {error && !edit && (
              <p className={s.notice} role="alert">
                {t(teamError(error))}
              </p>
            )}
            <section className={s.card}>
              <h2>{t("members")}</h2>
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>{t("person")}</th>
                      <th>{t("role")}</th>
                      <th>{t("status")}</th>
                      <th>{t("actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.members.map((member) => (
                      <tr key={member.userId}>
                        <td>
                          {member.self
                            ? t("you")
                            : t("memberId", { id: member.userId.slice(0, 8) })}
                          <details>
                            <summary>{t("permissions")}</summary>
                            {member.role === "owner" ? (
                              <p>{t("ownerAccess")}</p>
                            ) : (
                              <ul className={s.permissions}>
                                {[
                                  ...new Set([
                                    ...member.grants,
                                    ...(member.role === "manager"
                                      ? data.managerDefaults
                                      : []),
                                  ]),
                                ].map((c) => (
                                  <li key={c}>{cap(c)}</li>
                                ))}
                              </ul>
                            )}
                          </details>
                        </td>
                        <td>{t(member.role)}</td>
                        <td>{t(member.status)}</td>
                        <td>
                          <div className={s.actions}>
                            {member.canChange && (
                              <button
                                className={a.secondary}
                                onClick={() =>
                                  open({
                                    kind: "change",
                                    userId: member.userId,
                                    role: member.role as TeamRole,
                                    grants: [...member.grants],
                                  })
                                }
                              >
                                {t("edit")}
                              </button>
                            )}
                            {member.canRevoke && (
                              <button
                                className={a.secondary}
                                onClick={() =>
                                  open({
                                    kind: "revoke",
                                    userId: member.userId,
                                  })
                                }
                              >
                                {t("revoke")}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className={s.muted}>{t("ownerNote")}</p>
            </section>
            <section className={s.card}>
              <h2>{t("invitations")}</h2>
              <p className={s.muted}>{t("mailNote")}</p>
              {!data.invitations.length && <p>{t("empty")}</p>}
              {data.invitations.map((invitation) => (
                <article key={invitation.id} className={s.card}>
                  <div className={s.toolbar}>
                    <strong>{invitation.recipient}</strong>
                    <span>{t(invitation.status)}</span>
                  </div>
                  <p>
                    {t(invitation.role)} ·{" "}
                    {t("expires", {
                      date: format.dateTime(new Date(invitation.expiresAt), {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }),
                    })}
                  </p>
                  <p className={s.muted}>
                    {t(
                      (
                        {
                          pending: "deliveryPending",
                          submitted: "deliverySubmitted",
                          sent: "deliverySent",
                          delivered: "deliveryDelivered",
                          bounced: "deliveryBounced",
                          failed: "deliveryFailed",
                          complained: "deliveryComplained",
                          unavailable: "deliveryUnavailable",
                          uncertain: "deliveryUncertain",
                          cancelled: "deliveryCancelled",
                        } as const
                      )[invitation.delivery],
                    )}
                  </p>
                  <details>
                    <summary>{t("permissions")}</summary>
                    <ul className={s.permissions}>
                      {[
                        ...new Set([
                          ...invitation.grants,
                          ...(invitation.role === "manager"
                            ? data.managerDefaults
                            : []),
                        ]),
                      ].map((c) => (
                        <li key={c}>{cap(c)}</li>
                      ))}
                    </ul>
                  </details>
                  {invitation.canManage && (
                    <div className={s.actions}>
                      <button
                        className={a.secondary}
                        onClick={() => void copy(invitation.id)}
                      >
                        {t("copy")}
                      </button>
                      <button
                        className={a.secondary}
                        disabled={!invitation.canResendMail || pending}
                        onClick={() =>
                          open({
                            kind: "resend",
                            invitationId: invitation.id,
                            recipient: invitation.recipient,
                          })
                        }
                      >
                        {t("resend")}
                      </button>
                      {invitation.canRetryMail && (
                        <button
                          className={a.secondary}
                          disabled={pending}
                          onClick={() =>
                            open({
                              kind: "retry-mail",
                              invitationId: invitation.id,
                              recipient: invitation.recipient,
                            })
                          }
                        >
                          {t("retryMail")}
                        </button>
                      )}
                      {invitation.delivery === "uncertain" &&
                        !invitation.canRetryMail && (
                          <p className={s.muted}>{t("uncertainMailNote")}</p>
                        )}
                      <button
                        className={a.secondary}
                        onClick={() =>
                          open({
                            kind: "cancel",
                            invitationId: invitation.id,
                            recipient: invitation.recipient,
                          })
                        }
                      >
                        {t("cancelInvite")}
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </section>
          </div>
        )}
      </div>
      {edit && !hidden && (
        <dialog
          ref={dialog}
          className={s.dialog}
          aria-labelledby="team-dialog-title"
          onCancel={(event) => {
            event.preventDefault();
            if (!pending) setEdit(null);
          }}
        >
          <form onSubmit={submit}>
            <header>
              <h2 id="team-dialog-title">
                {t(
                  edit.kind === "invite"
                    ? "invite"
                    : edit.kind === "change"
                      ? "edit"
                      : edit.kind === "revoke"
                        ? "revoke"
                        : edit.kind === "resend"
                          ? "resend"
                          : edit.kind === "retry-mail"
                            ? "retryMail"
                            : "cancelInvite",
                )}
              </h2>
              <button
                type="button"
                className={a.secondary}
                disabled={pending}
                onClick={() => setEdit(null)}
              >
                {t("close")}
              </button>
            </header>
            <div className={s.dialogBody}>
              <fieldset
                className={s.form}
                disabled={pending || hidden || uncertain}
              >
                {edit.kind === "invite" || edit.kind === "change" ? (
                  <>
                    {edit.kind === "invite" && (
                      <>
                        <label className={s.field}>
                          {t("recipient")}
                          <input
                            type="email"
                            required
                            maxLength={254}
                            value={edit.recipient}
                            onChange={(e) =>
                              setEdit({ ...edit, recipient: e.target.value })
                            }
                          />
                        </label>
                        <label className={s.field}>
                          {t("language")}
                          <select
                            value={edit.language}
                            onChange={(e) =>
                              setEdit({
                                ...edit,
                                language: e.target.value as "bg" | "en",
                              })
                            }
                          >
                            <option value="bg">{t("bulgarian")}</option>
                            <option value="en">{t("english")}</option>
                          </select>
                        </label>
                      </>
                    )}
                    <label className={s.field}>
                      {t("role")}
                      <select
                        value={edit.role}
                        onChange={(e) => {
                          const role = e.target.value as TeamRole;
                          setEdit({
                            ...edit,
                            role,
                            grants: [
                              ...new Set([
                                ...edit.grants.filter(
                                  (c) =>
                                    role === "manager" || c !== "team.manage",
                                ),
                                ...(role === "manager"
                                  ? data.managerDefaults
                                  : []),
                              ]),
                            ],
                          });
                        }}
                      >
                        <option value="member">{t("member")}</option>
                        <option
                          value="manager"
                          disabled={!data.canInviteManager}
                        >
                          {t("manager")}
                        </option>
                      </select>
                    </label>
                    {edit.role === "manager" && (
                      <p className={s.muted}>{t("managerNote")}</p>
                    )}
                    <div className={s.grants}>
                      {data.delegable
                        .filter(
                          (c) => edit.role === "manager" || c !== "team.manage",
                        )
                        .map((c) => (
                          <label className={s.checkbox} key={c}>
                            <input
                              type="checkbox"
                              checked={
                                edit.grants.includes(c) ||
                                (edit.role === "manager" &&
                                  data.managerDefaults.includes(c))
                              }
                              disabled={
                                c === "seller.read" ||
                                (edit.role === "manager" &&
                                  data.managerDefaults.includes(c))
                              }
                              onChange={(e) =>
                                setEdit({
                                  ...edit,
                                  grants: e.target.checked
                                    ? [...edit.grants, c]
                                    : edit.grants.filter((g) => g !== c),
                                })
                              }
                            />
                            <span>{cap(c)}</span>
                          </label>
                        ))}
                    </div>
                    {edit.kind === "change" && (
                      <p className={s.muted}>{t("confirmChange")}</p>
                    )}
                  </>
                ) : (
                  <>
                    <strong>
                      {edit.recipient ||
                        t("memberId", { id: edit.userId?.slice(0, 8) ?? "" })}
                    </strong>
                    <p>
                      {t(
                        edit.kind === "revoke"
                          ? "confirmRevoke"
                          : edit.kind === "resend"
                            ? "resendNote"
                            : edit.kind === "retry-mail"
                              ? "retryMailNote"
                              : "confirmCancel",
                      )}
                    </p>
                  </>
                )}
              </fieldset>
              {error && (
                <p className={s.notice} role="alert">
                  {t(teamError(error))}
                </p>
              )}
              {error === "CONFLICT" && (
                <button
                  type="button"
                  className={a.secondary}
                  disabled={pending}
                  onClick={() => void compare()}
                >
                  {t("compare")}
                </button>
              )}
              {latest && (
                <section className={s.notice}>
                  <h3>{t("latest")}</h3>
                  <p>
                    {t("revision", { revision: latest.revision })} ·{" "}
                    {t("seats", {
                      used: latest.usedSeats,
                      reserved: latest.reservedSeats,
                      limit: latest.seats,
                    })}
                  </p>
                  {latest.members.map((m) => (
                    <p key={m.userId}>
                      {m.self
                        ? t("you")
                        : t("memberId", { id: m.userId.slice(0, 8) })}
                      : {t(m.role)} · {t(m.status)}{" "}
                      {m.grants.map(cap).join(", ")}
                    </p>
                  ))}
                  <button
                    type="button"
                    className={a.secondary}
                    onClick={() => {
                      if (hidden || pending || !currentEditor()) return;
                      // Deliberate adoption of a current comparison resolves
                      // the old journal; the next command gets a new UUID.
                      attempts.current.delete(sellerId);
                      clearRecovery();
                      setUncertain(false);
                      setEdit({ ...edit, expectedRevision: latest.revision });
                      setLatest(null);
                      setError(null);
                    }}
                  >
                    {t("useLatest")}
                  </button>
                </section>
              )}
            </div>
            <footer>
              <button
                type="button"
                className={a.secondary}
                disabled={pending}
                onClick={() => setEdit(null)}
              >
                {t("cancel")}
              </button>
              <button className={a.primary} disabled={pending || hidden}>
                {t(
                  pending
                    ? "working"
                    : edit.kind === "invite"
                      ? "create"
                      : edit.kind === "change"
                        ? "save"
                        : "confirm",
                )}
              </button>
            </footer>
          </form>
        </dialog>
      )}
    </main>
  );
}
