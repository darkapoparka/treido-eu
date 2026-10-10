"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminIcon } from "./admin-icons";
import { BulkDuplicateProducts } from "./bulk-duplicate-products";
import { productStatusLabel, type AdminProduct } from "./admin-products-model";
import {
  duplicateProductAction,
  withdrawProductsAction,
} from "./admin-product-management-actions";
import type {
  BulkWithdrawalInput,
  ProductWithdrawalResult,
} from "./admin-product-management-model";
import type { WithdrawalInput } from "../selling/publication-model";
import type { SellerErrorCode } from "./errors";
import styles from "./admin.module.css";
import management from "./admin-product-management.module.css";

type Command =
  | { kind: "duplicate"; input: WithdrawalInput }
  | { kind: "withdraw"; input: BulkWithdrawalInput };
type Outcome = ProductWithdrawalResult & { title: string };
const errors: Record<SellerErrorCode, readonly [string, string]> = {
  UNAUTHENTICATED: [
    "Sign in again before continuing.",
    "Влез отново, за да продължиш.",
  ],
  FORBIDDEN: [
    "You no longer have access to this product or action.",
    "Вече нямаш достъп до този продукт или действие.",
  ],
  NOT_FOUND: [
    "This product is no longer available.",
    "Този продукт вече не е достъпен.",
  ],
  INVALID_INPUT: [
    "Select the products again and retry.",
    "Избери продуктите отново и опитай пак.",
  ],
  CONFLICT: [
    "This product changed. Reload the list and select its latest version.",
    "Продуктът е променен. Презареди списъка и избери актуалната версия.",
  ],
  QUOTA_EXCEEDED: [
    "Your draft limit has been reached. The original product is unchanged.",
    "Лимитът за чернови е достигнат. Оригиналният продукт не е променен.",
  ],
  NOT_AVAILABLE: [
    "The result could not be confirmed. Retry the same request; it will not run twice.",
    "Резултатът не може да бъде потвърден. Повтори същата заявка; тя няма да се изпълни два пъти.",
  ],
};

function ProductThumbnail({
  src,
  language,
}: {
  src?: string;
  language: "bg" | "en";
}) {
  const [failed, setFailed] = useState(false);
  const imageRef = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth === 0) setFailed(true);
  }, []);
  const label = src
    ? language === "bg"
      ? "Снимката не е налична"
      : "Image unavailable"
    : language === "bg"
      ? "Няма снимка"
      : "No photo";
  return (
    <span className={styles.productThumb}>
      {src && !failed ? (
        // Private media reauthorizes every request; do not put it through an image cache.
        // eslint-disable-next-line @next/next/no-img-element
        <img ref={imageRef} src={src} alt="" onError={() => setFailed(true)} />
      ) : (
        <span role="img" aria-label={label} title={label}>
          <AdminIcon name="product" />
        </span>
      )}
    </span>
  );
}

