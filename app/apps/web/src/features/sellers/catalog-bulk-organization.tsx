"use client";

import { useRef, useState, type FormEvent } from "react";
import { CatalogCollectionPicker, type CollectionOptions } from "./catalog-collection-picker";
import { CatalogFeedback, useCatalogMutation } from "./catalog-client";
import { normalizeCatalogTags, type CatalogAcknowledgement, type CatalogProduct, type CatalogTagsMode } from "./catalog-organization-model";
import { useUnsavedChanges } from "./use-unsaved-changes";
import admin from "./admin.module.css";
import editor from "./admin-editor.module.css";
import styles from "./catalog-workspace.module.css";

export function CatalogBulkOrganization({ sellerId, actorSubject, bufferKey, selected, collections, language, canWrite, onComplete }: {
  sellerId: string;
  actorSubject: string;
  bufferKey: string;
  selected: CatalogProduct[];
  collections: CollectionOptions;
  language: "bg" | "en";
  canWrite: boolean;
  onComplete: () => void | Promise<void>;
}) {
  const bg = language === "bg";
  const task = useCatalogMutation(actorSubject, sellerId, bufferKey);
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CatalogTagsMode>("keep");
  const [tags, setTags] = useState("");
  const [add, setAdd] = useState<string[]>([]);
  const [remove, setRemove] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const dirty = mode !== "keep" || !!add.length || !!remove.length;
  useUnsavedChanges(open && dirty && !task.denied, language);
  function reset() { setMode("keep"); setTags(""); setAdd([]); setRemove([]); }
  function close() {
    if (task.pending) return;
    dialog.current?.close(); setOpen(false);
    if (!task.recovered) reset();
  }
  async function completed(result: CatalogAcknowledgement) {
    reset(); dialog.current?.close(); setOpen(false);
    setNotice(bg ? `Организацията е запазена за ${result.listingIds?.length ?? 0} продукта.` : `Organization saved for ${result.listingIds?.length ?? 0} products.`);
    await onComplete();
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || !selected.length) return;
    const normalized = normalizeCatalogTags(tags.split(",").map((tag) => tag.trim()).filter(Boolean));
    if (!normalized) { task.report("INVALID_INPUT"); return; }
    const result = await task.run({
      kind: "organizeProducts", products: selected.map((product) => ({ listingId: product.id, expectedRevision: product.organizationRevision })),
      tagsMode: mode, tags: normalized, addCollections: add, removeCollections: remove,
    });
    if (result) await completed(result);
  }
  if (!canWrite) return null;
  if (task.denied) return <p role="alert">{bg ? "Действието вече не е достъпно. Презареди каталога." : "This action is no longer available. Reload the catalog."}</p>;
  return <>
    <button type="button" className={admin.secondary} disabled={!task.ready || (!selected.length && !task.recovered)} onClick={() => { setNotice(null); setOpen(true); dialog.current?.showModal(); }}>
      {task.recovered ? (bg ? "Потвърди предишното запазване" : "Confirm previous save") : (bg ? "Етикети и колекции" : "Tags and collections")}
    </button>
    {notice && <p role="status">{notice}</p>}
    {!open && <CatalogFeedback task={task} language={language} onRecovered={completed} />}
    <dialog ref={dialog} className={`${admin.productPanel} ${styles.dialog}`} aria-labelledby="bulk-organization-heading" onCancel={(event) => { event.preventDefault(); close(); }} onClose={() => setOpen(false)}>
      <section className={editor.panel}>
        <h2 id="bulk-organization-heading">{bg ? "Организирай избраните продукти" : "Organize selected products"}</h2>
        <p>{bg ? `${selected.length} избрани продукта. Останалите етикети и колекции не се променят, освен при изрична замяна или премахване.` : `${selected.length} selected products. Other tags and collections stay unchanged unless you explicitly replace or remove them.`}</p>
        <form className={styles.form} onSubmit={submit}>
          <fieldset className={styles.fields} disabled={!task.ready || task.pending || !!task.recovered || !selected.length}>
            <label className={editor.field}><span>{bg ? "Промяна на етикетите" : "Tag action"}</span>
              <select value={mode} onChange={(event) => { setMode(event.target.value as CatalogTagsMode); if (event.target.value === "keep") setTags(""); }}>
                <option value="keep">{bg ? "Без промяна" : "Keep existing tags"}</option>
                <option value="add">{bg ? "Добави етикети" : "Add tags"}</option>
                <option value="remove">{bg ? "Премахни етикети" : "Remove tags"}</option>
                <option value="replace">{bg ? "Замени всички етикети" : "Replace all tags"}</option>
              </select>
            </label>
            {mode !== "keep" && <label className={editor.field}><span>{bg ? "Етикети, разделени със запетая" : "Tags, separated by commas"}</span><input maxLength={840} value={tags} onChange={(event) => setTags(event.target.value)} />
              {mode === "replace" && <small>{bg ? "Това заменя всички текущи етикети на избраните продукти. Празното поле ги премахва." : "This replaces all tags on the selected products. An empty field removes them."}</small>}
            </label>}
            <div className={styles.columns}>
              <CatalogCollectionPicker sellerId={sellerId} initial={collections} selected={add} onChange={(ids) => { setAdd(ids); setRemove((current) => current.filter((id) => !ids.includes(id))); }} language={language} task={task} label={bg ? "Добави към колекции" : "Add to collections"} />
              <CatalogCollectionPicker sellerId={sellerId} initial={collections} selected={remove} onChange={(ids) => { setRemove(ids); setAdd((current) => current.filter((id) => !ids.includes(id))); }} language={language} task={task} label={bg ? "Премахни от колекции" : "Remove from collections"} />
            </div>
          </fieldset>
          <CatalogFeedback task={task} language={language} onRecovered={completed} />
          <div className={styles.actions}>
            <button className={admin.primary} disabled={!task.ready || task.pending || !!task.recovered || !dirty || !selected.length}>{task.pending ? (bg ? "Запазване…" : "Saving…") : (bg ? "Запази избраните" : "Save selected products")}</button>
            <button type="button" className={admin.secondary} disabled={task.pending} onClick={close}>{bg ? "Затвори" : "Close"}</button>
          </div>
        </form>
      </section>
    </dialog>
  </>;
}
