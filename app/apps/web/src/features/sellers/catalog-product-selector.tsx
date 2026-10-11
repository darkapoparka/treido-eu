"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AdminIcon } from "./admin-icons";
import { productStatusLabel, type AdminProduct } from "./admin-products-model";
import type { CatalogProduct } from "./catalog-organization-model";
import admin from "./admin.module.css";
import styles from "./catalog-workspace.module.css";

export type CatalogProductPage = { total: number; items: CatalogProduct[]; nextCursor: string | null };
function Photo({ sellerId, assetId }: { sellerId: string; assetId: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!assetId || failed) return <span className={admin.productThumb} aria-hidden="true"><AdminIcon name="product" /></span>;
  // The seller media endpoint reauthorizes the request; never send private media through an image cache.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={styles.photo} src={`/api/seller-media/${assetId}?sellerId=${sellerId}`} alt="" onError={() => setFailed(true)} />;
}
export function CatalogProductSelector({ sellerId, language, data, query, loading, canWrite, collectionMode = false, checked, onToggle, onPageSelection, onSearch, onNext }: {
  sellerId: string;
  language: "bg" | "en";
  data: CatalogProductPage;
  query: string;
  loading: boolean;
  canWrite: boolean;
  collectionMode?: boolean;
  checked: (product: CatalogProduct) => boolean;
  onToggle: (product: CatalogProduct, included: boolean) => void;
  onPageSelection: (included: boolean) => void;
  onSearch: (query: string) => void;
  onNext: () => void;
}) {
  const bg = language === "bg";
  const [q, setQ] = useState(query);
  const selectAll = useRef<HTMLInputElement>(null);
  const eligible = data.items.filter((product) => product.publication !== "restricted" || (collectionMode && product.member));
  const count = eligible.filter(checked).length;
  useEffect(() => { if (selectAll.current) selectAll.current.indeterminate = count > 0 && count < eligible.length; }, [count, eligible.length]);
  return <section className={admin.productPanel} aria-label={bg ? "Избор на продукти" : "Product selection"}>
    <div className={admin.productToolbar}>
      <form className={admin.filterForm} onSubmit={(event) => { event.preventDefault(); onSearch(q); }}>
        <input type="search" maxLength={160} value={q} onChange={(event) => setQ(event.target.value)} placeholder={bg ? "Заглавие, SKU или етикет" : "Title, SKU or tag"} aria-label={bg ? "Търси продукти" : "Search products"} />
        <button className={admin.secondary} disabled={loading}>{bg ? "Търси" : "Search"}</button>
      </form>
    </div>
    <table className={`${admin.productTable} ${styles.table}`}>
      <thead><tr><th scope="col"><div className={styles.product}>
        {canWrite && <label className={styles.selectionControl}><input ref={selectAll} type="checkbox" checked={eligible.length > 0 && count === eligible.length} disabled={loading || !eligible.length} aria-label={bg ? "Избери всички продукти на страницата" : "Select all products on this page"} onChange={(event) => onPageSelection(event.target.checked)} /></label>}
        {bg ? "Продукт" : "Product"}
      </div></th><th scope="col">{bg ? "Състояние" : "Status"}</th></tr></thead>
      <tbody>{data.items.map((product) => {
        const title = product.title || (bg ? "Продукт без заглавие" : "Untitled product");
        return <tr key={product.id}><td><div className={styles.product}>
          {canWrite && <label className={styles.selectionControl}><input type="checkbox" checked={checked(product)} disabled={loading || (product.publication === "restricted" && !(collectionMode && product.member))} aria-label={`${collectionMode ? (bg ? "Включи в колекцията" : "Include in collection") : (bg ? "Избери" : "Select")} ${title}`} onChange={(event) => onToggle(product, event.target.checked)} /></label>}
          <Photo key={product.mediaId ?? "none"} sellerId={sellerId} assetId={product.publication === "restricted" ? null : product.mediaId} />
          <div><Link href={`/app/sellers/${sellerId}/listings/${product.id}/edit?lang=${language}`}>{title}</Link>
            <small>{product.priceMinor === null ? (bg ? "Без цена" : "No price") : new Intl.NumberFormat(language, { style: "currency", currency: "EUR" }).format(product.priceMinor / 100)}</small>
            {product.tags.length > 0 && <div className={styles.tags}>{product.tags.slice(0, 4).map((tag) => <span key={tag} className={admin.badge}>{tag}</span>)}{product.tags.length > 4 && <small title={product.tags.join(", ")}>+{product.tags.length - 4}</small>}</div>}
          </div>
        </div></td><td><span className={admin.badge} data-status={product.publication}>{productStatusLabel(product.publication as AdminProduct["status"], language)}</span></td></tr>;
      })}</tbody>
    </table>
    {!data.items.length && <div className={admin.empty}><div><h2>{bg ? "Няма съвпадащи продукти" : "No matching products"}</h2><p>{bg ? "Промени търсенето или добави продукт към каталога." : "Change the search or add a product to your catalog."}</p></div></div>}
    <div className={admin.pagination}>
      <span aria-live="polite">{loading ? (bg ? "Зареждане…" : "Loading…") : (bg ? `${data.total} продукта` : `${data.total} products`)}</span>
      {data.nextCursor && <button type="button" className={admin.secondary} disabled={loading} onClick={onNext}>{bg ? "Следваща страница" : "Next page"}</button>}
    </div>
  </section>;
}
