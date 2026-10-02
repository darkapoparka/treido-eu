"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useClerk } from "@clerk/nextjs";
import { getCategory, type ItemCondition } from "@treido/contracts/categories";
import { persistDraftAction } from "../sellers/actions";
import {
  parseEuroPrice,
  type DraftPayload,
  type DraftView,
  type DraftAcknowledgement,
} from "./draft-model";
import { useDraftBuffer, writeDraftBuffer } from "./draft-buffer";
import { CategoryPicker } from "./category-picker";
import { AttributeFields } from "./attribute-fields";
import { optionLabel } from "./copy";
import { registerPrivateBuffer } from "../sellers/private-recovery";
import { useUnsavedChanges } from "../sellers/use-unsaved-changes";
import { MediaPicker } from "./media-picker";
import styles from "../sellers/workspace.module.css";
import { AdminDraftForm } from "../sellers/admin-draft-form";

export function DraftEditor({
  initial,
  sellerId,
  requestId,
  language,
  bufferKey,
  actorSubject,
  canWrite = true,
  mediaAvailable = false,
  admin = false,
}: {
  initial: DraftPayload | DraftView;
  sellerId: string | null;
  requestId: string;
  language: "bg" | "en";
  bufferKey: string;
  actorSubject: string;
  canWrite?: boolean;
  mediaAvailable?: boolean;
  admin?: boolean;
}) {
  const draft = "payload" in initial ? initial : null;
  const initialPayload = draft?.payload ?? (initial as DraftPayload);
  const [data, setData] = useState<DraftPayload>(initialPayload);
  const [price, setPrice] = useState(
    initialPayload.priceMinor == null
      ? ""
      : (initialPayload.priceMinor / 100).toFixed(2),
  );
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [savedDraft, setSavedDraft] = useState<DraftAcknowledgement | null>(
    draft,
  );
  const [recoveryDismissed, setRecoveryDismissed] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const revision = savedDraft?.revision ?? 0;
  const attempt = useRef(requestId);
  const mounted = useRef(true);
  const acknowledged = useRef(JSON.stringify({ payload: data, price }));
  const [acknowledgedInput, setAcknowledgedInput] = useState(
    JSON.stringify({ payload: data, price }),
  );
  const router = useRouter();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const clerk = useClerk();
  const actorChanged = isLoaded && (!isSignedIn || userId !== actorSubject);
  const bg = language === "bg";
  const storageKey = `treido-draft:${bufferKey}`;
  useUnsavedChanges(
    JSON.stringify({ payload: data, price }) !== acknowledgedInput &&
      !actorChanged &&
      !blocked,
    language,
  );
  const buffer = useDraftBuffer(storageKey);
  const recoverable =
    !recoveryDismissed && !actorChanged && !blocked ? buffer : null;
  const category = data.categoryId ? getCategory(data.categoryId) : null;
  const update = (change: Partial<DraftPayload>) => {
    setRecoveryDismissed(true);
    setData((previous) => ({ ...previous, ...change }));
    setNotice(null);
  };

  useEffect(() => {
    mounted.current = true;
    registerPrivateBuffer(actorSubject, storageKey, sellerId);
    return () => {
      mounted.current = false;
    };
  }, [actorSubject, storageKey, sellerId]);

  useEffect(() => {
    if (actorChanged || blocked) {
      writeDraftBuffer(storageKey, null);
      return;
    }
    const current = JSON.stringify({ payload: data, price });
    if (current === acknowledged.current || !canWrite || !isSignedIn) return;
    writeDraftBuffer(storageKey, {
      version: 1,
      payload: data,
      price,
      revision,
      requestId: attempt.current,
    });
  }, [
    data,
    price,
    storageKey,
    actorChanged,
    blocked,
    isSignedIn,
    canWrite,
    revision,
  ]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (pending || !canWrite || blocked || actorChanged) return;
    const amount = parseEuroPrice(price);
    if (amount === "invalid") {
      setNotice("INVALID_INPUT");
      return;
    }
    setPending(true);
    setNotice(null);
    const entry = window.location.pathname + window.location.search;
    try {
      const result = await persistDraftAction({
        sellerId: savedDraft?.sellerId ?? sellerId,
        draftId: savedDraft?.id ?? null,
        expectedRevision: revision,
        requestId: attempt.current,
        payload: { ...data, priceMinor: amount },
      });
      // The old seller's write may commit, but its response must not redirect
      // a user who has left this editor or switched to another account.
      if (
        !mounted.current ||
        clerk.user?.id !== actorSubject ||
        window.location.pathname + window.location.search !== entry
      )
        return;
      if (!result.ok) {
        setNotice(result.code);
        if (result.code === "FORBIDDEN") setBlocked(true);
        return;
      }
      setSavedDraft(result.data);
      attempt.current = crypto.randomUUID();
      acknowledged.current = JSON.stringify({ payload: data, price });
      setAcknowledgedInput(acknowledged.current);
      writeDraftBuffer(storageKey, null);
      setRecoveryDismissed(true);
      setNotice("SAVED");
      if (!draft)
        router.replace(
          `/app/sellers/${result.data.sellerId}/listings/${result.data.id}/edit?lang=${language}`,
        );
    } catch {
      setNotice("NOT_AVAILABLE");
    } finally {
      if (mounted.current) setPending(false);
    }
  }
  const messages: Record<string, [string, string]> = {
    SAVED: ["Saved to your account.", "Запазено в профила ви."],
    INVALID_INPUT: [
      "Check the item details and price. Your input is preserved.",
      "Проверете данните и цената. Въведеното е запазено.",
    ],
    CONFLICT: [
      "A newer version or a previous attempt is already saved. Reopen the saved draft before continuing; your local input is preserved.",
      "Има по-нова версия или запазен предишен опит. Отворете запазената чернова. Локалните промени са запазени.",
    ],
    FORBIDDEN: [
      "You no longer have permission to save this item.",
      "Вече нямате право да запазвате този артикул.",
    ],
    UNAUTHENTICATED: [
      "Sign in again to save. Your input is preserved.",
      "Влезте отново, за да запазите. Въведеното е запазено.",
    ],
    QUOTA_EXCEEDED: [
      "Your seller account has reached its draft limit.",
      "Достигнат е лимитът за чернови на този продавач.",
    ],
    NOT_AVAILABLE: [
      "Could not confirm the save. Retry with the same details or check My selling. Your input is preserved.",
      "Запазването не е потвърдено. Опитайте със същите данни или проверете Продажби. Въведеното е запазено.",
    ],
  };
  if (actorChanged || blocked)
    return (
      <section className="account-panel" role="status">
        <p>
          {bg
            ? "Тази сесия вече няма достъп до артикула. Влезте отново в профила си. Локалната чернова е изчистена."
            : "This session no longer has access to the item. Sign in to your account again. The local draft buffer has been cleared."}
        </p>
        <Link
          className={styles.link}
          href={`/sign-in?returnTo=${encodeURIComponent(savedDraft ? `/app/sellers/${savedDraft.sellerId}/listings/${savedDraft.id}/edit?lang=${language}` : `/sell?lang=${language}`)}`}
        >
          {bg ? "Вход" : "Sign in"}
        </Link>
      </section>
    );
  return (
    <>
      {recoverable && (
        <section className="account-panel">
          <p>
            {bg
              ? "Има незапазени локални промени."
              : "Unsaved local input is available."}
          </p>
          <button
            type="button"
            className={styles.link}
            onClick={() => {
              setData(recoverable.payload);
              setPrice(recoverable.price);
              if (recoverable.revision === revision)
                attempt.current = recoverable.requestId;
              else setNotice("CONFLICT");
              setRecoveryDismissed(true);
            }}
          >
            {bg ? "Възстанови въведеното" : "Restore input"}
          </button>
        </section>
      )}
      {!admin && (
        <p className="form-note">
          {bg
            ? "Черновата е лична. Доставка и проверка за публикуване следват отделно. Локалните незапазени промени се изчистват при изход или смяна на профила."
            : "Your draft is private. Delivery and publication checks follow separately. Unsaved local input is cleared when you sign out or change accounts."}
        </p>
      )}
      {admin ? (
        <AdminDraftForm
          data={data}
          update={update}
          price={price}
          onPrice={(value) => {
            setRecoveryDismissed(true);
            setPrice(value);
            setNotice(null);
          }}
          save={save}
          pending={pending}
          canWrite={canWrite}
          language={language}
          saved={savedDraft}
          media={
            <MediaPicker
              key={`${savedDraft?.sellerId ?? sellerId}:${savedDraft?.id ?? "new"}:${actorSubject}`}
              sellerId={savedDraft?.sellerId ?? sellerId ?? ""}
              draftId={savedDraft?.id ?? null}
              actorSubject={actorSubject}
              language={language}
              canWrite={canWrite}
              available={mediaAvailable}
            />
          }
        />
      ) : (
        <form onSubmit={save} className={`account-form ${styles.form}`}>
          <fieldset disabled={pending || !canWrite} className={styles.form}>
            <label className="form-field">
              {bg ? "Заглавие" : "Title"}
              <input
                value={data.title}
                maxLength={160}
                onChange={(event) => update({ title: event.target.value })}
              />
            </label>
            <label className="form-field">
              {bg ? "Описание" : "Description"}
              <textarea
                value={data.description}
                maxLength={6000}
                rows={5}
                onChange={(event) =>
                  update({ description: event.target.value })
                }
              />
            </label>
            <label className="form-field">
              {bg ? "Цена · EUR" : "Price · EUR"}
              <input
                value={price}
                inputMode="decimal"
                maxLength={12}
                onChange={(event) => {
                  setRecoveryDismissed(true);
                  setPrice(event.target.value);
                  setNotice(null);
                }}
              />
            </label>
            <label className="form-field">
              {bg ? "Населено място" : "Location"}
              <input
                value={data.locality}
                maxLength={100}
                onChange={(event) => update({ locality: event.target.value })}
              />
            </label>
            {category?.kind === "leaf" && (
              <>
                <p>{category.labels[language]}</p>
                <label className="form-field">
                  {bg ? "Състояние" : "Condition"}
                  <select
                    value={data.condition}
                    onChange={(event) =>
                      update({
                        condition: event.target.value as ItemCondition | "",
                      })
                    }
                  >
                    <option value="">{bg ? "Избери" : "Choose"}</option>
                    {category.policy.conditions.map((item) => (
                      <option key={item} value={item}>
                        {optionLabel(item, language)}
                      </option>
                    ))}
                  </select>
                </label>
                <AttributeFields
                  category={category}
                  fields={data.fields}
                  errors={{}}
                  locale={language}
                  onChange={(id, value) =>
                    update({ fields: { ...data.fields, [id]: value } })
                  }
                />
              </>
            )}
            <details className={styles.details}>
              <summary>
                {bg
                  ? "Избери или промени категория"
                  : "Choose or change category"}
              </summary>
              <CategoryPicker
                locale={language}
                onSelect={(selected) =>
                  update({ categoryId: selected.id, fields: {}, condition: "" })
                }
              />
            </details>
            <button type="submit" className={styles.button}>
              {pending
                ? bg
                  ? "Запазване…"
                  : "Saving…"
                : bg
                  ? "Запази черновата"
                  : "Save draft"}
            </button>
          </fieldset>
        </form>
      )}
      <p
        className={notice && notice !== "SAVED" ? "form-error" : styles.status}
        role={notice && notice !== "SAVED" ? "alert" : "status"}
      >
        {notice
          ? (messages[notice] ?? messages.NOT_AVAILABLE)[bg ? 1 : 0]
          : savedDraft
            ? bg
              ? `Запазена версия ${revision}`
              : `Saved revision ${revision}`
            : ""}
      </p>
      {!admin && (
        <MediaPicker
          key={`${savedDraft?.sellerId ?? sellerId}:${savedDraft?.id ?? "new"}:${actorSubject}`}
          sellerId={savedDraft?.sellerId ?? sellerId ?? ""}
          draftId={savedDraft?.id ?? null}
          actorSubject={actorSubject}
          language={language}
          canWrite={canWrite}
          available={mediaAvailable}
        />
      )}
      <div className={styles.actions}>
        {savedDraft && !actorChanged && !blocked && (
          <Link
            href={`/app/sellers/${savedDraft.sellerId}/listings/${savedDraft.id}/review?lang=${language}`}
            className={styles.link}
          >
            {bg ? "Прегледай запазения артикул" : "Review saved item"}
          </Link>
        )}
        <Link href="/app" className={styles.link}>
          {bg ? "Моите продажби" : "My selling"}
        </Link>
        {notice === "CONFLICT" && draft && (
          <button
            type="button"
            className={styles.link}
            onClick={() => window.location.reload()}
          >
            {bg ? "Зареди запазената версия" : "Reload saved version"}
          </button>
        )}
        {notice === "UNAUTHENTICATED" && (
          <Link
            href={`/sign-in?returnTo=${encodeURIComponent(draft ? `/app/sellers/${draft.sellerId}/listings/${draft.id}/edit` : "/sell")}`}
            className={styles.link}
          >
            {bg ? "Вход" : "Sign in"}
          </Link>
        )}
      </div>
    </>
  );
}
