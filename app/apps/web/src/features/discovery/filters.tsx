"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Sheet, commitSheetQuery } from "./components";
import { useSheetStages } from "./sheet-stages";
import { Icon } from "./icons";
import styles from "./search-entry.module.css";
import {
  categoryValue,
  emptyFilters,
  filterOptions,
  womenCategories,
  readSearchFilters,
  searchParameters,
  type FilterSection,
  type SearchFilters,
} from "./search-model";

export { emptyFilters } from "./search-model";
export type { SearchFilters } from "./search-model";

const names: Record<FilterSection, string> = {
  sort: "Sort by",
  category: "Category",
  color: "Color",
  size: "Size",
  gender: "Gender",
  price: "Price",
  ratings: "Ratings",
  country: "Ships to",
};

// The capture exposes these disclosures, but not their child category lists.
const unavailableCategoryChildren = new Set([
  "Shirts & tops",
  "Shoes",
  "Intimates",
  "Activewear",
]);

type FilterProps = {
  open: boolean;
  onClose: () => void;
  onReopen: () => void;
  value: SearchFilters;
  onChange: (value: SearchFilters) => void;
};

type FilterStage = "root" | FilterSection | "women" | `unavailable:${string}`;
type FilterDraft = {
  path: string;
  query: string;
  value: SearchFilters;
  dirty: boolean;
  opener: HTMLElement | null;
};

