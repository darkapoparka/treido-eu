import "server-only";
import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getDatabase, inTransaction } from "../../server/db/database";
import { backendConfigured } from "../sellers/backend-status.server";
import { readPrivatePage } from "../sellers/page-context.server";
import { requireShippingPageIdentity } from "./page-context.server";
import { ShopSurface } from "../discovery/hydration-boundary";
import { FloatingNav } from "../discovery/components";
import {
  parseShippingStart,
  shippingReviewHref,
  shippingStartHref,
} from "./integration";
import { readShippingContext, readShippingReview } from "./queries.server";
import { shippingQuoteBridgeReady } from "./bridge.server";
import {
  shippingContextForClient,
  shippingAcceptanceForClient,
} from "./client-contract";
import {
  ShippingSelection,
  ShippingAcceptance,
  ShippingCostsSummary,
  ShippingPayableQuoteControl,
} from "./controls";
import { shippingText } from "./messages";
import type { Language } from "./model";
import s from "../purchase-reviews/reviews.module.css";
type Query = Record<string, string | string[] | undefined>;
function params(query: Query) {
  const result = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value))
      for (const item of value) result.append(key, item);
    else if (value !== undefined) result.append(key, value);
  }
  return result;
}
function Shell({
  language,
  children,
}: {
  language: Language;
  children: ReactNode;
}) {
  const t = shippingText(language);
  return (
    <ShopSurface className={"shop-page " + s.page}>
      <header className={s.header}>
        <h1>{t.title}</h1>
        <Link
          className={s.secondary}
          href={"/checkout/payments?lang=" + language}
        >
          {t.back}
        </Link>
      </header>
      {children}
      <FloatingNav back marketplace />
    </ShopSurface>
  );
}
export async function ShippingStartPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  await connection();
  const input = parseShippingStart(params(await searchParams));
  if (!input) notFound();
  const t = shippingText(input.language),
    href = shippingStartHref(input.source, input.language);
  if (!backendConfigured())
    return (
      <Shell language={input.language}>
        <p role="status">{t.unavailable}</p>
      </Shell>
    );
  const identity = await requireShippingPageIdentity(href);
  const context = await readPrivatePage(() =>
    readShippingContext(getDatabase(), identity, input.source, input.language),
  );
  return (
    <Shell language={input.language}>
      <section className={s.card}>
        {context ? (
          <ShippingSelection context={shippingContextForClient(context)} />
        ) : (
          <p role="status">{t.unavailable}</p>
        )}
      </section>
    </Shell>
  );
}
export async function ShippingReviewPage({
  params: route,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Query>;
}) {
  await connection();
  const { id } = await route,
    query = params(await searchParams);
  if (
    [...query.keys()].some((key) => key !== "lang") ||
    query.getAll("lang").length !== 1 ||
    !["bg", "en"].includes(query.get("lang") ?? "")
  )
    notFound();
  const language = query.get("lang") as Language;
  let href: string;
  try {
    href = shippingReviewHref(id, language);
  } catch {
    notFound();
  }
  const t = shippingText(language);
  if (!backendConfigured())
    return (
      <Shell language={language}>
        <p role="status">{t.unavailable}</p>
      </Shell>
    );
  const identity = await requireShippingPageIdentity(href);
  const review = await readPrivatePage(() =>
    readShippingReview(getDatabase(), identity, id),
  );
  if (!review)
    return (
      <Shell language={language}>
        <p role="status">{t.unavailable}</p>
      </Shell>
    );
  // Display the language of the original accepted terms, never silently translate that agreement.
  const original = review.snapshot.language,
    text = shippingText(original),
    option = review.snapshot.option;
  const bridgeReady =
    (await readPrivatePage(() =>
      inTransaction(getDatabase(), (tx) =>
        shippingQuoteBridgeReady(tx, review),
      ),
    )) ?? false;
  return (
    <Shell language={original}>
      <section className={s.card}>
        <h2>{text.recipient}</h2>
        {review.recipient ? (
          <dl className={s.stack}>
            {Object.entries(review.recipient).map(([field, value]) => (
              <div key={field}>
                <dt>{text.fields[field as keyof typeof text.fields]}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>{text.recipientUnavailable}</p>
        )}
        <p>
          {option.binding.carrierLabel[original]} · {review.snapshot.country}
        </p>
        <ShippingCostsSummary costs={option.costs} language={original} />
        <p>{option.policy.taxDescription[original]}</p>
        <h2>{text.terms}</h2>
        <p>{option.policy.terms[original]}</p>
        <p>{option.financial.terms[original]}</p>
        <h2>{text.rights}</h2>
        <p>{option.policy.rights[original]}</p>
        <h2>{text.refundTerms}</h2>
        <p>{option.policy.refundTerms[original]}</p>
        <h2>{text.costValidity}</h2>
        <p>
          {text.reviewUntil}{" "}
          <time dateTime={review.expiresAt}>
            {new Intl.DateTimeFormat(original, {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "Europe/Sofia",
            }).format(new Date(review.expiresAt))}
          </time>
          .
        </p>
        <p>
          {text.tariffUntil}{" "}
          <time dateTime={option.rate.validUntil}>
            {new Intl.DateTimeFormat(original, {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "Europe/Sofia",
            }).format(new Date(option.rate.validUntil))}
          </time>
          .
        </p>
        <h2>{text.retention}</h2>
        <p>{option.policy.recipientPurpose[original]}</p>
        <p>{option.policy.retentionDescription[original]}</p>
        <p className={s.muted}>{text.manual}</p>
        <ShippingAcceptance
          context={shippingAcceptanceForClient(review, bridgeReady)}
        />
        {review.state === "accepted" && (
          <ShippingPayableQuoteControl
            context={shippingAcceptanceForClient(review, bridgeReady)}
          />
        )}
        {review.quoteId && (
          <Link
            className={s.primary}
            href={`/checkout/payments/${review.quoteId}?lang=${original}`}
          >
            {text.payment}
          </Link>
        )}
      </section>
    </Shell>
  );
}
