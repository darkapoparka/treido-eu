import type { BillingRecoveryReceipt } from "./queries.server";
import s from "./billing.module.css";
import r from "./recovery-history.module.css";
const copy = {
  en: {
    title: "Recovery history",
    empty: "No recovery requests are recorded for this seller.",
    note: "These receipts record recovery work, not successful payment, cancellation or refund. The financial outcome remains on the original billing attempt and verified invoice. A saved escalation is not proof that an external support recipient has been contacted.",
    recent: "Latest 30 requests for this seller account.",
    reference: "Recovery reference",
    intent: "Original billing attempt",
    updated: "Last updated",
    operations: {
      observe: "Check provider outcome",
      abandon: "Abandon reviewed attempt",
      escalate: "Support escalation",
    },
    states: {
      creating: "Processing recovery request",
      reconciling: "Awaiting verified outcome",
      complete: "Recovery request recorded",
    },
    unknown: "Unrecognized request state — review required",
  },
  bg: {
    title: "История на възстановяването",
    empty: "Няма записани заявки за възстановяване за този продавач.",
    note: "Тези записи удостоверяват действия по възстановяване, а не успешно плащане, отказ или възстановена сума. Финансовият резултат остава в първоначалния платежен опит и проверената фактура. Записана ескалация не доказва, че е изпратено съобщение до външен екип за поддръжка.",
    recent: "Последните 30 заявки за този акаунт на продавач.",
    reference: "Номер на възстановяването",
    intent: "Първоначален платежен опит",
    updated: "Последна промяна",
    operations: {
      observe: "Проверка на платежния резултат",
      abandon: "Прекратяване на прегледан опит",
      escalate: "Ескалация за поддръжка",
    },
    states: {
      creating: "Заявката се обработва",
      reconciling: "Изчаква проверен резултат",
      complete: "Заявката за възстановяване е записана",
    },
    unknown: "Неразпознат статус на заявката — необходим е преглед",
  },
} as const;
export function BillingRecoveryHistory({
  receipts,
  language,
}: {
  receipts: readonly BillingRecoveryReceipt[];
  language: "bg" | "en";
}) {
  const t = copy[language];
  const date = new Intl.DateTimeFormat(language, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return (
    <section
      className={s.card}
      aria-labelledby="billing-recovery-history-title"
    >
      <h2 id="billing-recovery-history-title">{t.title}</h2>
      <p className={s.muted}>{t.note}</p>
      {!receipts.length ? (
        <p>{t.empty}</p>
      ) : (
        <>
          <p className={s.muted}>{t.recent}</p>
          <ol className={r.receipts}>
            {receipts.map((receipt) => (
              <li key={receipt.id}>
                <h3>{t.operations[receipt.operation]}</h3>
                <p>
                  {receipt.state in t.states
                    ? t.states[receipt.state as keyof typeof t.states]
                    : t.unknown}
                </p>
                <dl>
                  <div>
                    <dt>{t.reference}</dt>
                    <dd>
                      <code>{receipt.id}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>{t.intent}</dt>
                    <dd>
                      <code>{receipt.intentId}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>{t.updated}</dt>
                    <dd>
                      <time dateTime={receipt.updatedAt}>
                        {date.format(new Date(receipt.updatedAt))}
                      </time>
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
