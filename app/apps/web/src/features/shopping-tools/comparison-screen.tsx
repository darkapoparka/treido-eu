"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { getCategory, getCategoryLabel } from "@treido/contracts/categories";
import { MiniShell } from "../discovery/mini-frame";
import { Sheet } from "../discovery/components";
import { SourceLink } from "../discovery/return-navigation";
import { LibraryProvider } from "../library/provider";
import {
  ListingSaveButton,
  ListingCollectionButton,
} from "../library/controls";
import { variantCaption } from "../inventory/model";
import { optionLabel } from "../selling/copy";
import { useComparison } from "./comparison-provider";
import {
  ComparisonFeedback,
  AddComparison,
  CurrentItemActions,
  formatAttribute,
  useToolLocale,
} from "./tool-ui";
import { toolCopy, money, type ToolLocale } from "./copy";
import {
  observe,
  comparisonChanges,
  type ComparisonItem,
  type ToolListing,
} from "./model";
import {
  readSavedComparisonCandidatesAction,
  readCurrentToolListingAction,
} from "./actions";
import s from "./tools.module.css";
function ComparisonTable({
  items,
  locale,
}: {
  items: ComparisonItem[];
  locale: ToolLocale;
}) {
  const t = toolCopy[locale],
    fields = new Map<string, { profile: string; id: string; label: string }>();
  for (const item of items) {
    const category = item.current
      ? getCategory(item.current.card.categoryId)
      : null;
    if (category?.kind === "leaf")
      for (const field of category.profile.fields)
        fields.set(category.profile.id + ":" + field.id, {
          profile: category.profile.id,
          id: field.id,
          label:
            field.labels[locale] +
            ("unit" in field && field.unit ? " (" + field.unit + ")" : ""),
        });
  }
  const row = (label: string, read: (item: ComparisonItem) => ReactNode) => (
    <tr key={label}>
      <th scope="row">{label}</th>
      {items.map((item) => (
        <td key={item.id}>{read(item)}</td>
      ))}
    </tr>
  );
  return (
    <div
      className={s.tableScroll}
      tabIndex={0}
      role="region"
      aria-label={t.compare}
    >
      <table className={s.table}>
        <caption className="sr-only">
          {t.compare} · {t.missingFact}
        </caption>
        <thead>
          <tr>
            <th scope="col">{t.facts}</th>
            {items.map((item, index) => (
              <th scope="col" key={item.id}>
                {index + 1}. {item.current?.card.title ?? t.retired}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {row(
            t.savedObservation,
            (item) =>
              money(item.observation.priceMinor, locale) +
              " · #" +
              item.observation.publicationRevision,
          )}
          {row(t.savedAt, (item) => (
            <time dateTime={item.observedAt}>
              {new Date(item.observedAt).toLocaleString(locale, {
                timeZone: "Europe/Sofia",
              })}
            </time>
          ))}
          {row(t.itemPrice, (item) =>
            item.current
              ? money(item.current.card.price.amount, locale)
              : t.unknown,
          )}
          {row(t.publication, (item) =>
            item.current ? String(item.current.revision) : t.unknown,
          )}
          {row(t.checked, (item) =>
            item.current ? (
              <time dateTime={item.current.checkedAt}>
                {new Date(item.current.checkedAt).toLocaleString(locale, {
                  timeZone: "Europe/Sofia",
                })}
              </time>
            ) : (
              t.unknown
            ),
          )}
          {row(t.priceBasis, (item) =>
            item.current ? t[item.current.priceBasis] : t.unknown,
          )}
          {row(t.variant, (item) =>
            item.current?.variant
              ? variantCaption(item.current.variant.options) || t.variant
              : t.noVariant,
          )}
          {row(t.category, (item) =>
            item.current
              ? getCategoryLabel(item.current.card.categoryId, locale)
              : t.unknown,
          )}
          {row(t.condition, (item) =>
            item.current
              ? optionLabel(item.current.card.condition, locale)
              : t.unknown,
          )}
          {row(t.seller, (item) =>
            item.current
              ? item.current.card.seller.name +
                " · " +
                t[item.current.card.seller.kind]
              : t.unknown,
          )}
          {row(t.stock, (item) =>
            item.current
              ? t[
                  item.current.inventory.state === "unknown"
                    ? "unknown"
                    : item.current.inventory.state
                ]
              : t.unknown,
          )}
          {row(t.units, (item) =>
            item.current?.inventory.available === null || !item.current
              ? t.unknown
              : String(item.current.inventory.available),
          )}
          {row(t.defects, (item) => item.current?.defects ?? t.unknown)}
          {row(
            t.handover,
            (item) =>
              item.current?.handover.map((value) => t[value]).join(" · ") ??
              t.unknown,
          )}
          {row(
            t.deliveryDetails,
            (item) => item.current?.deliveryDetails ?? t.unknown,
          )}
          {row(t.shippingCost, () => t.unknown)}
          {row(t.total, () => t.unknown)}
          {[...fields.entries()].map(([key, field]) => (
            <tr key={key}>
              <th scope="row">{field.label}</th>
              {items.map((item) => {
                const cat = item.current
                  ? getCategory(item.current.card.categoryId)
                  : null;
                return (
                  <td key={item.id}>
                    {cat?.kind !== "leaf"
                      ? t.unknown
                      : cat.profile.id !== field.profile
                        ? t.notComparable
                        : formatAttribute(
                            item.current?.attributes[field.id],
                            locale,
                          )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function SavedPicker({ onClose }: { onClose: () => void }) {
  const c = useComparison(),
    locale = useToolLocale(),
    t = toolCopy[locale];
  type Page = Extract<
    Awaited<ReturnType<typeof readSavedComparisonCandidatesAction>>,
    { ok: true }
  >["data"];
  const [page, setPage] = useState<Page | null>(null),
    [selected, setSelected] = useState<ToolListing | null>(null),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false),
    [cursor, setCursor] = useState<string | null>(null);
  const life = useRef({ alive: false, epoch: 0 });
  const load = async (next: string | null) => {
    const ticket = ++life.current.epoch;
    setBusy(true);
    setFailed(false);
    setPage(null);
    setSelected(null);
    setCursor(next);
    try {
      const result = await readSavedComparisonCandidatesAction(next);
      if (!life.current.alive || ticket !== life.current.epoch) return;
      if (result.ok && result.data.subject === c.subject) setPage(result.data);
      else setFailed(true);
    } catch {
      if (life.current.alive) setFailed(true);
    } finally {
      if (life.current.alive) setBusy(false);
    }
  };
  useEffect(() => {
    const current = life.current;
    current.alive = true;
    return () => {
      current.alive = false;
      ++current.epoch;
    };
  }, []);
  async function choose(id: string) {
    const ticket = ++life.current.epoch;
    setSelected(null);
    setBusy(true);
    setFailed(false);
    try {
      const result = await readCurrentToolListingAction(id);
      if (!life.current.alive || ticket !== life.current.epoch) return;
      if (result.ok) setSelected(result.data);
      else setFailed(true);
    } catch {
      if (life.current.alive) setFailed(true);
    } finally {
      if (life.current.alive) setBusy(false);
    }
  }
  return (
    <Sheet open title={t.viewSaved} onClose={onClose}>
      <div className={s.sheet}>
        <p className={s.note}>{t.reviewFirst}</p>
        {!page && !busy && !failed && (
          <button className={s.button} onClick={() => void load(null)}>
            {t.viewSaved}
          </button>
        )}
        {busy && <p role="status">{t.loading}</p>}
        {failed && (
          <div role="alert">
            <p>{t.unavailable}</p>
            <button className={s.button} onClick={() => void load(cursor)}>
              {t.retry}
            </button>
          </div>
        )}
        {page && !page.items.some((item) => item.card) && <p>{t.noSaved}</p>}
        {page?.items
          .filter((item) => item.card)
          .map((item) => (
            <div className={s.savedRow} key={item.id}>
              <span>{item.card?.title}</span>
              <button
                className={s.button}
                disabled={busy}
                onClick={() => void choose(item.id)}
              >
                {t.selectSaved}
              </button>
            </div>
          ))}
        {page?.nextCursor && (
          <button
            className={s.button}
            disabled={busy}
            onClick={() => void load(page.nextCursor)}
          >
            {t.savedNext}
          </button>
        )}
        {selected && (
          <div className={s.feedback}>
            <h2>{selected.card.title}</h2>
            <p>
              {money(selected.card.price.amount, locale)} ·{" "}
              {t[selected.priceBasis]}
            </p>
            <p>
              {
                t[
                  selected.inventory.state === "unknown"
                    ? "unknown"
                    : selected.inventory.state
                ]
              }
            </p>
            <AddComparison item={selected} />
          </div>
        )}
      </div>
    </Sheet>
  );
}
export function ComparisonScreen() {
  const c = useComparison(),
    locale = useToolLocale(),
    t = toolCopy[locale],
    [clearing, setClearing] = useState<{
      revision: number;
      selectionIds: string[];
    } | null>(null),
    [picker, setPicker] = useState(false);
  const items = c.view?.items ?? [],
    blocked = c.busy || c.pending || c.status !== "ready";
  function move(index: number, delta: number) {
    const ids = items.map((item) => item.id),
      other = index + delta;
    if (other < 0 || other >= ids.length) return;
    [ids[index], ids[other]] = [ids[other], ids[index]];
    void c.execute({ kind: "reorder", selectionIds: ids });
  }
  return (
    <LibraryProvider
      query={{
        listingIds: items.map((item) => item.observation.listingId),
        sellerIds: items.flatMap((item) =>
          item.current ? [item.current.card.seller.id] : [],
        ),
      }}
    >
      <MiniShell name={t.compare}>
        <section className={s.content}>
          <h1>{t.compare}</h1>
          <p className={s.note}>{t.compareNote}</p>
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
            <SourceLink
              preserveDiscoveryContext={false}
              href={"/cart?lang=" + locale}
            >
              {t.cart}
            </SourceLink>
          </nav>
          <ComparisonFeedback />
          {c.status === "ready" && (
            <>
              <div className={s.actions}>
                <button
                  className={s.button}
                  disabled={blocked}
                  onClick={() => void c.reload()}
                >
                  {t.refreshFacts}
                </button>
                <button
                  className={s.button}
                  disabled={blocked || items.length >= 4}
                  onClick={() => setPicker(true)}
                >
                  {t.viewSaved}
                </button>
                {items.length > 0 && (
                  <button
                    className={s.button}
                    disabled={blocked}
                    onClick={() =>
                      c.view &&
                      setClearing({
                        revision: c.view.revision,
                        selectionIds: items.map((item) => item.id),
                      })
                    }
                  >
                    {t.clear}
                  </button>
                )}
              </div>
              {!items.length && <p>{t.empty}</p>}
              {items.length < 2 && <p className={s.note}>{t.needTwo}</p>}
              {items.length >= 2 && (
                <ComparisonTable items={items} locale={locale} />
              )}
              {items.map((item, index) => {
                const current = item.current,
                  old = item.observation,
                  changes = comparisonChanges(item),
                  changed = changes.length > 0;
                return (
                  <section className={s.selection} key={item.id}>
                    <h2>
                      {index + 1}. {current?.card.title ?? t.retired}
                    </h2>
                    <p>
                      {t.savedObservation}: {money(old.priceMinor, locale)} ·{" "}
                      {t.publication} {old.publicationRevision} ·{" "}
                      {t[old.stock === "unknown" ? "unknown" : old.stock]}
                    </p>
                    {old.skuId && (
                      <p className={s.note}>
                        {t.savedObservation} · {t.variant}: {old.skuId}
                      </p>
                    )}
                    <p role="status">{changed ? t.changed : t.unchanged}</p>
                    {changed && (
                      <p className={s.note}>
                        {changes.map((change) => t[change]).join(" · ")}
                      </p>
                    )}
                    <div className={s.actions}>
                      <button
                        className={s.button}
                        disabled={blocked || index === 0}
                        onClick={() => move(index, -1)}
                      >
                        {t.moveLeft}
                      </button>
                      <button
                        className={s.button}
                        disabled={blocked || index === items.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        {t.moveRight}
                      </button>
                      <button
                        className={s.button}
                        disabled={blocked}
                        onClick={() =>
                          void c.execute({
                            kind: "remove",
                            selectionId: item.id,
                          })
                        }
                      >
                        {t.remove}
                      </button>
                      {current && (
                        <button
                          className={s.button}
                          disabled={blocked || !changed}
                          onClick={() =>
                            void c.execute({
                              kind: "refresh",
                              selectionId: item.id,
                              observation: observe(current),
                            })
                          }
                        >
                          {t.refreshObservation}
                        </button>
                      )}
                    </div>
                    {current && (
                      <>
                        <nav className={s.nav}>
                          <SourceLink
                            preserveDiscoveryContext={false}
                            href={
                              "/products/" + current.card.id + "?lang=" + locale
                            }
                          >
                            {t.details}
                          </SourceLink>
                          <SourceLink
                            preserveDiscoveryContext={false}
                            href={
                              "/stores/" +
                              current.card.seller.id +
                              "?lang=" +
                              locale
                            }
                          >
                            {current.card.seller.name}
                          </SourceLink>
                          <ListingSaveButton
                            id={current.card.id}
                            title={current.card.title}
                            overlay={false}
                          />
                          <ListingCollectionButton id={current.card.id} />
                        </nav>
                        <CurrentItemActions listingId={current.card.id} />
                      </>
                    )}
                  </section>
                );
              })}
              <p className={s.note}>{t.totalNote}</p>
            </>
          )}
        </section>
        <Sheet
          open={clearing !== null}
          title={t.clear}
          onClose={() => setClearing(null)}
        >
          <div className={s.sheet}>
            <p>{t.confirmClear}</p>
            {clearing && (
              <p>
                {t.reviewedRevision}: {clearing.revision} · {t.selected}:{" "}
                {clearing.selectionIds.length}
              </p>
            )}
            {clearing && c.view && clearing.revision !== c.view.revision && (
              <p role="alert">{t.clearChanged}</p>
            )}
            <div className={s.actions}>
              <button
                className={s.button}
                disabled={
                  blocked || !clearing || clearing.revision !== c.view?.revision
                }
                onClick={() => {
                  if (!clearing) return;
                  const reviewed = clearing;
                  setClearing(null);
                  void c.execute(
                    {
                      kind: "clear",
                      selectionIds: reviewed.selectionIds,
                    },
                    reviewed.revision,
                  );
                }}
              >
                {t.clear}
              </button>
              <button className={s.button} onClick={() => setClearing(null)}>
                {t.cancel}
              </button>
            </div>
          </div>
        </Sheet>
        {picker && c.status === "ready" && (
          <SavedPicker onClose={() => setPicker(false)} />
        )}
      </MiniShell>
    </LibraryProvider>
  );
}
