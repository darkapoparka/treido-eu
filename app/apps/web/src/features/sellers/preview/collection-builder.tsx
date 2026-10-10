"use client";
import Link from "next/link";
import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminIcon } from "../admin-icons";
import { usePreview } from "./context";
import { put, type Entry } from "./model";
import { ProductRichEditor } from "./product-rich-editor";
import {
  Action,
  Badge,
  Button,
  Check,
  EditorSection,
  EditorBreadcrumb,
  Field,
  Header,
  Modal,
  Panel,
  s,
} from "./ui";
import styles from "./collection-builder.module.css";

export function CollectionBuilder({ id }: { id: string }) {
  const { store, href, text, update, notify } = usePreview();
  const router = useRouter();
  const existing = store.collections.find((entry) => entry.id === id);
  const [entry, setEntry] = useState<Entry>(
    () =>
      existing ?? {
        id: "new",
        title: "",
        body: "",
        type: "Manual",
        status: "Draft",
        tags: "",
      },
  );
  const [selected, setSelected] = useState(() =>
    store.products
      .filter((product) => existing && product.collection === existing.title)
      .map((product) => product.id),
  );
  const [dialog, setDialog] = useState<
    "title" | "description" | "products" | "image" | null
  >(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [sourcesVisible, setSourcesVisible] = useState(true);
  const [gridView, setGridView] = useState(true);
  const [itemStatus, setItemStatus] = useState("All");
  const [filtersVisible, setFiltersVisible] = useState(true);
  const dialogSnapshot = useRef({ entry, selected });
  const openDialog = (next: typeof dialog) => {
    dialogSnapshot.current = { entry: { ...entry }, selected: [...selected] };
    setQuery("");
    setDialog(next);
  };
  const cancelDialog = () => {
    setEntry(dialogSnapshot.current.entry);
    setSelected(dialogSnapshot.current.selected);
    setDialog(null);
    setError("");
  };
  const patch = (values: Partial<Entry>) => setEntry({ ...entry, ...values });
  const items = store.products.filter((product) =>
    selected.includes(product.id),
  );
  const visibleItems = items.filter(
    (product) => itemStatus === "All" || product.status === itemStatus,
  );
  if (id !== "new" && !existing)
    return (
      <main className={s.editor} data-studio-part="editor">
        <Header
          title={text("Collection not found", "Колекцията не е намерена")}
          back={href("collections")}
        />
      </main>
    );
  const save = () => {
    if (!entry.title.trim()) {
      setError(
        text(
          "Add a collection title before saving.",
          "Добавете заглавие на колекцията преди запазване.",
        ),
      );
      openDialog("title");
      return;
    }
    const saved = {
      ...entry,
      title: entry.title.trim(),
      id: existing ? id : `collection-${crypto.randomUUID()}`,
    };
    update({
      collections: put(store.collections, saved),
      products: store.products.map((product) =>
        selected.includes(product.id)
          ? { ...product, collection: saved.title }
          : existing && product.collection === existing.title
            ? { ...product, collection: "" }
            : product,
      ),
    });
    notify(
      text(
        "Collection saved in this device's preview.",
        "Колекцията е запазена в прегледа на това устройство.",
      ),
    );
    router.push(href(`collections/${saved.id}`));
  };
  const upload = (file?: File) => {
    if (!file) return;
    if (
      file.size > 120000 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setError(
        text(
          "Choose a JPG, PNG or WebP image up to 120 KB.",
          "Изберете JPG, PNG или WebP изображение до 120 KB.",
        ),
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      patch({ image: String(reader.result) });
      setError("");
      setDialog(null);
    };
    reader.onerror = () =>
      setError(
        text(
          "The image could not be read. Try again.",
          "Изображението не може да бъде прочетено. Опитайте отново.",
        ),
      );
    reader.readAsDataURL(file);
  };
  return (
    <main
      className={s.editor}
      data-studio-part="editor"
      data-studio-builder="collection"
    >
      <EditorBreadcrumb
        href={href("collections")}
        title={text("Collections", "Колекции")}
        icon="product"
        current={entry.title || text("Add collection", "Добавяне на колекция")}
      />
      <div className={s.editorColumns} data-studio-part="editor-layout">
        <div className={s.stack} data-studio-part="editor-main">
          <Panel part="collection-summary">
            <div
              className={styles.summary}
              data-studio-part="collection-summary"
            >
              <button
                type="button"
                className={styles.image}
                aria-label={text(
                  "Collection image",
                  "Изображение на колекцията",
                )}
                onClick={() => openDialog("image")}
              >
                {entry.image ? (
                  <Image
                    unoptimized
                    src={entry.image}
                    alt=""
                    width={148}
                    height={148}
                  />
                ) : (
                  <AdminIcon name="content" />
                )}
              </button>
              <div className={styles.copy}>
                <Button
                  plain
                  onClick={() => {
                    setError("");
                    openDialog("title");
                  }}
                >
                  {entry.title ||
                    text("＋ Add title", "＋ Добавяне на заглавие")}
                </Button>
                <Button plain onClick={() => openDialog("description")}>
                  {entry.body
                    ? text("Edit description", "Редактиране на описанието")
                    : text("＋ Add description", "＋ Добавяне на описание")}
                </Button>
                {entry.body && <p>{entry.body.slice(0, 160)}</p>}
                <span>{text("Store preview", "Преглед на магазина")}</span>
                <Badge>{entry.status}</Badge>
              </div>
            </div>
          </Panel>
          <section data-studio-part="collection-items">
            <header className={styles.itemsHeading}>
              <h2>
                {text("Collection items", "Продукти в колекцията")}{" "}
                <span>{items.length}</span>
              </h2>
            </header>
            <div
              className={styles.itemsCard}
              data-studio-part="collection-items-card"
            >
              <div
                className={styles.itemControls}
                data-studio-part="collection-item-controls"
              >
                <div>
                  <Button
                    plain
                    disabled={!items.length}
                    aria-label={text("Grid view", "Изглед в мрежа")}
                    aria-pressed={gridView}
                    onClick={() => setGridView(true)}
                  >
                    ▦
                  </Button>
                  <Button
                    plain
                    disabled={!items.length}
                    aria-label={text("List view", "Изглед в списък")}
                    aria-pressed={!gridView}
                    onClick={() => setGridView(false)}
                  >
                    ☰
                  </Button>
                </div>
                <Button
                  plain
                  aria-label={text(
                    "Filter collection items",
                    "Филтър за продукти в колекцията",
                  )}
                  onClick={() => setFiltersVisible(!filtersVisible)}
                  aria-expanded={filtersVisible}
                >
                  <AdminIcon name="sort" />
                </Button>
              </div>
              {filtersVisible && (
                <div
                  className={styles.statusFilters}
                  data-studio-part="collection-status-filters"
                >
                  <select
                    value={itemStatus}
                    aria-label={text(
                      "Filter products by status",
                      "Филтър по състояние на продуктите",
                    )}
                    onChange={(event) => setItemStatus(event.target.value)}
                  >
                    {["All", "Active", "Draft", "Archived"].map((value) => (
                      <option key={value} value={value}>
                        {value === "All"
                          ? text("All statuses", "Всички състояния")
                          : value === "Active"
                            ? text("Active", "Активни")
                            : value === "Draft"
                              ? text("Draft", "Чернови")
                              : text("Archived", "Архивирани")}
                      </option>
                    ))}
                  </select>
                  <Button plain onClick={() => setItemStatus("All")}>
                    {text("Clear all", "Изчисти всички")}
                  </Button>
                </div>
              )}
              <div
                className={`${styles.grid} ${gridView ? "" : styles.listView}`}
              >
                {items.length ? (
                  visibleItems.length ? (
                    visibleItems.map((product) => (
                      <article key={product.id}>
                        {product.image ? (
                          <Image
                            unoptimized
                            src={product.image}
                            alt=""
                            width={148}
                            height={148}
                          />
                        ) : (
                          <div className={styles.placeholder}>
                            <AdminIcon name="product" />
                          </div>
                        )}
                        <Link href={href(`products/${product.id}`)}>
                          {product.title}
                        </Link>
                        <Button
                          plain
                          aria-label={`${text("Remove from collection", "Премахване от колекцията")} ${product.title}`}
                          onClick={() =>
                            setSelected(
                              selected.filter((value) => value !== product.id),
                            )
                          }
                        >
                          ×
                        </Button>
                      </article>
                    ))
                  ) : (
                    <p className={styles.filterEmpty}>
                      {text(
                        "No products match this status.",
                        "Няма продукти с това състояние.",
                      )}
                    </p>
                  )
                ) : (
                  <div className={styles.empty}>
                    <div
                      className={styles.emptyTiles}
                      aria-hidden="true"
                      data-studio-part="collection-empty-tiles"
                    >
                      {Array.from({ length: 8 }, (_, index) => (
                        <div
                          key={index}
                          data-studio-part="collection-empty-tile"
                        >
                          <div />
                          <span />
                          <span />
                        </div>
                      ))}
                    </div>
                    <div
                      className={styles.emptyCopy}
                      data-studio-part="collection-empty-copy"
                    >
                      <p>
                        {text(
                          "Add products to populate your collection.",
                          "Добавете продукти, за да попълните колекцията.",
                        )}
                      </p>
                      <div className={styles.sourceActions}>
                        <Button
                          disabled
                          title={text(
                            "Automatic conditions are unavailable in this preview.",
                            "Автоматичните условия не са достъпни в този преглед.",
                          )}
                        >
                          {text("Add condition", "Добавяне на условие")}
                        </Button>
                        <Button onClick={() => openDialog("products")}>
                          {text("Add products", "Добавяне на продукти")}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
          <EditorSection
            title={text("Search engine listing", "Вид в търсачките")}
            part="collection-seo"
          >
            <p className={s.muted}>
              {entry.title
                ? `${entry.title} · ${entry.body.slice(0, 160)}`
                : text(
                    "Add a title and description to preview this listing.",
                    "Добавете заглавие и описание за преглед на изгледа.",
                  )}
            </p>
          </EditorSection>
        </div>
        <aside className={s.editorSide} data-studio-part="editor-side">
          <section
            className={styles.sources}
            data-studio-part="collection-sources"
          >
            <header
              className={styles.itemsHeading}
              data-studio-part="collection-sources-heading"
            >
              <h2>{text("Sources", "Източници")}</h2>
              <Button
                plain
                aria-label={
                  sourcesVisible
                    ? text("Hide sources", "Скриване на източниците")
                    : text("Show sources", "Показване на източниците")
                }
                aria-expanded={sourcesVisible}
                onClick={() => setSourcesVisible(!sourcesVisible)}
              >
                <AdminIcon name="chevron" />
              </Button>
            </header>
            <div hidden={!sourcesVisible}>
              <Panel part="collection-source">
                <div className={styles.source}>
                  <div className={styles.sourceTitle}>
                    <AdminIcon name="product" />
                    <strong>{text("Products", "Продукти")}</strong>
                    <span className={s.help}>{text("Manual", "Ръчно")}</span>
                  </div>
                  <div className={styles.sourceActions}>
                    <Button
                      disabled
                      title={text(
                        "Automatic collection conditions are not supported in this preview.",
                        "Автоматични условия за колекции не се поддържат в този преглед.",
                      )}
                    >
                      {text("Add condition", "Добавяне на условие")}
                    </Button>
                    <Button onClick={() => openDialog("products")}>
                      {text("Add products", "Добавяне на продукти")}
                    </Button>
                  </div>
                </div>
              </Panel>
              <Button
                plain
                disabled
                className={styles.exclude}
                title={text(
                  "Remove selected products in Collection items.",
                  "Премахнете избрани продукти в Продукти в колекцията.",
                )}
              >
                ＋ {text("Exclude", "Изключване")}
              </Button>
              <Button
                className={styles.addSource}
                disabled
                title={text(
                  "Select or remove products in the collection grid.",
                  "Избирайте или премахвайте продукти в списъка на колекцията.",
                )}
              >
                <span aria-hidden="true">＋</span>
                <span className={styles.srOnly}>
                  {text(
                    "Add source unavailable",
                    "Добавянето на източник не е достъпно",
                  )}
                </span>
              </Button>
            </div>
          </section>
          <Panel
            title={text("Visibility", "Видимост")}
            part="collection-visibility"
          >
            <Field label={text("Status", "Състояние")}>
              <select
                value={entry.status}
                onChange={(e) => patch({ status: e.target.value })}
              >
                <option value="Draft">{text("Draft", "Чернова")}</option>
                <option value="Active">{text("Active", "Активна")}</option>
              </select>
            </Field>
          </Panel>
          <Panel
            title={text("Theme template", "Шаблон на магазина")}
            part="collection-template"
          >
            <p>{text("Default collection", "Стандартна колекция")}</p>
            <p className={s.help}>
              {text(
                "The storefront preview uses one fixed layout.",
                "Прегледът на магазина използва един фиксиран изглед.",
              )}
            </p>
          </Panel>
          <Panel title={text("Tags", "Етикети")} part="collection-tags">
            <Field label={text("Collection tags", "Етикети на колекцията")}>
              <input
                maxLength={300}
                value={entry.tags}
                onChange={(e) => patch({ tags: e.target.value })}
              />
            </Field>
          </Panel>
        </aside>
      </div>
      <div className={s.saveBar} data-studio-part="save-bar">
        <Action href={href("collections")}>{text("Cancel", "Отказ")}</Action>
        <Button primary onClick={save}>
          {text("Save", "Запазване")}
        </Button>
      </div>
      {dialog && (
        <Modal
          title={
            dialog === "title"
              ? text("Collection title", "Заглавие на колекцията")
              : dialog === "description"
                ? text("Description", "Описание")
                : dialog === "image"
                  ? text("Collection image", "Изображение на колекцията")
                  : text("Select products", "Избор на продукти")
          }
          onClose={cancelDialog}
          surface={`collection-${dialog}`}
          footer={
            <>
              <Button onClick={cancelDialog}>{text("Cancel", "Отказ")}</Button>
              <Button
                primary
                onClick={() => {
                  setDialog(null);
                  setError("");
                }}
              >
                {text("Done", "Готово")}
              </Button>
            </>
          }
        >
          {dialog === "title" && (
            <Field label={text("Title", "Заглавие")}>
              <input
                maxLength={160}
                value={entry.title}
                onChange={(e) => {
                  patch({ title: e.target.value });
                  setError("");
                }}
                data-studio-autofocus
              />
            </Field>
          )}
          {dialog === "description" && (
            <Field label={text("Description", "Описание")}>
              <ProductRichEditor
                value={entry.body}
                html={entry.descriptionHtml}
                onChange={(body, descriptionHtml) =>
                  patch({ body, descriptionHtml })
                }
              />
            </Field>
          )}
          {dialog === "products" && (
            <>
              <Field label={text("Search products", "Търсене на продукти")}>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  maxLength={160}
                />
              </Field>
              {store.products
                .filter(
                  (product) =>
                    product.status !== "Archived" &&
                    product.title.toLowerCase().includes(query.toLowerCase()),
                )
                .map((product) => (
                  <Check
                    key={product.id}
                    label={product.title}
                    checked={selected.includes(product.id)}
                    onChange={() =>
                      setSelected(
                        selected.includes(product.id)
                          ? selected.filter((value) => value !== product.id)
                          : [...selected, product.id],
                      )
                    }
                  />
                ))}
              {!store.products.length && (
                <p className={s.muted}>
                  {text(
                    "No preview products available.",
                    "Няма достъпни примерни продукти.",
                  )}
                </p>
              )}
              <p>
                {selected.length} {text("selected", "избрани")}
              </p>
            </>
          )}
          {dialog === "image" && (
            <>
              <Field
                label={text("Upload image", "Качване на изображение")}
                help={text(
                  "JPG, PNG or WebP · up to 120 KB · saved locally.",
                  "JPG, PNG или WebP · до 120 KB · запазва се локално.",
                )}
              >
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => upload(e.target.files?.[0])}
                />
              </Field>
              {store.entries
                .filter(
                  (file) =>
                    file.type === "File" && file.body.startsWith("data:image/"),
                )
                .map((file) => (
                  <Button
                    key={file.id}
                    onClick={() => {
                      patch({ image: file.body });
                      setDialog(null);
                    }}
                  >
                    {file.title}
                  </Button>
                ))}
              {entry.image && (
                <Button
                  onClick={() => {
                    patch({ image: "" });
                    setDialog(null);
                  }}
                >
                  {text("Remove image", "Премахване на изображението")}
                </Button>
              )}
            </>
          )}
          {error && (
            <p className={s.error} role="alert">
              {error}
            </p>
          )}
        </Modal>
      )}
    </main>
  );
}
