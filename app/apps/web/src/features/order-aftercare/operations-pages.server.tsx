import "server-only";
import Link from "next/link";
import { OperationsNav } from "../trust/operations-ui.server";
import { connection } from "next/server";
import { getDatabase } from "../../server/db/database";
import { backendConfigured } from "../sellers/backend-status.server";
import {
  requirePageIdentity,
  privatePageFailure,
} from "../sellers/page-context.server";
import { SellerError } from "../sellers/errors";
import { pageLocale } from "../locale/page-locale.server";
import { PaymentBoundary } from "../payments/controls";
import { readOperatorAftercare } from "./operators.server";
import { readFeedbackModeration } from "../order-feedback/moderation.server";
import { OperatorDecisionForm } from "./operator-controls";
import { aftercareText, aftercareState } from "./messages";
import s from "../purchase-reviews/reviews.module.css";
async function readOptionalOperation<T>(read: () => Promise<T>) {
  try {
    return await read();
  } catch (error) {
    if (error instanceof SellerError && error.code === "NOT_AVAILABLE")
      return null;
    privatePageFailure(error);
  }
}
export type OperationsAftercareProps = {
  params: Promise<{ id?: string }>;
  searchParams: Promise<{ lang?: string }>;
};
export async function AftercareOperationsPage(props: OperationsAftercareProps) {
  await connection();
  const { id } = await props.params,
    language = await pageLocale((await props.searchParams).lang),
    t = aftercareText(language),
    path = "/ops/order-aftercare" + (id ? "/cases/" + id : "");
  const header = (
    <header className={s.header}>
      <h1>{t.operations}</h1>
      <OperationsNav language={language} active="aftercare" />
      <Link
        className={s.secondary}
        href={"/ops/order-aftercare?lang=" + language}
      >
        {t.operations}
      </Link>
      <Link
        className={s.secondary}
        href={"/ops/order-aftercare/feedback?lang=" + language}
      >
        {t.feedback}
      </Link>
    </header>
  );
  if (!backendConfigured())
    return (
      <main className={s.page}>
        {header}
        <p role="status">{t.unavailable}</p>
      </main>
    );
  const identity = await requirePageIdentity(path + "?lang=" + language),
    view = await readOptionalOperation(() =>
      readOperatorAftercare(getDatabase(), identity, id),
    );
  if (!view)
    return (
      <main className={s.page}>
        {header}
        <p role="status">{t.unavailable}</p>
      </main>
    );
  return (
    <main className={s.page}>
      {header}
      <PaymentBoundary actorSubject={view.actorSubject} language={language}>
        <div className={s.stack}>
          <p>{t.nonFinancial}</p>
          {view.cases.map((item) => (
            <section className={s.card} key={item.id}>
              <h2>
                <Link
                  href={
                    "/ops/order-aftercare/cases/" +
                    item.id +
                    "?lang=" +
                    language
                  }
                >
                  {item.id}
                </Link>
              </h2>
              <p>{aftercareState(item.state, language)}</p>
              {item.events.map((event) => (
                <article key={event.id}>
                  <p>{event.body}</p>
                  {event.evidence.map((text, index) => (
                    <p key={index}>{text}</p>
                  ))}
                </article>
              ))}
              {id && view.canDecide && item.state === "review_requested" && (
                <OperatorDecisionForm
                  key={item.id + ":" + item.revision}
                  actorKey={view.actorKey}
                  actorSubject={view.actorSubject}
                  resourceId={item.id}
                  revision={item.revision}
                  kind="case"
                  language={language}
                />
              )}
              {item.moreEvents && <p>{t.more}</p>}
            </section>
          ))}
          {view.more && <p>{t.more}</p>}
        </div>
      </PaymentBoundary>
    </main>
  );
}
export async function FeedbackModerationPage(props: OperationsAftercareProps) {
  await connection();
  const language = await pageLocale((await props.searchParams).lang),
    t = aftercareText(language),
    header = (
      <header className={s.header}>
        <h1>{t.feedback}</h1>
        <OperationsNav language={language} active="aftercare" />
        <Link
          className={s.secondary}
          href={"/ops/order-aftercare?lang=" + language}
        >
          {t.operations}
        </Link>
      </header>
    );
  if (!backendConfigured())
    return (
      <main className={s.page}>
        {header}
        <p role="status">{t.unavailable}</p>
      </main>
    );
  const identity = await requirePageIdentity(
      "/ops/order-aftercare/feedback?lang=" + language,
    ),
    view = await readOptionalOperation(() =>
      readFeedbackModeration(getDatabase(), identity),
    );
  if (!view)
    return (
      <main className={s.page}>
        {header}
        <p role="status">{t.unavailable}</p>
      </main>
    );
  return (
    <main className={s.page}>
      {header}
      <PaymentBoundary actorSubject={view.actorSubject} language={language}>
        <div className={s.stack}>
          {view.feedback.map((item) => (
            <section className={s.card} key={item.id}>
              <h2>{item.rating}/5</h2>
              <p>{item.body}</p>
              <p>{aftercareState(item.state, language)}</p>
              <OperatorDecisionForm
                key={item.id + ":" + item.revision}
                actorKey={view.actorKey}
                actorSubject={view.actorSubject}
                resourceId={item.id}
                revision={item.revision}
                kind="feedback"
                language={language}
              />
            </section>
          ))}
          {view.more && <p>{t.more}</p>}
        </div>
      </PaymentBoundary>
    </main>
  );
}
