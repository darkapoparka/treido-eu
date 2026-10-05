import { shippingText } from "./messages";
import type { Language, Recipient } from "./model";
import s from "../purchase-reviews/reviews.module.css";
/** Render only the narrow result of readOrderShippingRecipient; no resource
 * lookup, private cache or alternate buyer/merchant authority in this view. */
export function ShippingRecipientDetails({
  details,
  language,
}: {
  details:
    | { available: false }
    | {
        available: true;
        recipient: Recipient;
        purpose: string;
        retention: string;
        country: string;
        method: string;
        carrier: string;
      };
  language: Language;
}) {
  const t = shippingText(language);
  if (!details.available) return <p role="status">{t.recipientUnavailable}</p>;
  return (
    <section className={s.card}>
      <h2>{t.recipient}</h2>
      <p>
        {details.carrier} · {details.country}
      </p>
      <dl className={s.stack}>
        {Object.entries(details.recipient).map(([field, value]) => (
          <div key={field}>
            <dt>{t.fields[field as keyof typeof t.fields]}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p>{details.purpose}</p>
      <p className={s.muted}>{details.retention}</p>
      <p className={s.muted}>{t.manual}</p>
    </section>
  );
}
