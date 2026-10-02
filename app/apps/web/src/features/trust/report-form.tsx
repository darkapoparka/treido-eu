"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { reportResourceAction } from "./actions";
import s from "../messaging/messaging.module.css";
export function ReportForm({
  resourceId,
  resourceKind,
  onClose,
}: {
  resourceId: string;
  resourceKind: "listing" | "message";
  onClose?: () => void;
}) {
  const t = useTranslations("trust"),
    locale = useLocale();
  const [reason, setReason] = useState("abuse"),
    [details, setDetails] = useState("");
  const request = useRef<string | null>(null),
    active = useRef(true);
  const [pending, start] = useTransition(),
    [failed, setFailed] = useState(false),
    [receipt, setReceipt] = useState<string | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  if (receipt)
    return (
      <section role="status">
        <h3>{t("submitted")}</h3>
        <p>{t("receipt")}</p>
        <Link
          className={s.button}
          href={"/messages/reports/" + receipt + "?lang=" + locale}
        >
          {t("view")}
        </Link>
      </section>
    );
  return (
    <form
      className={s.reviewForm}
      onSubmit={(event) => {
        event.preventDefault();
        setFailed(false);
        request.current ??= crypto.randomUUID();
        start(async () => {
          try {
            const result = await reportResourceAction({
              resourceKind,
              resourceId,
              reason,
              details,
              requestId: request.current!,
            });
            if (!active.current) return;
            if (result.ok) setReceipt(result.data.id);
            else setFailed(true);
          } catch {
            if (active.current) setFailed(true);
          }
        });
      }}
    >
      <label>
        {t("reason")}
        <select
          value={reason}
          disabled={pending}
          onChange={(event) => {
            setReason(event.target.value);
            request.current = null;
          }}
        >
          {(
            ["unsafe", "counterfeit", "misleading", "abuse", "other"] as const
          ).map((value) => (
            <option key={value} value={value}>
              {t(value)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("details")}
        <textarea
          value={details}
          maxLength={2000}
          rows={5}
          disabled={pending}
          onChange={(event) => {
            setDetails(event.target.value);
            request.current = null;
          }}
        />
      </label>
      <p className={s.muted}>{t("detailsHint")}</p>
      {failed && (
        <p className={s.error} role="alert">
          {t("failed")}
        </p>
      )}
      <footer>
        {onClose && (
          <button type="button" className={s.button} onClick={onClose}>
            {t("cancel")}
          </button>
        )}
        <button className={s.button + " " + s.primary} disabled={pending}>
          {t(pending ? "sending" : "send")}
        </button>
      </footer>
    </form>
  );
}
