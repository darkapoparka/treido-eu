import "server-only";
import Link from "next/link";
import { connection } from "next/server";
import { pageLocale } from "../locale/page-locale.server";
import { backendConfigured } from "../sellers/backend-status.server";
import {
  requirePageIdentity,
  readPrivatePage,
} from "../sellers/page-context.server";
import { Workspace } from "../sellers/workspace";
import { getDatabase } from "../../server/db/database";
import { libraryActorKey } from "../library/cursor.server";
import { OperationsNav } from "../trust/operations-ui.server";
import w from "../sellers/workspace.module.css";
import s from "../trust/operations.module.css";
import { declarationMessages } from "./copy";
import {
  readDeclarationQueue,
  readDeclarationReview,
} from "./persistence.server";
import { DeclarationReviewForm } from "./review-form";
type Query = { lang?: string; state?: string; q?: string; before?: string };
export async function DeclarationQueuePage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  await connection();
  const raw = await searchParams,
    language = await pageLocale(raw.lang),
    text = declarationMessages[language];
  if (!backendConfigured())
    return (
      <Workspace title={text.title} language={language}>
        <p role="status">{text.failed}</p>
      </Workspace>
    );
  const identity = await requirePageIdentity(
    `/ops/declarations?lang=${language}`,
  );
  const data = await readPrivatePage(() =>
    readDeclarationQueue(getDatabase(), identity, {
      state: raw.state,
      q: raw.q,
      before: raw.before,
    }),
  );
  const params = new URLSearchParams({
    lang: language,
    state: data.query.state,
    q: data.query.q,
  });
  return (
    <Workspace
      title={text.title}
      language={language}
      back={`/ops?lang=${language}`}
    >
      <div className={s.stack}>
        <OperationsNav language={language} active="declarations" />
        <p>{text.note}</p>
        <form className={s.toolbar} action="/ops/declarations">
          <input type="hidden" name="lang" value={language} />
          <label>
            {text.search}
            <input
              type="search"
              name="q"
              maxLength={80}
              defaultValue={data.query.q}
            />
          </label>
          <label>
            {text.state}
            <select name="state" defaultValue={data.query.state}>
              {(
                ["review_required", "accepted", "rejected", "all"] as const
              ).map((state) => (
                <option key={state} value={state}>
                  {state === "all" ? text.all : text[state]}
                </option>
              ))}
            </select>
          </label>
          <button className={w.button}>{text.filter}</button>
        </form>
        {data.items.length ? (
          <ul className={s.list}>
            {data.items.map((item) => (
              <li className={s.card} key={item.id}>
                <div className={s.row}>
                  <div>
                    <strong>{item.sellerName}</strong>
                    <p>
                      {text[item.status]} · {text.revision} {item.revision}
                    </p>
                  </div>
                  <Link
                    className={w.button}
                    href={`/ops/declarations/${item.id}?lang=${language}`}
                  >
                    {text.open}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p role="status">{text.empty}</p>
        )}
        <div className={s.actions}>
          {data.query.before && (
            <Link className={w.link} href={`/ops/declarations?${params}`}>
              {text.first}
            </Link>
          )}
          {data.nextCursor && (
            <Link
              className={w.button}
              href={`/ops/declarations?${new URLSearchParams({ ...Object.fromEntries(params), before: data.nextCursor })}`}
            >
              {text.next}
            </Link>
          )}
        </div>
      </div>
    </Workspace>
  );
}
export async function DeclarationReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ declarationId: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  await connection();
  const language = await pageLocale((await searchParams).lang),
    text = declarationMessages[language],
    { declarationId } = await params;
  if (!backendConfigured())
    return (
      <Workspace title={text.detail} language={language}>
        <p role="status">{text.failed}</p>
      </Workspace>
    );
  const identity = await requirePageIdentity(
    `/ops/declarations/${declarationId}?lang=${language}`,
  );
  const initial = await readPrivatePage(() =>
    readDeclarationReview(getDatabase(), identity, declarationId),
  );
  return (
    <Workspace
      title={text.detail}
      language={language}
      back={`/ops/declarations?lang=${language}`}
    >
      <DeclarationReviewForm
        key={identity.subject + "/" + initial.id}
        initial={initial}
        language={language}
        actorSubject={identity.subject}
        actorKey={libraryActorKey(identity)}
      />
    </Workspace>
  );
}
