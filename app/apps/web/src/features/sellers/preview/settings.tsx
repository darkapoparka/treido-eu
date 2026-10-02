"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { LanguageChoice } from "../../locale/language-choice";
import { settingsOptionKeys } from "./settings-option-keys";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminIcon, type AdminIconName } from "../admin-icons";
import admin from "../admin.module.css";
import { usePreview } from "./context";
import { defaultSettings, parseMoney } from "./model";
import { settingsSections, labels, type SettingsSection } from "./routes";
import { Team } from "./workspace";
import { SettingsSearchButton, useSettingsSearch } from "./settings-search";
import { WorkspaceLinks } from "./workspace-links";
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
  const [mobileMenu, setMobileMenu] = useState(false);
  const storeSearch = useSettingsSearch();
  const items = settingsSections.filter(
    (key) =>
      menu[key].title.toLowerCase().includes(query.toLowerCase()) ||
      menu[key].bg.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className={s.settingsShell}>
      <a href="#settings-content" className={`${s.button} ${s.skipLink}`}>
        {t("skipToContent")}
      </a>
      <nav className={s.settingsRail} aria-label={t("mainNavigation")}>
        <Link href={href()} aria-label={t("treidoHome")}>
          <span className={admin.brandMark}>t</span>
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
      </nav>
      <aside className={s.settingsNav}>
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
        <div className={s.storeName}>
          <div>
            <strong>{store.settings.name}</strong>
            <small>{store.settings.handle}.treido.eu</small>
          </div>
          <span>{store.settings.name.slice(0, 2).toUpperCase()}</span>
        </div>
        <nav aria-label={t("shopSettingsMenu")}>
          <WorkspaceLinks />
          {items.map((key) => (
            <Link
              key={key}
              href={href(`settings/${key}`)}
              aria-current={key === section ? "page" : undefined}
            >
              <AdminIcon name={menu[key].icon} />
              {text(menu[key].title, menu[key].bg)}
            </Link>
          ))}
        </nav>
        {!items.length && <p>{t("noMatchingSettings")}</p>}
      </aside>
      <main className={s.settingsCanvas} id="settings-content" tabIndex={-1}>
        <div className={s.settingsMobile}>
          <SettingsSearchButton
            open={storeSearch.open}
            className={s.settingsSearchButton}
          />
          <Link
            className={`${s.button} ${s.settingsBack}`}
            href={href()}
            aria-label={t("backToAdmin")}
          >
            <AdminIcon name="back" />
          </Link>
          <Button
            className={s.settingsMenuButton}
            onClick={() => setMobileMenu(true)}
            aria-label={t("settingsMenu")}
          >
            <AdminIcon name="menu" />
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
        <div className={s.settingsContent}>
          <h1>{text(menu[section].title, menu[section].bg)}</h1>
          <SettingsBody key={section} section={section} />
        </div>
      </main>
      {storeSearch.overlay}
      {mobileMenu && (
        <Modal title={t("settingsMenu")} onClose={() => setMobileMenu(false)}>
          <nav aria-label={t("mobileSettings")}>
            <WorkspaceLinks className={s.choice} />
            {settingsSections.map((key) => (
              <Link
                key={key}
                className={s.choice}
                href={href(`settings/${key}`)}
                onClick={() => setMobileMenu(false)}
              >
                <AdminIcon name={menu[key].icon} />
                {text(menu[key].title, menu[key].bg)}
              </Link>
            ))}
          </nav>
        </Modal>
      )}
    </div>
  );
}
function SettingsBody({ section }: { section: SettingsSection }) {
  const t = useTranslations("studioSettings");
  const { store, href, update, notify } = usePreview();
  const optionText = (value: string) => {
    const key = settingsOptionKeys[value as keyof typeof settingsOptionKeys];
    return key ? t(key) : value;
  };
  const [draft, setDraft] = useState({ ...defaultSettings, ...store.settings });
  const [dialog, setDialog] = useState<
    "contact" | "address" | "template" | null
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
      return;
    }
    update({ settings: draft });
    notify(t("settingsSavedInThisFrontendPreview"));
    setError("");
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
    <div className={s.saveBar}>
      <Button primary onClick={save}>
        {t("save")}
      </Button>
    </div>
  );
  if (section === "users") return <Team embedded />;
  if (section === "general")
    return (
      <>
        <section>
          <h2>{t("businessDetails")}</h2>
          <p>{t("businessInformationUsedForMarketsAppsAndStoreOperations")}</p>
          <Panel>
            <div className={s.dataRow}>
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
                <p className={s.muted}>{optionText(draft.country)}</p>
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
            <div className={s.dataRow}>
              <AdminIcon name="store" />
              <div style={{ flex: 1 }}>
                <h3>{draft.name}</h3>
                <p className={s.muted}>
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
            <div className={s.dataRow}>
              <AdminIcon name="markets" />
              <div style={{ flex: 1 }}>
                <h3>{t("storeAddress")}</h3>
                <p className={s.muted}>
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
                <p className={s.help}>
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
            <div className={s.fields}>
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
            <p className={s.help}>
              {t("setsTheTimeForOrderAndReportDisplayInThisPreview")}
            </p>
          </Panel>
        </section>
        <section>
          <h2>{t("orderIdFormat")}</h2>
          <Panel>
            <div className={s.fields}>
              {input("orderPrefix", t("prefix"))}
              {input("orderSuffix", t("suffix"))}
            </div>
            <p className={s.help}>
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
            {select("fulfillment", t("afterAnOrderHasBeenPaid"), [
              "Do not fulfill automatically",
              "Automatically fulfill items",
            ])}
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
            <div className={s.dataRow}>
              <span>{t("brand")}</span>
              <Action href={href("store")}>{t("manageBrand")}</Action>
            </div>
            <div className={s.dataRow}>
              <span>{t("customContent")}</span>
              <Action href={href("content")}>{t("manageContent")}</Action>
            </div>
          </Panel>
        </section>
        {error && (
          <p className={s.error} role="alert">
            {error}
          </p>
        )}
        {saveButton}
        {dialog && (
          <Modal
            title={
              dialog === "address"
                ? t("storeAddress")
                : t("storeContactDetails")
            }
            onClose={() => setDialog(null)}
            footer={
              <Button primary onClick={() => setDialog(null)}>
                {t("done")}
              </Button>
            }
          >
            {dialog === "address" ? (
              <>
                {input("address", t("address"))}
                <div className={s.fields}>
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
            <p className={s.help}>
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
          <div className={s.dataRow}>
            <strong>{draft.plan}</strong>
            <Badge>{t("previewSelection")}</Badge>
          </div>
          <p className={s.help}>
            {t(
              "reviewThePlanChoicePricesAndEntitlementsWillBeConfiguredWithTheBackend",
            )}
          </p>
        </Panel>
        <div className={s.stack}>
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
          <div className={s.fields}>
            {input("city", t("city"))}
            {input("postcode", t("postalCode"))}
          </div>
          {input("vatNumber", t("vatNumber"))}
        </Panel>
        <Panel title={t("invoices")}>
          <p className={s.muted}>{t("noInvoicesExistInTheFrontendPreview")}</p>
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
          <p className={s.help}>
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
          <p className={s.help}>
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
          <div className={s.fields}>
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
          <p className={s.help}>
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
          <div className={s.fields}>
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
          <div className={s.dataRow} key={m.id}>
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
          <p className={s.help}>
            {t("noThirdPartyAccountsOrServicesAreConnectedThroughThisScreen")}
          </p>
        </Panel>
      </>
    ),
    domains: (
      <>
        <Panel title={t("storeDomain")}>
          <div className={s.dataRow}>
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
          <p className={s.help}>
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
          <p className={s.help}>
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
              <div className={s.dataRow} key={v}>
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
              <div key={e.id} className={s.dataRow}>
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
          <div className={s.actions}>
            <LanguageChoice
              locale="en"
              returnTo={href("settings/languages")}
              className={s.button}
            />
            <LanguageChoice
              locale="bg"
              returnTo={href("settings/languages")}
              className={s.button}
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
      {blocks[section]}
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      {!["markets", "custom-data"].includes(section) && saveButton}
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
          <p className={s.help}>
            {t("saveNotificationsToKeepThisTemplateNoEmailIsSent")}
          </p>
        </Modal>
      )}
    </>
  );
}
