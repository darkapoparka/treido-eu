"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { duplicateProductsAction } from "./admin-product-management-actions";
import type { AdminProduct } from "./admin-products-model";
import type {
  BulkWithdrawalInput,
  ProductDuplicateResult,
} from "./admin-product-management-model";
import a from "./admin.module.css";
import s from "./admin-product-management.module.css";

export function BulkDuplicateProducts({
  sellerId,
  selected,
  revisions,
  language,
  onComplete,
}: {
  sellerId: string;
  selected: AdminProduct[];
  revisions: Readonly<Record<string, number>>;
  language: "bg" | "en";
  onComplete(ids: string[]): void;
}) {
  const bg = language === "bg",
    clerk = useClerk(),
    router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null),
    alive = useRef(true),
    busy = useRef(false);
  const trigger = useRef<HTMLElement | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [command, setCommand] = useState<BulkWithdrawalInput | null>(null);
  const [retry, setRetry] = useState<BulkWithdrawalInput | null>(null);
  const [actor, setActor] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<ProductDuplicateResult[]>([]);
  const [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const sameActor = !!actor && clerk.user?.id === actor;
  function message(code: string) {
    if (["FORBIDDEN", "NOT_FOUND", "UNAUTHENTICATED"].includes(code))
      return bg
        ? "Достъпът е променен. Избери профил, който можеш да управляваш."
        : "Access has changed. Choose an account you can currently manage.";
    if (code === "CONFLICT")
      return bg
        ? "Продуктът е променен. Презареди списъка и избери актуалната версия за ново копиране."
        : "The product changed. Reload the list and select its current version for a new copy.";
    if (code === "QUOTA_EXCEEDED")
      return bg
        ? "Лимитът за чернови е достигнат. Създадените копия остават запазени."
        : "The draft limit has been reached. Copies already created are retained.";
    if (code === "INVALID_INPUT")
      return bg
        ? "Избери отново до 30 продукта от тази страница."
        : "Select up to 30 products from this page again.";
    return bg
      ? "Резултатът не е потвърден. Повтори същата заявка, без да създаваш втори набор копия."
      : "The result is unconfirmed. Retry this request without creating a second set of copies.";
  }
  function open(input: BulkWithdrawalInput, button: HTMLElement) {
    if (busy.current || !clerk.user) return;
    trigger.current = button;
    setActor(clerk.user.id);
    setCommand(input);
    setError(null);
    dialog.current?.showModal();
  }
  function begin(button: HTMLElement) {
    if (selected.length < 2 || busy.current) return;
    if (selected.some((item) => item.revision !== revisions[item.id])) {
      setError("CONFLICT");
      return;
    }
    setLabels(
      Object.fromEntries(
        selected.map((item) => [
          item.id,
          item.title || (bg ? "Продукт без заглавие" : "Untitled product"),
        ]),
      ),
    );
    setOutcomes([]);
    setRetry(null);
    open(
      {
        sellerId,
        items: selected.map((item) => ({
          listingId: item.id,
          expectedRevision: revisions[item.id],
          requestId: crypto.randomUUID(),
        })),
      },
      button,
    );
  }
  function close() {
    dialog.current?.close();
    setCommand(null);
    trigger.current?.focus({ preventScroll: true });
  }
  async function execute() {
    if (!command || !sameActor || busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    const path = location.pathname,
      currentActor = actor;
    const here = () =>
      alive.current &&
      clerk.user?.id === currentActor &&
      location.pathname === path;
    try {
      const result = await duplicateProductsAction(command);
      if (!here()) return;
      if (!result.ok) {
        setError(result.code);
        return;
      }
      setOutcomes((current) => {
        const merged = new Map(current.map((row) => [row.listingId, row]));
        for (const row of result.data) merged.set(row.listingId, row);
        return [...merged.values()];
      });
      const succeeded = result.data
        .filter((row) => row.result.ok)
        .map((row) => row.listingId);
      const failed = command.items.filter(
        (row) => !succeeded.includes(row.listingId),
      );
      setRetry(failed.length ? { sellerId, items: failed } : null);
      onComplete(succeeded);
      close();
      router.refresh();
    } catch {
      if (here()) setError("NOT_AVAILABLE");
    } finally {
      busy.current = false;
      if (alive.current) setPending(false);
    }
  }
  return (
    <>
      {selected.length > 1 && (
        <div className={s.toolbar}>
          <button
            className={a.secondary}
            disabled={
              pending ||
              !clerk.user ||
              selected.some((item) => item.status === "restricted")
            }
            onClick={(event) => begin(event.currentTarget)}
          >
            {bg
              ? "Дублирай избраните като чернови"
              : "Duplicate selected as drafts"}
          </button>
        </div>
      )}
      {error && !command && (
        <p role="alert" className={s.feedback}>
          {message(error)}
        </p>
      )}
      {outcomes.length > 0 && sameActor && (
        <section
          className={s.feedback}
          aria-label={bg ? "Резултати от копирането" : "Copy results"}
        >
          <p role="status">
            {bg
              ? `Създадени чернови: ${outcomes.filter((row) => row.result.ok).length} от ${outcomes.length}.`
              : `Drafts created: ${outcomes.filter((row) => row.result.ok).length} of ${outcomes.length}.`}
          </p>
          <ul>
            {outcomes.map((row) => (
              <li key={row.listingId}>
                {row.result.ok ? (
                  <Link
                    href={`/app/sellers/${sellerId}/listings/${row.result.data.id}/edit?lang=${language}`}
                  >
                    {bg ? "Редактирай копието: " : "Edit copy: "}
                    {labels[row.listingId]}
                  </Link>
                ) : (
                  <>
                    {labels[row.listingId]}: {message(row.result.code)}
                  </>
                )}
              </li>
            ))}
          </ul>
          {retry && (
            <button
              className={a.secondary}
              disabled={pending}
              onClick={(event) => open(retry, event.currentTarget)}
            >
              {bg ? "Повтори неуспешните копия" : "Retry unsuccessful copies"}
            </button>
          )}
          <button
            className={a.secondary}
            disabled={pending}
            onClick={() => router.refresh()}
          >
            {bg ? "Презареди списъка" : "Reload list"}
          </button>
        </section>
      )}
      <dialog
        ref={dialog}
        className={s.dialog}
        aria-labelledby="bulk-copy-title"
        onCancel={(event) => {
          if (pending) event.preventDefault();
          else setCommand(null);
        }}
      >
        <h2 id="bulk-copy-title">
          {bg ? "Създай отделни чернови" : "Create separate drafts"}
        </h2>
        <p>
          {bg
            ? "Запазените описания се копират. Снимките, наличностите, вариантите и складовите кодове не се копират. Избери състоянието отново. Оригиналите не се променят и нищо не се публикува."
            : "Saved descriptions are copied. Photos, stock, variants and SKUs are not copied. Select condition again. Originals are unchanged and nothing is published."}
        </p>
        <p>
          {bg
            ? `Избрани продукти: ${command?.items.length ?? 0}`
            : `Selected products: ${command?.items.length ?? 0}`}
        </p>
        {!sameActor && <p role="alert">{message("FORBIDDEN")}</p>}
        {error && <p role="alert">{message(error)}</p>}
        {pending && (
          <p role="status">
            {bg ? "Създаване на черновите…" : "Creating drafts…"}
          </p>
        )}
        <div className={s.dialogActions}>
          <button className={a.secondary} disabled={pending} onClick={close}>
            {bg ? "Отказ" : "Cancel"}
          </button>
          <button
            className={a.primary}
            disabled={pending || !sameActor || !command}
            onClick={() => void execute()}
          >
            {error === "NOT_AVAILABLE"
              ? bg
                ? "Повтори същата заявка"
                : "Retry this request"
              : bg
                ? "Създай черновите"
                : "Create drafts"}
          </button>
        </div>
      </dialog>
    </>
  );
}
