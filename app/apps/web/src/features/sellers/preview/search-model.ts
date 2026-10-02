import { labels, parsePreviewRoute, settingsSections } from "./routes";
import type { AdminIconName } from "../admin-icons";
import { money, type StoreState } from "./model";

export const searchCategoryLabels = {
  apps: ["Apps", "Приложения"],
  customers: ["Customers", "Клиенти"],
  orders: ["Orders", "Поръчки"],
  products: ["Products", "Продукти"],
  sales: ["Sales channels", "Канали за продажба"],
  navigation: ["Navigation", "Навигация"],
  settings: ["Settings", "Настройки"],
  content: ["Content", "Съдържание"],
} as const;
export type SearchCategory = keyof typeof searchCategoryLabels;
export type SearchItem = {
  id: string;
  category: SearchCategory;
  title: string;
  description: string;
  keywords: string;
  destination: string;
  icon: AdminIconName;
};
const settingsLabels: Record<
  (typeof settingsSections)[number],
  readonly [string, string]
> = {
  general: ["General", "Общи"],
  plan: ["Plan", "План"],
  billing: ["Billing", "Таксуване"],
  users: ["Users", "Потребители"],
  payments: ["Payments", "Плащания"],
  checkout: ["Checkout", "Поръчване"],
  "customer-accounts": ["Customer accounts", "Клиентски акаунти"],
  shipping: ["Shipping and delivery", "Доставка"],
  taxes: ["Taxes and duties", "Данъци"],
  locations: ["Locations", "Локации"],
  markets: ["Markets", "Пазари"],
  apps: ["Apps", "Приложения"],
  domains: ["Domains", "Домейни"],
  events: ["Customer events", "Клиентски събития"],
  notifications: ["Notifications", "Известия"],
  "custom-data": ["Metafields and metaobjects", "Потребителски данни"],
  languages: ["Languages", "Езици"],
  privacy: ["Customer privacy", "Поверителност"],
  policies: ["Policies", "Политики"],
};

/** Synthetic, current-store records only. Destinations cannot escape the guarded preview. */
export function previewSearchItems(
  store: StoreState,
  language: "en" | "bg",
): SearchItem[] {
  const bg = language === "bg";
  const items: SearchItem[] = [];
  const add = (item: Omit<SearchItem, "id">) => {
    if (parsePreviewRoute(item.destination.split("/")))
      items.push({ ...item, id: `${item.category}:${item.destination}` });
  };
  for (const p of store.products)
    add({
      category: "products",
      title: p.title || (bg ? "Без заглавие" : "Untitled product"),
      description: `${p.status} · ${money(p.price)}${p.sku ? ` · ${p.sku}` : ""}`,
      keywords: `${p.title} ${p.sku} ${p.category} ${p.vendor} ${p.tags}`,
      destination: `products/${p.id}`,
      icon: "product",
    });
  for (const c of store.customers)
    add({
      category: "customers",
      title: `${c.first} ${c.last}`.trim() || c.email,
      description: c.email,
      keywords: `${c.first} ${c.last} ${c.email} ${c.phone}`,
      destination: `customers/${c.id}`,
      icon: "customers",
    });
  for (const o of store.orders) {
    const customer = store.customers.find((c) => c.id === o.customerId);
    const name = customer
      ? `${customer.first} ${customer.last}`.trim()
      : bg
        ? "Гост"
        : "Guest";
    add({
      category: "orders",
      title: `#${o.id}`,
      description: `${name} · ${o.payment} · ${o.fulfillment}`,
      keywords: `${o.id} ${name} ${customer?.email ?? ""} ${o.payment} ${o.fulfillment} ${o.kind}`,
      destination: `${o.kind === "Draft" ? "drafts" : "orders"}/${o.id}`,
      icon: "orders",
    });
  }
  for (const e of store.entries) {
    const section =
      e.type === "File" ? "files" : e.type === "Page" ? "pages" : "content";
    add({
      category: "content",
      title: e.title,
      description: `${e.type} · ${e.status}`,
      keywords: `${e.title} ${e.type} ${e.tags}`,
      destination: `${section}/${e.id}`,
      icon: "content",
    });
  }
  add({
    category: "apps",
    title: bg ? "Съобщения" : "Inbox",
    description: bg ? "Разговори с клиенти" : "Customer conversations",
    keywords: "Inbox messages Съобщения разговори",
    destination: "inbox",
    icon: "inbox",
  });
  add({
    category: "apps",
    title: bg ? "Екип" : "Team",
    description: bg ? "Управлявай екипа си" : "Manage your team",
    keywords: "Team members users Екип потребители",
    destination: "team",
    icon: "customers",
  });
  add({
    category: "sales",
    title: store.settings.name,
    description: bg ? "Магазин" : "Online store",
    keywords: `${store.settings.name} Online store Магазин`,
    destination: "store",
    icon: "store",
  });
  for (const [section, names] of Object.entries(labels))
    add({
      category: "navigation",
      title: names[bg ? 1 : 0],
      description: bg ? "Отвори страницата" : "Go to page",
      keywords: names.join(" "),
      destination: section,
      icon: "arrow",
    });
  for (const section of settingsSections)
    add({
      category: "settings",
      title: settingsLabels[section][bg ? 1 : 0],
      description: bg ? "Настройки на магазина" : "Store settings",
      keywords: settingsLabels[section].join(" "),
      destination: `settings/${section}`,
      icon: "settings",
    });
  add({
    category: "navigation",
    title: bg ? "Добави продукт" : "Add product",
    description: bg ? "Създай нова чернова" : "Create a new draft",
    keywords: "Add product Добави продукт",
    destination: "products/new",
    icon: "plus",
  });
  return items;
}

export function searchPreviewItems(
  items: readonly SearchItem[],
  query: string,
  category: SearchCategory | "all" = "all",
) {
  const normalize = (text: string) => text.normalize("NFKC").toLowerCase();
  const needle = normalize(query.trim().slice(0, 160));
  if (!needle && category === "all") return [];
  const words = needle.split(/\s+/).filter(Boolean);
  return items
    .filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      const haystack = normalize(
        `${item.title} ${item.description} ${item.keywords}`,
      );
      return words.every((word) => haystack.includes(word));
    })
    .map((item, index) => ({
      item,
      index,
      rank:
        normalize(item.title) === needle
          ? 0
          : normalize(item.title).startsWith(needle)
            ? 1
            : 2,
    }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ item }) => item);
}
