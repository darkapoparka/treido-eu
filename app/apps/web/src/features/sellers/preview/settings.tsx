"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { LanguageChoice } from "../../locale/language-choice";
import { settingsOptionKeys } from "./settings-option-keys";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminIcon, type AdminIconName } from "../admin-icons";
import admin from "../admin.module.css";
import { usePreview } from "./context";
import { defaultSettings, parseMoney } from "./model";
import { settingsSections, labels, type SettingsSection } from "./routes";
import { Team } from "./workspace";
import { SettingsSearchButton, useSettingsSearch } from "./settings-search";
import { WorkspaceLinks } from "./workspace-links";
import { SettingsOverview } from "./settings-overview";
import { SalesChannels } from "./sales-channels";
import { Action, Badge, Button, Check, Field, Modal, Panel, s } from "./ui";
const menu: Record<
  SettingsSection,
  { title: string; bg: string; icon: AdminIconName }
> = {
  general: { title: "General", bg: "Общи", icon: "store" },
  plan: { title: "Plan", bg: "План", icon: "growth" },
  billing: { title: "Billing", bg: "Таксуване", icon: "finance" },
  users: { title: "Users", bg: "Потребители", icon: "customers" },
  payments: { title: "Payments", bg: "Плащания", icon: "finance" },
  checkout: { title: "Checkout", bg: "Поръчване", icon: "orders" },
  "customer-accounts": {
    title: "Customer accounts",
    bg: "Клиентски акаунти",
    icon: "customers",
  },
  shipping: { title: "Shipping and delivery", bg: "Доставка", icon: "orders" },
  taxes: { title: "Taxes and duties", bg: "Данъци", icon: "finance" },
  locations: { title: "Locations", bg: "Локации", icon: "markets" },
  markets: { title: "Markets", bg: "Пазари", icon: "markets" },
  apps: { title: "Apps", bg: "Приложения", icon: "plus" },
  domains: { title: "Domains", bg: "Домейни", icon: "store" },
  events: {
    title: "Customer events",
    bg: "Клиентски събития",
    icon: "analytics",
  },
  notifications: { title: "Notifications", bg: "Известия", icon: "bell" },
  "custom-data": {
    title: "Metafields and metaobjects",
    bg: "Потребителски данни",
    icon: "content",
  },
  languages: { title: "Languages", bg: "Езици", icon: "markets" },
  privacy: { title: "Customer privacy", bg: "Поверителност", icon: "settings" },
  policies: { title: "Policies", bg: "Политики", icon: "content" },
  roles: { title: "Roles", bg: "Роли", icon: "customers" },
  security: { title: "Security", bg: "Сигурност", icon: "settings" },
  "sales-channels": {
    title: "Sales channels",
    bg: "Канали за продажба",
    icon: "store",
  },
};
export function Settings({
  section = "general",
}: {
  section?: SettingsSection;
}) {
  const t = useTranslations("studioSettings");
  const { store, href, text, language } = usePreview();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const searchParams = useSearchParams();
  const mobileMenu = searchParams.has("settings-navigation");
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const breakpoint = window.matchMedia("(max-width: 767px)");
    const updatePhone = () => setPhone(breakpoint.matches);
    updatePhone();
    breakpoint.addEventListener("change", updatePhone);
    return () => breakpoint.removeEventListener("change", updatePhone);
  }, []);
  const openMobileMenu = () =>
    router.push(`${href(`settings/${section}`)}&settings-navigation=1`, {
      scroll: false,
    });
  const closeMobileMenu = () =>
    router.replace(href(`settings/${section}`), { scroll: false });
  const storeSearch = useSettingsSearch();
  const items = settingsSections.filter(
    (key) =>
      key !== "markets" &&
      (key !== "roles" || ["users", "roles"].includes(section) || !!query) &&
      (menu[key].title.toLowerCase().includes(query.toLowerCase()) ||
        menu[key].bg.toLowerCase().includes(query.toLowerCase())),
  );
  return (
    <div className={s.settingsShell} data-studio-part="settings-shell">
      <nav
        className={s.settingsRail}
        data-studio-part="settings-rail"
        aria-label={t("mainNavigation")}
      >
        <Link href={href()} aria-label={t("treidoHome")}>
          <span className={admin.brandMark} data-studio-part="brand-mark">
            t
          </span>
        </Link>
        <SettingsSearchButton open={storeSearch.open} />
        {(
          [
            "home",
            "orders",
            "products",
            "customers",
            "growth",
            "discounts",
            "content",
            "markets",
            "finance",
            "analytics",
            "inbox",
            "store",
          ] as const
        ).map((section) => {
          const icon: AdminIconName =
            section === "products"
              ? "product"
              : section === "discounts"
                ? "discount"
                : section;
          return (
            <Link
              key={section}
              href={href(section)}
              aria-label={labels[section][language === "bg" ? 1 : 0]}
            >
              <AdminIcon name={icon} />
            </Link>
          );
        })}
        <div data-studio-part="settings-rail-footer">
          <Link
            href={href(`settings/${section}`)}
            aria-label={text("Settings", "Настройки")}
            aria-current="page"
          >
            <AdminIcon name="settings" />
          </Link>
          <Link
            href={href("notifications")}
            aria-label={text("Alerts", "Известия")}
          >
            <AdminIcon name="bell" />
          </Link>
          <details data-studio-part="settings-account">
            <summary aria-label={text("Store account", "Акаунт на магазина")}>
              {store.settings.name.slice(0, 2).toUpperCase()}
            </summary>
            <div data-studio-part="settings-account-links">
              <WorkspaceLinks />
              <Link href={href("team")}>{text("Team", "Екип")}</Link>
            </div>
          </details>
        </div>
      </nav>
      <aside className={s.settingsNav} data-studio-part="settings-nav">
        <Link href={href()}>
          <AdminIcon name="back" />
          {text("Settings", "Настройки")}
        </Link>
        <input
          type="search"
          aria-label={t("searchSettings")}
          placeholder={text("Search", "Търси")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className={s.storeName} data-studio-part="settings-identity">
          <div>
            <strong>{store.settings.name}</strong>
            <small>{store.settings.handle}.treido.eu</small>
          </div>
          <span>{store.settings.name.slice(0, 2).toUpperCase()}</span>
        </div>
        <nav
          aria-label={t("shopSettingsMenu")}
          data-studio-part="settings-links"
        >
          {items.map((key) => (
            <Link
              key={key}
              href={href(`settings/${key}`)}
              aria-current={key === section ? "page" : undefined}
              data-settings-nested={
                key === "roles" || key === "security" || undefined
              }
            >
              <AdminIcon name={menu[key].icon} />
              {text(menu[key].title, menu[key].bg)}
            </Link>
          ))}
        </nav>
        {!items.length && <p>{t("noMatchingSettings")}</p>}
      </aside>
      <main
        className={s.settingsCanvas}
        data-studio-part="settings-canvas"
        id="settings-content"
        tabIndex={-1}
      >
        <div className={s.settingsMobile} data-studio-part="settings-mobile">
          <SettingsSearchButton
            open={storeSearch.open}
            className={s.settingsSearchButton}
            data-studio-part="settings-search-button"
          />
          <Button
            className={`${s.button} ${s.settingsBack}`}
            data-studio-part="settings-back"
            onClick={openMobileMenu}
            aria-label={t("settingsMenu")}
            aria-haspopup="dialog"
          >
            <AdminIcon name="back" />
          </Button>
          <select
            hidden
            aria-label={t("settingsSection")}
            value={section}
            onChange={(e) => router.push(href(`settings/${e.target.value}`))}
          >
            {settingsSections.map((key) => (
              <option key={key} value={key}>
                {text(menu[key].title, menu[key].bg)}
              </option>
            ))}
          </select>
        </div>
        <div className={s.settingsContent} data-studio-part="settings-content">
          <h1>{text(menu[section].title, menu[section].bg)}</h1>
          <SettingsBody key={section} section={section} />
        </div>
      </main>
      {storeSearch.overlay}
      {phone && mobileMenu && (
        <Modal
          title={t("settingsMenu")}
          onClose={closeMobileMenu}
          surface="settings-navigation"
        >
          <div data-studio-part="settings-mobile-identity">
            <span aria-hidden="true">
              {store.settings.name.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <strong>{store.settings.name}</strong>
              <small>{store.settings.handle}.treido.eu</small>
            </div>
          </div>
          <label data-studio-part="settings-mobile-search">
            <AdminIcon name="search" />
            <input
              type="search"
              aria-label={t("searchSettings")}
              placeholder={text("Search", "Търси")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <nav
            aria-label={t("mobileSettings")}
            data-studio-part="settings-mobile-links"
          >
            {items.map((key) => (
              <Link
                key={key}
                className={s.choice}
                data-studio-part="settings-link"
                data-settings-nested={
                  key === "roles" || key === "security" || undefined
                }
                href={href(`settings/${key}`)}
                aria-current={key === section ? "page" : undefined}
              >
                <AdminIcon name={menu[key].icon} />
                <span>{text(menu[key].title, menu[key].bg)}</span>
                <span data-studio-part="settings-chevron" aria-hidden="true">
                  ›
                </span>
              </Link>
            ))}
            {!items.length && <p role="status">{t("noMatchingSettings")}</p>}
          </nav>
        </Modal>
      )}
    </div>
  );
}
function SettingsBody({ section }: { section: SettingsSection }) {
  const t = useTranslations("studioSettings");
  const { store, href, update, notify, text } = usePreview();
  const optionText = (value: string) => {
    const key = settingsOptionKeys[value as keyof typeof settingsOptionKeys];
    return key ? t(key) : value;
  };
  const [draft, setDraft] = useState({ ...defaultSettings, ...store.settings });
  const [dialog, setDialog] = useState<
    "contact" | "address" | "template" | "resources" | null
  >(null);
  const [template, setTemplate] = useState("Order confirmation");
  const [error, setError] = useState("");
  const value = (key: string, fallback = "") => draft[key] ?? fallback;
  const patch = (key: string, val: string) =>
    setDraft({ ...draft, [key]: val });
  const save = () => {
    if (
      !draft.name.trim() ||
      !/^\S+@\S+\.\S+$/.test(draft.email) ||
      parseMoney(draft.shippingRate) === null ||
      parseMoney(draft.freeShipping) === null
    ) {
      setError(t("checkTheStoreNameContactEmailAndShippingAmounts"));
      return false;
    }
    update({ settings: draft });
    notify(t("settingsSavedInThisFrontendPreview"));
    setError("");
    return true;
  };
  const input = (key: string, label: string, type = "text", help?: string) => (
    <Field label={label} help={help}>
      <input
        type={type}
        maxLength={200}
        value={value(key)}
        onChange={(e) => patch(key, e.target.value)}
      />
    </Field>
  );
  const select = (
    key: string,
    label: string,
    options: string[],
    fallback = options[0],
  ) => (
    <Field label={label}>
      <select
        value={value(key, fallback)}
        onChange={(e) => patch(key, e.target.value)}
      >
        {options.map((v) => (
          <option key={v} value={v}>
            {optionText(v)}
          </option>
        ))}
      </select>
    </Field>
  );
  const check = (key: string, label: string, fallback = false) => (
    <Check
      label={label}
      checked={value(key, String(fallback)) === "true"}
      onChange={() =>
        patch(key, String(value(key, String(fallback)) !== "true"))
      }
    />
  );
  const textarea = (key: string, label: string) => (
    <Field label={label}>
      <textarea
        maxLength={6000}
        value={value(key)}
        onChange={(e) => patch(key, e.target.value)}
      />
    </Field>
  );
  const saveButton = (
    <div className={s.saveBar} data-studio-part="save-bar">
      <Button primary onClick={save}>
        {t("save")}
      </Button>
    </div>
  );
  if (section === "users") return <Team embedded />;
  if (section === "roles")
    return (
      <Panel title={text("Preview roles", "Примерни роли")}>
        <p>
          {text(
            "Review fictional member roles in Users. Real permissions require current server authorization.",
            "Прегледайте примерните роли в Потребители. Реалните права изискват текущо разрешение от сървъра.",
          )}
        </p>
        <Action href={href("settings/users")}>
          {text("Review users", "Преглед на потребителите")}
        </Action>
      </Panel>
    );
  if (section === "security")
    return (
      <Panel title={text("Account security", "Сигурност на акаунта")}>
        <p>
          {text(
            "This device-local preview has no authenticated account or security settings. Real account security belongs to the private workspace.",
            "Този локален преглед няма удостоверен акаунт или настройки за сигурност. Реалната сигурност се управлява в личното работно пространство.",
          )}
        </p>
        <Button disabled>
          {text("Manage authentication", "Управление на удостоверяването")}
        </Button>
      </Panel>
    );
  if (section === "sales-channels") return <SalesChannels />;
  if (section === "general")
    return (
      <>
        <section>
          <h2>{t("businessDetails")}</h2>
          <p>{t("businessInformationUsedForMarketsAppsAndStoreOperations")}</p>
          <Panel>
            <div className={s.dataRow} data-studio-part="data-row">
              <svg
                width="32"
                height="24"
                viewBox="0 0 32 24"
                aria-label={t("bulgaria")}
              >
                <rect
                  x="0.5"
                  y="0.5"
                  width="31"
                  height="23"
                  rx="2"
                  fill="white"
                  stroke="#ddd"
                />
                <path d="M1 8h30v8H1Z" fill="#139252" />
                <path d="M1 16h30v7H1Z" fill="#d52b1e" />
              </svg>
              <div style={{ flex: 1 }}>
                <span>
                  {draft.name} {t("business")}
                </span>
                <p className={s.muted} data-studio-part="muted">
                  {optionText(draft.country)}
                </p>
              </div>
              <Button
                plain
                onClick={() => setDialog("contact")}
                aria-label={t("editBusinessDetails")}
              >
                <AdminIcon name="more" />
              </Button>
            </div>
          </Panel>
        </section>
        <section>
          <h2>{t("storeContactDetails")}</h2>
          <Panel>
            <div className={s.dataRow} data-studio-part="data-row">
              <AdminIcon name="store" />
              <div style={{ flex: 1 }}>
                <h3>{draft.name}</h3>
                <p className={s.muted} data-studio-part="muted">
                  {draft.email} · {draft.phone || t("noPhoneNumber")}
                </p>
              </div>
              <Button
                plain
                onClick={() => setDialog("contact")}
                aria-label={t("editStoreContactDetails")}
              >
                ›
              </Button>
            </div>
            <div className={s.dataRow} data-studio-part="data-row">
              <AdminIcon name="markets" />
              <div style={{ flex: 1 }}>
                <h3>{t("storeAddress")}</h3>
                <p className={s.muted} data-studio-part="muted">
                  {[draft.address, draft.city, optionText(draft.country)]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
              <Button
                plain
                onClick={() => setDialog("address")}
                aria-label={t("editStoreAddress")}
              >
                ›
              </Button>
            </div>
          </Panel>
        </section>
        <section>
          <h2>{t("storeDefaults")}</h2>
          <Panel>
            <div className={`${s.dataRow} ${s.currencyRow}`}>
              <div>
                <h3>{t("currencyDisplay")}</h3>
                <p className={s.help} data-studio-part="field-help">
                  {t("manageTheCurrenciesCustomersSeeInMarkets")}
                </p>
              </div>
              <Badge>
                {draft.currency === "EUR" ? t("euroEur") : draft.currency}
              </Badge>
              <Link
                className={`${s.button} ${s.plain}`}
                href={href("markets")}
                aria-label={t("manageCurrencies")}
              >
                <AdminIcon name="more" />
              </Link>
            </div>
            {select("country", t("backupRegion"), [
              "Bulgaria",
              "Greece",
              "Romania",
              "Germany",
            ])}
            <p className={s.help} data-studio-part="backup-region-help">
              {text(
                "Used when a customer's location cannot be determined in this preview.",
                "Използва се, когато местоположението на клиента не може да бъде определено в прегледа.",
              )}
            </p>
            <div
              className={s.fields}
              data-studio-part="fields"
              style={{ marginTop: 24 }}
            >
              {select("units", t("unitSystem"), [
                "Metric system",
                "Imperial system",
              ])}
              {select("weight", t("defaultWeightUnit"), [
                "Kilogram (kg)",
                "Gram (g)",
              ])}
            </div>
            {select("timezone", t("timeZone"), [
              "Europe/Sofia",
              "Europe/Athens",
              "Europe/Berlin",
              "Europe/London",
              "America/New_York",
            ])}
            <p className={s.help} data-studio-part="field-help">
              {t("setsTheTimeForOrderAndReportDisplayInThisPreview")}
            </p>
          </Panel>
        </section>
        <section>
          <h2>{t("orderIdFormat")}</h2>
          <Panel>
            <div className={s.fields} data-studio-part="fields">
              {input("orderPrefix", t("prefix"))}
              {input("orderSuffix", t("suffix"))}
            </div>
            <p className={s.help} data-studio-part="field-help">
              {t("yourOrderIdsWillAppearAs")} {value("orderPrefix", "#")}1001
              {value("orderSuffix")}, {value("orderPrefix", "#")}1002
              {value("orderSuffix")}, …
            </p>
          </Panel>
        </section>
        <section>
          <h2>{t("orderProcessing")}</h2>
          <Panel>
            {check("confirmCheckout", t("requireAConfirmationStep"))}
            <p className={s.help}>
              {text(
                "These local preferences do not fulfill real orders.",
                "Тези локални предпочитания не изпълняват реални поръчки.",
              )}
            </p>
            <fieldset
              className={s.processingOptions}
              data-studio-part="processing-options"
            >
              <legend>{t("afterAnOrderHasBeenPaid")}</legend>
              {[
                [
                  "Automatically fulfill items",
                  "Автоматично изпълнение на артикули",
                ],
                [
                  "Automatically fulfill gift cards only",
                  "Автоматично изпълнение само на подаръчни карти",
                ],
                ["Do not fulfill automatically", "Без автоматично изпълнение"],
              ].map(([en, bg]) => (
                <Check
                  key={en}
                  radio
                  name="preview-order-processing"
                  label={text(en, bg)}
                  checked={
                    value("fulfillment", "Do not fulfill automatically") === en
                  }
                  onChange={() => patch("fulfillment", en)}
                />
              ))}
            </fieldset>
            {check(
              "archiveOrders",
              t("automaticallyArchiveCompletedOrders"),
              true,
            )}
          </Panel>
        </section>
        <section>
          <h2>{t("storeAssets")}</h2>
          <Panel>
            <div className={s.dataRow} data-studio-part="data-row">
              <span>{t("brand")}</span>
              <Action href={href("store")}>{t("manageBrand")}</Action>
            </div>
            <div className={s.dataRow} data-studio-part="data-row">
              <span>{t("customContent")}</span>
              <Action href={href("content")}>{t("manageContent")}</Action>
            </div>
          </Panel>
        </section>
        <section data-studio-part="settings-resources">
          <h2>{text("Resources", "Ресурси")}</h2>
          <Panel>
            <div className={s.dataRow}>
              <span>
                {text(
                  "Preview help and keyboard shortcuts",
                  "Помощ и клавишни комбинации за прегледа",
                )}
              </span>
              <Button plain onClick={() => setDialog("resources")}>
                ›
              </Button>
            </div>
            <div className={s.dataRow}>
              <span>{text("Store activity", "Активност в магазина")}</span>
              <Action plain href={href("notifications")}>
                {text("Review", "Преглед")}
              </Action>
            </div>
            <div className={s.dataRow}>
              <span>{text("Change log", "История на промените")}</span>
              <span className={s.help}>
                {text("Not available in preview", "Не е достъпна в прегледа")}
              </span>
            </div>
          </Panel>
        </section>
        <section data-studio-part="settings-transfer">
          <h2>{text("Transfer store", "Прехвърляне на магазина")}</h2>
          <Panel>
            <p className={s.help}>
              {text(
                "This fictional store has no authenticated ownership to transfer.",
                "Този примерен магазин няма удостоверена собственост за прехвърляне.",
              )}
            </p>
            <Button disabled>{text("Manage", "Управление")}</Button>
          </Panel>
        </section>
        <section data-studio-part="settings-deactivate">
          <h2>{text("Deactivate store", "Деактивиране на магазина")}</h2>
          <Panel>
            <p className={s.help}>
              {text(
                "Account lifecycle actions are unavailable in this device-local preview.",
                "Действията по жизнения цикъл на акаунта не са достъпни в локалния преглед.",
              )}
            </p>
            <Button disabled danger>
              {text("Deactivate store", "Деактивиране на магазина")}
            </Button>
          </Panel>
        </section>
        {error && (
          <p className={s.error} data-studio-part="error" role="alert">
            {error}
          </p>
        )}
        {saveButton}
        {dialog && (
          <Modal
            title={
              dialog === "address"
                ? t("storeAddress")
                : dialog === "resources"
                  ? text("Preview help", "Помощ за прегледа")
                  : t("storeContactDetails")
            }
            onClose={() => setDialog(null)}
            footer={
              <Button primary onClick={() => setDialog(null)}>
                {t("done")}
              </Button>
            }
          >
            {dialog === "resources" ? (
              <>
                <p>
                  {text(
                    "Ctrl/⌘ K opens store search. Escape clears a filled search before closing it. Menu opens the main navigation; Settings has its own navigator.",
                    "Ctrl/⌘ K отваря търсенето в магазина. Escape изчиства попълненото търсене преди затварянето му. Меню отваря основната навигация; Настройки има отделен навигатор.",
                  )}
                </p>
                <p>
                  {text(
                    "Records and preferences stay on this device. Connected payments, communications, and account changes require the private workspace.",
                    "Записите и предпочитанията остават на това устройство. Свързаните плащания, съобщения и промени на акаунта изискват личното работно пространство.",
                  )}
                </p>
              </>
            ) : dialog === "address" ? (
              <>
                {input("address", t("address"))}
                <div className={s.fields} data-studio-part="fields">
                  {input("city", t("city"))}
                  {input("postcode", t("postalCode"))}
                </div>
                {select("country", t("country"), [
                  "Bulgaria",
                  "Greece",
                  "Romania",
                  "Germany",
                ])}
              </>
            ) : (
              <>
                {input("name", t("storeName"))}
                {input("email", t("contactEmail"), "email")}
                {input("phone", t("phoneNumber"), "tel")}
              </>
            )}
            <p className={s.help} data-studio-part="field-help">
              {t("saveGeneralSettingsToKeepTheseChanges")}
            </p>
          </Modal>
        )}
      </>
    );
  const blocks: Partial<Record<SettingsSection, React.ReactNode>> = {
    plan: (
      <>
        <Panel title={t("currentPlan")}>
          <div className={s.dataRow} data-studio-part="data-row">
            <strong>{draft.plan}</strong>
            <Badge>{t("previewSelection")}</Badge>
          </div>
          <p className={s.help} data-studio-part="field-help">
            {t(
              "reviewThePlanChoicePricesAndEntitlementsWillBeConfiguredWithTheBackend",
            )}
          </p>
        </Panel>
        <div className={s.stack} data-studio-part="stack">
          {["Free", "Starter", "Business"].map((v) => (
            <Panel key={v} title={v}>
              <p>
                {v === "Free"
                  ? t("startWithPersonalSellingAndASimpleCatalog")
                  : v === "Starter"
                    ? t("aWorkspaceForAGrowingBusinessCatalog")
                    : t("teamToolsReportsAndStoreManagement")}
              </p>
              <Button
                primary={draft.plan === v}
                onClick={() => patch("plan", v)}
              >
                {draft.plan === v ? t("selected") : t("choosePlan")}
              </Button>
            </Panel>
          ))}
        </div>
      </>
    ),
    billing: (
      <>
        <Panel title={t("billingProfile")}>
          {input("name", t("businessName"))}
          {input("billingEmail", t("billingEmail"), "email")}
          {input("address", t("billingAddress"))}
          <div className={s.fields} data-studio-part="fields">
            {input("city", t("city"))}
            {input("postcode", t("postalCode"))}
          </div>
          {input("vatNumber", t("vatNumber"))}
        </Panel>
        <Panel title={t("invoices")}>
          <p className={s.muted} data-studio-part="muted">
            {t("noInvoicesExistInTheFrontendPreview")}
          </p>
          <Action href={href("billing")}>{t("billingOverview")}</Action>
        </Panel>
      </>
    ),
    payments: (
      <>
        <Panel title={t("paymentProviders")}>
          <Badge>{t("notConnected")}</Badge>
          <p>
            {t(
              "selectThePaymentFlowToReviewInTheFrontendNoProviderIsActivated",
            )}
          </p>
          {select("paymentMethod", t("paymentMethod"), [
            "Not connected",
            "Card payment (preview)",
            "Manual payment",
            "Cash on delivery",
          ])}
          {textarea("paymentInstructions", t("paymentInstructions"))}
        </Panel>
        <Panel title={t("paymentCapture")}>
          {select("capture", t("captureMethod"), [
            "Automatically at checkout",
            "Manually after review",
          ])}
          <p className={s.help} data-studio-part="field-help">
            {t(
              "theServerAndPaymentProviderWillEnforceCaptureRulesAfterIntegration",
            )}
          </p>
        </Panel>
      </>
    ),
    checkout: (
      <>
        <Panel title={t("customerContactMethod")}>
          {select("contactMethod", t("customersCanCheckOutUsing"), [
            "Email",
            "Phone number or email",
          ])}
          {check("showTracking", t("showATrackingLinkAfterPurchase"), true)}
        </Panel>
        <Panel title={t("customerInformation")}>
          {select("fullName", t("fullName"), [
            "Require first and last name",
            "Last name only",
          ])}
          {select("companyField", t("companyName"), [
            "Do not include",
            "Optional",
            "Required",
          ])}
          {select("addressLine2", t("addressLine2"), [
            "Optional",
            "Required",
            "Do not include",
          ])}
          {select("phoneRequired", t("shippingPhoneNumber"), [
            "Optional",
            "Required",
          ])}
        </Panel>
        <Panel title={t("orderProcessing")}>
          {check("confirmCheckout", t("requireAConfirmationStep"))}
          {check("marketingCheckbox", t("displayEmailMarketingPreference"))}
          {input("checkoutNote", t("orderNoteLabel"))}
        </Panel>
      </>
    ),
    "customer-accounts": (
      <>
        <Panel title={t("customerAccounts")}>
          {select("accountMode", t("accountExperience"), [
            "Optional account",
            "Account required",
            "Guest checkout",
          ])}
          {check("showAccountLink", t("showAccountLinks"), true)}
          <p className={s.help} data-studio-part="field-help">
            {t(
              "theseAreFrontendChoicesCustomerAuthenticationWillBeIntegratedLater",
            )}
          </p>
        </Panel>
        <Panel title={t("accountPages")}>
          <Action href={href("customers")}>
            {t("reviewCustomerProfiles")}
          </Action>
          <Action href={href("settings/privacy")}>
            {t("customerPrivacy")}
          </Action>
        </Panel>
      </>
    ),
    shipping: (
      <>
        <Panel title={t("shipping")}>
          <h3>{t("generalShippingProfile")}</h3>
          <p>{t("applyTheDefaultProfileToYourPhysicalProducts")}</p>
          {select("delivery", t("deliveryOptions"), [
            "Shipping and local pickup",
            "Shipping only",
            "Local pickup only",
          ])}
          <div className={s.fields} data-studio-part="fields">
            {input("shippingRate", t("shippingRateEur"))}
            {input("freeShipping", t("freeShippingAboveEur"))}
          </div>
          {input("shippingRegions", t("countriesInThisShippingZone"))}
          {select("dispatch", t("dispatchTime"), [
            "1–2 business days",
            "3–5 business days",
            "Custom arrangement",
          ])}
        </Panel>
        <Panel title={t("localPickup")}>
          {check("pickupEnabled", t("enableLocalPickupInThePreview"))}
          {input("city", t("pickupCity"))}
          {input("pickupInstructions", t("pickupInstructions"))}
        </Panel>
        <Panel title={t("deliveryNotes")}>
          {textarea("deliveryNotes", t("customerDeliveryInformation"))}
        </Panel>
      </>
    ),
    taxes: (
      <>
        <Panel title={t("taxDisplay")}>
          {check("taxIncluded", t("includeTaxInDisplayedPrices"), true)}
          {input("tax", t("defaultDisplayRate"), "number")}
          <p className={s.help} data-studio-part="field-help">
            {t(
              "previewDisplayPreferencesOnlyRatesAndCollectionRequireAVerifiedTaxAdapter",
            )}
          </p>
        </Panel>
        <Panel title={t("businessRegistration")}>
          {input("vatNumber", t("vatNumber"))}
          {input("legalName", t("registeredBusinessName"))}
          <Action href={href("markets")}>{t("reviewMarkets")}</Action>
        </Panel>
      </>
    ),
    locations: (
      <>
        <Panel title={t("primaryLocation")}>
          {input("locationName", t("locationName"))}
          {input("address", t("address"))}
          <div className={s.fields} data-studio-part="fields">
            {input("city", t("city"))}
            {input("postcode", t("postalCode"))}
          </div>
          {select("country", t("country"), [
            "Bulgaria",
            "Greece",
            "Romania",
            "Germany",
          ])}
          {check("fulfillLocation", t("useThisLocationForFulfillment"), true)}
        </Panel>
        <Panel title={t("inventory")}>
          <Action href={href("inventory")}>{t("manageQuantities")}</Action>
        </Panel>
      </>
    ),
    markets: (
      <Panel title={t("regionalMarkets")}>
        <p>{t("setUpTheRegionsWhereYourStoreWillOperate")}</p>
        {store.markets.map((m) => (
          <div className={s.dataRow} data-studio-part="data-row" key={m.id}>
            <span>{m.title}</span>
            <Badge>{m.status}</Badge>
            <Action href={href(`markets/${m.id}`)}>{t("manage")}</Action>
          </div>
        ))}
        <Action href={href("markets/new")}>{t("createMarket")}</Action>
      </Panel>
    ),
    apps: (
      <>
        <Panel title={t("integrations")}>
          <p>{t("prepareIntegrationPreferencesBeforeConnectingProviders")}</p>
          {select("shippingIntegration", t("preferredShippingIntegration"), [
            "Not selected",
            "Carrier integration",
            "Local pickup",
          ])}
          {select("paymentIntegration", t("preferredPaymentIntegration"), [
            "Not selected",
            "Card processor",
            "Manual payment",
          ])}
          {check(
            "analyticsIntegration",
            t("includeAnalyticsIntegrationInSetup"),
          )}
        </Panel>
        <Panel title={t("connectionStatus")}>
          <Badge>{t("frontendPreview")}</Badge>
          <p className={s.help} data-studio-part="field-help">
            {t("noThirdPartyAccountsOrServicesAreConnectedThroughThisScreen")}
          </p>
        </Panel>
      </>
    ),
    domains: (
      <>
        <Panel title={t("storeDomain")}>
          <div className={s.dataRow} data-studio-part="data-row">
            <strong>{draft.handle}.treido.eu</strong>
            <Badge>{t("preview")}</Badge>
          </div>
          {input("handle", t("storeHandle"))}
          {input(
            "customDomain",
            t("customDomain"),
            "text",
            t("enterADomainToReviewTheConfigurationFlow"),
          )}
        </Panel>
        <Panel title={t("domainConfiguration")}>
          {check("redirectDomain", t("redirectToPrimaryDomain"), true)}
          <p className={s.help} data-studio-part="field-help">
            {t("dnsCertificatesAndDomainVerificationWillBeConnectedLater")}
          </p>
        </Panel>
      </>
    ),
    events: (
      <>
        <Panel title={t("customerEvents")}>
          {check("trackPageViews", t("pageViewEvents"))}
          {check("trackProductViews", t("productViewEvents"))}
          {check("trackCheckout", t("checkoutEvents"))}
          <p className={s.help} data-studio-part="field-help">
            {t("thisRecordsPreferencesOnlyNoTrackingScriptsAreInstalled")}
          </p>
        </Panel>
        <Panel title={t("eventPrivacy")}>
          <Action href={href("settings/privacy")}>
            {t("managePrivacyPreferences")}
          </Action>
        </Panel>
      </>
    ),
    notifications: (
      <>
        <Panel title={t("customerNotifications")}>
          {check("orderEmail", t("orderConfirmation"), true)}
          {check("shippingEmail", t("shippingUpdates"), true)}
          {check("marketingEmail", t("marketingUpdates"))}
          {select("notificationLanguage", t("notificationLanguage"), [
            "English",
            "Bulgarian",
          ])}
          {["Order confirmation", "Shipping update", "Refund confirmation"].map(
            (v) => (
              <div className={s.dataRow} data-studio-part="data-row" key={v}>
                <span>{optionText(v)}</span>
                <Button
                  onClick={() => {
                    setTemplate(v);
                    setDialog("template");
                  }}
                >
                  {t("editTemplate")}
                </Button>
              </div>
            ),
          )}
        </Panel>
        <Panel title={t("staffNotifications")}>
          {check("inboxEmail", t("newCustomerMessages"), true)}
          {check("lowStockEmail", t("lowStockAlerts"))}
          {input("notificationRecipient", t("notificationRecipient"), "email")}
        </Panel>
      </>
    ),
    "custom-data": (
      <>
        <Panel title={t("metafieldDefinitions")}>
          <p>{t("addStructuredFieldsForProductAndStoreContent")}</p>
          <Action href={href("content/new")}>{t("addDefinition")}</Action>
        </Panel>
        <Panel title={t("contentDefinitions")}>
          {store.entries
            .filter((e) => e.type === "Definition")
            .map((e) => (
              <div key={e.id} className={s.dataRow} data-studio-part="data-row">
                <span>{e.title}</span>
                <Action href={href(`content/${e.id}`)}>{t("edit")}</Action>
              </div>
            ))}
          <Action href={href("content")}>{t("manageDefinitions")}</Action>
        </Panel>
      </>
    ),
    languages: (
      <>
        <Panel title={t("storeLanguage")}>
          {select("language", t("defaultLanguage"), ["English", "Bulgarian"])}
          {check("bgLanguage", t("includeBulgarianStorefrontCopy"), true)}
          {check("enLanguage", t("includeEnglishStorefrontCopy"), true)}
        </Panel>
        <Panel title={t("adminLanguage")}>
          <p>{t("chooseThePreviewLanguageForMenusAndNavigation")}</p>
          <div className={s.actions} data-studio-part="actions">
            <LanguageChoice
              locale="en"
              returnTo={href("settings/languages")}
              className={s.button}
              data-studio-part="button"
            />
            <LanguageChoice
              locale="bg"
              returnTo={href("settings/languages")}
              className={s.button}
              data-studio-part="button"
            />
          </div>
        </Panel>
      </>
    ),
    privacy: (
      <>
        <Panel title={t("customerPrivacy")}>
          {check("cookieBanner", t("displayACookiePreferenceBanner"), true)}
          {check("analyticsConsent", t("requireAnalyticsConsent"), true)}
          {check("marketingConsent", t("requireMarketingConsent"), true)}
          {input("privacyEmail", t("privacyContactEmail"), "email")}
        </Panel>
        <Panel title={t("privacyPolicy")}>
          {textarea("privacyPolicy", t("policyText"))}
        </Panel>
      </>
    ),
    policies: (
      <>
        <Panel title={t("writtenReturnAndRefundPolicy")}>
          {input("returnsDays", t("returnWindowDays"), "number")}
          {textarea("refundPolicy", t("returnAndRefundPolicy"))}
        </Panel>
        <Panel title={t("privacyPolicy")}>
          {textarea("privacyPolicy", t("privacyPolicyText"))}
        </Panel>
        <Panel title={t("termsOfService")}>
          {textarea("terms", t("termsOfServiceText"))}
        </Panel>
        <Panel title={t("shippingPolicy")}>
          {textarea("deliveryNotes", t("shippingPolicyText"))}
        </Panel>
      </>
    ),
  };
  return (
    <>
      <SettingsOverview
        section={section}
        title={text(menu[section].title, menu[section].bg)}
        draft={draft}
        save={save}
        error={error}
      >
        {blocks[section]}
      </SettingsOverview>
      {dialog === "template" && (
        <Modal
          title={optionText(template)}
          onClose={() => setDialog(null)}
          footer={
            <Button primary onClick={() => setDialog(null)}>
              {t("done")}
            </Button>
          }
        >
          {textarea(`template-${template}`, t("emailBody"))}
          <p className={s.help} data-studio-part="field-help">
            {t("saveNotificationsToKeepThisTemplateNoEmailIsSent")}
          </p>
        </Modal>
      )}
    </>
  );
}
