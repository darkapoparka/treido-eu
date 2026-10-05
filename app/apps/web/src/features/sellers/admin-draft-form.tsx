"use client";
import Link from "next/link";
import type { FormEvent, ReactNode } from "react";
import { getCategory, type ItemCondition } from "@treido/contracts/categories";
import type {
  DraftPayload,
  DraftAcknowledgement,
} from "../selling/draft-model";
import { CategoryPicker } from "../selling/category-picker";
import { AttributeFields } from "../selling/attribute-fields";
import { optionLabel } from "../selling/copy";
import styles from "./admin-editor.module.css";
import admin from "./admin.module.css";

export function AdminDraftForm({
  data,
  update,
  price,
  onPrice,
  save,
  pending,
  canWrite,
  language,
  media,
  saved,
}: {
  data: DraftPayload;
  update: (change: Partial<DraftPayload>) => void;
  price: string;
  onPrice: (value: string) => void;
  save: (event: FormEvent<HTMLFormElement>) => void;
  pending: boolean;
  canWrite: boolean;
  language: "bg" | "en";
  media: ReactNode;
  saved: DraftAcknowledgement | null;
}) {
  const bg = language === "bg";
  const category = data.categoryId ? getCategory(data.categoryId) : null;
  return (
    <form onSubmit={save} className={styles.form}>
      <fieldset disabled={pending || !canWrite} className={styles.layout}>
        <div className={styles.main}>
          <section
            className={`${styles.panel} ${styles.detailsPanel}`}
            aria-label={bg ? "Данни на продукта" : "Product details"}
          >
            <label className={styles.field}>
              {bg ? "Заглавие" : "Title"}
              <input
                value={data.title}
                placeholder={bg ? "Например: синьо яке" : "e.g. Blue jacket"}
                maxLength={160}
                onChange={(event) => update({ title: event.target.value })}
              />
            </label>
            <label className={styles.field}>
              {bg ? "Описание" : "Description"}
              <textarea
                value={data.description}
                maxLength={6000}
                rows={8}
                onChange={(event) =>
                  update({ description: event.target.value })
                }
              />
            </label>
            <div className={styles.media}>{media}</div>
            <details className={styles.category}>
              <summary>
                <span>{bg ? "Категория" : "Category"}</span>
                <strong>
                  {category?.labels[language] ??
                    (bg ? "Избери категория" : "Choose a product category")}
                </strong>
              </summary>
              <CategoryPicker
                locale={language}
                onSelect={(selected) =>
                  update({ categoryId: selected.id, fields: {}, condition: "" })
                }
              />
            </details>
            <p className={styles.help}>
              {bg
                ? "Категорията определя данните и изискванията за продукта."
                : "The category determines the product's fields and requirements."}
            </p>
          </section>
          <section className={styles.priceGroup}>
            <h2>{bg ? "Цена" : "Price"}</h2>
            <div className={styles.panel}>
              <label className={styles.field}>
                {bg ? "Цена · EUR" : "Price · EUR"}
                <input
                  value={price}
                  inputMode="decimal"
                  maxLength={12}
                  onChange={(event) => onPrice(event.target.value)}
                />
              </label>
            </div>
          </section>
          <section className={styles.panel}>
            <h2>{bg ? "Данни за артикула" : "Item details"}</h2>
            <label className={styles.field}>
              {bg ? "Населено място" : "Location"}
              <input
                value={data.locality}
                maxLength={100}
                onChange={(event) => update({ locality: event.target.value })}
              />
            </label>
            {category?.kind === "leaf" && (
              <>
                <label className={styles.field}>
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
          </section>
          <div className={styles.saveRow}>
            <button className={admin.primary} type="submit">
              {pending
                ? bg
                  ? "Запазване…"
                  : "Saving…"
                : bg
                  ? "Запази черновата"
                  : "Save draft"}
            </button>
          </div>
        </div>
        <aside className={styles.side}>
          {saved && (
            <section className={styles.panel}>
              <h2>{bg ? "Наличности и варианти" : "Inventory and variants"}</h2>
              <Link
                className={admin.secondary}
                href={`/app/sellers/${saved.sellerId}/listings/${saved.id}/review?lang=${language}#inventory`}
              >
                {bg ? "Управлявай наличностите" : "Manage inventory"}
              </Link>
            </section>
          )}
          <section className={`${styles.panel} ${styles.statusPanel}`}>
            <h2>{bg ? "Състояние" : "Status"}</h2>
            <span className={styles.draftStatus}>
              {bg ? "Лична чернова" : "Private draft"}
            </span>
          </section>
          <section className={styles.panel}>
            <h2>{bg ? "Публикуване" : "Publishing"}</h2>
            <p className={styles.help}>
              {bg
                ? "Запазването не публикува продукта. Незапазените промени се изчистват при изход или смяна на профила."
                : "Saving does not publish this product. Unsaved input is cleared on sign-out or account change."}
            </p>
            <p>
              {bg
                ? "Прегледай запазената версия за текущото състояние и изискванията за публикуване."
                : "Review the saved version for its current status and publication requirements."}
            </p>
            {saved ? (
              <Link
                className={admin.secondary}
                href={`/app/sellers/${saved.sellerId}/listings/${saved.id}/review?lang=${language}`}
              >
                {bg ? "Прегледай продукта" : "Review product"}
              </Link>
            ) : (
              <p className={styles.help}>
                {bg ? "Първо запази черновата." : "Save your draft first."}
              </p>
            )}
          </section>
        </aside>
      </fieldset>
    </form>
  );
}
