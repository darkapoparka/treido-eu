export const previewSections = [
  "home",
  "products",
  "collections",
  "inventory",
  "imports",
  "orders",
  "drafts",
  "customers",
  "segments",
  "growth",
  "discounts",
  "content",
  "files",
  "pages",
  "markets",
  "finance",
  "payouts",
  "billing",
  "analytics",
  "reports",
  "inbox",
  "store",
  "team",
  "settings",
  "notifications",
  "purchase-orders",
  "transfers",
  "gift-cards",
  "companies",
  "menus",
  "blog-posts",
  "catalogs",
  "rollouts",
  "live",
  "agentic",
] as const;
export type PreviewSection = (typeof previewSections)[number];
export type PreviewRoute = { section: PreviewSection; detail?: string };
export const settingsSections = [
  "general",
  "plan",
  "billing",
  "users",
  "roles",
  "security",
  "payments",
  "checkout",
  "customer-accounts",
  "shipping",
  "taxes",
  "locations",
  "markets",
  "apps",
  "sales-channels",
  "domains",
  "events",
  "notifications",
  "custom-data",
  "languages",
  "privacy",
  "policies",
] as const;
export type SettingsSection = (typeof settingsSections)[number];

/** Only synthetic UI destinations; never a continuation into private seller routes. */
export function parsePreviewRoute(
  parts: readonly string[] = [],
): PreviewRoute | null {
  if (!parts.length) return { section: "home" };
  const [section, detail] = parts;
  if (parts.length > 2 || !previewSections.some((value) => value === section))
    return null;
  if (
    detail &&
    (!/^[a-z0-9-]{1,80}$/.test(detail) ||
      (section === "settings" &&
        !settingsSections.some((value) => value === detail)))
  )
    return null;
  return { section: section as PreviewSection, ...(detail ? { detail } : {}) };
}
export function previewHref(
  section: string = "home",
  language = "en",
  store = "studio",
) {
  return `/admin-preview${section === "home" ? "" : `/${section}`}?lang=${language === "bg" ? "bg" : "en"}&store=${store === "personal" ? "personal" : "studio"}`;
}
export function adminPreviewEnabled(env: Record<string, string | undefined>) {
  return (
    env.SHOP_REFERENCE_PREVIEW === "1" &&
    !env.VERCEL &&
    env.VERCEL_ENV !== "production" &&
    env.NODE_ENV !== "production"
  );
}

export const labels: Record<PreviewSection, readonly [string, string]> = {
  agentic: ["Agentic", "AI канали"],
  home: ["Home", "Начало"],
  products: ["Products", "Продукти"],
  collections: ["Collections", "Колекции"],
  inventory: ["Inventory", "Наличности"],
  imports: ["Imports", "Импортиране"],
  orders: ["Orders", "Поръчки"],
  drafts: ["Draft orders", "Чернови на поръчки"],
  customers: ["Customers", "Клиенти"],
  segments: ["Segments", "Сегменти"],
  growth: ["Growth", "Развитие"],
  discounts: ["Discounts", "Отстъпки"],
  content: ["Content", "Съдържание"],
  files: ["Files", "Файлове"],
  pages: ["Pages", "Страници"],
  markets: ["Markets", "Пазари"],
  finance: ["Finance", "Финанси"],
  payouts: ["Payouts", "Изплащания"],
  billing: ["Billing", "Таксуване"],
  analytics: ["Analytics", "Анализи"],
  reports: ["Reports", "Отчети"],
  inbox: ["Inbox", "Съобщения"],
  store: ["Store", "Магазин"],
  team: ["Team", "Екип"],
  settings: ["Settings", "Настройки"],
  notifications: ["Notifications", "Известия"],
  "purchase-orders": ["Purchase orders", "Поръчки към доставчици"],
  transfers: ["Transfers", "Трансфери"],
  "gift-cards": ["Gift cards", "Подаръчни карти"],
  companies: ["Companies", "Компании"],
  menus: ["Menus", "Менюта"],
  "blog-posts": ["Blog posts", "Публикации в блога"],
  catalogs: ["Catalogs", "Каталози"],
  rollouts: ["Rollouts", "Пускания"],
  live: ["Live view", "Изглед на живо"],
};
