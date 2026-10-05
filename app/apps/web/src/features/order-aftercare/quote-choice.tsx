"use client";
import { useState } from "react";
import type { ReviewSource } from "../purchase-reviews/model";
import { CreateQuoteButton } from "../payments/controls";
import type { NewQuoteAftercareChoice } from "./quote-choice.server";
import { aftercareText } from "./messages";
import s from "../purchase-reviews/reviews.module.css";
export function NewQuoteAftercareControl({
  actorKey,
  actorSubject,
  source,
  policyId,
  language,
  choice,
}: {
  actorKey: string;
  actorSubject: string;
  source: ReviewSource;
  policyId: string;
  language: "bg" | "en";
  choice: NewQuoteAftercareChoice;
}) {
  const [acceptedHash, setAcceptedHash] = useState<string | null>(null),
    t = aftercareText(language);
  const agreed = acceptedHash === choice.termsHash;
  return (
    <div className={s.stack}>
      <p>{choice.terms}</p>
      <p className={s.muted}>{choice.retentionDescription}</p>
      <label>
        <input
          type="checkbox"
          checked={agreed}
          onChange={(event) =>
            setAcceptedHash(event.target.checked ? choice.termsHash : null)
          }
        />
        {t.agree}
      </label>
      {agreed && (
        <CreateQuoteButton
          actorKey={actorKey}
          actorSubject={actorSubject}
          source={source}
          policyId={policyId}
          language={language}
          aftercare={{
            policyId: choice.policyId,
            version: choice.version,
            termsHash: choice.termsHash,
            acknowledged: true,
          }}
        />
      )}
    </div>
  );
}
