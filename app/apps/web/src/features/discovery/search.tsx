"use client";
import { ShopSurface } from "./hydration-boundary";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import {
  bindSourceDestination,
  rememberSourcePosition,
  rememberSourceReturn,
  SourceLink,
  ContextualCloseLink,
} from "./return-navigation";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
} from "react";
import { formatMoney, type Catalog } from "../catalog/types";
import {
  FloatingNav,
  IconButton,
  SaveButton,
  Sheet,
  commitSheetQuery,
} from "./components";
import { Icon } from "./icons";
import { useDiscovery } from "./state";
import { Filters, type SearchFilters } from "./filters";
import {
  capturedCapQuestion,
  isCapturedCapQuestion,
  emptyFilters,
  hasSearchFilters,
  isCapturedFilteredJeans,
  readSearchFilters,
  searchParameters,
  searchProducts,
  searchStores,
} from "./search-model";
import { SearchLoading } from "./search-loading";
import { jeansProgressAt, type CapturedJeansProgress } from "./search-progress";
import {
  inheritSearchDraftOwners,
  prepareSearchDraftOwner,
  useSearchDraft,
} from "./search-draft";
import { JeansAnswer } from "./assistant";
import { RecentSearchItems } from "./search-recent";
import { CapturedJeansContinuation } from "./search-captured-continuation";
import styles from "./search-entry.module.css";
import photoStyles from "./search-photo.module.css";
import "./search-loading.css";
import "./live-search.css";

const capturedCapPhoto = "/api/reference-media/assistant-uploaded-cap";
const composerSelector = 'form[role="search"][aria-label="Search products"]';
const jeansProgressStorageKey = "shop-jeans-preview-started";
const filteredStoreDeals: Record<string, string> = {
  "arrow-twenty-two": "Save $5",
  "american-blues": "Save $15",
};

