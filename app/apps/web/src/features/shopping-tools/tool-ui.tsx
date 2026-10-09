"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getCategoryLabel, getCategory } from "@treido/contracts/categories";
import { MiniShell } from "../discovery/mini-frame";
import { SourceLink } from "../discovery/return-navigation";
import { ProductCard } from "../discovery/product-card";
import { LibraryProvider } from "../library/provider";
import {
  ListingSaveButton,
  ListingCollectionButton,
} from "../library/controls";
import { CartMutationButton } from "../buyer-cart/mutation-button";
import { StartConversation } from "../messaging/start-conversation";
import { variantCaption } from "../inventory/model";
import { optionLabel } from "../selling/copy";
import { IntentControls } from "./intent-controls";
import { toolCopy, money, type ToolLocale } from "./copy";
import { toolHref, type ToolIntent, type ToolMode } from "./intent";
import { AssistantInterpretInput } from "../assistant-runs/interpreted-intent";
import {
  beginFindNavigation,
  findScope,
  reviewedFindIntent,
  type FindNavigation,
} from "./find-navigation";
import { useComparison } from "./comparison-provider";
import { observe, type ToolListing, type ToolResults } from "./model";
import { readCurrentToolListingAction } from "./actions";
import { SaveSearchControl } from "../saved-searches/controls";
import { ProductMiniCatalogue } from "./tool-catalogue";
import s from "./tools.module.css";
export function useToolLocale(): ToolLocale {
  return useLocale() === "en" ? "en" : "bg";
}
export function ToolHub() {
  return <ProductMiniCatalogue />;
}
export function ToolUnavailable({
  title,
  error = "unavailable",
}: {
  title: string;
  error?: "unavailable" | "invalid";
}) {
  const locale = useToolLocale(),
    t = toolCopy[locale],
    router = useRouter();
  return (
    <MiniShell name={title}>
      <section className={s.content}>
        <h1>{title}</h1>
        <p role="alert">{t[error]}</p>
        <button className={s.button} onClick={() => router.refresh()}>
          {t.retry}
        </button>
      </section>
    </MiniShell>
  );
}
export function ToolNavigation({
  intent,
  voice = false,
}: {
  intent: ToolIntent;
  voice?: boolean;
}) {
  const t = toolCopy[intent.discovery.locale];
  return (
    <nav className={s.nav} aria-label={t.hub}>
      <SourceLink
        preserveDiscoveryContext={false}
        href={toolHref("find-for-me", intent)}
      >
        {t.find}
      </SourceLink>
      {voice && (
        <SourceLink
          preserveDiscoveryContext={false}
          href={"/minis/find-for-me/voice?lang=" + intent.discovery.locale}
        >
          {t.voice}
        </SourceLink>
      )}
      <SourceLink
        preserveDiscoveryContext={false}
        href={toolHref("deal-finder", {
          ...intent,
          discovery: { ...intent.discovery, sort: "price_asc" },
        })}
      >
        {t.deal}
      </SourceLink>
      <SourceLink
        preserveDiscoveryContext={false}
        href={"/minis/compare?lang=" + intent.discovery.locale}
      >
        {t.compare}
      </SourceLink>
    </nav>
  );
}
export function ComparisonFeedback() {
  const controller = useComparison(),
    locale = useToolLocale(),
    t = toolCopy[locale],
    path = usePathname(),
    params = useSearchParams();
  const signIn =
    "/sign-in?lang=" +
    locale +
    "&returnTo=" +
    encodeURIComponent(path + "?" + params);
  if (controller.status === "guest")
    return (
      <p className={s.note}>
        <SourceLink preserveDiscoveryContext={false} href={signIn}>
          {t.signIn}
        </SourceLink>{" "}
        · {t.noAutomatically}
      </p>
    );
  const key = controller.feedback;
  return (
    <>
      {controller.status === "checking" && (
        <p role="status" className={s.note}>
          {t.checkingAccount}
        </p>
      )}
      {(controller.status === "unavailable" ||
        controller.status === "denied") && (
        <div className={s.feedback} role="alert">
          <p>{controller.status === "denied" ? t.denied : t.storage}</p>
          <button
            className={s.button}
            onClick={() => void controller.reload()}
            disabled={controller.busy}
          >
            {t.retry}
          </button>
        </div>
      )}
      {key && (
        <p className={s.feedback} role="status">
          {Object.hasOwn(t, key) ? t[key as keyof typeof t] : t.unavailable}
        </p>
      )}
      {controller.acknowledgment && (
        <div className={s.feedback} role="status">
          <p>
            {t.recordedChange}:{" "}
            {
              t[
                controller.acknowledgment.operation === "add"
                  ? "add"
                  : controller.acknowledgment.operation === "refresh"
                    ? "refreshObservation"
                    : controller.acknowledgment.operation === "reorder"
                      ? "reordered"
                      : controller.acknowledgment.operation
              ]
            }
          </p>
          <p>
            {t.acceptedRevision}: {controller.acknowledgment.change.revision} ·{" "}
            {t.currentRevision}: {controller.view?.revision ?? t.unknown}
          </p>
          <p className={s.note}>
            {controller.acknowledgment.change.replayed
              ? t.originalReceipt
              : t.recordedReceipt}
          </p>
        </div>
      )}
      {controller.pending && (
        <div className={s.feedback}>
          <p>{t.pending}</p>
          <button
            className={s.button}
            disabled={controller.busy}
            onClick={() => void controller.retry()}
          >
            {t.retryOriginal}
          </button>
        </div>
      )}
    </>
  );
}
export function AddComparison({ item }: { item: ToolListing }) {
  const c = useComparison(),
    locale = useToolLocale(),
    t = toolCopy[locale],
    selected =
      c.view?.items.some((row) => row.observation.listingId === item.card.id) ??
      false;
  const full = (c.view?.items.length ?? 0) >= 4;
  return (
    <button
      className={s.button}
      type="button"
      disabled={
        c.status !== "ready" ||
        c.busy ||
        c.pending ||
        selected ||
        full ||
        !["unknown", "available"].includes(item.inventory.state)
      }
      title={full ? t.full : undefined}
      onClick={() =>
        void c.execute({ kind: "add", observation: observe(item) })
      }
    >
      {selected ? t.added : t.add}
    </button>
  );
}
/** No action controls are exposed until an explicit current public fact read.
 * The reused contact/cart commands independently check authority and eligibility. */
