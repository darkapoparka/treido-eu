"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AdminIcon } from "../admin-icons";
import { usePreview } from "./context";
import { put, type Entry } from "./model";
import { ProductRichEditor } from "./product-rich-editor";
import { MediaLibrary } from "./media-library";
import { DraftDateFields, currentDraftDateTime } from "./draft-date-fields";
import { validDraftDate, validDraftTime } from "./local-draft-model";
import {
  Action,
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
import styles from "./local-draft-editors.module.css";

export function LocalBlogBuilder({ id }: { id: string }) {
  const { store, href, text, update, notify } = usePreview();
  const router = useRouter();
  const existing = store.entries.find(
    (entry) => entry.id === id && entry.type === "BlogDraft",
  );
  const draft =
    existing?.editorDraft?.kind === "Blog" ? existing.editorDraft : undefined;
  const [entry, setEntry] = useState<Entry>(
    existing ?? {
      id: "new",
      title: "",
      body: "",
      type: "BlogDraft",
      status: "Draft",
      tags: "",
    },
  );
  const [excerpt, setExcerpt] = useState(draft?.excerpt ?? "");
  const [excerptHtml, setExcerptHtml] = useState(draft?.excerptHtml);
  const [author, setAuthor] = useState(draft?.author ?? "");
  const [blog, setBlog] = useState(draft?.blog ?? "News");
  const [date, setDate] = useState(draft?.date ?? "");
  const [time, setTime] = useState(draft?.time ?? "");
  const [planned, setPlanned] = useState({ date, time });
  const [seoTitle, setSeoTitle] = useState(draft?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(
    draft?.seoDescription ?? "",
  );
  const [handle, setHandle] = useState(draft?.handle ?? "");
  const [visibility, setVisibility] = useState<"Hidden" | "Visible">(
    draft?.visibility ?? "Hidden",
  );
  const [media, setMedia] = useState(false);
  const [excerptOpen, setExcerptOpen] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const seoInput = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (seoOpen) seoInput.current?.focus();
  }, [seoOpen]);
  const [dateOpen, setDateOpen] = useState(false);
  const [error, setError] = useState("");
  const patch = (values: Partial<Entry>) => setEntry({ ...entry, ...values });
  if (id !== "new" && !existing)
    return (
      <main className={s.editor}>
        <Header
          title={text("Post not found", "Публикацията не е намерена")}
          back={href("blog-posts")}
        />
      </main>
    );
  const save = () => {
    if (!entry.title.trim()) {
      setError(
        text(
          "Add a title before saving.",
          "Добавете заглавие преди запазване.",
        ),
      );
      return;
    }
    const saved: Entry = {
      ...entry,
      id: existing?.id ?? `blog-${crypto.randomUUID()}`,
      title: entry.title.trim(),
      status: "Draft",
      editorDraft: {
        kind: "Blog",
        excerpt,
        excerptHtml,
        author,
        blog,
        date,
        time,
        visibility,
        seoTitle,
        seoDescription,
        handle,
      },
    };
    update({ entries: put(store.entries, saved) });
    notify(
      text(
        "Blog draft saved locally. Nothing is published.",
        "Черновата на публикацията е запазена локално. Нищо не е публикувано.",
      ),
    );
    router.push(href(`blog-posts/${saved.id}`));
  };
  return (
    <main
      className={s.editor}
      data-studio-part="editor"
      data-studio-builder="blog"
    >
      <EditorBreadcrumb
        href={href("blog-posts")}
        title={text("Blog posts", "Публикации в блог")}
        icon="content"
      />
      <Header title={text("Add blog post", "Добавяне на публикация")} />
      <div className={s.editorColumns} data-studio-part="editor-layout">
        <div className={s.stack} data-studio-part="editor-main">
          <Panel part="blog-core">
            <Field label={text("Title", "Заглавие")}>
              <input
                maxLength={160}
                placeholder={text(
                  "e.g., Updates about your latest products",
                  "напр., Новини за вашите нови продукти",
                )}
                value={entry.title}
                onChange={(event) => patch({ title: event.target.value })}
              />
            </Field>
            <Field label={text("Content", "Съдържание")}>
              <ProductRichEditor
                label={text("Blog content", "Съдържание на блога")}
                value={entry.body}
                html={entry.descriptionHtml}
                onChange={(body, descriptionHtml) =>
                  patch({ body, descriptionHtml })
                }
              />
            </Field>
          </Panel>
          <EditorSection
            title={text("Excerpt", "Кратко описание")}
            part="blog-excerpt"
            action={
              !excerptOpen && (
                <Button
                  plain
                  aria-label={text(
                    "Add excerpt",
                    "Добавяне на кратко описание",
                  )}
                  onClick={() => setExcerptOpen(true)}
                  aria-expanded={excerptOpen}
                >
                  <AdminIcon name="edit" />
                </Button>
              )
            }
          >
            <p>
              {text(
                "Add a summary of the post to appear on your home page or blog.",
                "Добавете резюме на публикацията за началната страница или блога.",
              )}
            </p>
            {excerptOpen ? (
              <ProductRichEditor
                label={text("Blog excerpt", "Кратко описание на блога")}
                value={excerpt}
                html={excerptHtml}
                onChange={(body, html) => {
                  setExcerpt(body.slice(0, 2000));
                  setExcerptHtml(html.slice(0, 6000));
                }}
              />
            ) : (
              excerpt && <p>{excerpt}</p>
            )}
          </EditorSection>
          <EditorSection
            title={text("Search engine listing", "Вид в търсачките")}
            part="blog-seo"
            action={
              !seoOpen && (
                <Button
                  plain
                  aria-label={text(
                    "Edit search engine listing",
                    "Редактиране на вида в търсачките",
                  )}
                  onClick={() => setSeoOpen(true)}
                  aria-expanded={seoOpen}
                >
                  <AdminIcon name="edit" />
                </Button>
              )
            }
          >
            {entry.title ? (
              <>
                <strong>{seoTitle || entry.title}</strong>
                <p>{seoDescription || excerpt || entry.body.slice(0, 160)}</p>
              </>
            ) : (
              <p>
                {text(
                  "Add a title and description to see how this blog post might appear in a search engine listing.",
                  "Добавете заглавие и описание, за да видите как публикацията може да изглежда в търсачка.",
                )}
              </p>
            )}
            {seoOpen && (
              <div
                className={styles.seoFields}
                data-studio-part="blog-seo-fields"
              >
                <Field
                  label={text("Page title", "Заглавие на страницата")}
                  help={text(
                    `${seoTitle.length} of 70 characters used`,
                    `${seoTitle.length} от 70 използвани знака`,
                  )}
                >
                  <input
                    ref={seoInput}
                    maxLength={70}
                    aria-label={text("Page title", "Заглавие на страницата")}
                    value={seoTitle}
                    placeholder={entry.title}
                    onChange={(event) => setSeoTitle(event.target.value)}
                  />
                </Field>
                <Field
                  label={text("Meta description", "Мета описание")}
                  help={text(
                    `${seoDescription.length} of 160 characters used`,
                    `${seoDescription.length} от 160 използвани знака`,
                  )}
                >
                  <textarea
                    maxLength={160}
                    aria-label={text("Meta description", "Мета описание")}
                    value={seoDescription}
                    onChange={(event) => setSeoDescription(event.target.value)}
                  />
                </Field>
                <Field
                  label={text("URL handle", "URL идентификатор")}
                  help={text(
                    "Local draft metadata. No public URL or indexing is created.",
                    "Локални данни за черновата. Не се създава публичен URL или индексиране.",
                  )}
                >
                  <input
                    maxLength={100}
                    aria-label={text("URL handle", "URL идентификатор")}
                    pattern="[a-z0-9-]*"
                    value={handle}
                    onChange={(event) =>
                      setHandle(
                        event.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, ""),
                      )
                    }
                  />
                </Field>
              </div>
            )}
          </EditorSection>
        </div>
        <aside className={s.editorSide} data-studio-part="editor-side">
          <Panel
            title={text("Visibility", "Видимост")}
            part="blog-visibility"
            action={
              <Button
                plain
                aria-label={text(
                  "Set visibility date",
                  "Задаване на дата на видимост",
                )}
                aria-expanded={dateOpen}
                onClick={() => {
                  setPlanned({
                    date: date || currentDraftDateTime().date,
                    time: time || currentDraftDateTime().time,
                  });
                  setDateOpen(true);
                }}
              >
                ▦
              </Button>
            }
          >
            <Check
              radio
              name="blog-visibility"
              checked={visibility === "Visible"}
              onChange={() => setVisibility("Visible")}
              label={text(
                "Visible in local draft preview",
                "Видима в локалния преглед",
              )}
            />
            <Check
              radio
              name="blog-visibility"
              checked={visibility === "Hidden"}
              onChange={() => setVisibility("Hidden")}
              label={text("Hidden", "Скрита")}
            />
            {date && (
              <p className={s.help}>
                {text("Planned locally", "Планирана локално")}: {date} {time}
              </p>
            )}
          </Panel>
          <Panel title={text("Image", "Изображение")} part="blog-image">
            {entry.image && (
              <Image
                className={styles.blogImage}
                unoptimized
                src={entry.image}
                alt=""
                width={248}
                height={160}
              />
            )}
            <div
              className={styles.blogUpload}
              data-studio-part="blog-image-upload"
            >
              <Button onClick={() => setMedia(true)}>
                {text("Add image", "Добавяне на изображение")}
              </Button>
              <span className={s.help}>
                {text(
                  "Choose a saved image or upload a small local image.",
                  "Изберете запазено изображение или качете малко локално изображение.",
                )}
              </span>
            </div>
            {entry.image && (
              <Button plain onClick={() => patch({ image: "" })}>
                {text("Remove image", "Премахване на изображението")}
              </Button>
            )}
          </Panel>
          <Panel
            title={text("Organization", "Организация")}
            part="blog-organization"
          >
            <Field label={text("Author", "Автор")}>
              <input
                maxLength={160}
                value={author}
                onChange={(event) => setAuthor(event.target.value)}
              />
            </Field>
            <Field label={text("Blog", "Блог")}>
              <input
                maxLength={160}
                value={blog}
                onChange={(event) => setBlog(event.target.value)}
              />
            </Field>
            <Field label={text("Tags", "Етикети")}>
              <input
                maxLength={300}
                value={entry.tags}
                onChange={(event) => patch({ tags: event.target.value })}
              />
            </Field>
          </Panel>
          <Panel
            title={text("Theme template", "Шаблон на магазина")}
            part="blog-template"
          >
            <select
              disabled
              aria-label={text("Theme template", "Шаблон на магазина")}
            >
              <option>
                {text("Default blog post", "Стандартна публикация")}
              </option>
            </select>
            <p className={s.help}>
              {text(
                "Blog publication requires a content adapter.",
                "Публикуването в блог изисква адаптер за съдържание.",
              )}
            </p>
          </Panel>
        </aside>
      </div>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      <div className={s.saveBar} data-studio-part="save-bar">
        <Action href={href("blog-posts")}>{text("Cancel", "Отказ")}</Action>
        <Button primary onClick={save}>
          {text("Save draft", "Запазване на чернова")}
        </Button>
      </div>
      {media && (
        <MediaLibrary
          onClose={() => setMedia(false)}
          onSelect={(image) => patch({ image })}
        />
      )}
      {dateOpen && (
        <Modal
          title={text("Set visibility date", "Задаване на дата на видимост")}
          surface="blog-schedule"
          onClose={() => setDateOpen(false)}
          footer={
            <>
              <Button onClick={() => setDateOpen(false)}>
                {text("Cancel", "Отказ")}
              </Button>
              <Button
                primary
                disabled={
                  !planned.date ||
                  planned.date < currentDraftDateTime().date ||
                  !validDraftDate(planned.date) ||
                  !validDraftTime(planned.time)
                }
                onClick={() => {
                  setDate(planned.date);
                  setTime(planned.time);
                  setDateOpen(false);
                }}
              >
                {text("Set planned date", "Задаване на планирана дата")}
              </Button>
            </>
          }
        >
          <DraftDateFields
            presentation="publication"
            minDate={currentDraftDateTime().date}
            date={planned.date}
            time={planned.time}
            onDate={(date) => setPlanned({ ...planned, date })}
            onTime={(time) => setPlanned({ ...planned, time })}
          />
          <p className={s.help}>
            {text(
              "A local note only. Automatic publishing is unavailable.",
              "Само локална бележка. Автоматично публикуване не е достъпно.",
            )}
          </p>
          {date && (
            <Button
              plain
              onClick={() => {
                setDate("");
                setTime("");
                setDateOpen(false);
              }}
            >
              {text("Clear planned date", "Премахване на планираната дата")}
            </Button>
          )}
        </Modal>
      )}
    </main>
  );
}
