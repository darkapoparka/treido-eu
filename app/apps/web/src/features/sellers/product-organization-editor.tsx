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
  sellerId: string; actorSubject: string; bufferKey: string; language: "bg" | "en"; canWrite: boolean; initial: ProductOrganization; collections: CollectionOptions;
}) {
  const bg = language === "bg", task = useCatalogMutation(actorSubject, sellerId, bufferKey);
  const [saved, setSaved] = useState(initial), [tags, setTags] = useState(initial.tags.join(", "));
  const [included, setIncluded] = useState(initial.collectionIds), [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false), [readFailed, setReadFailed] = useState(false);
  const dirty = tags !== saved.tags.join(", ") || [...included].sort().join() !== [...saved.collectionIds].sort().join();
  const busy = task.pending || loading;
  useUnsavedChanges(dirty && !task.denied, language);
  async function refresh(confirmedSave = false) {
    const ticket = task.capture();
    if (!ticket) return;
    setLoading(true); setReadFailed(false);
    try {
      const result = await productOrganizationAction(sellerId, initial.listingId);
      if (!task.current(ticket)) return;
      if (!result.ok) {
        setReadFailed(true);
        if (result.code === "FORBIDDEN" || result.code === "UNAUTHENTICATED") task.report(result.code);
        return;
      }
      setSaved(result.data); setTags(result.data.tags.join(", ")); setIncluded(result.data.collectionIds);
      setNotice(confirmedSave ? (bg ? "Организацията е запазена." : "Organization saved.") : (bg ? "Заредена е запазената версия." : "Saved version loaded."));
    } catch { if (task.current(ticket)) setReadFailed(true); }
    finally { if (task.current(ticket)) setLoading(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || busy || readFailed) return;
    const normalized = normalizeCatalogTags(tags.split(",").map((tag) => tag.trim()).filter(Boolean));
    if (!normalized) { task.report("INVALID_INPUT"); return; }
    const result = await task.run({ kind: "organizeProducts", products: [{ listingId: saved.listingId, expectedRevision: saved.revision }], tagsMode: "replace", tags: normalized,
      addCollections: included.filter((id) => !saved.collectionIds.includes(id)), removeCollections: saved.collectionIds.filter((id) => !included.includes(id)) });
    if (result) await refresh(true);
  }
  if (task.denied) return <p role="alert">{bg ? "Нямаш текущ достъп до организацията на този продукт." : "You no longer have access to this product's organization."}</p>;
  return <section className={editor.panel} aria-labelledby="product-organization-heading" id="organization">
    <h2 id="product-organization-heading">{bg ? "Организация" : "Organization"}</h2>
    <form className={styles.form} onSubmit={submit}>
      <fieldset className={styles.fields} disabled={!canWrite || !task.ready || busy || !!task.recovered || readFailed}>
        <label className={editor.field}><span>{bg ? "Етикети" : "Tags"}</span><input value={tags} maxLength={840} onChange={(event) => { setTags(event.target.value); setNotice(""); }} /><small>{bg ? "Разделяй етикетите със запетая. До 20 етикета, всеки до 40 знака." : "Separate tags with commas. Up to 20 tags, each up to 40 characters."}</small></label>
        <CatalogCollectionPicker sellerId={sellerId} initial={collections} selected={included} onChange={(ids) => { setIncluded(ids); setNotice(""); }} language={language} task={task} label={bg ? "Колекции" : "Collections"} />
      </fieldset>
      <CatalogFeedback task={task} language={language} onRecovered={() => refresh(true)} />
      {notice && <p role="status">{notice}</p>}
      {readFailed && <p role="alert">{bg ? "Запазената организация не може да бъде обновена. Зареди я преди следващата промяна." : "The saved organization could not be refreshed. Load it before the next change."}</p>}
      <div className={styles.actions}>
        {canWrite && <button className={admin.primary} disabled={!task.ready || busy || !!task.recovered || !dirty || readFailed}>{busy ? (bg ? "Запазване…" : "Saving…") : (bg ? "Запази организацията" : "Save organization")}</button>}
        {dirty && !task.recovered && <button type="button" className={admin.secondary} disabled={busy} onClick={() => { setTags(saved.tags.join(", ")); setIncluded(saved.collectionIds); setNotice(""); }}>{bg ? "Отмени промените" : "Discard changes"}</button>}
        <Link className={admin.secondary} href={`/app/sellers/${sellerId}/collections?lang=${language}`}>{bg ? "Управлявай колекции" : "Manage collections"}</Link>
        {(task.error === "CONFLICT" || readFailed) && !task.recovered && <button type="button" className={admin.secondary} disabled={busy} onClick={() => {
          if (!dirty || window.confirm(bg ? "Да се зареди ли запазената версия вместо незапазените промени?" : "Load the saved version and discard unsaved organization changes?")) void refresh();
        }}>{bg ? "Зареди запазеното" : "Load saved version"}</button>}
      </div>
    </form>
  </section>;
}
