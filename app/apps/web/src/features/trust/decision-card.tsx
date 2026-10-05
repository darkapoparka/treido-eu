"use client";
import Link from "next/link";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { DecisionView } from "./report-views.server";
import { AppealComposer } from "./appeal-composer";
import { CaseDecisionCard } from "./case-form";
import s from "../messaging/messaging.module.css";
export function DecisionCard({ decision }: { decision: DecisionView }) {
  const t = useTranslations("trust"),
    cases = useTranslations("trustCases"),
    format = useFormatter(),
    language = useLocale();
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
          <h4>{cases("yourAppeals")}</h4>
          {decision.appeals.map((appeal) => (
            <div key={appeal.id}>
              <p style={{ whiteSpace: "pre-wrap" }}>{appeal.details}</p>
              <small>
                {format.dateTime(new Date(appeal.createdAt), {
                  dateStyle: "medium",
                })}{" "}
                · {t("reference")}: {appeal.id}
              </small>
              {appeal.decision && (
                <CaseDecisionCard decision={appeal.decision} />
              )}
              <p>
                <Link
                  href={"/messages/appeals/" + appeal.id + "?lang=" + language}
                >
                  {cases("openAppeal")}
                </Link>
              </p>
            </div>
          ))}
        </section>
      )}
      <AppealComposer
        actionId={decision.id}
        actorKey={decision.viewer.actorKey}
        actorSubject={decision.viewer.actorSubject}
      />
    </section>
  );
}
