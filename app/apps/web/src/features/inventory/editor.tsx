"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useClerk } from "@clerk/nextjs";
import { useFormatter, useTranslations } from "next-intl";
import { useInboxRefresh } from "../messaging/use-inbox-refresh";
import { readInventoryAction, changeInventoryAction } from "./actions";
import {
  variantCaption,
  type InventoryCommand,
  type InventoryOperation,
  type InventorySku,
  type InventoryView,
} from "./model";
import { InventoryDialog, type InventoryDialogKind } from "./inventory-dialog";
import a from "../sellers/admin.module.css";
import f from "../sellers/admin-editor.module.css";
import s from "./inventory.module.css";
export function InventoryEditor({
  initial,
  actorSubject,
}: {
  initial: InventoryView;
  actorSubject: string;
}) {
  const t = useTranslations("inventory"),
    format = useFormatter(),
    clerk = useClerk();
  const { sellerId, listingId } = initial;
  const load = useCallback(
    () => readInventoryAction({ sellerId, listingId }),
    [sellerId, listingId],
  );
  const { data, status, refresh } = useInboxRefresh(
    initial,
    actorSubject,
    load,
  );
  const [dialog, setDialog] = useState<{
    kind: InventoryDialogKind;
    sku?: InventorySku;
    snapshot: InventoryView;
  } | null>(null);
  const [pending, start] = useTransition(),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState(false);
  const attempt = useRef<{
      fingerprint: string;
      command: InventoryCommand;
    } | null>(null),
    live = useRef(true),
    working = useRef(false);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  function open(kind: InventoryDialogKind, sku?: InventorySku) {
    setError(null);
    setNotice(false);
    attempt.current = null;
    setDialog({ kind, sku, snapshot: data });
  }
  function submit(operation: InventoryOperation, expectedRevision: number) {
    if (
      working.current ||
      status !== "ready" ||
      clerk.user?.id !== actorSubject
    )
      return Promise.resolve(false);
    working.current = true;
    setError(null);
    setNotice(false);
    const fingerprint = JSON.stringify({ operation, expectedRevision });
    if (attempt.current?.fingerprint !== fingerprint)
      attempt.current = {
        fingerprint,
        command: {
          sellerId,
          listingId,
          operation,
          expectedRevision,
          requestId: crypto.randomUUID(),
        },
      };
    const command = attempt.current.command;
    return new Promise<boolean>((done) =>
      start(async () => {
        try {
          const result = await changeInventoryAction(command);
          if (!live.current || clerk.user?.id !== actorSubject) {
            done(false);
            return;
          }
          if (!result.ok) {
            setError(result.code);
            if (result.code !== "NOT_AVAILABLE") attempt.current = null;
            if (
              ["FORBIDDEN", "UNAUTHENTICATED", "NOT_FOUND"].includes(
                result.code,
              )
            )
              void refresh(true);
            done(false);
            return;
          }
          attempt.current = null;
          setNotice(true);
          await refresh();
          done(true);
        } catch {
          if (live.current) setError("NOT_AVAILABLE");
          done(false);
        } finally {
          working.current = false;
        }
      }),
    );
  }
  if (status === "denied")
    return (
      <section className={f.panel} role="status">
        <p>{t("denied")}</p>
      </section>
    );
  const builtInReasons = new Set([
    "initial_inventory",
    "new_variant",
    "offer",
    "checkout",
    "cancelled",
    "expired",
    "provider_settlement",
  ]);
  return (
    <>
      {status !== "ready" && (
        <section className={f.panel} role="status">
          <p>{t(status === "checking" ? "checking" : "unavailable")}</p>
          {status === "unavailable" && (
            <button className={a.secondary} onClick={() => void refresh(true)}>
              {t("retry")}
            </button>
          )}
        </section>
      )}
      <div className={s.root} hidden={status !== "ready"} data-inventory-editor>
        <section className={f.panel}>
          <div className={s.header}>
            <h2>{t("title")}</h2>
            <div className={s.actions}>
              <button
                className={a.secondary}
                disabled={pending}
                onClick={() => {
                  setDialog(null);
                  void refresh(true);
                }}
              >
                {t("retry")}
              </button>
              {!data.mode && data.canDefine && (
                <button className={a.primary} onClick={() => open("setup")}>
                  {t("setup")}
                </button>
              )}
              {data.mode === "stocked" && data.canDefine && (
                <button
                  className={a.primary}
                  disabled={data.skus.length >= data.maxVariants}
                  onClick={() => open("variant")}
                >
                  {t("addVariant")}
                </button>
              )}
            </div>
          </div>
          {!data.mode ? (
            <p className={f.help}>{t("setupNote")}</p>
          ) : (
            <>
              <p>{t(data.mode)}</p>
              <p className={f.help}>{t("definitionsNote")}</p>
              <div
                className={s.tableWrap}
                role="region"
                tabIndex={0}
                aria-label={t("variants")}
              >
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>{t("variants")}</th>
                      <th>{t("onHand")}</th>
                      <th>{t("reservedLabel")}</th>
                      <th>{t("availableLabel")}</th>
                      <th>{t("manage")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.skus.map((sku) => (
                      <tr key={sku.id} data-sku-id={sku.id}>
                        <td>
                          <strong>
                            {variantCaption(sku.options) || t("defaultVariant")}
                          </strong>
                          <small>{sku.sellerSku}</small>
                          {sku.priceMinor !== null && (
                            <small>
                              {format.number(sku.priceMinor / 100, {
                                style: "currency",
                                currency: "EUR",
                              })}
                            </small>
                          )}
                        </td>
                        <td>{format.number(sku.onHand)}</td>
                        <td>{format.number(sku.reserved)}</td>
                        <td>{format.number(sku.available)}</td>
                        <td>
                          <div className={s.actions}>
                            {data.canManage && (
                              <button
                                className={a.secondary}
                                onClick={() => open("stock", sku)}
                              >
                                {t("adjust")}
                              </button>
                            )}
                            {data.canDefine && (
                              <>
                                <button
                                  className={a.secondary}
                                  onClick={() => open("variant", sku)}
                                >
                                  {t("editVariant")}
                                </button>
                                <button
                                  className={a.secondary}
                                  disabled={data.skus.length <= 1}
                                  onClick={() => open("archive", sku)}
                                >
                                  {t("archiveVariant")}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {!data.canManage && <p className={f.help}>{t("readOnly")}</p>}
          {notice && (
            <p className={s.notice} role="status">
              {t("done")} {t("definitionsChanged")}
            </p>
          )}
        </section>
        <section className={f.panel}>
          <h2>{t("history")}</h2>
          {data.events.length ? (
            <ol className={s.history}>
              {data.events.map((event) => (
                <li key={event.id}>
                  <div>
                    <strong>{t(event.kind)}</strong> ·{" "}
                    {event.quantity > 0 ? "+" : ""}
                    {format.number(event.quantity)}
                    <p className={f.help}>
                      {builtInReasons.has(event.reason)
                        ? t(event.reason as "initial_inventory")
                        : event.reason}
                    </p>
                  </div>
                  <time className={f.help} dateTime={event.createdAt}>
                    {format.dateTime(new Date(event.createdAt), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </time>
                </li>
              ))}
            </ol>
          ) : (
            <p className={f.help}>{t("historyEmpty")}</p>
          )}
        </section>
      </div>
      {dialog && (
        <InventoryDialog
          active={status === "ready"}
          kind={dialog.kind}
          sku={dialog.sku}
          inventory={dialog.snapshot}
          pending={pending}
          error={error}
          onSubmit={submit}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
