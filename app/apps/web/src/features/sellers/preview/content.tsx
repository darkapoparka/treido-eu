"use client";
import { useCaption } from "../../locale/use-caption";
import { useTranslations } from "next-intl";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePreview } from "./context";
import { AdminIcon } from "../admin-icons";
import { put, normalizePreviewFileUrl, type Entry } from "./model";
import { CollectionBuilder } from "./collection-builder";
import { LocalPageBuilder } from "./local-page-builder";
import { MetaobjectDraftEditor } from "./metaobject-draft-editor";
import styles from "./content-parity.module.css";
import { FileEmptyArtwork } from "./file-empty-artwork";
import {
  Action,
  Badge,
  Button,
  Check,
  Confirm,
  Empty,
  Field,
  Header,
  Modal,
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
  const { store, href, update, notify, text } = usePreview();
  const list = useList();
  const [remove, setRemove] = useState(false);
  const [error, setError] = useState("");
  const [urlDialog, setUrlDialog] = useState(false);
  const [fileUrl, setFileUrl] = useState("");
  const [urlError, setUrlError] = useState("");
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
    : store.entries.filter((e) => e.type === type || e.type === `${type}Draft`);
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
              ...store.entries.filter(
                (e) => e.type !== type && e.type !== `${type}Draft`,
              ),
              ...values,
            ],
          },
    );
  if (detail)
    return section === "collections" ? (
      <CollectionBuilder key={detail} id={detail} />
    ) : section === "pages" ? (
      <LocalPageBuilder key={detail} id={detail} />
    ) : section === "content" ? (
      <MetaobjectDraftEditor key={detail} id={detail} />
    ) : (
      <ContentEditor key={detail} section={section} id={detail} />
    );
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
    <main className={s.page} data-studio-part="page">
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
            <>
              <Button onClick={() => setUrlDialog(true)}>
                <span className={styles.srOnly}>
                  {text("Add from URL", "Добавяне от URL")}
                </span>
                <AdminIcon name="more" />
              </Button>
              <label
                className={`${s.button} ${s.primary}`}
                data-studio-part="button"
              >
                {text("Upload files", "Качване на файлове")}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf,text/plain"
                  aria-label={ui("uploadContentFile")}
                  onChange={(e) => upload(e.target.files?.[0])}
                  data-ui-label="uploadContentFile"
                />
              </label>
            </>
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
        <div className={s.error} data-studio-part="error" role="alert">
          {error}
        </div>
      )}
      {!items.length && section === "content" ? (
        <>
          <div
            className={s.definitionToolbar}
            data-studio-part="definition-toolbar"
          >
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
          <section
            className={s.definitionEmpty}
            data-studio-part="definition-empty"
          >
            <h2>{ui("noDefinitionsFound")}</h2>
            <p className={s.muted} data-studio-part="muted">
              {ui("tryChangingTheFiltersOrSearchTerm")}
            </p>
            <p className={s.learn} data-studio-part="learn">
              <Link href={href("settings/custom-data")}>
                {ui("learnMoreAboutContentDefinitions")}
              </Link>
            </p>
          </section>
        </>
      ) : !items.length ? (
        <div
          className={section === "files" ? styles.filesEmpty : undefined}
          data-studio-part={section === "files" ? "files-empty" : undefined}
        >
          <Empty
            art={section === "files" ? <FileEmptyArtwork /> : undefined}
            kind="content"
            title={
              isCollection
                ? ui("groupYourProductsIntoCollections")
                : section === "files"
                  ? text(
                      "Upload and manage your files",
                      "Качване и управление на файлове",
                    )
                  : section === "pages"
                    ? ui("tellCustomersMoreAboutYourBusiness")
                    : ui("noDefinitionsFound")
            }
            body={
              isCollection
                ? ui("createACollectionToOrganizeProductsInYourStore")
                : section === "files"
                  ? text(
                      "Images and documents stored on this device.",
                      "Изображения и документи, запазени на това устройство.",
                    )
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
            {section === "files" && (
              <label className={s.button} data-studio-part="button">
                {text("Upload files", "Качване на файлове")}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf,text/plain"
                  aria-label={text(
                    "Upload files to the local preview",
                    "Качване на файлове в локалния преглед",
                  )}
                  onChange={(event) => upload(event.target.files?.[0])}
                />
              </label>
            )}
          </Empty>
        </div>
      ) : (
        <div className={s.tablePanel} data-studio-part="table-panel">
          <Toolbar
            {...list}
            tabs={[
              "All",
              ...(section === "pages"
                ? ["Visible", "Hidden", "Draft"]
                : isCollection
                  ? ["Active", "Draft"]
                  : []),
            ]}
          />
          {list.selected.length > 0 && (
            <div className={s.bulk} data-studio-part="bulk">
              <strong>
                {list.selected.length} {ui("selected_d7cbbb")}
              </strong>
              <Button danger onClick={() => setRemove(true)}>
                {ui("deleteFromPreview")}
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
                  {isCollection && (
                    <th>
                      <span className={styles.srOnly}>
                        {text("Image", "Снимка")}
                      </span>
                    </th>
                  )}
                  <th>{isCollection ? ui("collection") : ui("title")}</th>
                  <th>{isCollection ? ui("products") : ui("status")}</th>
                  <th>
                    {isCollection
                      ? text("Product conditions", "Условия за продукти")
                      : ui("type")}
                  </th>
                  <th>
                    {isCollection ? text("Visibility", "Видимост") : ui("tags")}
                  </th>
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
                    {isCollection && (
                      <td>
                        {entry.image ? (
                          <Image
                            unoptimized
                            src={entry.image}
                            width={36}
                            height={36}
                            className={s.thumb}
                            data-studio-part="thumb"
                            alt=""
                          />
                        ) : (
                          <span className={styles.collectionThumb}>
                            <AdminIcon name="content" />
                          </span>
                        )}
                      </td>
                    )}
                    <td>
                      <Link
                        className={s.cellLink}
                        data-studio-part="cell-link"
                        href={href(`${section}/${entry.id}`)}
                      >
                        {entry.title}
                      </Link>
                    </td>
                    <td>
                      {isCollection ? (
                        store.products.filter(
                          (p) => p.collection === entry.title,
                        ).length
                      ) : (
                        <Badge>{entry.status}</Badge>
                      )}
                    </td>
                    <td>
                      {isCollection
                        ? text("Manual selection", "Ръчен избор")
                        : entry.type}
                    </td>
                    <td>
                      {isCollection ? (
                        <Badge>{entry.status}</Badge>
                      ) : (
                        entry.tags || "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TableFooter count={rows.length} />
        </div>
      )}
      {section === "files" && (
        <p className={s.learn} style={{ marginTop: 16 }}>
          {text(
            "Files are saved on this device only.",
            "Файловете се запазват само на това устройство.",
          )}
        </p>
      )}
      {urlDialog && (
        <Modal
          title={text("Add from URL", "Добавяне от URL")}
          surface="files-import-url"
          onClose={() => setUrlDialog(false)}
          footer={
            <>
              <Button onClick={() => setUrlDialog(false)}>
                {text("Cancel", "Отказ")}
              </Button>
              <Button
                primary
                disabled={!fileUrl.trim()}
                onClick={() => {
                  const url = normalizePreviewFileUrl(fileUrl.trim());
                  if (!url) {
                    setUrlError(
                      text(
                        "Enter a valid HTTP or HTTPS URL without credentials.",
                        "Въведете валиден HTTP или HTTPS URL без данни за вход.",
                      ),
                    );
                    return;
                  }
                  const address = new URL(url);
                  const title =
                    address.pathname
                      .split("/")
                      .filter(Boolean)
                      .pop()
                      ?.slice(0, 160) || address.hostname;
                  saveItems([
                    ...items,
                    {
                      id: `file-${crypto.randomUUID()}`,
                      title,
                      body: "",
                      type: "File",
                      status: "Reference",
                      tags: "External URL",
                      url,
                    },
                  ]);
                  notify(
                    text(
                      "File URL saved locally. The file was not downloaded or uploaded.",
                      "URL адресът е запазен локално. Файлът не е изтеглен или качен.",
                    ),
                  );
                  setFileUrl("");
                  setUrlError("");
                  setUrlDialog(false);
                }}
              >
                {text("Save URL", "Запазване на URL")}
              </Button>
            </>
          }
        >
          <Field
            label={text("File URL", "URL адрес на файла")}
            help={text(
              "Saves a local URL reference.",
              "Запазва локален URL адрес.",
            )}
          >
            <input
              type="url"
              maxLength={2048}
              value={fileUrl}
              onChange={(event) => {
                setFileUrl(event.target.value);
                setUrlError("");
              }}
              placeholder="https://"
            />
          </Field>
          {urlError && (
            <p className={s.error} role="alert">
              {urlError}
            </p>
          )}
        </Modal>
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
  const { store, href, update, notify, text } = usePreview();
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
      <main className={s.editor} data-studio-part="editor">
        <Header title={ui("contentNotFound")} back={href(section)} />
      </main>
    );
  return (
    <main className={s.editor} data-studio-part="editor">
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
        <div className={s.editorColumns} data-studio-part="editor-layout">
          <div className={s.stack} data-studio-part="stack">
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
                  <p className={s.help} data-studio-part="field-help">
                    {entry.tags}
                  </p>
                  {entry.body.startsWith("data:image/") && (
                    <Image
                      unoptimized
                      width={960}
                      height={472}
                      src={entry.body}
                      alt={entry.title}
                      className={s.mediaImage}
                      data-studio-part="media-image"
                    />
                  )}
                  {entry.url ? (
                    <>
                      <p className={s.help}>
                        {text(
                          "External URL reference. This preview has not fetched or uploaded the file.",
                          "Външен URL адрес. Прегледът не е изтеглил или качил файла.",
                        )}
                      </p>
                      <a
                        className={s.button}
                        href={entry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {text("Open file URL", "Отваряне на URL адреса")}
                      </a>
                    </>
                  ) : (
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
                  )}
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
                  <p className={s.muted} data-studio-part="muted">
                    {ui("addProductsBeforeChoosingItemsForThisCollection")}
                  </p>
                )}
                <Action href={href("products/new")}>{ui("addProduct")}</Action>
              </Panel>
            )}
            {section === "pages" && (
              <Panel title={ui("searchEngineListing")}>
                <h3>{entry.title || ui("pageTitle")}</h3>
                <p className={s.help} data-studio-part="field-help">
                  treido.eu · {store.settings.handle}
                </p>
                <p>{entry.body.slice(0, 160)}</p>
              </Panel>
            )}
          </div>
          <aside className={s.editorSide} data-studio-part="editor-side">
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
              <p className={s.help} data-studio-part="field-help">
                {ui("changesStayInTheLocalPreview")}
              </p>
            </Panel>
          </aside>
        </div>
        <div className={s.saveBar} data-studio-part="save-bar">
          <Action href={href(section)}>{ui("cancel")}</Action>
          <Button primary type="submit">
            {ui("save")}
          </Button>
        </div>
      </form>
    </main>
  );
}
