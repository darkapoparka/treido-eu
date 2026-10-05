"use client";
import { capabilityMessageKey } from "./model";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useClerk } from "@clerk/nextjs";
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
    clerk = useClerk();
  const sellerId = initial.sellerId;
  const load = useCallback(() => readTeamAction(sellerId), [sellerId]);
  const { data, status, refresh } = useInboxRefresh(
    initial,
    actorSubject,
    load,
  );
  const [edit, setEdit] = useState<Edit | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState(""),
    [latest, setLatest] = useState<TeamView | null>(null),
    [blocked, setBlocked] = useState(false),
    [baseline, setBaseline] = useState("");
  const life = useRef(true),
    busy = useRef(false),
    dialog = useRef<HTMLDialogElement>(null),
    attempt = useRef<{ hash: string; command: TeamCommand } | null>(null);
  const dirty = Boolean(
    edit &&
    (edit.kind === "invite" || edit.kind === "change") &&
    JSON.stringify(edit) !== baseline,
  );
  useUnsavedChanges(dirty && !blocked && status !== "denied", language);
  useEffect(() => {
    life.current = true;
    return () => {
      life.current = false;
    };
  }, []);
  const editing = edit !== null;
  useEffect(() => {
    const node = dialog.current;
    if (editing && status === "ready" && !blocked && !node?.open)
      node?.showModal();
    else if (status !== "ready" || blocked) node?.close();
    return () => node?.close();
  }, [editing, status, blocked]);
  const cap = (value: string) => t(capabilityMessageKey(value));
  function open(value: Partial<Edit> & { kind: Edit["kind"] }) {
    const next: Edit = {
      expectedRevision: data.revision,
      recipient: "",
      role: "member",
      grants: ["seller.read"],
      language,
      ...value,
    };
    setBaseline(JSON.stringify(next));
    attempt.current = null;
    setError(null);
    setNotice("");
    setLatest(null);
    setEdit(next);
  }
  function here(path: string) {
    return (
      life.current &&
      clerk.user?.id === actorSubject &&
      location.pathname === path
    );
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (
      !edit ||
      busy.current ||
      status !== "ready" ||
      blocked ||
      clerk.user?.id !== actorSubject
    )
      return;
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
            access: { role: edit.role, grants: edit.grants },
          }
        : edit.kind === "change"
          ? {
              ...base,
              kind: "change",
              userId: edit.userId!,
              access: { role: edit.role, grants: edit.grants },
            }
          : edit.kind === "revoke"
            ? { ...base, kind: "revoke", userId: edit.userId! }
            : { ...base, kind: edit.kind, invitationId: edit.invitationId! };
    const hash = JSON.stringify({ ...command, requestId: null });
    if (attempt.current?.hash !== hash) attempt.current = { hash, command };
    const path = location.pathname;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await changeTeamAction(attempt.current.command);
      if (!here(path)) return;
      if (!result.ok) {
        setError(result.code);
        if (teamError(result.code) === "denied") setBlocked(true);
        return;
      }
      attempt.current = null;
      setEdit(null);
      setNotice(t("done"));
      await refresh();
    } catch {
      if (here(path)) setError("NOT_AVAILABLE");
    } finally {
      busy.current = false;
      if (life.current) setPending(false);
    }
  }
  async function compare() {
    if (busy.current) return;
    const path = location.pathname;
    busy.current = true;
    setPending(true);
    try {
      const result = await readTeamAction(sellerId);
      if (!here(path)) return;
      if (result.ok) setLatest(result.data);
      else {
        setError(result.code);
        if (teamError(result.code) === "denied") setBlocked(true);
      }
    } catch {
      if (here(path)) setError("NOT_AVAILABLE");
    } finally {
      busy.current = false;
      if (life.current) setPending(false);
    }
  }
  async function copy(invitationId: string) {
    try {
      await navigator.clipboard.writeText(
        location.origin +
          "/app/invitations/" +
          invitationId +
          "?lang=" +
          language,
      );
      if (life.current) setNotice(t("copied"));
    } catch {
      if (life.current) setError("NOT_AVAILABLE");
    }
  }
  const hidden = status !== "ready" || blocked;
  return (
    <main>
      <header className={a.pageBar}>
        <h1>{t("title")}</h1>
        <div className={s.actions}>
          <button
            className={a.secondary}
            onClick={() => void refresh(true)}
            disabled={pending}
          >
            {t("retry")}
          </button>
          <button
            className={a.primary}
            disabled={
              hidden ||
              pending ||
              data.usedSeats + data.reservedSeats >= data.seats
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
        <div className={s.stack} hidden={hidden} data-team>
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
                                open({ kind: "revoke", userId: member.userId })
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
      </div>
      {edit && (
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
              <fieldset className={s.form} disabled={pending || hidden}>
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
                      setEdit({ ...edit, expectedRevision: latest.revision });
                      setLatest(null);
                      setError(null);
                      attempt.current = null;
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
