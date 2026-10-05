import "server-only";
import Link from "next/link";
import { pageLocale } from "../locale/page-locale.server";
import { ShopSurface } from "../discovery/hydration-boundary";
import s from "../selling/selling.module.css";
const copy = {
  en: {
    title: "Help with Treido",
    home: "Home",
    intro:
      "Choose the item, conversation or account setting you need help with. Private records require sign-in and current access.",
    chat: "Live support chat is not available here. No message has been sent. Use the relevant order, report or account workflow below.",
    selling: "Start selling",
    sellingNote:
      "Prepare your personal item or business catalogue, check a CSV and review photo, stock and delivery requirements.",
    guide: "Open the seller guide",
    workspace: "Open my selling workspace",
    orders: "An order, return or refund",
    orderNote:
      "Open the relevant order and its support controls. A cart, accepted offer or saved purchase review is not proof of payment. Report payment uncertainty through the order workflow instead of paying again.",
    orderLink: "Open my orders",
    contact: "A conversation or an offer",
    contactNote:
      "Open the conversation to reply, review an offer, or block further contact. Report a specific message from its conversation; this preserves the correct context without exposing private messages publicly.",
    contactLink: "Open my conversations",
    safety: "A listing report or an appeal",
    safetyNote:
      "Use Report on the affected listing or message. Existing reports and appeals have private status pages. A report does not automatically remove content and an appeal does not automatically restore it.",
    reports: "My reports",
    appeals: "My appeals",
    account: "My account and personal data",
    accountNote:
      "Review your own sessions, privacy preferences, data requests or closure options. Business and payment obligations may require further steps before closure.",
    security: "Account security",
    privacy: "Privacy and data controls",
    invited: "A business invitation",
    invitationNote:
      "Use the email address the invitation was sent to. Incoming invitations show current access, expiry and recipient choices; a copied link does not grant access.",
    invitations: "Open my invitations",
    caution:
      "Never send passwords, sign-in codes, complete card numbers or private documents in a public listing. Keep payment and support evidence in the relevant private workflow.",
  },
  bg: {
    title: "Помощ за Treido",
    home: "Начало",
    intro:
      "Избери артикула, разговора или настройката, за която ти трябва помощ. Личните записи изискват вход и актуални права за достъп.",
    chat: "Тук няма активен чат с поддръжката. Не е изпратено съобщение. Използвай съответната поръчка, сигнал или настройка на акаунта по-долу.",
    selling: "Започни да продаваш",
    sellingNote:
      "Подготви личен артикул или бизнес каталог, провери CSV файл и прегледай изискванията за снимки, наличности и доставка.",
    guide: "Отвори ръководството за продавачи",
    workspace: "Отвори моите продажби",
    orders: "Поръчка, връщане или възстановяване",
    orderNote:
      "Отвори съответната поръчка и действията за поддръжка. Количка, приета оферта или запазен преглед не доказват плащане. Провери неясното плащане чрез поръчката, вместо да плащаш повторно.",
    orderLink: "Отвори моите поръчки",
    contact: "Разговор или оферта",
    contactNote:
      "Отвори разговора, за да отговориш, прегледаш оферта или блокираш нов контакт. Подай сигнал за конкретно съобщение от самия разговор; така контекстът остава точен и личните съобщения не се публикуват.",
    contactLink: "Отвори моите разговори",
    safety: "Сигнал за обява или обжалване",
    safetyNote:
      "Използвай действието за сигнал в съответната обява или съобщение. Подадените сигнали и обжалвания имат лични страници със състояние. Сигналът не премахва автоматично съдържанието, а обжалването не го възстановява автоматично.",
    reports: "Моите сигнали",
    appeals: "Моите обжалвания",
    account: "Моят акаунт и лични данни",
    accountNote:
      "Прегледай собствените си сесии, предпочитания за поверителност, заявки за данни или закриване. Бизнес и платежни задължения може да изискват допълнителни стъпки преди закриването.",
    security: "Сигурност на акаунта",
    privacy: "Поверителност и лични данни",
    invited: "Покана за бизнес",
    invitationNote:
      "Използвай имейл адреса, до който е изпратена поканата. Входящите покани показват актуален достъп, срок и действия за получателя; копиран линк не дава права.",
    invitations: "Отвори моите покани",
    caution:
      "Не изпращай пароли, кодове за вход, пълни номера на карти или лични документи в публична обява. Пази доказателствата за плащания и поддръжка в съответния личен процес.",
  },
} as const;
export async function SupportHubPage({
  searchParams,
  chatUnavailable = false,
}: {
  searchParams: Promise<{ lang?: string | string[] }>;
  chatUnavailable?: boolean;
}) {
  const language = await pageLocale((await searchParams).lang),
    t = copy[language];
  const href = (route: string) => route + "?lang=" + language;
  return (
    <ShopSurface className={"account-page " + s.page} data-support-hub>
      <header className={s.toolbar}>
        <Link className={s.textButton} href={href("/")}>
          {t.home}
        </Link>
        <Link
          className={s.textButton}
          href={"/support?lang=" + (language === "en" ? "bg" : "en")}
        >
          {language === "en" ? "Български" : "English"}
        </Link>
      </header>
      <h1>{t.title}</h1>
      <p className={s.intro}>{t.intro}</p>
      {chatUnavailable && <p role="status">{t.chat}</p>}
      <section className="account-panel">
        <h2>{t.selling}</h2>
        <p>{t.sellingNote}</p>
        <div className={s.actions}>
          <Link className={s.textButton} href={href("/sell/start")}>
            {t.guide}
          </Link>
          <Link className={s.textButton} href={href("/app")}>
            {t.workspace}
          </Link>
        </div>
      </section>
      <section className="account-panel">
        <h2>{t.orders}</h2>
        <p>{t.orderNote}</p>
        <Link className={s.textButton} href={href("/orders")}>
          {t.orderLink}
        </Link>
      </section>
      <section className="account-panel">
        <h2>{t.contact}</h2>
        <p>{t.contactNote}</p>
        <Link className={s.textButton} href={href("/messages")}>
          {t.contactLink}
        </Link>
      </section>
      <section className="account-panel">
        <h2>{t.safety}</h2>
        <p>{t.safetyNote}</p>
        <div className={s.actions}>
          <Link className={s.textButton} href={href("/messages/reports")}>
            {t.reports}
          </Link>
          <Link className={s.textButton} href={href("/messages/appeals")}>
            {t.appeals}
          </Link>
        </div>
      </section>
      <section className="account-panel">
        <h2>{t.account}</h2>
        <p>{t.accountNote}</p>
        <div className={s.actions}>
          <Link
            className={s.textButton}
            href={href("/account/privacy/security")}
          >
            {t.security}
          </Link>
          <Link className={s.textButton} href={href("/account/privacy")}>
            {t.privacy}
          </Link>
        </div>
      </section>
      <section className="account-panel">
        <h2>{t.invited}</h2>
        <p>{t.invitationNote}</p>
        <Link className={s.textButton} href={href("/app/invitations")}>
          {t.invitations}
        </Link>
      </section>
      <p>{t.caution}</p>
    </ShopSurface>
  );
}
