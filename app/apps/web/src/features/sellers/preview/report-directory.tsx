"use client";
import { useState } from "react";
import Link from "next/link";
import { AdminIcon } from "../admin-icons";
import { usePreview } from "./context";
import { Action, Button, Header, s } from "./ui";
import styles from "./report-directory.module.css";
import {
  additionalReportPresets,
  remainingReportPresets,
} from "./report-presets";

export type ReportPreset = {
  id: string;
  en: string;
  bg: string;
  category: string;
  available?: true;
};
const localReports: readonly ReportPreset[] = [
  {
    id: "sessions-location",
    en: "Sessions by location",
    bg: "Сесии по местоположение",
    category: "Acquisition",
  },
  {
    id: "sessions-referrer",
    en: "Sessions by referrer",
    bg: "Сесии по източник",
    category: "Acquisition",
  },
  {
    id: "sessions-social",
    en: "Sessions by social referrer",
    bg: "Сесии от социални мрежи",
    category: "Acquisition",
  },
  {
    id: "sessions-time",
    en: "Sessions over time",
    bg: "Сесии във времето",
    category: "Acquisition",
  },
  {
    id: "visitors-time",
    en: "Visitors over time",
    bg: "Посетители във времето",
    category: "Acquisition",
  },
  {
    id: "visitors-live",
    en: "Visitors right now",
    bg: "Посетители в момента",
    category: "Acquisition",
  },
  {
    id: "bounce",
    en: "Bounce rate over time",
    bg: "Отпадане във времето",
    category: "Behavior",
  },
  {
    id: "checkout-conversion",
    en: "Checkout conversion rate over time",
    bg: "Завършени покупки във времето",
    category: "Behavior",
  },
  {
    id: "conversion",
    en: "Conversion rate breakdown",
    bg: "Разпределение на реализациите",
    category: "Behavior",
  },
  {
    id: "customer-behavior",
    en: "Customer behavior",
    bg: "Поведение на клиентите",
    category: "Behavior",
  },
  {
    id: "sales",
    en: "Sales over time",
    bg: "Продажби във времето",
    category: "Sales",
    available: true,
  },
  {
    id: "products",
    en: "Sales by product",
    bg: "Продажби по продукт",
    category: "Sales",
    available: true,
  },
  {
    id: "customers",
    en: "Sales by customer",
    bg: "Продажби по клиент",
    category: "Customers",
    available: true,
  },
  {
    id: "inventory",
    en: "Inventory report",
    bg: "Отчет за наличностите",
    category: "Inventory",
    available: true,
  },
] as const;
export const reportPresets: readonly ReportPreset[] = [
  ...localReports.filter((report) => !report.available),
  ...[...additionalReportPresets, ...remainingReportPresets].map(
    ([id, en, bg, category]) => ({
      id,
      en,
      bg,
      category,
    }),
  ),
  ...localReports.filter((report) => report.available),
];
// Keep the observed conversion-time row before Customer behavior.
const conversionTimeIndex = reportPresets.findIndex(
  (report) => report.id === "conversion-time",
);
const orderedReports = [...reportPresets];
orderedReports.splice(9, 0, ...orderedReports.splice(conversionTimeIndex, 1));

