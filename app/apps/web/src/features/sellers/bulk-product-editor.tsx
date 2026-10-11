"use client";

import Link from "next/link";
import { useAuth, useClerk } from "@clerk/nextjs";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { editBulkProductsAction, readBulkProductsAction } from "./bulk-product-edit-actions";
import { parseBulkProductEdits, type BulkProductEditCommand, type BulkProductEditOutcome, type BulkProductRow } from "./bulk-product-edit-model";
import { registerPrivateBuffer, clearPrivateBuffers } from "./private-recovery";
import { parseEuroPrice } from "../selling/draft-model";
import { useUnsavedChanges } from "./use-unsaved-changes";
import admin from "./admin.module.css";
import editor from "./admin-editor.module.css";
import styles from "./catalog-workspace.module.css";

function subscribe(listener: () => void) {
  window.addEventListener("storage", listener); window.addEventListener("treido-draft-buffer-changed", listener);
  return () => { window.removeEventListener("storage", listener); window.removeEventListener("treido-draft-buffer-changed", listener); };
}
function stored(key: string): string | null { try { const raw = localStorage.getItem(key); return raw && raw.length <= 32768 ? raw : null; } catch { return null; } }
function recovery(raw: string | null, sellerId: string) { try { const parsed = raw ? parseBulkProductEdits(JSON.parse(raw)) : null; return parsed?.sellerId === sellerId ? parsed : null; } catch { return null; } }
const fields = (row: BulkProductRow) => ({ title: row.title, price: row.priceMinor === null ? "" : (row.priceMinor / 100).toFixed(2) });
export function BulkProductEditor({ sellerId, actorSubject, bufferKey, language, canWrite, initial }: {
  sellerId: string; actorSubject: string; bufferKey: string; language: "bg" | "en"; canWrite: boolean; initial: BulkProductRow[];
}) {
  const bg = language === "bg";
  const clerk = useClerk();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const [rows, setRows] = useState(initial);
  const [values, setValues] = useState(() => Object.fromEntries(initial.map((row) => [row.id, fields(row)])));
  const [outcomes, setOutcomes] = useState<BulkProductEditOutcome[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [inMemory, setInMemory] = useState<BulkProductEditCommand | null>(null);
  const [denied, setDenied] = useState(false);
  const mounted = useRef(false), busy = useRef(false);
  const key = `treido-draft:${bufferKey}`;
  const raw = useSyncExternalStore(subscribe, () => stored(key), () => null);
  const unconfirmed = recovery(raw, sellerId) ?? inMemory;
  const changedActor = isLoaded && (!isSignedIn || userId !== actorSubject || clerk.user?.id !== actorSubject);
  const ready = isLoaded && isSignedIn && !changedActor && !denied && clerk.session?.status === "active";
  const editable = (row: BulkProductRow) => canWrite && row.moderation === "clear" && (row.publication === "draft" || row.publication === "withdrawn");
  const changed = rows.filter((row) => editable(row) && (values[row.id].title !== row.title || values[row.id].price !== fields(row).price));
  useUnsavedChanges(!!changed.length && !changedActor && !denied, language);
  useEffect(() => { mounted.current = true; registerPrivateBuffer(actorSubject, key, sellerId); return () => { mounted.current = false; }; }, [actorSubject, key, sellerId]);
  useEffect(() => { if (changedActor || denied) clearPrivateBuffers(actorSubject, sellerId); }, [changedActor, denied, actorSubject, sellerId]);
  function persist(command: BulkProductEditCommand | null) {
    setInMemory(command);
    try { if (command) localStorage.setItem(key, JSON.stringify(command)); else localStorage.removeItem(key); window.dispatchEvent(new Event("treido-draft-buffer-changed")); } catch { /* Server acknowledgement remains the only persisted success. */ }
  }
  async function send(command: BulkProductEditCommand) {
    if (!ready || busy.current) return;
    const session = clerk.session?.id, route = location.pathname + location.search;
    const current = () => mounted.current && clerk.user?.id === actorSubject && clerk.session?.id === session && clerk.session?.status === "active" && location.pathname + location.search === route;
    busy.current = true; setPending(true); setError(""); persist(command);
    try {
      const result = await editBulkProductsAction(command);
      if (!current()) return;
      if (!result.ok) {
        if (result.code !== "NOT_AVAILABLE") persist(null);
        if (["FORBIDDEN", "UNAUTHENTICATED"].includes(result.code)) setDenied(true);
        setError(result.code === "NOT_AVAILABLE" ? (bg ? "Резултатът не е потвърден. Повтори същото запазване." : "The result was not confirmed. Retry the same save.") : (bg ? "Не успяхме да запазим продуктите. Презареди текущите версии." : "Products could not be saved. Reload their current versions."));
        return;
      }
      setOutcomes(result.data);
      const uncertainIds = new Set(result.data.filter((item) => !item.result.ok && item.result.code === "NOT_AVAILABLE").map((item) => item.listingId));
      const uncertain = command.items.filter((item) => uncertainIds.has(item.listingId));
      persist(uncertain.length ? { sellerId, items: uncertain } : null);
      setRows((currentRows) => currentRows.map((row) => {
        const outcome = result.data.find((item) => item.listingId === row.id)?.result;
        return outcome?.ok ? { ...row, revision: outcome.revision, title: outcome.title, priceMinor: outcome.priceMinor } : row;
      }));
      setValues((currentValues) => {
        const next = { ...currentValues };
        for (const item of result.data) if (item.result.ok) next[item.listingId] = { title: item.result.title, price: item.result.priceMinor === null ? "" : (item.result.priceMinor / 100).toFixed(2) };
        return next;
      });
      if (result.data.some((item) => !item.result.ok && item.result.code === "UNAUTHENTICATED")) setDenied(true);
    } catch { if (current()) setError(bg ? "Запазването не е потвърдено. Повтори същата заявка." : "The save was not confirmed. Retry the same request."); }
    finally { busy.current = false; if (current()) setPending(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!changed.length || unconfirmed) return;
    const items = changed.map((row) => ({ listingId: row.id, expectedRevision: row.revision, requestId: crypto.randomUUID(), title: values[row.id].title, priceMinor: parseEuroPrice(values[row.id].price) }));
    const command = parseBulkProductEdits({ sellerId, items });
    if (!command) { setError(bg ? "Провери заглавията и цените. Цената трябва да е положителна сума с до два знака след десетичния разделител." : "Check the titles and prices. Use a non-negative price with up to two decimal places."); return; }
    await send(command);
  }
  async function reload() {
    if (!ready || busy.current || unconfirmed) return;
    if (changed.length && !window.confirm(bg ? "Да се заредят ли запазените версии вместо незапазените промени?" : "Load saved versions and discard unsaved changes?")) return;
    const session = clerk.session?.id, route = location.pathname + location.search;
    const current = () => mounted.current && clerk.user?.id === actorSubject && clerk.session?.id === session && location.pathname + location.search === route;
    busy.current = true; setPending(true);
    try {
      const result = await readBulkProductsAction(sellerId, initial.map((row) => row.id).join(","));
      if (!current()) return;
      if (!result.ok) { setError(bg ? "Продуктите не могат да бъдат обновени. Опитай отново." : "Products could not be refreshed. Try again."); return; }
      setRows(result.data); setValues(Object.fromEntries(result.data.map((row) => [row.id, fields(row)]))); setOutcomes([]); setError("");
    } catch { if (current()) setError(bg ? "Презареждането не успя. Опитай отново." : "Reload failed. Try again."); }
    finally { busy.current = false; if (current()) setPending(false); }
  }
  if (changedActor || denied) return <p role="alert">{bg ? "Влез отново и избери достъпен акаунт." : "Sign in again and choose an available seller account."}</p>;
  return <main>
    <header className={admin.pageBar}><h1>{bg ? "Групова редакция" : "Bulk edit products"}</h1><Link className={admin.secondary} href={`/app/sellers/${sellerId}/catalog?lang=${language}`}>{bg ? "Към каталога" : "Back to catalog"}</Link></header>
    <div className={admin.pageBody}><section className={editor.panel}>
      <p>{bg ? "Редактирай заглавия и основни цени на чернови и оттеглени продукти. За публикувани продукти първо използвай прегледа и оттеглянето. Цените на вариантите се управляват от Наличности." : "Edit titles and base prices on drafts and withdrawn products. Published products must be reviewed and withdrawn first. Variant prices are managed in Inventory."}</p>
      {error && <p role="alert">{error}</p>}
      {unconfirmed && <div className={styles.actions}><p>{bg ? "Има непотвърдено запазване. Потвърди го преди нова промяна." : "A save is awaiting confirmation. Confirm it before making another change."}</p><button type="button" className={admin.secondary} disabled={!ready || pending} onClick={() => void send(unconfirmed)}>{bg ? "Потвърди запазването" : "Retry confirmation"}</button></div>}
      {outcomes.length > 0 && <div role="status"><p>{bg ? `Запазени: ${outcomes.filter((item) => item.result.ok).length} от ${outcomes.length}.` : `Saved ${outcomes.filter((item) => item.result.ok).length} of ${outcomes.length} products.`}</p>
        {outcomes.filter((item) => !item.result.ok).map((item) => <p key={item.listingId}><Link href={`/app/sellers/${sellerId}/listings/${item.listingId}/edit?lang=${language}`}>{rows.find((row) => row.id === item.listingId)?.title || (bg ? "Продукт" : "Product")}</Link>{": "}{!item.result.ok && (item.result.code === "CONFLICT" ? (bg ? "Има по-нова версия. Презареди я." : "A newer version exists. Reload it.") : item.result.code === "FORBIDDEN" ? (bg ? "Продуктът не може да бъде редактиран в текущото си състояние." : "This product cannot be edited in its current state.") : item.result.code === "NOT_AVAILABLE" ? (bg ? "Резултатът не е потвърден. Повтори запазването." : "The result is unconfirmed. Retry the save.") : (bg ? "Не е запазен. Провери продукта." : "Not saved. Review this product."))}</p>)}
      </div>}
      <form className={styles.form} onSubmit={submit}>
        <fieldset disabled={!ready || pending || !!unconfirmed} className={styles.fields}>
          {rows.map((row) => <section key={row.id} className={editor.panel}>
            <div className={styles.heading}><h2><Link href={`/app/sellers/${sellerId}/listings/${row.id}/edit?lang=${language}`}>{row.title || (bg ? "Продукт без заглавие" : "Untitled product")}</Link></h2>{!editable(row) && <span className={admin.badge}>{row.publication === "published" ? (bg ? "Публикуван" : "Published") : (bg ? "Само за преглед" : "Read only")}</span>}</div>
            <div className={styles.columns}>
              <label className={editor.field}><span>{bg ? "Заглавие" : "Title"}</span><input aria-label={`${bg ? "Заглавие" : "Title"}: ${row.title}`} disabled={!editable(row)} maxLength={160} value={values[row.id].title} onChange={(event) => setValues((current) => ({ ...current, [row.id]: { ...current[row.id], title: event.target.value } }))} /></label>
              <label className={editor.field}><span>{bg ? "Основна цена (EUR)" : "Base price (EUR)"}</span><input aria-label={`${bg ? "Цена" : "Price"}: ${row.title}`} disabled={!editable(row)} inputMode="decimal" maxLength={12} value={values[row.id].price} onChange={(event) => setValues((current) => ({ ...current, [row.id]: { ...current[row.id], price: event.target.value } }))} /></label>
            </div>
          </section>)}
        </fieldset>
        <div className={styles.actions}>
          <button className={admin.primary} disabled={!ready || pending || !!unconfirmed || !changed.length}>{pending ? (bg ? "Запазване…" : "Saving…") : (bg ? `Запази промените (${changed.length})` : `Save changes (${changed.length})`)}</button>
          <button type="button" className={admin.secondary} disabled={!ready || pending || !!unconfirmed} onClick={() => void reload()}>{bg ? "Презареди запазените версии" : "Reload saved versions"}</button>
        </div>
      </form>
    </section></div>
  </main>;
}
