"use client";
import type { InputView } from "./model";
import { inputCopy } from "./copy";
import s from "../photo-match/photo.module.css";
/** The recorded choice can be withdrawn independently of current processing
 * approval, model availability, grant expiry or a changed policy version. */
export function InputConsentWithdrawal({
  choice,
  locale,
  blocked,
  onWithdraw,
}: {
  choice: InputView["consentChoice"];
  locale: "bg" | "en";
  blocked: boolean;
  onWithdraw: (policyId: string) => void;
}) {
  if (!choice?.granted) return null;
  const t = inputCopy[locale];
  return (
    <div className={s.panel}>
      <p>{t.withdrawNote}</p>
      <button
        type="button"
        className={s.button}
        disabled={blocked}
        onClick={() => onWithdraw(choice.policyId)}
      >
        {t.withdraw}
      </button>
    </div>
  );
}