/** Private product controls. The owning page keys this island by seller/query. */
export function AdminProductTable({
  items,
  sellerId,
  language,
  canDuplicate,
  canWithdraw,
}: {
  items: AdminProduct[];
  sellerId: string;
  language: "bg" | "en";
  canDuplicate: boolean;
  canWithdraw: boolean;
}) {
  const bg = language === "bg";
  const router = useRouter();
  const base = `/app/sellers/${sellerId}/listings`;
  const [selection, setSelection] = useState<Record<string, number>>({});
  const [command, setCommand] = useState<Command | null>(null);
  const [retryCommand, setRetryCommand] = useState<Command | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<SellerErrorCode | null>(null);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  const selectAll = useRef<HTMLInputElement>(null);
  const active = useRef(false);
  const busy = useRef(false);
  const trigger = useRef<HTMLElement | null>(null);
  const selected = items.filter((item) => Object.hasOwn(selection, item.id));
  const selectable = canDuplicate || canWithdraw;
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    if (selectAll.current)
      selectAll.current.indeterminate =
        selected.length > 0 && selected.length < items.length;
  }, [selected.length, items.length]);
  function open(next: Command, button: HTMLElement) {
    if (busy.current) return;
    trigger.current = button;
    setCommand(next);
    setError(null);
    dialog.current?.showModal();
  }
  function close() {
    dialog.current?.close();
    setCommand(null);
    trigger.current?.focus({ preventScroll: true });
  }
  function begin(kind: Command["kind"], button: HTMLElement) {
    if (
      !selected.length ||
      selected.some((item) => selection[item.id] !== item.revision)
    ) {
      setError("CONFLICT");
      return;
    }
    const rows = selected.map((item) => ({
      listingId: item.id,
      expectedRevision: item.revision,
      requestId: crypto.randomUUID(),
    }));
    if (kind === "duplicate") {
      if (rows.length !== 1) return;
      open({ kind, input: { sellerId, ...rows[0] } }, button);
    } else open({ kind, input: { sellerId, items: rows } }, button);
  }
  async function execute() {
    if (!command || busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      if (command.kind === "duplicate") {
        const result = await duplicateProductAction(command.input);
        if (!active.current) return;
        if (!result.ok) {
          setError(result.code);
          return;
        }
        close();
        router.push(`${base}/${result.data.id}/edit?lang=${language}`);
        router.refresh();
      } else {
        const result = await withdrawProductsAction(command.input);
        if (!active.current) return;
        if (!result.ok) {
          setError(result.code);
          return;
        }
        setOutcomes(
          result.data.map((row) => ({
            ...row,
            title:
              items.find((item) => item.id === row.listingId)?.title ||
              (bg ? "Продукт без заглавие" : "Untitled product"),
          })),
        );
        const succeeded = new Set(
          result.data
            .filter((row) => row.result.ok)
            .map((row) => row.listingId),
        );
        setSelection((current) =>
          Object.fromEntries(
            Object.entries(current).filter(([id]) => !succeeded.has(id)),
          ),
        );
        const failed = command.input.items.filter(
          (row) => !succeeded.has(row.listingId),
        );
        setRetryCommand(
          failed.length
            ? { kind: "withdraw", input: { sellerId, items: failed } }
            : null,
        );
        close();
        router.refresh();
      }
    } catch {
      if (active.current) setError("NOT_AVAILABLE");
    } finally {
      busy.current = false;
      if (active.current) setPending(false);
    }
  }
  const errorText = error ? errors[error][bg ? 1 : 0] : "";
  return (
    <>
      {selectable && (
        <div
          className={management.toolbar}
          aria-label={bg ? "Управление на продуктите" : "Product management"}
        >
          <span role="status">
            {bg ? `Избрани: ${selected.length}` : `${selected.length} selected`}
          </span>
          <small>
            {bg
              ? "Избираш само продукти от тази страница."
              : "Selection applies to this page only."}
          </small>
          {selected.length > 0 && (
            <>
              {canDuplicate && (
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={
                    pending ||
                    selected.length !== 1 ||
                    selected[0].status === "restricted"
                  }
                  onClick={(event) => begin("duplicate", event.currentTarget)}
                >
                  {bg ? "Дублирай като чернова" : "Duplicate as draft"}
                </button>
              )}
              {canWithdraw && (
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={pending}
                  onClick={(event) => begin("withdraw", event.currentTarget)}
                >
                  {bg ? "Оттегли избраните" : "Withdraw selected"}
                </button>
              )}
              <button
                type="button"
                className={styles.secondary}
                disabled={pending}
                onClick={() => {
                  setSelection({});
                  setRetryCommand(null);
                  setOutcomes([]);
                  setError(null);
                }}
              >
                {bg ? "Изчисти избора" : "Clear selection"}
              </button>
            </>
          )}
        </div>
      )}
      {canDuplicate && (
        <BulkDuplicateProducts
          sellerId={sellerId}
          selected={selected}
          revisions={selection}
          language={language}
          onComplete={(ids) =>
            setSelection((current) =>
              Object.fromEntries(
                Object.entries(current).filter(([id]) => !ids.includes(id)),
              ),
            )
          }
        />
      )}
      {error && !command && (
        <p className={management.feedback} role="alert">
          {errorText}
        </p>
      )}
      {outcomes.length > 0 && (
        <section
          className={management.feedback}
          aria-label={bg ? "Резултати от оттеглянето" : "Withdrawal results"}
        >
          <p role="status">
            {bg
              ? `Оттеглени: ${outcomes.filter((row) => row.result.ok).length} от ${outcomes.length}.`
              : `Withdrawn: ${outcomes.filter((row) => row.result.ok).length} of ${outcomes.length}.`}
          </p>
          <ul>
            {outcomes
              .filter((row) => !row.result.ok)
              .map((row) => (
                <li key={row.listingId}>
                  {row.title}:{" "}
                  {!row.result.ok && errors[row.result.code][bg ? 1 : 0]}
                </li>
              ))}
          </ul>
          {retryCommand && (
            <button
              type="button"
              className={styles.secondary}
              onClick={(event) => open(retryCommand, event.currentTarget)}
            >
              {bg ? "Повтори непотвърдените" : "Retry unsuccessful items"}
            </button>
          )}
          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              setSelection({});
              setOutcomes([]);
              setRetryCommand(null);
              router.refresh();
            }}
          >
            {bg ? "Презареди списъка" : "Reload list"}
          </button>
        </section>
      )}
      <table
        className={styles.productTable}
        aria-label={bg ? "Списък с продукти" : "Product list"}
      >
        <thead>
          <tr>
            <th scope="col">
              <span className={management.name}>
                {selectable && (
                  <input
                    ref={selectAll}
                    type="checkbox"
                    aria-label={
                      bg
                        ? "Избери всички продукти на тази страница"
                        : "Select all products on this page"
                    }
                    checked={
                      items.length > 0 && selected.length === items.length
                    }
                    disabled={pending}
                    onChange={(event) => {
                      setSelection(
                        event.target.checked
                          ? Object.fromEntries(
                              items.map((item) => [item.id, item.revision]),
                            )
                          : {},
                      );
                      setRetryCommand(null);
                    }}
                  />
                )}
                {bg ? "Продукт" : "Product"}
              </span>
            </th>
            <th scope="col">{bg ? "Състояние" : "Status"}</th>
            <th scope="col">{bg ? "Цена" : "Price"}</th>
            <th scope="col">{bg ? "Обновен" : "Updated"}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((product) => {
            const title =
              product.title ||
              (bg ? "Продукт без заглавие" : "Untitled product");
            return (
              <tr key={product.id}>
                <td>
                  <div className={management.name}>
                    {selectable && (
                      <input
                        type="checkbox"
                        aria-label={`${bg ? "Избери" : "Select"} ${title}`}
                        checked={Object.hasOwn(selection, product.id)}
                        disabled={pending}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setSelection((current) => {
                            const next = { ...current };
                            if (checked) next[product.id] = product.revision;
                            else delete next[product.id];
                            return next;
                          });
                          setRetryCommand(null);
                        }}
                      />
                    )}
                    <Link
                      href={`${base}/${product.id}/edit?lang=${language}`}
                      aria-label={title}
                    >
                      <ProductThumbnail
                        key={`${sellerId}/${product.mediaId ?? "missing"}`}
                        src={
                          product.mediaId
                            ? `/api/seller-media/${product.mediaId}?sellerId=${sellerId}`
                            : undefined
                        }
                        language={language}
                      />
                      <span>{title}</span>
                    </Link>
                  </div>
                </td>
                <td>
                  <span className={styles.badge} data-status={product.status}>
                    {productStatusLabel(product.status, language)}
                  </span>
                </td>
                <td>
                  {product.priceMinor === null
                    ? "—"
                    : new Intl.NumberFormat(language, {
                        style: "currency",
                        currency: product.currency,
                      }).format(product.priceMinor / 100)}
                </td>
                <td>
                  <time dateTime={product.updatedAt}>
                    {new Intl.DateTimeFormat(language, {
                      dateStyle: "medium",
                    }).format(new Date(product.updatedAt))}
                  </time>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <dialog
        ref={dialog}
        className={management.dialog}
        aria-labelledby="product-management-title"
        aria-describedby="product-management-description"
        onCancel={(event) => {
          if (pending) event.preventDefault();
          else setCommand(null);
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget && !pending) {
            const rect = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < rect.left ||
              event.clientX > rect.right ||
              event.clientY < rect.top ||
              event.clientY > rect.bottom
            )
              close();
          }
        }}
      >
        <h2 id="product-management-title">
          {command?.kind === "duplicate"
            ? bg
              ? "Дублирай продукта като чернова"
              : "Duplicate product as a draft"
            : bg
              ? "Оттегли избраните продукти"
              : "Withdraw selected products"}
        </h2>
        <p id="product-management-description">
          {command?.kind === "duplicate"
            ? bg
              ? "Запазените данни се копират в нова чернова. Снимките не се копират, а състоянието трябва да се избере отново. Оригиналът остава непроменен. Нищо не се публикува."
              : "Saved details are copied into a new draft. Photos are not copied and condition needs to be selected again. The original is unchanged. Nothing is published."
            : bg
              ? `Ще се оттеглят само избраните публикувани продукти (${command?.kind === "withdraw" ? command.input.items.length : 0}). Те няма да се показват като активни обяви. Черновите и историята се запазват. За всеки продукт ще видиш отделен резултат.`
              : `Withdraw only the selected published products (${command?.kind === "withdraw" ? command.input.items.length : 0}). They will no longer appear as active listings. Draft content and history are retained. You will see a result for each product.`}
        </p>
        {error && <p role="alert">{errorText}</p>}
        {pending && (
          <p role="status">
            {bg ? "Запазване на промените…" : "Saving changes…"}
          </p>
        )}
        <div className={management.dialogActions}>
          <button
            type="button"
            className={styles.secondary}
            disabled={pending}
            onClick={close}
          >
            {bg ? "Отказ" : "Cancel"}
          </button>
          <button
            type="button"
            className={styles.primary}
            disabled={pending || !command}
            onClick={() => {
              void execute();
            }}
          >
            {error === "NOT_AVAILABLE"
              ? bg
                ? "Повтори същата заявка"
                : "Retry this request"
              : command?.kind === "duplicate"
                ? bg
                  ? "Създай чернова"
                  : "Create draft"
                : bg
                  ? "Потвърди оттеглянето"
                  : "Confirm withdrawal"}
          </button>
        </div>
      </dialog>
    </>
  );
}