export function ReportDirectory() {
  const { store, href, text } = usePreview();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState(false);
  const [pinned, setPinned] = useState<string[]>([]);
  const [view, setView] = useState("All");
  const [page, setPage] = useState(0);
  const [creator, setCreator] = useState("All");
  const categoryText = (value: string) =>
    ({
      All: text("All", "Всички"),
      Acquisition: text("Acquisition", "Привличане"),
      Behavior: text("Behavior", "Поведение"),
      Customers: text("Customers", "Клиенти"),
      Inventory: text("Inventory", "Наличности"),
      Sales: text("Sales", "Продажби"),
      Finances: text("Finances", "Финанси"),
      Fraud: text("Fraud", "Измами"),
      Marketing: text("Marketing", "Маркетинг"),
      Orders: text("Orders", "Поръчки"),
      Performance: text("Performance", "Производителност"),
      "Profit Margin": text("Profit Margin", "Марж на печалба"),
      "Retail Sales": text("Retail Sales", "Продажби на място"),
      Custom: text("Custom", "Персонализирани"),
    })[value] ?? value;
  const drafts: ReportPreset[] = store.entries
    .filter((entry) => entry.type === "ReportDraft")
    .map((entry) => ({
      id: entry.id,
      en: entry.title,
      bg: entry.title,
      category: "Custom",
    }));
  const rows = [...orderedReports, ...drafts]
    .filter(
      (report) =>
        (category === "All" || report.category === category) &&
        (creator === "All" ||
          (creator === "Local") === (report.category === "Custom")) &&
        (view === "All" || pinned.includes(report.id)) &&
        `${report.en} ${report.bg}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    )
    .sort((a, b) =>
      sort ? text(a.en, a.bg).localeCompare(text(b.en, b.bg)) : 0,
    );
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(rows.length / 50) - 1),
  );
  const shown = rows.slice(currentPage * 50, currentPage * 50 + 50);
  return (
    <main className={s.page} data-studio-part="page">
      <Header
        title={text("Reports", "Отчети")}
        icon="analytics"
        actions={
          <Action primary href={href("reports/explore")}>
            {text("New exploration", "Нов анализ")}
          </Action>
        }
      />
      <div className={styles.root} data-studio-part="report-directory">
        <div className={styles.search} data-studio-part="report-search">
          <AdminIcon name="search" />
          <input
            type="search"
            aria-label={text("Search reports", "Търсене на отчети")}
            placeholder={text("Search reports", "Търсене на отчети")}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
          />
          <Button
            plain
            aria-label={text("Sort by name", "Подреждане по име")}
            aria-pressed={sort}
            onClick={() => setSort(!sort)}
          >
            <AdminIcon name="sort" />
          </Button>
        </div>
        <div className={styles.filters} data-studio-part="report-filters">
          <select
            aria-label={text("Created by", "Създаден от")}
            value={creator}
            onChange={(event) => {
              setCreator(event.target.value);
              setPage(0);
            }}
          >
            <option value="All">{text("Created by", "Създаден от")}</option>
            <option value="Treido">Treido</option>
            <option value="Local">
              {text("Local drafts", "Локални чернови")}
            </option>
          </select>
          <select
            aria-label={text("Category", "Категория")}
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setPage(0);
            }}
          >
            {[
              "All",
              "Acquisition",
              "Behavior",
              "Customers",
              "Inventory",
              "Sales",
              "Finances",
              "Fraud",
              "Marketing",
              "Orders",
              "Performance",
              "Profit Margin",
              "Retail Sales",
              "Custom",
            ].map((value) => (
              <option key={value} value={value}>
                {value === "All"
                  ? text("Category", "Категория")
                  : categoryText(value)}
              </option>
            ))}
          </select>
          <div
            role="tablist"
            aria-label={text("Reports view", "Изглед на отчетите")}
          >
            {["All", "Pinned"].map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={view === value}
                onClick={() => {
                  setView(value);
                  setPage(0);
                }}
              >
                {value === "All"
                  ? text("All", "Всички")
                  : text("Pinned", "Закачени")}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.tableViewport}>
          <table className={styles.table} data-studio-part="table">
            <thead>
              <tr>
                <th>{text("Name", "Име")}</th>
                <th>{text("Category", "Категория")}</th>
                <th>{text("Last viewed", "Последен преглед")}</th>
                <th>{text("Created by", "Създаден от")}</th>
                <th>
                  <span className={styles.srOnly}>
                    {text("Pinned", "Закачен")}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((report) => (
                <tr key={report.id}>
                  <td>
                    <Link href={href(`reports/${report.id}`)}>
                      {text(report.en, report.bg)}
                    </Link>
                  </td>
                  <td>
                    <span
                      className={styles.category}
                      data-report-category={report.category}
                    >
                      {categoryText(report.category)}
                    </span>
                  </td>
                  <td>—</td>
                  <td>
                    <span className={styles.creator}>
                      <span aria-hidden="true">T</span>
                      {report.category === "Custom"
                        ? text("Local draft", "Локална чернова")
                        : "Treido"}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={styles.pin}
                      aria-label={`${text("Pin", "Закачи")} ${text(report.en, report.bg)}`}
                      aria-pressed={pinned.includes(report.id)}
                      onClick={() =>
                        setPinned(
                          pinned.includes(report.id)
                            ? pinned.filter((id) => id !== report.id)
                            : [...pinned, report.id],
                        )
                      }
                    >
                      {pinned.includes(report.id) ? "★" : "☆"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <p className={styles.noResults} role="status">
            {text(
              "No reports match these filters.",
              "Няма отчети за тези филтри.",
            )}
          </p>
        )}
        <div className={styles.pagination} data-studio-part="report-pagination">
          <Button
            plain
            aria-label={text("Previous page", "Предишна страница")}
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            <AdminIcon name="back" />
          </Button>
          <span role="status">
            {rows.length
              ? `${currentPage * 50 + 1}–${currentPage * 50 + shown.length}`
              : "0"}
          </span>
          <Button
            plain
            aria-label={text("Next page", "Следваща страница")}
            disabled={(currentPage + 1) * 50 >= rows.length}
            onClick={() => setPage(currentPage + 1)}
          >
            <AdminIcon name="chevron" />
          </Button>
        </div>
      </div>
      <p className={s.learn}>
        {text(
          "Sales and inventory reports use saved preview records. Traffic and attribution need connected analytics.",
          "Отчетите за продажби и наличности използват запазените примерни записи. Трафикът и атрибуцията изискват свързан анализ.",
        )}
      </p>
    </main>
  );
}
