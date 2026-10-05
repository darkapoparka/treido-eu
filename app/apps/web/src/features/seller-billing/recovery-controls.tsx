"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useClerk, useReverification } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { billingRecoveryCommandAction } from "./actions";
import {
  parseBillingRecovery,
  type BillingRecoveryCommand,
} from "./recovery-model";
import type { publicIntent } from "./commands.server";
import type { SellerBillingView } from "./queries.server";
import { billingText } from "./messages";
import s from "./billing.module.css";

export function BillingRecoveryControls({
  intent,
  view,
  language,
}: {
  intent: ReturnType<typeof publicIntent>;
  view: SellerBillingView;
  language: "bg" | "en";
}) {
  const clerk = useClerk(),
    router = useRouter(),
    verified = useReverification(billingRecoveryCommandAction);
  const [pending, start] = useTransition(),
    [error, setError] = useState(false);
  const [receipt, setReceipt] = useState<{
    receiptId: string;
    state: string;
    operation: string;
  } | null>(null);
  const [review, setReview] = useState(false),
    busy = useRef(false),
    live = useRef(true);
  const original = useRef<BillingRecoveryCommand | null>(null),
    t = billingText(language);
  const scope = `treido-billing-recovery:${view.actorKey}:${view.sellerId}:${intent.id}`;
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  function run(operation: BillingRecoveryCommand["operation"]) {
    if (busy.current || clerk.user?.id !== view.actorSubject) return;
    let command = original.current;
    try {
      if (command?.operation !== operation) command = null;
      command ??= parseBillingRecovery(
        JSON.parse(sessionStorage.getItem(scope + ":" + operation) ?? "null"),
      );
      if (
        !command ||
        command.operation !== operation ||
        command.actorKey !== view.actorKey ||
        command.sellerId !== view.sellerId ||
        command.intentId !== intent.id
      )
        command = {
          sellerId: view.sellerId,
          actorKey: view.actorKey,
          intentId: intent.id,
          requestId: crypto.randomUUID(),
          expectedRevision: intent.revision,
          operation,
        };
      sessionStorage.setItem(scope + ":" + operation, JSON.stringify(command));
      original.current = command;
    } catch {
      setError(true);
      return;
    }
    const accepted = command;
    busy.current = true;
    setError(false);
    start(async () => {
      try {
        const response = await verified(accepted);
        if (!live.current || clerk.user?.id !== view.actorSubject) return;
        if (!response.ok || response.actorSubject !== view.actorSubject) {
          setError(true);
          if (
            !response.ok &&
            ["CONFLICT", "INVALID_INPUT", "QUOTA_EXCEEDED"].includes(
              response.code,
            )
          ) {
            original.current = null;
            try {
              sessionStorage.removeItem(scope + ":" + accepted.operation);
            } catch {}
            router.refresh();
          }
        } else {
          setReceipt(response.data);
          setReview(false);
          if (response.data.state === "complete") {
            original.current = null;
            try {
              sessionStorage.removeItem(scope + ":" + accepted.operation);
            } catch {}
          }
          router.refresh();
        }
      } catch {
        if (live.current) setError(true);
      } finally {
        busy.current = false;
      }
    });
  }
  return (
    <section className={s.notice} aria-label={t.recoveryTitle}>
      <p>
        {t.status}: {intent.state}
      </p>
      <p>
        {t.reference}: {intent.id}
      </p>
      {intent.recovery === "legacy" && <p>{t.legacyRecovery}</p>}
      {intent.recovery === "observe" && <p>{t.unknownRecovery}</p>}
      {intent.url && (
        <a href={intent.url} target="_blank" rel="noopener noreferrer">
          {t.open}
        </a>
      )}
      <div className={s.actions}>
        <button disabled={pending} onClick={() => run("observe")}>
          {t.reconcile}
        </button>
        {["unattempted", "invoice"].includes(intent.recovery) && (
          <button disabled={pending} onClick={() => setReview(true)}>
            {t.abandon}
          </button>
        )}
        <button disabled={pending} onClick={() => run("escalate")}>
          {t.escalate}
        </button>
      </div>
      {review && (
        <div>
          <p>{t.abandonReview}</p>
          <div className={s.actions}>
            <button disabled={pending} onClick={() => run("abandon")}>
              {t.abandonConfirm}
            </button>
            <button disabled={pending} onClick={() => setReview(false)}>
              {t.back}
            </button>
          </div>
        </div>
      )}
      {receipt && (
        <p role="status">
          {receipt.operation === "escalate" ? t.supportSaved : t.pending} ·{" "}
          {t.reference}: {receipt.receiptId} · {receipt.state}
        </p>
      )}
      {error && <p role="alert">{t.error}</p>}
      <Link href="/support/help">{t.support}</Link>
    </section>
  );
}