export function Search({
  catalog,
  filters: initialFilters,
}: {
  catalog: Catalog;
  query?: string;
  filters: SearchFilters;
}) {
  const router = useRouter();
  const androidLive = Boolean(catalog.liveHomeStoreIds);
  const params = useSearchParams();
  // An absent q after browser navigation means an empty query, not the stale
  // server prop from a previous result page.
  const query = params.get("q") ?? "";
  const editCapturedPhoto = params.get("edit") === "photo";
  const filters: SearchFilters = {
    ...initialFilters,
    ...readSearchFilters(params),
  };
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const state = useDiscovery();
  const { viewAnswer } = state;
  const composer = useSearchDraft(
    "composer",
    editCapturedPhoto ? capturedCapQuestion : query,
    editCapturedPhoto ? capturedCapPhoto : "",
  );
  const draftEntry = JSON.stringify([
    query,
    editCapturedPhoto,
    composer.draft,
    composer.photo,
    composer.editing,
  ]);
  const [activeDraftEntry, setActiveDraftEntry] = useState(draftEntry);
  const [draft, setDraft] = useState(composer.draft);
  const [photo, setPhotoValue] = useState(composer.photo);
  function setPhoto(value: string) {
    if (photo !== value && photo.startsWith("blob:"))
      URL.revokeObjectURL(photo);
    setPhotoValue(value);
  }
  function rememberComposer(
    nextDraft: string,
    nextPhoto: string,
    editing = true,
  ) {
    const save = () =>
      composer.update({ draft: nextDraft, photo: nextPhoto, editing });
    if (window.history.state?.shopSheet) {
      // The chooser/disclosure owns a temporary entry. Commit the pending
      // composer when its Back retires, so later navigation restores the page.
      const href = window.location.href;
      window.addEventListener(
        "popstate",
        () => {
          if (window.location.href === href) save();
        },
        { once: true },
      );
    } else save();
  }
  const [filter, setFilter] = useState(false);
  const [filterUnderlay, setFilterUnderlay] = useState<SearchFilters | null>(
    null,
  );
  const answerTrigger = useRef<HTMLButtonElement>(null);
  const answerOrigin = useRef<string | null>(null);
  const pendingAnswer = useRef<{
    parent: string;
    drafts: ReturnType<typeof prepareSearchDraftOwner>;
    origin: string;
  } | null>(null);
  const closingAnswer = useRef(false);
  const [focused, setFocused] = useState(composer.editing);
  const [photos, setPhotos] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [photoUnavailable, setPhotoUnavailable] = useState(false);
  const photoOrigin = useRef<string | null>(null);
  const jeansProgressQueued = useRef(false);
  const jeansProgressStarted = useRef(0);
  const [jeansProgressRequest, setJeansProgressRequest] = useState(0);
  const [jeansProgress, setJeansProgress] =
    useState<CapturedJeansProgress | null>(null);
  const [pending, startTransition] = useTransition();
  if (activeDraftEntry !== draftEntry) {
    setActiveDraftEntry(draftEntry);
    setFocused(composer.editing);
    setDraft(composer.draft);
    setPhotoValue(composer.photo);
  }
  // Object URLs remain local to this document while their history entry is
  // reachable. Explicit replacement/removal revokes them.
  useEffect(() => {
    if (!photo) return;
    // Focus after the photo chooser has returned its own trigger focus. The
    // same input remains mounted through both composer layouts.
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [photo]);
  useEffect(() => {
    const viewport = window.visualViewport;
    const form = formRef.current;
    if (!viewport || !form) return;
    const sync = () => {
      const inset = focused
        ? Math.max(0, innerHeight - viewport.height - viewport.offsetTop)
        : 0;
      form.style.setProperty("--search-keyboard-inset", `${inset}px`);
      form
        .closest(".android-search")
        ?.toggleAttribute("data-keyboard-visible", inset > 80);
    };
    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
    };
  }, [focused]);

  const suggestions = focused && !!draft.trim() && !photo;
  const photoEditing = !!photo && focused;
  const history = params.get("view") === "recent";
  const visibleFilters = filter && filterUnderlay ? filterUnderlay : filters;
  const filtered = hasSearchFilters(visibleFilters);
  const jeansQuery = query.trim().toLowerCase() === "jeans";
  const capturedFilteredJeans = isCapturedFilteredJeans(query, visibleFilters);
  const answerOpen = params.get("answer") === "jeans";
  useEffect(() => {
    if (!jeansQuery) {
      // A submit may still be moving from the composer to its result route.
      if (pending && jeansProgressQueued.current) return;
      jeansProgressQueued.current = false;
      jeansProgressStarted.current = 0;
      try {
        sessionStorage.removeItem(jeansProgressStorageKey);
      } catch {}
      const reset = window.setTimeout(() => setJeansProgress(null), 0);
      return () => window.clearTimeout(reset);
    }
    jeansProgressQueued.current = false;
    let startedAt = jeansProgressStarted.current;
    if (!startedAt) {
      try {
        startedAt = Number(sessionStorage.getItem(jeansProgressStorageKey));
      } catch {}
      jeansProgressStarted.current = startedAt;
    }
    let timeout: number;
    const advance = () => {
      const now = Date.now();
      const phase = jeansProgressAt(startedAt, now);
      setJeansProgress(phase);
      if (phase) {
        timeout = window.setTimeout(advance, startedAt + phase.until - now);
      } else {
        jeansProgressStarted.current = 0;
        try {
          sessionStorage.removeItem(jeansProgressStorageKey);
        } catch {}
      }
    };
    timeout = window.setTimeout(advance, 0);
    return () => window.clearTimeout(timeout);
  }, [jeansQuery, query, jeansProgressRequest, pending]);
  useEffect(() => {
    return () => {
      // Keep elapsed time across Search reloads, but cancel on route departure.
      if (window.location.pathname !== "/search") {
        try {
          sessionStorage.removeItem(jeansProgressStorageKey);
        } catch {}
      }
    };
  }, []);
  useEffect(() => {
    const entry = pendingAnswer.current;
    if (answerOpen && entry) {
      pendingAnswer.current = null;
      window.history.replaceState(
        {
          ...window.history.state,
          shopJeansAnswerParent: entry.parent,
          shopSourceReturnOrigin: entry.origin,
        },
        "",
        window.location.href,
      );
      inheritSearchDraftOwners(entry.drafts);
    }
    if (!answerOpen && closingAnswer.current) {
      closingAnswer.current = false;
      const frame = requestAnimationFrame(() =>
        answerTrigger.current?.focus({ preventScroll: true }),
      );
      return () => cancelAnimationFrame(frame);
    }
  }, [answerOpen]);
  useEffect(() => {
    if (answerOpen) viewAnswer("jeans");
  }, [answerOpen, viewAnswer]);
  const showResults = !!query.trim() || filtered;
  const resultsMode = (showResults || pending) && !suggestions && !photo;
  const results = searchProducts(
    catalog,
    query,
    visibleFilters,
    state.followed,
  );
  if (jeansQuery && visibleFilters.sort === "Relevance") {
    const rank = (id: string) =>
      id === "carpenter-jeans" ? 0 : id === "heritage-jeans" ? 1 : 2;
    results.sort((a, b) => rank(a.id) - rank(b.id));
  }
  // The frozen default Jeans history contains two leading rows, Related
  // searches, then the separately captured lower continuation. Assistant-only
  // recommendations must not be stitched into that result history. Faceted
  // searches retain the complete local result set.
  const displayedResults =
    jeansQuery && !filtered
      ? results.filter((product) =>
          ["carpenter-jeans", "heritage-jeans"].includes(product.id),
        )
      : results;
  const stores = searchStores(catalog, query, visibleFilters, results);
  function openAnswer() {
    const next = new URLSearchParams(params);
    next.set("answer", "jeans");
    const drafts = prepareSearchDraftOwner("jeans-answer");
    answerOrigin.current = rememberSourcePosition(
      'button[aria-label="View answer for Jeans"]',
    );
    pendingAnswer.current = {
      parent: `${window.location.pathname}${window.location.search}`,
      drafts,
      origin: answerOrigin.current,
    };
    router.push(`/search?${next}`, { scroll: false });
  }
  function closeAnswer() {
    const next = new URLSearchParams(params);
    next.delete("answer");
    const parent = `/search${next.size ? `?${next}` : ""}`;
    closingAnswer.current = true;
    // Only a deliberately pushed answer owns a parent entry. Retain that
    // identity through reload; a direct answer URL still replaces itself.
    if (window.history.state?.shopJeansAnswerParent === parent) router.back();
    else {
      router.replace(parent, {
        scroll: false,
      });
    }
  }

  function update(next: SearchFilters) {
    commitSheetQuery(searchParameters(query, next));
  }
  function closeSuggestions() {
    setFocused(false);
    inputRef.current?.blur();
  }
  function cancelEditing() {
    composer.update({ draft: query, photo, editing: false });
    setDraft(query);
    closeSuggestions();
    requestAnimationFrame(() =>
      formRef.current?.focus({ preventScroll: true }),
    );
  }
  function removePhoto() {
    setPhoto("");
    rememberComposer(draft, "");
    setPhotoError("");
    setPhotoUnavailable(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }
  function submitQuery(value: string) {
    const next = value.trim();
    const previewJeans = next.toLowerCase() === "jeans";
    const startedAt = previewJeans ? Date.now() : 0;
    jeansProgressQueued.current = previewJeans;
    jeansProgressStarted.current = startedAt;
    setJeansProgress(jeansProgressAt(startedAt, Date.now()));
    setJeansProgressRequest((request) => request + 1);
    try {
      if (previewJeans)
        sessionStorage.setItem(jeansProgressStorageKey, String(startedAt));
      else sessionStorage.removeItem(jeansProgressStorageKey);
    } catch {}
    // The old entry returns to its committed query after a deliberate submit.
    // The new results entry gets its own URL seed, never the discarded editor.
    composer.update({ draft: query, photo: "", editing: false });
    setDraft(next);
    setPhoto("");
    closeSuggestions();
    startTransition(() => {
      router.push(`/search${next ? `?q=${encodeURIComponent(next)}` : ""}`);
    });
  }
  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("Choose an image file.");
      return;
    }
    setPhotoError("");
    // A user-selected photograph has not been analyzed. Do not label every
    // upload as the frozen baseball cap or reuse that cap's fixture answer.
    const nextDraft = photo === capturedCapPhoto ? "" : draft;
    if (photo === capturedCapPhoto) setDraft("");
    const nextPhoto = URL.createObjectURL(file);
    setPhoto(nextPhoto);
    rememberComposer(nextDraft, nextPhoto);
    setPhotos(false);
  }
  // Input identity is stable through text/photo entry, suggestions, pending
  // navigation and results. Keyboard focus must not jump to a replacement node.
  const searchForm = (
    <form
      ref={formRef}
      role="search"
      aria-label="Search products"
      tabIndex={-1}
      className={`search-form ${resultsMode ? "top-search" : "search-composer"} ${styles.composer} ${photo ? styles.photoComposer : ""} ${resultsMode ? styles.resultComposer : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (!draft.trim() && !photo) return;
        closeSuggestions();
        if (
          photo &&
          (photo !== capturedCapPhoto ||
            (draft.trim() && !isCapturedCapQuestion(draft)))
        ) {
          composer.update({ draft, photo });
          photoOrigin.current = rememberSourcePosition(composerSelector);
          setPhotoUnavailable(true);
          return;
        }
        if (photo === capturedCapPhoto) {
          composer.update({ draft, photo });
          rememberSourceReturn("/assistant?example=photo", composerSelector);
          startTransition(() => router.push("/assistant?example=photo"));
        } else submitQuery(draft);
      }}
    >
      {resultsMode ? (
        <Icon name="search" />
      ) : (
        <IconButton
          icon={androidLive ? "camera" : "plus"}
          label="Add photos"
          onClick={() => {
            setPhotoError("");
            setPhotos(true);
          }}
        />
      )}
      <input
        key="query"
        ref={inputRef}
        aria-label="Search products"
        placeholder={answerOpen ? "Search" : "Search or ask anything"}
        autoComplete="off"
        enterKeyHint="search"
        value={answerOpen ? "" : draft}
        onFocus={() => setFocused(true)}
        onChange={(e) => {
          setDraft(e.target.value);
          composer.update({ draft: e.target.value, editing: true });
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            cancelEditing();
          }
        }}
      />
      {photo && (
        <div className={styles.photoChip}>
          <img src={photo} alt="Selected photo" />
          <button
            type="button"
            aria-label="Remove selected photo"
            onClick={removePhoto}
          >
            <Icon name="close" />
          </button>
        </div>
      )}
      {draft && !suggestions && !photo && (
        <IconButton
          icon="close"
          label="Clear search"
          onClick={() => submitQuery("")}
        />
      )}
      <button
        className="icon-button"
        aria-label="Submit search"
        type="submit"
        disabled={!draft.trim() && !photo}
      >
        <Icon name="arrow" />
      </button>
    </form>
  );
  return (
    <ShopSurface
      className={`shop-page search-page ${androidLive ? "android-live android-search" : ""} ${styles.page} ${suggestions ? "search-has-suggestions" : ""} ${history ? "search-history" : ""} ${photoEditing ? styles.photoEditing : ""} ${focused ? styles.keyboard : ""} ${resultsMode ? styles.resultsPage : ""}`}
      data-native-search-mode={
        androidLive
          ? history
            ? "history"
            : resultsMode
              ? "results"
              : photoEditing
                ? "photo"
                : suggestions
                  ? "suggestions"
                  : "root"
          : undefined
      }
    >
      {androidLive && !suggestions && !photoEditing && !resultsMode && (
        <ContextualCloseLink
          href="/"
          className="android-search-close"
          aria-label="Close search"
        >
          <Icon name="close" />
        </ContextualCloseLink>
      )}
      {searchForm}
      {photoEditing && (
        <IconButton
          icon="close"
          label="Cancel photo search"
          className={styles.photoClose}
          onClick={() => {
            setPhoto("");
            cancelEditing();
            rememberComposer(query, "", false);
          }}
        />
      )}
      {photoEditing && draft.trim() ? null : suggestions ? (
        <section className="search-suggestions-surface">
          <header>
            <h2>Suggestions</h2>
            <IconButton
              icon="close"
              label="Close suggestions"
              onClick={cancelEditing}
            />
          </header>
          {androidLive &&
            searchStores(catalog, draft, emptyFilters, [])
              .filter((store) => store.referenceStyle === "android")
              .slice(0, 3)
              .map((store) => (
                <SourceLink
                  key={store.id}
                  className="suggestion-store android-suggestion-store"
                  href={`/stores/${store.id}`}
                  onNavigate={() =>
                    composer.update({ draft, photo, editing: true })
                  }
                >
                  {store.logo ? (
                    <img className="suggestion-logo" src={store.logo} alt="" />
                  ) : (
                    <span
                      className="android-suggestion-initial"
                      aria-hidden="true"
                    >
                      {store.name.slice(0, 1)}
                    </span>
                  )}
                  <strong>{store.name}</strong>
                </SourceLink>
              ))}
          {!androidLive && /jean/i.test(draft) && (
            <>
              {[
                ["jeans-warehouse", "Jeans Warehouse", "4.7", ""],
                ["city-jeans", "City Jeans", "4.8", "Save $10"],
              ].map(([id, name, rating, deal]) => (
                <SourceLink
                  key={id}
                  className="suggestion-store"
                  href={`/stores/${id}`}
                  onNavigate={() =>
                    composer.update({ draft, photo, editing: true })
                  }
                >
                  <img
                    className="suggestion-logo"
                    src={`/api/reference-media/suggestion-${id}`}
                    alt=""
                  />
                  <strong>{name}</strong>
                  <span className="suggestion-rating">{rating} ★</span>
                  {deal && <span className="deal-badge">{deal}</span>}
                </SourceLink>
              ))}
            </>
          )}
          {(/jean/i.test(draft)
            ? [
                "jeans",
                "jeans men",
                "jeans baggy",
                "jeans for men",
                "jeans women",
              ]
            : [draft.trim()]
          ).map((q) => (
            <Link
              className="suggestion-query"
              key={q}
              href={`/search?q=${encodeURIComponent(q)}`}
              onClick={(event) => {
                if (
                  event.button === 0 &&
                  !event.metaKey &&
                  !event.ctrlKey &&
                  !event.shiftKey &&
                  !event.altKey
                ) {
                  event.preventDefault();
                  submitQuery(q);
                }
              }}
            >
              <span>
                <Icon name="search" />
              </span>
              {q}
            </Link>
          ))}
        </section>
      ) : pending ? (
        <SearchLoading />
      ) : history ? (
        <>
          <h1>Recently viewed</h1>
          <RecentSearchItems
            catalog={catalog}
            expanded
            capturedContinuation={state.capturedSearchHistory}
          />
        </>
      ) : showResults ? (
        <>
          <div className="filter-chips">
            <IconButton
              icon="filter-circles"
              label="Filter"
              pressed={filtered}
              onClick={() => {
                setFilterUnderlay(filters);
                setFilter(true);
              }}
            />
            <button
              className="pill"
              aria-pressed={!!visibleFilters.origin}
              onClick={() =>
                update({
                  ...filters,
                  origin: filters.origin ? "" : "United States",
                })
              }
            >
              Sells from
              <svg
                className={styles.countryFlag}
                role="img"
                aria-label="United States"
                viewBox="0 0 19 12"
              >
                <path fill="#fff" d="M0 0h19v12H0z" />
                <path
                  stroke="#bc4558"
                  strokeWidth="1.1"
                  d="M0 .6h19M0 2.5h19M0 4.3h19M0 6.2h19M0 8h19M0 9.8h19M0 11.6h19"
                />
                <path fill="#52688b" d="M0 0h8v6.6H0z" />
                <path
                  stroke="#fff"
                  strokeWidth=".5"
                  strokeDasharray=".5 1.2"
                  d="M1 1h6M1 2.5h6M1 4h6M1 5.5h6"
                />
              </svg>
            </button>
            <button
              className="pill"
              aria-pressed={visibleFilters.deals}
              onClick={() => update({ ...filters, deals: !filters.deals })}
            >
              Your deals
            </button>
            <button
              className="pill"
              aria-pressed={visibleFilters.following}
              onClick={() =>
                update({ ...filters, following: !filters.following })
              }
            >
              Following
            </button>
          </div>
          {stores.length > 0 && (
            <div className="search-stores">
              {stores.map((store) => {
                const image = capturedFilteredJeans
                  ? store.coverImage || store.logo
                  : store.id === "fitjeans"
                    ? "/api/reference-media/fitjeans"
                    : store.logo;
                const deal = filteredStoreDeals[store.id];
                return (
                  <SourceLink
                    key={store.id}
                    href={`/stores/${store.id}`}
                    className={`search-store ${image ? "" : "plain"} ${capturedFilteredJeans ? styles.capturedFilterStore : ""}`}
                  >
                    {image ? (
                      <img src={image} alt="" />
                    ) : (
                      <span className="store-monogram">
                        {store.id === "miss-me"
                          ? "MM"
                          : store.name
                              .split(/\s+/)
                              .slice(0, 2)
                              .map((word) => word[0])
                              .join("")}
                      </span>
                    )}
                    {(deal || store.id === "fitjeans") && (
                      <span className={styles.storeDeal}>
                        {deal ?? "Save $30"}
                      </span>
                    )}
                    <strong>{store.name}</strong>
                    {store.rating !== undefined && (
                      <span>
                        {store.rating} ★
                        {store.ratingCount ? ` (${store.ratingCount})` : ""}
                      </span>
                    )}
                  </SourceLink>
                );
              })}
              {capturedFilteredJeans && (
                <span
                  className={styles.capturedStoreContinuation}
                  aria-hidden="true"
                >
                  <img
                    src="/api/reference-media/search-filter-store-continuation"
                    alt=""
                  />
                </span>
              )}
            </div>
          )}
          <div className="search-results">
            {displayedResults.map((p) => (
              <article
                className={`result-row ${
                  capturedFilteredJeans ? styles.capturedFilterResult : ""
                } ${
                  capturedFilteredJeans && p.id === "valentino-blue-denim"
                    ? styles.capturedTallResult
                    : ""
                }`}
                key={p.id}
                data-result-id={p.id}
              >
                <div className="product-media">
                  <SourceLink href={`/products/${p.id}`}>
                    <img src={p.images[0]} alt={p.title} />
                  </SourceLink>
                  <SaveButton product={p} />
                </div>
                <div>
                  <SourceLink href={`/products/${p.id}`}>
                    <strong>{p.title}</strong>
                  </SourceLink>
                  {p.ratingCount && (
                    <p className="rating">
                      <span>★★★★★</span> ({p.ratingCount})
                    </p>
                  )}
                  <p>
                    {formatMoney(p.price)}{" "}
                    {p.compareAt && <del>{formatMoney(p.compareAt)}</del>}
                  </p>
                  <div className={styles.resultMerchant}>
                    <SourceLink
                      className="result-store"
                      href={`/stores/${p.storeId}`}
                    >
                      {catalog.stores.find((s) => s.id === p.storeId)?.logo && (
                        <img
                          src={
                            catalog.stores.find((s) => s.id === p.storeId)!.logo
                          }
                          alt=""
                        />
                      )}
                      {catalog.stores.find((s) => s.id === p.storeId)?.name}
                    </SourceLink>
                    {p.storeId === "fashion-nova" && (
                      <span>
                        4.3 ★ <span className={styles.muted}>(428.8K)</span>
                      </span>
                    )}
                    {p.promotion && (
                      <span className={styles.resultDeal}>{p.promotion}</span>
                    )}
                  </div>
                </div>
                {capturedFilteredJeans && p.id === "valentino-blue-denim" && (
                  <Link
                    className={styles.capturedRelatedProducts}
                    href="/search?q=Valentino%20Blue%20Denim"
                  >
                    See related products
                  </Link>
                )}
              </article>
            ))}
            {!displayedResults.length && (
              <div className="empty-state" role="status">
                <h2>No results found</h2>
                <p>Try another search or clear your filters.</p>
                <button
                  className="pill"
                  onClick={() => update({ ...emptyFilters })}
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
          {jeansQuery && (
            <>
              <section className={styles.relatedSearches}>
                <h2>Related searches</h2>
                <div>
                  {[
                    "light wash jeans",
                    "jeans with pockets",
                    "girl’s ripped jeans",
                    "plus size jeans",
                    "bootcut jeans",
                    "women’s skinny jeans",
                  ].map((suggestion) => (
                    <Link
                      key={suggestion}
                      href={`/search?q=${encodeURIComponent(suggestion)}`}
                    >
                      <Icon name="search" />
                      {suggestion}
                    </Link>
                  ))}
                </div>
              </section>
              {!filtered && <CapturedJeansContinuation />}
              {jeansProgress ? (
                <div
                  className={styles.comparingProducts}
                  role="status"
                  aria-live="polite"
                  data-search-progress={jeansProgress.id}
                  aria-label="Recorded Jeans answer preview"
                >
                  <span className={styles.progressSpinner} aria-hidden="true" />
                  <span>{jeansProgress.label}</span>
                </div>
              ) : (
                <button
                  ref={answerTrigger}
                  type="button"
                  className={styles.answerTeaser}
                  onClick={openAnswer}
                  aria-label="View answer for Jeans"
                >
                  <span className={styles.answerThumbnails}>
                    <img
                      src="/api/reference-media/assistant-black-square"
                      alt=""
                    />
                    <img
                      src="/api/reference-media/assistant-white-square"
                      alt=""
                    />
                  </span>
                  <span>
                    From everyday straight legs to bold, vintage-inspired...{" "}
                    <span className={styles.answerMore}>View more ›</span>
                  </span>
                </button>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <h1>Search</h1>
          <SourceLink
            className="search-section-heading"
            href="/search?view=recent"
          >
            <h2>
              Recently viewed <Icon name="back" />
            </h2>
          </SourceLink>
          <RecentSearchItems
            catalog={catalog}
            capturedContinuation={state.capturedSearchHistory}
          />
          {state.viewedAnswers.includes("jeans") && (
            <section className={`keep-shopping ${styles.conversations}`}>
              <SourceLink
                startAtTop
                className={styles.conversationHeading}
                href="/assistant"
              >
                <h2>
                  Keep shopping <Icon name="back" />
                </h2>
              </SourceLink>
              <SourceLink
                startAtTop
                className={styles.conversation}
                href="/assistant"
                aria-label="Continue Finding the right pair of jeans"
              >
                <img
                  src="/api/reference-media/recent-jeans-conversation"
                  alt=""
                />
                <span>
                  Finding the right pair of jeans
                  <small>
                    {state.newlyViewedAnswers.includes("jeans")
                      ? "Just now"
                      : "Jul 24"}
                  </small>
                </span>
              </SourceLink>
            </section>
          )}
        </>
      )}
      <Sheet
        open={photos}
        title="Add photos"
        className={`${styles.photoSheet} ${photoStyles.photoSheet}`}
        onClose={() => setPhotos(false)}
      >
        <label className="account-row">
          <Icon name="photo-library" />
          Choose from library
          <input type="file" accept="image/*" onChange={selectPhoto} />
        </label>
        <label className="account-row">
          <Icon name="camera" />
          Take a photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={selectPhoto}
          />
        </label>
        <button
          className="account-row"
          onClick={() => {
            setPhotoError("");
            setPhoto(capturedCapPhoto);
            setDraft("");
            rememberComposer("", capturedCapPhoto);
            setPhotos(false);
          }}
        >
          Use captured cap example
        </button>
        {photoError && <p role="alert">{photoError}</p>}
        <p className="form-note">
          Photos stay on this device. The captured answer can be viewed without
          sending a photo.
        </p>
      </Sheet>
      <Sheet
        open={photoUnavailable}
        title="Photo search unavailable"
        onClose={() => setPhotoUnavailable(false)}
      >
        <p className="sheet-copy">
          Photo search is not connected. Your photo stays on this device and has
          not been analyzed. The captured cap example is a separate reference
          answer, not a result for another photo or a different question.
        </p>
        <div className="sheet-actions">
          <button className="pill" onClick={removePhoto}>
            Remove photo
          </button>
          <Link
            className="primary"
            href="/assistant?example=photo"
            onClick={(event) => {
              if (event.defaultPrevented && photoOrigin.current)
                bindSourceDestination(
                  photoOrigin.current,
                  "/assistant?example=photo",
                );
            }}
          >
            View captured example
          </Link>
        </div>
      </Sheet>
      {((androidLive && !photoEditing) ||
        (!suggestions && !photoEditing && !focused)) && (
        <FloatingNav back={showResults || history || pending} />
      )}
      <Sheet
        open={answerOpen}
        title="Jeans answer"
        headerless
        dragHandle
        className={styles.answerSheet}
        onClose={closeAnswer}
        manageHistory={false}
        initialFocus="[data-answer-heading]"
      >
        <JeansAnswer
          catalog={catalog}
          onClose={closeAnswer}
          onConsumedNavigate={(href) => {
            const token =
              answerOrigin.current ??
              window.history.state?.shopSourceReturnOrigin;
            if (token) bindSourceDestination(token, href);
          }}
        />
      </Sheet>
      <Filters
        open={filter}
        onClose={() => setFilter(false)}
        onReopen={() => setFilter(true)}
        value={filters}
        onChange={update}
      />
    </ShopSurface>
  );
}
