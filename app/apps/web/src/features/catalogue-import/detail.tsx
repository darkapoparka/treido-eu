"use client";
import { importMessageKey } from "./copy";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useClerk } from "@clerk/nextjs";
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
    clerk = useClerk();
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
  const [pending, start] = useTransition(),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState(false),
    [dialog, setDialog] = useState<{
      row?: ImportRowView;
      revision: number;
    } | null>(null);
  const attempt = useRef<{
      fingerprint: string;
      command: ImportCommand;
    } | null>(null),
    live = useRef(true),
    working = useRef(false);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  function execute(
    operation: ImportCommand["operation"],
    revision = data.revision,
  ): Promise<boolean> {
    if (
      working.current ||
      status !== "ready" ||
      clerk.user?.id !== actorSubject
    )
      return Promise.resolve(false);
    working.current = true;
    setError(null);
    setNotice(false);
    const fingerprint = JSON.stringify({ operation, revision });
    if (attempt.current?.fingerprint !== fingerprint)
      attempt.current = {
        fingerprint,
        command: {
          sellerId,
          importId: id,
          requestId: crypto.randomUUID(),
          expectedRevision: revision,
          operation,
        },
      };
    const command = attempt.current.command;
    return new Promise((resolve) =>
      start(async () => {
        try {
          const result = await changeCatalogueImportAction(command);
          if (!live.current || clerk.user?.id !== actorSubject) {
            resolve(false);
            return;
          }
          if (!result.ok) {
            setError(result.detail ?? result.code);
            if (result.code !== "NOT_AVAILABLE") attempt.current = null;
            if (
              ["FORBIDDEN", "UNAUTHENTICATED", "NOT_FOUND"].includes(
                result.code,
              )
            )
              void refresh(true);
            resolve(false);
            return;
          }
          attempt.current = null;
          setNotice(true);
          await refresh();
          resolve(true);
        } catch {
          if (live.current) setError("NOT_AVAILABLE");
          resolve(false);
        } finally {
          working.current = false;
        }
      }),
    );
  }
  async function report() {
    try {
      const result = await exportImportReportAction({ sellerId, importId: id });
      if (!live.current || clerk.user?.id !== actorSubject) return;
      if (result.ok) downloadCsv(result.data.name, result.data.csv);
      else setError(result.code);
    } catch {
      if (live.current) setError("NOT_AVAILABLE");
    }
  }
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
        {status !== "ready" && (
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
            {status === "unavailable" && (
              <button
                className={a.secondary}
                onClick={() => void refresh(true)}
              >
                {t("retry")}
              </button>
            )}
          </section>
        )}
        <div
          className={s.stack}
          hidden={status !== "ready"}
          data-catalogue-import
        >
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
                  setDialog(null);
                  setError(null);
                  void refresh(true);
                }}
              >
                {t("retry")}
              </button>
              {data.total > 0 && (
                <button className={a.secondary} onClick={() => void report()}>
                  {t("report")}
                </button>
              )}
              {data.canManage &&
                !["completed", "cancelled"].includes(data.state) && (
                  <button
                    className={a.secondary}
                    disabled={pending}
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
                    pending || data.selected < 1 || data.selected > allowed
                  }
                  onClick={() => void execute({ kind: "start" })}
                >
                  {t(data.state === "paused" ? "resume" : "start")}
                </button>
              )}
            </div>
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
                      disabled={pending || !allowed}
                      onClick={() =>
                        void execute({ kind: "choose_valid", count: allowed })
                      }
                    >
                      {t("chooseLimit", { count: allowed })}
                    </button>
                    <button
                      className={a.secondary}
                      disabled={pending}
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
                              disabled={pending}
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
                              disabled={pending}
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
      </div>
      {dialog && (
        <ImportDialog
          active={status === "ready"}
          row={dialog.row}
          pending={pending}
          error={error}
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
