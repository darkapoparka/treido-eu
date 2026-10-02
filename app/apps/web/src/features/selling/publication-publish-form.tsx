"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { PublicationReview } from "./publication-model";
import { publishListingAction } from "./publish-actions";
import { parsePublicationTerms } from "./publish-model";
import styles from "../sellers/workspace.module.css";
export function PublicationPublishForm({
  review,
  language,
}: {
  review: PublicationReview;
  language: "bg" | "en";
}) {
  const t = useTranslations("publication"),
    router = useRouter();
  const [pickup, setPickup] = useState(true),
    [shipping, setShipping] = useState(false),
    [deliveryDetails, setDeliveryDetails] = useState(""),
    [defects, setDefects] = useState("");
  const [checks, setChecks] = useState({
    ownsItem: false,
    photoRights: false,
    accurateDetails: false,
    personalSale: false,
  });
  const [pending, start] = useTransition(),
    [error, setError] = useState<string | null>(null),
    [saved, setSaved] = useState(false);
  const retry = useRef<{ hash: string; id: string } | null>(null),
    active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const terms = parsePublicationTerms({
    version: 1,
    country: "BG",
    purchaseMode: "contact",
    handover: [
      ...(pickup ? ["pickup"] : []),
      ...(shipping ? ["shipping"] : []),
    ],
    deliveryDetails,
    defects,
    ...checks,
  });
  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (!terms || !review.canPublish) return;
        const input = {
          sellerId: review.sellerId,
          listingId: review.listingId,
          expectedRevision: review.revision,
          media: review.media,
          terms,
        };
        const hash = JSON.stringify(input);
        if (retry.current?.hash !== hash)
          retry.current = { hash, id: crypto.randomUUID() };
        const requestId = retry.current.id;
        setError(null);
        start(async () => {
          try {
            const result = await publishListingAction({ ...input, requestId });
            if (!active.current) return;
            if (!result.ok) {
              setError(result.code);
              return;
            }
            setSaved(true);
            router.refresh();
          } catch {
            if (active.current) setError("NOT_AVAILABLE");
          }
        });
      }}
    >
      <h3>{t("title")}</h3>
      <p>{t("reviewNote")}</p>
      <p>{t("country")}</p>
      <fieldset disabled={pending || saved}>
        <legend className={styles.legend}>{t("handover")}</legend>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={pickup}
            onChange={(e) => setPickup(e.target.checked)}
          />
          {t("pickup")}
        </label>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={shipping}
            onChange={(e) => setShipping(e.target.checked)}
          />
          {t("shipping")}
        </label>
        <label className="form-field">
          {t("deliveryDetails")}
          <textarea
            value={deliveryDetails}
            onChange={(e) => setDeliveryDetails(e.target.value)}
            required={shipping}
            maxLength={1000}
            rows={3}
          />
        </label>
        <p className="form-note">{t("deliveryNote")}</p>
        <label className="form-field">
          {t("defects")}
          <textarea
            value={defects}
            onChange={(e) => setDefects(e.target.value)}
            maxLength={2000}
            rows={3}
          />
        </label>
        {(
          [
            "ownsItem",
            "photoRights",
            "accurateDetails",
            ...(review.sellerKind === "personal"
              ? ["personalSale" as const]
              : []),
          ] as const
        ).map((key) => (
          <label className={styles.checkbox} key={key}>
            <input
              type="checkbox"
              required
              checked={checks[key]}
              onChange={(e) =>
                setChecks({ ...checks, [key]: e.target.checked })
              }
            />
            {t(key)}
          </label>
        ))}
      </fieldset>
      <p>{t("contactOnly")}</p>
      {!review.canPublish && <p role="status">{t("blocked")}</p>}
      {error && (
        <p role="alert">
          {t(
            error === "CONFLICT"
              ? "conflict"
              : error === "QUOTA_EXCEEDED"
                ? "quota"
                : "failed",
          )}
        </p>
      )}
      {saved ? (
        <p role="status">
          <Link
            className={styles.link}
            href={"/products/" + review.listingId + "?lang=" + language}
          >
            {t("view")}
          </Link>
        </p>
      ) : (
        <button
          type="submit"
          className={styles.button}
          disabled={
            pending ||
            !review.canPublish ||
            !terms ||
            (review.sellerKind === "personal" && !checks.personalSale)
          }
          aria-busy={pending}
        >
          {t(pending ? "publishing" : "publish")}
        </button>
      )}
    </form>
  );
}
