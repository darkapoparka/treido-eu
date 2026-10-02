"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import type { DecisionView } from "./report-views.server";
import { appealModerationAction } from "./actions";
import s from "../messaging/messaging.module.css";
export function DecisionCard({ decision }: { decision: DecisionView }) {
  const t = useTranslations("trust"),
    format = useFormatter(),
    router = useRouter();
  const [open, setOpen] = useState(false),
    [details, setDetails] = useState(""),
    [failed, setFailed] = useState(false),
    [saved, setSaved] = useState<string | null>(null);
  const [pending, start] = useTransition(),
    request = useRef<string | null>(null),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  return (
    <section className={s.notice}>
      <h3>{t(decision.state)}</h3>
      <time dateTime={decision.createdAt} className={s.muted}>
        {format.dateTime(new Date(decision.createdAt), {
          dateStyle: "medium",
          timeStyle: "short",
        })}
      </time>
      <p style={{ whiteSpace: "pre-wrap" }}>{decision.reason}</p>
      {decision.appeals.length > 0 && (
        <section>
          <h4>{t("yourAppeals")}</h4>
          {decision.appeals.map((appeal) => (
            <div key={appeal.id}>
              <p style={{ whiteSpace: "pre-wrap" }}>{appeal.details}</p>
              <small>
                {format.dateTime(new Date(appeal.createdAt), {
                  dateStyle: "medium",
                })}{" "}
                · {t("reference")}: {appeal.id}
              </small>
            </div>
          ))}
        </section>
      )}
      {saved ? (
        <p role="status">
          {t("appealSubmitted")} · {saved}
        </p>
      ) : open ? (
        <form
          className={s.reviewForm}
          onSubmit={(event) => {
            event.preventDefault();
            setFailed(false);
            request.current ??= crypto.randomUUID();
            start(async () => {
              try {
                const result = await appealModerationAction({
                  actionId: decision.id,
                  details,
                  requestId: request.current!,
                });
                if (!alive.current) return;
                if (result.ok) {
                  setSaved(result.data.id);
                  setDetails("");
                  router.refresh();
                } else setFailed(true);
              } catch {
                if (alive.current) setFailed(true);
              }
            });
          }}
        >
          <p>{t("appealNote")}</p>
          <label>
            {t("details")}
            <textarea
              required
              rows={5}
              value={details}
              maxLength={2000}
              disabled={pending}
              onChange={(event) => {
                setDetails(event.target.value);
                request.current = null;
              }}
            />
          </label>
          {failed && (
            <p className={s.error} role="alert">
              {t("appealFailed")}
            </p>
          )}
          <div className={s.actions}>
            <button
              type="button"
              className={s.button}
              onClick={() => setOpen(false)}
            >
              {t("cancel")}
            </button>
            <button
              disabled={pending || !details.trim()}
              className={s.button + " " + s.primary}
            >
              {t(pending ? "sending" : "appealSend")}
            </button>
          </div>
        </form>
      ) : (
        <button className={s.button} onClick={() => setOpen(true)}>
          {t("appeal")}
        </button>
      )}
    </section>
  );
}
