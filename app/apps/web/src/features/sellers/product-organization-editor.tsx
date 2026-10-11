"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { productOrganizationAction } from "./catalog-organization-actions";
import { CatalogCollectionPicker, type CollectionOptions } from "./catalog-collection-picker";
import { CatalogFeedback, useCatalogMutation } from "./catalog-client";
import { normalizeCatalogTags, type ProductOrganization } from "./catalog-organization-model";
import { useUnsavedChanges } from "./use-unsaved-changes";
import admin from "./admin.module.css";
import editor from "./admin-editor.module.css";
import styles from "./catalog-workspace.module.css";

export function ProductOrganizationEditor({ sellerId, actorSubject, bufferKey, language, canWrite, initial, collections }: {
  sellerId: string;
  actorSubject: string;
  bufferKey: string;
  language: "bg" | "en";
  canWrite: boolean;
  initial: ProductOrganization;
  collections: CollectionOptions;
}) {
  const bg = language === "bg";
  const task = useCatalogMutation(actorSubject, sellerId, bufferKey);
  const [saved, setSaved] = useState(initial);
  const [tags, setTags] = useState(initial.tags.join(", "));
  const [included, setIncluded] = useState(initial.collectionIds);
  const [notice, setNotice] = useState(false);
  const dirty = tags !== saved.tags.join(", ") || [...included].sort().join() !== [...saved.collectionIds].sort().join();
  useUnsavedChanges(dirty && !task.denied, language);
  async function refresh() {
    const ticket = task.capture();
    if (!ticket) return;
    const result = await productOrganizationAction(sellerId, initial.listingId);
    if (!task.current(ticket)) return;
    if (!result.ok) { task.report(result.code); return; }
    setSaved(result.data);
    setTags(result.data.tags.join(", "));
    setIncluded(result.data.collectionIds);
    setNotice(true);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeCatalogTags(tags.split(",").map((tag) => tag.trim()).filter(Boolean));
    if (!normalized) { task.report("INVALID_INPUT"); return; }
    const result = await task.run({
      kind: "organizeProducts", products: [{ listingId: saved.listingId, expectedRevision: saved.revision }],
      tagsMode: "replace", tags: normalized,
      addCollections: included.filter((id) => !saved.collectionIds.includes(id)),
      removeCollections: saved.collectionIds.filter((id) => !included.includes(id)),
    });
    if (result) await refresh();
  }
  if (task.denied) return <p role="alert">{bg ? "Нямаш текущ достъп до организацията на този продукт." : "You no longer have access to this product's organization."}</p>;
  return <section className={editor.panel} aria-labelledby="product-organization-heading" id="organization">
    <h2 id="product-organization-heading">{bg ? "Организация" : "Organization"}</h2>
    <form className={styles.form} onSubmit={submit}>
      <fieldset className={styles.fields} disabled={!canWrite || !task.ready || task.pending || !!task.recovered}>
        <label className={editor.field}><span>{bg ? "Етикети" : "Tags"}</span><input value={tags} maxLength={840} onChange={(event) => { setTags(event.target.value); setNotice(false); }} /><small>{bg ? "Разделяй етикетите със запетая. До 20 етикета, всеки до 40 знака." : "Separate tags with commas. Up to 20 tags, each up to 40 characters."}</small></label>
        <CatalogCollectionPicker sellerId={sellerId} initial={collections} selected={included} onChange={(ids) => { setIncluded(ids); setNotice(false); }} language={language} task={task} label={bg ? "Колекции" : "Collections"} />
      </fieldset>
      <CatalogFeedback task={task} language={language} onRecovered={refresh} />
      {notice && <p role="status">{bg ? "Организацията е запазена." : "Organization saved."}</p>}
      <div className={styles.actions}>
        {canWrite && <button className={admin.primary} disabled={!task.ready || task.pending || !!task.recovered || !dirty}>{task.pending ? (bg ? "Запазване…" : "Saving…") : (bg ? "Запази организацията" : "Save organization")}</button>}
        {dirty && !task.recovered && <button type="button" className={admin.secondary} disabled={task.pending} onClick={() => { setTags(saved.tags.join(", ")); setIncluded(saved.collectionIds); setNotice(false); }}>{bg ? "Отмени промените" : "Discard changes"}</button>}
        <Link className={admin.secondary} href={`/app/sellers/${sellerId}/collections?lang=${language}`}>{bg ? "Управлявай колекции" : "Manage collections"}</Link>
        {task.error === "CONFLICT" && !task.recovered && <button type="button" className={admin.secondary} disabled={task.pending} onClick={() => {
          if (!dirty || window.confirm(bg ? "Да се зареди ли запазената версия вместо незапазените промени?" : "Load the saved version and discard unsaved organization changes?")) void refresh();
        }}>{bg ? "Зареди запазеното" : "Load saved version"}</button>}
      </div>
    </form>
  </section>;
}
