"use client";

import Link from "next/link";
import { useParams, usePathname, useSearchParams, useRouter } from "next/navigation";
import { startTransition, useEffect, useRef, useState, type ComponentType, type MouseEvent, type ReactNode } from "react";
import { useLocale } from "../locale/provider";
import { parseLocale } from "../locale/locale";
import type { SellerContext } from "./persistence.server";
import { AdminIcon } from "./admin-icons";
import { AdminSearchContext, AdminHelperContext } from "./admin-search-context";
import { AdminAccountSwitcher } from "./admin-account-switcher";
import { MerchantNavigation } from "./merchant-navigation";
import { StudioHelperPanel } from "./studio-helper-panel";
import { StudioSearch } from "./studio-search";
import styles from "./admin.module.css";
import helperStyles from "./studio-helper-panel.module.css";
import presentation from "./admin-shell.module.css";

export type AdminSeller = Pick<SellerContext, "sellerId" | "name" | "kind" | "capabilities">;
type Overlay = "menu" | "search" | "helper";
type Preview = {
  storeId: "studio" | "personal";
  name: string;
  settings?: boolean;
  navigation: ReactNode;
  accountLinks?: ReactNode;
  AssistantButton?: ReactNode;
  Search?: ComponentType<{ onClose: () => void; onNavigate: () => void }>;
};

function isBackdrop(event: MouseEvent<HTMLDialogElement>) {
  if (event.target !== event.currentTarget) return false;
  const rect = event.currentTarget.getBoundingClientRect();
  return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
}

