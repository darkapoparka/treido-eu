"use client";
import { useState } from "react";
import type { FeedbackView } from "./view";
import { submitFeedbackAction, recoverFeedbackAction } from "./actions";
import { useDurableRequest } from "../order-aftercare/use-durable-request";
import { aftercareText } from "../order-aftercare/messages";
import s from "../purchase-reviews/reviews.module.css";
export function FeedbackComposer({ view }: { view: FeedbackView }) {
  const t = aftercareText(view.language),
    [rating, setRating] = useState(5),
    [body, setBody] = useState(""),
    [acceptedHash, setAcceptedHash] = useState<string | null>(null),
    command = useDurableRequest({
      key: "treido-order-feedback:" + view.actorKey + ":" + view.orderId,
      actorSubject: view.actorSubject,
      language: view.language,
      scope: {
        actorKey: view.actorKey,
        orderId: view.orderId,
        sellerId: null,
        language: view.language,
      },
      recovery: {
        actorKey: view.actorKey,
        orderId: view.orderId,
        sellerId: null,
      },
      action: submitFeedbackAction,
      recover: recoverFeedbackAction,
    });
  if (!view.eligible || !view.policy)
    return <p>{view.available ? t.notEligible : t.unavailable}</p>;
  const policy = view.policy;
  const agreed = acceptedHash === policy.termsHash;
  return (
    <form
      className={s.stack}
      onSubmit={(event) => {
        event.preventDefault();
        if (!agreed) return;
        command.run({
          expectedRevision: view.orderRevision,
          policyId: policy.id,
          version: policy.version,
          termsHash: policy.termsHash,
          acknowledged: true,
          rating,
          body,
        });
      }}
    >
      <fieldset className={s.stack} disabled={command.disabled}>
        <legend>{t.feedback}</legend>
        <p>{policy.terms}</p>
        <p className={s.muted}>{policy.retentionDescription}</p>
        <label className={s.field}>
          {t.rating}
          <select
            value={rating}
            onChange={(event) => setRating(Number(event.target.value))}
          >
            {[1, 2, 3, 4, 5].map((value) => (
              <option value={value} key={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className={s.field}>
          {t.body}
          <textarea
            required
            maxLength={2000}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) =>
              setAcceptedHash(event.target.checked ? policy.termsHash : null)
            }
          />
          {t.agree}
        </label>
        <button type="submit" className={s.primary} disabled={!agreed}>
          {t.submitFeedback}
        </button>
      </fieldset>
      {command.status && <p role="status">{command.status}</p>}
      {command.original && (
        <button
          className={s.secondary}
          type="button"
          disabled={command.pending}
          onClick={command.recover}
        >
          {t.recover}
        </button>
      )}
    </form>
  );
}
