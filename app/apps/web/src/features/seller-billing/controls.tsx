"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { useClerk, useReverification } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { billingCommandAction, recoverBillingAction } from "./actions";
import { billingText } from "./messages";
import { parseBillingCommand, type BillingCommand } from "./model";
import type { SellerBillingView } from "./queries.server";
import type { publicIntent } from "./commands.server";
import s from "./billing.module.css";
import { BillingRecoveryControls } from "./recovery-controls";

const ORIGINAL_EVENT = "treido-billing-original-v1";
const emptyOriginalSnapshot = () => null;
type Result = ReturnType<typeof publicIntent>;
export function BillingControls({
  view,
  language,
}: {
  view: SellerBillingView;
  language: "bg" | "en";
}) {
  const clerk = useClerk(),
    router = useRouter(),
    reverified = useReverification(billingCommandAction),
    [pending, start] = useTransition(),
    [error, setError] = useState(false),
    [result, setResult] = useState<Result | null>(null),
    [memoryOriginal, setMemoryOriginal] = useState<BillingCommand | null>(null),
    [cancelReview, setCancelReview] = useState(false),
    live = useRef(false),
    busy = useRef(false),
    t = billingText(language),
    scope = `treido-billing:${view.actorKey}:${view.sellerId}`;
  const subscribeOriginal = useCallback(
    (notify: () => void) => {
      const onStorage = (event: StorageEvent) => {
        if (event.key === scope || event.key === null) notify();
      };
      const onOriginal = (event: Event) => {
        if (event instanceof CustomEvent && event.detail === scope) notify();
      };
      window.addEventListener("storage", onStorage);
      window.addEventListener(ORIGINAL_EVENT, onOriginal);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(ORIGINAL_EVENT, onOriginal);
      };
    },
    [scope],
  );
  const readOriginal = useCallback(() => {
    try {
      return sessionStorage.getItem(scope);
    } catch {
      return null;
    }
  }, [scope]);
  const storedRaw = useSyncExternalStore(
    subscribeOriginal,
    readOriginal,
    emptyOriginalSnapshot,
  );
  const storedOriginal = useMemo(() => {
    try {
      const parsed = storedRaw
        ? parseBillingCommand(JSON.parse(storedRaw))
        : null;
      return parsed &&
        parsed.sellerId === view.sellerId &&
        parsed.actorKey === view.actorKey
        ? parsed
        : null;
    } catch {
      return null;
    }
  }, [storedRaw, view.sellerId, view.actorKey]);
  const original =
    memoryOriginal?.sellerId === view.sellerId &&
    memoryOriginal.actorKey === view.actorKey
      ? memoryOriginal
      : storedOriginal;
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const current = () => live.current && clerk.user?.id === view.actorSubject;
  function run(command: BillingCommand) {
    if (busy.current || !current()) return;
    busy.current = true;
    setError(false);
    setResult(null);
    setMemoryOriginal(command);
    try {
      sessionStorage.setItem(scope, JSON.stringify(command));
      window.dispatchEvent(new CustomEvent(ORIGINAL_EVENT, { detail: scope }));
    } catch {}
    start(async () => {
      try {
        const response = await reverified(command);
        if (!current()) return;
        if (!response.ok || response.actorSubject !== view.actorSubject) {
          setError(true);
          return;
        }
        setResult(response.data);
        router.refresh();
      } catch {
        if (current()) setError(true);
      } finally {
        busy.current = false;
      }
    });
  }
  function command(
    operation: BillingCommand["operation"],
    plan: SellerBillingView["plans"][number] | null = null,
    previewId: string | null = null,
    reviewHash: string | null = null,
  ) {
    run({
      sellerId: view.sellerId,
      actorKey: view.actorKey,
      requestId: crypto.randomUUID(),
      operation,
      planId: plan?.planId ?? null,
      version: plan?.version ?? null,
      previewId,
      ...(reviewHash ? { reviewHash } : {}),
      language,
    });
  }
  function recover() {
    if (!original || busy.current || !current()) return;
    busy.current = true;
    setError(false);
    start(async () => {
      try {
        const response = await recoverBillingAction({
          sellerId: view.sellerId,
          actorKey: view.actorKey,
          requestId: original.requestId,
        });
        if (!current()) return;
        if (!response.ok || response.actorSubject !== view.actorSubject)
          setError(true);
        else {
          setResult(response.data);
          router.refresh();
        }
      } catch {
        if (current()) setError(true);
      } finally {
        busy.current = false;
      }
    });
  }
  const blocked = view.intents.some(
    (i) =>
      ["checkout", "change"].includes(i.operation) &&
      ["prepared", "creating", "reconciling", "ready"].includes(i.state),
  );
  const target =
    result?.operation === "preview"
      ? view.plans.find(
          (p) =>
            p.planId === original?.planId && p.version === original.version,
        )
      : null;
  return (
    <div className={s.stack}>
      {(view.available || view.subscription) && (
        <div className={s.actions}>
          {!view.subscription &&
            view.plans.slice(0, 1).map((p) => (
              <button
                key={p.id}
                disabled={pending || blocked}
                onClick={() => command("checkout", p)}
              >
                {t.checkout} · {t.version} {p.version}
              </button>
            ))}
          {view.subscription && (
            <>
              {view.available && (
                <button disabled={pending} onClick={() => command("portal")}>
                  {t.portal}
                </button>
              )}
              {!view.subscription.cancelAtPeriodEnd && (
                <button
                  disabled={pending}
                  onClick={() => setCancelReview(true)}
                >
                  {t.cancel}
                </button>
              )}
              {view.plans
                .filter((p) => p.id !== view.subscription?.catalogueId)
                .map((p) => (
                  <button
                    key={p.id}
                    disabled={pending || blocked}
                    onClick={() => command("preview", p)}
                  >
                    {t.preview} · {t.version} {p.version}
                  </button>
                ))}
            </>
          )}
        </div>
      )}
      {cancelReview && (
        <section className={s.notice}>
          <p>{t.cancelReview}</p>
          <button
            disabled={pending}
            onClick={() => {
              setCancelReview(false);
              command("cancel");
            }}
          >
            {t.cancelConfirm}
          </button>
        </section>
      )}
      {original && (
        <div className={s.actions}>
          <button disabled={pending} onClick={recover}>
            {t.recover}
          </button>
          {result?.state === "prepared" && (
            <button disabled={pending} onClick={() => run(original)}>
              {t.open}
            </button>
          )}
        </div>
      )}
      {error && <p role="alert">{t.error}</p>}
      {result && (
        <section aria-live="polite" className={s.notice}>
          <p>
            {t.status}: {result.state}
          </p>
          {["creating", "reconciling"].includes(result.state) && (
            <p>{t.pending}</p>
          )}
          {result.url && (
            <a
              href={result.url}
              rel="noopener noreferrer"
              target="_blank"
              onClick={(event) => {
                if (
                  !current() ||
                  (result.operation !== "change" &&
                    Date.now() >= Date.parse(result.expiresAt))
                ) {
                  event.preventDefault();
                  setResult(null);
                }
              }}
            >
              {t.open}
            </a>
          )}
          {result.preview && target && (
            <>
              <p>
                {t.estimate}:{" "}
                {new Intl.NumberFormat(language, {
                  style: "currency",
                  currency: "EUR",
                }).format(result.preview.amountMinor / 100)}
              </p>
              <p>{t.estimateNote}</p>
              <p>
                {t.version}: {target.version} · {t.terms}: {target.termsVersion}{" "}
                ·
                {new Intl.NumberFormat(language, {
                  style: "currency",
                  currency: "EUR",
                }).format(target.amountMinor / 100)}
              </p>
              <p>{target.terms[language]}</p>
              <button
                disabled={pending || blocked}
                onClick={() => {
                  if (
                    !current() ||
                    Date.now() >= Date.parse(result.expiresAt)
                  ) {
                    setError(true);
                    setResult(null);
                    return;
                  }
                  command(
                    "change",
                    target,
                    result.id,
                    result.preview?.reviewHash ?? null,
                  );
                }}
              >
                {t.confirmChange}
              </button>
            </>
          )}
        </section>
      )}
      {view.intents.filter((i) => ["creating", "reconciling"].includes(i.state))
        .length > 0 && <p role="status">{t.pending}</p>}
      {view.intents
        .filter(
          (i) =>
            ["checkout", "change"].includes(i.operation) &&
            ["prepared", "creating", "reconciling", "ready"].includes(i.state),
        )
        .map((intent) => (
          <BillingRecoveryControls
            key={intent.id}
            intent={intent}
            view={view}
            language={language}
          />
        ))}
    </div>
  );
}
