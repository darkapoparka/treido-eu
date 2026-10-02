import Link from "next/link";
import type { BusinessSetupView, DeclarationReadiness } from "./setup-model";
import type { SellerReadiness } from "./readiness";
import styles from "./workspace.module.css";

export function declarationLabel(status: DeclarationReadiness, bg: boolean) {
  const labels = {
    required: ["Details required", "Нужни са данни"],
    review_required: [
      "Review requested · not verified",
      "Заявена проверка · няма верификация",
    ],
    current: ["Declaration accepted", "Декларацията е приета"],
    rejected: ["Needs correction", "Нужна е корекция"],
    stale: [
      "Requirements changed · update needed",
      "Изискванията са променени · обновете данните",
    ],
  };
  return labels[status][bg ? 1 : 0];
}
export function SetupChecklist({
  setup,
  language,
}: {
  setup: Pick<
    BusinessSetupView,
    | "sellerId"
    | "revision"
    | "lastStep"
    | "hasDraft"
    | "canCreateDraft"
    | "declarationStatus"
    | "canEditProfile"
    | "canEditDeclaration"
  >;
  language: "bg" | "en";
}) {
  const bg = language === "bg";
  const base = `/app/sellers/${setup.sellerId}`;
  return (
    <section
      className={`account-panel ${styles.checklist}`}
      aria-labelledby="business-setup-title"
    >
      <h2 id="business-setup-title">
        {bg ? "Настройки на бизнеса" : "Business setup"}
      </h2>
      <p>
        {bg
          ? "Продължете откъдето сте спрели. Може да създадете чернова по всяко време."
          : "Continue where you left off. You can create a draft at any time."}
      </p>
      <ol>
        <li>
          <span>
            <strong>{bg ? "Данни за бизнеса" : "Business details"}</strong>
            <small>
              {setup.revision
                ? bg
                  ? "Има запазени настройки"
                  : "Setup answers saved"
                : bg
                  ? "Името е запазено; добавете подробности"
                  : "Name saved; add your details"}
            </small>
          </span>
          <Link
            className={styles.link}
            href={`${base}/onboarding?step=details&lang=${language}`}
          >
            {bg ? "Отвори" : "Open"}
          </Link>
        </li>
        <li>
          <span>
            <strong>{bg ? "Данни за търговец" : "Trader declaration"}</strong>
            <small>{declarationLabel(setup.declarationStatus, bg)}</small>
          </span>
          <Link
            className={styles.link}
            href={`${base}/onboarding?step=declaration&lang=${language}`}
          >
            {bg ? "Отвори" : "Open"}
          </Link>
        </li>
        <li>
          <span>
            <strong>{bg ? "Първи артикул" : "First item"}</strong>
            <small>
              {setup.hasDraft === null
                ? bg
                  ? "Нямате достъп до обявите"
                  : "Listing access is not granted"
                : setup.hasDraft
                  ? bg
                    ? "Има запазена чернова"
                    : "A draft is saved"
                  : bg
                    ? "Подгответе първата чернова"
                    : "Prepare your first draft"}
            </small>
          </span>
          {setup.canCreateDraft && (
            <Link
              className={styles.link}
              href={`${base}/listings/new?lang=${language}`}
            >
              {bg ? "Започни" : "Start"}
            </Link>
          )}
        </li>
        <li>
          <span>
            <strong>
              {bg ? "Доставка и връщане" : "Delivery and returns"}
            </strong>
            <small>
              {bg
                ? "Настройването още не е достъпно"
                : "Setup is not available yet"}
            </small>
          </span>
        </li>
        <li>
          <span>
            <strong>{bg ? "Плащания" : "Payments"}</strong>
            <small>
              {bg
                ? "Плащанията и изплащането още не са достъпни"
                : "Payments and payouts are not available yet"}
            </small>
          </span>
        </li>
      </ol>
      <Link
        className={styles.link}
        href={`${base}/onboarding?lang=${language}`}
      >
        {bg ? "Продължи настройките" : "Resume setup"}
      </Link>
    </section>
  );
}
export function OperationReadiness({
  readiness,
  language,
}: {
  readiness: readonly SellerReadiness[];
  language: "bg" | "en";
}) {
  const bg = language === "bg";
  const titles = {
    draft: bg ? "Нова чернова" : "New draft",
    publish: bg ? "Публикуване" : "Publishing",
    checkout: bg ? "Плащане през Treido" : "Treido checkout",
    payout: bg ? "Изплащане" : "Payouts",
    support: bg ? "Обслужване" : "Support",
  };
  return (
    <section className={`account-panel ${styles.checklist}`}>
      <h2>{bg ? "Какво е достъпно" : "What is available"}</h2>
      <dl className={styles.summary}>
        {readiness.map((item) => (
          <div key={item.operation}>
            <dt>{titles[item.operation]}</dt>
            <dd>
              {item.status === "allowed"
                ? bg
                  ? "Достъпно"
                  : "Available"
                : item.reasonCodes.includes("DRAFT_QUOTA_EXCEEDED")
                  ? bg
                    ? "Достигнат лимит за чернови"
                    : "Draft limit reached"
                  : item.reasonCodes.includes("CAPABILITY_REQUIRED")
                    ? bg
                      ? "Нужно е разрешение от собственик"
                      : "Owner permission required"
                    : bg
                      ? "Все още не е достъпно"
                      : "Not available yet"}
            </dd>
          </div>
        ))}
      </dl>
      <p className="form-note">
        {bg
          ? "Запазените настройки не са разрешение за публикуване, плащане или изплащане."
          : "Saved setup answers do not grant permission to publish, charge or receive payouts."}
      </p>
    </section>
  );
}
