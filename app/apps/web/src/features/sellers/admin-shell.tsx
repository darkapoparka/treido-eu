"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useLocale } from "../locale/provider";
import { parseLocale } from "../locale/locale";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { SellerContext } from "./persistence.server";
import { AdminIcon, type AdminIconName } from "./admin-icons";
import { AdminSearchContext } from "./admin-search-context";
import styles from "./admin.module.css";

export type AdminSeller = Pick<
  SellerContext,
  "sellerId" | "name" | "kind" | "capabilities"
>;

export function AdminShell({
  sellers,
  children,
  unavailable = false,
  preview,
}: {
  sellers: readonly AdminSeller[];
  children: React.ReactNode;
  unavailable?: boolean;
  preview?: {
    storeId: "studio" | "personal";
    name: string;
    settings?: boolean;
    navigation: React.ReactNode;
    accountLinks?: React.ReactNode;
    AssistantButton?: React.ReactNode;
    Search?: React.ComponentType<{
      onClose: () => void;
      onNavigate: () => void;
    }>;
  };
}) {
  const params = useParams<{ sellerId?: string }>();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const messaging = useTranslations("messaging");
  const inventoryText = useTranslations("inventory");
  const importText = useTranslations("catalogueImport");
  const teamText = useTranslations("team");
  const settingsText = useTranslations("sellerSettings");
  const purchaseText = useTranslations("purchaseReviews");
  const inquiryText = useTranslations("contactOperations");
  const trustText = useTranslations("trustOperations");
  const bg = (parseLocale(searchParams.get("lang")) ?? locale) === "bg";
  const language = bg ? "bg" : "en";
  const SearchPanel = preview?.Search;
  const searchLabel = preview
    ? bg
      ? "Търси"
      : "Search"
    : bg
      ? "Търси продукти"
      : "Search products";
  const seller = sellers.find((item) => item.sellerId === params.sellerId);
  const base = preview
    ? "/admin-preview"
    : seller
      ? `/app/sellers/${seller.sellerId}`
      : "/app";
  const products = preview
    ? "/admin-preview/products"
    : seller
      ? `${base}/listings`
      : "/app/products";
  const suffix = `?lang=${language}${preview ? `&store=${preview.storeId}` : ""}`;
  const [manualCollapsed, setCollapsed] = useState<boolean | null>(null);
  const [compactNavigation, setCompactNavigation] = useState(false);
  const [compactExpanded, setCompactExpanded] = useState(false);
  const collapsed = compactNavigation
    ? !compactExpanded
    : (manualCollapsed ?? false);
  const previewMode = Boolean(preview);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!previewMode) return;
    const breakpoint = window.matchMedia(
      "(min-width: 768px) and (max-width: 799px)",
    );
    const updateCompact = () => {
      setCompactNavigation(breakpoint.matches);
      setCompactExpanded(false);
    };
    updateCompact();
    breakpoint.addEventListener("change", updateCompact);
    return () => breakpoint.removeEventListener("change", updateCompact);
  }, [previewMode]);
  const menuButton = useRef<HTMLButtonElement>(null);
  const close = () => {
    drawer.current?.close();
    search.current?.close();
    setSearchOpen(false);
    setMenuOpen(false);
  };
  const closeSearch = () => {
    search.current?.close();
    setSearchOpen(false);
  };
  useEffect(() => {
    if (!menuOpen && !searchOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen, searchOpen]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (preview?.settings) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        drawer.current?.close();
        setMenuOpen(false);
        search.current?.showModal();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [preview?.settings]);
  const openSearch = () => {
    search.current?.showModal();
    setSearchOpen(true);
  };
  const openMenu = () => {
    drawer.current?.showModal();
    setMenuOpen(true);
  };
  const unavailableTool = (
    name: AdminIconName,
    en: string,
    bulgarian: string,
  ) => (
    <button
      key={name}
      type="button"
      disabled
      title={bg ? "Все още не е достъпно" : "Not available yet"}
    >
      <AdminIcon name={name} />
      <span>{bg ? bulgarian : en}</span>
    </button>
  );
  const navigation = (
    <>
      <div className={styles.brandRow} data-studio-part="brand-row">
        {!(preview && collapsed) && (
          <Link
            href={`${preview ? base : "/app"}${suffix}`}
            className={styles.brand}
            data-studio-part="brand"
            onClick={close}
            aria-label="Treido"
          >
            <span className={styles.brandMark} data-studio-part="brand-mark">
              t
            </span>
            <span className={styles.brandText} data-studio-part="brand-text">
              treido
            </span>
          </Link>
        )}
        <button
          className={`${styles.collapse} ${preview && collapsed ? styles.compactCollapse : ""}`}
          data-studio-part="collapse"
          onClick={() =>
            compactNavigation
              ? setCompactExpanded(!compactExpanded)
              : setCollapsed(!collapsed)
          }
          aria-expanded={!collapsed}
          aria-label={
            collapsed
              ? bg
                ? "Разгъни навигацията"
                : "Expand navigation"
              : bg
                ? "Свий навигацията"
                : "Collapse navigation"
          }
        >
          {preview && collapsed && (
            <span className={styles.brandMark} data-studio-part="brand-mark">
              t
            </span>
          )}
          <AdminIcon name="menu" />
        </button>
      </div>
      <button
        className={styles.sidebarSearch}
        data-studio-part="sidebar-search"
        onClick={openSearch}
        aria-label={searchLabel}
        aria-keyshortcuts="Control+K Meta+K"
      >
        <AdminIcon name="search" />
        <span>{bg ? "Търси" : "Search"}</span>
        <kbd>Ctrl K</kbd>
      </button>
      <nav
        aria-label={bg ? "Навигация за продавача" : "Seller navigation"}
        className={styles.nav}
        data-studio-part="main-nav"
      >
        {preview ? (
          <div onClick={close}>{preview.navigation}</div>
        ) : (
          <>
            <Link
              href={`${base}${suffix}`}
              aria-label={bg ? "Начало" : "Home"}
              onClick={close}
              aria-current={pathname === base ? "page" : undefined}
            >
              <AdminIcon name="home" />
              <span>{bg ? "Начало" : "Home"}</span>
            </Link>
            {seller?.capabilities.includes("order.read") ? (
              <Link
                href={base + "/orders" + suffix}
                onClick={close}
                aria-current={
                  pathname.startsWith(base + "/orders") ? "page" : undefined
                }
              >
                <AdminIcon name="orders" />
                <span>{bg ? "Платени поръчки" : "Paid orders"}</span>
              </Link>
            ) : (
              unavailableTool("orders", "Orders", "Поръчки")
            )}
            {seller?.capabilities.includes("listing.read") &&
              seller.capabilities.includes("inbox.read") && (
                <Link
                  href={base + "/reservations" + suffix}
                  onClick={close}
                  aria-current={
                    pathname.includes("/reservations") ? "page" : undefined
                  }
                >
                  <AdminIcon name="orders" />
                  <span>{purchaseText("reservations")}</span>
                </Link>
              )}
            {(!seller || seller.capabilities.includes("listing.read")) && (
              <Link
                href={`${products}${suffix}`}
                aria-label={bg ? "Продукти" : "Products"}
                onClick={close}
                aria-current={
                  pathname.includes("/listings") || pathname === "/app/products"
                    ? "page"
                    : undefined
                }
              >
                <AdminIcon name="product" />
                <span>{bg ? "Продукти" : "Products"}</span>
              </Link>
            )}
            {seller?.capabilities.includes("inbox.read") && (
              <Link
                href={base + "/inquiries" + suffix}
                onClick={close}
                aria-current={
                  pathname.includes("/inquiries") ? "page" : undefined
                }
              >
                <AdminIcon name="inbox" />
                <span>{inquiryText("title")}</span>
              </Link>
            )}
            {(!seller || seller.capabilities.includes("inbox.read")) && (
              <Link
                href={
                  seller
                    ? base + "/inbox" + suffix
                    : "/messages?lang=" + language
                }
                onClick={close}
                aria-current={pathname.includes("/inbox") ? "page" : undefined}
              >
                <AdminIcon name="inbox" />
                <span>{messaging("title")}</span>
              </Link>
            )}
            {seller?.capabilities.includes("listing.read") && (
              <Link
                href={base + "/moderation" + suffix}
                onClick={close}
                aria-current={
                  pathname.endsWith("/moderation") ? "page" : undefined
                }
              >
                <AdminIcon name="content" />
                <span>{trustText("sellerModeration")}</span>
              </Link>
            )}
            {seller?.capabilities.includes("listing.read") && (
              <Link
                href={base + "/inventory" + suffix}
                onClick={close}
                aria-current={
                  pathname.includes("/inventory") ? "page" : undefined
                }
              >
                <AdminIcon name="product" />
                <span>{inventoryText("catalogue")}</span>
              </Link>
            )}
            {seller?.kind === "business" &&
              seller.capabilities.includes("import.run") && (
                <Link
                  href={base + "/imports" + suffix}
                  onClick={close}
                  aria-current={
                    pathname.includes("/imports") ? "page" : undefined
                  }
                >
                  <AdminIcon name="content" />
                  <span>{importText("title")}</span>
                </Link>
              )}
            {seller?.kind === "business" &&
              seller.capabilities.includes("team.manage") && (
                <Link
                  href={base + "/team" + suffix}
                  onClick={close}
                  aria-current={pathname.includes("/team") ? "page" : undefined}
                >
                  <AdminIcon name="customers" />
                  <span>{teamText("title")}</span>
                </Link>
              )}
            {seller?.kind === "business" &&
              seller.capabilities.includes("profile.manage") && (
                <Link
                  href={base + "/settings/store" + suffix}
                  onClick={close}
                  aria-current={
                    pathname.includes("/settings/store") ? "page" : undefined
                  }
                >
                  <AdminIcon name="store" />
                  <span>{settingsText("store")}</span>
                </Link>
              )}
            <Link
              href={"/app/invitations?lang=" + language}
              onClick={close}
              aria-current={
                pathname.includes("/invitations") ? "page" : undefined
              }
            >
              <AdminIcon name="customers" />
              <span>{teamText("incoming")}</span>
            </Link>
            {unavailableTool("customers", "Customers", "Клиенти")}
            {seller?.capabilities.includes("marketing.manage") ? (
              <Link
                href={base + "/promotions" + suffix}
                onClick={close}
                aria-current={
                  pathname === base + "/promotions" ||
                  pathname.startsWith(base + "/promotions/")
                    ? "page"
                    : undefined
                }
              >
                <AdminIcon name="growth" />
                <span>{bg ? "Промоции" : "Promotions"}</span>
              </Link>
            ) : (
              unavailableTool("growth", "Growth", "Развитие")
            )}
            {unavailableTool("discount", "Discounts", "Отстъпки")}
            {unavailableTool("content", "Content", "Съдържание")}
            {unavailableTool("markets", "Markets", "Пазари")}
            {seller?.capabilities.includes("billing.manage") ? (
              <Link
                href={base + "/billing" + suffix}
                onClick={close}
                aria-current={
                  pathname === base + "/billing" ||
                  pathname.startsWith(base + "/billing/")
                    ? "page"
                    : undefined
                }
              >
                <AdminIcon name="finance" />
                <span>{bg ? "План и фактури" : "Plan & invoices"}</span>
              </Link>
            ) : (
              unavailableTool("finance", "Finance", "Финанси")
            )}
            {seller && (
              <Link href={"/sell/start?lang=" + language} onClick={close}>
                <AdminIcon name="content" />
                <span>{bg ? "Първи стъпки" : "Getting started"}</span>
              </Link>
            )}
            {seller?.capabilities.includes("analytics.read") ? (
              <Link
                href={base + "/insights" + suffix}
                prefetch={false}
                onClick={close}
                aria-current={
                  pathname.includes("/insights") ? "page" : undefined
                }
              >
                <AdminIcon name="analytics" />
                <span>{bg ? "Анализи" : "Analytics"}</span>
              </Link>
            ) : (
              unavailableTool("analytics", "Analytics", "Анализи")
            )}
            <p className={styles.navHeading} data-studio-part="nav-heading">
              {bg ? "Канали за продажба" : "Sales channels"}
            </p>
            <Link
              href="/"
              onClick={close}
              aria-label={bg ? "Пазарът на Treido" : "Treido marketplace"}
            >
              <AdminIcon name="store" />
              <span>{bg ? "Пазарът на Treido" : "Treido marketplace"}</span>
              <AdminIcon name="arrow" />
            </Link>
          </>
        )}
      </nav>
      <div className={styles.sidebarBottom} data-studio-part="sidebar-bottom">
        <Link
          href={
            preview
              ? `${base}/settings/general${suffix}&settings-navigation=1`
              : seller
                ? `${base}/settings${suffix}`
                : `/app${suffix}`
          }
          onClick={close}
          className={styles.settings}
          data-studio-part="settings"
          aria-label={bg ? "Настройки" : "Settings"}
        >
          <AdminIcon name="settings" />
          <span>{bg ? "Настройки" : "Settings"}</span>
        </Link>
        {preview ? (
          <Link
            className={styles.notifications}
            data-studio-part="notifications"
            href={`${base}/notifications${suffix}`}
            onClick={close}
            aria-label={bg ? "Известия" : "Notifications"}
          >
            <AdminIcon name="bell" />
          </Link>
        ) : !seller || seller.capabilities.includes("inbox.read") ? (
          <Link
            className={styles.notifications}
            data-studio-part="notifications"
            href={
              seller
                ? base + "/notifications" + suffix
                : "/notifications?lang=" + language
            }
            onClick={close}
            aria-label={bg ? "Известия" : "Notifications"}
            aria-current={
              pathname.includes("/notifications") ? "page" : undefined
            }
          >
            <AdminIcon name="bell" />
          </Link>
        ) : (
          <button
            type="button"
            className={styles.notifications}
            data-studio-part="notifications"
            disabled
            aria-label={
              bg
                ? "Известията все още не са достъпни"
                : "Notifications are not available yet"
            }
          >
            <AdminIcon name="bell" />
          </button>
        )}
        <details
          className={styles.sellerChooser}
          data-studio-part="seller-chooser"
        >
          <summary
            aria-label={
              bg ? "Избери акаунт на продавач" : "Choose seller account"
            }
          >
            <span className={styles.avatar} data-studio-part="avatar">
              {(preview?.name ?? seller?.name ?? "Treido")
                .slice(0, 2)
                .toUpperCase()}
            </span>
            <span>
              {preview?.name ??
                seller?.name ??
                (bg ? "Избери продавач" : "Select seller")}
            </span>
          </summary>
          <div
            className={styles.sellerChoices}
            data-studio-part="seller-choices"
          >
            {preview?.accountLinks}
            {preview ? (
              <>
                {(["studio", "personal"] as const).map((id) => (
                  <Link
                    key={id}
                    href={`/admin-preview?lang=${language}&store=${id}`}
                    onClick={close}
                    aria-current={preview.storeId === id ? "page" : undefined}
                  >
                    <strong>
                      {id === "studio"
                        ? "Treido Studio"
                        : bg
                          ? "Лични продажби"
                          : "Personal selling"}
                    </strong>
                    <small>{bg ? "Локален преглед" : "Local preview"}</small>
                  </Link>
                ))}
              </>
            ) : (
              <>
                {sellers.map((item) => (
                  <Link
                    key={item.sellerId}
                    href={`/app/sellers/${item.sellerId}${suffix}`}
                    onClick={close}
                    aria-current={
                      item.sellerId === seller?.sellerId ? "page" : undefined
                    }
                  >
                    <strong>{item.name}</strong>
                    <small>
                      {item.kind === "business"
                        ? bg
                          ? "Бизнес"
                          : "Business"
                        : bg
                          ? "Личен продавач"
                          : "Personal seller"}
                    </small>
                  </Link>
                ))}
                <Link href={`/app/onboarding${suffix}`} onClick={close}>
                  {bg ? "Добави бизнес" : "Add a business"}
                </Link>
              </>
            )}
          </div>
        </details>
        <div className={styles.sidebarNote} data-studio-part="sidebar-note">
          <span>
            {preview
              ? bg
                ? "Готов ли си да продаваш?"
                : "Ready to start selling?"
              : unavailable
                ? bg
                  ? "Продажбите не са достъпни"
                  : "Selling currently unavailable"
                : bg
                  ? "Твоят бизнес. Твоето място."
                  : "Your business. Your space."}
          </span>
          {preview && (
            <strong>
              {bg ? "Разгледай плановете на Treido" : "Explore Treido plans"}
            </strong>
          )}
          <Link
            href={
              preview
                ? `${base}/settings/plan${suffix}`
                : unavailable
                  ? "/sell"
                  : `${products}${suffix}`
            }
            onClick={close}
          >
            {preview
              ? bg
                ? "Избери план"
                : "Select a plan"
              : unavailable
                ? bg
                  ? "Подготви артикул"
                  : "Prepare an item"
                : bg
                  ? "Към продуктите"
                  : "Go to products"}
          </Link>
        </div>
      </div>
    </>
  );

  return (
    <AdminSearchContext.Provider value={openSearch}>
      <div
        data-admin-shell=""
        data-admin-preview-collapsed={preview ? collapsed : undefined}
        className={`${styles.shell} ${collapsed ? styles.collapsed : ""} ${preview?.settings ? styles.settingsLayout : ""}`}
        data-studio-part={preview?.settings ? "settings-admin-shell" : "shell"}
        data-studio-collapsed={collapsed}
        lang={language}
      >
        <a
          className={styles.skip}
          data-studio-part="skip"
          href={preview?.settings ? "#settings-content" : "#merchant-content"}
        >
          {bg ? "Към съдържанието" : "Skip to content"}
        </a>
        {!preview?.settings && (
          <aside className={styles.sidebar} data-studio-part="sidebar">
            {navigation}
          </aside>
        )}
        {preview?.settings ? (
          children
        ) : (
          <div
            className={`${styles.canvas} ${preview ? styles.previewCanvas : ""}`}
            data-studio-part="canvas"
            id="merchant-content"
            tabIndex={-1}
          >
            {children}
          </div>
        )}
        <nav
          className={styles.quickLinks}
          data-studio-part="quick-links"
          aria-label={bg ? "Бързи връзки" : "Quick links"}
        >
          <button
            ref={menuButton}
            onClick={openMenu}
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            aria-label={bg ? "Меню" : "Menu"}
          >
            <AdminIcon name={preview ? "hamburger" : "menu"} />
          </button>
          {preview?.AssistantButton ?? (
            <button
              onClick={openSearch}
              aria-haspopup="dialog"
              aria-label={searchLabel}
            >
              <AdminIcon name="search" />
            </button>
          )}
        </nav>
        <dialog
          ref={drawer}
          className={styles.drawer}
          data-studio-part="drawer"
          aria-label={bg ? "Навигация" : "Navigation"}
          onClose={() => setMenuOpen(false)}
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          {navigation}
        </dialog>
        <dialog
          ref={search}
          data-studio-part={preview ? "search-dialog" : undefined}
          className={`${styles.searchDialog} ${SearchPanel ? styles.previewSearchDialog : ""}`}
          aria-label={
            preview
              ? bg
                ? "Търси в магазина"
                : "Search your store"
              : bg
                ? "Търси продукти"
                : "Search products"
          }
          onClose={() => setSearchOpen(false)}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeSearch();
          }}
        >
          {searchOpen &&
            (SearchPanel ? (
              <SearchPanel onClose={closeSearch} onNavigate={close} />
            ) : (
              <>
                <form
                  action={products}
                  className={styles.searchForm}
                  data-studio-part="search-form"
                >
                  <AdminIcon name="search" />
                  <input
                    name="q"
                    type="search"
                    maxLength={160}
                    placeholder={
                      bg
                        ? "Търси по заглавие на продукта"
                        : "Search products by title"
                    }
                    aria-label={bg ? "Търси продукти" : "Search products"}
                    autoFocus
                  />
                  <input type="hidden" name="lang" value={language} />
                  {preview && (
                    <input type="hidden" name="store" value={preview.storeId} />
                  )}
                  <button
                    type="button"
                    className={styles.iconButton}
                    data-studio-part="icon-button"
                    onClick={closeSearch}
                    aria-label={bg ? "Затвори търсенето" : "Close search"}
                  >
                    <AdminIcon name="close" />
                  </button>
                  <button className={styles.primary} data-studio-part="primary">
                    {bg ? "Търси" : "Search"}
                  </button>
                </form>
                <div
                  className={styles.searchScope}
                  data-studio-part="search-scope"
                >
                  <span>{bg ? "Продукти" : "Products"}</span>
                </div>
                <p className={styles.searchHint} data-studio-part="search-hint">
                  {bg
                    ? "Намери продукт в твоя каталог"
                    : "Find a product in your catalog"}
                </p>
              </>
            ))}
        </dialog>
      </div>
    </AdminSearchContext.Provider>
  );
}
