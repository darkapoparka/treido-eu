"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { withdrawListingAction } from "./publication-actions";
import { PublicationPublishForm } from "./publication-publish-form";
import type { PublicationReview } from "./publication-model";
import styles from "../sellers/workspace.module.css";

const reasons: Record<string, [string, string]> = {
  DECLARATION_REQUIRED: [
    "Seller declarations are required.",
    "Необходими са декларации на продавача.",
  ],
  DECLARATION_REVIEW_REQUIRED: [
    "Seller declarations await review.",
    "Декларациите на продавача очакват преглед.",
  ],
  DECLARATION_REJECTED: [
    "Seller declarations need correction.",
    "Декларациите на продавача изискват корекция.",
  ],
  DECLARATION_STALE: [
    "Seller declarations need updating.",
    "Декларациите на продавача изискват актуализация.",
  ],
  CATEGORY_UNREVIEWED: [
    "This category awaits publication-policy review.",
    "Категорията очаква преглед на правилата за публикуване.",
  ],
  CATEGORY_UNSUPPORTED: [
    "Choose a supported leaf category.",
    "Изберете поддържана крайна категория.",
  ],
  CATEGORY_POLICY_STALE: [
    "This category's rules changed. Review the saved item.",
    "Правилата на категорията са променени. Прегледайте запазения артикул.",
  ],
  LISTING_INCOMPLETE: [
    "Complete the item details and required attributes.",
    "Попълнете данните и задължителните характеристики.",
  ],
  MEDIA_NOT_READY: [
    "Add photos and wait for processing.",
    "Добавете снимки и изчакайте обработката.",
  ],
  MEDIA_FAILED: [
    "Some photos could not be processed.",
    "Някои снимки не могат да бъдат обработени.",
  ],
  PUBLICATION_QUOTA_EXCEEDED: [
    "Your active listing limit is reached.",
    "Достигнат е лимитът за активни обяви.",
  ],
  LISTING_RESTRICTED: [
    "This item is restricted. Contact support.",
    "Артикулът е ограничен. Свържете се с поддръжката.",
  ],
  LISTING_REMOVED: [
    "This item was removed. Contact support.",
    "Артикулът е премахнат. Свържете се с поддръжката.",
  ],
};
export function PublicationReviewPanel({
  review,
  requestId,
  language,
}: {
  review: PublicationReview;
  requestId: string;
  language: "bg" | "en";
}) {
  const bg = language === "bg";
  const trust = useTranslations("trust");
  const publish = useTranslations("publication");
  const [result, action, pending] = useActionState(withdrawListingAction, null);
  const edit = `/app/sellers/${review.sellerId}/listings/${review.listingId}/edit?lang=${language}`;
  return (
    <section className="account-panel">
      <h2>
        {review.title.trim() || (bg ? "Артикул без заглавие" : "Untitled item")}
      </h2>
      <p>
        {bg
          ? `Запазена версия ${review.revision} · Готови снимки: ${review.readyPhotos}`
          : `Saved revision ${review.revision} · Ready photos: ${review.readyPhotos}`}
      </p>
      <p role="status">
        {result?.ok || review.publication === "withdrawn"
          ? bg
            ? "Обявата е оттеглена."
            : "The listing is withdrawn."
          : review.publication === "published"
            ? bg
              ? "Обявата е публикувана."
              : "The listing is published."
            : publish(review.canPublish ? "reviewNote" : "blocked")}
      </p>
      {review.publication !== "published" && (
        <>
          <ul>
            {review.readiness.reasonCodes.map((reason) => (
              <li key={reason}>
                {
                  (reasons[reason] ?? [
                    "Additional publication requirements are pending.",
                    "Допълнителните изисквания за публикуване все още не са изпълнени.",
                  ])[bg ? 1 : 0]
                }
              </li>
            ))}
          </ul>
          <Link href={edit} className={styles.link}>
            {bg ? "Редактирай запазения артикул" : "Edit saved item"}
          </Link>
        </>
      )}
      <Link
        className={styles.link}
        href={
          "/app/sellers/" +
          review.sellerId +
          "/listings/" +
          review.listingId +
          "/moderation?lang=" +
          language
        }
      >
        {trust("history")}
      </Link>
      {review.publication !== "published" && (
        <PublicationPublishForm
          key={review.revision}
          review={review}
          language={language}
        />
      )}
      {review.publication === "published" && !result?.ok && (
        <>
          <Link
            className={styles.link}
            href={"/products/" + review.listingId + "?lang=" + language}
          >
            {publish("view")}
          </Link>
          <p>{publish("editNote")}</p>
        </>
      )}
      {review.canWithdraw && !result?.ok && (
        <form action={action} className={styles.form}>
          <input type="hidden" name="sellerId" value={review.sellerId} />
          <input type="hidden" name="listingId" value={review.listingId} />
          <input
            type="hidden"
            name="expectedRevision"
            value={review.revision}
          />
          <input type="hidden" name="requestId" value={requestId} />
          <p>
            {bg
              ? "Оттеглянето спира публичния достъп и новите запитвания. Запазените данни се съхраняват."
              : "Withdrawal stops public access and new inquiries. Saved records are retained."}
          </p>
          <button type="submit" className={styles.button} disabled={pending}>
            {pending
              ? bg
                ? "Оттегляне…"
                : "Withdrawing…"
              : bg
                ? "Оттегли обявата"
                : "Withdraw listing"}
          </button>
        </form>
      )}
      {result && !result.ok && (
        <p role="alert">
          {result.code === "CONFLICT"
            ? bg
              ? "Състоянието е променено. Презаредете преди нов опит."
              : "The state changed. Reload before retrying."
            : bg
              ? "Обявата не е оттеглена. Проверете достъпа и опитайте отново."
              : "The listing was not withdrawn. Check access and try again."}
        </p>
      )}
    </section>
  );
}