export function Filters({
  open,
  onClose,
  onReopen,
  value: initialValue,
  onChange: commit,
}: FilterProps) {
  // Keep native controlled inputs in this sheet synchronous with their event.
  // The URL remains the committed result state, but its external-store update
  // can arrive after the browser checks whether a checkbox changed.
  const [value, setValue] = useState(initialValue);
  const drafts = useRef(new Map<string, FilterDraft>());
  const activeSession = useRef("");
  const pendingFocus = useRef<{ session: string; draft: FilterDraft } | null>(
    null,
  );
  const currentQuery = () =>
    new URLSearchParams(location.search).get("q") ?? "";
  const restoreDraft = (draft: FilterDraft) => {
    if (draft.dirty)
      commitSheetQuery(
        searchParameters(
          new URLSearchParams(location.search).get("q") ?? "",
          draft.value,
        ),
      );
  };
  const flow = useSheetStages<FilterStage>({
    open,
    initial: "root",
    onStart: () => {
      const session = crypto.randomUUID();
      activeSession.current = session;
      drafts.current.set(session, {
        path: location.pathname,
        query: currentQuery(),
        value: initialValue,
        dirty: false,
        opener:
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null,
      });
      window.history.replaceState(
        { ...window.history.state, shopFilterSession: session },
        "",
        location.href,
      );
      setValue(initialValue);
    },
    onClose: () => {
      // A criterion belongs to the result page, not a temporary stage entry.
      // Never carry it into an unrelated search when the closed flow is left.
      const draft = drafts.current.get(activeSession.current);
      pendingFocus.current = null;
      if (
        open &&
        draft &&
        window.history.state?.shopFilterSession === activeSession.current &&
        location.pathname === draft.path &&
        currentQuery() === draft.query
      ) {
        restoreDraft(draft);
        pendingFocus.current = { session: activeSession.current, draft };
      }
      onClose();
    },
    onReopen: () => {
      const session = window.history.state?.shopFilterSession;
      const previous = drafts.current.get(session);
      const draft =
        previous?.path === location.pathname &&
        previous.query === currentQuery()
          ? previous
          : {
              path: location.pathname,
              query: currentQuery(),
              value: readSearchFilters(new URLSearchParams(location.search)),
              dirty: false,
              opener: document.querySelector<HTMLElement>(
                'button[aria-label="Filter"]',
              ),
            };
      activeSession.current = session;
      drafts.current.set(session, draft);
      setValue(draft.value);
      restoreDraft(draft);
      onReopen();
    },
  });
  useEffect(() => {
    if (open) return;
    const pending = pendingFocus.current;
    pendingFocus.current = null;
    if (
      !pending ||
      window.history.state?.shopFilterSession !== pending.session ||
      location.pathname !== pending.draft.path ||
      currentQuery() !== pending.draft.query ||
      document.querySelector("dialog[open]")
    )
      return;
    // Forward may reopen from body. Keep the original logical opener after
    // the child Sheets finish their own cleanup, without focusing another query.
    const opener = pending.draft.opener?.isConnected
      ? pending.draft.opener
      : document.querySelector<HTMLElement>('button[aria-label="Filter"]');
    opener?.focus({ preventScroll: true });
  }, [open]);
  const onChange = useCallback(
    (next: SearchFilters) => {
      const draft = drafts.current.get(activeSession.current);
      if (draft)
        drafts.current.set(activeSession.current, {
          ...draft,
          value: next,
          dirty: true,
        });
      setValue(next);
      commit(next);
    },
    [commit],
  );
  const categoryPath =
    flow.stage === "women" || flow.stage.startsWith("unavailable:");
  const unavailableCategory = flow.stage.startsWith("unavailable:")
    ? flow.stage.slice(12)
    : "";
  const section: FilterSection | null = categoryPath
    ? "category"
    : flow.stage === "root"
      ? null
      : (flow.stage as FilterSection);
  const closeSection = () => flow.back();
  const rows = (key: FilterSection, list: readonly string[]) =>
    list.map((option) => {
      const opensWomen = key === "category" && option === "Women";
      const unavailableChildren =
        key === "category" && unavailableCategoryChildren.has(option);
      const opensChildren = opensWomen || unavailableChildren;
      const selected =
        value[key] === (key === "category" ? categoryValue(option) : option) ||
        (key === "category" && option === "All Women" && !value.category);
      return (
        <button
          type="button"
          key={option}
          aria-pressed={opensChildren ? undefined : selected}
          data-filter-selected={
            selected ||
            (opensWomen &&
              womenCategories.some(
                (category) => categoryValue(category) === value.category,
              )) ||
            undefined
          }
          aria-haspopup={opensChildren ? "dialog" : undefined}
          aria-expanded={
            opensWomen
              ? categoryPath
              : unavailableChildren
                ? unavailableCategory === option
                : undefined
          }
          onClick={() => {
            if (opensWomen) flow.navigate("women");
            else if (unavailableChildren)
              flow.navigate(`unavailable:${option}`);
            else
              onChange({
                ...value,
                [key]: key === "category" ? categoryValue(option) : option,
              });
          }}
        >
          {option}
          {opensChildren ? (
            <Icon name="chevron" />
          ) : (
            <span
              aria-hidden="true"
              className={`radio-outline ${selected ? "selected" : ""}`}
            />
          )}
        </button>
      );
    });
  return (
    <>
      <Sheet
        open={open && flow.active}
        title="Filter"
        className={`${styles.filterSheet} filter-tall ${section ? "filter-covered" : ""}`}
        onClose={() => flow.close()}
        manageHistory={false}
      >
        <div className="filter-options">
          <label>
            Your deals
            <input
              type="checkbox"
              checked={value.deals}
              onChange={(e) => onChange({ ...value, deals: e.target.checked })}
            />
          </label>
          {(Object.keys(filterOptions) as FilterSection[]).map((key) => (
            <button
              type="button"
              key={key}
              aria-haspopup="dialog"
              onClick={() => {
                flow.navigate(key);
              }}
            >
              {names[key]}
              <span className="filter-value">
                {value[key]}
                <Icon name="back" />
              </span>
            </button>
          ))}
        </div>
        <div className="sheet-actions">
          <button
            type="button"
            className="pill"
            onClick={() => onChange({ ...emptyFilters })}
          >
            Clear all
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => flow.close()}
          >
            Done
          </button>
        </div>
      </Sheet>
      <Sheet
        open={open && flow.active && section !== null}
        title={section ? names[section] : "Filter"}
        className={`${styles.filterSheet} ${section === "sort" ? "filter-short" : "filter-tall"} ${section === "category" && categoryPath ? "filter-covered" : ""}`}
        onClose={closeSection}
        manageHistory={false}
        initialFocus='.filter-options [data-filter-selected="true"]'
      >
        <div className="filter-options">
          {section && rows(section, filterOptions[section])}
        </div>
        <div className="sheet-actions">
          <button
            type="button"
            className="pill"
            disabled={!section || value[section] === emptyFilters[section]}
            onClick={() =>
              section &&
              onChange({ ...value, [section]: emptyFilters[section] })
            }
          >
            Reset
          </button>
          <button type="button" className="primary" onClick={closeSection}>
            Done
          </button>
        </div>
      </Sheet>
      <Sheet
        open={open && flow.active && section === "category" && categoryPath}
        title="Women"
        className={`${styles.filterSheet} filter-tall ${unavailableCategory ? "filter-covered" : ""}`}
        onClose={() => flow.back()}
        manageHistory={false}
        initialFocus='.filter-options [data-filter-selected="true"]'
      >
        <div className="filter-options">
          {rows("category", womenCategories)}
        </div>
        <div className="sheet-actions">
          <button
            type="button"
            className="pill"
            disabled={!value.category}
            onClick={() => onChange({ ...value, category: "" })}
          >
            Reset
          </button>
          <button type="button" className="primary" onClick={() => flow.back()}>
            Done
          </button>
        </div>
      </Sheet>
      <Sheet
        open={open && flow.active && !!unavailableCategory}
        title={unavailableCategory}
        onClose={() => flow.back()}
        manageHistory={false}
      >
        <p className="sheet-copy">
          These subcategories are not included in the captured reference. Your
          current filters are unchanged.
        </p>
      </Sheet>
    </>
  );
}
