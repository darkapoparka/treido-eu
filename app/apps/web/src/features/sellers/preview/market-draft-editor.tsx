"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { countryName, countryOptions } from "../../locale/regions";
import { AdminIcon, type AdminIconName } from "../admin-icons";
import { usePreview } from "./context";
import { put, type Market } from "./model";
import {
  Badge,
  Button,
  EditorBreadcrumb,
  Field,
  Header,
  Modal,
  Panel,
  s,
} from "./ui";
import styles from "./markets.module.css";

export function MarketDraftEditor({ id }: { id: string }) {
  const { store, href, text, language, update, notify } = usePreview();
  const router = useRouter();
  const search = useSearchParams();
  const existing = store.markets.find((market) => market.id === id);
  const [market, setMarket] = useState<Market>(
    existing ?? {
      id: "new",
      title: (search.get("name") ?? "").slice(0, 100),
      countries: (search.get("countries") ?? "").slice(0, 500),
      currency: "EUR",
      status: "Draft",
    },
  );
  const [editing, setEditing] = useState<"conditions" | "currency" | null>(
    null,
  );
  const [conditionDraft, setConditionDraft] = useState<string[]>([]);
  const [currencyDraft, setCurrencyDraft] = useState(market.currency);
  const [query, setQuery] = useState("");
  const regions = countryOptions(language);
  const filteredRegions = regions.filter(({ code, name }) =>
    `${name} ${countryName(code, "en")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  if (id !== "new" && !existing)
    return (
      <main className={s.editor}>
        <Header
          title={text("Market not found", "Пазарът не е намерен")}
          back={href("markets")}
        />
      </main>
    );
  const inherited: {
    en: string;
    bg: string;
    value: string;
    icon: AdminIconName;
    to: string;
  }[] = [
    {
      en: "Catalogs",
      bg: "Каталози",
      value: text("Local catalog drafts", "Локални чернови на каталози"),
      icon: "product",
      to: "catalogs",
    },
    {
      en: "Discounts",
      bg: "Отстъпки",
      value: text("Saved local discounts", "Запазени локални отстъпки"),
      icon: "discount",
      to: "discounts",
    },
    {
      en: "Domain / language",
      bg: "Домейн / език",
      value: text("Local preview · English", "Локален преглед · Български"),
      icon: "store",
      to: "settings/languages",
    },
    {
      en: "Online Store",
      bg: "Онлайн магазин",
      value: store.settings.name,
      icon: "store",
      to: "store",
    },
    {
      en: "Checkout and accounts",
      bg: "Поръчване и акаунти",
      value: text("Local preferences", "Локални предпочитания"),
      icon: "customers",
      to: "settings/checkout",
    },
  ];
  const openConditions = () => {
    setConditionDraft(
      market.countryCodes ??
        countryOptions("en")
          .filter((region) =>
            market.countries
              .split(",")
              .map((country) => country.trim())
              .includes(region.name),
          )
          .map((region) => region.code),
    );
    setQuery("");
    setEditing("conditions");
  };
  return (
    <main
      className={`${s.editor} ${styles.editor}`}
      data-studio-part="editor"
      data-studio-builder="market"
    >
      <EditorBreadcrumb
        href={href("markets")}
        title={text("Markets", "Пазари")}
        icon="markets"
      />
      <Header
        title={existing ? market.title : text("New market", "Нов пазар")}
        actions={<Badge>{market.status}</Badge>}
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const saved = {
            ...market,
            title: market.title.trim(),
            id: existing?.id ?? `market-${crypto.randomUUID()}`,
          };
          if (!saved.title) return;
          update({ markets: put(store.markets, saved) });
          notify(
            text(
              "Market draft preferences saved locally.",
              "Предпочитанията за черновата на пазара са запазени локално.",
            ),
          );
          router.push(href(`markets/${saved.id}`));
        }}
      >
        <div className={s.editorColumns} data-studio-part="editor-layout">
          <div className={s.stack} data-studio-part="editor-main">
            <Panel part="market-details">
              <div className={styles.fields}>
                <Field label={text("Name", "Име")}>
                  <input
                    required
                    maxLength={100}
                    value={market.title}
                    onChange={(event) =>
                      setMarket({ ...market, title: event.target.value })
                    }
                  />
                </Field>
                <Field label={text("Status", "Състояние")}>
                  <select
                    className={styles.status}
                    value={market.status}
                    disabled={!existing}
                    onChange={(event) =>
                      setMarket({ ...market, status: event.target.value })
                    }
                  >
                    <option value="Draft">{text("Draft", "Чернова")}</option>
                    <option value="Active">
                      {text("Active locally", "Активен локално")}
                    </option>
                  </select>
                </Field>
              </div>
              <div
                className={styles.includes}
                data-studio-part="market-includes"
              >
                <strong>{text("Includes", "Включва")}</strong>
                <Button plain onClick={openConditions}>
                  <MarketAddIcon />
                  {market.countries ||
                    text("Add condition", "Добавяне на условие")}
                </Button>
              </div>
            </Panel>
            <section
              className={styles.group}
              data-studio-part="market-customized"
            >
              <h2>{text("Customized", "Персонализирани")}</h2>
              <Panel>
                <p className={s.muted}>
                  {text(
                    "Prepare local preferences for customers in this market.",
                    "Подгответе локални предпочитания за клиентите на този пазар.",
                  )}
                </p>
              </Panel>
            </section>
            <section className={styles.group}>
              <h2>{text("Inherited", "Наследени")}</h2>
              <div
                className={styles.inherited}
                data-studio-part="market-inherited"
              >
                <button
                  type="button"
                  className={styles.inheritedRow}
                  onClick={() => {
                    setCurrencyDraft(market.currency);
                    setEditing("currency");
                  }}
                >
                  <AdminIcon name="finance" />
                  <strong>{text("Currency", "Валута")}</strong>
                  <span>
                    <span
                      data-studio-part="market-inherited-origin"
                      aria-hidden="true"
                    >
                      <AdminIcon name="store" />
                    </span>
                    {market.currency}
                  </span>
                  <span
                    aria-hidden="true"
                    data-studio-part="market-inherited-action"
                  >
                    <MarketAddIcon />
                    <AdminIcon
                      name="chevron"
                      className={styles.mobileChevron}
                    />
                  </span>
                </button>
                {inherited.map((row) => (
                  <Link
                    className={styles.inheritedRow}
                    key={row.to}
                    href={href(row.to)}
                  >
                    <AdminIcon name={row.icon} />
                    <strong>{text(row.en, row.bg)}</strong>
                    <span>
                      <span
                        data-studio-part="market-inherited-origin"
                        aria-hidden="true"
                      >
                        <AdminIcon name="store" />
                      </span>
                      {row.value}
                    </span>
                    <span
                      aria-hidden="true"
                      data-studio-part="market-inherited-action"
                    >
                      <MarketAddIcon />
                      <AdminIcon
                        name="chevron"
                        className={styles.mobileChevron}
                      />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          </div>
          <aside className={s.editorSide} data-studio-part="editor-side">
            <div
              className={styles.hierarchy}
              data-studio-part="market-hierarchy"
            >
              <svg viewBox="0 0 280 140" aria-hidden="true">
                <path d="M66 70H150" stroke="#b8b8b8" strokeWidth="2" />
                <circle
                  cx="66"
                  cy="70"
                  r="7"
                  fill="white"
                  stroke="#b8b8b8"
                  strokeWidth="2"
                />
                <rect
                  x="116"
                  y="58"
                  width="66"
                  height="24"
                  rx="12"
                  fill="white"
                  stroke="#b8b8b8"
                  strokeWidth="2"
                />
              </svg>
            </div>
            <p className={s.help} data-studio-part="market-hierarchy-caption">
              {text(
                existing
                  ? "Saved local market configuration"
                  : "Save to show market hierarchy",
                existing
                  ? "Запазена локална конфигурация на пазара"
                  : "Запазете, за да видите структурата на пазара",
              )}
            </p>
          </aside>
        </div>
        <p className={s.help}>
          {text(
            "Local draft preferences only. Pricing, checkout and market publication remain unchanged.",
            "Само предпочитания за локалната чернова. Цените, поръчването и публикуването на пазари не се променят.",
          )}
        </p>
        <div className={s.saveBar} data-studio-part="save-bar">
          <Link className={s.button} href={href("markets")}>
            {text("Cancel", "Отказ")}
          </Link>
          <Button primary type="submit">
            {text("Save draft", "Запази чернова")}
          </Button>
        </div>
      </form>
      {editing && (
        <Modal
          title={
            editing === "conditions"
              ? text("Market conditions", "Условия за пазара")
              : text("Currency", "Валута")
          }
          surface={
            editing === "conditions" ? "market-conditions" : "market-currency"
          }
          className={styles.conditionModal}
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button onClick={() => setEditing(null)}>
                {text("Cancel", "Отказ")}
              </Button>
              <Button
                primary
                onClick={() => {
                  setMarket({
                    ...market,
                    ...(editing === "conditions"
                      ? {
                          countries: conditionDraft
                            .map((code) => countryName(code, "en"))
                            .join(", "),
                          countryCodes: conditionDraft,
                        }
                      : { currency: currencyDraft }),
                  });
                  setEditing(null);
                }}
              >
                {text("Done", "Готово")}
              </Button>
            </>
          }
        >
          {editing === "conditions" ? (
            <>
              <div
                className={styles.conditionScope}
                data-studio-part="market-condition-scope"
              >
                <span>{text("Includes", "Включва")}</span>
                <div className={styles.conditionType}>
                  <AdminIcon name="markets" />
                  <select aria-label={text("Condition type", "Вид условие")}>
                    <option>{text("Regions", "Региони")}</option>
                  </select>
                </div>
              </div>
              <div
                className={styles.regionPicker}
                data-studio-part="market-region-picker"
              >
                <Field label={text("Search regions", "Търсене на региони")}>
                  <div className={styles.regionSearch}>
                    <AdminIcon name="search" />
                    <input
                      type="search"
                      data-studio-autofocus
                      value={query}
                      maxLength={160}
                      placeholder={text("Search regions", "Търсене на региони")}
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key !== "Escape") return;
                        event.preventDefault();
                        event.stopPropagation();
                        setEditing(null);
                      }}
                    />
                  </div>
                </Field>
                <label
                  className={`${s.check} ${styles.selectRegions}`}
                  data-studio-part="market-region-header"
                >
                  <input
                    type="checkbox"
                    aria-label={text(
                      "Select all on this page",
                      "Избор на всички в този списък",
                    )}
                    checked={
                      !!filteredRegions.length &&
                      filteredRegions.every(({ code }) =>
                        conditionDraft.includes(code),
                      )
                    }
                    disabled={!filteredRegions.length}
                    onChange={() => {
                      const allSelected = filteredRegions.every(({ code }) =>
                        conditionDraft.includes(code),
                      );
                      const visibleCodes = new Set(
                        filteredRegions.map(({ code }) => code),
                      );
                      setConditionDraft(
                        allSelected
                          ? conditionDraft.filter(
                              (code) => !visibleCodes.has(code),
                            )
                          : [...new Set([...conditionDraft, ...visibleCodes])],
                      );
                    }}
                  />
                  <span>{text("Regions", "Региони")}</span>
                </label>
                <div
                  className={styles.regions}
                  data-studio-part="market-region-list"
                >
                  {filteredRegions.map(({ code, name }) => (
                    <label
                      className={s.check}
                      data-studio-part="check"
                      key={code}
                    >
                      <input
                        type="checkbox"
                        checked={conditionDraft.includes(code)}
                        onChange={() =>
                          setConditionDraft(
                            conditionDraft.includes(code)
                              ? conditionDraft.filter(
                                  (country) => country !== code,
                                )
                              : [...conditionDraft, code],
                          )
                        }
                        aria-label={name}
                      />
                      <Image
                        className={styles.regionFlag}
                        src={`/merchant-admin/region-flags/${code.toLowerCase()}.svg`}
                        width={28}
                        height={21}
                        alt=""
                        unoptimized
                      />
                      <span>{name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <Field
              label={text("Display currency", "Валута за показване")}
              help={text(
                "A local preference only; no currency conversion.",
                "Само локално предпочитание; няма преобразуване на валута.",
              )}
            >
              <select
                value={currencyDraft}
                onChange={(event) => setCurrencyDraft(event.target.value)}
              >
                {["EUR", "USD", "GBP"].map((currency) => (
                  <option key={currency}>{currency}</option>
                ))}
              </select>
            </Field>
          )}
        </Modal>
      )}
    </main>
  );
}

function MarketAddIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 6v8M6 10h8" />
    </svg>
  );
}
