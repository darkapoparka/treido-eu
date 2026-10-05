import type { PublicPurchaseFeedback } from "../order-feedback/view";
import { SourceLink } from "./return-navigation";
import { purchaseFeedbackHref } from "./purchase-feedback-model";

export type PurchaseFeedbackData = {
  available: boolean;
  items: PublicPurchaseFeedback[];
  more: boolean;
  page: number;
};
const copy = {
  bg: {
    title: "Отзиви за завършени поръчки",
    verified: "Потвърдена завършена поръчка",
    empty: "Няма отзиви за показване на тази страница.",
    unavailable: "Отзивите за поръчки в момента не са достъпни.",
    retry: "Опитай отново",
    previous: "Предишни отзиви",
    next: "Следващи отзиви",
  },
  en: {
    title: "Completed-order feedback",
    verified: "Verified completed order",
    empty: "No feedback to show on this page.",
    unavailable: "Order feedback is currently unavailable.",
    retry: "Try again",
    previous: "Previous feedback",
    next: "Next feedback",
  },
} as const;

/** Only the current public projection reaches this section. It contains no
 * buyer identity, paid-order link, provider details or private case evidence. */
export function PurchaseFeedback({
  data,
  locale,
  onRetry,
  sellerId,
}: {
  data: PurchaseFeedbackData;
  locale: "bg" | "en";
  onRetry: () => void;
  sellerId: string;
}) {
  const text = copy[locale];
  return (
    <section aria-label={text.title}>
      <h2>{text.title}</h2>
      {!data.available ? (
        <>
          <p role="status">{text.unavailable}</p>
          <button className="primary" onClick={onRetry}>
            {text.retry}
          </button>
        </>
      ) : !data.items.length ? (
        <p>{text.empty}</p>
      ) : (
        <>
          {data.items.map((item) => (
            <article key={item.id}>
              <p>
                <strong>
                  {text.verified} · {item.rating}/5
                </strong>
              </p>
              <p>{item.body}</p>
              <time dateTime={item.publishedAt}>
                {new Intl.DateTimeFormat(locale === "bg" ? "bg-BG" : "en-GB", {
                  dateStyle: "medium",
                  timeZone: "Europe/Sofia",
                }).format(new Date(item.publishedAt))}
              </time>
            </article>
          ))}
        </>
      )}
      {data.available && (data.page > 0 || (data.more && data.page < 9)) && (
        <nav aria-label={text.title}>
          {data.page > 0 && (
            <SourceLink
              preserveDiscoveryContext={false}
              href={purchaseFeedbackHref(sellerId, locale, data.page - 1)}
            >
              {text.previous}
            </SourceLink>
          )}
          {data.more && data.page < 9 && (
            <SourceLink
              preserveDiscoveryContext={false}
              href={purchaseFeedbackHref(sellerId, locale, data.page + 1)}
            >
              {text.next}
            </SourceLink>
          )}
        </nav>
      )}
    </section>
  );
}
