"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  BuyerSessionBoundary,
  usePrivateScope,
} from "../library/session-boundary";
import { acceptsPrivateResult } from "../library/private-session";
import {
  createOrReplySupportAction,
  operateSupportAction,
  readOwnSupportAction,
  readOperatorSupportAction,
  markSupportReadAction,
} from "./actions";
import {
  SUPPORT_TOPICS,
  parseSupportCommand,
  type SupportCommand,
  type SupportKind,
  type SupportTopic,
  type SupportView,
} from "./model";
import { supportCopy } from "./copy";
import s from "./support.module.css";

type Props = {
  language: "bg" | "en";
  operator?: boolean;
  ticketId?: string | null;
  before?: string | null;
  beforeSequence?: number | null;
  state?: string;
};
export function SupportScreen(props: Props) {
  return (
    <BuyerSessionBoundary>
      <CurrentSupportScreen {...props} />
    </BuyerSessionBoundary>
  );
}
function CurrentSupportScreen(props: Props) {
  const scope = usePrivateScope();
  return (
    <SupportContent
      key={
        scope.identityKey +
        ":" +
        (props.ticketId ?? "queue") +
        ":" +
        !!props.operator
      }
      {...props}
    />
  );
}
function SupportContent({
  language,
  operator = false,
  ticketId = null,
  before = null,
  beforeSequence = null,
  state = "all",
}: Props) {
  const scope = usePrivateScope(),
    router = useRouter(),
    t = supportCopy[language];
  const base = operator ? "/ops/support" : "/support/requests";
  const href = (id: string | null = null, extra: Record<string, string> = {}) =>
    base +
    (id ? "/" + id : "") +
    "?" +
    new URLSearchParams({ lang: language, ...extra });
  const [loaded, setLoaded] = useState<{
    key: string;
    data: SupportView | null;
    error: string | null;
  }>({ key: "", data: null, error: null });
  const [refresh, setRefresh] = useState(0),
    [body, setBody] = useState(""),
    [title, setTitle] = useState(""),
    [topic, setTopic] = useState<SupportTopic>("account");
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState<SupportCommand | null>(null);
  const saved = useRef<string | null>(null);
  const lease = useRef<{ active: boolean; busy: boolean; key: string } | null>(
    null,
  );
  const routeKey = JSON.stringify([
    ticketId,
    operator,
    before,
    beforeSequence,
    state,
  ]);
  useLayoutEffect(() => {
    const owner = { active: true, busy: false, key: scope.key + routeKey };
    lease.current = owner;
    return () => {
      owner.active = false;
    };
  }, [scope.key, routeKey]);
  const capture = () => {
    const owner = lease.current;
    return owner?.active &&
      owner.key === scope.key + routeKey &&
      scope.isCurrent()
      ? owner
      : null;
  };
  const current = loaded.key === scope.key + routeKey && scope.isCurrent();
  const view = current ? loaded.data : null;
  const read = operator ? readOperatorSupportAction : readOwnSupportAction;
  useEffect(() => {
    let active = true;
    if (!scope.subject || !scope.isCurrent()) return;
    void read({ ticketId, before, beforeSequence, state })
      .then((result) => {
        if (!active || !acceptsPrivateResult(scope, result)) return;
        setBusy(false);
        setLoaded({
          key: scope.key + routeKey,
          data: result.ok ? result.data : null,
          error: result.ok ? null : result.code,
        });
        if (result.ok) {
          const key =
            "treido:support:pending:v1:" +
            result.data.actorKey +
            ":" +
            (ticketId ?? "new") +
            ":" +
            operator;
          saved.current = key;
          try {
            const raw = sessionStorage.getItem(key);
            if (raw) {
              const command = parseSupportCommand(JSON.parse(raw));
              if (
                command.actorKey !== result.data.actorKey ||
                command.ticketId !== ticketId
              )
                throw new Error("Foreign retry");
              setPending(command);
              setBody(command.body);
              setTitle(command.title);
              setTopic(command.topic);
            }
          } catch {
            setMessage(t.storage);
          }
        }
      })
      .catch(() => {
        if (active && scope.isCurrent())
          setLoaded({
            key: scope.key + routeKey,
            data: null,
            error: "NOT_AVAILABLE",
          });
      });
    return () => {
      active = false;
    };
  }, [
    scope,
    read,
    ticketId,
    before,
    beforeSequence,
    state,
    refresh,
    operator,
    t.storage,
    routeKey,
  ]);
  const errorText = (code: string | null) =>
    code === "CONFLICT"
      ? t.conflict
      : code === "QUOTA_EXCEEDED"
        ? t.quota
        : code === "INVALID_INPUT"
          ? t.invalid
          : ["FORBIDDEN", "NOT_FOUND", "UNAUTHENTICATED"].includes(code ?? "")
            ? t.denied
            : t.unavailable;
  async function transmit(command: SupportCommand, recovery = false) {
    const owner = capture();
    if (!view || !owner || owner.busy) return;
    const recoveryKey = saved.current;
    if (!recovery) {
      try {
        if (!recoveryKey) throw new Error("No recovery key");
        sessionStorage.setItem(recoveryKey, JSON.stringify(command));
      } catch {
        setMessage(t.storage);
        return;
      }
      setPending(command);
    }
    owner.busy = true;
    setBusy(true);
    setMessage("");
    try {
      const result = await (
        operator ? operateSupportAction : createOrReplySupportAction
      )(command);
      if (!owner.active || !acceptsPrivateResult(scope, result)) return;
      if (result.ok) {
        try {
          if (recoveryKey) sessionStorage.removeItem(recoveryKey);
        } catch {
          setMessage(t.acknowledgedStorage);
        }
        setPending(null);
        setBody("");
        if (!ticketId) router.push(href(result.data.id));
        else setRefresh((value) => value + 1);
      } else {
        setMessage(errorText(result.code));
        // A stale revision or revoked access does not prove an earlier send failed.
        // Preserve the original request until explicit review/discard or its receipt.
        if (["CONFLICT", "FORBIDDEN", "NOT_FOUND"].includes(result.code))
          setRefresh((value) => value + 1);
      }
    } catch {
      if (owner.active && scope.isCurrent()) setMessage(t.unavailable);
    } finally {
      owner.busy = false;
      if (owner.active && scope.isCurrent()) setBusy(false);
    }
  }
  function submit(kind: SupportKind) {
    if (!view || pending || busy) return;
    try {
      void transmit(
        parseSupportCommand({
          actorKey: view.actorKey,
          requestId: crypto.randomUUID(),
          kind,
          ticketId,
          expectedRevision: view.ticket?.revision ?? 0,
          title,
          topic,
          body,
        }),
      );
    } catch {
      setMessage(t.invalid);
    }
  }
  async function markRead() {
    const owner = capture();
    if (!view?.ticket || !view.entries.length || !owner || owner.busy) return;
    owner.busy = true;
    const sequence = view.entries[view.entries.length - 1].sequence;
    setBusy(true);
    try {
      const result = await markSupportReadAction({
        actorKey: view.actorKey,
        ticketId: view.ticket.id,
        sequence,
      });
      if (!owner.active || !acceptsPrivateResult(scope, result)) return;
      setMessage(result.ok ? t.markedRead : errorText(result.code));
      if (result.ok) setRefresh((value) => value + 1);
    } catch {
      if (owner.active && scope.isCurrent()) setMessage(t.unavailable);
    } finally {
      owner.busy = false;
      if (owner.active && scope.isCurrent()) setBusy(false);
    }
  }
  return (
    <section className={s.page} data-support-requests>
      <nav className={s.toolbar} aria-label={t.help}>
        <Link
          className={s.button}
          href={ticketId ? href() : "/support?lang=" + language}
        >
          {ticketId ? t.back : t.help}
        </Link>
        {operator && (
          <Link className={s.button} href={"/ops?lang=" + language}>
            {t.operator}
          </Link>
        )}
        <Link className={s.button} href={"/?lang=" + language}>
          {t.home}
        </Link>
      </nav>
      <h1>{view?.ticket?.title ?? (operator ? t.operator : t.title)}</h1>
      {!scope.subject ? (
        <Link
          className={s.primary}
          href={"/sign-in?returnTo=" + encodeURIComponent(href(ticketId))}
        >
          {t.signin}
        </Link>
      ) : !current || (!view && !loaded.error) ? (
        <p role="status">{t.checking}</p>
      ) : !view ? (
        <div role="status">
          <p>{errorText(loaded.error)}</p>
          <button
            className={s.button}
            onClick={() => setRefresh((value) => value + 1)}
          >
            {t.refresh}
          </button>
        </div>
      ) : (
        <>
          <div className={s.toolbar}>
            <button
              className={s.button}
              onClick={() => setRefresh((value) => value + 1)}
              disabled={busy}
            >
              {t.refresh}
            </button>
            {view.ticket && (
              <span className={s.badge}>{t[view.ticket.state]}</span>
            )}
          </div>
          {!ticketId && (
            <>
              <p>{t.intro}</p>
              <form className={s.toolbar} action={base}>
                <input type="hidden" name="lang" value={language} />
                <label className={s.label}>
                  {t.status}
                  <select
                    className={s.field}
                    name="state"
                    defaultValue={state}
                    onChange={(event) =>
                      router.push(href(null, { state: event.target.value }))
                    }
                  >
                    {(["all", "open", "waiting", "resolved"] as const).map(
                      (value) => (
                        <option key={value} value={value}>
                          {t[value]}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </form>
              {!view.tickets.length && <p>{t.empty}</p>}
              <ul className={s.list}>
                {view.tickets.map((ticket) => (
                  <li className={s.panel} key={ticket.id}>
                    <h2>
                      <Link href={href(ticket.id)}>{ticket.title}</Link>
                    </h2>
                    <span className={s.badge}>{t[ticket.state]}</span>
                    {ticket.unread && <p>{t.unread}</p>}
                    <p className={s.meta}>
                      {t[ticket.topic]} ·{" "}
                      <time dateTime={ticket.createdAt}>
                        {new Date(ticket.createdAt).toLocaleString(language)}
                      </time>
                    </p>
                  </li>
                ))}
              </ul>
              <div className={s.toolbar}>
                {before && (
                  <Link className={s.button} href={href(null, { state })}>
                    {t.latest}
                  </Link>
                )}
                {view.nextBefore && (
                  <Link
                    className={s.button}
                    href={href(null, { before: view.nextBefore, state })}
                  >
                    {t.older}
                  </Link>
                )}
              </div>
            </>
          )}
          {view.ticket && (
            <>
              <ol className={s.list} aria-label={view.ticket.title}>
                {view.entries.map((entry) => (
                  <li key={entry.sequence} className={s.panel}>
                    <p className={s.meta}>
                      {entry.side === "operator"
                        ? t.operatorAuthor
                        : operator
                          ? language === "bg"
                            ? "Подател"
                            : "Requester"
                          : t.requester}{" "}
                      ·{" "}
                      <time dateTime={entry.at}>
                        {new Date(entry.at).toLocaleString(language)}
                      </time>
                    </p>
                    {entry.kind === "note" && (
                      <span className={s.badge}>{t.internal}</span>
                    )}
                    {entry.kind === "resolve" && (
                      <span className={s.badge}>{t.resolved}</span>
                    )}
                    {entry.kind === "reopen" && (
                      <span className={s.badge}>{t.reopen}</span>
                    )}
                    <p className={s.body}>{entry.body}</p>
                  </li>
                ))}
              </ol>
              <div className={s.toolbar}>
                {view.olderSequence && (
                  <Link
                    className={s.button}
                    href={href(ticketId, {
                      beforeSequence: String(view.olderSequence),
                    })}
                  >
                    {t.older}
                  </Link>
                )}
                {beforeSequence && (
                  <Link className={s.button} href={href(ticketId)}>
                    {t.latest}
                  </Link>
                )}
                {!operator && view.entries.length > 0 && (
                  <button
                    className={s.button}
                    disabled={busy}
                    onClick={() => void markRead()}
                  >
                    {t.markRead}
                  </button>
                )}
              </div>
            </>
          )}
          {message && (
            <p className={s.notice} role="status">
              {message}
            </p>
          )}
          {pending && (
            <div className={s.panel} role="status">
              <p>{t.pending}</p>
              <p className={s.meta}>{t.discardNote}</p>
              <div className={s.toolbar}>
                <button
                  className={s.primary}
                  disabled={busy}
                  onClick={() => void transmit(pending, true)}
                >
                  {busy ? t.submitting : t.retry}
                </button>
                <button
                  className={s.button}
                  disabled={busy}
                  onClick={() => {
                    try {
                      if (saved.current)
                        sessionStorage.removeItem(saved.current);
                      setPending(null);
                      setRefresh((value) => value + 1);
                    } catch {
                      setMessage(t.storage);
                    }
                  }}
                >
                  {t.discard}
                </button>
              </div>
            </div>
          )}
          {(!operator || ticketId) && view.canWrite ? (
            <form
              className={s.panel + " " + s.form}
              onSubmit={(event) => {
                event.preventDefault();
                submit(
                  ticketId
                    ? view.ticket?.state === "resolved"
                      ? "reopen"
                      : "reply"
                    : "create",
                );
              }}
            >
              {!ticketId && (
                <>
                  <h2>{t.newRequest}</h2>
                  <label className={s.label}>
                    {t.topic}
                    <select
                      className={s.field}
                      value={topic}
                      disabled={busy || !!pending}
                      onChange={(event) =>
                        setTopic(event.target.value as SupportTopic)
                      }
                    >
                      {SUPPORT_TOPICS.map((value) => (
                        <option key={value} value={value}>
                          {t[value]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={s.label}>
                    {t.subject}
                    <input
                      className={s.field}
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      minLength={3}
                      maxLength={120}
                      required
                      disabled={busy || !!pending}
                    />
                  </label>
                </>
              )}
              <label className={s.label}>
                {t.body}
                <textarea
                  className={s.field}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  maxLength={4000}
                  required
                  disabled={busy || !!pending}
                  aria-describedby="support-privacy"
                />
              </label>
              <p id="support-privacy" className={s.meta}>
                {t.privacy}
              </p>
              {ticketId && <p className={s.meta}>{t.reason}</p>}
              <div className={s.toolbar}>
                <button className={s.primary} disabled={busy || !!pending}>
                  {busy
                    ? t.submitting
                    : ticketId
                      ? view.ticket?.state === "resolved"
                        ? t.reopen
                        : t.reply
                      : t.send}
                </button>
                {ticketId && view.ticket?.state !== "resolved" && (
                  <button
                    type="button"
                    className={s.button}
                    disabled={busy || !!pending || !body.trim()}
                    onClick={() => submit("resolve")}
                  >
                    {t.resolve}
                  </button>
                )}
                {ticketId && operator && (
                  <button
                    type="button"
                    className={s.button}
                    disabled={busy || !!pending || !body.trim()}
                    onClick={() => submit("note")}
                  >
                    {t.note}
                  </button>
                )}
              </div>
            </form>
          ) : (
            operator && <p>{t.reviewOnly}</p>
          )}
        </>
      )}
    </section>
  );
}
