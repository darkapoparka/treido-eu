"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { AdminIcon } from "./admin-icons";
import { CatalogFeedback, useCatalogMutation } from "./catalog-client";
import type { CatalogAcknowledgement } from "./catalog-organization-model";
import type { CollectionOptions } from "./catalog-collection-picker";
import { useUnsavedChanges } from "./use-unsaved-changes";
import admin from "./admin.module.css";
import editor from "./admin-editor.module.css";
import styles from "./catalog-workspace.module.css";

export function CatalogCollections({ sellerId, actorSubject, bufferKey, language, canWrite, initial, q = "", after }: {
  sellerId: string;
  actorSubject: string;
  bufferKey: string;
  language: "bg" | "en";
  canWrite: boolean;
  initial: CollectionOptions;
  q?: string;
  after?: string;
}) {
  const bg = language === "bg";
  const router = useRouter();
  const base = `/app/sellers/${sellerId}`;
  const task = useCatalogMutation(actorSubject, sellerId, bufferKey);
  const dialog = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visible, setVisible] = useState(false);
  useUnsavedChanges(!!(title || description || visible) && !task.denied, language);
  function completed(result: CatalogAcknowledgement) {
    if (result.collectionId) {
      setTitle(""); setDescription(""); setVisible(false);
      dialog.current?.close();
      router.push(`${base}/collections/${result.collectionId}?lang=${language}`);
    }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite) return;
    const result = await task.run({ kind: "createCollection", title, description, visible });
    if (result) completed(result);
  }
  if (task.denied) return <p role="alert">{bg ? "Влез отново и избери достъпен акаунт." : "Sign in again and choose an available seller account."}</p>;
  const next = new URLSearchParams({ lang: language, q });
  if (initial.nextCursor) next.set("after", initial.nextCursor);
  return <main>
    <header className={admin.pageBar}>
      <h1><AdminIcon name="product" />{bg ? "Колекции" : "Collections"}</h1>
      <div className={styles.actions}>
        <Link className={admin.secondary} href={`${base}/catalog?lang=${language}`}>{bg ? "Организирай продукти" : "Organize products"}</Link>
        {canWrite && <button type="button" className={admin.primary} onClick={() => dialog.current?.showModal()}>{bg ? "Създай колекция" : "Create collection"}</button>}
      </div>
    </header>
    <div className={admin.pageBody}>
      <div className={styles.stack}>
        <div className={styles.actions}>
          <Link className={admin.secondary} href={`${base}/listings?lang=${language}`}>{bg ? "Всички продукти" : "All products"}</Link>
          <Link className={admin.secondary} href={`${base}/settings/store/preview?lang=${language}`}>{bg ? "Преглед на магазина" : "Preview store"}</Link>
        </div>
        <CatalogFeedback task={task} language={language} onRecovered={completed} />
        <section className={admin.productPanel} aria-label={bg ? "Колекции на продавача" : "Seller collections"}>
          <div className={admin.productToolbar}>
            <form action={`${base}/collections`} className={admin.filterForm}>
              <input type="hidden" name="lang" value={language} />
              <input key={q} type="search" name="q" maxLength={160} defaultValue={q} aria-label={bg ? "Търси колекции" : "Search collections"} placeholder={bg ? "Търси колекции" : "Search collections"} />
              <button className={admin.secondary}>{bg ? "Търси" : "Search"}</button>
            </form>
          </div>
          {initial.items.length ? <table className={`${admin.productTable} ${styles.table}`}>
            <thead><tr><th scope="col">{bg ? "Колекция" : "Collection"}</th><th scope="col">{bg ? "Продукти" : "Products"}</th></tr></thead>
            <tbody>{initial.items.map((collection) => <tr key={collection.id}>
              <td><Link href={`${base}/collections/${collection.id}?lang=${language}`}>{collection.title}</Link><small>{collection.visible ? (bg ? "Показва се в магазина" : "Shown in store") : (bg ? "Само за управление" : "Catalog only")}</small></td>
              <td>{collection.productCount}</td>
            </tr>)}</tbody>
          </table> : <div className={admin.empty}><div>
            <h2>{q ? (bg ? "Няма съвпадащи колекции" : "No matching collections") : (bg ? "Подреди продуктите си" : "Organize your products")}</h2>
            <p>{bg ? "Създай колекция, добави свои продукти и я използвай в каталога или магазина си." : "Create a collection, add your products, and use it in your catalog or storefront."}</p>
            {canWrite && !q && <button type="button" className={admin.primary} onClick={() => dialog.current?.showModal()}>{bg ? "Създай колекция" : "Create collection"}</button>}
          </div></div>}
          <div className={admin.pagination}>
            {after && <Link className={admin.secondary} href={`${base}/collections?${new URLSearchParams({ lang: language, q })}`}>{bg ? "Първа страница" : "First page"}</Link>}
            {initial.nextCursor && <Link className={admin.secondary} href={`${base}/collections?${next}`}>{bg ? "Следваща страница" : "Next page"}</Link>}
          </div>
        </section>
      </div>
    </div>
    {canWrite && <dialog ref={dialog} className={`${admin.productPanel} ${styles.dialog}`} aria-labelledby="create-collection-heading" onCancel={(event) => { if (task.pending) event.preventDefault(); }}>
      <section className={editor.panel}>
        <h2 id="create-collection-heading">{bg ? "Създай колекция" : "Create collection"}</h2>
        <form className={styles.form} onSubmit={create}>
          <fieldset disabled={!task.ready || task.pending || !!task.recovered} className={styles.fields}>
            <label className={editor.field}><span>{bg ? "Заглавие" : "Title"}</span><input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <label className={editor.field}><span>{bg ? "Описание" : "Description"}</span><textarea maxLength={2000} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
            <label className={styles.choice}><input type="checkbox" checked={visible} onChange={(event) => setVisible(event.target.checked)} /><span>{bg ? "Показвай в магазина" : "Show in storefront"}</span></label>
            <small>{bg ? "В магазина се виждат само текущо публикувани и достъпни продукти." : "Only currently published, eligible products are shown in the storefront."}</small>
          </fieldset>
          <CatalogFeedback task={task} language={language} onRecovered={completed} />
          <div className={styles.actions}>
            <button className={admin.primary} disabled={!task.ready || task.pending || !!task.recovered}>{task.pending ? (bg ? "Запазване…" : "Saving…") : (bg ? "Създай колекция" : "Create collection")}</button>
            <button type="button" className={admin.secondary} disabled={task.pending} onClick={() => dialog.current?.close()}>{bg ? "Затвори" : "Close"}</button>
          </div>
        </form>
      </section>
    </dialog>}
  </main>;
}
