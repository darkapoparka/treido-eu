import Link from "next/link";
import { AdminIcon } from "./admin-icons";
import {
  operationDestination,
  type OperationKind,
  type SellerOperationsView,
} from "./operations-model";
import styles from "./operations.module.css";

const labels: Record<OperationKind, readonly [string, string]> = {
  published: ["Published products", "Публикувани продукти"],
  drafts: ["Draft products", "Чернови на продукти"],
  orders: ["Paid order history", "История на платени поръчки"],
  fulfilment: ["To fulfil", "За изпълнение"],
  withdrawn: ["Withdrawn products", "Оттеглени продукти"],
  restricted: ["Restricted products", "Ограничени продукти"],
  photos: ["Products with photo issues", "Продукти с проблемни снимки"],
  stock: ["Variants with no available stock", "Варианти без свободни бройки"],
  offers: ["Offers to review", "Оферти за преглед"],
  imports: ["Imports to finish", "Импорти за довършване"],
  payments: ["Payment follow-up", "Плащания за уточняване"],
};
const explanations: Partial<Record<OperationKind, readonly [string, string]>> =
  {
    orders: [
      "Includes refunded and disputed orders.",
      "Включва възстановени и оспорени поръчки.",
    ],
    published: [
      "Current publications; stock is managed separately.",
      "Текущи публикации; наличността се управлява отделно.",
    ],
    stock: [
      "Includes fully reserved stock.",
      "Включва изцяло резервираните бройки.",
    ],
    photos: [
      "Remove the failed photo and upload it again.",
      "Премахни неуспешната снимка и я качи отново.",
    ],
    payments: [
      "Review refunds, disputes and unconfirmed payments.",
      "Прегледай възстановяванията, споровете и непотвърдените плащания.",
    ],
  };
const primary: readonly OperationKind[] = [
  "published",
  "drafts",
  "orders",
  "fulfilment",
];

/** A compact projection of the existing operations query, never sample analytics. */
export function AdminHomeOperations({
  view,
  language,
}: {
  view: SellerOperationsView;
  language: "bg" | "en";
}) {
  const bg = language === "bg",
    index = bg ? 1 : 0;
  const number = new Intl.NumberFormat(language);
  const href = (kind: OperationKind) => {
    const path = operationDestination(view.sellerId, kind);
    return `${path}${path.includes("?") ? "&" : "?"}lang=${language}`;
  };
  const featured = primary.flatMap((kind) =>
    view.counts.filter((item) => item.kind === kind),
  );
  const queues = view.counts.filter((item) => !primary.includes(item.kind));
  return (
    <section className={styles.section} aria-labelledby="studio-overview-title">
      <header className={styles.header}>
        <h2 id="studio-overview-title">{bg ? "Общ преглед" : "Overview"}</h2>
        <p>
          {bg ? "Обновено" : "Updated"}{" "}
          <time dateTime={view.observedAt}>
            {new Intl.DateTimeFormat(language, {
              timeZone: "Europe/Sofia",
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(view.observedAt))}
          </time>
        </p>
      </header>
      {featured.length > 0 && (
        <div className={styles.overviewGrid}>
          {featured.map((item) => (
            <Link
              key={item.kind}
              href={href(item.kind)}
              prefetch={false}
              className={styles.overviewMetric}
            >
              <span>
                {labels[item.kind][index]}
                <AdminIcon name="arrow" />
              </span>
              <strong>
                {number.format(item.count)}
                {item.hasMore ? "+" : ""}
              </strong>
              {explanations[item.kind] && (
                <small>{explanations[item.kind]![index]}</small>
              )}
            </Link>
          ))}
        </div>
      )}
      {queues.length > 0 && (
        <div className={styles.queuePanel}>
          <h3>{bg ? "Управлявай продажбите" : "Manage your selling"}</h3>
          <div className={styles.queueGrid}>
            {queues.map((item) => (
              <Link
                key={item.kind}
                href={href(item.kind)}
                prefetch={false}
                className={styles.queue}
              >
                <span>
                  <strong>{labels[item.kind][index]}</strong>
                  {explanations[item.kind] && (
                    <small>{explanations[item.kind]![index]}</small>
                  )}
                </span>
                <span
                  className={styles.queueCount}
                  data-attention={item.count > 0 && item.kind !== "withdrawn"}
                >
                  {number.format(item.count)}
                  {item.hasMore ? "+" : ""}
                </span>
                <AdminIcon name="arrow" />
              </Link>
            ))}
          </div>
        </div>
      )}
      {!view.counts.length && (
        <p>
          {bg
            ? "Нямаш достъп до тези справки. Избери друг акаунт или се свържи със собственика."
            : "These reports are not available with your access. Choose another account or contact the owner."}
        </p>
      )}
    </section>
  );
}
