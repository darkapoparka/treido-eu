"use client";
import { useRef, useState } from "react";
import {
  categoryRoots,
  getCategory,
  getChildren,
  searchDraftCategories,
  type CategoryLeaf,
  type CategoryRootId,
} from "@treido/contracts/categories";
import { sellingCopy, type SellingLocale } from "./copy";
import styles from "./selling.module.css";

export function CategoryPicker({
  locale,
  initialRoot,
  onSelect,
}: {
  locale: SellingLocale;
  initialRoot?: CategoryRootId;
  onSelect: (category: CategoryLeaf) => void;
}) {
  const [query, setQuery] = useState("");
  const [rootId, setRootId] = useState<CategoryRootId | null>(
    initialRoot ?? null,
  );
  const copy = sellingCopy[locale];
  const rootHeading = useRef<HTMLHeadingElement>(null);
  const rootButtons = useRef<
    Partial<Record<CategoryRootId, HTMLButtonElement>>
  >({});
  function openRoot(id: CategoryRootId) {
    setRootId(id);
    window.requestAnimationFrame(() => rootHeading.current?.focus());
  }
  function showAllCategories() {
    const previous = rootId;
    setRootId(null);
    window.requestAnimationFrame(() => {
      if (previous) rootButtons.current[previous]?.focus();
    });
  }
  const root = rootId ? getCategory(rootId) : null;
  const searching = query.trim() !== "";
  const leaves = searching
    ? searchDraftCategories(query, 48)
    : rootId
      ? getChildren(rootId)
      : null;
  return (
    <section aria-label={copy.category}>
      <p className={styles.intro}>{copy.intro}</p>
      <label className={`form-field ${styles.search}`}>
        {copy.search}
        <input
          type="search"
          value={query}
          maxLength={200}
          placeholder={copy.searchHint}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {!searching && root && (
        <div className={styles.categoryHeading}>
          <button
            type="button"
            className={styles.textButton}
            onClick={showAllCategories}
          >
            ← {copy.allCategories}
          </button>
          <h2 ref={rootHeading} tabIndex={-1}>
            {root.labels[locale]}
          </h2>
        </div>
      )}
      <div className={`account-panel ${styles.categoryList}`}>
        {leaves ? (
          leaves.length ? (
            leaves.map((leaf) => (
              <button
                type="button"
                key={leaf.id}
                className="account-row"
                onClick={() => onSelect(leaf)}
              >
                <span>
                  <strong>{leaf.labels[locale]}</strong>
                  {searching && (
                    <small>{getCategory(leaf.parentId)?.labels[locale]}</small>
                  )}
                </span>
                <span aria-hidden="true">›</span>
              </button>
            ))
          ) : (
            <p className={styles.intro} role="status">
              {copy.noResults}
            </p>
          )
        ) : (
          categoryRoots.map((category) => (
            <button
              type="button"
              key={category.id}
              ref={(button) => {
                if (button) rootButtons.current[category.id] = button;
                else delete rootButtons.current[category.id];
              }}
              className="account-row"
              onClick={() => openRoot(category.id)}
            >
              <span>
                <strong>{category.labels[locale]}</strong>
                <small>
                  {copy.subcategories}: {getChildren(category.id).length}
                </small>
              </span>
              <span aria-hidden="true">›</span>
            </button>
          ))
        )}
      </div>
      {searching && leaves?.length === 48 && (
        <p className="form-note">{copy.searchLimit}</p>
      )}
    </section>
  );
}
