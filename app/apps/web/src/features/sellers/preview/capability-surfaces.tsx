"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AdminIcon, type AdminIconName } from "../admin-icons";
import { usePreview } from "./context";
import { Action, Button, Check, Field, Header, Panel, s } from "./ui";
import styles from "./capability-surfaces.module.css";

/** Observed screen structures with explicit unavailable provider effects. */
export function CapabilitySurface({
  section,
  title,
  description,
  icon,
  related,
}: {
  section: string;
  title: string;
  description: string;
  icon: AdminIconName;
  related: string;
}) {
  const { text, href, store } = usePreview();
  const [view, setView] = useState("Last 30 days");
  const [zoom, setZoom] = useState(1);
  const entryType = (
    {
      menus: "MenuDraft",
      "blog-posts": "BlogDraft",
      companies: "CompanyDraft",
      catalogs: "CatalogDraft",
      rollouts: "RolloutDraft",
    } as Record<string, string>
  )[section];
  const localDrafts = entryType
    ? store.entries.filter((entry) => entry.type === entryType)
    : [];
  const setup = (en: string, bg: string) =>
    entryType ? (
      <Action primary href={href(`${section}/new`)}>
        {text(en, bg)}
      </Action>
    ) : (
      <Button primary disabled title={description}>
        {text(en, bg)}
      </Button>
    );
  const info = (
    <div className={styles.info} data-studio-part="capability-info">
      <span aria-hidden="true">ⓘ</span>
      <p>{description}</p>
    </div>
  );
  const learning = (
    <p className={s.learn}>
      <Action plain href={href(related)}>
        {text(
          "Review available preview tools",
          "Преглед на достъпните инструменти",
        )}
      </Action>
    </p>
  );
  let body;
  if (localDrafts.length)
    body = (
      <>
        <div className={s.actions}>
          {setup("Add draft", "Добавяне на чернова")}
        </div>
        <Panel part={`${section}-drafts`}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>{text("Name", "Име")}</th>
                <th>{text("Status", "Състояние")}</th>
              </tr>
            </thead>
            <tbody>
              {localDrafts.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <Link href={href(`${section}/${entry.id}`)}>
                      {entry.title}
                    </Link>
                  </td>
                  <td>{text("Local draft", "Локална чернова")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <p className={s.help}>{description}</p>
      </>
    );
  else if (section === "live")
    body = (
      <div className={styles.live} data-studio-part="live-view">
        <div className={styles.liveMetrics}>
          <h2>{text("Live metrics", "Показатели на живо")}</h2>
          {info}
          <div className={styles.metricGrid}>
            {[
              ["Visitors right now", "Посетители в момента"],
              ["Total sales", "Общо продажби"],
              ["Sessions", "Сесии"],
              ["Orders", "Поръчки"],
            ].map(([en, bg]) => (
              <div key={en}>
                <h3>{text(en, bg)}</h3>
                <strong>—</strong>
                <small>{text("Not connected", "Не е свързано")}</small>
              </div>
            ))}
          </div>
          <Panel title={text("Customer behavior", "Поведение на клиентите")}>
            <p className={s.help}>
              {text(
                "Active carts, checkouts, and purchases require live events.",
                "Активните колички, поръчвания и покупки изискват събития на живо.",
              )}
            </p>
          </Panel>
        </div>
        <div className={styles.globePanel} data-studio-part="live-globe">
          <label>
            <AdminIcon name="search" />
            <input
              disabled
              placeholder={text("Search locations", "Търсене на локации")}
              aria-label={text(
                "Search locations unavailable",
                "Търсенето на локации не е достъпно",
              )}
            />
          </label>
          <svg
            viewBox="0 0 400 400"
            aria-label={text(
              "Globe illustration; no live location data",
              "Илюстрация на глобус без данни за локации на живо",
            )}
            style={{ transform: `scale(${zoom})` }}
          >
            <defs>
              <radialGradient id="studio-globe">
                <stop offset="0" stopColor="#e6eef3" />
                <stop offset="1" stopColor="#95b3c9" />
              </radialGradient>
            </defs>
            <circle cx="200" cy="200" r="176" fill="url(#studio-globe)" />
            <g fill="none" stroke="#779fb7" strokeWidth="1">
              <ellipse cx="200" cy="200" rx="90" ry="176" />
              <ellipse cx="200" cy="200" rx="150" ry="176" />
              <path d="M24 200h352M200 24v352" />
              <ellipse cx="200" cy="200" rx="176" ry="70" />
              <ellipse cx="200" cy="200" rx="176" ry="130" />
            </g>
          </svg>
          <div className={styles.zoom}>
            <Button
              aria-label={text("Zoom out", "Отдалечаване")}
              disabled={zoom <= 0.8}
              onClick={() => setZoom(Math.max(0.8, zoom - 0.1))}
            >
              −
            </Button>
            <Button
              aria-label={text("Zoom in", "Приближаване")}
              disabled={zoom >= 1.3}
              onClick={() => setZoom(Math.min(1.3, zoom + 0.1))}
            >
              +
            </Button>
          </div>
          <p>
            {text(
              "Illustration only · live telemetry not connected",
              "Само илюстрация · няма свързани измервания на живо",
            )}
          </p>
        </div>
      </div>
    );
  else if (section === "attribution")
    body = (
      <div className={styles.attribution} data-studio-part="attribution-view">
        <div className={s.actions}>
          <select
            value={view}
            onChange={(event) => setView(event.target.value)}
            aria-label={text("Report period", "Период на отчета")}
          >
            {["Last 30 days", "Last 7 days", "Today"].map((value) => (
              <option key={value} value={value}>
                {value === "Today"
                  ? text("Today", "Днес")
                  : value === "Last 7 days"
                    ? text("Last 7 days", "Последните 7 дни")
                    : text("Last 30 days", "Последните 30 дни")}
              </option>
            ))}
          </select>
          <Action href={href("reports/sales")}>
            {text("Local sales report", "Локален отчет за продажби")}
          </Action>
        </div>
        <Panel title={text("Performance", "Представяне")}>
          <div className={styles.attributionMetrics}>
            {[
              ["Total sales", "Общо продажби"],
              ["Sessions", "Сесии"],
              ["Conversion rate", "Реализации"],
            ].map(([en, bg]) => (
              <div key={en}>
                <span>{text(en, bg)}</span>
                <strong>—</strong>
              </div>
            ))}
          </div>
          <div className={styles.emptyChart}>
            <div />
            <div />
            <div />
            <p>
              {text(
                "No verified attribution events",
                "Няма потвърдени събития за атрибуция",
              )}
            </p>
          </div>
        </Panel>
        {info}
        <div className={styles.channelTable}>
          <table className={s.table}>
            <thead>
              <tr>
                {[
                  ["Channel", "Канал"],
                  ["Sales", "Продажби"],
                  ["Orders", "Поръчки"],
                  ["Sessions", "Сесии"],
                ].map(([en, bg]) => (
                  <th key={en}>{text(en, bg)}</th>
                ))}
              </tr>
            </thead>
          </table>
          <p>
            {text(
              "Channels appear after analytics is connected.",
              "Каналите ще се показват след свързване на анализа.",
            )}
          </p>
        </div>
      </div>
    );
  else if (section === "autopilot")
    body = (
      <div className={styles.autopilot} data-studio-part="autopilot-view">
        <div className={styles.warning}>
          <strong>
            {text(
              "Delivery provider required",
              "Необходим е доставчик за изпращане",
            )}
          </strong>
          <p>{description}</p>
        </div>
        <div className={styles.autopilotColumns}>
          <div>
            <h2>
              {text(
                "Plan your next campaign",
                "Планирайте следващата си кампания",
              )}
            </h2>
            <p>
              {text(
                "Prepare an audience and products before connecting automated delivery.",
                "Подгответе аудитория и продукти преди свързване на автоматизираното изпращане.",
              )}
            </p>
            <Action href={href("growth/campaigns")}>
              {text(
                "Create a local campaign plan",
                "Създаване на локален план за кампания",
              )}
            </Action>
            <h3>{text("Activity", "Активност")}</h3>
            <div className={styles.activity}>
              <AdminIcon name="growth" />
              <strong>
                {text(
                  "No automated campaign activity",
                  "Няма активност от автоматични кампании",
                )}
              </strong>
              <p>
                {text(
                  "Local campaign plans do not send messages or create ads.",
                  "Локалните планове не изпращат съобщения и не създават реклами.",
                )}
              </p>
            </div>
          </div>
          <aside>
            <Panel title={text("Configuration", "Конфигурация")}>
              <Check
                label={text("Product access", "Достъп до продукти")}
                checked={false}
                onChange={() => {}}
                disabled
              />
              <Check
                label={text(
                  "Connected delivery provider",
                  "Свързан доставчик за изпращане",
                )}
                checked={false}
                onChange={() => {}}
                disabled
              />
              <Field label={text("Campaign budget", "Бюджет на кампанията")}>
                <input disabled placeholder="— EUR" />
              </Field>
              {setup("Activate automation", "Активиране на автоматизацията")}
            </Panel>
          </aside>
        </div>
      </div>
    );
  else if (section === "payouts")
    body = (
      <>
        <div className={styles.payouts} data-studio-part="payouts-introduction">
          <div>
            <h2>
              {text(
                "Review how payments reach your business",
                "Прегледайте как плащанията достигат до бизнеса ви",
              )}
            </h2>
            <p>{description}</p>
            <Action href={href("settings/payments")}>
              {text(
                "Review payment preferences",
                "Преглед на предпочитанията за плащане",
              )}
            </Action>
            <h3>{text("Keep learning", "Научете повече")}</h3>
            <div className={styles.links}>
              {[
                ["orders", "Orders", "Поръчки"],
                ["finance", "Finance overview", "Общи финанси"],
                [
                  "settings/payments",
                  "Payment preferences",
                  "Предпочитания за плащане",
                ],
                [
                  "settings/billing",
                  "Billing preferences",
                  "Предпочитания за таксуване",
                ],
                [
                  "reports/sales",
                  "Local sales report",
                  "Локален отчет за продажби",
                ],
              ].map(([route, en, bg]) => (
                <Action plain key={route} href={href(route)}>
                  {text(en, bg)} ›
                </Action>
              ))}
            </div>
          </div>
          <Image
            src="/images/admin/onboarding-review-v1.webp"
            unoptimized
            width={960}
            height={472}
            alt={text(
              "Treido business illustration",
              "Бизнес илюстрация на Treido",
            )}
          />
        </div>
        {learning}
      </>
    );
  else if (section === "menus")
    body = (
      <>
        <div className={s.actions}>
          <Button disabled title={description}>
            {text("URL redirects", "URL пренасочвания")}
          </Button>
        </div>
        <div className={styles.channelTable} data-studio-part="menus-table">
          <table className={s.table}>
            <thead>
              <tr>
                <th>{text("Title", "Заглавие")}</th>
                <th>{text("Menu items", "Елементи в менюто")}</th>
              </tr>
            </thead>
          </table>
          <div className={styles.menuEmpty}>
            <AdminIcon name="content" />
            <strong>
              {text(
                "No custom navigation menus",
                "Няма персонални навигационни менюта",
              )}
            </strong>
            <p>{description}</p>
            {setup("Create menu", "Създаване на меню")}
          </div>
        </div>
        {learning}
      </>
    );
  else
    body = (
      <>
        {section === "companies" && info}
        <div
          className={`${styles.empty} ${section === "blog-posts" ? styles.blogEmpty : ""}`}
          data-studio-part="capability-empty"
          data-capability={section}
        >
          <AdminIcon name={icon} />
          <h2>
            {section === "companies"
              ? text("Business customer accounts", "Бизнес клиентски акаунти")
              : section === "blog-posts"
                ? text(
                    "Share stories with your customers",
                    "Споделяйте истории с клиентите",
                  )
                : section === "catalogs"
                  ? text(
                      "Manage catalogs for your markets",
                      "Управление на каталози за пазарите",
                    )
                  : section === "rollouts"
                    ? text(
                        "Plan changes to your store",
                        "Планиране на промени в магазина",
                      )
                    : title}
          </h2>
          <p>{description}</p>
          {section === "companies"
            ? setup("Add company", "Добавяне на компания")
            : section === "blog-posts"
              ? setup("Add blog post", "Добавяне на публикация")
              : section === "catalogs"
                ? setup("Create catalog", "Създаване на каталог")
                : section === "rollouts"
                  ? setup("Create rollout", "Създаване на пускане")
                  : setup("Create", "Създаване")}
        </div>
        {learning}
      </>
    );
  return (
    <main
      className={`${s.page} ${["autopilot", "blog-posts"].includes(section) ? styles.centered : ""}`}
      data-studio-part="page"
      data-studio-capability={section}
    >
      <Header
        title={title}
        icon={icon}
        actions={
          section === "blog-posts" ? (
            <Button disabled title={description}>
              {text("Manage blogs", "Управление на блогове")}
            </Button>
          ) : section === "catalogs" ? (
            <>
              <Button disabled title={description}>
                {text("Export", "Експорт")}
              </Button>
              <Button disabled title={description}>
                {text("Import", "Импорт")}
              </Button>
            </>
          ) : undefined
        }
      />
      {body}
    </main>
  );
}
