"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminIcon } from "../admin-icons";
import { usePreview } from "./context";
import { money, put, type Entry } from "./model";
import { validEditorDraft, type EditorDraft } from "./local-draft-model";
import {
  Action,
  Button,
  Check,
  EditorBreadcrumb,
  EditorSection,
  Field,
  Header,
  Modal,
  Panel,
  s,
  downloadCsv,
} from "./ui";
import styles from "./catalog-draft-editor.module.css";
type CatalogDraft = Extract<EditorDraft, { kind: "Catalog" }>;

export function CatalogDraftEditor({ id }: { id: string }) {
  const { store, href, text, language, update, notify } = usePreview();
  const router = useRouter();
  const existing = store.entries.find(
    (entry) => entry.id === id && entry.type === "CatalogDraft",
  );
  const [title, setTitle] = useState(existing?.title ?? "");
  const [draft, setDraft] = useState<CatalogDraft>(
    existing?.editorDraft?.kind === "Catalog"
      ? existing.editorDraft
      : {
          kind: "Catalog",
          marketIds: [],
          currency: "EUR",
          adjustment: 0,
          direction: "Decrease",
          compareAt: true,
          automatic: true,
          included: [],
          excluded: [],
        },
  );
  const [adjustment, setAdjustment] = useState(
    (draft.adjustment / 100).toString(),
  );
  const [assigning, setAssigning] = useState(false);
  const [marketDraft, setMarketDraft] = useState<string[]>([]);
  const [marketScope, setMarketScope] = useState("Regions");
  const [marketQuery, setMarketQuery] = useState("");
  const [view, setView] = useState("Included");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [sort, setSort] = useState(false);
  const [error, setError] = useState("");
  const patch = (values: Partial<CatalogDraft>) =>
    setDraft({ ...draft, ...values });
  const isIncluded = (productId: string) =>
    draft.automatic
      ? !draft.excluded.includes(productId)
      : draft.included.includes(productId);
  const products = store.products.filter(
    (product) => product.status !== "Archived",
  );
  const rows = products
    .filter(
      (product) =>
        (view === "All" || (view === "Included") === isIncluded(product.id)) &&
        `${product.title} ${product.sku}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) => (sort ? a.title.localeCompare(b.title) : 0));
  const visibleMarkets = store.markets.filter((market) =>
    market.title.toLowerCase().includes(marketQuery.toLowerCase()),
  );
  if (id !== "new" && !existing)
    return (
      <main className={s.editor}>
        <Header
          title={text("Catalog not found", "Каталогът не е намерен")}
          back={href("catalogs")}
        />
      </main>
    );
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const basisPoints = /^\d{1,4}(?:[.,]\d{1,2})?$/.test(adjustment)
      ? Math.round(Number(adjustment.replace(",", ".")) * 100)
      : -1;
    const savedDraft = { ...draft, adjustment: basisPoints };
    if (
      !title.trim() ||
      !validEditorDraft(savedDraft) ||
      !draft.marketIds.every((marketId) =>
        store.markets.some((market) => market.id === marketId),
      )
    ) {
      setError(
        text(
          "Add a title, valid adjustment and available local markets.",
          "Добавете заглавие, валидна корекция и достъпни локални пазари.",
        ),
      );
      return;
    }
    const entry: Entry = {
      id: existing?.id ?? `catalog-${crypto.randomUUID()}`,
      title: title.trim(),
      type: "CatalogDraft",
      status: "Draft",
      body: "",
      tags: "",
      editorDraft: savedDraft,
    };
    update({ entries: put(store.entries, entry) });
    notify(
      text(
        "Catalog draft saved locally. Product prices and publication are unchanged.",
        "Черновата на каталога е запазена локално. Цените и публикуването на продукти не се променят.",
      ),
    );
    router.push(href(`catalogs/${entry.id}`));
  };
  return (
    <main
      className={`${s.editor} ${styles.root}`}
      data-studio-part="editor"
      data-studio-builder="catalog"
    >
      <EditorBreadcrumb
        href={href("catalogs")}
        title={text("Catalogs", "Каталози")}
        icon="product"
      />
      <Header title={existing ? title : text("New catalog", "Нов каталог")} />
      <form onSubmit={save}>
        <Panel part="catalog-core">
          <div className={styles.nameRow} data-studio-part="catalog-name-row">
            <Field label={text("Title", "Заглавие")}>
              <div className={styles.counted}>
                <input
                  required
                  maxLength={255}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
                <span>{title.length}/255</span>
              </div>
            </Field>
            <Field label={text("Status", "Състояние")}>
              <select disabled value="Draft">
                <option value="Draft">{text("Draft", "Чернова")}</option>
              </select>
            </Field>
          </div>
          <div className={styles.markets} data-studio-part="catalog-markets">
            <strong>{text("Markets", "Пазари")}</strong>
            <Button
              plain
              onClick={() => {
                setMarketDraft([...draft.marketIds]);
                setMarketScope("Regions");
                setMarketQuery("");
                setAssigning(true);
              }}
            >
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
              {draft.marketIds.length
                ? draft.marketIds
                    .map(
                      (marketId) =>
                        store.markets.find((market) => market.id === marketId)
                          ?.title ??
                        text("Unavailable market", "Недостъпен пазар"),
                    )
                    .join(", ")
                : text("Add a market", "Добавяне на пазар")}
            </Button>
          </div>
        </Panel>
        <EditorSection
          title={text("Pricing", "Ценообразуване")}
          part="catalog-pricing"
        >
          <div className={styles.pricingRows}>
            <Field label={text("Set prices in", "Задаване на цени във")}>
              <div
                className={styles.currencyChoice}
                data-studio-part="catalog-currency-choice"
              >
                <span aria-hidden="true">
                  {draft.currency === "EUR"
                    ? text(
                        "Store currency (EUR €)",
                        "Валута на магазина (EUR €)",
                      )
                    : draft.currency}
                </span>
                <select
                  value={draft.currency}
                  onChange={(event) =>
                    patch({
                      currency: event.target.value as CatalogDraft["currency"],
                    })
                  }
                >
                  {["EUR", "USD", "GBP"].map((currency) => (
                    <option key={currency} value={currency}>
                      {currency === "EUR"
                        ? text(
                            "Store currency (EUR €)",
                            "Валута на магазина (EUR €)",
                          )
                        : currency}
                    </option>
                  ))}
                </select>
              </div>
            </Field>
            <div
              className={styles.adjustment}
              data-studio-part="catalog-adjustment"
            >
              <span>{text("Price adjustment", "Корекция на цената")}</span>
              <div
                className={styles.adjustmentValue}
                data-studio-part="catalog-adjustment-value"
              >
                <span aria-hidden="true">
                  {draft.direction === "Decrease" ? "−" : "+"}
                </span>
                <input
                  aria-label={text(
                    "Price adjustment percent",
                    "Процентна корекция на цената",
                  )}
                  inputMode="decimal"
                  maxLength={7}
                  pattern="[0-9]+([.,][0-9]{1,2})?"
                  value={adjustment}
                  onChange={(event) => setAdjustment(event.target.value)}
                />
                <span aria-hidden="true">%</span>
              </div>
              <select
                aria-label={text(
                  "Adjustment direction",
                  "Посока на корекцията",
                )}
                value={draft.direction}
                onChange={(event) =>
                  patch({
                    direction: event.target.value as CatalogDraft["direction"],
                  })
                }
              >
                <option value="Decrease">
                  {text("Decrease", "Намаление")}
                </option>
                <option value="Increase">
                  {text("Increase", "Увеличение")}
                </option>
              </select>
              <div
                className={styles.compareAt}
                data-studio-part="catalog-switch"
              >
                <Check
                  label={text(
                    "Include compare-at price",
                    "Включване на сравнителна цена",
                  )}
                  checked={draft.compareAt}
                  onChange={() => patch({ compareAt: !draft.compareAt })}
                />
              </div>
            </div>
          </div>
        </EditorSection>
        <EditorSection
          title={text("Products", "Продукти")}
          part="catalog-products"
          action={
            <div
              className={styles.productActions}
              data-studio-part="catalog-product-actions"
            >
              <div data-studio-part="catalog-switch">
                <Check
                  checked={draft.automatic}
                  label={text(
                    "Automatically include new products",
                    "Автоматично включване на нови продукти",
                  )}
                  onChange={() =>
                    patch({
                      automatic: !draft.automatic,
                      included: !draft.automatic
                        ? []
                        : products
                            .filter((product) => isIncluded(product.id))
                            .map((product) => product.id),
                      excluded: [],
                    })
                  }
                />
              </div>
              <Button
                disabled={!rows.length}
                onClick={() =>
                  downloadCsv("treido-local-catalog.csv", [
                    ["Product", "SKU", "Base price EUR", "Included"],
                    ...rows.map((product) => [
                      product.title,
                      product.sku,
                      (product.price / 100).toFixed(2),
                      String(isIncluded(product.id)),
                    ]),
                  ])
                }
              >
                {text("Export", "Експорт")}
              </Button>
              <Button
                disabled
                title={text(
                  "Catalog price import is unavailable.",
                  "Импортът на цени за каталог не е достъпен.",
                )}
              >
                {text("Import", "Импорт")}
              </Button>
            </div>
          }
        >
          <div
            className={styles.productViews}
            data-studio-part="catalog-product-views"
          >
            <div
              role="tablist"
              aria-label={text("Catalog products", "Продукти в каталога")}
            >
              {[
                ["Included", "Включени"],
                ["Excluded", "Изключени"],
                ["All", "Всички"],
              ].map(([value, bg]) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === value}
                  key={value}
                  onClick={() => setView(value)}
                >
                  {text(value, bg)}
                </button>
              ))}
            </div>
            <Button
              plain
              aria-label={text(
                "Search catalog products",
                "Търсене на продукти в каталога",
              )}
              onClick={() => setSearching(!searching)}
            >
              <AdminIcon name="search" />
            </Button>
            <Button
              plain
              aria-pressed={sort}
              aria-label={text(
                "Sort catalog products",
                "Подреждане на продуктите",
              )}
              onClick={() => setSort(!sort)}
            >
              <AdminIcon name="sort" />
            </Button>
          </div>
          {searching && (
            <Field label={text("Search products", "Търсене на продукти")}>
              <input
                autoFocus
                type="search"
                maxLength={160}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </Field>
          )}
          {rows.length ? (
            <div className={styles.table}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>{text("Product", "Продукт")}</th>
                    <th>{text("Base price", "Основна цена")}</th>
                    <th>{text("Included", "Включен")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <Link href={href(`products/${product.id}`)}>
                          {product.title}
                        </Link>
                      </td>
                      <td>{money(product.price, language)}</td>
                      <td>
                        <Check
                          label={`${text("Include", "Включване")} ${product.title}`}
                          checked={isIncluded(product.id)}
                          onChange={() => {
                            const included = isIncluded(product.id);
                            if (draft.automatic)
                              patch({
                                excluded: included
                                  ? [...draft.excluded, product.id]
                                  : draft.excluded.filter(
                                      (productId) => productId !== product.id,
                                    ),
                              });
                            else
                              patch({
                                included: included
                                  ? draft.included.filter(
                                      (productId) => productId !== product.id,
                                    )
                                  : [...draft.included, product.id],
                              });
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.empty}>
              <strong>
                {text(
                  view === "Included"
                    ? "No products included"
                    : "No matching products",
                  view === "Included"
                    ? "Няма включени продукти"
                    : "Няма съответстващи продукти",
                )}
              </strong>
              <p>
                {text(
                  "Include products in this local market catalog draft.",
                  "Включете продукти в локалната чернова на каталога.",
                )}
              </p>
              <Button plain onClick={() => setView("All")}>
                {text("View all products", "Преглед на всички продукти")}
              </Button>
            </div>
          )}
        </EditorSection>
        <p className={s.help}>
          {text(
            "Local planning only. Currency and adjustment preferences do not alter product prices or publish a catalog.",
            "Само локално планиране. Валутата и корекциите не променят цените на продуктите и не публикуват каталог.",
          )}
        </p>
        {error && (
          <p role="alert" className={s.error}>
            {error}
          </p>
        )}
        <div className={s.saveBar} data-studio-part="save-bar">
          <Action href={href("catalogs")}>{text("Cancel", "Отказ")}</Action>
          <Button primary type="submit">
            {text("Save draft", "Запази чернова")}
          </Button>
        </div>
      </form>
      {assigning && (
        <Modal
          title={text("Assign markets", "Задаване на пазари")}
          surface="catalog-market-selector"
          className={styles.marketModal}
          onClose={() => setAssigning(false)}
          footer={
            <>
              <Button onClick={() => setAssigning(false)}>
                {text("Cancel", "Отказ")}
              </Button>
              <Button
                primary
                onClick={() => {
                  patch({ marketIds: marketDraft });
                  setAssigning(false);
                }}
              >
                {text("Done", "Готово")}
              </Button>
            </>
          }
        >
          <Field label={text("Search markets", "Търсене на пазари")}>
            <div className={styles.marketSearch}>
              <AdminIcon name="search" />
              <input
                data-studio-autofocus
                type="search"
                value={marketQuery}
                maxLength={160}
                onChange={(event) => setMarketQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Escape") return;
                  event.preventDefault();
                  event.stopPropagation();
                  setAssigning(false);
                }}
                placeholder={text("Search", "Търсене")}
              />
            </div>
          </Field>
          <div
            className={styles.scopeTabs}
            role="tablist"
            aria-label={text("Market type", "Вид пазар")}
          >
            {[
              ["Regions", "Региони"],
              ["B2B", "B2B"],
              ["Retail", "На място"],
              ["Channels", "Канали"],
            ].map(([value, bg]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={marketScope === value}
                onClick={() => setMarketScope(value)}
              >
                {text(value, bg)}
              </button>
            ))}
          </div>
          <div
            className={styles.marketList}
            data-studio-part="catalog-market-list"
          >
            {marketScope === "Regions" ? (
              visibleMarkets.length ? (
                visibleMarkets.map((market) => (
                  <Check
                    key={market.id}
                    label={market.title}
                    checked={marketDraft.includes(market.id)}
                    onChange={() =>
                      setMarketDraft(
                        marketDraft.includes(market.id)
                          ? marketDraft.filter(
                              (marketId) => marketId !== market.id,
                            )
                          : [...marketDraft, market.id],
                      )
                    }
                  />
                ))
              ) : (
                <p className={s.help} role="status">
                  {text("No matching markets", "Няма съответстващи пазари")}
                </p>
              )
            ) : (
              <p className={s.help}>
                {text(
                  "This scope requires a connected business, retail or sales-channel adapter.",
                  "Този обхват изисква свързан адаптер за бизнес, търговия на място или канал за продажби.",
                )}
              </p>
            )}
          </div>
        </Modal>
      )}
    </main>
  );
}
