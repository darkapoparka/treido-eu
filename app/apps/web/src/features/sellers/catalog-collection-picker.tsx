"use client";

import { useState } from "react";
import { catalogCollectionsAction } from "./catalog-organization-actions";
import type { CatalogCollection } from "./catalog-organization-model";
import type { useCatalogMutation } from "./catalog-client";
import admin from "./admin.module.css";
import editor from "./admin-editor.module.css";
import styles from "./catalog-workspace.module.css";

export type CollectionOptions = { items: CatalogCollection[]; nextCursor: string | null };
export function CatalogCollectionPicker({ sellerId, initial, selected, onChange, language, task, disabled = false, label }: {
  sellerId: string;
  initial: CollectionOptions;
  selected: string[];
  onChange: (ids: string[]) => void;
  language: "bg" | "en";
  task: ReturnType<typeof useCatalogMutation>;
  disabled?: boolean;
  label: string;
}) {
  const bg = language === "bg";
  const [data, setData] = useState(initial);
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  async function load(append = false) {
    const ticket = task.capture();
    if (!ticket || loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const query = append ? applied : q;
      const result = await catalogCollectionsAction(sellerId, { q: query, after: append ? data.nextCursor ?? undefined : undefined });
      if (!task.current(ticket)) return;
      if (!result.ok) {
        setFailed(true);
        if (result.code === "FORBIDDEN" || result.code === "UNAUTHENTICATED") task.report(result.code);
        return;
      }
      setApplied(query);
      setData(append ? { ...result.data, items: [...new Map([...data.items, ...result.data.items].map((item) => [item.id, item])).values()] } : result.data);
    } catch { if (task.current(ticket)) setFailed(true); }
    finally { if (task.current(ticket)) setLoading(false); }
  }
  return <fieldset className={styles.picker} disabled={disabled || !task.ready}>
    <legend>{label}</legend>
    <div className={styles.actions}>
      <label className={editor.field}>
        <span>{bg ? "Търси колекции" : "Find collections"}</span>
        <input type="search" maxLength={160} value={q} onChange={(event) => setQ(event.target.value)} onKeyDown={(event) => {
          if (event.key === "Enter") { event.preventDefault(); void load(); }
        }} />
      </label>
      <button type="button" className={admin.secondary} disabled={loading} onClick={() => void load()}>{bg ? "Търси" : "Search"}</button>
    </div>
    {failed && <p role="alert">{bg ? "Колекциите не могат да бъдат обновени. Опитай отново." : "Collections could not be refreshed. Try again."}</p>}
    <div className={styles.choices}>
      {data.items.map((collection) => <label key={collection.id} className={styles.choice}>
        <input type="checkbox" checked={selected.includes(collection.id)} onChange={(event) => onChange(event.target.checked ? [...new Set([...selected, collection.id])] : selected.filter((id) => id !== collection.id))} />
        <span>{collection.title}</span>
      </label>)}
    </div>
    {!data.items.length && !loading && <p>{bg ? "Няма съвпадащи колекции." : "No matching collections."}</p>}
    {data.nextCursor && <button type="button" className={admin.secondary} disabled={loading} onClick={() => void load(true)}>{bg ? "Още колекции" : "More collections"}</button>}
    <small aria-live="polite">{loading ? (bg ? "Зареждане…" : "Loading…") : (bg ? `Избрани колекции: ${selected.length}` : `${selected.length} collections selected`)}</small>
  </fieldset>;
}
