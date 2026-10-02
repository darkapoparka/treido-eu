"use client";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import type { Catalog, Store } from "../catalog/types";
import { merchantProducts } from "../catalog/reference/merchant-catalog-model";
import { MerchantShell } from "./native-merchant-chrome";
import { ContextualCloseLink } from "./return-navigation";
import { NativeIcon } from "./native-icons";
import { useSearchDraft } from "./search-draft";
import { FloatingNav, commitSheetQuery } from "./components";
import { StoreGrid } from "./store-grid";
import { normalizeStoreQuery } from "./store-model";
export function NativeMerchantSearch({
  store,
  catalog,
}: {
  store: Store;
  catalog: Catalog;
}) {
  const ui = useTranslations("discoveryUI");
  const params = useSearchParams(),
    editor = useSearchDraft(`store-search:${store.id}`, params.get("q") ?? "");
  const words = normalizeStoreQuery(editor.draft).split(" ").filter(Boolean);
  const products = merchantProducts(store, catalog).filter((p) =>
    words.every((w) =>
      normalizeStoreQuery(`${p.title} ${p.category}`).includes(w),
    ),
  );
  function submit() {
    const next = new URLSearchParams(location.search);
    if (editor.draft.trim()) next.set("q", editor.draft.trim());
    else next.delete("q");
    commitSheetQuery(next);
  }
  return (
    <MerchantShell store={store} kind="search">
      <header className="native-merchant-search-header">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          role="search"
        >
          <NativeIcon name="search" />
          <input
            type="search"
            aria-label={ui("searchValue1", { value1: store.name ?? "" })}
            placeholder={ui("searchThisStore")}
            value={editor.draft}
            onChange={(e) =>
              editor.update({ draft: e.target.value, editing: true })
            }
          />
          {editor.draft && (
            <button
              type="button"
              aria-label={ui("clearSearch")}
              onClick={() => {
                editor.update({ draft: "", editing: true });
                const p = new URLSearchParams(location.search);
                p.delete("q");
                commitSheetQuery(p);
              }}
              data-ui-label="clearSearch"
            >
              <NativeIcon name="close" />
            </button>
          )}
        </form>
        <ContextualCloseLink
          href={`/stores/${store.id}`}
          aria-label={ui("closeStoreSearch")}
          className="icon-button"
          data-ui-label="closeStoreSearch"
        >
          <NativeIcon name="close" />
        </ContextualCloseLink>
      </header>
      <h1 className="native-merchant-search-title">{store.name}</h1>
      <p className="native-merchant-search-count" role="status">
        {editor.draft ? `${products.length} results` : ui("products")}
      </p>
      <StoreGrid products={products} native />
      <FloatingNav android nativeIcons back fade />
    </MerchantShell>
  );
}
