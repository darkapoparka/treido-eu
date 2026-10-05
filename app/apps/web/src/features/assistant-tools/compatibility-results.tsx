"use client";
import { getCategory } from "@treido/contracts/categories";
import { SourceLink } from "../discovery/return-navigation";
import { variantCaption } from "../inventory/model";
import { formatAttribute } from "../shopping-tools/tool-ui";
import type { CompatibilityView } from "./compatibility-model";
import { AssistantListingActions } from "./listing-actions";
import { assistantCopy, type AssistantLocale } from "./copy";
import s from "./assistant-tools.module.css";
export function CompatibilityResults({
  view,
  locale,
  subject,
}: {
  view: CompatibilityView;
  locale: AssistantLocale;
  subject: string;
}) {
  const t = assistantCopy[locale],
    category = view.requirements
      ? getCategory(view.requirements.categoryId)
      : null;
  return (
    <section aria-label={t.observed}>
      <h2>{t.observed}</h2>
      {!view.items.length && <p>{t.noCheck}</p>}
      {view.items.map((item) => (
        <article className={s.panel} key={item.listingId}>
          <h3>
            {item.position}. {item.current?.card.title ?? t.retired}
          </h3>
          {item.observed && (
            <p>
              {t.publication}: {item.observed.observation.publicationRevision} ·{" "}
              <time dateTime={item.observedAt}>
                {new Date(item.observedAt).toLocaleString(locale, {
                  timeZone: "Europe/Sofia",
                })}
              </time>
            </p>
          )}
          {item.changed && <p role="status">{t.changed}</p>}
          {item.current && (
            <>
              <p>
                {t.current} · {t.publication}: {item.current.revision} ·{" "}
                {t.checked}:{" "}
                <time dateTime={item.current.checkedAt}>
                  {new Date(item.current.checkedAt).toLocaleString(locale, {
                    timeZone: "Europe/Sofia",
                  })}
                </time>
              </p>
              <p>
                {t.sku}:{" "}
                {item.current.variant
                  ? variantCaption(item.current.variant.options) ||
                    item.current.variant.id
                  : t.noSku}
              </p>
              <p className={s.note}>{t.variantNote}</p>
            </>
          )}
          {item.evidence.length > 0 && (
            <div
              className={s.tableScroll}
              tabIndex={0}
              role="region"
              aria-label={t.observed}
            >
              <table className={s.table}>
                <caption>{t.sellerSource}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t.requirements}</th>
                    <th scope="col">{t.observed}</th>
                    <th scope="col">{t.current}</th>
                    <th scope="col">{t.compatibility}</th>
                  </tr>
                </thead>
                <tbody>
                  {item.evidence.map((e) => (
                    <tr key={e.field}>
                      <th scope="row">
                        {category?.kind === "leaf"
                          ? category.profile.fields.find(
                              (field) => field.id === e.field,
                            )?.labels[locale]
                          : e.field}
                        <p>
                          {t[e.operator]}: {formatAttribute(e.required, locale)}
                        </p>
                      </th>
                      <td>
                        {e.declared === null
                          ? t.unknown
                          : formatAttribute(e.declared, locale)}
                      </td>
                      <td>
                        {formatAttribute(
                          item.current?.attributes[e.field],
                          locale,
                        )}
                      </td>
                      <td>{t[e.outcome]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {item.current && (
            <>
              <SourceLink
                preserveDiscoveryContext={false}
                href={"/products/" + item.listingId + "?lang=" + locale}
              >
                {t.details}
              </SourceLink>
              <AssistantListingActions
                listingId={item.listingId}
                subject={subject}
              />
            </>
          )}
        </article>
      ))}
    </section>
  );
}
