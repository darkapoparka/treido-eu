"use client";
import { useCaption } from "../../locale/use-caption";
import { useTranslations } from "next-intl";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePreview } from "./context";
import { AdminIcon } from "../admin-icons";
import { put, type Entry, type Market } from "./model";
import {
  Action,
  Badge,
  Button,
  Check,
  Confirm,
  Empty,
  Field,
  Header,
  Panel,
  TableFooter,
  Toolbar,
  listRows,
  useList,
  s,
} from "./ui";
export function Content({
  section,
  detail,
}: {
  section: "content" | "collections" | "pages" | "files";
  detail?: string;
}) {
  const ui = useTranslations("merchantUI");
  const { store, href, update, notify } = usePreview();
  const list = useList();
  const [remove, setRemove] = useState(false);
  const [error, setError] = useState("");
  const isCollection = section === "collections";
  const type =
    section === "content"
      ? "Definition"
      : section === "files"
        ? "File"
        : section === "pages"
          ? "Page"
          : "Manual";
  const items = isCollection
    ? store.collections
    : store.entries.filter((e) => e.type === type);
  const rows = listRows(
    items.filter((e) => list.tab === "All" || e.status === list.tab),
    list.query,
    list.sort,
    (e) => `${e.title} ${e.tags}`,
  );
  const saveItems = (values: Entry[]) =>
    update(
      isCollection
        ? { collections: values }
        : {
            entries: [
              ...store.entries.filter((e) => e.type !== type),
              ...values,
            ],
          },
    );
  if (detail)
    return <ContentEditor key={detail} section={section} id={detail} />;
  const upload = async (file?: File) => {
    if (!file) return;
    if (
      file.size > 120000 ||
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
        "text/plain",
      ].includes(file.type)
    ) {
      setError(ui("chooseAPNGJPEGWebPPDFOrTextFileBelow"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const entry: Entry = {
        id: `file-${crypto.randomUUID()}`,
        title: file.name,
        body: String(reader.result),
        type: "File",
        status: "Ready",
        tags: file.type,
      };
      saveItems([...items, entry]);
      notify(ui("fileAddedToThisDeviceSPreview"));
      setError("");
    };
    reader.readAsDataURL(file);
  };
  return (
    <main className={s.page}>
      <Header
        title={
          isCollection
            ? ui("collections")
            : section === "content"
              ? ui("metaobjects")
              : section === "files"
                ? ui("files")
                : ui("pages")
        }
        icon="content"
        actions={
          section === "files" ? (
            <label className={`${s.button} ${s.primary}`}>
              {ui("uploadFile")}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf,text/plain"
                aria-label={ui("uploadContentFile")}
                onChange={(e) => upload(e.target.files?.[0])}
                data-ui-label="uploadContentFile"
              />
            </label>
          ) : (
            <Action primary href={href(`${section}/new`)}>
              {isCollection
                ? ui("createCollection")
                : section === "content"
                  ? ui("addDefinition")
                  : ui("addPage")}
            </Action>
          )
        }
      />
      {error && (
        <div className={s.error} role="alert">
          {error}
        </div>
      )}
      {!items.length && section === "content" ? (
        <>
          <div className={s.definitionToolbar}>
            <AdminIcon name="search" />
            <input
              type="search"
              aria-label={ui("searchDefinitions")}
              placeholder={ui("searchingInDefinitions")}
              maxLength={160}
              value={list.query}
              onChange={(event) => list.onQuery(event.target.value)}
              data-ui-label="searchDefinitions"
            />
          </div>
          <section className={s.definitionEmpty}>
            <h2>{ui("noDefinitionsFound")}</h2>
            <p className={s.muted}>{ui("tryChangingTheFiltersOrSearchTerm")}</p>
            <p className={s.learn}>
              <Link href={href("settings/custom-data")}>
                {ui("learnMoreAboutContentDefinitions")}
              </Link>
            </p>
          </section>
        </>
      ) : !items.length ? (
        <Empty
          kind="content"
          title={
            isCollection
              ? ui("groupYourProductsIntoCollections")
              : section === "files"
                ? ui("keepYourStoreFilesInOnePlace")
                : section === "pages"
                  ? ui("tellCustomersMoreAboutYourBusiness")
                  : ui("noDefinitionsFound")
          }
          body={
            isCollection
              ? ui("createACollectionToOrganizeProductsInYourStore")
              : section === "files"
                ? ui("addImagesOrDocumentsToReviewContentManagement")
                : section === "pages"
                  ? ui("addDeliveryInformationAnAboutPageOrAnswersToCommon")
                  : ui(
                      "createReusableContentDefinitionsForYourProductAndStoreInformation",
                    )
          }
        >
          {section !== "files" && (
            <Action href={href(`${section}/new`)}>{ui("getStarted")}</Action>
          )}
        </Empty>
      ) : (
        <div className={s.tablePanel}>
          <Toolbar
            {...list}
            tabs={[
              "All",
              ...(section === "pages"
                ? ["Visible", "Hidden"]
                : isCollection
                  ? ["Active", "Draft"]
                  : []),
            ]}
          />
          {list.selected.length > 0 && (
            <div className={s.bulk}>
              <strong>
                {list.selected.length} {ui("selected_d7cbbb")}
              </strong>
              <Button danger onClick={() => setRemove(true)}>
                {ui("deleteFromPreview")}
              </Button>
            </div>
          )}
          <div className={s.tableScroll}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label={ui("selectAllContent")}
                      checked={
                        !!rows.length &&
                        rows.every((e) => list.selected.includes(e.id))
                      }
                      onChange={(e) =>
                        list.select(
                          e.target.checked ? rows.map((v) => v.id) : [],
                        )
                      }
                      data-ui-label="selectAllContent"
                    />
                  </th>
                  <th>{isCollection ? ui("collection") : ui("title")}</th>
                  <th>{ui("status")}</th>
                  <th>{isCollection ? ui("products") : ui("type")}</th>
                  <th>{ui("tags")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={ui("selectValue1", {
                          value1: entry.title ?? "",
                        })}
                        checked={list.selected.includes(entry.id)}
                        onChange={() => list.toggle(entry.id)}
                      />
                    </td>
                    <td>
                      <Link
                        className={s.cellLink}
                        href={href(`${section}/${entry.id}`)}
                      >
                        {entry.title}
                      </Link>
                    </td>
                    <td>
                      <Badge>{entry.status}</Badge>
                    </td>
                    <td>
                      {isCollection
                        ? store.products.filter(
                            (p) => p.collection === entry.title,
                          ).length
                        : entry.type}
                    </td>
                    <td>{entry.tags || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TableFooter count={rows.length} />
        </div>
      )}
      {remove && (
        <Confirm
          title={ui("deletePreviewContent")}
          body={ui("thisRemovesTheSelectedContentFromThisDeviceSPreview")}
          action={ui("delete")}
          onClose={() => setRemove(false)}
          onConfirm={() => {
            saveItems(items.filter((e) => !list.selected.includes(e.id)));
            list.select([]);
            notify(ui("previewContentDeleted"));
          }}
        />
      )}
    </main>
  );
}
function ContentEditor({
  section,
  id,
}: {
  section: "content" | "collections" | "pages" | "files";
  id: string;
}) {
  const caption = useCaption();
  const ui = useTranslations("merchantUI");
  const { store, href, update, notify } = usePreview();
  const router = useRouter();
  const collection = section === "collections";
  const source = collection ? store.collections : store.entries;
  const existing = source.find((e) => e.id === id);
  const [entry, setEntry] = useState<Entry>(
    () =>
      existing ?? {
        id: "new",
        title: "",
        body: "",
        status: section === "pages" ? "Visible" : "Active",
        type: collection
          ? "Manual"
          : section === "content"
            ? "Definition"
            : "Page",
        tags: "",
      },
  );
  const [products, setProducts] = useState(
    store.products
      .filter((p) => p.collection === existing?.title)
      .map((p) => p.id),
  );
  const patch = (change: Partial<Entry>) => setEntry({ ...entry, ...change });
  if (id !== "new" && !existing)
    return (
      <main className={s.editor}>
        <Header title={ui("contentNotFound")} back={href(section)} />
      </main>
    );
  return (
    <main className={s.editor}>
      <Header
        title={
          existing
            ? entry.title
            : collection
              ? ui("createCollection")
              : section === "content"
                ? ui("addDefinition")
                : ui("addPage")
        }
        back={href(section)}
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const saved = {
            ...entry,
            id: existing ? id : `content-${crypto.randomUUID()}`,
          };
          if (collection)
            update({
              collections: put(store.collections, saved),
              products: store.products.map((p) =>
                products.includes(p.id)
                  ? { ...p, collection: saved.title }
                  : p.collection === existing?.title
                    ? { ...p, collection: "" }
                    : p,
              ),
            });
          else update({ entries: put(store.entries, saved) });
          notify(ui("contentSavedInTheFrontendPreview"));
          router.push(href(`${section}/${saved.id}`));
        }}
      >
        <div className={s.editorColumns}>
          <div className={s.stack}>
            <Panel>
              <Field
                label={
                  section === "content" ? ui("definitionName") : ui("title")
                }
              >
                <input
                  required
                  value={entry.title}
                  maxLength={160}
                  onChange={(e) => patch({ title: e.target.value })}
                />
              </Field>
              {section === "files" ? (
                <>
                  <p className={s.help}>{entry.tags}</p>
                  {entry.body.startsWith("data:image/") && (
                    <Image
                      unoptimized
                      width={960}
                      height={472}
                      src={entry.body}
                      alt={entry.title}
                      className={s.mediaImage}
                    />
                  )}
                  <Button
                    onClick={() => {
                      const [prefix, data] = entry.body.split(",");
                      if (!data) return;
                      const bytes = Uint8Array.from(atob(data), (c) =>
                        c.charCodeAt(0),
                      );
                      const url = URL.createObjectURL(
                        new Blob([bytes], {
                          type: prefix.slice(5).split(";")[0],
                        }),
                      );
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = entry.title;
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }}
                  >
                    {ui("downloadFile")}
                  </Button>
                </>
              ) : (
                <Field
                  label={section === "content" ? ui("fields") : ui("content")}
                  help={
                    section === "content"
                      ? ui("addAFieldNameAndTypeOnEachLineFor")
                      : undefined
                  }
                >
                  <textarea
                    required={section === "content"}
                    maxLength={10000}
                    value={entry.body}
                    placeholder={
                      section === "content"
                        ? ui("materialTextCareInstructionsMultilineText")
                        : ""
                    }
                    onChange={(e) => patch({ body: e.target.value })}
                  />
                </Field>
              )}
            </Panel>
            {collection && (
              <Panel title={ui("products")}>
                {store.products.length ? (
                  store.products.map((p) => (
                    <Check
                      key={p.id}
                      label={p.title}
                      checked={products.includes(p.id)}
                      onChange={() =>
                        setProducts(
                          products.includes(p.id)
                            ? products.filter((v) => v !== p.id)
                            : [...products, p.id],
                        )
                      }
                    />
                  ))
                ) : (
                  <p className={s.muted}>
                    {ui("addProductsBeforeChoosingItemsForThisCollection")}
                  </p>
                )}
                <Action href={href("products/new")}>{ui("addProduct")}</Action>
              </Panel>
            )}
            {section === "pages" && (
              <Panel title={ui("searchEngineListing")}>
                <h3>{entry.title || ui("pageTitle")}</h3>
                <p className={s.help}>treido.eu · {store.settings.handle}</p>
                <p>{entry.body.slice(0, 160)}</p>
              </Panel>
            )}
          </div>
          <aside className={s.editorSide}>
            <Panel title={ui("visibility")}>
              <Field label={ui("status")}>
                <select
                  value={entry.status}
                  onChange={(e) => patch({ status: e.target.value })}
                >
                  {(section === "pages"
                    ? ["Visible", "Hidden"]
                    : section === "files"
                      ? ["Ready"]
                      : ["Active", "Draft"]
                  ).map((v) => (
                    <option key={v} value={v}>
                      {caption(v)}
                    </option>
                  ))}
                </select>
              </Field>
            </Panel>
            <Panel title={ui("organization")}>
              <Field label={ui("tags")}>
                <input
                  value={entry.tags}
                  maxLength={300}
                  onChange={(e) => patch({ tags: e.target.value })}
                />
              </Field>
              <p className={s.help}>{ui("changesStayInTheLocalPreview")}</p>
            </Panel>
          </aside>
        </div>
        <div className={s.saveBar}>
          <Action href={href(section)}>{ui("cancel")}</Action>
          <Button primary type="submit">
            {ui("save")}
          </Button>
        </div>
      </form>
    </main>
  );
}
export function Markets({ detail }: { detail?: string }) {
  const ui = useTranslations("merchantUI");
  const { store, href } = usePreview();
  const list = useList();
  const [treeOpen, setTreeOpen] = useState(false);
  if (detail) return <MarketEditor key={detail} id={detail} />;
  const rows = listRows(
    store.markets,
    list.query,
    list.sort,
    (m) => `${m.title} ${m.countries}`,
  );
  return (
    <main className={s.page}>
      <Header
        title={ui("markets")}
        icon="markets"
        actions={
          <Action primary href={href("markets/new")}>
            {ui("createMarket")}
          </Action>
        }
      />
      <div className={treeOpen ? s.split : undefined}>
        {treeOpen && (
          <aside className={s.tree}>
            <h2>{ui("storeDefault")}</h2>
            <Link href={href("settings/general")}>
              {store.settings.country} · {store.settings.currency}
            </Link>
            <h2>{ui("regions")}</h2>
            {store.markets.map((m) => (
              <Link key={m.id} href={href(`markets/${m.id}`)}>
                ◉ {m.title}
              </Link>
            ))}
          </aside>
        )}
        <div className={s.tablePanel}>
          <div className={s.marketToolbar}>
            <Button
              aria-label={
                treeOpen ? ui("hideMarketRegions") : ui("showMarketRegions")
              }
              aria-expanded={treeOpen}
              onClick={() => setTreeOpen(!treeOpen)}
            >
              <AdminIcon name="menu" />
            </Button>
            <input
              type="search"
              aria-label={ui("searchInAllMarkets")}
              placeholder={ui("searchInAllMarkets")}
              value={list.query}
              onChange={(event) => list.onQuery(event.target.value)}
              maxLength={160}
              data-ui-label="searchInAllMarkets"
            />
            <select
              aria-label={ui("sortMarkets")}
              value={list.sort}
              onChange={(event) => list.onSort(event.target.value)}
              data-ui-label="sortMarkets"
            >
              <option value="newest">{ui("newestFirst")}</option>
              <option value="az">{ui("titleAZ")}</option>
              <option value="za">{ui("titleZA")}</option>
            </select>
          </div>
          <table className={s.table}>
            <thead>
              <tr>
                <th>{ui("market")}</th>
                <th>{ui("status")}</th>
                <th>{ui("includes")}</th>
                <th>{ui("customizations")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td>
                    <Link className={s.cellLink} href={href(`markets/${m.id}`)}>
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
          <TableFooter count={rows.length} />
        </div>
      </div>
      <p className={s.learn}>
        <Link href={href("settings/markets")}>
          {ui("learnMoreAboutMarkets")}
        </Link>
      </p>
    </main>
  );
}
function MarketEditor({ id }: { id: string }) {
  const ui = useTranslations("merchantUI");
  const { store, href, update, notify } = usePreview();
  const router = useRouter();
  const existing = store.markets.find((m) => m.id === id);
  const [market, setMarket] = useState<Market>(
    () =>
      existing ?? {
        id: "new",
        title: "",
        countries: "",
        currency: "EUR",
        status: "Draft",
      },
  );
  const patch = (change: Partial<Market>) =>
    setMarket({ ...market, ...change });
  if (id !== "new" && !existing)
    return (
      <main className={s.editor}>
        <Header title={ui("marketNotFound")} back={href("markets")} />
      </main>
    );
  return (
    <main className={s.editor}>
      <Header
        title={existing ? market.title : ui("createMarket")}
        back={href("markets")}
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const saved = {
            ...market,
            id: existing ? id : `market-${crypto.randomUUID()}`,
          };
          update({ markets: put(store.markets, saved) });
          notify(ui("marketConfigurationSavedInPreview"));
          router.push(href(`markets/${saved.id}`));
        }}
      >
        <div className={s.editorColumns}>
          <div className={s.stack}>
            <Panel title={ui("marketDetails")}>
              <Field label={ui("marketName")}>
                <input
                  required
                  maxLength={100}
                  value={market.title}
                  onChange={(e) => patch({ title: e.target.value })}
                />
              </Field>
              <Field label={ui("countriesAndRegions")}>
                <textarea
                  required
                  maxLength={500}
                  placeholder={ui("bulgariaGreeceRomania")}
                  value={market.countries}
                  onChange={(e) => patch({ countries: e.target.value })}
                />
              </Field>
            </Panel>
            <Panel title={ui("currency")}>
              <Field label={ui("displayCurrency")}>
                <select
                  value={market.currency}
                  onChange={(e) => patch({ currency: e.target.value })}
                >
                  <option>EUR</option>
                  <option>USD</option>
                  <option>GBP</option>
                </select>
              </Field>
              <p className={s.help}>
                {ui(
                  "productsKeepTheirEURPricesInThisPreviewCurrencyConversion",
                )}
              </p>
            </Panel>
            <Panel title={ui("shipping")}>
              <p>{ui("useTheStoreShippingProfileForThisRegion")}</p>
              <Action href={href("settings/shipping")}>
                {ui("manageShippingAndDelivery")}
              </Action>
            </Panel>
          </div>
          <aside className={s.editorSide}>
            <Panel title={ui("status")}>
              <Field label={ui("marketStatus")}>
                <select
                  value={market.status}
                  onChange={(e) => patch({ status: e.target.value })}
                >
                  <option value="Active">{ui("active")}</option>
                  <option value="Draft">{ui("draft")}</option>
                </select>
              </Field>
            </Panel>
          </aside>
        </div>
        <div className={s.saveBar}>
          <Action href={href("markets")}>{ui("cancel")}</Action>
          <Button primary type="submit">
            {ui("save")}
          </Button>
        </div>
      </form>
    </main>
  );
}
