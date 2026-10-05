"use client";
import Link from "next/link";
import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { readBuyerCartAction, changeBuyerCartAction } from "./actions";
import {
  BuyerSessionBoundary,
  usePrivateScope,
} from "../library/session-boundary";
import { acceptsPrivateResult } from "../library/private-session";
import { cartChangedEvent } from "./use-cart";
import type { CartCommand, CartOperation } from "./model";
type Props = {
  operation: CartOperation;
  base?: { actorKey: string; revision: number; subject: string };
  label: string;
  disabled?: boolean;
  refreshPage?: boolean;
  className?: string;
};
/** Each click is an explicit authenticated command. No cart data is stored locally. */
export function CartMutationButton(props: Props) {
  return (
    <BuyerSessionBoundary>
      <ScopedCartMutationButton {...props} />
    </BuyerSessionBoundary>
  );
}
function ScopedCartMutationButton({
  operation,
  label,
  disabled = false,
  refreshPage = false,
  className = "pill",
  base,
}: Props) {
  const t = useTranslations("buyerCart"),
    locale = useLocale(),
    router = useRouter(),
    scope = usePrivateScope();
  const [pending, start] = useTransition();
  const [workingKey, setWorkingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    key: string;
    error: string | null;
    saved: boolean;
  }>({ key: scope.key, error: null, saved: false });
  const state = useRef({
    key: scope.key,
    identityKey: scope.identityKey,
    generation: 0,
    busy: false,
    attempt: null as { key: string; command: CartCommand } | null,
  });
  const live = useRef(true);
  useLayoutEffect(() => {
    const current = state.current;
    if (current.key !== scope.key) {
      current.key = scope.key;
      ++current.generation;
      current.busy = false;
      if (current.identityKey !== scope.identityKey) current.attempt = null;
      current.identityKey = scope.identityKey;
    }
    live.current = true;
    return () => {
      live.current = false;
      ++current.generation;
    };
  }, [scope.key, scope.identityKey]);
  function submit() {
    if (
      state.current.busy ||
      disabled ||
      !scope.isCurrent() ||
      state.current.key !== scope.key
    )
      return;
    if (!scope.subject) {
      setFeedback({
        key: scope.key,
        error:
          scope.key === "unconfigured" ? "NOT_AVAILABLE" : "UNAUTHENTICATED",
        saved: false,
      });
      return;
    }
    if (base && base.subject !== scope.subject) return;
    state.current.busy = true;
    setWorkingKey(scope.key);
    const ticket = ++state.current.generation;
    const current = () =>
      live.current &&
      state.current.key === scope.key &&
      state.current.generation === ticket &&
      scope.isCurrent();
    setFeedback({ key: scope.key, error: null, saved: false });
    start(async () => {
      try {
        const key = JSON.stringify(operation);
        if (state.current.attempt?.key !== key) {
          const result = base
            ? { ok: true as const, subject: base.subject, data: base }
            : await readBuyerCartAction();
          // In particular, never turn a delayed A read into a command submitted as B.
          if (!current()) return;
          if (!acceptsPrivateResult(scope, result)) {
            if (!result.ok && result.code === "UNAUTHENTICATED")
              setFeedback({ key: scope.key, error: result.code, saved: false });
            return;
          }
          if (!result.ok) {
            setFeedback({ key: scope.key, error: result.code, saved: false });
            return;
          }
          state.current.attempt = {
            key,
            command: {
              operation,
              actorKey: result.data.actorKey,
              expectedRevision: result.data.revision,
              requestId: crypto.randomUUID(),
            },
          };
        }
        if (!current()) return;
        const result = await changeBuyerCartAction(
          state.current.attempt.command,
          scope.subject!,
        );
        if (!current()) return;
        if (!acceptsPrivateResult(scope, result)) {
          state.current.attempt = null;
          if (!result.ok && result.code === "UNAUTHENTICATED")
            setFeedback({ key: scope.key, error: result.code, saved: false });
          return;
        }
        if (!result.ok) {
          setFeedback({ key: scope.key, error: result.code, saved: false });
          if (result.code !== "NOT_AVAILABLE") state.current.attempt = null;
          if (refreshPage) window.dispatchEvent(new Event(cartChangedEvent));
          return;
        }
        state.current.attempt = null;
        setFeedback({ key: scope.key, error: null, saved: true });
        window.dispatchEvent(new Event(cartChangedEvent));
        if (typeof BroadcastChannel !== "undefined") {
          const channel = new BroadcastChannel(cartChangedEvent);
          channel.postMessage("changed");
          channel.close();
        }
        if (refreshPage) router.refresh();
      } catch {
        if (current())
          setFeedback({ key: scope.key, error: "NOT_AVAILABLE", saved: false });
      } finally {
        if (current()) {
          state.current.busy = false;
          setWorkingKey(null);
        }
      }
    });
  }
  const visible =
    feedback.key === scope.key && scope.isCurrent() ? feedback : null;
  const error = visible?.error,
    saved = visible?.saved;
  const saving = pending && workingKey === scope.key;
  return (
    <div>
      <button
        type="button"
        className={className}
        disabled={saving || disabled || !scope.isCurrent()}
        onClick={submit}
      >
        {saving ? t("saving") : label}
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
