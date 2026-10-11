"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { catalogCollectionAction, catalogProductsAction } from "./catalog-organization-actions";
import { CatalogFeedback, useCatalogMutation } from "./catalog-client";
import { CatalogProductSelector, type CatalogProductPage } from "./catalog-product-selector";
import { CATALOG_BATCH_SIZE, type CatalogCollection, type CatalogProduct } from "./catalog-organization-model";
import { useUnsavedChanges } from "./use-unsaved-changes";
import admin from "./admin.module.css";
import editor from "./admin-editor.module.css";
import styles from "./catalog-workspace.module.css";
type MembershipChange = { product: CatalogProduct; included: boolean };
export function CatalogCollectionEditor({ sellerId, actorSubject, bufferKey, language, canWrite, initial, initialProducts }: {
  sellerId: string; actorSubject: string; bufferKey: string; language: "bg" | "en"; canWrite: boolean; initial: CatalogCollection; initialProducts: CatalogProductPage;
}) {
  const bg = language === "bg", router = useRouter(), task = useCatalogMutation(actorSubject, sellerId, bufferKey), base = `/app/sellers/${sellerId}`;
  const [saved, setSaved] = useState(initial), [title, setTitle] = useState(initial.title), [description, setDescription] = useState(initial.description);
  const [visible, setVisible] = useState(initial.visible), [products, setProducts] = useState(initialProducts), [q, setQ] = useState("");
  const [membersOnly, setMembersOnly] = useState(true), [after, setAfter] = useState<string | undefined>();
  const [changes, setChanges] = useState<Record<string, MembershipChange>>({}), [loading, setLoading] = useState(false), [notice, setNotice] = useState("");
  const [readFailed, setReadFailed] = useState(false), [limit, setLimit] = useState(false), archiveDialog = useRef<HTMLDialogElement>(null);
  const dirtyDetails = title !== saved.title || description !== saved.description || visible !== saved.visible;
  const dirtyMembership = Object.keys(changes).length > 0, busy = task.pending || loading;
  useUnsavedChanges((dirtyDetails || dirtyMembership) && !task.denied, language);
  async function browse(query: string, members: boolean, cursor?: string) {
    const ticket = task.capture(); if (!ticket || busy) return;
    setLoading(true); setReadFailed(false);
    try {
      const result = await catalogProductsAction(sellerId, { q: query, collectionId: saved.id, membersOnly: members, after: cursor });
      if (!task.current(ticket)) return;
      if (!result.ok) { setReadFailed(true); if (result.code === "FORBIDDEN" || result.code === "UNAUTHENTICATED") task.report(result.code); return; }
      setProducts(result.data); setQ(query); setMembersOnly(members); setAfter(cursor);
    } catch { if (task.current(ticket)) setReadFailed(true); }
    finally { if (task.current(ticket)) setLoading(false); }
  }
  async function refreshSaved(confirmedSave = false) {
    const ticket = task.capture(); if (!ticket) return;
    setLoading(true); setReadFailed(false);
    try {
      const [collection, page] = await Promise.all([catalogCollectionAction(sellerId, saved.id), catalogProductsAction(sellerId, { q, collectionId: saved.id, membersOnly })]);
      if (!task.current(ticket)) return;
      if (!collection.ok) { task.report(collection.code); setReadFailed(true); return; }
      setSaved(collection.data); setTitle(collection.data.title); setDescription(collection.data.description); setVisible(collection.data.visible); setChanges({}); setLimit(false);
      if (!page.ok) { setReadFailed(true); task.report(page.code); return; }
      setProducts(page.data); setAfter(undefined);
      setNotice(confirmedSave ? (bg ? "Колекцията е запазена." : "Collection saved.") : (bg ? "Заредена е запазената версия." : "Saved version loaded."));
      router.refresh();
    } catch { if (task.current(ticket)) setReadFailed(true); }
    finally { if (task.current(ticket)) setLoading(false); }
  }
  function reload() {
    if (!(dirtyDetails || dirtyMembership) || window.confirm(bg ? "Да се зареди ли запазената версия вместо незапазените промени?" : "Load the saved version and discard unsaved changes?")) void refreshSaved();
  }
  async function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!canWrite || dirtyMembership || busy || readFailed) return;
    setNotice("");
    const result = await task.run({ kind: "saveCollection", collectionId: saved.id, expectedRevision: saved.revision, title, description, visible });
    if (result) await refreshSaved(true);
  }
  function select(rows: CatalogProduct[], included: boolean) {
    if (dirtyDetails || busy || task.recovered) return;
    const next = { ...changes };
    for (const product of rows) {
      if (product.publication === "restricted" && !product.member) continue;
      if (included === product.member) delete next[product.id]; else next[product.id] = { product, included };
    }
    if (Object.keys(next).length > CATALOG_BATCH_SIZE) { setLimit(true); return; }
    setChanges(next); setLimit(false); setNotice("");
  }
  async function saveMembership() {
    if (!canWrite || dirtyDetails || !dirtyMembership || busy || readFailed) return;
    const selected = Object.values(changes);
    const result = await task.run({ kind: "collectionProducts", collectionId: saved.id, expectedRevision: saved.revision,
      add: selected.filter((item) => item.included).map((item) => item.product.id), remove: selected.filter((item) => !item.included).map((item) => item.product.id) });
    if (result) await refreshSaved(true);
  }
  function leaveArchived() {
    setChanges({}); setTitle(saved.title); setDescription(saved.description); setVisible(saved.visible);
    archiveDialog.current?.close(); router.push(`${base}/collections?lang=${language}`); router.refresh();
  }
  async function archive() {
    const result = await task.run({ kind: "archiveCollection", collectionId: saved.id, expectedRevision: saved.revision });
    if (result) leaveArchived();
  }
  const recoveredArchive = task.recovered?.kind === "archiveCollection";
  if (task.denied) return <p role="alert">{bg ? "Влез отново и избери достъпен акаунт." : "Sign in again and choose an available seller account."}</p>;
  return <main>
    <header className={admin.pageBar}><h1>{saved.title}</h1><Link className={admin.secondary} href={`${base}/collections?lang=${language}`}>{bg ? "Всички колекции" : "All collections"}</Link></header>
    <div className={admin.pageBody}><div className={styles.stack}>
      <CatalogFeedback task={task} language={language} onRecovered={recoveredArchive ? leaveArchived : () => refreshSaved(true)} />
      {notice && <p role="status">{notice}</p>}
      {readFailed && <div role="alert"><p>{bg ? "Запазеното състояние не може да бъде обновено. Презареди го преди следващата промяна." : "The saved state could not be refreshed. Reload it before the next change."}</p><button type="button" className={admin.secondary} disabled={busy || !!task.recovered} onClick={reload}>{bg ? "Зареди запазеното" : "Load saved version"}</button></div>}
      <section className={editor.panel}>
        <h2>{bg ? "Данни за колекцията" : "Collection details"}</h2>
        <form className={styles.form} onSubmit={saveDetails}>
          <fieldset className={styles.fields} disabled={!canWrite || !task.ready || busy || !!task.recovered || dirtyMembership || readFailed}>
            <label className={editor.field}><span>{bg ? "Заглавие" : "Title"}</span><input required maxLength={120} value={title} onChange={(event) => { setTitle(event.target.value); setNotice(""); }} /></label>
            <label className={editor.field}><span>{bg ? "Описание" : "Description"}</span><textarea rows={4} maxLength={2000} value={description} onChange={(event) => { setDescription(event.target.value); setNotice(""); }} /></label>
            <label className={styles.choice}><input type="checkbox" checked={visible} onChange={(event) => { setVisible(event.target.checked); setNotice(""); }} /><span>{bg ? "Показвай в магазина" : "Show in storefront"}</span></label>
            <small>{bg ? "Само текущо публикуваните и достъпни продукти се показват на купувачите." : "Only currently published, eligible products are shown to buyers."}</small>
          </fieldset>
          <div className={styles.actions}>
            {canWrite && <button className={admin.primary} disabled={!task.ready || busy || !!task.recovered || !dirtyDetails || dirtyMembership || readFailed}>{task.pending ? (bg ? "Запазване…" : "Saving…") : (bg ? "Запази колекцията" : "Save collection")}</button>}
            {dirtyDetails && <button type="button" className={admin.secondary} disabled={busy || !!task.recovered} onClick={() => { setTitle(saved.title); setDescription(saved.description); setVisible(saved.visible); }}>{bg ? "Отмени промените" : "Discard changes"}</button>}
            <Link className={admin.secondary} href={`${base}/collections/${saved.id}/preview?lang=${language}`}>{bg ? "Преглед на колекцията" : "Preview collection"}</Link>
          </div>
        </form>
      </section>
      <section className={styles.stack} aria-labelledby="collection-products-heading">
        <div className={styles.heading}><h2 id="collection-products-heading">{bg ? `Продукти (${saved.productCount})` : `Products (${saved.productCount})`}</h2>
          <div className={styles.actions}>
            <button type="button" className={admin.secondary} disabled={busy || membersOnly} onClick={() => void browse("", true)}>{bg ? "В колекцията" : "In this collection"}</button>
            <button type="button" className={admin.secondary} disabled={busy || !membersOnly} onClick={() => void browse("", false)}>{bg ? "Добави продукти" : "Add products"}</button>
          </div>
        </div>
        {dirtyDetails && <p>{bg ? "Запази или отмени данните за колекцията, преди да променяш продуктите." : "Save or discard collection details before changing its products."}</p>}
        <CatalogProductSelector key={`${q}/${membersOnly}`} sellerId={sellerId} language={language} data={products} query={q} loading={busy || !!task.recovered || readFailed} canWrite={canWrite && task.ready && !dirtyDetails} collectionMode checked={(product) => changes[product.id]?.included ?? product.member} onToggle={(product, included) => select([product], included)} onPageSelection={(included) => select(products.items, included)} onSearch={(query) => void browse(query, membersOnly)} onNext={() => void browse(q, membersOnly, products.nextCursor ?? undefined)} />
        {after && <div className={styles.actions}><button type="button" className={admin.secondary} disabled={busy} onClick={() => void browse(q, membersOnly)}>{bg ? "Първа страница" : "First page"}</button></div>}
        {limit && <p role="alert">{bg ? `Запази текущите промени преди следващата група от до ${CATALOG_BATCH_SIZE} продукта.` : `Save the current changes before the next batch of up to ${CATALOG_BATCH_SIZE} products.`}</p>}
        {dirtyMembership && <div className={styles.actions}>
          <span role="status">{bg ? `Променени продукти: ${Object.keys(changes).length}` : `${Object.keys(changes).length} product changes`}</span>
          <button type="button" className={admin.primary} disabled={busy || !!task.recovered || readFailed} onClick={() => void saveMembership()}>{bg ? "Запази продуктите" : "Save products"}</button>
          <button type="button" className={admin.secondary} disabled={busy || !!task.recovered} onClick={() => { setChanges({}); setLimit(false); }}>{bg ? "Отмени избора" : "Discard selection changes"}</button>
        </div>}
      </section>
      {task.error === "CONFLICT" && !task.recovered && <button type="button" className={admin.secondary} disabled={busy} onClick={reload}>{bg ? "Зареди запазеното" : "Load saved version"}</button>}
      {canWrite && <section className={editor.panel}><h2>{bg ? "Архивирай колекцията" : "Archive collection"}</h2><p>{bg ? "Колекцията се премахва от магазина и каталога. Продуктите и техните наличности не се променят." : "Remove this collection from the storefront and catalog. Its products and stock stay unchanged."}</p><button type="button" className={admin.secondary} disabled={busy || !!task.recovered || !task.ready || dirtyDetails || dirtyMembership} onClick={() => archiveDialog.current?.showModal()}>{bg ? "Архивирай колекцията" : "Archive collection"}</button></section>}
    </div></div>
    <dialog ref={archiveDialog} className={`${admin.productPanel} ${styles.dialog}`} aria-labelledby="archive-collection-heading" onCancel={(event) => { if (task.pending) event.preventDefault(); }}>
      <section className={editor.panel}><h2 id="archive-collection-heading">{bg ? "Да архивираме ли колекцията?" : "Archive this collection?"}</h2><p>{bg ? "Самите продукти няма да бъдат оттеглени или изтрити." : "The products themselves will not be withdrawn or deleted."}</p><CatalogFeedback task={task} language={language} onRecovered={leaveArchived} /><div className={styles.actions}><button type="button" className={admin.primary} disabled={task.pending || !!task.recovered} onClick={() => void archive()}>{bg ? "Архивирай" : "Archive"}</button><button type="button" className={admin.secondary} disabled={task.pending} onClick={() => archiveDialog.current?.close()}>{bg ? "Отказ" : "Cancel"}</button></div></section>
    </dialog>
  </main>;
}
