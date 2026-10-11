"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AdminIcon } from "./admin-icons";
import { CatalogBulkOrganization } from "./catalog-bulk-organization";
import { CatalogProductSelector, type CatalogProductPage } from "./catalog-product-selector";
import type { CollectionOptions } from "./catalog-collection-picker";
import { CATALOG_BATCH_SIZE, type CatalogProduct } from "./catalog-organization-model";
import admin from "./admin.module.css";
import styles from "./catalog-workspace.module.css";

export function CatalogProducts({ sellerId, actorSubject, bufferKey, language, canWrite, canImport, initial, collections, q = "", after }: {
  sellerId: string; actorSubject: string; bufferKey: string; language: "bg" | "en";
  canWrite: boolean; canImport: boolean; initial: CatalogProductPage; collections: CollectionOptions; q?: string; after?: string;
}) {
  const bg = language === "bg";
  const router = useRouter();
  const [loading, navigate] = useTransition();
  const [selection, setSelection] = useState<Record<string, CatalogProduct>>({});
  const [limit, setLimit] = useState(false);
  const selected = Object.values(selection);
  const base = `/app/sellers/${sellerId}`;
  function select(products: CatalogProduct[], included: boolean) {
    const eligible = products.filter((product) => product.publication !== "restricted");
    const next = { ...selection };
    for (const product of eligible) {
      if (included) next[product.id] = product;
      else delete next[product.id];
    }
    if (Object.keys(next).length > CATALOG_BATCH_SIZE) { setLimit(true); return; }
    setLimit(false); setSelection(next);
  }
  function go(query: string, cursor?: string) {
    const search = new URLSearchParams({ lang: language });
    if (query) search.set("q", query);
    if (cursor) search.set("after", cursor);
    navigate(() => router.push(`${base}/catalog?${search}`));
  }
  return <main>
    <header className={admin.pageBar}>
      <h1><AdminIcon name="product" />{bg ? "Организация на каталога" : "Catalog organization"}</h1>
      <div className={styles.actions}>
        <Link className={admin.secondary} href={`${base}/collections?lang=${language}`}>{bg ? "Колекции" : "Collections"}</Link>
        {canWrite && <Link className={admin.primary} href={`${base}/listings/new?lang=${language}`}>{bg ? "Добави продукт" : "Add product"}</Link>}
      </div>
    </header>
    <div className={admin.pageBody}><div className={styles.stack}>
      <nav className={styles.actions} aria-label={bg ? "Управление на каталога" : "Catalog management"}>
        <Link className={admin.secondary} href={`${base}/listings?lang=${language}`}>{bg ? "Продукти и публикуване" : "Products and publication"}</Link>
        <Link className={admin.secondary} href={`${base}/inventory?lang=${language}`}>{bg ? "Наличности" : "Inventory"}</Link>
        {canImport && <Link className={admin.secondary} href={`${base}/imports?lang=${language}`}>{bg ? "Импорт на продукти" : "Import products"}</Link>}
      </nav>
      <div className={styles.actions}>
        <span role="status">{bg ? `Избрани: ${selected.length}` : `${selected.length} selected`}</span>
        <CatalogBulkOrganization sellerId={sellerId} actorSubject={actorSubject} bufferKey={bufferKey} selected={selected} collections={collections} language={language} canWrite={canWrite} onComplete={() => { setSelection({}); router.refresh(); }} />
        {selected.length > 0 && <>
          <Link className={admin.secondary} href={`${base}/catalog/edit?${new URLSearchParams({ lang: language, ids: selected.map((item) => item.id).join(",") })}`}>{bg ? "Редактирай избраните" : "Edit selected"}</Link>
          <button type="button" className={admin.secondary} disabled={loading} onClick={() => { setSelection({}); setLimit(false); }}>{bg ? "Изчисти избора" : "Clear selection"}</button>
        </>}
      </div>
      {limit && <p role="alert">{bg ? `Запази текущата група преди да избереш още продукти. Едно групово действие обработва до ${CATALOG_BATCH_SIZE} продукта.` : `Save this batch before selecting more products. A bulk action processes up to ${CATALOG_BATCH_SIZE} products.`}</p>}
      <CatalogProductSelector sellerId={sellerId} language={language} data={initial} query={q} loading={loading} canWrite={canWrite} checked={(product) => !!selection[product.id]} onToggle={(product, included) => select([product], included)} onPageSelection={(included) => select(initial.items, included)} onSearch={(query) => go(query)} onNext={() => go(q, initial.nextCursor ?? undefined)} />
      {after && <div className={styles.actions}><button type="button" className={admin.secondary} disabled={loading} onClick={() => go(q)}>{bg ? "Първа страница" : "First page"}</button></div>}
    </div></div>
  </main>;
}
