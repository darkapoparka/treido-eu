"use client";
import Link from "next/link";
import { useLocale } from "../locale/provider";
import { parseLocale } from "../locale/locale";
import { useParams, usePathname, useSearchParams, useRouter } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";
import type { SellerContext } from "./persistence.server";
import { AdminIcon } from "./admin-icons";
import { AdminSearchContext, AdminHelperContext } from "./admin-search-context";
import { MerchantNavigation } from "./merchant-navigation";
import { StudioHelperPanel } from "./studio-helper-panel";
import styles from "./admin.module.css";
import helperStyles from "./studio-helper-panel.module.css";

export type AdminSeller = Pick<SellerContext, "sellerId" | "name" | "kind" | "capabilities">;
export function AdminShell({ sellers, children, unavailable = false, preview }: {
  sellers: readonly AdminSeller[]; children: React.ReactNode; unavailable?: boolean;
  preview?: {
    storeId: "studio" | "personal"; name: string; settings?: boolean; navigation: React.ReactNode;
    accountLinks?: React.ReactNode; AssistantButton?: React.ReactNode;
    Search?: React.ComponentType<{ onClose: () => void; onNavigate: () => void }>;
  };
}) {
  const params = useParams<{ sellerId?: string }>(), pathname = usePathname(), searchParams = useSearchParams(), router = useRouter(), { locale } = useLocale();
  const bg = (parseLocale(searchParams.get("lang")) ?? locale) === "bg", language = bg ? "bg" : "en";
  const SearchPanel = preview?.Search, seller = sellers.find((item) => item.sellerId === params.sellerId);
  const base = preview ? "/admin-preview" : seller ? `/app/sellers/${seller.sellerId}` : "/app";
  const products = preview ? "/admin-preview/products" : seller ? `${base}/listings` : "/app/products";
  const suffix = `?lang=${language}${preview ? `&store=${preview.storeId}` : ""}`;
  const canSearch = !!preview || !seller || seller.capabilities.includes("listing.read");
  const canHelper = !preview && !!seller && seller.capabilities.includes("listing.read") && seller.capabilities.includes("listing.write");
  const editingDraft = !preview ? /^\/app\/sellers\/[^/]+\/listings\/([0-9a-f-]+)\/(?:edit|review)$/.exec(pathname)?.[1] : undefined;
  const helperHref = `${base}/sell-helper?lang=${language}${editingDraft ? `&draftId=${editingDraft}` : ""}`;
  const searchLabel = preview ? bg ? "Търси" : "Search" : bg ? "Търси продукти" : "Search products";
  const [manualCollapsed, setCollapsed] = useState<boolean | null>(null), [compactNavigation, setCompactNavigation] = useState(false), [compactExpanded, setCompactExpanded] = useState(false);
  const collapsed = compactNavigation ? !compactExpanded : manualCollapsed ?? false, previewMode = Boolean(preview);
  const [searchOpen, setSearchOpen] = useState(false), [menuOpen, setMenuOpen] = useState(false), [helperOpen, setHelperOpen] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null), search = useRef<HTMLDialogElement>(null), helper = useRef<HTMLDialogElement>(null), menuButton = useRef<HTMLButtonElement>(null), returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!previewMode) return;
    const breakpoint = window.matchMedia("(min-width: 768px) and (max-width: 799px)");
    const updateCompact = () => { setCompactNavigation(breakpoint.matches); setCompactExpanded(false); };
    updateCompact(); breakpoint.addEventListener("change", updateCompact);
    return () => breakpoint.removeEventListener("change", updateCompact);
  }, [previewMode]);
  const rememberFocus = () => { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; };
  const restoreFocus = () => {
    const target = returnFocus.current;
    if (target?.isConnected && target.checkVisibility()) target.focus();
    else menuButton.current?.focus();
  };
  const close = () => { drawer.current?.close(); search.current?.close(); helper.current?.close(); setSearchOpen(false); setMenuOpen(false); setHelperOpen(false); };
  const closeSearch = () => { search.current?.close(); setSearchOpen(false); restoreFocus(); };
  const closeHelper = () => { helper.current?.close(); setHelperOpen(false); restoreFocus(); };
  const openSearch = () => {
    if (!canSearch) return;
    rememberFocus(); drawer.current?.close(); helper.current?.close(); setMenuOpen(false); setHelperOpen(false);
    search.current?.showModal(); setSearchOpen(true);
  };
  const openHelper = () => {
    if (!canHelper) return;
    rememberFocus(); drawer.current?.close(); search.current?.close(); setMenuOpen(false); setSearchOpen(false);
    if (pathname === base || window.matchMedia("(max-width: 767px)").matches) { router.push(helperHref); return; }
    helper.current?.showModal(); setHelperOpen(true);
  };
  const openMenu = () => { rememberFocus(); search.current?.close(); helper.current?.close(); setSearchOpen(false); setHelperOpen(false); drawer.current?.showModal(); setMenuOpen(true); };
  useEffect(() => {
    if (!menuOpen && !searchOpen && !helperOpen) return;
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [menuOpen, searchOpen, helperOpen]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (preview?.settings || !canSearch || event.defaultPrevented) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        drawer.current?.close(); helper.current?.close(); setMenuOpen(false); setHelperOpen(false); search.current?.showModal(); setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey);
  }, [preview?.settings, canSearch]);
  useEffect(() => {
    drawer.current?.close(); search.current?.close(); helper.current?.close();
    startTransition(() => { setMenuOpen(false); setSearchOpen(false); setHelperOpen(false); });
  }, [pathname, seller?.sellerId, language]);
  const navigation = <>
    <div className={styles.brandRow} data-studio-part="brand-row">
      {!(preview && collapsed) && <Link href={`${preview ? base : "/app"}${suffix}`} className={styles.brand} data-studio-part="brand" onClick={close} aria-label="Treido">
        <span className={styles.brandMark} data-studio-part="brand-mark">t</span><span className={styles.brandText} data-studio-part="brand-text">treido</span>
      </Link>}
      <button className={`${styles.collapse} ${preview && collapsed ? styles.compactCollapse : ""}`} data-studio-part="collapse" onClick={() => compactNavigation ? setCompactExpanded(!compactExpanded) : setCollapsed(!collapsed)} aria-expanded={!collapsed}
        aria-label={collapsed ? bg ? "Разгъни навигацията" : "Expand navigation" : bg ? "Свий навигацията" : "Collapse navigation"}>
        {preview && collapsed && <span className={styles.brandMark} data-studio-part="brand-mark">t</span>}<AdminIcon name="menu" />
      </button>
    </div>
    {canSearch && <button className={styles.sidebarSearch} data-studio-part="sidebar-search" onClick={openSearch} aria-label={searchLabel} aria-keyshortcuts="Control+K Meta+K"><AdminIcon name="search" /><span>{bg ? "Търси" : "Search"}</span><kbd>Ctrl K</kbd></button>}
    <nav aria-label={bg ? "Навигация за продавача" : "Seller navigation"} className={styles.nav} data-studio-part="main-nav">
      {preview ? <div onClick={close}>{preview.navigation}</div> : <MerchantNavigation seller={seller} language={language} pathname={pathname} onNavigate={close} onHelper={openHelper} />}
    </nav>
    <div className={styles.sidebarBottom} data-studio-part="sidebar-bottom">
      <Link href={preview ? `${base}/settings/general${suffix}&settings-navigation=1` : seller ? `${base}/settings${suffix}` : `/app${suffix}`} onClick={close} className={styles.settings} data-studio-part="settings" aria-label={bg ? "Настройки" : "Settings"}><AdminIcon name="settings" /><span>{bg ? "Настройки" : "Settings"}</span></Link>
      {(preview || !seller || seller.capabilities.includes("inbox.read")) && <Link className={styles.notifications} data-studio-part="notifications" href={preview ? `${base}/notifications${suffix}` : seller ? `${base}/notifications${suffix}` : `/notifications?lang=${language}`} onClick={close} aria-label={bg ? "Известия" : "Notifications"} aria-current={pathname.includes("/notifications") ? "page" : undefined}><AdminIcon name="bell" /></Link>}
      <details className={styles.sellerChooser} data-studio-part="seller-chooser">
        <summary aria-label={bg ? "Избери акаунт на продавач" : "Choose seller account"}>
          <span className={styles.avatar} data-studio-part="avatar">{(preview?.name ?? seller?.name ?? "Treido").slice(0, 2).toUpperCase()}</span>
          <span>{preview?.name ?? seller?.name ?? (bg ? "Избери продавач" : "Select seller")}</span>
        </summary>
        <div className={styles.sellerChoices} data-studio-part="seller-choices">
          {preview?.accountLinks}
          {preview ? <>{(["studio", "personal"] as const).map((id) => <Link key={id} href={`/admin-preview?lang=${language}&store=${id}`} onClick={close} aria-current={preview.storeId === id ? "page" : undefined}>
            <strong>{id === "studio" ? "Treido Studio" : bg ? "Лични продажби" : "Personal selling"}</strong><small>{bg ? "Локален преглед" : "Local preview"}</small>
          </Link>)}</> : <>
            {sellers.map((item) => <Link key={item.sellerId} href={`/app/sellers/${item.sellerId}${suffix}`} onClick={close} aria-current={item.sellerId === seller?.sellerId ? "page" : undefined}>
              <strong>{item.name}</strong><small>{item.kind === "business" ? bg ? "Бизнес" : "Business" : bg ? "Личен продавач" : "Personal seller"}</small>
            </Link>)}
            <Link href={`/sell?lang=${language}`} onClick={close}>{bg ? "Продай личен артикул" : "Sell a personal item"}</Link>
            <Link href={`/app/onboarding${suffix}`} onClick={close}>{bg ? "Добави бизнес" : "Add a business"}</Link>
          </>}
        </div>
      </details>
      <div className={styles.sidebarNote} data-studio-part="sidebar-note">
        <span>{preview ? bg ? "Готов ли си да продаваш?" : "Ready to start selling?" : unavailable ? bg ? "Продажбите не са достъпни" : "Selling currently unavailable" : seller?.kind === "personal" ? bg ? "Твоите вещи. Твоите продажби." : "Your items. Your selling space." : bg ? "Твоят бизнес. Твоето място." : "Your business. Your space."}</span>
        {preview && <strong>{bg ? "Разгледай плановете на Treido" : "Explore Treido plans"}</strong>}
        <Link href={preview ? `${base}/settings/plan${suffix}` : unavailable ? `/sell?lang=${language}` : canSearch ? `${products}${suffix}` : `${base}${suffix}`} onClick={close}>
          {preview ? bg ? "Избери план" : "Select a plan" : unavailable ? bg ? "Подготви артикул" : "Prepare an item" : canSearch ? bg ? "Към продуктите" : "Go to products" : bg ? "Към началото" : "Go to Home"}
        </Link>
      </div>
    </div>
  </>;
  return <AdminSearchContext.Provider value={canSearch ? openSearch : null}><AdminHelperContext.Provider value={canHelper ? openHelper : null}>
    <div data-admin-shell="" data-admin-preview-collapsed={preview ? collapsed : undefined} className={`${styles.shell} ${collapsed ? styles.collapsed : ""} ${preview?.settings ? styles.settingsLayout : ""}`} data-studio-part={preview?.settings ? "settings-admin-shell" : "shell"} data-studio-collapsed={collapsed} lang={language}>
      <a className={styles.skip} data-studio-part="skip" href={preview?.settings ? "#settings-content" : "#merchant-content"}>{bg ? "Към съдържанието" : "Skip to content"}</a>
      {!preview?.settings && <aside className={styles.sidebar} data-studio-part="sidebar">{navigation}</aside>}
      {preview?.settings ? children : <div className={`${styles.canvas} ${preview ? styles.previewCanvas : ""}`} data-studio-part="canvas" id="merchant-content" tabIndex={-1}>{children}</div>}
      <nav className={styles.quickLinks} data-studio-part="quick-links" aria-label={bg ? "Бързи връзки" : "Quick links"}>
        <button ref={menuButton} onClick={openMenu} aria-haspopup="dialog" aria-expanded={menuOpen} aria-label={bg ? "Меню" : "Menu"}><AdminIcon name={preview ? "hamburger" : "menu"} /></button>
        {preview?.AssistantButton ?? (canHelper ? <button onClick={openHelper} aria-label={bg ? "Помощник за продажби" : "Sell Helper"}><AdminIcon name="edit" /></button> : canSearch ? <button onClick={openSearch} aria-haspopup="dialog" aria-label={searchLabel}><AdminIcon name="search" /></button> : null)}
      </nav>
      <dialog ref={drawer} className={styles.drawer} data-studio-part="drawer" aria-label={bg ? "Навигация" : "Navigation"} onClose={() => setMenuOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>{navigation}</dialog>
      <dialog ref={search} data-studio-part={preview ? "search-dialog" : undefined} className={`${styles.searchDialog} ${SearchPanel ? styles.previewSearchDialog : ""}`} aria-label={preview ? bg ? "Търси в магазина" : "Search your store" : bg ? "Търси продукти" : "Search products"} onClose={() => setSearchOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) closeSearch(); }}>
        {searchOpen && (SearchPanel ? <SearchPanel onClose={closeSearch} onNavigate={close} /> : <>
          <form action={products} className={styles.searchForm} data-studio-part="search-form"><AdminIcon name="search" />
            <input name="q" type="search" maxLength={160} placeholder={bg ? "Търси по заглавие на продукта" : "Search products by title"} aria-label={bg ? "Търси продукти" : "Search products"} autoFocus />
            <input type="hidden" name="lang" value={language} />
            {preview && <input type="hidden" name="store" value={preview.storeId} />}
            <button type="button" className={styles.iconButton} data-studio-part="icon-button" onClick={closeSearch} aria-label={bg ? "Затвори търсенето" : "Close search"}><AdminIcon name="close" /></button>
            <button className={styles.primary} data-studio-part="primary">{bg ? "Търси" : "Search"}</button>
          </form>
          <div className={styles.searchScope} data-studio-part="search-scope"><span>{bg ? "Продукти" : "Products"}</span></div>
          <p className={styles.searchHint} data-studio-part="search-hint">{bg ? "Намери продукт в твоя каталог" : "Find a product in your catalog"}</p>
        </>)}
      </dialog>
      {canHelper && seller && <dialog ref={helper} className={helperStyles.panel} aria-label={bg ? "Помощник за продажби" : "Sell Helper"} onClose={(event) => { if (event.target === event.currentTarget) setHelperOpen(false); }} onClick={(event) => { if (event.target === event.currentTarget) closeHelper(); }}>
        <header className={helperStyles.header}><h2>{bg ? "Помощник за продажби" : "Sell Helper"}</h2><Link href={helperHref} onClick={close}>{bg ? "Разгъни" : "Expand"}</Link><button type="button" onClick={closeHelper} aria-label={bg ? "Затвори" : "Close"}><AdminIcon name="close" /></button></header>
        <div className={helperStyles.body}>{helperOpen && <StudioHelperPanel sellerId={seller.sellerId} draftId={editingDraft} />}</div>
      </dialog>}
    </div>
  </AdminHelperContext.Provider></AdminSearchContext.Provider>;
}
