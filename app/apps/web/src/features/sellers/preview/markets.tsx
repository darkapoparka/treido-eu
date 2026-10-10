"use client";
import Link from "next/link";
import { useState } from "react";
import { AdminIcon } from "../admin-icons";
import { usePreview } from "./context";
import { MarketDraftEditor } from "./market-draft-editor";
import { Badge, Button, Header, Modal, listRows, useList, s } from "./ui";
import styles from "./markets.module.css";

export function Markets({ detail }: { detail?: string }) {
  const { store, href, text } = usePreview();
  const list = useList();
  const [searching, setSearching] = useState(false);
  const [sorting, setSorting] = useState(false);
  const [graph, setGraph] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);
  if (detail) return <MarketEditor key={detail} id={detail} />;
  const rows = listRows(
    store.markets,
    list.query,
    list.sort,
    (m) => `${m.title} ${m.countries}`,
  );
  const suggestions = [
    {
      name: "European Union",
      bg: "Европейски съюз",
      countries:
        "Austria, Belgium, Croatia, Cyprus, Czechia, Denmark, Estonia, Finland, France, Germany, Greece, Hungary, Ireland, Italy, Latvia, Lithuania, Luxembourg, Malta, Netherlands, Poland, Portugal, Romania, Slovakia, Slovenia, Spain, Sweden",
    },
    { name: "United States", bg: "Съединени щати", countries: "United States" },
  ];
  return (
    <main className={`${s.page} ${styles.page}`} data-studio-part="page">
      <Header
        title={text("Markets", "Пазари")}
        icon="markets"
        actions={
          <Link
            className={`${s.button} ${s.primary} ${styles.create}`}
            aria-label={text("Create market", "Създаване на пазар")}
            href={href("markets/new")}
          >
            <span>{text("Create market", "Създаване на пазар")}</span>
            <AdminIcon name="plus" />
          </Link>
        }
      />
      <div className={styles.views} data-studio-part="market-views">
        <div
          className={s.tabs}
          role="tablist"
          aria-label={text("Market views", "Изгледи на пазарите")}
        >
          {["All", "Regions"].map((value) => (
            <button
              type="button"
              key={value}
              className={s.tab}
              role="tab"
              aria-selected={list.tab === value}
              onClick={() => list.onTab(value)}
            >
              {value === "All"
                ? text("All", "Всички")
                : text("Regions", "Региони")}
            </button>
          ))}
        </div>
        <Button
          plain
          aria-expanded={graph}
          aria-label={text(
            "View market graph",
            "Преглед на структурата на пазарите",
          )}
          onClick={() => setGraph(!graph)}
          data-studio-part="market-graph-toggle"
        >
          <AdminIcon name="menu" />
        </Button>
        <Button
          plain
          aria-expanded={searching}
          aria-label={text(
            "Search and filter markets",
            "Търсене и филтриране на пазари",
          )}
          onClick={() => setSearching(!searching)}
        >
          <AdminIcon name="search" />
        </Button>
        <Button
          plain
          aria-label={text("Sort markets", "Подреждане на пазарите")}
          aria-haspopup="dialog"
          onClick={() => setSorting(true)}
        >
          <AdminIcon name="sort" />
        </Button>
      </div>
      {searching && (
        <div className={styles.search}>
          <AdminIcon name="search" />
          <input
            type="search"
            aria-label={text(
              "Search in all markets",
              "Търсене във всички пазари",
            )}
            placeholder={text(
              "Search in all markets",
              "Търсене във всички пазари",
            )}
            value={list.query}
            maxLength={160}
            onChange={(e) => list.onQuery(e.target.value)}
            autoFocus
          />
        </div>
      )}
      <div className={graph ? styles.split : undefined}>
        {graph && (
          <aside className={styles.graph} data-studio-part="market-graph">
            <h2>{text("Store default", "Стандартни за магазина")}</h2>
            <Link href={href("settings/general")}>{store.settings.name}</Link>
            <h3>{text("Regions", "Региони")}</h3>
            {store.markets.map((m) => (
              <Link key={m.id} href={href(`markets/${m.id}`)}>
                <AdminIcon name="markets" />
                {m.title}
              </Link>
            ))}
          </aside>
        )}
        <div className={styles.table} data-studio-part="market-list">
          <table className={s.table} data-studio-part="market-table">
            <thead>
              <tr>
                <th>{text("Market", "Пазар")}</th>
                <th>{text("Status", "Състояние")}</th>
                <th>{text("Includes", "Включва")}</th>
                <th>{text("Customizations", "Персонализации")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td>
                    <Link href={href(`markets/${m.id}`)}>
                      <AdminIcon name="markets" />
                      {m.title}
                    </Link>
                  </td>
                  <td>
                    <Badge>{m.status}</Badge>
                  </td>
                  <td>{m.countries}</td>
                  <td>
                    {m.currency === store.settings.currency ? "—" : m.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <p className={styles.noResults} role="status">
              {text("No matching markets", "Няма съответстващи пазари")}
            </p>
          )}
          {list.tab === "All" &&
            !list.query &&
            suggestions
              .filter(
                (item) =>
                  !dismissed.includes(item.name) &&
                  !store.markets.some((m) => m.title === item.name),
              )
              .map((item) => (
                <div className={styles.suggestion} key={item.name}>
                  <span aria-hidden="true">✧</span>
                  <Link
                    href={`${href("markets/new")}&name=${encodeURIComponent(item.name)}&countries=${encodeURIComponent(item.countries)}`}
                  >
                    {text("Create", "Създаване на")} {text(item.name, item.bg)}{" "}
                    {text("Market", "пазар")}
                  </Link>
                  <button
                    type="button"
                    aria-label={`${text("Dismiss suggested market", "Скриване на предложения пазар")} ${text(item.name, item.bg)}`}
                    onClick={() => setDismissed([...dismissed, item.name])}
                  >
                    ×
                  </button>
                </div>
              ))}
        </div>
      </div>
      <p className={s.learn}>
        <Link href={href("settings/markets")}>
          {text("Learn more about markets", "Научете повече за пазарите")}
        </Link>
      </p>
      {sorting && (
        <Modal
          title={text("Sort markets", "Подреждане на пазарите")}
          onClose={() => setSorting(false)}
        >
          {[
            { value: "newest", en: "Newest first", bg: "Най-нови първо" },
            { value: "az", en: "Title A–Z", bg: "Заглавие А–Я" },
            { value: "za", en: "Title Z–A", bg: "Заглавие Я–А" },
          ].map((option) => (
            <label className={s.check} key={option.value}>
              <input
                type="radio"
                name="market-sort"
                checked={list.sort === option.value}
                onChange={() => {
                  list.onSort(option.value);
                  setSorting(false);
                }}
              />
              {text(option.en, option.bg)}
            </label>
          ))}
        </Modal>
      )}
    </main>
  );
}

function MarketEditor({ id }: { id: string }) {
  return <MarketDraftEditor id={id} />;
}
