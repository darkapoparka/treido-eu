"use client";
import { importMessageKey } from "./copy";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth, useClerk } from "@clerk/nextjs";
import { usePathname, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useInboxRefresh } from "../messaging/use-inbox-refresh";
import {
  readCatalogueImportAction,
  changeCatalogueImportAction,
  exportImportReportAction,
} from "./actions";
import type {
  ImportView,
  ImportCommand,
  ImportRowView,
  ImportIssue,
} from "./model";
import { ImportUpload } from "./upload";
import { ImportDialog } from "./dialog";
import { downloadCsv } from "./download";
import type { CsvRow } from "./csv";
import a from "../sellers/admin.module.css";
import f from "../sellers/admin-editor.module.css";
import s from "./import.module.css";
export function CatalogueImportDetail({
  initial,
  actorSubject,
}: {
  initial: ImportView;
  actorSubject: string;
}) {
  const t = useTranslations("catalogueImport"),
    locale = useLocale(),
    clerk = useClerk(),
    auth = useAuth();
  usePathname();
  useSearchParams();
  const { sellerId, id, after } = initial;
  const load = useCallback(
    () => readCatalogueImportAction({ sellerId, importId: id, after }),
    [sellerId, id, after],
  );
  const { data, status, refresh } = useInboxRefresh(
    initial,
    actorSubject,
    load,
  );
  const humanKey = actorSubject + "\0" + sellerId + "\0" + id,
    user = clerk.user,
    session = clerk.session,
    entry =
      typeof location === "undefined"
        ? ""
        : location.pathname + location.search;
  const frame = useMemo(
    () => ({
      initial,
      humanKey,
      actorSubject,
      user,
      session,
      entry,
      sessionId: auth.sessionId,
      authorized:
        auth.isLoaded &&
        auth.isSignedIn === true &&
        auth.userId === actorSubject &&
        user?.id === actorSubject &&
        !!auth.sessionId &&
        session?.id === auth.sessionId &&
        session.status === "active",
    }),
    [
      initial,
      humanKey,
      actorSubject,
      user,
      session,
      entry,
      auth.sessionId,
      auth.isLoaded,
      auth.isSignedIn,
      auth.userId,
    ],
  );
  const [scope, setScope] = useState({
    frame,
    beforeRead: initial,
    visible: true,
  });
  if (scope.frame !== frame)
    setScope({ frame, beforeRead: data, visible: true });
  const [local, setLocal] = useState({
    key: humanKey,
    dialog: null as { row?: ImportRowView; revision: number } | null,
  });
  if (local.key !== humanKey) setLocal({ key: humanKey, dialog: null });
  const [journals, setJournals] = useState({
    actor: actorSubject,
    commands: new Map<string, { command: ImportCommand; uncertain: boolean }>(),
  });
  if (journals.actor !== actorSubject)
    setJournals({ actor: actorSubject, commands: new Map() });
  const journalSnapshot =
    journals.actor === actorSubject
      ? (journals.commands.get(humanKey) ?? null)
      : null;
  const [presentation, setPresentation] = useState({
    owner: scope,
    pending: false,
    error: null as string | null,
    notice: false,
  });
  if (presentation.owner !== scope)
    setPresentation({
      owner: scope,
      pending: false,
      error: null,
      notice: false,
    });
  const attempts = useRef(
    new Map<
      string,
      {
        command: ImportCommand;
        hash: string;
        inFlight: boolean;
        uncertain: boolean;
      }
    >(),
  );
  const life = useRef({
    mounted: false,
    frame,
    scope,
    data: initial,
    ready: false,
    generation: 0,
    operation: null as number | null,
    next: 0,
    actor: actorSubject as string | null,
  });
  const routeOwnsImport = () => {
    try {
      return (
        decodeURIComponent(location.pathname).toLowerCase() ===
        ("/app/sellers/" + sellerId + "/imports/" + id).toLowerCase()
      );
    } catch {
      return false;
    }
  };
  const currentResources = () =>
    frame.authorized &&
    clerk.user === user &&
    clerk.session === session &&
    clerk.user?.id === actorSubject &&
    clerk.session?.id === frame.sessionId &&
    clerk.session?.status === "active" &&
    typeof document !== "undefined" &&
    document.visibilityState === "visible" &&
    routeOwnsImport() &&
    Number(new URLSearchParams(location.search).get("after") ?? "0") ===
      after &&
    location.pathname + location.search === frame.entry;
  const qualified =
    status === "ready" &&
    scope.frame === frame &&
    scope.visible &&
    currentResources() &&
    data !== scope.beforeRead &&
    data.sellerId === sellerId &&
    data.id === id &&
    data.after === after;
  const pending =
      qualified && presentation.owner === scope && presentation.pending,
    error =
      qualified && presentation.owner === scope ? presentation.error : null,
    notice = qualified && presentation.owner === scope && presentation.notice,
    dialog = local.key === humanKey ? local.dialog : null,
    retained = journalSnapshot?.command ?? null,
    uncertain = !!journalSnapshot && (journalSnapshot.uncertain || !pending);
  if (journalSnapshot && !journalSnapshot.uncertain && !pending) {
    const commands = new Map(journals.commands);
    commands.set(humanKey, { ...journalSnapshot, uncertain: true });
    setJournals({ ...journals, commands });
  }
  useLayoutEffect(() => {
    const current = life.current;
    if (current.frame !== frame || current.scope !== scope || !qualified) {
      ++current.generation;
      current.operation = null;
      const old = attempts.current.get(current.frame.humanKey);
      if (old?.inFlight) {
        old.inFlight = false;
        old.uncertain = true;
      }
    }
    if (current.actor !== actorSubject) attempts.current.clear();
    Object.assign(current, {
      frame,
      scope,
      data,
      ready: qualified,
      actor: actorSubject,
    });
  }, [frame, scope, data, qualified, actorSubject]);
  useLayoutEffect(() => {
    const current = life.current;
    current.mounted = true;
    const invalidate = () => {
      ++current.generation;
      current.operation = null;
      current.ready = false;
      const old = attempts.current.get(frame.humanKey);
      if (old?.inFlight) {
        old.inFlight = false;
        old.uncertain = true;
      }
    };
    const concealed = () => {
      invalidate();
      const next = { frame, beforeRead: current.data, visible: false };
      current.scope = next;
      setScope(next);
    };
    const restore = () => {
      invalidate();
      const next = {
        frame,
        beforeRead: current.data,
        visible: document.visibilityState === "visible",
      };
      current.scope = next;
      setScope(next);
    };
    const signature = () => [
      clerk.user,
      clerk.session,
      clerk.user?.id,
      clerk.session?.id,
      clerk.session?.status,
    ];
    let previous = signature();
    const unsubscribe = clerk.addListener(() => {
      const next = signature();
      if (
        !current.mounted ||
        next.every((value, index) => value === previous[index])
      )
        return;
      previous = next;
      concealed();
      const subject = clerk.user?.id ?? null;
      if (subject !== current.actor) {
        attempts.current.clear();
        setJournals({ actor: subject ?? "", commands: new Map() });
        setLocal({ key: "", dialog: null });
        current.actor = subject;
      }
    });
    const focus = () => {
      if (!current.scope.visible) restore();
    };
    const pageshow = (event: PageTransitionEvent) => {
      if (event.persisted) restore();
    };
    document.addEventListener("visibilitychange", restore);
    window.addEventListener("blur", concealed);
    window.addEventListener("focus", focus);
    window.addEventListener("popstate", restore);
    window.addEventListener("pageshow", pageshow);
    return () => {
      invalidate();
      current.mounted = false;
      unsubscribe();
      document.removeEventListener("visibilitychange", restore);
      window.removeEventListener("blur", concealed);
      window.removeEventListener("focus", focus);
      window.removeEventListener("popstate", restore);
      window.removeEventListener("pageshow", pageshow);
    };
  }, [frame, clerk]);
  const here = () =>
    life.current.mounted &&
    life.current.frame === frame &&
    life.current.scope === scope &&
    life.current.ready &&
    currentResources();
  const canAct = () => here() && life.current.operation === null;
  const update = (values: Partial<Omit<typeof presentation, "owner">>) =>
    setPresentation((previous) => ({ ...previous, owner: scope, ...values }));
  const setDialog = (value: typeof local.dialog) => {
    if (canAct()) setLocal({ key: humanKey, dialog: value });
  };
  const setError = (value: string | null) => {
    if (canAct()) update({ error: value });
  };
  const refreshCurrent = () => {
    if (
      !life.current.mounted ||
      life.current.frame !== frame ||
      life.current.scope !== scope ||
      !currentResources() ||
      life.current.operation !== null
    )
      return;
    life.current.ready = false;
    const next = { frame, beforeRead: life.current.data, visible: true };
    life.current.scope = next;
    setScope(next);
    void refresh(true);
  };
  const retire = () => {
    attempts.current.delete(humanKey);
    setJournals((previous) => {
      const commands = new Map(previous.commands);
      commands.delete(humanKey);
      return { ...previous, commands };
    });
  };
  const adopt = () => {
    if (!canAct()) return;
    retire();
    setLocal({ key: humanKey, dialog: null });
    update({ error: null, notice: false });
  };
  function begin() {
    if (!canAct()) return null;
    const operation = {
      scope,
      generation: life.current.generation,
      id: ++life.current.next,
    };
    life.current.operation = operation.id;
    update({ pending: true, error: null, notice: false });
    return operation;
  }
  const ownsOperation = (operation: NonNullable<ReturnType<typeof begin>>) =>
    here() &&
    life.current.operation === operation.id &&
    life.current.generation === operation.generation &&
    life.current.scope === operation.scope;
  const finish = (operation: NonNullable<ReturnType<typeof begin>>) => {
    if (ownsOperation(operation)) {
      life.current.operation = null;
      update({ pending: false });
    }
  };
  async function execute(
    operation: ImportCommand["operation"],
    revision = data.revision,
    exact = false,
  ): Promise<boolean> {
    if (!canAct() || (retained && !exact)) return false;
    const hash = JSON.stringify({ operation, revision });
    let attempt = attempts.current.get(humanKey);
    if (!attempt || (!attempt.uncertain && attempt.hash !== hash)) {
      attempt = {
        command: {
          sellerId,
          importId: id,
          requestId: crypto.randomUUID(),
          expectedRevision: revision,
          operation: JSON.parse(
            JSON.stringify(operation),
          ) as ImportCommand["operation"],
        },
        hash,
        inFlight: false,
        uncertain: false,
      };
      attempts.current.set(humanKey, attempt);
    }
    const ticket = begin();
    if (!ticket) return false;
    const journal = attempt;
    journal.inFlight = true;
    setJournals((previous) => ({
      ...previous,
      commands: new Map(previous.commands).set(humanKey, {
        command: journal.command,
        uncertain: journal.uncertain,
      }),
    }));
    const unknown = (code = "NOT_AVAILABLE") => {
      journal.inFlight = false;
      journal.uncertain = true;
      update({ error: code });
      life.current.operation = null;
      life.current.ready = false;
      ++life.current.generation;
      const next = { frame, beforeRead: life.current.data, visible: true };
      life.current.scope = next;
      setScope(next);
      void refresh(true);
    };
    try {
      const result = await changeCatalogueImportAction(journal.command);
      if (!ownsOperation(ticket)) return false;
      journal.inFlight = false;
      if (!result.ok) {
        if (journal.uncertain || result.code === "NOT_AVAILABLE")
          unknown(result.detail ?? result.code);
        else {
          retire();
          update({ error: result.detail ?? result.code });
          if (
            ["FORBIDDEN", "UNAUTHENTICATED", "NOT_FOUND"].includes(result.code)
          ) {
            life.current.operation = null;
            refreshCurrent();
          }
        }
        return false;
      }
      if (result.data.id !== id) {
        unknown();
        return false;
      }
      retire();
      update({ notice: true });
      await refresh();
      return ownsOperation(ticket);
    } catch {
      if (ownsOperation(ticket)) unknown();
      return false;
    } finally {
      finish(ticket);
    }
  }
  async function report() {
    const ticket = begin();
    if (!ticket) return;
    try {
      const result = await exportImportReportAction({ sellerId, importId: id });
      if (!ownsOperation(ticket)) return;
      if (result.ok) downloadCsv(result.data.name, result.data.csv);
      else {
        update({ error: result.code });
        if (
          ["FORBIDDEN", "UNAUTHENTICATED", "NOT_FOUND"].includes(result.code)
        ) {
          life.current.operation = null;
          refreshCurrent();
        }
      }
    } catch {
      if (ownsOperation(ticket)) update({ error: "NOT_AVAILABLE" });
    } finally {
      finish(ticket);
    }
  }
  const changeRow = (raw: CsvRow) => {
    if (!canAct() || uncertain || !dialog?.row) return;
    setLocal({
      key: humanKey,
      dialog: { ...dialog, row: { ...dialog.row, raw } },
    });
  };
  const base = "/app/sellers/" + sellerId + "/imports",
    editable = ["review", "paused"].includes(data.state) && data.canManage,
    allowed = Math.max(
      0,
      Math.min(data.rowLimit - data.created, data.draftsRemaining, data.ready),
    );
  const message = (issue: ImportIssue) =>
    t(
      issue.code === "invalid"
        ? "invalidValue"
        : issue.code === "unavailable"
          ? "rowUnavailable"
          : issue.code,
    );
  return (
    <main>
      <header className={a.pageBar}>
        <h1 className={s.title}>{t("title")}</h1>
        <Link className={a.secondary} href={base + "?lang=" + locale}>
          {t("back")}
        </Link>
      </header>
      <div className={a.pageBody}>
        {!qualified && (
          <section className={f.panel} role="status">
            <p>
              {t(
                status === "denied"
                  ? "denied"
                  : status === "checking"
                    ? "awaiting"
                    : "unavailable",
              )}
            </p>
            {status !== "denied" && (
              <button className={a.secondary} onClick={refreshCurrent}>
                {t("retry")}
              </button>
            )}
          </section>
        )}
        {qualified && (
          <div className={s.stack} data-catalogue-import>
            <section className={f.panel}>
              <h2 className={s.title}>{data.name}</h2>
              <p>{t(data.state)}</p>
              <p className={f.help}>
                {t("limits", {
                  rows: data.rowLimit,
                  remaining: data.draftsRemaining,
                })}
              </p>
              <dl className={s.summary}>
                <div>
                  <dt>{t("total")}</dt>
                  <dd>{data.total}</dd>
                </div>
                <div>
                  <dt>{t("createdCount")}</dt>
                  <dd>{data.created}</dd>
                </div>
                <div>
                  <dt>{t("selectedCount")}</dt>
                  <dd>{data.selected}</dd>
                </div>
                <div>
                  <dt>{t("issues")}</dt>
                  <dd>{data.invalid}</dd>
                </div>
              </dl>
              {data.error && (
                <p className={s.error} role="status">
                  {t(importMessageKey(data.error))}
                </p>
              )}
              {error && !dialog && (
                <p className={s.error} role="alert">
                  {t(importMessageKey(error))}
                </p>
              )}
              {notice && (
                <p className={s.notice} role="status">
                  {t("saved")}
                </p>
              )}
              <div className={s.footer}>
                <button
                  className={a.secondary}
                  disabled={pending}
                  onClick={() => {
                    if (!canAct()) return;
                    setLocal({ key: humanKey, dialog: null });
                    refreshCurrent();
                  }}
                >
                  {t("retry")}
                </button>
                {data.total > 0 && (
                  <button
                    className={a.secondary}
                    disabled={pending}
                    onClick={() => void report()}
                  >
                    {t("report")}
                  </button>
                )}
                {data.canManage &&
                  !["completed", "cancelled"].includes(data.state) && (
                    <button
                      className={a.secondary}
                      disabled={pending || uncertain}
                      onClick={() => {
                        setError(null);
                        setDialog({ revision: data.revision });
                      }}
                    >
                      {t("cancel")}
                    </button>
                  )}
                {editable && (
                  <button
                    className={a.primary}
                    disabled={
                      pending ||
                      uncertain ||
                      data.selected < 1 ||
                      data.selected > allowed
                    }
                    onClick={() => void execute({ kind: "start" })}
                  >
                    {t(data.state === "paused" ? "resume" : "start")}
                  </button>
                )}
              </div>
              {uncertain && retained && (
                <div className={s.footer}>
                  <p className={f.help}>{t("recoveryNote")}</p>
                  <button
                    className={a.secondary}
                    disabled={pending}
                    onClick={() =>
                      void execute(
                        retained.operation,
                        retained.expectedRevision,
                        true,
                      )
                    }
                  >
                    {t("retryChange")}
                  </button>
                  <button
                    className={a.secondary}
                    disabled={pending}
                    onClick={adopt}
                  >
                    {t("useCurrent")}
                  </button>
                </div>
              )}
              {["queued", "processing"].includes(data.state) && (
                <p className={f.help}>{t("workerNote")}</p>
              )}
              {data.state === "completed" && (
                <p className={f.help}>{t("completedNote")}</p>
              )}
            </section>
            {data.state === "uploading" && data.canManage && (
              <ImportUpload
                sellerId={sellerId}
                actorSubject={actorSubject}
                resume={data}
              />
            )}
            {data.total > 0 && (
              <section className={a.productPanel}>
                {editable && (
                  <div className={a.productToolbar}>
                    <div className={s.toolbar}>
                      <button
                        className={a.secondary}
                        disabled={pending || uncertain || !allowed}
                        onClick={() =>
                          void execute({ kind: "choose_valid", count: allowed })
                        }
                      >
                        {t("chooseLimit", { count: allowed })}
                      </button>
                      <button
                        className={a.secondary}
                        disabled={pending || uncertain}
                        onClick={() =>
                          void execute({ kind: "choose_valid", count: 0 })
                        }
                      >
                        {t("clearAll")}
                      </button>
                    </div>
                  </div>
                )}
                <div className={s.tableWrap}>
                  <table className={s.table}>
                    <thead>
                      <tr>
                        <th>{t("row")}</th>
                        <th>{t("product")}</th>
                        <th>{t("status")}</th>
                        <th>{t("issues")}</th>
                        <th>{t("open")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((row) => (
                        <tr key={row.number} data-import-row={row.number}>
                          <td>
                            {editable && row.state === "ready" && (
                              <input
                                type="checkbox"
                                aria-label={t("select", { number: row.number })}
                                checked={row.selected}
                                disabled={pending || uncertain}
                                onChange={(event) =>
                                  void execute({
                                    kind: "select",
                                    rows: [row.number],
                                    selected: event.target.checked,
                                  })
                                }
                              />
                            )}{" "}
                            {row.number}
                          </td>
                          <td>
                            <strong>{row.raw.title}</strong>
                            <small>{row.externalId}</small>
                          </td>
                          <td>{t(row.state)}</td>
                          <td>
                            {row.errors.map((issue, index) => (
                              <small key={index}>
                                {issue.field}: {message(issue)}
                              </small>
                            ))}
                          </td>
                          <td>
                            {row.listingId ? (
                              <Link
                                className={a.secondary}
                                href={
                                  "/app/sellers/" +
                                  sellerId +
                                  "/listings/" +
                                  row.listingId +
                                  "/edit?lang=" +
                                  locale
                                }
                              >
                                {t("draft")}
                              </Link>
                            ) : editable ? (
                              <button
                                className={a.secondary}
                                disabled={pending || uncertain}
                                onClick={() => {
                                  setError(null);
                                  setDialog({ row, revision: data.revision });
                                }}
                              >
                                {t("edit")}
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!data.rows.length && <p>{t("noRows")}</p>}
                <div className={a.pagination}>
                  <span>{t("selection", { count: data.selected })}</span>
                  {after > 0 && (
                    <Link
                      className={a.secondary}
                      href={base + "/" + id + "?lang=" + locale}
                    >
                      {t("first")}
                    </Link>
                  )}
                  {data.nextAfter !== null && (
                    <Link
                      className={a.secondary}
                      href={
                        base +
                        "/" +
                        id +
                        "?lang=" +
                        locale +
                        "&after=" +
                        data.nextAfter
                      }
                    >
                      {t("next")}
                    </Link>
                  )}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
      {qualified && dialog && !uncertain && (
        <ImportDialog
          active={qualified}
          row={dialog.row}
          pending={pending}
          error={error}
          onChange={changeRow}
          onSave={(raw) =>
            execute(
              { kind: "edit", row: dialog.row!.number, raw },
              dialog.revision,
            )
          }
          onCancel={() => execute({ kind: "cancel" }, dialog.revision)}
          onClose={() => setDialog(null)}
        />
      )}
    </main>
  );
}