export function AdminShell({ sellers, children, unavailable = false, preview }: {
  sellers: readonly AdminSeller[];
  children: ReactNode;
  unavailable?: boolean;
  preview?: Preview;
}) {
  const params = useParams<{ sellerId?: string }>(), pathname = usePathname();
  const query = useSearchParams(), router = useRouter(), { locale } = useLocale();
  const language = parseLocale(query.get("lang")) ?? locale, bg = language === "bg";
  const seller = sellers.find((item) => item.sellerId === params.sellerId);
  const base = preview ? "/admin-preview" : seller ? `/app/sellers/${seller.sellerId}` : "/app";
  const products = preview ? "/admin-preview/products" : seller ? `${base}/listings` : "/app/products";
  const suffix = `?lang=${language}${preview ? `&store=${preview.storeId}` : ""}`;
  const canSearch = !!preview || !seller || seller.capabilities.includes("listing.read") || seller.capabilities.includes("order.read");
  const canHelper = !preview && !!seller && seller.capabilities.includes("listing.read") && seller.capabilities.includes("listing.write");
  const draftId = !preview ? /^\/app\/sellers\/[^/]+\/listings\/([0-9a-f-]+)\/(?:edit|review)$/.exec(pathname)?.[1] : undefined;
  const helperHref = `${base}/sell-helper?lang=${language}${draftId ? `&draftId=${draftId}` : ""}`;
  const searchLabel = preview ? bg ? "Търси" : "Search" : seller ? bg ? "Търси в този акаунт" : "Search this seller account" : bg ? "Търси продукти" : "Search products";
  const [manualCollapsed, setCollapsed] = useState(false);
  const [compactNavigation, setCompactNavigation] = useState(false);
  const [compactExpanded, setCompactExpanded] = useState(false);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const collapsed = compactNavigation ? !compactExpanded : manualCollapsed;
  const drawer = useRef<HTMLDialogElement>(null), search = useRef<HTMLDialogElement>(null), helper = useRef<HTMLDialogElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null), returnFocus = useRef<HTMLElement | null>(null);
  const SearchPanel = preview?.Search;

  useEffect(() => {
    const breakpoint = window.matchMedia("(min-width: 768px) and (max-width: 799px)");
    const update = () => { setCompactNavigation(breakpoint.matches); setCompactExpanded(false); };
    update();
    breakpoint.addEventListener("change", update);
    return () => breakpoint.removeEventListener("change", update);
  }, []);
  function restoreFocus() {
    const target = returnFocus.current;
    if (target?.isConnected && target.checkVisibility()) target.focus({ preventScroll: true });
    else menuButton.current?.focus({ preventScroll: true });
  }
  function close(restore = false) {
    drawer.current?.close(); search.current?.close(); helper.current?.close();
    setOverlay(null);
    if (restore) restoreFocus();
  }
  function rememberFocus() {
    const active = document.activeElement;
    // A drawer link disappears when opening another overlay; return to its opener.
    returnFocus.current = active instanceof HTMLElement && !drawer.current?.contains(active)
      && !search.current?.contains(active) && !helper.current?.contains(active) ? active : menuButton.current;
  }
  function open(kind: Overlay) {
    if ((kind === "search" && !canSearch) || (kind === "helper" && !canHelper)) return;
    rememberFocus();
    close();
    if (kind === "helper" && (pathname === base || window.matchMedia("(max-width: 767px)").matches)) {
      router.push(helperHref);
      return;
    }
    const dialog = kind === "menu" ? drawer : kind === "search" ? search : helper;
    dialog.current?.showModal();
    setOverlay(kind);
  }
  useEffect(() => {
    if (!overlay) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [overlay]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (preview?.settings || !canSearch || event.defaultPrevented) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        const active = document.activeElement;
        if (!search.current?.open) returnFocus.current = active instanceof HTMLElement && !drawer.current?.contains(active) ? active : menuButton.current;
        drawer.current?.close(); helper.current?.close();
        if (!search.current?.open) search.current?.showModal();
        setOverlay("search");
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [preview?.settings, canSearch]);
  useEffect(() => {
    drawer.current?.close(); search.current?.close(); helper.current?.close();
    startTransition(() => setOverlay(null));
  }, [pathname, seller?.sellerId, language]);
  const navigate = () => close();
  const dialogEvents = (kind: Overlay) => ({
    onClose: (event: React.SyntheticEvent<HTMLDialogElement>) => {
      if (event.target === event.currentTarget) setOverlay((current) => current === kind ? null : current);
    },
    onCancel: (event: React.SyntheticEvent<HTMLDialogElement>) => { event.preventDefault(); close(true); },
    onClick: (event: MouseEvent<HTMLDialogElement>) => { if (isBackdrop(event)) close(true); },
  });
  const navigation = (mobile = false) => <>
    <div className={styles.brandRow} data-studio-part="brand-row">
      {!(preview && collapsed && !mobile) && <Link href={`${base}${suffix}`} className={styles.brand} data-studio-part="brand" onClick={navigate} aria-label="Treido">
        <span className={styles.brandMark} data-studio-part="brand-mark">t</span>
        <span className={styles.brandText} data-studio-part="brand-text">treido</span>
      </Link>}
      <button type="button" className={`${styles.collapse} ${preview && collapsed && !mobile ? styles.compactCollapse : ""}`}
        data-studio-part="collapse" onClick={() => mobile ? close(true) : compactNavigation ? setCompactExpanded(!compactExpanded) : setCollapsed(!collapsed)}
        aria-expanded={mobile ? undefined : !collapsed}
        aria-label={mobile ? bg ? "Затвори навигацията" : "Close navigation" : collapsed ? bg ? "Разгъни навигацията" : "Expand navigation" : bg ? "Свий навигацията" : "Collapse navigation"}>
        {preview && collapsed && !mobile && <span className={styles.brandMark} data-studio-part="brand-mark">t</span>}
        <AdminIcon name={mobile ? "close" : "menu"} />
      </button>
    </div>
    {canSearch && <button type="button" className={styles.sidebarSearch} data-studio-part="sidebar-search" onClick={() => open("search")} aria-label={searchLabel} aria-keyshortcuts="Control+K Meta+K">
      <AdminIcon name="search" /><span>{bg ? "Търси" : "Search"}</span><kbd>Ctrl K</kbd>
    </button>}
    <nav aria-label={bg ? "Навигация за продавача" : "Seller navigation"} className={styles.nav} data-studio-part="main-nav">
      {preview ? <div onClick={navigate}>{preview.navigation}</div> : <MerchantNavigation seller={seller} language={language} pathname={pathname} onNavigate={navigate} onHelper={() => open("helper")} />}
    </nav>
    <div className={styles.sidebarBottom} data-studio-part="sidebar-bottom">
      <Link href={preview ? `${base}/settings/general${suffix}&settings-navigation=1` : seller ? `${base}/settings${suffix}` : `/app${suffix}`}
        onClick={navigate} className={styles.settings} data-studio-part="settings" aria-label={bg ? "Настройки" : "Settings"}
        aria-current={pathname === `${base}/settings` || pathname.startsWith(`${base}/settings/`) ? "page" : undefined}>
        <AdminIcon name="settings" /><span>{bg ? "Настройки" : "Settings"}</span>
      </Link>
      {(preview || !seller || seller.capabilities.includes("inbox.read")) && <Link className={styles.notifications} data-studio-part="notifications"
        href={preview || seller ? `${base}/notifications${suffix}` : `/notifications?lang=${language}`}
        onClick={navigate} aria-label={bg ? "Известия" : "Notifications"} aria-current={pathname.includes("/notifications") ? "page" : undefined}><AdminIcon name="bell" /></Link>}
      {preview ? <>
        <details className={styles.sellerChooser} data-studio-part="seller-chooser">
          <summary aria-label={bg ? "Избери акаунт на продавач" : "Choose seller account"}>
            <span className={styles.avatar} data-studio-part="avatar">{preview.name.slice(0, 2).toUpperCase()}</span><span>{preview.name}</span>
          </summary>
          <div className={styles.sellerChoices} data-studio-part="seller-choices">{preview.accountLinks}
            {(["studio", "personal"] as const).map((id) => <Link key={id} href={`/admin-preview?lang=${language}&store=${id}`} onClick={navigate} aria-current={preview.storeId === id ? "page" : undefined}>
              <strong>{id === "studio" ? "Treido Studio" : bg ? "Лични продажби" : "Personal selling"}</strong><small>{bg ? "Локален преглед" : "Local preview"}</small>
            </Link>)}
          </div>
        </details>
        <div className={styles.sidebarNote} data-studio-part="sidebar-note"><span>{bg ? "Готов ли си да продаваш?" : "Ready to start selling?"}</span><strong>{bg ? "Разгледай плановете на Treido" : "Explore Treido plans"}</strong><Link href={`${base}/settings/plan${suffix}`} onClick={navigate}>{bg ? "Избери план" : "Select a plan"}</Link></div>
      </> : <AdminAccountSwitcher key={`${pathname}:${language}`} accounts={sellers} current={seller} language={language} onNavigate={navigate} />}
      {!preview && unavailable && <p className={presentation.unavailable} role="status">{bg ? "Продажбите не са достъпни в момента." : "Selling is currently unavailable."}</p>}
    </div>
  </>;
  return <AdminSearchContext.Provider value={canSearch ? () => open("search") : null}>
    <AdminHelperContext.Provider value={canHelper ? () => open("helper") : null}>
      <div data-admin-shell="" data-admin-preview-collapsed={preview ? collapsed : undefined}
        className={`${styles.shell} ${!preview ? presentation.shell : ""} ${collapsed ? styles.collapsed : ""} ${preview?.settings ? styles.settingsLayout : ""}`}
        data-studio-part={preview?.settings ? "settings-admin-shell" : "shell"} data-studio-collapsed={collapsed} data-studio-overlay={overlay !== null} lang={language}>
        <a className={styles.skip} data-studio-part="skip" href={preview?.settings ? "#settings-content" : "#merchant-content"}>{bg ? "Към съдържанието" : "Skip to content"}</a>
        {!preview?.settings && <aside className={styles.sidebar} data-studio-part="sidebar">{navigation()}</aside>}
        {preview?.settings ? children : <div className={`${styles.canvas} ${preview ? styles.previewCanvas : ""}`} data-studio-part="canvas" id="merchant-content" tabIndex={-1}>{children}</div>}
        <nav className={styles.quickLinks} data-studio-part="quick-links" aria-label={bg ? "Бързи връзки" : "Quick links"}>
          <button type="button" ref={menuButton} onClick={() => open("menu")} aria-haspopup="dialog" aria-expanded={overlay === "menu"} aria-label={bg ? "Меню" : "Menu"}><AdminIcon name="hamburger" /></button>
          {preview?.AssistantButton ?? (canHelper ? <button type="button" onClick={() => open("helper")} aria-label={bg ? "Помощник за продажби" : "Sell Helper"}><AdminIcon name="edit" /></button> : canSearch ? <button type="button" onClick={() => open("search")} aria-haspopup="dialog" aria-label={searchLabel}><AdminIcon name="search" /></button> : null)}
        </nav>
        <dialog ref={drawer} className={styles.drawer} data-studio-part="drawer" aria-label={bg ? "Навигация" : "Navigation"} {...dialogEvents("menu")}>{navigation(true)}</dialog>
        <dialog ref={search} className={`${styles.searchDialog} ${SearchPanel || seller ? styles.previewSearchDialog : ""}`} data-studio-part="search-dialog" aria-label={searchLabel} {...dialogEvents("search")}>
          {overlay === "search" && (SearchPanel ? <SearchPanel onClose={() => close(true)} onNavigate={navigate} /> : seller ? <StudioSearch key={`${seller.sellerId}:${language}`} sellerId={seller.sellerId} language={language} onClose={() => close(true)} onNavigate={navigate} /> : <>
            <form action={products} className={styles.searchForm} data-studio-part="search-form">
              <AdminIcon name="search" /><input name="q" type="search" maxLength={160} placeholder={bg ? "Търси по заглавие на продукта" : "Search products by title"} aria-label={bg ? "Търси продукти" : "Search products"} autoFocus />
              <input type="hidden" name="lang" value={language} />
              {preview && <input type="hidden" name="store" value={preview.storeId} />}
              <button type="button" className={styles.iconButton} data-studio-part="icon-button" onClick={() => close(true)} aria-label={bg ? "Затвори търсенето" : "Close search"}><AdminIcon name="close" /></button>
              <button className={styles.primary} data-studio-part="primary">{bg ? "Търси" : "Search"}</button>
            </form>
            <div className={styles.searchScope} data-studio-part="search-scope"><span>{bg ? "Продукти" : "Products"}</span></div>
            <p className={styles.searchHint} data-studio-part="search-hint">{bg ? "Намери продукт в твоя каталог" : "Find a product in your catalog"}</p>
          </>)}
        </dialog>
        {canHelper && seller && <dialog ref={helper} className={helperStyles.panel} aria-label={bg ? "Помощник за продажби" : "Sell Helper"} {...dialogEvents("helper")}>
          <header className={helperStyles.header}><h2>{bg ? "Помощник за продажби" : "Sell Helper"}</h2><Link href={helperHref} onClick={navigate}>{bg ? "Разгъни" : "Expand"}</Link><button type="button" onClick={() => close(true)} aria-label={bg ? "Затвори" : "Close"}><AdminIcon name="close" /></button></header>
          <div className={helperStyles.body}>{overlay === "helper" && <StudioHelperPanel sellerId={seller.sellerId} draftId={draftId} />}</div>
        </dialog>}
      </div>
    </AdminHelperContext.Provider>
  </AdminSearchContext.Provider>;
}
