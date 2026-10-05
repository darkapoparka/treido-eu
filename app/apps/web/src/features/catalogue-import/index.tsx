"use client";
import Link from "next/link";
import { useCallback } from "react";
import { useLocale, useTranslations, useFormatter } from "next-intl";
import { useInboxRefresh } from "../messaging/use-inbox-refresh";
import type { ImportIndex } from "./queries.server";
import { readCatalogueImportsAction } from "./actions";
import { ImportUpload } from "./upload";
import a from "../sellers/admin.module.css";
import f from "../sellers/admin-editor.module.css";
import s from "./import.module.css";
export function CatalogueImports({
  initial,
  actorSubject,
  before = null,
}: {
  initial: ImportIndex;
  actorSubject: string;
  before?: string | null;
}) {
  const t = useTranslations("catalogueImport"),
    locale = useLocale(),
    format = useFormatter(),
    sellerId = initial.sellerId;
  const load = useCallback(
    () => readCatalogueImportsAction({ sellerId, before }),
    [sellerId, before],
  );
  const { data, status, refresh } = useInboxRefresh(
    initial,
    actorSubject,
    load,
  );
  const base = "/app/sellers/" + sellerId + "/imports";
  return (
    <main>
      <header className={a.pageBar}>
        <h1>{t("title")}</h1>
        <button className={a.secondary} onClick={() => void refresh(true)}>
          {t("retry")}
        </button>
      </header>
      <div className={a.pageBody}>
        {status !== "ready" && (
          <section className={f.panel} role="status">
            {t(
              status === "denied"
                ? "denied"
                : status === "checking"
                  ? "awaiting"
                  : "unavailable",
            )}
          </section>
        )}
        <div className={s.stack} hidden={status !== "ready"}>
          <p className={f.help}>
            {t("limits", {
              rows: data.rowLimit,
              remaining: data.draftsRemaining,
            })}
          </p>
          {data.canManage && (
            <ImportUpload sellerId={sellerId} actorSubject={actorSubject} />
          )}
          <section className={a.productPanel}>
            <div className={a.productToolbar}>
              <h2>{t("history")}</h2>
            </div>
            {!data.items.length ? (
              <div className={a.empty}>
                <h2>{t("empty")}</h2>
              </div>
            ) : (
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>{t("name")}</th>
                      <th>{t("status")}</th>
                      <th>{t("createdCount")}</th>
                      <th>{t("createdOn")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <Link href={base + "/" + item.id + "?lang=" + locale}>
                            {item.name}
                          </Link>
                        </td>
                        <td>{t(item.state)}</td>
                        <td>
                          {item.created} / {item.total}
                        </td>
                        <td>
                          <time dateTime={item.createdAt}>
                            {format.dateTime(new Date(item.createdAt), {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </time>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className={a.pagination}>
              {before && (
                <Link className={a.secondary} href={base + "?lang=" + locale}>
                  {t("first")}
                </Link>
              )}
              {data.nextBefore && (
                <Link
                  className={a.secondary}
                  href={base + "?lang=" + locale + "&before=" + data.nextBefore}
                >
                  {t("next")}
                </Link>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
