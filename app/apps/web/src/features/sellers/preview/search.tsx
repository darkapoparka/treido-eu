"use client";

import Link from "next/link";
import { useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { AdminIcon } from "../admin-icons";
import { usePreview } from "./context";
import {
  previewSearchItems,
  searchPreviewItems,
  searchCategoryLabels,
  type SearchCategory,
} from "./search-model";
import s from "./search.module.css";

export function PreviewSearch({
  onClose,
  onNavigate,
}: {
  onClose: () => void;
  onNavigate: () => void;
}) {
  const { store, href, text, language, ready, largeText } = usePreview();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<SearchCategory | "all">("all");
  const [filters, setFilters] = useState(false);
  const [active, setActive] = useState(0);
  const [limit, setLimit] = useState(20);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const items = ready ? previewSearchItems(store, language) : [];
  const categoryText = (key: SearchCategory) =>
    text(searchCategoryLabels[key][0], searchCategoryLabels[key][1]);
  const allMatches = searchPreviewItems(items, query);
  const matches = searchPreviewItems(items, query, category);
  const visible = matches.slice(0, limit);
  const idle = !query.trim() && category === "all";
  const initialCategories: SearchCategory[] = [
    "apps",
    "customers",
    "orders",
    "products",
    "sales",
  ];
  const categories = query.trim()
    ? (Object.keys(searchCategoryLabels) as SearchCategory[]).filter(
        (key) =>
          key === category || allMatches.some((item) => item.category === key),
      )
    : initialCategories;
  const selected = visible[Math.min(active, Math.max(0, visible.length - 1))];
  const choose = (value: SearchCategory | "all") => {
    setCategory(value);
    setActive(0);
    setLimit(20);
    setFilters(false);
    input.current?.focus();
  };
  const open = () => {
    if (!selected) return;
    onNavigate();
    router.push(href(selected.destination));
  };
  const focusResult = (index: number) => {
    const links = list.current?.querySelectorAll<HTMLAnchorElement>("a");
    if (!links?.length) return;
    const target = Math.max(0, Math.min(index, links.length - 1));
    setActive(target);
    links[target].focus();
  };
  const onResultKey = (
    event: KeyboardEvent<HTMLAnchorElement>,
    index: number,
  ) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusResult(index + 1);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (index === 0) input.current?.focus();
      else focusResult(index - 1);
    }
    if (event.key === "Home") {
      event.preventDefault();
      focusResult(0);
    }
    if (event.key === "End") {
      event.preventDefault();
      focusResult(visible.length - 1);
    }
  };
  return (
    <div
      data-studio-part="search-panel"
      className={`${s.panel} ${largeText ? s.large : ""}`}
      onKeyDownCapture={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          if (query) {
            setQuery("");
            setActive(0);
            setLimit(20);
            input.current?.focus({ preventScroll: true });
          } else onClose();
        }
      }}
    >
      <div data-studio-part="search-header" className={s.header}>
        <AdminIcon name="search" />
        <input
          ref={input}
          className={`${s.input} ${query ? s.hasQuery : ""}`}
          autoFocus
          type="search"
          maxLength={160}
          aria-label={text("Search", "Търси")}
          placeholder={text("Search", "Търси")}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setLimit(20);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && visible.length) {
              event.preventDefault();
              focusResult(0);
            }
            if (event.key === "Enter") {
              event.preventDefault();
              open();
            }
          }}
        />
        {query && (
          <button
            data-studio-part="search-clear"
            className={`${s.iconButton} ${s.clear}`}
            aria-label={text("Clear search text", "Изчисти търсенето")}
            onClick={() => {
              setQuery("");
              setActive(0);
              input.current?.focus();
            }}
          >
            <AdminIcon name="close" />
          </button>
        )}
        <button
          className={`${s.iconButton} ${s.filterButton}`}
          aria-label={text("Filters", "Филтри")}
          aria-expanded={filters}
          onClick={() => setFilters(!filters)}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            aria-hidden="true"
          >
            <path d="M3 5h14M6 10h8M9 15h2" />
          </svg>
        </button>
        <button
          className={`${s.iconButton} ${s.close}`}
          aria-label={text("Close search", "Затвори търсенето")}
          onClick={onClose}
        >
          <AdminIcon name="close" />
        </button>
      </div>
      {filters && (
        <div
          data-studio-part="search-filter"
          className={s.filters}
          role="group"
          aria-label={text("Search filters", "Филтри за търсене")}
        >
          <button
            aria-pressed={category === "all"}
            onClick={() => choose("all")}
          >
            {text("All", "Всички")}
          </button>
          {(Object.keys(searchCategoryLabels) as SearchCategory[]).map(
            (key) => (
              <button
                key={key}
                aria-pressed={category === key}
                onClick={() => choose(key)}
              >
                {categoryText(key)}
              </button>
            ),
          )}
        </div>
      )}
      <div
        data-studio-part="search-categories"
        className={s.categories}
        role="group"
        aria-label={text("Search categories", "Категории за търсене")}
      >
        {category !== "all" && (
          <button className={s.chip} onClick={() => choose("all")}>
            {text("All", "Всички")} <AdminIcon name="back" />
          </button>
        )}
        {categories.map((key) => (
          <button
            key={key}
            className={s.chip}
            aria-pressed={category === key}
            onClick={() => choose(category === key ? "all" : key)}
          >
            {categoryText(key)}
            {query.trim() && (
              <small>
                {allMatches.filter((item) => item.category === key).length}
              </small>
            )}
          </button>
        ))}
      </div>
      <div data-studio-part="search-body" className={s.body}>
        {!ready ? (
          <p className={s.hint} role="status">
            {text("Loading your store…", "Зареждане на магазина…")}
          </p>
        ) : idle ? (
          <p className={s.hint}>
            {text(
              `Find anything in ${store.settings.name}`,
              `Намери нещо в ${store.settings.name}`,
            )}
          </p>
        ) : !matches.length ? (
          <div className={s.empty} role="status">
            <AdminIcon name="search" />
            <strong>
              {text("No results found", "Няма намерени резултати")}
            </strong>
            <p>
              {query
                ? text(
                    `Try another search or category for “${query}”.`,
                    `Опитай друга дума или категория за „${query}“.`,
                  )
                : text(
                    "There are no items in this category yet.",
                    "Все още няма записи в тази категория.",
                  )}
            </p>
            {category === "products" && !store.products.length && (
              <Link href={href("products/new")} onClick={onNavigate}>
                {text("Add product", "Добави продукт")}
              </Link>
            )}
          </div>
        ) : (
          <>
            <ul
              data-studio-part="search-results"
              ref={list}
              className={s.results}
              aria-label={text("Search results", "Резултати от търсенето")}
            >
              {visible.map((item, index) => (
                <li key={item.id}>
                  <Link
                    data-studio-part="search-result"
                    href={href(item.destination)}
                    prefetch={false}
                    className={`${s.result} ${active === index ? s.active : ""}`}
                    onFocus={() => setActive(index)}
                    onClick={onNavigate}
                    onKeyDown={(event) => onResultKey(event, index)}
                  >
                    <span
                      data-studio-part="search-result-icon"
                      className={s.resultIcon}
                    >
                      <AdminIcon name={item.icon} />
                    </span>
                    <span
                      data-studio-part="search-result-copy"
                      className={s.resultCopy}
                    >
                      <strong>
                        <Highlight title={item.title} query={query} />
                      </strong>
                      <small>{item.description}</small>
                    </span>
                    <span
                      data-studio-part="search-result-category"
                      className={s.resultCategory}
                    >
                      {categoryText(item.category)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {matches.length > limit && (
              <button className={s.more} onClick={() => setLimit(limit + 20)}>
                {text("Show more", "Покажи още")} ({matches.length - limit})
              </button>
            )}
          </>
        )}
      </div>
      <div data-studio-part="search-footer" className={s.footer}>
        <span>{text("↑ ↓ to navigate", "↑ ↓ за навигация")}</span>
        <button onClick={open} disabled={!selected}>
          {text("Open", "Отвори")}
          <kbd aria-hidden="true">↵</kbd>
        </button>
      </div>
    </div>
  );
}
function Highlight({ title, query }: { title: string; query: string }) {
  const needle = query.trim();
  const start = title.toLowerCase().indexOf(needle.toLowerCase());
  if (!needle || start < 0) return title;
  return (
    <>
      {title.slice(0, start)}
      <mark>{title.slice(start, start + needle.length)}</mark>
      {title.slice(start + needle.length)}
    </>
  );
}
