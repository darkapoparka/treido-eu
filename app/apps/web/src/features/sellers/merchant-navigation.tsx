import Link from "next/link";
import type { SellerContext } from "./persistence.server";
import { AdminIcon, type AdminIconName } from "./admin-icons";
import styles from "./admin.module.css";
export type MerchantNavigationItem = { key: string; href: string; label: string; icon: AdminIconName };
type NavigationSeller = Pick<SellerContext, "sellerId" | "kind" | "capabilities">;

/** Navigation projects permission; the destination independently authorizes it.
 * Unsupported Shopify CMS/discount/market placeholders are not seller actions. */
export function merchantNavigation(seller: NavigationSeller | undefined, language: "bg" | "en"): MerchantNavigationItem[] {
  const bg = language === "bg", base = seller ? `/app/sellers/${seller.sellerId}` : "/app", suffix = `?lang=${language}`;
  const has = (capability: SellerContext["capabilities"][number]) => seller?.capabilities.includes(capability) === true;
  const items: MerchantNavigationItem[] = [];
  const add = (key: string, href: string, icon: AdminIconName, en: string, bulgarian: string) => items.push({ key, href: href + suffix, icon, label: bg ? bulgarian : en });
  add("home", base, "home", "Home", "Начало");
  if (has("order.read")) add("orders", base + "/orders", "orders", "Orders", "Поръчки");
  if (!seller || has("listing.read")) add("products", seller ? base + "/listings" : "/app/products", "product", "Products", "Продукти");
  if (has("listing.read")) add("inventory", base + "/inventory", "product", "Inventory", "Наличности");
  if (has("order.read")) add("customers", base + "/customers", "customers", "Customers", "Клиенти");
  if (has("listing.read") && has("inbox.read")) add("reservations", base + "/reservations", "orders", "Reservations", "Резервации");
  if (!seller || has("inbox.read")) add("inbox", seller ? base + "/inbox" : "/messages", "inbox", "Messages and offers", "Съобщения и оферти");
  if (has("inbox.read")) add("inquiries", base + "/inquiries", "inbox", "Inquiries", "Запитвания");
  if (seller?.kind === "business" && has("import.run") && has("listing.read")) add("imports", base + "/imports", "content", "Catalogue imports", "Импорт на каталог");
  if (has("listing.read") && has("listing.write")) add("helper", base + "/sell-helper", "edit", "Sell Helper", "Помощник за продажби");
  if (has("marketing.manage")) add("promotions", base + "/promotions", "growth", "Promotions", "Промоции");
  if (has("analytics.read")) add("insights", base + "/insights", "analytics", "Analytics", "Анализи");
  if (has("billing.manage")) add("billing", base + "/billing", "finance", "Plan & invoices", "План и фактури");
  if (seller?.kind === "business" && has("team.manage")) add("team", base + "/team", "customers", "Team", "Екип");
  if (has("profile.manage")) add("profile", base + "/settings/store", "store", seller?.kind === "personal" ? "Seller profile" : "Store profile", seller?.kind === "personal" ? "Профил на продавача" : "Профил на магазина");
  if (has("listing.read")) add("moderation", base + "/moderation", "content", "Publication decisions", "Решения за публикации");
  add("invitations", "/app/invitations", "customers", "Invitations", "Покани");
  return items;
}
export function MerchantNavigation({ seller, language, pathname, onNavigate, onHelper }: {
  seller?: NavigationSeller; language: "bg" | "en"; pathname: string; onNavigate: () => void; onHelper: () => void;
}) {
  const bg = language === "bg";
  return <>
    {merchantNavigation(seller, language).map((item) => {
      const path = item.href.split("?")[0];
      const current = pathname === path || (item.key !== "home" && pathname.startsWith(path + "/"));
      return <Link key={item.key} href={item.href} prefetch={false} aria-label={item.label} aria-current={current ? "page" : undefined} onClick={(event) => {
        if (item.key === "helper" && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onHelper(); }
        else onNavigate();
      }}><AdminIcon name={item.icon} /><span>{item.label}</span></Link>;
    })}
    <p className={styles.navHeading} data-studio-part="nav-heading">{bg ? "Канали за продажба" : "Sales channels"}</p>
    <Link href={`/?lang=${language}`} onClick={onNavigate} aria-label={bg ? "Пазарът на Treido" : "Treido marketplace"}><AdminIcon name="store" /><span>{bg ? "Пазарът на Treido" : "Treido marketplace"}</span><AdminIcon name="arrow" /></Link>
  </>;
}
