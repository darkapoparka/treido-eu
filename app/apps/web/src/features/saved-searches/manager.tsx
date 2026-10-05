"use client";
import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { MiniShell } from "../discovery/mini-frame";
import { SourceLink } from "../discovery/return-navigation";
import { ConversationDialog } from "../messaging/dialog";
import { validId } from "../selling/draft-model";
import { IntentControls } from "../shopping-tools/intent-controls";
import {
  parseToolIntent,
  toolHref,
  type ToolIntent,
} from "../shopping-tools/intent";
import { useSavedSearches } from "./provider";
import { searchCopy } from "./copy";
import {
  reviewedCriteria,
  savedSearchHref,
  SEARCH_LIMITS,
  type SearchSummary,
  type Criteria,
} from "./model";
import {
  CriteriaSummary,
  FrequencyControl,
  SearchFeedback,
  useSearchLocale,
} from "./controls";
import { SearchUpdates } from "./updates";
import s from "../shopping-tools/tools.module.css";
import c from "./searches.module.css";
function SearchCard({ search }: { search: SearchSummary }) {
  const controller = useSavedSearches(),
    locale = useSearchLocale(),
    t = searchCopy[locale];
  const enabled =
    controller.status === "ready" && !controller.busy && !controller.pending;
  const [editing, setEditing] = useState(false),
    [review, setReview] = useState<{
      criteria: Criteria;
      intent: ToolIntent;
    } | null>(null),
    [frequency, setFrequency] = useState<60 | 1440>(search.frequency),
    [removal, setRemoval] = useState<{ expected: number; name: string } | null>(
      null,
    );
  const rename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void controller.execute({
      kind: "rename",
      searchId: search.id,
      name: String(new FormData(event.currentTarget).get("name") ?? ""),
    });
  };
  const initial =
    search.intent ?? parseToolIntent("lang=" + locale, search.criteria.mode);
  return (
    <article id={"search-" + search.id} className={c.card}>
      <h2>{search.name}</h2>
      <p>
        {search.status === "enabled" ? t.enabled : t.paused} · {t.version}:{" "}
        {search.version}
      </p>
      {search.intent ? (
        <details open>
          <summary>{t.criteria}</summary>
          <CriteriaSummary intent={search.intent} />
        </details>
      ) : (
        <pre className={c.criteria}>{search.criteria.query}</pre>
      )}
      {search.needsReview && <p role="alert">{t.needsReview}</p>}
      {search.consentAt && (
        <p className={c.stamp}>
          {t.consentAt}:{" "}
          <time dateTime={search.consentAt}>
            {new Date(search.consentAt).toLocaleString(locale, {
              timeZone: "Europe/Sofia",
            })}
          </time>
        </p>
      )}
      <p className={c.stamp}>
        {search.lastCheckAt ? (
          <>
            {t.lastCheck}:{" "}
            <time dateTime={search.lastCheckAt}>
              {new Date(search.lastCheckAt).toLocaleString(locale, {
                timeZone: "Europe/Sofia",
              })}
            </time>
          </>
        ) : (
          t.noCheck
        )}
      </p>
      {search.run && (
        <p role="status">
          {t[search.run.state]} · {t.checked}: {search.run.checked} ·{" "}
          {t.retained}: {search.run.observed}
        </p>
      )}
      <form onSubmit={rename} className={s.fields}>
        <label className={s.field}>
          {t.name}
          <input
            name="name"
            required
            maxLength={SEARCH_LIMITS.name}
            defaultValue={search.name}
            disabled={!enabled}
          />
        </label>
        <button className={s.button} disabled={!enabled}>
          {t.rename}
        </button>
      </form>
      <div className={s.nav}>
        {search.intent && (
          <SourceLink
            preserveDiscoveryContext={false}
            href={toolHref(search.criteria.mode, {
              ...search.intent,
              discovery: { ...search.intent.discovery, locale },
            })}
          >
            {t.reopen}
          </SourceLink>
        )}
        <button
          className={s.button}
          disabled={!enabled}
          onClick={() => {
            setEditing(true);
            setReview(null);
          }}
        >
          {t.edit}
        </button>
        <button
          className={s.button}
          disabled={!enabled}
          onClick={() => {
            if (controller.view)
              setRemoval({
                expected: controller.view.revision,
                name: search.name,
              });
          }}
        >
          {t.remove}
        </button>
      </div>
      <FrequencyControl
        value={frequency}
        onChange={setFrequency}
        disabled={!enabled}
      />
      <p className={s.note}>{t.consentNote}</p>
      <p className={s.note}>{t.cadenceNote}</p>
      <div className={s.nav}>
        {search.status === "enabled" ? (
          <button
            className={s.button}
            disabled={!enabled}
            onClick={() =>
              void controller.execute({ kind: "pause", searchId: search.id })
            }
          >
            {t.pause}
          </button>
        ) : (
          <button
            className={s.button + " " + s.primary}
            disabled={!enabled || search.needsReview}
            onClick={() =>
              void controller.execute({
                kind: "enable",
                searchId: search.id,
                frequency,
              })
            }
          >
            {t.enable}
          </button>
        )}
        {search.status === "enabled" && frequency !== search.frequency && (
          <button
            className={s.button}
            disabled={!enabled || search.needsReview}
            onClick={() =>
              void controller.execute({
                kind: "enable",
                searchId: search.id,
                frequency,
              })
            }
          >
            {t.updateFrequency}
          </button>
        )}
        <button
          className={s.button}
          disabled={
            !enabled || search.status !== "enabled" || search.needsReview
          }
          onClick={() =>
            void controller.execute({ kind: "check", searchId: search.id })
          }
        >
          {t.check}
        </button>
      </div>
      {editing && (
        <div>
          <IntentControls
            initial={initial}
            mode={search.criteria.mode}
            onReview={(intent) =>
              setReview({
                intent,
                criteria: reviewedCriteria(intent, search.criteria.mode),
              })
            }
          />
          {review && (
            <>
              <p>{t.reviewReady}</p>
              <CriteriaSummary intent={review.intent} />
              <button
                className={s.button + " " + s.primary}
                disabled={!enabled}
                onClick={() =>
                  void controller.execute({
                    kind: "criteria",
                    searchId: search.id,
                    criteria: review.criteria,
                  })
                }
              >
                {t.saveCriteria}
              </button>
            </>
          )}
          <button
            className={s.button}
            onClick={() => {
              setEditing(false);
              setReview(null);
            }}
          >
            {t.clearEdit}
          </button>
        </div>
      )}
      {removal && (
        <ConversationDialog title={t.remove} onClose={() => setRemoval(null)}>
          <p>{removal.name}</p>
          <p>{t.removeNote}</p>
          <div className={s.actions}>
            <button
              className={s.button}
              disabled={controller.busy}
              onClick={() => setRemoval(null)}
            >
              {t.cancel}
            </button>
            <button
              className={s.button}
              disabled={!enabled}
              onClick={() => {
                const expected = removal.expected;
                setRemoval(null);
                void controller.execute(
                  { kind: "remove", searchId: search.id },
                  expected,
                );
              }}
            >
              {t.confirm}
            </button>
          </div>
        </ConversationDialog>
      )}
    </article>
  );
}
export function SavedSearchManager() {
  const controller = useSavedSearches(),
    locale = useSearchLocale(),
    t = searchCopy[locale],
    params = useSearchParams(),
    selection = validId(params.get("search")) ? params.get("search") : null;
  const list = controller.view?.searches ?? [];
  const ordered = selection
    ? [
        ...list.filter((row) => row.id === selection),
        ...list.filter((row) => row.id !== selection),
      ]
    : list;
  return (
    <MiniShell name={t.title}>
      <main className={s.content}>
        <h1>{t.title}</h1>
        <p className={s.note}>{t.intro}</p>
        <p className={s.note}>{t.scopeNote}</p>
        <nav className={s.nav}>
          <SourceLink
            preserveDiscoveryContext={false}
            href={"/minis/find-for-me?lang=" + locale}
          >
            {t.find}
          </SourceLink>
          <SourceLink
            preserveDiscoveryContext={false}
            href={"/minis/deal-finder?lang=" + locale}
          >
            {t.deal}
          </SourceLink>
          <SourceLink href={"/notifications?lang=" + locale}>
            {t.notifications}
          </SourceLink>
        </nav>
        <SearchFeedback
          returnTo={savedSearchHref(locale, selection ?? undefined)}
        />
        {controller.status === "ready" && (
          <>
            {!list.length && (
              <section>
                <h2>{t.empty}</h2>
                <p>{t.emptyNote}</p>
              </section>
            )}
            {selection && !list.some((row) => row.id === selection) && (
              <p role="status">{t.notFound}</p>
            )}
            <div className={s.stack}>
              {ordered.map((search) => (
                <SearchCard
                  key={
                    search.id +
                    ":" +
                    search.version +
                    ":" +
                    search.generation +
                    ":" +
                    search.name
                  }
                  search={search}
                />
              ))}
            </div>
            <SearchUpdates />
          </>
        )}
      </main>
    </MiniShell>
  );
}
