"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useClerk } from "@clerk/nextjs";
import { useLocale, useTranslations, useFormatter } from "next-intl";
import { useInboxRefresh } from "../messaging/use-inbox-refresh";
import {
  readInventoryIndexAction,
  exportInventoryPageAction,
} from "./index-actions";
import { StockBatchDialog } from "./batch-dialog";
import { downloadCsv } from "../catalogue-import/download";
import { readInventoryAction, changeInventoryAction } from "./actions";
import { InventoryDialog } from "./inventory-dialog";
import {
  variantCaption,
  type InventoryView,
  type InventorySku,
  type InventoryOperation,
  type InventoryCommand,
} from "./model";
import {
  inventoryFilters,
  inventoryIndexHref,
  type InventoryIndex,
} from "./index-model";
import a from "../sellers/admin.module.css";
import f from "../sellers/admin-editor.module.css";
import s from "./inventory.module.css";
export function SellerInventory({
  initial,
  actorSubject,
}: {
  initial: InventoryIndex;
  actorSubject: string;
}) {
  const t = useTranslations("inventory"),
    locale = useLocale(),
    format = useFormatter(),
    clerk = useClerk(),
    sellerId = initial.sellerId,
    queryKey = JSON.stringify(initial.query);
  const load = useCallback(
    () => readInventoryIndexAction(sellerId, JSON.parse(queryKey)),
    [sellerId, queryKey],
  );
  const { data, status, refresh } = useInboxRefresh(
    initial,
    actorSubject,
    load,
  );
  const [dialog, setDialog] = useState<{
      view: InventoryView;
      sku: InventorySku;
    } | null>(null),
    [error, setError] = useState<string | null>(null),
    [pending, start] = useTransition();
  const [selected, setSelected] = useState<string[]>([]),
    [batch, setBatch] = useState<InventoryIndex["items"] | null>(null),
    [exporting, setExporting] = useState(false),
    [notice, setNotice] = useState("");
  const selectable = data.items.filter(
    (row) => !!row.skuId && row.inventoryRevision !== null,
  );
  const selectedRows = selectable.filter((row) =>
    selected.includes(row.skuId!),
  );
  const life = useRef({ live: true, epoch: 0 }),
    attempt = useRef<{ key: string; command: InventoryCommand } | null>(null),
    working = useRef(false);
  async function exportPage() {
    if (exporting || status !== "ready" || clerk.user?.id !== actorSubject)
      return;
    setExporting(true);
    setError(null);
    setNotice("");
    try {
      const response = await exportInventoryPageAction(sellerId, data.query);
      if (!life.current.live || clerk.user?.id !== actorSubject) return;
      if (!response.ok) {
        setError(response.code);
        return;
      }
      downloadCsv("treido-inventory.csv", response.data.csv);
      setNotice(t("exportReady", { count: response.data.count }));
    } catch {
      if (life.current.live) setError("NOT_AVAILABLE");
    } finally {
      if (life.current.live) setExporting(false);
    }
  }

  useEffect(() => {
    const current = life.current;
    current.live = true;
    return () => {
      current.live = false;
      ++current.epoch;
    };
  }, []);
  async function adjust(listingId: string, skuId: string) {
    if (working.current || status !== "ready") return;
    const ticket = ++life.current.epoch;
    setError(null);
    try {
      const result = await readInventoryAction({ sellerId, listingId });
      if (
        !life.current.live ||
        ticket !== life.current.epoch ||
        clerk.user?.id !== actorSubject
      )
        return;
      if (!result.ok) {
        setError(result.code);
        return;
      }
      const sku = result.data.skus.find((item) => item.id === skuId);
      if (sku) {
        attempt.current = null;
        setDialog({ view: result.data, sku });
      }
    } catch {
      if (life.current.live) setError("NOT_AVAILABLE");
    }
  }
  function submit(
    operation: InventoryOperation,
    revision: number,
  ): Promise<boolean> {
    if (
      !dialog ||
      working.current ||
      status !== "ready" ||
      clerk.user?.id !== actorSubject
    )
      return Promise.resolve(false);
    working.current = true;
    setError(null);
    const key = JSON.stringify({
      operation,
      revision,
      listing: dialog.view.listingId,
    });
    if (attempt.current?.key !== key)
      attempt.current = {
        key,
        command: {
          sellerId,
          listingId: dialog.view.listingId,
          expectedRevision: revision,
          requestId: crypto.randomUUID(),
          operation,
        },
      };
    const command = attempt.current.command;
    return new Promise((resolve) =>
      start(async () => {
        try {
          const result = await changeInventoryAction(command);
          if (!life.current.live || clerk.user?.id !== actorSubject) {
            resolve(false);
            return;
          }
          if (!result.ok) {
            setError(result.code);
            if (result.code !== "NOT_AVAILABLE") attempt.current = null;
            resolve(false);
            return;
          }
          attempt.current = null;
          await refresh();
          resolve(true);
        } catch {
          if (life.current.live) setError("NOT_AVAILABLE");
          resolve(false);
        } finally {
          working.current = false;
        }
      }),
    );
  }
  return (
    <main>
      <header className={a.pageBar}>
        <h1>{t("catalogue")}</h1>
        <button
          className={a.secondary}
          onClick={() => {
            setDialog(null);
            setBatch(null);
            setSelected([]);
            void refresh(true);
          }}
        >
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
                  ? "checking"
                  : "unavailable",
            )}
          </section>
        )}
        <section
          className={a.productPanel + " " + s.index}
          hidden={status !== "ready"}
          data-inventory-index
        >
          <div className={a.productToolbar}>
            <form
              action={"/app/sellers/" + sellerId + "/inventory"}
              className={a.filterForm}
            >
              <input type="hidden" name="lang" value={locale} />
              <input
                type="search"
                name="q"
                defaultValue={data.query.q}
                maxLength={160}
                placeholder={t("searchInventory")}
                aria-label={t("searchInventory")}
              />
              <select
                name="status"
                defaultValue={data.query.status}
                aria-label={t("catalogue")}
              >
                {inventoryFilters.map((value) => (
                  <option key={value} value={value}>
                    {t(value)}
                  </option>
                ))}
              </select>
              <button className={a.secondary}>{t("apply")}</button>
            </form>
          </div>
          <div className={s.batchToolbar}>
            {data.canManage && selectedRows.length > 0 && (
              <>
                <span>{t("selectedRows", { count: selectedRows.length })}</span>
                <button
                  className={a.secondary}
                  onClick={() => {
                    setNotice("");
                    setBatch(selectedRows.map((row) => ({ ...row })));
                  }}
                >
                  {t("bulkAdjust")}
                </button>
                <button className={a.secondary} onClick={() => setSelected([])}>
                  {t("clearSelection")}
                </button>
              </>
            )}
            <button
              className={a.secondary}
              disabled={exporting || !data.items.length}
              onClick={() => void exportPage()}
            >
              {t(exporting ? "exporting" : "exportPage")}
            </button>
          </div>
          {notice && (
            <p className={s.notice} role="status">
              {notice}
            </p>
          )}
          {error && !dialog && (
            <p role="alert">
              {t(
                error === "CONFLICT"
                  ? "conflict"
                  : error === "INVALID_INPUT"
                    ? "invalid"
                    : error === "FORBIDDEN" || error === "UNAUTHENTICATED"
                      ? "denied"
                      : "unavailable",
              )}
            </p>
          )}
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  {data.canManage && (
                    <th className={s.selectColumn}>
                      <input
                        type="checkbox"
                        aria-label={t("selectPage")}
                        disabled={!selectable.length}
                        checked={
                          !!selectable.length &&
                          selectedRows.length === selectable.length
                        }
                        onChange={(event) =>
                          setSelected(
                            event.target.checked
                              ? selectable.map((row) => row.skuId!)
                              : [],
                          )
                        }
                      />
                    </th>
                  )}
                  <th>{t("product")}</th>
                  <th>{t("variants")}</th>
                  <th>{t("onHand")}</th>
                  <th>{t("reservedLabel")}</th>
                  <th>{t("availableLabel")}</th>
                  <th>{t("manage")}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.skuId ?? row.listingId}>
                    {data.canManage && (
                      <td className={s.selectColumn}>
                        {row.skuId && (
                          <input
                            type="checkbox"
                            aria-label={t("selectRow", {
                              title: row.title,
                              variant:
                                variantCaption(row.options) ||
                                row.sellerSku ||
                                t("defaultVariant"),
                            })}
                            checked={selected.includes(row.skuId)}
                            onChange={(event) =>
                              setSelected((current) =>
                                event.target.checked
                                  ? [...current, row.skuId!]
                                  : current.filter((id) => id !== row.skuId),
                              )
                            }
                          />
                        )}
                      </td>
                    )}
                    <td>
                      <Link
                        href={
                          "/app/sellers/" +
                          sellerId +
                          "/listings/" +
                          row.listingId +
                          "/review?lang=" +
                          locale
                        }
                      >
                        {row.title}
                      </Link>
                      <small>{row.sellerSku}</small>
                    </td>
                    <td>
                      {row.skuId
                        ? variantCaption(row.options) || t("defaultVariant")
                        : t("unknownQuantity")}
                    </td>
                    <td>
                      {row.onHand === null ? "—" : format.number(row.onHand)}
                    </td>
                    <td>{format.number(row.reserved)}</td>
                    <td>
                      {row.available === null
                        ? "—"
                        : format.number(row.available)}
                      <small>{t(row.state)}</small>
                    </td>
                    <td>
                      {row.skuId && data.canManage ? (
                        <button
                          className={a.secondary}
                          disabled={pending}
                          onClick={() => void adjust(row.listingId, row.skuId!)}
                        >
                          {t("adjust")}
                        </button>
                      ) : (
                        <Link
                          className={a.secondary}
                          href={
                            "/app/sellers/" +
                            sellerId +
                            "/listings/" +
                            row.listingId +
                            "/review?lang=" +
                            locale
                          }
                        >
                          {t(row.skuId ? "openProduct" : "configure")}
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.items.length && (
            <div className={a.empty}>
              <h2>{t("emptyInventory")}</h2>
            </div>
          )}
          <div className={a.pagination}>
            <span>{t("results", { count: data.total })}</span>
            {data.query.cursor && (
              <Link
                className={a.secondary}
                href={inventoryIndexHref(sellerId, locale, data.query)}
              >
                {t("first")}
              </Link>
            )}
            {data.nextCursor && (
              <Link
                className={a.secondary}
                href={inventoryIndexHref(
                  sellerId,
                  locale,
                  data.query,
                  data.nextCursor,
                )}
              >
                {t("next")}
              </Link>
            )}
          </div>
        </section>
      </div>
      {batch && (
        <StockBatchDialog
          rows={batch}
          sellerId={sellerId}
          actorSubject={actorSubject}
          active={status === "ready"}
          onClose={() => setBatch(null)}
          onSaved={() => {
            setSelected([]);
            setNotice(t("done"));
            void refresh();
          }}
        />
      )}
      {dialog && (
        <InventoryDialog
          active={status === "ready"}
          kind="stock"
          inventory={dialog.view}
          sku={dialog.sku}
          pending={pending}
          error={error}
          onSubmit={submit}
          onClose={() => {
            ++life.current.epoch;
            setDialog(null);
          }}
        />
      )}
    </main>
  );
}
