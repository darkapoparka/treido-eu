"use client";
import { useEffect, useRef, useState, startTransition } from "react";
import { getCategory } from "@treido/contracts/categories";
import { MiniShell } from "../discovery/mini-frame";
import { Sheet } from "../discovery/components";
import { ProductCard } from "../discovery/product-card";
import { LibraryProvider } from "../library/provider";
import { ListingSaveButton } from "../library/controls";
import type { LibraryItem } from "../library/model";
import type { RawFields } from "../selling/form-model";
import { toCategoryAttributes } from "../selling/form-model";
import type { ToolListing } from "../shopping-tools/model";
import { readSavedComparisonCandidatesAction } from "../shopping-tools/actions";
import { formatAttribute } from "../shopping-tools/tool-ui";
import {
  readAssistantListingAction,
  readCompatibilityAction,
  changeCompatibilityAction,
} from "./actions";
import {
  parseCompatibilityCommand,
  parseRequirements,
  snapshotCompatibility,
  type Requirement,
  type Requirements,
} from "./compatibility-model";
import { useAssistantCommand } from "./use-assistant-command";
import {
  AssistantSession,
  AssistantFeedback,
  AssistantNavigation,
  useAssistantLocale,
} from "./common-ui";
import { RequirementFields } from "./requirement-fields";
import { CompatibilityResults } from "./compatibility-results";
import { assistantCopy } from "./copy";
import s from "./assistant-tools.module.css";
function attributeLabel(
  categoryId: string,
  field: string,
  locale: "bg" | "en",
) {
  const category = getCategory(categoryId);
  return category?.kind === "leaf"
    ? (category.profile.fields.find((definition) => definition.id === field)
        ?.labels[locale] ?? field)
    : field;
}
function rawRequirements(requirements: Requirements | null): RawFields {
  return Object.fromEntries(
    (requirements?.fields ?? []).map((r) => [
      r.field,
      typeof r.value === "boolean"
        ? r.value
          ? "yes"
          : "no"
        : typeof r.value === "number"
          ? String(r.value)
          : typeof r.value === "object" && !Array.isArray(r.value)
            ? Object.fromEntries(
                Object.entries(r.value).map(([key, value]) => [
                  key,
                  String(value),
                ]),
              )
            : r.value,
    ]),
  );
}
export function CompatibilityScreen({
  initialIds = [],
  initialCategory = "",
  continuation = "/minis/compatibility",
}: {
  initialIds?: string[];
  initialCategory?: string;
  continuation?: string;
}) {
  return (
    <AssistantSession kind="compatibility" continuation={continuation}>
      {(subject) => (
        <LibraryProvider key={subject} query={{}}>
          <CompatibilityWorkspace
            subject={subject}
            initialIds={initialIds}
            initialCategory={initialCategory}
          />
        </LibraryProvider>
      )}
    </AssistantSession>
  );
}
function CompatibilityWorkspace({
  subject,
  initialIds,
  initialCategory,
}: {
  subject: string;
  initialIds: string[];
  initialCategory: string;
}) {
  const locale = useAssistantLocale(),
    t = assistantCopy[locale],
    controller = useAssistantCommand(
      subject,
      "compatibility",
      readCompatibilityAction,
      changeCompatibilityAction,
      parseCompatibilityCommand,
    );
  const [categoryId, setCategoryId] = useState(initialCategory),
    [fields, setFields] = useState<RawFields>({}),
    [operators, setOperators] = useState<
      Record<string, Requirement["operator"]>
    >({}),
    [selected, setSelected] = useState<ToolListing[]>([]),
    [preview, setPreview] = useState<ToolListing | null>(null),
    [id, setId] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [localError, setLocalError] = useState<string | null>(null),
    [reading, setReading] = useState(false),
    [savedOpen, setSavedOpen] = useState(false),
    [saved, setSaved] = useState<LibraryItem[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [refresh, setRefresh] = useState<{
      revision: number;
      items: ToolListing[];
    } | null>(null),
    [clear, setClear] = useState<{
      revision: number;
      listingIds: string[];
    } | null>(null);
  const life = useRef({ alive: false, ticket: 0, initialized: false });
  useEffect(() => {
    const current = life.current;
    current.alive = true;
    return () => {
      current.alive = false;
      ++current.ticket;
    };
  }, []);
  useEffect(() => {
    const view = controller.view;
    if (!view || life.current.initialized) return;
    const initialize = async () => {
      await Promise.resolve();
      if (!life.current.alive || life.current.initialized) return;
      life.current.initialized = true;
      const ticket = life.current.ticket;
      if (view.requirements) {
        setCategoryId(view.requirements.categoryId);
        setFields(rawRequirements(view.requirements));
        setOperators(
          Object.fromEntries(
            view.requirements.fields.map((r) => [r.field, r.operator]),
          ),
        );
      }
      const items = view.items.flatMap((item) =>
        item.current ? [item.current] : [],
      );
      for (const listingId of initialIds) {
        if (
          items.some((item) => item.card.id === listingId) ||
          items.length >= 4
        )
          continue;
        try {
          const result = await readAssistantListingAction(listingId);
          if (!life.current.alive) return;
          if (result.ok && result.data.subject === subject)
            items.push(result.data.value);
          else setLocalError(t.NOT_FOUND);
        } catch {
          if (life.current.alive) setLocalError(t.unavailable);
        }
      }
      if (life.current.alive && ticket === life.current.ticket)
        setSelected(items);
    };
    startTransition(() => {
      void initialize();
    });
  }, [controller.view, initialIds, subject, t.NOT_FOUND, t.unavailable]);
  const blocked =
    controller.busy || !!controller.pending || controller.status !== "ready";
  async function lookup(listingId: string, select = false) {
    const ticket = ++life.current.ticket;
    setReading(true);
    setLocalError(null);
    try {
      const result = await readAssistantListingAction(listingId);
      if (!life.current.alive || ticket !== life.current.ticket) return;
      if (result.ok && result.data.subject === subject) {
        if (select)
          setSelected((items) =>
            items.some((item) => item.card.id === result.data.value.card.id)
              ? items.map((item) =>
                  item.card.id === result.data.value.card.id
                    ? result.data.value
                    : item,
                )
              : items.length < 4
                ? [...items, result.data.value]
                : items,
          );
        else setPreview(result.data.value);
      } else setLocalError(result.ok ? t.denied : t[result.code]);
    } catch {
      if (life.current.alive) setLocalError(t.unavailable);
    } finally {
      if (life.current.alive && ticket === life.current.ticket)
        setReading(false);
    }
  }
  async function savedPage(next: string | null) {
    const ticket = ++life.current.ticket;
    setReading(true);
    setLocalError(null);
    try {
      const result = await readSavedComparisonCandidatesAction(next);
      if (!life.current.alive || ticket !== life.current.ticket) return;
      if (result.ok && result.data.subject === subject) {
        setSaved(result.data.items);
        setCursor(result.data.nextCursor);
        setSavedOpen(true);
      } else setLocalError(result.ok ? t.denied : t[result.code]);
    } catch {
      if (life.current.alive) setLocalError(t.unavailable);
    } finally {
      if (life.current.alive && ticket === life.current.ticket)
        setReading(false);
    }
  }
  function check() {
    if (!controller.view || blocked) return;
    try {
      const category = getCategory(categoryId);
      if (category?.kind !== "leaf" || !selected.length || !confirmed)
        throw Error();
      const attributes = toCategoryAttributes(category, fields),
        requirements = parseRequirements({
          categoryId,
          fields: Object.entries(operators).map(([field, operator]) => ({
            field,
            operator,
            value: attributes[field],
          })),
        });
      controller.execute({
        actorKey: controller.view.actorKey,
        expectedRevision: controller.view.revision,
        requestId: crypto.randomUUID(),
        operation: {
          kind: "check",
          requirements,
          snapshots: selected.map(snapshotCompatibility),
        },
      });
      setLocalError(null);
    } catch {
      setLocalError(t.INVALID_INPUT);
    }
  }
  async function reviewRefresh() {
    const view = controller.view;
    if (!view || blocked) return;
    const ticket = ++life.current.ticket;
    setReading(true);
    setLocalError(null);
    try {
      const items: ToolListing[] = [];
      for (const item of view.items) {
        const result = await readAssistantListingAction(item.listingId);
        if (!life.current.alive || ticket !== life.current.ticket) return;
        if (!result.ok || result.data.subject !== subject) throw Error();
        items.push(result.data.value);
      }
      if (life.current.alive) setRefresh({ revision: view.revision, items });
    } catch {
      if (life.current.alive) setLocalError(t.NOT_AVAILABLE);
    } finally {
      if (life.current.alive && ticket === life.current.ticket)
        setReading(false);
    }
  }
  return (
    <MiniShell name={t.compatibility}>
      <main className={s.content}>
        <h1>{t.compatibility}</h1>
        <p className={s.note}>{t.compatibilityIntro}</p>
        <p className={s.note}>{t.compatibilityLimit}</p>
        <AssistantNavigation />
        <AssistantFeedback
          status={controller.status}
          feedback={controller.feedback}
          pending={!!controller.pending}
          busy={controller.busy}
          retry={controller.retry}
          reload={controller.reload}
        />
        {controller.view && controller.status === "ready" && (
          <>
            <RequirementFields
              locale={locale}
              categoryId={categoryId}
              fields={fields}
              operators={operators}
              disabled={blocked}
              onCategory={(value) => {
                setCategoryId(value);
                setFields({});
                setOperators({});
                setConfirmed(false);
              }}
              onField={(field, value) => {
                setFields((values) => ({ ...values, [field]: value }));
                setConfirmed(false);
              }}
              onOperator={(field, operator) => {
                setOperators((values) => {
                  const next = { ...values };
                  if (operator) next[field] = operator;
                  else delete next[field];
                  return next;
                });
                setConfirmed(false);
              }}
            />
            <section className={s.panel}>
              <h2>{t.selectItems}</h2>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  startTransition(() => {
                    void lookup(id);
                  });
                }}
                className={s.actions}
              >
                <label className={s.field} htmlFor="compatibility-listing-id">
                  {t.listingId}
                  <input
                    id="compatibility-listing-id"
                    value={id}
                    maxLength={36}
                    onChange={(event) => setId(event.target.value)}
                    disabled={blocked || reading}
                  />
                </label>
                <button className={s.button} disabled={blocked || reading}>
                  {t.lookup}
                </button>
                <button
                  type="button"
                  className={s.button}
                  disabled={blocked || reading}
                  onClick={() =>
                    startTransition(() => {
                      void savedPage(null);
                    })
                  }
                >
                  {t.viewSaved}
                </button>
              </form>
              {preview && (
                <div className={s.feedback}>
                  <p>{preview.card.title}</p>
                  <button
                    className={s.button}
                    disabled={blocked || selected.length >= 4}
                    onClick={() => {
                      setSelected((items) =>
                        items.some((item) => item.card.id === preview.card.id)
                          ? items
                          : [...items, preview],
                      );
                      setPreview(null);
                      setConfirmed(false);
                    }}
                  >
                    {t.add}
                  </button>
                </div>
              )}
              <div className={s.grid}>
                {selected.map((item) => (
                  <article key={item.card.id}>
                    <ProductCard
                      product={item.card}
                      showRating={false}
                      saveControl={
                        <ListingSaveButton
                          id={item.card.id}
                          title={item.card.title}
                        />
                      }
                    />
                    <p>
                      {t.publication}: {item.revision}
                    </p>
                    <button
                      type="button"
                      className={s.button}
                      disabled={blocked}
                      onClick={() => {
                        setSelected((items) =>
                          items.filter((v) => v.card.id !== item.card.id),
                        );
                        setConfirmed(false);
                      }}
                    >
                      {t.remove}
                    </button>
                  </article>
                ))}
              </div>
              <label className={s.check}>
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={blocked}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                {t.confirmCheck}
              </label>
              <button
                type="button"
                className={s.button + " " + s.primary}
                disabled={
                  blocked ||
                  reading ||
                  !confirmed ||
                  !selected.length ||
                  !Object.keys(operators).length
                }
                onClick={check}
              >
                {t.check}
              </button>
            </section>
            {localError && <p role="alert">{localError}</p>}
            <CompatibilityResults
              view={controller.view}
              locale={locale}
              subject={subject}
            />
            {!!controller.view.items.length && (
              <div className={s.actions}>
                <button
                  type="button"
                  className={s.button}
                  disabled={blocked || reading}
                  onClick={() =>
                    startTransition(() => {
                      void reviewRefresh();
                    })
                  }
                >
                  {t.refresh}
                </button>
                <button
                  type="button"
                  className={s.button}
                  disabled={blocked}
                  onClick={() =>
                    setClear({
                      revision: controller.view?.revision ?? 0,
                      listingIds:
                        controller.view?.items.map((item) => item.listingId) ??
                        [],
                    })
                  }
                >
                  {t.clear}
                </button>
              </div>
            )}
          </>
        )}
        <Sheet
          open={savedOpen && controller.status === "ready"}
          title={t.viewSaved}
          onClose={() => setSavedOpen(false)}
        >
          <div className={s.sheet}>
            {!saved.length && <p>{t.emptySaved}</p>}
            {saved.map((item) => (
              <div className={s.row} key={item.id}>
                <p>{item.card?.title ?? t.retired}</p>
                <button
                  className={s.button}
                  disabled={
                    !item.card || blocked || reading || selected.length >= 4
                  }
                  onClick={() =>
                    startTransition(() => {
                      void lookup(item.id, true);
                      setConfirmed(false);
                    })
                  }
                >
                  {t.add}
                </button>
              </div>
            ))}
            {cursor && (
              <button
                className={s.button}
                disabled={reading}
                onClick={() =>
                  startTransition(() => {
                    void savedPage(cursor);
                  })
                }
              >
                {t.nextSaved}
              </button>
            )}
          </div>
        </Sheet>
        <Sheet
          open={!!refresh && controller.status === "ready"}
          title={t.reviewRefresh}
          onClose={() => setRefresh(null)}
        >
          <div className={s.sheet}>
            <p>{t.compatibilityLimit}</p>
            {refresh?.items.map((item) => (
              <div className={s.row} key={item.card.id}>
                <p>
                  {item.card.title} · {t.publication}: {item.revision}
                </p>
                <dl className={s.factList}>
                  {Object.entries(item.attributes).map(([field, value]) => (
                    <div key={field}>
                      <dt>
                        {attributeLabel(item.card.categoryId, field, locale)}
                      </dt>
                      <dd>{formatAttribute(value, locale)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
            <button
              className={s.button}
              disabled={
                blocked || refresh?.revision !== controller.view?.revision
              }
              onClick={() => {
                if (refresh && controller.view)
                  controller.execute({
                    actorKey: controller.view.actorKey,
                    expectedRevision: refresh.revision,
                    requestId: crypto.randomUUID(),
                    operation: {
                      kind: "refresh",
                      snapshots: refresh.items.map(snapshotCompatibility),
                    },
                  });
                setRefresh(null);
              }}
            >
              {t.confirmRefresh}
            </button>
          </div>
        </Sheet>
        <Sheet
          open={!!clear && controller.status === "ready"}
          title={t.confirmClear}
          onClose={() => setClear(null)}
        >
          <div className={s.sheet}>
            <p>{t.clear}</p>
            <button
              className={s.button}
              disabled={
                blocked || clear?.revision !== controller.view?.revision
              }
              onClick={() => {
                if (clear && controller.view)
                  controller.execute({
                    actorKey: controller.view.actorKey,
                    expectedRevision: clear.revision,
                    requestId: crypto.randomUUID(),
                    operation: { kind: "clear", listingIds: clear.listingIds },
                  });
                setClear(null);
              }}
            >
              {t.clear}
            </button>
          </div>
        </Sheet>
      </main>
    </MiniShell>
  );
}
