"use client";
import { useRef, useState, type FormEvent } from "react";
import { getCategory, type CategoryLeaf } from "@treido/contracts/categories";
import { ShopSurface } from "../discovery/hydration-boundary";
import { SourceLink } from "../discovery/return-navigation";
import { AttributeFields } from "./attribute-fields";
import { CategoryPicker } from "./category-picker";
import { optionLabel, sellingCopy, type SellingLocale } from "./copy";
import { useDevicePreparation, writeDevicePreparation } from "./device-buffer";
import {
  decodePreparation,
  encodePreparation,
  reviewPreparation,
  type CategoryPreparation,
  type RawValue,
} from "./form-model";
import { PreparationReview } from "./preparation-review";
import styles from "./selling.module.css";

type Step = "category" | "details" | "review";
type Notice = "saved" | "saveFailed" | "invalidSaved" | "discarded" | null;
const emptyPreparation: CategoryPreparation = { condition: "", fields: {} };

export function SellingForm({
  initialLocale,
}: {
  initialLocale: SellingLocale;
}) {
  const [locale, setLocale] = useState(initialLocale);
  const [step, setStep] = useState<Step>("category");
  const [category, setCategory] = useState<CategoryLeaf | null>(null);
  const [preparations, setPreparations] = useState<
    Record<string, CategoryPreparation>
  >({});
  const [errors, setErrors] = useState<Record<string, "required" | "invalid">>(
    {},
  );
  const [notice, setNotice] = useState<Notice>(null);
  const [restored, setRestored] = useState(false);
  const buffer = useDevicePreparation();
  const heading = useRef<HTMLHeadingElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const copy = sellingCopy[locale];
  const preparation = category
    ? (preparations[category.id] ?? emptyPreparation)
    : emptyPreparation;
  const review = category ? reviewPreparation(category, preparation) : null;

  function advance(next: Step) {
    setStep(next);
    setErrors({});
    window.requestAnimationFrame(() => {
      heading.current?.focus();
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  }
  function selectCategory(selected: CategoryLeaf) {
    setCategory(selected);
    setNotice(null);
    advance("details");
  }
  function update(patch: Partial<CategoryPreparation>) {
    if (!category) return;
    const updated = { ...preparation, ...patch };
    setPreparations((previous) => ({
      ...previous,
      [category.id]: updated,
    }));
    setErrors((current) => {
      if (!Object.keys(current).length) return current;
      const remaining = reviewPreparation(category, updated).errors;
      return Object.fromEntries(
        Object.keys(current)
          .filter((id) => remaining[id])
          .map((id) => [id, remaining[id]]),
      );
    });
    setNotice(null);
  }
  function changeField(id: string, value: RawValue) {
    update({ fields: { ...preparation.fields, [id]: value } });
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!review) return;
    if (Object.keys(review.errors).length) {
      setErrors(review.errors);
      window.requestAnimationFrame(() => {
        form.current
          ?.querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus();
      });
    } else advance("review");
  }
  function restore() {
    const saved = buffer ? decodePreparation(buffer) : null;
    if (!saved) {
      setNotice("invalidSaved");
      return;
    }
    setCategory(saved.category);
    setPreparations((previous) => ({
      ...previous,
      [saved.category.id]: saved.preparation,
    }));
    setRestored(true);
    setNotice(null);
    advance("review");
  }
  function discard() {
    if (writeDevicePreparation(null)) {
      setNotice("discarded");
      setRestored(false);
    } else setNotice("saveFailed");
  }
  function save() {
    if (!category) return;
    const value = encodePreparation(category, preparation);
    const saved = !!value && writeDevicePreparation(value);
    setNotice(saved ? "saved" : "saveFailed");
    if (saved) setRestored(true);
  }

  return (
    <ShopSurface
      lang={locale}
      className={`shop-page account-page ${styles.page}`}
    >
      <div className={styles.toolbar}>
        <SourceLink href="/profile" className={styles.textButton}>
          ← {copy.profile}
        </SourceLink>
        <div className={styles.languages} aria-label="Language / Език">
          <button
            type="button"
            aria-pressed={locale === "bg"}
            onClick={() => setLocale("bg")}
          >
            BG
          </button>
          <button
            type="button"
            aria-pressed={locale === "en"}
            onClick={() => setLocale("en")}
          >
            EN
          </button>
        </div>
      </div>
      <header className={`account-heading ${styles.heading}`}>
        <h1
          ref={heading}
          tabIndex={-1}
          aria-label={`${copy.title}: ${copy[step]}`}
        >
          {copy.title}
        </h1>
      </header>
      <ol className={styles.steps} aria-label={copy.title}>
        {(["category", "details", "review"] as const).map((item, index) => (
          <li key={item} aria-current={step === item ? "step" : undefined}>
            <span aria-hidden="true">{index + 1}</span>
            {copy[item]}
          </li>
        ))}
      </ol>
      {buffer !== null && !restored && notice !== "saved" && (
        <section
          className={`account-panel ${styles.notice}`}
          aria-label={copy.savedAvailable}
        >
          <p>{copy.savedAvailable}</p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.textButton}
              onClick={restore}
            >
              {copy.restore}
            </button>
            <button
              type="button"
              className={styles.textButton}
              onClick={discard}
            >
              {copy.discard}
            </button>
          </div>
        </section>
      )}
      {notice && (
        <p
          role="status"
          className={
            notice === "saveFailed" || notice === "invalidSaved"
              ? "form-error"
              : "form-note"
          }
        >
          {copy[notice]}
        </p>
      )}
      <div hidden={step !== "category"}>
        <CategoryPicker
          locale={locale}
          initialRoot={category?.parentId}
          onSelect={selectCategory}
        />
      </div>
      {category && step !== "category" && (
        <>
          <section
            className={`account-panel ${styles.selection}`}
            aria-label={copy.category}
          >
            <small>{getCategory(category.parentId)?.labels[locale]}</small>
            <h2>{category.labels[locale]}</h2>
            <button
              type="button"
              className={styles.textButton}
              onClick={() => advance("category")}
            >
              {copy.changeCategory}
            </button>
          </section>
          {step === "details" && (
            <form
              ref={form}
              className="account-form"
              noValidate
              onSubmit={submit}
            >
              {Object.keys(errors).length > 0 && (
                <p role="alert" className="form-error">
                  {copy.fixErrors}
                </p>
              )}
              <div className={styles.fieldGroup}>
                <label htmlFor="selling-condition" className="form-field">
                  {copy.condition} · {copy.required}
                  <select
                    id="selling-condition"
                    value={preparation.condition}
                    aria-required="true"
                    aria-invalid={errors.condition ? true : undefined}
                    aria-describedby={
                      errors.condition ? "selling-condition-error" : undefined
                    }
                    onChange={(event) =>
                      update({ condition: event.target.value })
                    }
                  >
                    <option value="">{copy.choose}</option>
                    {category.policy.conditions.map((condition) => (
                      <option key={condition} value={condition}>
                        {optionLabel(condition, locale)}
                      </option>
                    ))}
                  </select>
                </label>
                {errors.condition && (
                  <p className="form-error" id="selling-condition-error">
                    {copy.conditionError}
                  </p>
                )}
              </div>
              <AttributeFields
                category={category}
                fields={preparation.fields}
                errors={errors}
                locale={locale}
                onChange={changeField}
              />
              <p className="form-note">{copy.scopeNote}</p>
              <button
                type="submit"
                className={`primary form-submit ${styles.primary}`}
              >
                {copy.continue}
              </button>
              <button
                type="button"
                className="form-cancel"
                onClick={() => advance("category")}
              >
                {copy.back}
              </button>
            </form>
          )}
          {step === "review" && review?.attributes && (
            <>
              <section className="account-panel">
                <div className={styles.reviewHeading}>
                  <h2>{copy.review}</h2>
                  <button
                    type="button"
                    className={styles.textButton}
                    onClick={() => advance("details")}
                  >
                    {copy.edit}
                  </button>
                </div>
                <p className="form-note">{copy.reviewIntro}</p>
                <PreparationReview
                  category={category}
                  condition={preparation.condition}
                  attributes={review.attributes}
                  locale={locale}
                />
              </section>
              <p className="form-note">{copy.scopeNote}</p>
              <button
                type="button"
                className={`primary form-submit ${styles.primary}`}
                onClick={save}
              >
                {copy.save}
              </button>
              {buffer !== null && restored && (
                <button type="button" className="form-cancel" onClick={discard}>
                  {copy.discard}
                </button>
              )}
              <div className={`account-panel ${styles.publication}`}>
                <p id="selling-publish-reason">{copy.publishPending}</p>
                <button
                  type="button"
                  className={`primary form-submit ${styles.primary}`}
                  disabled
                  aria-describedby="selling-publish-reason"
                >
                  {copy.publish}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </ShopSurface>
  );
}
