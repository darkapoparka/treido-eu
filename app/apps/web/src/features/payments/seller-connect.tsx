import Link from "next/link";
import type { ReactNode } from "react";
import { connectRequirementGroups, connectStatusState, type ConnectStatus } from "./connect-status";
import type { PaymentLanguage } from "./messages";
import a from "../sellers/admin.module.css";
import s from "./seller-connect.module.css";
const copy = {
  en: {
    title: "Payments & payouts", account: "Connected account", unavailable: "Account status could not be checked. No payment or payout readiness has been assumed.",
    separate: "These are current provider account checks, not approval to sell. Every checkout separately rechecks the published item, stock, accepted delivery and aftercare terms, approved payment policy and current account capabilities.",
    redirect: "Returning from Stripe does not confirm verification, payment or a bank payout.",
    checked: "Last checked", submitted: "Details submitted", payouts: "Bank payouts enabled", transfers: "Transfers capability", cards: "Card payments capability", enabled: "Yes", disabled: "No", notRequested: "Not requested",
    platform: "Account checks for platform-settled purchases", seller: "Account checks for seller-settled purchases", passed: "Account checks passed", notPassed: "Account checks not passed",
    due: "Information needed now", overdue: "Overdue information", verifying: "Being verified by Stripe", later: "May be required later", deadline: "Provider deadline", providerCode: "Provider requirement", noDue: "No information is currently due.",
    fix: "Continue securely on Stripe to provide or correct requested information. Treido does not collect bank details or identity documents in this form.",
    readOnly: "You can review account status. A current member with payment-setup permission must continue onboarding.",
    states: { unsupported: "Account country or currency is not supported by the current binding", restricted: "Account restricted — review with Stripe", action_required: "Information needs attention", under_review: "Verification in progress", capabilities_ready: "Account capabilities available", pending: "Account capabilities pending" },
    caps: { active: "Active", pending: "Pending", inactive: "Inactive", unrequested: "Not requested" },
  },
  bg: {
    title: "Плащания и изплащания", account: "Свързан платежен акаунт", unavailable: "Статусът на акаунта не може да бъде проверен. Не е приета готовност за плащане или изплащане.",
    separate: "Това са текущи проверки на платежния акаунт, а не разрешение за продажба. Всяка покупка проверява отделно публикацията, наличността, приетите условия за доставка и следпродажбено обслужване, одобрената платежна политика и текущите възможности на акаунта.",
    redirect: "Връщането от Stripe не потвърждава проверка, плащане или изплащане по банка.",
    checked: "Последна проверка", submitted: "Данните са подадени", payouts: "Банковите изплащания са разрешени", transfers: "Възможност за преводи", cards: "Възможност за картови плащания", enabled: "Да", disabled: "Не", notRequested: "Не е заявена",
    platform: "Проверки на акаунта при продажби с платформа получател", seller: "Проверки на акаунта при продажби с продавач получател", passed: "Проверките на акаунта са преминати", notPassed: "Проверките на акаунта не са преминати",
    due: "Необходими данни сега", overdue: "Просрочени данни", verifying: "Stripe проверява данните", later: "Възможни бъдещи изисквания", deadline: "Срок от платежния доставчик", providerCode: "Изискване на доставчика", noDue: "В момента няма дължими данни.",
    fix: "Продължете защитено в Stripe, за да предоставите или коригирате необходимите данни. Treido не събира банкови данни или документи за самоличност в този формуляр.",
    readOnly: "Можете да прегледате статуса. Настройката се продължава от текущ член с право за настройка на плащанията.",
    states: { unsupported: "Държавата или валутата на акаунта не се поддържа от текущата връзка", restricted: "Акаунтът е ограничен — проверете в Stripe", action_required: "Има данни за допълване", under_review: "Проверката е в ход", capabilities_ready: "Възможностите на акаунта са налични", pending: "Възможностите на акаунта изчакват" },
    caps: { active: "Активна", pending: "Изчаква", inactive: "Неактивна", unrequested: "Не е заявена" },
  },
} as const;
export function SellerConnectView({ sellerId, sellerName, capabilities, status, language, onboarding }: {
  sellerId: string; sellerName: string; capabilities: readonly string[]; status: ConnectStatus | null; language: PaymentLanguage; onboarding?: ReactNode;
}) {
  const t = copy[language], bg = language === "bg", base = `/app/sellers/${sellerId}`, suffix = `?lang=${language}`;
  const groups = status ? connectRequirementGroups(status) : null;
  const capability = (value: string) => value in t.caps ? t.caps[value as keyof typeof t.caps] : t.notRequested;
  return <main>
    <header className={a.pageBar}><h1>{t.title}</h1><Link className={a.secondary} href={`${base}/settings/payments${suffix}`}>{bg ? "Провери отново" : "Check again"}</Link></header>
    <div className={`${a.pageBody} ${s.body}`}>
      <section className={s.card} aria-labelledby="connect-account-title">
        <div className={s.heading}><div><p className={s.eyebrow}>{t.account}</p><h2 id="connect-account-title">{sellerName}</h2></div>
          {status && <span className={s.badge} role="status">{t.states[connectStatusState(status)]}</span>}</div>
        {!status ? <p role="status">{t.unavailable}</p> : <>
          <dl className={s.facts}>
            <div><dt>{t.submitted}</dt><dd>{status.detailsSubmitted ? t.enabled : t.disabled}</dd></div>
            <div><dt>{t.transfers}</dt><dd>{capability(status.transfers)}</dd></div>
            <div><dt>{t.payouts}</dt><dd>{status.payoutsEnabled ? t.enabled : t.disabled}</dd></div>
            <div><dt>{t.cards}</dt><dd>{capability(status.cardPayments)}</dd></div>
          </dl>
          <p className={s.muted}>{t.checked}: <time dateTime={status.checkedAt}>{new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(status.checkedAt))}</time></p>
          <div className={s.policyChecks}><p>{t.platform}: <strong>{status.platformAccountReady ? t.passed : t.notPassed}</strong></p><p>{t.seller}: <strong>{status.sellerAccountReady ? t.passed : t.notPassed}</strong></p></div>
        </>}
        <p className={s.muted}>{t.separate}</p><p className={s.muted}>{t.redirect}</p>
      </section>
      {status && groups && <section className={s.card} aria-labelledby="connect-work-title">
        <h2 id="connect-work-title">{bg ? "Следващи стъпки" : "Next steps"}</h2>
        {status.requirementsDeadline && <p>{t.deadline}: <time dateTime={status.requirementsDeadline}>{new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(status.requirementsDeadline))}</time></p>}
        {!groups.current.length && !groups.pastDue.length && <p>{t.noDue}</p>}
        {([ [t.overdue, groups.pastDue], [t.due, groups.current], [t.verifying, groups.verification], [t.later, groups.later] ] as const).map(([title, fields]) => fields.length > 0 && <div className={s.requirements} key={title}><h3>{title}</h3><ul>{fields.map((field) => <li key={field}><span className={s.muted}>{t.providerCode}: </span><code>{field}</code></li>)}</ul></div>)}
        <p>{t.fix}</p>{onboarding ?? <p className={s.muted}>{t.readOnly}</p>}
      </section>}
      <nav className={s.links} aria-label={bg ? "Свързани настройки" : "Related settings"}>
        {capabilities.includes("order.read") && <Link className={a.secondary} href={`${base}/orders${suffix}`}>{bg ? "Поръчки" : "Orders"}</Link>}
        {capabilities.includes("billing.manage") && <Link className={a.secondary} href={`${base}/billing${suffix}`}>{bg ? "План и фактури" : "Plan & invoices"}</Link>}
        {capabilities.includes("delivery.manage") && <Link className={a.secondary} href={`${base}/settings/delivery${suffix}`}>{bg ? "Доставка и връщане" : "Delivery & returns"}</Link>}
        {capabilities.includes("declaration.manage") && <Link className={a.secondary} href={`${base}/onboarding${suffix}&step=declaration`}>{bg ? "Декларации на продавача" : "Seller declarations"}</Link>}
      </nav>
    </div>
  </main>;
}
