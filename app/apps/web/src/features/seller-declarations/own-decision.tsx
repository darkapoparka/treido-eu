import type { OwnDeclarationDecision } from "./model";
import styles from "../sellers/workspace.module.css";

export function OwnDeclarationDecisionNotice({
  decision,
  language,
}: {
  decision: OwnDeclarationDecision | null;
  language: "bg" | "en";
}) {
  if (!decision) return null;
  const bg = language === "bg";
  return (
    <section
      className="account-panel"
      aria-label={bg ? "Проверка на декларацията" : "Trader declaration review"}
      data-own-declaration-decision
    >
      <h2>
        {decision.decision === "accepted"
          ? bg
            ? "Декларацията е приета"
            : "Declaration accepted"
          : bg
            ? "Данните се нуждаят от корекция"
            : "Trader details need correction"}
      </h2>
      <dl className={styles.summary}>
        <div>
          <dt>{bg ? "Основание" : "Reason"}</dt>
          <dd>{decision.reason}</dd>
        </div>
      </dl>
      <p className="form-note">
        {bg
          ? "Решението се отнася за изпратените данни. То не е потвърдена верификация или разрешение за публикуване."
          : "This decision applies to the submitted details. It does not confirm verification or permission to publish."}
      </p>
    </section>
  );
}
