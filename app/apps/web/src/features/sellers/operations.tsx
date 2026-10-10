import Link from "next/link";
import { operationDestination, type SellerOperationsView } from "./operations-model";
import styles from "./operations.module.css";

const copy = {
  en: {
    title: "Your operations", observed: "Current records, checked", open: "Open",
    counts: {
      drafts: ["Draft products", "Continue editing; publication requires a separate review."],
      withdrawn: ["Withdrawn products", "Review the saved product before explicitly publishing a new version."],
      restricted: ["Products under restriction", "Review the current restriction; editing or a paid plan cannot clear it."],
      published: ["Eligible publications", "Current public eligibility, not a promise of available stock."],
      photos: ["Products with failed photos", "Open the product, remove the failed photo and retry the original upload."],
      stock: ["SKUs with no available units", "Reserved units are included. Refunds never restock automatically."],
      offers: ["Buyer offers awaiting a decision", "Review the actual price, quantity and deadline in the conversation."],
      imports: ["Imports needing attention", "Resume the original import or correct its rows; do not upload duplicates."],
      orders: ["Recorded paid orders", "Includes refunded and disputed history. This is not revenue or delivery proof."],
      fulfilment: ["Orders awaiting fulfilment", "Open the pickup or shipping queue. Seller reports are not delivery confirmation."],
      payments: ["Orders with financial follow-up", "Pending refunds, disputes and payment or settlement reconciliation remain unresolved until verified."],
    },
    progress: "Recorded selling milestones", complete: "Complete", pending: "Not yet recorded",
    milestones: { product: "A saved product", photo: "A processed photo", publication: "A currently eligible publication", order: "A provider-confirmed order record" },
    note: "These facts show progress, not permission to trade. Each publication, checkout and fulfilment action checks its own current requirements.",
    noAccess: "Your current permissions do not include operational datasets. Account selection does not grant access.",
  },
  bg: {
    title: "Твоите операции", observed: "Текущи записи, проверени", open: "Отвори",
    counts: {
      drafts: ["Чернови на продукти", "Продължи редакцията; публикуването изисква отделен преглед."],
      withdrawn: ["Оттеглени продукти", "Прегледай запазения продукт, преди изрично да публикуваш нова версия."],
      restricted: ["Ограничени продукти", "Прегледай текущото ограничение; редакция или платен план не го премахват."],
      published: ["Допустими публикации", "Текуща публична допустимост, а не обещание за наличност."],
      photos: ["Продукти с неуспешни снимки", "Отвори продукта, премахни неуспешната снимка и качи оригинала отново."],
      stock: ["Варианти без свободни бройки", "Включва резервирани бройки. Възстановяването на сума не попълва наличността."],
      offers: ["Оферти от купувачи за преглед", "Прегледай действителната цена, количество и срок в разговора."],
      imports: ["Импорти за довършване", "Продължи същия импорт или поправи редовете, без да създаваш дубликати."],
      orders: ["Записани платени поръчки", "Включва историята на възстановявания и спорове. Това не е приход или доказателство за доставка."],
      fulfilment: ["Поръчки за изпълнение", "Отвори опашката за получаване или изпращане. Съобщение от продавача не потвърждава доставка."],
      payments: ["Поръчки с финансово уточняване", "Изчакващи възстановявания, спорове и сверяване на плащания или преводи остават неуточнени до потвърждение."],
    },
    progress: "Отчетени стъпки за продажба", complete: "Изпълнено", pending: "Все още няма запис",
    milestones: { product: "Запазен продукт", photo: "Обработена снимка", publication: "Текущо допустима публикация", order: "Поръчка, потвърдена от платежния доставчик" },
    note: "Тези факти показват напредък, а не разрешение за търговия. Публикуването, плащането и изпълнението проверяват собствените си текущи изисквания.",
    noAccess: "Текущите ти права не включват оперативни данни. Изборът на акаунт не предоставя достъп.",
  },
} as const;

export function SellerOperations({ view, language }: { view: SellerOperationsView; language: "bg" | "en" }) {
  const t = copy[language];
  return (
    <section className={styles.section} aria-labelledby="seller-operations-title">
      <header className={styles.header}>
        <h2 id="seller-operations-title">{t.title}</h2>
        <p>{t.observed} <time dateTime={view.observedAt}>{new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Sofia" }).format(new Date(view.observedAt))}</time></p>
      </header>
      {view.counts.length ? <div className={styles.grid}>
        {view.counts.map((item) => {
          const path = operationDestination(view.sellerId, item.kind);
          return <article key={item.kind} className={styles.metric}>
            <h3>{t.counts[item.kind][0]}</h3>
            <strong>{new Intl.NumberFormat(language).format(item.count)}{item.hasMore ? "+" : ""}</strong>
            <p>{t.counts[item.kind][1]}</p>
            <Link href={`${path}${path.includes("?") ? "&" : "?"}lang=${language}`} prefetch={false}>{t.open}<span className={styles.srOnly}> {t.counts[item.kind][0]}</span></Link>
          </article>;
        })}
      </div> : <p>{t.noAccess}</p>}
      {view.milestones.length > 0 && <details className={styles.progress}>
        <summary>{t.progress} · {view.milestones.filter((item) => item.complete).length}/{view.milestones.length}</summary>
        <ul>{view.milestones.map((item) => <li key={item.kind}><span>{t.milestones[item.kind]}</span><span>{item.complete ? t.complete : t.pending}</span></li>)}</ul>
        <p>{t.note}</p>
      </details>}
    </section>
  );
}
