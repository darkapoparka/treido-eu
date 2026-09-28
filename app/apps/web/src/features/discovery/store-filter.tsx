"use client";
import { useEffect, useRef, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import { Sheet } from "./components";
import { Icon } from "./icons";
import styles from "./store.module.css";
import {
  readStoreFilters,
  STORE_PRICE_CEILING,
  STORE_SORTS,
  type StoreFilters,
} from "./store-model";

type Stage = "all" | "price" | "sort";
const keys = ["min", "max", "sale", "stock", "sort"] as const;
const draftKey = (key: string) => `filter-${key}`;
let returnPosition: {
  path: string;
  scroll: number;
  trigger: HTMLElement | null;
} | null = null;

function clean(params: URLSearchParams) {
  params.delete("filter");
  for (const key of keys) params.delete(draftKey(key));
  return params;
}
function href(params: URLSearchParams) {
  return `${location.pathname}${params.size ? `?${params}` : ""}${location.hash}`;
}
function values(filters: StoreFilters): Record<(typeof keys)[number], string> {
  return {
    min: String(filters.min),
    max: String(filters.max),
    sale: filters.sale ? "1" : "0",
    stock: filters.stock ? "1" : "0",
    sort: filters.sort,
  };
}
function ownedEntry(): { depth: number; path: string } | undefined {
  const value = window.history.state?.shopStoreFilter;
  return value &&
    value.path === location.pathname &&
    Number.isInteger(value.depth) &&
    value.depth >= 1 &&
    value.depth <= 2
    ? value
    : undefined;
}

/** Filter pages own URL history; the shared Sheet must not add more entries.
 * Draft criteria stay separate from committed results until Done is pressed. */
export function openStoreFilter(stage: Stage = "all") {
  const params = new URLSearchParams(location.search);
  const parent = params.get("filter") === "all" ? ownedEntry() : undefined;
  if (!parent) {
    returnPosition = {
      path: location.pathname,
      scroll: window.scrollY,
      trigger:
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null,
    };
    for (const [key, value] of Object.entries(values(readStoreFilters(params))))
      params.set(draftKey(key), value);
  }
  params.set("filter", stage);
  window.history.pushState(
    { shopStoreFilter: { depth: parent ? 2 : 1, path: location.pathname } },
    "",
    href(params),
  );
}

export function StoreFilter() {
  const params = useSearchParams();
  const stage = params.get("filter");
  const open = stage === "all" || stage === "price" || stage === "sort";
  const committing = useRef(false);
  const wasOpen = useRef(false);
  useEffect(() => {
    committing.current = false;
  }, [stage]);
  useEffect(() => {
    const leaving = wasOpen.current && !open;
    wasOpen.current = open;
    if (!leaving) return;
    const frame = requestAnimationFrame(() => {
      if (returnPosition?.path !== location.pathname) return;
      window.scrollTo({ top: returnPosition.scroll, behavior: "instant" });
      if (returnPosition.trigger?.isConnected)
        returnPosition.trigger.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const draftParams = new URLSearchParams(params.toString());
  for (const key of keys) {
    const draft = params.get(draftKey(key));
    if (draft !== null) draftParams.set(key, draft);
  }
  const filters = readStoreFilters(draftParams);
  const { min, max, sale, stock, sort } = filters;
  function update(patch: Partial<StoreFilters>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(values({ ...filters, ...patch })))
      next.set(draftKey(key), value);
    window.history.replaceState(
      { shopStoreFilter: ownedEntry() },
      "",
      href(next),
    );
  }
  function close() {
    if (ownedEntry()) window.history.back();
    else
      window.history.replaceState(
        null,
        "",
        href(clean(new URLSearchParams(params.toString()))),
      );
  }
  function done() {
    if (committing.current) return;
    committing.current = true;
    const next = clean(new URLSearchParams(params.toString()));
    const serialized = values(filters);
    const defaults = values(readStoreFilters(new URLSearchParams()));
    for (const key of keys) {
      if (serialized[key] === defaults[key]) next.delete(key);
      else next.set(key, serialized[key]);
    }
    const destination = href(next);
    const owned = ownedEntry();
    if (!owned) {
      window.history.replaceState(null, "", destination);
      return;
    }
    const commit = () => {
      if (location.pathname === owned.path)
        window.history.replaceState(null, "", destination);
    };
    window.addEventListener("popstate", commit, { once: true });
    window.history.go(-owned.depth);
  }
  return (
    <Sheet
      open={open}
      title={
        stage === "price" ? "Price" : stage === "sort" ? "Sort by" : "Filter"
      }
      className={`${styles.filter} ${stage === "price" ? "store-price-sheet" : "store-filter-sheet"}`}
      manageHistory={false}
      initialFocus={
        stage === "price"
          ? '[aria-label="Maximum price"]'
          : stage === "sort"
            ? '.store-sort-options button[aria-pressed="true"]'
            : ".store-filter-price"
      }
      onClose={close}
    >
      {stage === "price" ? (
        <div className="dual-price">
          <strong aria-live="polite">
            ${min.toLocaleString("en-US")} - ${max.toLocaleString("en-US")}
            {max === STORE_PRICE_CEILING ? "+" : ""}
          </strong>
          <div
            style={
              {
                "--range-start": `${(min / STORE_PRICE_CEILING) * 100}%`,
                "--range-end": `${(max / STORE_PRICE_CEILING) * 100}%`,
              } as CSSProperties
            }
          >
            <span className="store-price-track" aria-hidden="true" />
            <input
              aria-label="Minimum price"
              aria-valuetext={`$${min}`}
              type="range"
              min="0"
              max={STORE_PRICE_CEILING}
              step="10"
              value={min}
              onChange={(event) =>
                update({ min: Math.min(Number(event.target.value), max) })
              }
            />
            <input
              aria-label="Maximum price"
              aria-valuetext={`$${max}${max === STORE_PRICE_CEILING ? " or more" : ""}`}
              type="range"
              min="0"
              max={STORE_PRICE_CEILING}
              step="10"
              value={max}
              onChange={(event) =>
                update({ max: Math.max(Number(event.target.value), min) })
              }
            />
          </div>
        </div>
      ) : stage === "sort" ? (
        <div className="store-filter-options store-sort-options">
          {STORE_SORTS.map((value) => (
            <button
              key={value}
              aria-pressed={sort === value}
              onClick={() => update({ sort: value })}
            >
              {value}
              <span
                className={`radio-outline ${sort === value ? "selected" : ""}`}
              />
            </button>
          ))}
        </div>
      ) : (
        <div className="store-filter-options">
          <button
            aria-label={sale ? `Sort by, currently ${sort}` : undefined}
            onClick={() => openStoreFilter("sort")}
          >
            Sort by
            <span>
              {!sale && sort}
              <Icon name="back" />
            </span>
          </button>
          <button aria-pressed={sale} onClick={() => update({ sale: !sale })}>
            On sale
            <span
              aria-hidden="true"
              className={`store-checkbox ${sale ? "checked" : ""}`}
            >
              {sale && <Icon name="check" />}
            </span>
          </button>
          <button
            aria-pressed={stock}
            onClick={() => update({ stock: !stock })}
          >
            In-stock
            <span
              aria-hidden="true"
              className={`store-checkbox ${stock ? "checked" : ""}`}
            >
              {stock && <Icon name="check" />}
            </span>
          </button>
          <button
            className="store-filter-price"
            onClick={() => openStoreFilter("price")}
          >
            Price
            <span>
              <Icon name="back" />
            </span>
          </button>
        </div>
      )}
      <div className="sheet-actions">
        <button
          className="pill"
          onClick={() =>
            update(
              stage === "price"
                ? { min: 0, max: STORE_PRICE_CEILING }
                : stage === "sort"
                  ? { sort: "Best selling" }
                  : readStoreFilters(new URLSearchParams()),
            )
          }
        >
          {stage === "all" ? "Clear all" : "Reset"}
        </button>
        <button className="primary" onClick={done}>
          Done
        </button>
      </div>
    </Sheet>
  );
}
