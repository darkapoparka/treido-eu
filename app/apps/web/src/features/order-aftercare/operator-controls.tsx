"use client";
import { useState } from "react";
import { useReverification } from "@clerk/nextjs";
import {
  orderCaseDecisionAction,
  orderFeedbackDecisionAction,
  recoverOperatorDecisionAction,
} from "./actions";
import { useDurableRequest } from "./use-durable-request";
import { aftercareText } from "./messages";
import s from "../purchase-reviews/reviews.module.css";
export function OperatorDecisionForm({
  actorKey,
  actorSubject,
  resourceId,
  revision,
  kind,
  language,
}: {
  actorKey: string;
  actorSubject: string;
  resourceId: string;
  revision: number;
  kind: "case" | "feedback";
  language: "bg" | "en";
}) {
  const caseAction = useReverification(orderCaseDecisionAction),
    feedbackAction = useReverification(orderFeedbackDecisionAction),
    t = aftercareText(language),
    [decision, setDecision] = useState(
      kind === "case" ? "operator_information" : "hide",
    ),
    [body, setBody] = useState("");
  const command = useDurableRequest({
    key: "treido-order-ops:" + actorKey + ":" + kind + ":" + resourceId,
    actorSubject,
    language,
    scope: {
      actorKey,
      ...(kind === "case"
        ? { caseId: resourceId }
        : { feedbackId: resourceId }),
    },
    recovery: { actorKey, kind, resourceId },
    action: kind === "case" ? caseAction : feedbackAction,
    recover: recoverOperatorDecisionAction,
  });
  return (
    <form
      className={s.stack}
      onSubmit={(event) => {
        event.preventDefault();
        command.run({
          decision,
          expectedRevision: revision,
          ...(kind === "case" ? { body } : { reason: body }),
        });
      }}
    >
      <fieldset className={s.stack} disabled={command.disabled}>
        <legend>{kind === "case" ? t.operations : t.feedback}</legend>
        {kind === "case" && <p>{t.nonFinancial}</p>}
        <label className={s.field}>
          {t.decision}
          <select
            value={decision}
            onChange={(event) => setDecision(event.target.value)}
          >
            {kind === "case" ? (
              <>
                <option value="operator_information">{t.information}</option>
                <option value="operator_recommendation">
                  {t.recommendation}
                </option>
                <option value="operator_no_decision">{t.noDecision}</option>
              </>
            ) : (
              <>
                <option value="hide">{t.hide}</option>
                <option value="publish">{t.publish}</option>
              </>
            )}
          </select>
        </label>
        <label className={s.field}>
          {t.body}
          <textarea
            required
            maxLength={kind === "case" ? 2000 : 1000}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </label>
        <button type="submit" className={s.primary}>
          {t.decision}
        </button>
      </fieldset>
      {command.status && <p role="status">{command.status}</p>}
      {command.original && (
        <button
          type="button"
          className={s.secondary}
          disabled={command.pending}
          onClick={command.recover}
        >
          {t.recover}
        </button>
      )}
    </form>
  );
}