export function CurrentItemActions({ listingId }: { listingId: string }) {
  const locale = useToolLocale(),
    t = toolCopy[locale],
    c = useComparison();
  const [item, setItem] = useState<ToolListing | null>(null),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  const life = useRef({ alive: false, epoch: 0 });
  useEffect(() => {
    const current = life.current;
    current.alive = true;
    const expire = () => {
      ++current.epoch;
      setItem(null);
    };
    window.addEventListener("focus", expire);
    document.addEventListener("visibilitychange", expire);
    return () => {
      current.alive = false;
      ++current.epoch;
      window.removeEventListener("focus", expire);
      document.removeEventListener("visibilitychange", expire);
    };
  }, [listingId]);
  async function review() {
    const ticket = ++life.current.epoch;
    setItem(null);
    setBusy(true);
    setFailed(false);
    try {
      const result = await readCurrentToolListingAction(listingId);
      if (!life.current.alive || ticket !== life.current.epoch) return;
      if (result.ok) setItem(result.data);
      else setFailed(true);
    } catch {
      if (life.current.alive && ticket === life.current.epoch) setFailed(true);
    } finally {
      if (life.current.alive) setBusy(false);
    }
  }
  return (
    <div className={s.stack}>
      <button
        className={s.button}
        disabled={busy}
        onClick={() => void review()}
      >
        {busy ? t.loading : t.currentActions}
      </button>
      {failed && <p role="alert">{t.notFound}</p>}
      {item && (
        <div className={s.feedback}>
          <p>
            {item.card.title} · {money(item.card.price.amount, locale)}
          </p>
          <p className={s.note}>
            {t[item.priceBasis]} ·{" "}
            {
              t[
                item.inventory.state === "unknown"
                  ? "unknown"
                  : item.inventory.state
              ]
            }
          </p>
          {item.variant && (
            <p>{variantCaption(item.variant.options) || t.variant}</p>
          )}
          <p>{t.reviewFirst}</p>
          <nav className={s.actions}>
            <SourceLink
              preserveDiscoveryContext={false}
              href={"/products/" + listingId + "?lang=" + locale}
            >
              {t.details}
            </SourceLink>
            <SourceLink
              preserveDiscoveryContext={false}
              href={"/stores/" + item.card.seller.id + "?lang=" + locale}
            >
              {t.storefront}
            </SourceLink>
            <SourceLink
              preserveDiscoveryContext={false}
              href={"/cart?lang=" + locale}
            >
              {t.cart}
            </SourceLink>
          </nav>
          {c.subject && c.status !== "denied" && (
            <>
              <StartConversation listingId={listingId} />
              {item.variant && item.inventory.state === "available" && (
                <CartMutationButton
                  className={s.button}
                  label={t.addCart}
                  operation={{
                    kind: "add",
                    listingId,
                    skuId: item.variant.id,
                    publicationRevision: item.revision,
                    quantity: 1,
                  }}
                />
              )}
            </>
          )}
          <ListingCollectionButton id={listingId} />
        </div>
      )}
    </div>
  );
}
function Evidence({ item, intent }: { item: ToolListing; intent: ToolIntent }) {
  const locale = intent.discovery.locale,
    t = toolCopy[locale],
    d = intent.discovery,
    category = getCategory(item.card.categoryId);
  return (
    <details>
      <summary>{t.evidence}</summary>
      <p>{t.matched}</p>
      {d.q && <p>{t.keywordEvidence}</p>}
      <dl className={s.factList}>
        <dt>{t.category}</dt>
        <dd>{getCategoryLabel(item.card.categoryId, locale)}</dd>
        <dt>{t.condition}</dt>
        <dd>{optionLabel(item.card.condition, locale)}</dd>
        <dt>{t.seller}</dt>
        <dd>{t[item.card.seller.kind]}</dd>
        <dt>{t.handover}</dt>
        <dd>{item.handover.map((mode) => t[mode]).join(" · ")}</dd>
        {Object.entries(d.attributes).map(([id]) => (
          <div className={s.wide} key={id}>
            <dt>
              {category?.kind === "leaf"
                ? category.profile.fields.find((f) => f.id === id)?.labels[
                    locale
                  ]
                : id}
            </dt>
            <dd>{formatAttribute(item.attributes[id], locale)}</dd>
          </div>
        ))}
      </dl>
      <p>{t.source}</p>
    </details>
  );
}
export function formatAttribute(
  value: ToolListing["attributes"][string] | undefined,
  locale: ToolLocale,
): string {
  const t = toolCopy[locale];
  if (value === undefined) return t.unknown;
  if (typeof value === "boolean") return value ? t.yes : t.no;
  if (typeof value === "number")
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 20 }).format(
      value,
    );
  if (Array.isArray(value))
    return value.length
      ? value.map((v) => optionLabel(v, locale)).join(" · ")
      : t.unknown;
  if (typeof value === "object")
    return "value" in value
      ? value.value + " " + value.unit
      : [value.width, value.height, value.depth]
          .map((v) =>
            new Intl.NumberFormat(locale, { maximumFractionDigits: 20 }).format(
              v,
            ),
          )
          .join(" × ") +
          " " +
          value.unit;
  return optionLabel(value, locale);
}
function FinderCriteria({
  initial,
  mode,
}: {
  initial: ToolIntent;
  mode: ToolMode;
}) {
  const router = useRouter(),
    [pending, startNavigation] = useTransition(),
    [navigation, setNavigation] = useState<FindNavigation>({
      generation: 0,
      submitted: null,
    }),
    currentNavigation = useRef(navigation),
    blocked =
      pending ||
      Boolean(
        navigation.submitted &&
        findScope(navigation.submitted) !== findScope(initial),
      );
  function navigate(intent: ToolIntent) {
    const next = beginFindNavigation(currentNavigation.current, intent);
    currentNavigation.current = next;
    setNavigation(next);
    startNavigation(() => router.push(toolHref(mode, intent)));
  }
  return (
    <>
      <div inert={pending} aria-busy={pending}>
        <IntentControls
          key={JSON.stringify(initial)}
          initial={initial}
          mode={mode}
          onReview={navigate}
        />
      </div>
      {blocked && (
        <p className={s.note} role="status">
          {initial.discovery.locale === "bg"
            ? "Новите критерии още не са заредени. Приложете ги отново, ако зареждането не завърши."
            : "The new criteria have not loaded yet. Submit them again if loading does not finish."}
        </p>
      )}
      {mode === "find-for-me" && (
        <div inert={blocked} aria-busy={pending}>
          <AssistantInterpretInput
            initial={{ ...initial, cursor: null }}
            locale={initial.discovery.locale}
            mode="text"
            onReviewedIntent={
              blocked
                ? undefined
                : (canonical) => {
                    const reviewed = reviewedFindIntent(
                      initial,
                      currentNavigation.current,
                      navigation.generation,
                      pending,
                      canonical,
                    );
                    if (reviewed) navigate(reviewed);
                  }
            }
          />
        </div>
      )}
    </>
  );
}
export function Finder({ data, mode }: { data: ToolResults; mode: ToolMode }) {
  const locale = data.intent.discovery.locale,
    t = toolCopy[locale],
    title = mode === "deal-finder" ? t.deal : t.find,
    [share, setShare] = useState<string | null>(null);
  return (
    <LibraryProvider
      query={{
        listingIds: data.items.map((item) => item.card.id),
        sellerIds: data.items.map((item) => item.card.seller.id),
      }}
    >
      <MiniShell name={title}>
        <section className={s.content}>
          <h1>{title}</h1>
          <p className={s.note}>
            {mode === "deal-finder" ? t.dealNote : t.findNote}
          </p>
          <ToolNavigation intent={data.intent} voice={mode === "find-for-me"} />
          <FinderCriteria
            key={mode + ":" + findScope(data.intent)}
            initial={data.intent}
            mode={mode}
          />
          <ComparisonFeedback />
          <SaveSearchControl
            key={JSON.stringify(data.intent)}
            intent={data.intent}
            mode={mode}
          />
          <div className={s.nav}>
            <button
              className={s.button}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    window.location.origin + toolHref(mode, data.intent),
                  );
                  setShare(t.copied);
                } catch {
                  setShare(t.copyFailed);
                }
              }}
            >
              {t.shareCriteria}
            </button>
          </div>
          {share && <p role="status">{share}</p>}
          <h2>{t.results}</h2>
          <p className={s.note}>{t.totalNote}</p>
          {!data.items.length && <p role="status">{t.noResults}</p>}
          <div className={s.grid}>
            {data.items.map((item) => (
              <article className={s.result} key={item.card.id}>
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
                  {optionLabel(item.card.condition, locale)} ·{" "}
                  {item.card.locality || t.unknown} ·{" "}
                  {
                    t[
                      item.inventory.state === "unknown"
                        ? "unknown"
                        : item.inventory.state
                    ]
                  }
                </p>
                <p>{t[item.priceBasis]}</p>
                {item.variant && (
                  <p>{variantCaption(item.variant.options) || t.variant}</p>
                )}
                <SourceLink
                  preserveDiscoveryContext={false}
                  href={"/stores/" + item.card.seller.id + "?lang=" + locale}
                >
                  {item.card.seller.name}
                </SourceLink>
                <Evidence item={item} intent={data.intent} />
                <div className={s.stack}>
                  <AddComparison item={item} />
                  <CurrentItemActions listingId={item.card.id} />
                </div>
              </article>
            ))}
          </div>
          {data.nextCursor && (
            <nav className={s.nav}>
              <SourceLink
                preserveDiscoveryContext={false}
                href={toolHref(mode, data.intent, data.nextCursor)}
              >
                {t.next}
              </SourceLink>
            </nav>
          )}
          <p className={s.note}>
            {t.checked}:{" "}
            <time dateTime={data.checkedAt}>
              {new Date(data.checkedAt).toLocaleString(locale, {
                timeZone: "Europe/Sofia",
              })}
            </time>
          </p>
          <p className={s.note}>{t.deterministic}</p>
        </section>
      </MiniShell>
    </LibraryProvider>
  );
}

export function FinderFailure({
  initial,
  mode,
  error,
}: {
  initial: ToolIntent;
  mode: ToolMode;
  error: "invalid" | "unavailable";
}) {
  const t = toolCopy[initial.discovery.locale],
    router = useRouter(),
    title = mode === "deal-finder" ? t.deal : t.find;
  return (
    <MiniShell name={title}>
      <section className={s.content}>
        <h1>{title}</h1>
        <p role="alert">{t[error]}</p>
        <p className={s.note}>{t.noAutomatically}</p>
        <button className={s.button} onClick={() => router.refresh()}>
          {t.retry}
        </button>
        <ToolNavigation intent={initial} />
        <IntentControls initial={initial} mode={mode} />
      </section>
    </MiniShell>
  );
}
