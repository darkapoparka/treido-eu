"use client";
import { useLocale as useIntlLocale } from "next-intl";
import { useCaption } from "../../locale/use-caption";
import { useTranslations } from "next-intl";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { ProductRichEditor } from "./product-rich-editor";
import { ProductOptions } from "./product-options";
import { MediaLibrary } from "./media-library";
import {
  ProductPrice,
  ProductInventory,
  ProductShipping,
} from "./product-details";
import { useRouter } from "next/navigation";
import { AdminIcon } from "../admin-icons";
import { AdminProductArt } from "../admin-product-art";
import admin from "../admin.module.css";
import { usePreview } from "./context";
import { blankProduct, money, parseMoney, put, type Product } from "./model";
import { parseProductCsv } from "./imports";
import {
  Action,
  Badge,
  Button,
  Confirm,
  Empty,
  Field,
  EditorSection,
  Header,
  Panel,
  TableFooter,
  Toolbar,
  downloadCsv,
  listRows,
  useList,
  s,
} from "./ui";
export function Products({
  detail,
  search = "",
}: {
  detail?: string;
  search?: string;
}) {
  const intlLocale = useIntlLocale();
  const ui = useTranslations("merchantUI");
  const { store, href, text, update, notify } = usePreview();
  const list = useList(search);
  const [remove, setRemove] = useState(false);
  if (detail) return <ProductEditor key={detail} id={detail} />;
  if (!store.products.length) return <EmptyProducts />;
  const rows = listRows(
    store.products.filter((p) => list.tab === "All" || p.status === list.tab),
    list.query,
    list.sort,
    (p) => `${p.title} ${p.sku}`,
  );
  const bulk = (status: Product["status"]) => {
    update({
      products: store.products.map((p) =>
        list.selected.includes(p.id) ? { ...p, status } : p,
      ),
    });
    list.select([]);
    notify(
      ui("selectedProductsSavedAsValue1", {
        value1: status.toLowerCase(),
      }),
    );
  };
  return (
    <main className={s.page} data-studio-part="page">
      <Header
        title={text("Products", "Продукти")}
        icon="product"
        actions={
          <>
            <Button
              onClick={() =>
                downloadCsv("treido-products.csv", [
                  ["Title", "Price", "SKU", "Quantity", "Status", "Category"],
                  ...store.products.map((p) => [
                    p.title,
                    (p.price / 100).toFixed(2),
                    p.sku,
                    p.quantity,
                    p.status,
                    p.category,
                  ]),
                ])
              }
            >
              {ui("export")}
            </Button>
            <Action href={href("imports")}>{ui("import")}</Action>
            <Action primary href={href("products/new")}>
              {text("Add product", "Добави продукт")}
            </Action>
          </>
        }
      />
      {!store.products.length ? (
        <Empty
          kind="product"
          title={ui("firstUpWhatAreYouSelling")}
          body={ui("addTheProductsYouWantToSellStartWithA")}
        >
          <Action primary href={href("products/new")}>
            {ui("addProduct")}
          </Action>
          <Action href={href("imports")}>{ui("importProducts")}</Action>
        </Empty>
      ) : (
        <div className={s.tablePanel} data-studio-part="table-panel">
          <Toolbar {...list} tabs={["All", "Active", "Draft", "Archived"]} />
          {list.selected.length > 0 && (
            <div className={s.bulk} data-studio-part="bulk">
              <strong>
                {list.selected.length} {ui("selected_d7cbbb")}
              </strong>
              <Button onClick={() => bulk("Active")}>
                {ui("setAsActive")}
              </Button>
              <Button onClick={() => bulk("Draft")}>{ui("setAsDraft")}</Button>
              <Button onClick={() => bulk("Archived")}>{ui("archive")}</Button>
              <Button danger onClick={() => setRemove(true)}>
                {ui("delete")}
              </Button>
            </div>
          )}
          <div className={s.tableScroll} data-studio-part="table-scroll">
            <table className={s.table} data-studio-part="table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label={ui("selectAllProducts")}
                      checked={
                        !!rows.length &&
                        rows.every((p) => list.selected.includes(p.id))
                      }
                      onChange={(e) =>
                        list.select(
                          e.target.checked ? rows.map((p) => p.id) : [],
                        )
                      }
                      data-ui-label="selectAllProducts"
                    />
                  </th>
                  <th>{ui("product")}</th>
                  <th>{ui("status")}</th>
                  <th>{ui("inventory")}</th>
                  <th>{ui("category")}</th>
                  <th>{ui("price")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={ui("selectValue1", {
                          value1: p.title ?? "",
                        })}
                        checked={list.selected.includes(p.id)}
                        onChange={() => list.toggle(p.id)}
                      />
                    </td>
                    <td>
                      <Link
                        className={`${s.productCell} ${s.cellLink}`}
                        href={href(`products/${p.id}`)}
                      >
                        {p.image ? (
                          <Image
                            unoptimized
                            width={960}
                            height={472}
                            src={p.image}
                            alt=""
                            className={s.thumb}
                            data-studio-part="thumb"
                          />
                        ) : (
                          <span className={s.thumb} data-studio-part="thumb">
                            <AdminIcon name="product" />
                          </span>
                        )}
                        {p.title}
                      </Link>
                    </td>
                    <td>
                      <Badge>{p.status}</Badge>
                    </td>
                    <td>
                      {p.quantity} {ui("inStock_aab599")}
                    </td>
                    <td>{p.category || ui("uncategorized")}</td>
                    <td>{money(p.price, intlLocale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && (
            <div className={s.empty} data-studio-part="empty">
              <h2>{ui("noProductsFound")}</h2>
              <Button
                onClick={() => {
                  list.onQuery("");
                  list.onTab("All");
                }}
              >
                {ui("clearFilters")}
              </Button>
            </div>
          )}
          <TableFooter count={rows.length} />
        </div>
      )}
      {remove && (
        <Confirm
          title={ui("deletePreviewProducts")}
          body={ui("thisRemovesTheSelectedProductsFromThisDeviceSPreview")}
          action={ui("deletePreviewProducts_a00678")}
          onClose={() => setRemove(false)}
          onConfirm={() => {
            update({
              products: store.products.filter(
                (p) => !list.selected.includes(p.id),
              ),
            });
            list.select([]);
            notify(ui("previewProductsDeleted"));
          }}
        />
      )}
    </main>
  );
}
function EmptyProducts() {
  const ui = useTranslations("merchantUI");
  const { href, text } = usePreview();
  const [filters, setFilters] = useState(false);
  const list = useList();
  return (
    <main>
      <header className={admin.pageBar} data-studio-part="page-bar">
        <h1>
          <AdminIcon name="product" />
          {text("Products", "Продукти")}
        </h1>
        <details className={admin.pageActions} data-studio-part="page-actions">
          <summary aria-label={ui("pageActions")} data-ui-label="pageActions">
            <AdminIcon name="more" />
          </summary>
          <div>
            <Link href={href("imports")}>{ui("importProducts")}</Link>
            <Link href={href()}>{ui("goToHome")}</Link>
          </div>
        </details>
      </header>
      <div className={admin.pageBody} data-studio-part="page-body">
        <section
          className={admin.productPanel}
          data-studio-part="product-panel"
          aria-label={ui("sellerProducts")}
          data-ui-label="sellerProducts"
        >
          <div
            className={admin.productToolbar}
            data-studio-part="product-toolbar"
          >
            <nav
              className={admin.statusTabs}
              data-studio-part="status-tabs"
              aria-label={ui("productStatus")}
              data-ui-label="productStatus"
            >
              <Link href={href("products")} aria-current="page">
                {ui("all")}
              </Link>
            </nav>
            <div
              className={admin.toolbarTools}
              data-studio-part="toolbar-tools"
            >
              <button
                type="button"
                className={admin.toolbarIcon}
                data-studio-part="toolbar-icon"
                onClick={() => setFilters(!filters)}
                aria-label={ui("searchAndFilterResults")}
                data-ui-label="searchAndFilterResults"
              >
                <AdminIcon name="search" />
              </button>
              <button
                type="button"
                className={admin.toolbarIcon}
                data-studio-part="toolbar-icon"
                onClick={() => setFilters(!filters)}
                aria-label={ui("sortTheResults")}
                data-ui-label="sortTheResults"
              >
                <AdminIcon name="sort" />
              </button>
            </div>
          </div>
          {filters && <Toolbar {...list} />}
          <div className={admin.empty} data-studio-part="empty">
            <div>
              <h2>{text("Add your products", "Добави твоите продукти")}</h2>
              <p>
                {text(
                  "Start by adding products to your store that your customers will love.",
                  "Започни с продуктите, които твоите купувачи ще харесат.",
                )}
              </p>
              <div
                className={admin.emptyActions}
                data-studio-part="empty-actions"
              >
                <Link
                  href={href("products/new")}
                  className={admin.primary}
                  data-studio-part="primary"
                >
                  <AdminIcon name="plus" />
                  {text("Add product", "Добави продукт")}
                </Link>
                <Link
                  href={href("imports")}
                  className={admin.secondary}
                  data-studio-part="secondary"
                >
                  {text("Import", "Импорт")}
                </Link>
              </div>
            </div>
            <AdminProductArt />
          </div>
          <div className={admin.emptyFooter} data-studio-part="empty-footer">
            <h3>
              {text(
                "From a draft to your first buyer",
                "От чернова до първия купувач",
              )}
            </h3>
            <p>
              {text(
                "Add photos, a category and a price to your draft. Review the saved product to check the requirements before you publish it to the Treido marketplace.",
                "Добави снимки, категория и цена. Прегледай запазения продукт, за да видиш какво още е нужно преди публикуване.",
              )}
            </p>
            <Link
              className={admin.secondary}
              data-studio-part="secondary"
              href={href()}
            >
              {text("Go to Home", "Към началото")}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
function ProductEditor({ id }: { id: string }) {
  const caption = useCaption();
  const ui = useTranslations("merchantUI");
  const { store, href, text, update, notify } = usePreview();
  const router = useRouter();
  const existing = store.products.find((p) => p.id === id);
  const [product, setProduct] = useState<Product>(
    () => existing ?? blankProduct(id),
  );
  const [price, setPrice] = useState((product.price / 100).toFixed(2));
  const [error, setError] = useState("");
  const [remove, setRemove] = useState(false);
  const [mediaPicker, setMediaPicker] = useState(false);
  const [seoEditor, setSeoEditor] = useState(false);
  if (id !== "new" && !existing)
    return (
      <main className={s.editor} data-studio-part="editor">
        <Header title={ui("productNotFound")} back={href("products")} />
        <Empty
          title={ui("thisPreviewProductIsNoLongerAvailable")}
          body={ui("returnToYourProductsToSelectAnotherItem")}
        >
          <Action href={href("products")}>{ui("backToProducts")}</Action>
        </Empty>
      </main>
    );
  const patch = (change: Partial<Product>) =>
    setProduct({ ...product, ...change });
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const minor = parseMoney(price);
    if (
      !product.title.trim() ||
      minor === null ||
      !Number.isInteger(product.quantity) ||
      product.quantity < 0 ||
      product.quantity > 999999
    ) {
      setError(ui("enterAProductTitleAValidPriceAndAWhole"));
      return;
    }
    const saved = {
      ...product,
      id: id === "new" ? `product-${crypto.randomUUID()}` : id,
      title: product.title.trim(),
      price: minor,
    };
    update({ products: put(store.products, saved) });
    notify(ui("productSavedInThisFrontendPreview"));
    router.push(href(`products/${saved.id}`));
  };
  return (
    <main className={s.editor} data-studio-part="editor">
      <nav
        className={s.editorBreadcrumb}
        data-studio-part="editor-breadcrumb"
        aria-label={ui("productNavigation")}
        data-ui-label="productNavigation"
      >
        <Link
          href={href("products")}
          aria-label={ui("back")}
          data-ui-label="back"
        >
          <AdminIcon name="back" />
        </Link>
        <Link href={href("products")}>
          <AdminIcon name="product" />
          {ui("products")}
        </Link>
      </nav>
      <Header
        title={id === "new" ? ui("addProduct") : product.title}
        actions={
          existing && (
            <Button
              onClick={() => {
                update({
                  products: put(store.products, {
                    ...product,
                    id: `product-${crypto.randomUUID()}`,
                    title: `${product.title} (copy)`,
                    status: "Draft",
                  }),
                });
                notify(ui("duplicateSavedAsADraft"));
                router.push(href("products"));
              }}
            >
              {ui("duplicate")}
            </Button>
          )
        }
      />
      <form onSubmit={save}>
        {error && (
          <div className={s.error} data-studio-part="error" role="alert">
            {error}
          </div>
        )}
        <div className={s.editorColumns} data-studio-part="editor-layout">
          <div className={s.stack} data-studio-part="stack">
            <Panel part="product-core-panel">
              <Field label={ui("title")}>
                <input
                  required
                  maxLength={160}
                  value={product.title}
                  placeholder={ui("shortSleeveTShirt")}
                  onChange={(e) => patch({ title: e.target.value })}
                />
              </Field>
              <Field label={ui("description")}>
                <ProductRichEditor
                  value={product.description}
                  html={product.descriptionHtml}
                  onChange={(description, descriptionHtml) =>
                    patch({ description, descriptionHtml })
                  }
                />
              </Field>
              <div className={s.stack} data-studio-part="product-media">
                <h2>{ui("media")}</h2>
                {product.image && (
                  <>
                    <Image
                      unoptimized
                      width={960}
                      height={472}
                      className={s.mediaImage}
                      data-studio-part="media-image"
                      src={product.image}
                      alt={product.title || ui("productPreview")}
                    />
                    <Button onClick={() => patch({ image: "" })}>
                      {ui("removeImage")}
                    </Button>
                  </>
                )}
                <div className={s.upload} data-studio-part="upload">
                  <div className={s.actions} data-studio-part="actions">
                    <label className={s.button} data-studio-part="button">
                      {text("Upload new", "Качи нова")}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        aria-label={ui("uploadProductImage")}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (
                            file.size > 120000 ||
                            !["image/png", "image/jpeg", "image/webp"].includes(
                              file.type,
                            )
                          ) {
                            setError(
                              ui("forThisDeviceOnlyPreviewChooseAPNGJPEGOr"),
                            );
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () =>
                            patch({ image: String(reader.result) });
                          reader.readAsDataURL(file);
                        }}
                        data-ui-label="uploadProductImage"
                      />
                    </label>
                    <Button plain onClick={() => setMediaPicker(true)}>
                      {text("Select existing", "Избери съществуваща")}
                    </Button>
                  </div>
                  <span className={s.help} data-studio-part="field-help">
                    {ui("addASmallImageToPreviewYourProduct")}
                  </span>
                </div>
              </div>
              <Field
                label={ui("category")}
                help={text(
                  "Organizes your product for search and filters in this preview.",
                  "Подрежда продукта за търсене и филтри в този преглед.",
                )}
              >
                <select
                  value={product.category}
                  onChange={(e) => patch({ category: e.target.value })}
                >
                  <option value="">{ui("chooseAProductCategory")}</option>
                  {[
                    "Clothing",
                    "Home & living",
                    "Electronics",
                    "Sport & outdoors",
                    "Books",
                    "Beauty",
                    "Other",
                  ].map((v) => (
                    <option key={v} value={v}>
                      {caption(v)}
                    </option>
                  ))}
                </select>
              </Field>
            </Panel>
            <ProductPrice
              product={product}
              patch={patch}
              price={price}
              setPrice={setPrice}
            />
            <Panel title={ui("condition")} part="product-condition">
              <Field label={ui("condition")}>
                <select
                  value={product.condition}
                  onChange={(event) => patch({ condition: event.target.value })}
                >
                  <option value="">{ui("chooseProductCondition")}</option>
                  {["New", "Used - like new", "Used - good", "Refurbished"].map(
                    (value) => (
                      <option key={value} value={value}>
                        {caption(value)}
                      </option>
                    ),
                  )}
                </select>
              </Field>
            </Panel>
            <ProductInventory product={product} patch={patch} />
            <ProductShipping product={product} patch={patch} />
            <EditorSection title={ui("variants")} part="product-variants">
              <ProductOptions product={product} patch={patch} />
            </EditorSection>
            <EditorSection
              title={text("Product metafields", "Метаполета на продукта")}
              part="product-metafields"
            >
              <details data-studio-part="product-metafield">
                <summary>{text("Disclosures", "Уточнения")}</summary>
                <Field
                  label={text("Product disclosures", "Уточнения за продукта")}
                  help={text(
                    "Saved only in this device's preview.",
                    "Запазва се само в прегледа на това устройство.",
                  )}
                >
                  <textarea
                    maxLength={5000}
                    value={product.disclosures ?? ""}
                    onChange={(event) =>
                      patch({ disclosures: event.target.value })
                    }
                  />
                </Field>
              </details>
            </EditorSection>
            <EditorSection
              title={ui("searchEngineListing")}
              part="product-seo"
              action={
                <Button
                  plain
                  aria-expanded={seoEditor}
                  onClick={() => setSeoEditor(!seoEditor)}
                >
                  {text("Edit", "Редактиране")}
                </Button>
              }
            >
              {seoEditor ? (
                <>
                  <Field label={text("Page title", "Заглавие на страницата")}>
                    <input
                      maxLength={160}
                      value={product.seoTitle ?? product.title}
                      onChange={(event) =>
                        patch({ seoTitle: event.target.value })
                      }
                    />
                  </Field>
                  <Field label={text("Meta description", "Мета описание")}>
                    <textarea
                      maxLength={5000}
                      value={product.seoDescription ?? product.description}
                      onChange={(event) =>
                        patch({ seoDescription: event.target.value })
                      }
                    />
                  </Field>
                </>
              ) : product.title ? (
                <>
                  <h3>{product.seoTitle || product.title}</h3>
                  <p className={s.help}>treido.eu · {store.settings.handle}</p>
                  <p>
                    {(product.seoDescription ?? product.description).slice(
                      0,
                      160,
                    )}
                  </p>
                </>
              ) : (
                <p className={s.muted}>
                  {ui("addADescriptionToSeeAPreviewOfYourListing")}
                </p>
              )}
            </EditorSection>
          </div>
          <aside className={s.editorSide} data-studio-part="editor-side">
            <Panel title={ui("status")}>
              <Field label={ui("productStatus")}>
                <select
                  value={product.status}
                  onChange={(e) =>
                    patch({ status: e.target.value as Product["status"] })
                  }
                >
                  {["Active", "Draft", "Archived"].map((v) => (
                    <option key={v} value={v}>
                      {caption(v)}
                    </option>
                  ))}
                </select>
              </Field>
              <p className={s.help} data-studio-part="field-help">
                {ui("previewStatusOnlyProductsAreNotPublished")}
              </p>
            </Panel>
            <Panel title={ui("publishing")}>
              <p>{ui("treidoMarketplace")}</p>
              <Badge>{product.status}</Badge>
              <p className={s.help} data-studio-part="field-help">
                {ui("visibilityInYourStorefrontPreviewFollowsThisStatus")}
              </p>
            </Panel>
            <Panel
              title={ui("productOrganization")}
              part="product-organization"
            >
              <Field label={text("Type", "Тип")}>
                <input
                  value={product.type ?? ""}
                  maxLength={100}
                  onChange={(event) => patch({ type: event.target.value })}
                />
              </Field>
              <Field label={ui("vendor")}>
                <input
                  value={product.vendor}
                  maxLength={100}
                  onChange={(e) => patch({ vendor: e.target.value })}
                />
              </Field>
              <Field label={ui("collection")}>
                <select
                  value={product.collection}
                  onChange={(e) => patch({ collection: e.target.value })}
                >
                  <option value="">{ui("none")}</option>
                  {store.collections.map((c) => (
                    <option key={c.id} value={c.title}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={ui("tags")}>
                <input
                  value={product.tags}
                  maxLength={300}
                  placeholder={ui("separateTagsWithCommas")}
                  onChange={(e) => patch({ tags: e.target.value })}
                />
              </Field>
            </Panel>
            <Panel
              title={text("Theme template", "Шаблон на магазина")}
              part="product-template"
            >
              <p>{text("Default product", "Стандартен продукт")}</p>
              <p className={s.help}>
                {text(
                  "The Treido storefront preview uses one fixed layout.",
                  "Прегледът на магазина в Treido използва един фиксиран изглед.",
                )}
              </p>
            </Panel>
          </aside>
        </div>
        <div className={s.saveBar} data-studio-part="save-bar">
          {existing && (
            <Button danger onClick={() => setRemove(true)}>
              {ui("deleteProduct")}
            </Button>
          )}
          <Action href={href("products")}>{ui("cancel")}</Action>
          <Button primary type="submit">
            {ui("save")}
          </Button>
        </div>
      </form>
      {mediaPicker && (
        <MediaLibrary
          onClose={() => setMediaPicker(false)}
          onSelect={(image) => patch({ image })}
        />
      )}
      {remove && (
        <Confirm
          title={ui("deletePreviewProduct")}
          body={ui("thisRemovesTheProductFromTheLocalPreview")}
          action={ui("delete")}
          onClose={() => setRemove(false)}
          onConfirm={() => {
            update({ products: store.products.filter((p) => p.id !== id) });
            notify(ui("previewProductDeleted"));
            router.push(href("products"));
          }}
        />
      )}
    </main>
  );
}
export function Inventory() {
  const ui = useTranslations("merchantUI");
  const { store, update, notify, href } = usePreview();
  const list = useList();
  const [values, setValues] = useState<Record<string, string>>({});
  const rows = listRows(
    store.products,
    list.query,
    list.sort,
    (p) => `${p.title} ${p.sku}`,
  );
  const save = () => {
    if (Object.values(values).some((v) => !/^\d{1,6}$/.test(v))) {
      notify(ui("enterWholeQuantitiesBetween0And999999"));
      return;
    }
    update({
      products: store.products.map((p) =>
        values[p.id] !== undefined
          ? { ...p, quantity: Number(values[p.id]) }
          : p,
      ),
    });
    setValues({});
    notify(ui("previewInventoryUpdated"));
  };
  return (
    <main className={s.page} data-studio-part="page">
      <Header
        title={ui("inventory")}
        icon="product"
        actions={
          <Button primary disabled={!Object.keys(values).length} onClick={save}>
            {ui("saveQuantities")}
          </Button>
        }
      />
      <div className={s.tablePanel} data-studio-part="table-panel">
        <Toolbar {...list} />
        <div className={s.tableScroll} data-studio-part="table-scroll">
          <table className={s.table} data-studio-part="table">
            <thead>
              <tr>
                <th>{ui("product")}</th>
                <th>SKU</th>
                <th>{ui("location")}</th>
                <th>{ui("available")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link
                      className={s.cellLink}
                      data-studio-part="cell-link"
                      href={href(`products/${p.id}`)}
                    >
                      {p.title}
                    </Link>
                  </td>
                  <td>{p.sku || "—"}</td>
                  <td>{store.settings.city || ui("primaryLocation")}</td>
                  <td>
                    <label className={s.field} data-studio-part="field">
                      <input
                        aria-label={ui("quantityForValue1", {
                          value1: p.title ?? "",
                        })}
                        type="number"
                        min={0}
                        max={999999}
                        value={values[p.id] ?? p.quantity}
                        onChange={(e) =>
                          setValues({ ...values, [p.id]: e.target.value })
                        }
                      />
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TableFooter count={rows.length} />
      </div>
      {!store.products.length && (
        <Empty
          title={ui("manageYourStockInOnePlace")}
          body={ui("addProductsToTrackAndAdjustAvailableQuantities")}
        >
          <Action href={href("products/new")}>{ui("addProduct")}</Action>
        </Empty>
      )}
    </main>
  );
}
export function Imports() {
  const intlLocale = useIntlLocale();
  const ui = useTranslations("merchantUI");
  const { store, update, notify, href } = usePreview();
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<ReturnType<
    typeof parseProductCsv
  > | null>(null);
  const [error, setError] = useState("");
  const apply = () => {
    if (!result || result.errors.length) return;
    let products = [...store.products];
    for (const p of result.products) {
      const old = products.find((v) => p.sku && v.sku === p.sku);
      products = put(products, {
        ...p,
        id: old?.id ?? `product-${crypto.randomUUID()}`,
      });
    }
    if (products.length > 500) {
      setError(ui("thisPreviewSupportsUpTo500Products"));
      return;
    }
    update({ products });
    notify(
      ui("value1ProductsImportedIntoTheLocalPreview", {
        value1: result.products.length ?? "",
      }),
    );
    setResult(null);
    setCsv("");
  };
  return (
    <main className={s.editor} data-studio-part="editor">
      <Header title={ui("importProducts")} back={href("products")} />
      <div className={s.stack} data-studio-part="stack">
        <Panel title={ui("addProductsWithACSV")}>
          <p>
            {ui("reviewTheRowsBeforeImportingMatchingSKUsUpdateTheExisting")}
          </p>
          <div className={s.upload} data-studio-part="upload">
            <input
              type="file"
              accept=".csv,text/csv"
              aria-label={ui("chooseCSVFile")}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 250000) {
                  setError(ui("chooseACSVSmallerThan250KB"));
                  return;
                }
                setCsv(await f.text());
                setResult(null);
              }}
              data-ui-label="chooseCSVFile"
            />
            <Button
              onClick={() =>
                downloadCsv("treido-product-template.csv", [
                  ["Title", "Price", "SKU", "Quantity", "Status", "Category"],
                  [
                    "Example product",
                    "29.90",
                    "DEMO-001",
                    10,
                    "Draft",
                    "Home & living",
                  ],
                ])
              }
            >
              {ui("downloadTemplate")}
            </Button>
          </div>
          <Field label={ui("orPasteCSV")}>
            <textarea
              value={csv}
              onChange={(e) => {
                setCsv(e.target.value);
                setResult(null);
              }}
              placeholder={
                "Title,Price,SKU,Quantity,Status\nExample product,29.90,DEMO-001,10,Draft"
              }
            />
          </Field>
          <Button
            primary
            disabled={!csv.trim()}
            onClick={() => {
              setResult(parseProductCsv(csv));
              setError("");
            }}
          >
            {ui("reviewImport")}
          </Button>
        </Panel>
        {error && (
          <p className={s.error} data-studio-part="error" role="alert">
            {error}
          </p>
        )}
        {result && (
          <Panel title={ui("importReview")}>
            {result.errors.length > 0 ? (
              <div className={s.error} data-studio-part="error" role="alert">
                {result.errors.map((e) => (
                  <p key={e}>{e}</p>
                ))}
              </div>
            ) : (
              <p>
                {result.products.length} {ui("validProductsReadyToImport")}
              </p>
            )}
            <div className={s.tableScroll} data-studio-part="table-scroll">
              <table className={s.table} data-studio-part="table">
                <thead>
                  <tr>
                    <th>{ui("title")}</th>
                    <th>SKU</th>
                    <th>{ui("price")}</th>
                    <th>{ui("quantity")}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.products.map((p) => (
                    <tr key={p.id}>
                      <td>{p.title}</td>
                      <td>{p.sku}</td>
                      <td>{money(p.price, intlLocale)}</td>
                      <td>{p.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              primary
              disabled={!!result.errors.length || !result.products.length}
              onClick={apply}
            >
              {ui("importToPreview")}
            </Button>
          </Panel>
        )}
      </div>
    </main>
  );
}
