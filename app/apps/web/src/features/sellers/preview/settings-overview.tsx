"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { AdminIcon, type AdminIconName } from "../admin-icons";
import { usePreview } from "./context";
import type { SettingsSection } from "./routes";
import { Action, Badge, Button, Modal, Panel, s } from "./ui";
import styles from "./settings-overview.module.css";

/** Source-shaped summaries of device-local preferences; never provider status. */
export function SettingsOverview({
  section,
  children,
  title,
  draft,
  save,
  error,
}: {
  section: SettingsSection;
  children: ReactNode;
  title: string;
  draft: Record<string, string>;
  save: () => boolean;
  error: string;
}) {
  const { store, href, text } = usePreview();
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState("All");
  const [query, setQuery] = useState("");
  const [resource, setResource] = useState<string | null>(null);
  const edit = (label = text("Edit", "Редактиране")) => (
    <Button onClick={() => setEditing(true)}>{label}</Button>
  );
  const unavailable = (label: string) => (
    <Button
      disabled
      title={text(
        "This preview has no connected provider for this action.",
        "В този преглед няма свързан доставчик за това действие.",
      )}
    >
      {label}
    </Button>
  );
  const row = (
    label: string,
    detail: string,
    icon: AdminIconName = "settings",
    destination?: string,
  ) => (
    <div
      className={styles.row}
      data-studio-part="settings-summary-row"
      key={label}
    >
      <AdminIcon name={icon} />
      <div>
        <strong>{label}</strong>
        {detail && <p>{detail}</p>}
      </div>
      {destination ? (
        <Link aria-label={label} href={href(destination)}>
          ›
        </Link>
      ) : (
        <Button
          plain
          aria-label={`${text("Edit", "Редактиране")} ${label}`}
          onClick={() => setEditing(true)}
        >
          ›
        </Button>
      )}
    </div>
  );
  const note = (
    <p className={styles.note}>
      {text(
        "Device-local preview. Saving preferences does not connect services or change customer accounts.",
        "Локален преглед. Запазването на предпочитания не свързва услуги и не променя клиентски акаунти.",
      )}
    </p>
  );
  const tabs = (values: string[]) => (
    <div className={styles.tabs} role="tablist" aria-label={title}>
      {values.map((value) => (
        <button
          type="button"
          role="tab"
          key={value}
          aria-selected={tab === value}
          onClick={() => setTab(value)}
        >
          {value}
        </button>
      ))}
    </div>
  );
  let summary: ReactNode;
  switch (section) {
    case "plan":
      summary = (
        <>
          <h2>{text("Plan details", "Подробности за плана")}</h2>
          <Panel part="settings-plan">
            <div className={styles.row}>
              <div>
                <strong>{draft.plan}</strong>
                <p>{text("Preview selection", "Избор за преглед")}</p>
              </div>
              <Badge>Draft</Badge>
            </div>
            <p>
              {text(
                "Review the plan that fits your catalog. Prices and entitlements require billing integration.",
                "Прегледайте плана за своя каталог. Цените и правата изискват интеграция за таксуване.",
              )}
            </p>
            <div className={styles.banner}>
              {edit(text("Choose plan", "Избор на план"))}
            </div>
          </Panel>
          <Panel title={text("Plan settings", "Настройки на плана")}>
            {row(
              text("Subscription", "Абонамент"),
              text(
                "No active subscription in this preview",
                "Няма активен абонамент в този преглед",
              ),
              "growth",
            )}
          </Panel>
        </>
      );
      break;
    case "billing":
      summary = (
        <>
          <div className={styles.sectionHeading}>
            <h2>{text("Upcoming bill", "Предстояща сметка")}</h2>
            {edit(text("Billing profile", "Данни за таксуване"))}
          </div>
          <Panel part="settings-billing">
            <p className={styles.amount}>—</p>
            <p>
              {text(
                "No billing provider connected",
                "Няма свързан доставчик за таксуване",
              )}
            </p>
            <div className={styles.banner}>
              {unavailable(text("View bill", "Преглед на сметката"))}
            </div>
          </Panel>
          <h2>{text("Past bills", "Предишни сметки")}</h2>
          <Panel>
            {tabs([
              text("All", "Всички"),
              text("Paid", "Платени"),
              text("Unpaid", "Неплатени"),
            ])}
            <div className={styles.empty} data-studio-part="settings-empty">
              <h3>{text("No bills yet", "Все още няма сметки")}</h3>
              <p>
                {text(
                  "Invoices will appear here when a billing provider is connected.",
                  "Фактурите ще се показват тук след свързване на доставчик за таксуване.",
                )}
              </p>
            </div>
          </Panel>
        </>
      );
      break;
    case "payments":
      summary = (
        <>
          <Panel part="settings-payments">
            <div
              className={styles.provider}
              data-studio-part="settings-provider"
            >
              <AdminIcon name="finance" />
              <h2>{text("Payment providers", "Доставчици на плащания")}</h2>
            </div>
            <p>
              {text(
                "Review card, manual and cash-on-delivery preferences for your store.",
                "Прегледайте предпочитанията за картови, ръчни плащания и наложен платеж.",
              )}
            </p>
            <Badge>Not connected</Badge>
            {edit(
              text("Review payment preferences", "Преглед на предпочитанията"),
            )}
          </Panel>
          <h2>{text("More ways to pay", "Други начини за плащане")}</h2>
          <Panel>
            {row(
              text("Payment methods", "Начини на плащане"),
              draft.paymentMethod,
              "finance",
            )}
          </Panel>
          <h2>
            {text("Payment capture method", "Потвърждаване на плащането")}
          </h2>
          <Panel>
            {row(
              text("Capture preferences", "Предпочитания за потвърждаване"),
              draft.capture || text("Not configured", "Не е настроено"),
              "finance",
            )}
          </Panel>
        </>
      );
      break;
    case "checkout":
      summary = (
        <>
          <div className={styles.sectionHeading}>
            <h2>{text("Configurations", "Конфигурации")}</h2>
            {edit(text("Edit configuration", "Редактиране"))}
          </div>
          <Panel>
            {row(
              store.settings.name,
              text(
                "Checkout preferences · device-local draft",
                "Предпочитания за поръчване · локална чернова",
              ),
              "orders",
            )}
          </Panel>
          {children}
        </>
      );
      break;
    case "customer-accounts":
      summary = (
        <>
          <Panel title={text("Sign-in links", "Връзки за вход")}>
            {row(
              text("Show sign-in links", "Показване на връзки за вход"),
              draft.showAccountLink === "false"
                ? text("Hidden in preview", "Скрити в прегледа")
                : text("Visible in preview", "Видими в прегледа"),
              "customers",
            )}
          </Panel>
          <h2>{text("Customer accounts", "Клиентски акаунти")}</h2>
          <Panel>
            {row(
              text("Configurations", "Конфигурации"),
              draft.accountMode || text("Optional account", "Акаунт по избор"),
              "customers",
            )}
            {row(
              text("Authentication", "Удостоверяване"),
              text(
                "No customer authentication provider connected",
                "Няма свързан доставчик за удостоверяване",
              ),
              "customers",
            )}
            {row(
              text("Customer profiles", "Клиентски профили"),
              text(
                "Review saved preview customers",
                "Преглед на запазените примерни клиенти",
              ),
              "customers",
              "customers",
            )}
            {row(
              text("Returns", "Връщания"),
              text("Review written policies", "Преглед на писмените политики"),
              "orders",
              "settings/policies",
            )}
          </Panel>
        </>
      );
      break;
    case "shipping":
      summary = (
        <>
          <h2>{text("Shipping", "Доставка")}</h2>
          <Panel part="settings-shipping">
            <details className={styles.disclosure} open>
              <summary>
                {text("Shipping profiles", "Профили за доставка")}
              </summary>
              <p>
                {text(
                  "Rates and regions saved for this store preview.",
                  "Цени и региони, запазени за този преглед.",
                )}
              </p>
              {row(
                text("Store default", "Стандартни за магазина"),
                text(
                  "General profile · all physical products",
                  "Общ профил · всички физически продукти",
                ),
                "orders",
              )}
            </details>
            {[
              text("Delivery dates", "Срокове за доставка"),
              text("Shipping labels", "Етикети за доставка"),
              text("Packages", "Пакети"),
              text("Carrier accounts", "Акаунти за куриери"),
            ].map((label, index) => (
              <details className={styles.disclosure} key={label}>
                <summary>{label}</summary>
                <p>
                  {index === 0
                    ? draft.dispatch
                    : index === 2
                      ? text(
                          "Product package dimensions are available in the product editor.",
                          "Размерите на пакета са достъпни в редактора на продукта.",
                        )
                      : text(
                          "No carrier provider is connected.",
                          "Няма свързан куриер.",
                        )}
                </p>
                {index === 0 ? (
                  edit()
                ) : index === 2 ? (
                  <Action href={href("products")}>
                    {text("Products", "Продукти")}
                  </Action>
                ) : (
                  unavailable(text("Manage", "Управление"))
                )}
              </details>
            ))}
          </Panel>
          <h2>
            {text("Additional delivery methods", "Други начини за доставка")}
          </h2>
          <Panel>
            {row(
              text("Local pickup", "Получаване на място"),
              draft.city || text("No pickup city", "Няма град за получаване"),
              "markets",
            )}
            {row(
              text("Delivery notes", "Бележки за доставка"),
              draft.deliveryNotes ||
                text(
                  "Add customer delivery information",
                  "Добавяне на информация за доставка",
                ),
              "content",
            )}
          </Panel>
        </>
      );
      break;
    case "taxes":
      summary = (
        <>
          <h2>{text("Tax service", "Данъчна услуга")}</h2>
          <Panel>
            {row(
              text("Tax display", "Показване на данъците"),
              text(
                "No verified tax adapter connected",
                "Няма свързан потвърден данъчен адаптер",
              ),
              "finance",
            )}
          </Panel>
          <h2>{text("Tax regions", "Данъчни региони")}</h2>
          <p>
            {text(
              "Tax collection requires verified registrations and a tax provider. The preview stores display preferences only.",
              "Събирането на данъци изисква потвърдени регистрации и данъчен доставчик. Прегледът запазва само предпочитания за показване.",
            )}
          </p>
          <Panel>
            <input
              className={styles.search}
              type="search"
              aria-label={text(
                "Search tax regions",
                "Търсене на данъчни региони",
              )}
              placeholder={text("Search", "Търси")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {[store.settings.country]
              .filter((country) =>
                country.toLowerCase().includes(query.toLowerCase()),
              )
              .map((country) =>
                row(
                  country,
                  text("Not collecting", "Не се събират"),
                  "markets",
                ),
              )}
          </Panel>
        </>
      );
      break;
    case "locations":
      summary = (
        <>
          <div className={styles.sectionHeading}>
            <h2>{text("All locations", "Всички локации")}</h2>
            {edit(text("Edit location", "Редактиране на локацията"))}
          </div>
          <Panel>
            {tabs([
              text("All", "Всички"),
              text("Active", "Активни"),
              text("Inactive", "Неактивни"),
            ])}
            {tab !== text("Inactive", "Неактивни") &&
              row(
                draft.locationName || store.settings.name,
                [draft.address, draft.city, draft.country]
                  .filter(Boolean)
                  .join(", "),
                "markets",
              )}
          </Panel>
          <h2>{text("In-person selling", "Продажби на място")}</h2>
          <Panel>
            <p>
              {text(
                "Point-of-sale subscriptions and devices are not connected in this preview.",
                "Абонаменти и устройства за продажби на място не са свързани в този преглед.",
              )}
            </p>
            {unavailable(
              text("Manage subscription", "Управление на абонамента"),
            )}
          </Panel>
        </>
      );
      break;
    case "apps":
      summary = (
        <>
          <Panel part="settings-apps">
            <div className={styles.sectionHeading}>
              {tabs([text("Installed", "Инсталирани")])}
              {edit(text("Preferences", "Предпочитания"))}
            </div>
            <div className={styles.row}>
              <AdminIcon name="plus" />
              <div>
                <strong>
                  {text("No connected apps", "Няма свързани приложения")}
                </strong>
              </div>
            </div>
          </Panel>
          <p className={styles.learn}>
            {text(
              "App installation requires a real provider integration.",
              "Инсталирането на приложения изисква реална интеграция.",
            )}
          </p>
        </>
      );
      break;
    case "domains":
      summary = (
        <>
          <div className={styles.info} data-studio-part="settings-info">
            <span aria-hidden="true">ⓘ</span>
            <p>
              {text(
                "Review a custom domain for your store. DNS, certificates and verification require a connected domain provider.",
                "Прегледайте персонален домейн за магазина. DNS, сертификатите и потвърждаването изискват свързан доставчик на домейн.",
              )}
            </p>
          </div>
          <Panel part="settings-domain-preference">
            <h3>{text("Store address", "Адрес на магазина")}</h3>
            <p>
              {text(
                "Update your store handle in the preview or prepare a custom domain preference.",
                "Променете името на магазина в прегледа или подгответе предпочитание за персонален домейн.",
              )}
            </p>
            {edit(text("Edit domain preferences", "Редактиране на домейна"))}
          </Panel>
          <Panel part="settings-domain-table">
            <div className={styles.domainHeader}>
              <span>{text("Domain", "Домейн")}</span>
              <span>{text("Status", "Състояние")}</span>
            </div>
            <div className={styles.domainRow}>
              <AdminIcon name="markets" />
              <span title={draft.handle + ".treido.eu"}>
                {draft.handle}.treido.eu
              </span>
              <Badge>Preview</Badge>
            </div>
          </Panel>
          <p className={styles.learn}>
            {text("Unverified preview address", "Непотвърден адрес за преглед")}
          </p>
        </>
      );
      break;
    case "events":
      summary = (
        <>
          <h2>{text("Pixels", "Пиксели")}</h2>
          <Panel part="settings-pixels">
            <div className={styles.pixelCard}>
              <input
                className={styles.search}
                type="search"
                maxLength={160}
                aria-label={text("Search pixels", "Търсене на пиксели")}
                placeholder={text("Search pixels", "Търсене на пиксели")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <div className={styles.empty} data-studio-part="settings-empty">
                <AdminIcon name="analytics" />
                <h3>
                  {text(
                    "This is where you'll manage your pixels",
                    "Тук ще управлявате пикселите си",
                  )}
                </h3>
                <p>
                  {text(
                    "No tracking integrations are connected in this preview.",
                    "Няма свързани интеграции за проследяване в този преглед.",
                  )}
                </p>
                <div className={styles.sectionHeading}>
                  {edit(text("Preferences", "Предпочитания"))}
                  {unavailable(text("Add custom pixel", "Добавяне на пиксел"))}
                </div>
              </div>
            </div>
          </Panel>
          <p className={styles.learn}>
            {text(
              "No scripts are installed or customer events collected.",
              "Не се инсталират скриптове и не се събират клиентски събития.",
            )}
          </p>
        </>
      );
      break;
    case "notifications":
      summary = (
        <>
          <section className={styles.sender}>
            <h2>{text("Sender email", "Имейл на подателя")}</h2>
            <p>
              {text(
                "The email saved for this store's notification preferences.",
                "Имейлът, запазен за предпочитанията за известия на магазина.",
              )}
            </p>
            <Panel part="settings-sender">
              <div className={styles.info} data-studio-part="settings-info">
                <span aria-hidden="true">ⓘ</span>
                <p>
                  {text(
                    "This preview stores email and template preferences locally. No sending domain is verified and no email is sent to customers or staff.",
                    "Прегледът запазва локално имейла и шаблоните. Не е потвърден домейн за изпращане и не се изпраща имейл до клиенти или екипа.",
                  )}
                </p>
              </div>
              <Button
                className={styles.emailButton}
                onClick={() => setEditing(true)}
              >
                {draft.notificationRecipient || draft.email}
              </Button>
            </Panel>
          </section>
          <Panel>
            {row(
              text("Customer notifications", "Клиентски известия"),
              text(
                "Order and account notification templates",
                "Шаблони за известия за поръчка и акаунт",
              ),
              "customers",
            )}
            {row(
              text("Staff notifications", "Известия за екипа"),
              text(
                "New messages and low-stock preferences",
                "Предпочитания за съобщения и ниска наличност",
              ),
              "customers",
            )}
            {row(
              text("Notification language", "Език на известията"),
              draft.notificationLanguage || text("English", "Английски"),
              "markets",
            )}
          </Panel>
        </>
      );
      break;
    case "custom-data": {
      const definitions = store.entries.filter(
        (entry) => entry.type === "Definition",
      );
      summary = (
        <>
          <h2>{text("Metafield definitions", "Дефиниции на метаполета")}</h2>
          <p>
            {text(
              "Definitions describe additional fields for store resources. Server-backed metafields are not connected in this preview.",
              "Дефинициите описват допълнителни полета за ресурсите на магазина. Метаполетата със сървърно съхранение не са свързани в този преглед.",
            )}
          </p>
          <Panel>
            {[
              ["Products", "Продукти"],
              ["Variants", "Варианти"],
              ["Collections", "Колекции"],
              ["Customers", "Клиенти"],
              ["Orders", "Поръчки"],
              ["Draft orders", "Чернови на поръчки"],
              ["Companies", "Компании"],
              ["Company locations", "Локации на компании"],
              ["Locations", "Локации"],
              ["Transfers", "Прехвърляния"],
              ["Pages", "Страници"],
              ["Blogs", "Блогове"],
              ["Blog posts", "Публикации в блог"],
              ["Markets", "Пазари"],
              ["Shop", "Магазин"],
            ].map(([en, bg]) => (
              <button
                key={en}
                type="button"
                className={styles.resourceRow}
                data-studio-part="metafield-resource"
                onClick={() => setResource(text(en, bg))}
              >
                <AdminIcon
                  name={
                    en === "Products" || en === "Variants"
                      ? "product"
                      : en.includes("ustomer") || en.includes("ompan")
                        ? "customers"
                        : en.includes("rder")
                          ? "orders"
                          : en.includes("arket") || en.includes("ocation")
                            ? "markets"
                            : "content"
                  }
                />
                <span>{text(en, bg)}</span>
                <span aria-label={text("Not connected", "Не е свързано")}>
                  —
                </span>
                <span aria-hidden="true">›</span>
              </button>
            ))}
          </Panel>
          <div className={styles.sectionHeading}>
            <h2>{text("Content definitions", "Дефиниции на съдържание")}</h2>
            <Action href={href("content/new")}>
              {text("Add definition", "Добавяне на дефиниция")}
            </Action>
          </div>
          <Panel>
            {definitions.length ? (
              definitions.map((entry) =>
                row(
                  entry.title,
                  entry.status,
                  "content",
                  `content/${entry.id}`,
                ),
              )
            ) : (
              <div className={styles.empty} data-studio-part="settings-empty">
                <p>{text("No definitions yet", "Все още няма дефиниции")}</p>
              </div>
            )}
          </Panel>
        </>
      );
      break;
    }
    case "languages":
      summary = (
        <>
          <div
            className={styles.topActions}
            data-studio-part="settings-top-actions"
          >
            {edit(text("Manage languages", "Управление на езиците"))}
          </div>
          <h2>{text("Languages", "Езици")}</h2>
          <p>
            {text(
              "Choose the languages available in this storefront preview.",
              "Изберете езиците, достъпни в прегледа на магазина.",
            )}
          </p>
          <div
            className={styles.languageTable}
            data-studio-part="settings-language-table"
          >
            <div className={styles.languageHeader}>
              <span>{text("Language", "Език")}</span>
              <span>{text("Status", "Статус")}</span>
              <span>{text("Scope", "Обхват")}</span>
            </div>
            {[
              [text("English", "Английски"), "enLanguage"],
              [text("Bulgarian", "Български"), "bgLanguage"],
            ].map(([label, key]) => (
              <button
                type="button"
                key={key}
                onClick={() => setEditing(true)}
                className={styles.languageRow}
              >
                <span>
                  {label}
                  {draft.language ===
                    (key === "bgLanguage" ? "Bulgarian" : "English") && (
                    <small>{text("Default", "Основен")}</small>
                  )}
                </span>
                <Badge>
                  {draft[key] === "false"
                    ? text("Hidden", "Скрит")
                    : text("Available", "Достъпен")}
                </Badge>
                <span>{text("Preview", "Преглед")}</span>
              </button>
            ))}
            <div className={styles.languageTip}>
              {text(
                "Language availability is saved only on this device.",
                "Достъпните езици се запазват само на това устройство.",
              )}
            </div>
          </div>
          <Panel>
            {row(
              text("Admin language", "Език на администрацията"),
              text("English and Bulgarian", "Английски и български"),
              "markets",
            )}
          </Panel>
        </>
      );
      break;
    case "privacy":
      summary = (
        <>
          <h2>{text("Privacy settings", "Настройки за поверителност")}</h2>
          <Panel>
            <div className={`${styles.insetRows} ${styles.privacyRows}`}>
              {row(
                text("Privacy policy", "Политика за поверителност"),
                draft.privacyPolicy
                  ? text("Saved local draft", "Запазена локална чернова")
                  : text(
                      "No written policy yet",
                      "Все още няма писмена политика",
                    ),
                "content",
              )}
              {row(
                text("Cookie banner", "Банер за бисквитки"),
                text("Draft preference", "Предпочитание в чернова"),
                "settings",
              )}
              {row(
                text("Data sharing opt-out", "Отказ от споделяне на данни"),
                text(
                  "Requires a privacy integration",
                  "Изисква интеграция за поверителност",
                ),
                "settings",
              )}
            </div>
          </Panel>
          <Panel>
            <div className={styles.insetRows}>
              {row(
                text("Privacy contact", "Контакт за поверителност"),
                draft.privacyEmail || draft.email,
                "inbox",
              )}
            </div>
            <p className={styles.cardHelp}>
              {text(
                "Privacy preferences and this contact are local drafts. Customer data requests require a connected private workspace.",
                "Предпочитанията и този контакт са локални чернови. Заявките за клиентски данни изискват свързано лично работно пространство.",
              )}
            </p>
          </Panel>
        </>
      );
      break;
    case "policies":
      summary = (
        <>
          <h2>
            {text(
              "Return and cancellation rules",
              "Правила за връщане и отказ",
            )}
          </h2>
          <p>
            {text(
              "Set the return window for this local policy draft.",
              "Задайте срока за връщане в локалната чернова на политика.",
            )}
          </p>
          <Panel>
            {row(
              text("Default rules", "Основни правила"),
              `${draft.returnsDays || "14"} ${text("days · local policy draft", "дни · локална чернова на политика")}`,
              "orders",
            )}
          </Panel>
          {unavailable(text("Add rule", "Добавяне на правило"))}
          <p>
            {text(
              "Customer return requests and cancellations require a connected private workspace.",
              "Клиентските заявки за връщане и отказ изискват свързано лично работно пространство.",
            )}
          </p>
          <h2>{text("Written policies", "Писмени политики")}</h2>
          <p>
            {text(
              "Review the policy text saved in this preview.",
              "Прегледайте текста на политиките, запазен в този преглед.",
            )}
          </p>
          <Panel>
            <div className={styles.insetRows}>
              {[
                [
                  text(
                    "Return and refund policy",
                    "Политика за връщане и възстановяване",
                  ),
                  "refundPolicy",
                ],
                [text("Contact information", "Данни за контакт"), "email"],
                [
                  text("Privacy policy", "Политика за поверителност"),
                  "privacyPolicy",
                ],
                [text("Terms of service", "Условия за ползване"), "terms"],
                [
                  text("Shipping policy", "Политика за доставка"),
                  "deliveryNotes",
                ],
              ].map(([label, key]) =>
                row(
                  label,
                  draft[key]
                    ? text("Saved local draft", "Запазена локална чернова")
                    : text("No policy written", "Няма написана политика"),
                  "content",
                ),
              )}
            </div>
          </Panel>
        </>
      );
      break;
    default:
      return <>{children}</>;
  }
  const inline = section === "checkout";
  return (
    <div
      className={styles.root}
      data-studio-part="settings-overview"
      data-settings-overview={section}
    >
      {summary}
      {note}
      {resource && (
        <Modal
          title={resource}
          surface="metafield-resource"
          onClose={() => setResource(null)}
        >
          <p>
            {text(
              "Server-backed metafield definitions are not connected in this device-local preview. Product disclosures and reusable local content remain available in their editors.",
              "Дефинициите на метаполета със сървърно съхранение не са свързани в този локален преглед. Характеристиките на продуктите и локалното съдържание са достъпни в съответните редактори.",
            )}
          </p>
          <Action href={href("products")}>
            {text("Products", "Продукти")}
          </Action>
          <Action href={href("content")}>
            {text("Local content", "Локално съдържание")}
          </Action>
        </Modal>
      )}
      {inline && (
        <>
          <p className={s.error} role="alert">
            {error}
          </p>
          <div className={s.saveBar}>
            <Button primary onClick={save}>
              {text("Save", "Запазване")}
            </Button>
          </div>
        </>
      )}
      {editing && (
        <Modal
          title={title}
          onClose={() => setEditing(false)}
          surface="settings-edit"
          footer={
            <>
              <Button onClick={() => setEditing(false)}>
                {text("Cancel", "Отказ")}
              </Button>
              <Button
                primary
                onClick={() => {
                  if (save()) setEditing(false);
                }}
              >
                {text("Save preferences", "Запазване на предпочитанията")}
              </Button>
            </>
          }
        >
          {inline ? (
            <p>
              {text(
                "Edit the configuration fields on this page.",
                "Редактирайте полетата за конфигурация на тази страница.",
              )}
            </p>
          ) : (
            children
          )}
          {error && (
            <p className={s.error} role="alert">
              {error}
            </p>
          )}
          {note}
        </Modal>
      )}
    </div>
  );
}
