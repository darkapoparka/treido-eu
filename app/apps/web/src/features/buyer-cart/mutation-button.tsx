"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { readBuyerCartAction, changeBuyerCartAction } from "./actions";
import type { CartCommand, CartOperation } from "./model";
/** Each click is an explicit authenticated command. No cart data is stored locally. */
export function CartMutationButton({
  operation,
  label,
  disabled = false,
  refreshPage = false,
  className = "pill",
  base,
}: {
  operation: CartOperation;
  base?: { actorKey: string; revision: number };
  label: string;
  disabled?: boolean;
  refreshPage?: boolean;
  className?: string;
}) {
  const t = useTranslations("buyerCart"),
    locale = useLocale(),
    router = useRouter();
  const [pending, start] = useTransition(),
    [error, setError] = useState<string | null>(null),
    [saved, setSaved] = useState(false);
  const attempt = useRef<{ key: string; command: CartCommand } | null>(null),
    live = useRef(true),
    busy = useRef(false);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  function submit() {
    if (busy.current || disabled) return;
    busy.current = true;
    setError(null);
    setSaved(false);
    start(async () => {
      try {
        const key = JSON.stringify(operation);
        if (attempt.current?.key !== key) {
          const current = base
            ? { ok: true as const, data: base }
            : await readBuyerCartAction();
          if (!live.current) return;
          if (!current.ok) {
            setError(current.code);
            return;
          }
          attempt.current = {
            key,
            command: {
              operation,
              actorKey: current.data.actorKey,
              expectedRevision: current.data.revision,
              requestId: crypto.randomUUID(),
            },
          };
        }
        const result = await changeBuyerCartAction(attempt.current.command);
        if (!live.current) return;
        if (!result.ok) {
          setError(result.code);
          if (result.code !== "NOT_AVAILABLE") attempt.current = null;
          if (refreshPage) router.refresh();
          return;
        }
        attempt.current = null;
        setSaved(true);
        if (refreshPage) router.refresh();
      } catch {
        if (live.current) setError("NOT_AVAILABLE");
      } finally {
        busy.current = false;
      }
    });
  }
  return (
    <div>
      <button
        type="button"
        className={className}
        disabled={pending || disabled}
        onClick={submit}
      >
        {pending ? t("saving") : label}
      </button>
      {saved && (
        <p className="form-note" role="status">
          {t(operation.kind === "add" ? "added" : "saved")}{" "}
          {!refreshPage && (
            <Link href={"/cart?lang=" + locale}>{t("open")}</Link>
          )}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error === "UNAUTHENTICATED" ? (
            <Link
              href={
                "/sign-in?lang=" +
                locale +
                "&returnTo=" +
                encodeURIComponent("/cart?lang=" + locale)
              }
            >
              {t("signIn")}
            </Link>
          ) : (
            t(
              error === "CONFLICT"
                ? "conflict"
                : error === "INVALID_INPUT"
                  ? "invalid"
                  : error === "QUOTA_EXCEEDED"
                    ? "limit"
                    : error === "FORBIDDEN"
                      ? "forbidden"
                      : "failed",
            )
          )}
        </p>
      )}
    </div>
  );
}
