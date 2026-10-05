"use client";
import {
  downloadTemplate,
  downloadCategoryGuide,
} from "../catalogue-import/download";
import { sellerEntryCopy } from "./copy";
import s from "../selling/selling.module.css";

/** Reuses the actual import schema and taxonomy; never supplies sample goods. */
export function SellerTemplateControls({
  language,
}: {
  language: "bg" | "en";
}) {
  const t = sellerEntryCopy[language];
  return (
    <div className={s.actions}>
      <button className={s.textButton} type="button" onClick={downloadTemplate}>
        {t.template}
      </button>
      <button
        className={s.textButton}
        type="button"
        onClick={downloadCategoryGuide}
      >
        {t.categories}
      </button>
    </div>
  );
}
