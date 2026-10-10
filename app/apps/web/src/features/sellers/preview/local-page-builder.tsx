"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminIcon } from "../admin-icons";
import { usePreview } from "./context";
import { put, type Entry } from "./model";
import { ProductRichEditor } from "./product-rich-editor";
import { DraftDateFields, currentDraftDateTime } from "./draft-date-fields";
import { DraftEditorActions } from "./draft-editor-actions";
import {
  validEditorDraft,
  validDraftDate,
  validDraftTime,
  type EditorDraft,
} from "./local-draft-model";
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
} from "./ui";
import styles from "./local-draft-editors.module.css";

export function LocalPageBuilder({ id }: { id: string }) {
  const { store, href, text, update, notify } = usePreview();
  const router = useRouter();
  const existing = store.entries.find(
    (entry) => entry.id === id && ["Page", "PageDraft"].includes(entry.type),
  );
  const prior =
    existing?.editorDraft?.kind === "Page" ? existing.editorDraft : undefined;
  const [entry, setEntry] = useState<Entry>(
    existing ?? {
      id: "new",
      title: "",
      body: "",
      type: "PageDraft",
      status: "Draft",
      tags: "",
    },
  );
  const [draft, setDraft] = useState<Extract<EditorDraft, { kind: "Page" }>>(
    prior ?? {
      kind: "Page",
      visibility: existing?.status === "Visible" ? "Visible" : "Hidden",
      date: "",
      time: "",
      template: "default",
      seoTitle: "",
      seoDescription: "",
      handle: "",
    },
  );
  const [seoOpen, setSeoOpen] = useState(false);
  const seoInput = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    if (seoOpen) seoInput.current?.focus();
  }, [seoOpen]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [planned, setPlanned] = useState({
    date: draft.date,
    time: draft.time,
  });
  const [error, setError] = useState("");
  const [initial] = useState(() => ({ entry, draft }));
  const [resetCount, setResetCount] = useState(0);
  const titleInput = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify({ entry, draft }) !== JSON.stringify(initial);
  const change = (values: Partial<typeof draft>) =>
    setDraft({ ...draft, ...values });
  if (id !== "new" && !existing)
    return (
      <main className={s.editor}>
        <Header
          title={text("Page not found", "Страницата не е намерена")}
          back={href("pages")}
        />
      </main>
    );
  const save = () => {
    if (!entry.title.trim() || !validEditorDraft(draft)) {
      setError(
        text(
          "Add a title and valid page details before saving.",
          "Добавете заглавие и валидни данни преди запазване.",
        ),
      );
      return;
    }
    const saved: Entry = {
      ...entry,
      id: existing?.id ?? `page-${crypto.randomUUID()}`,
      title: entry.title.trim(),
      type: "PageDraft",
      status: "Draft",
      editorDraft: draft,
    };
    update({ entries: put(store.entries, saved) });
    notify(
      text(
        "Page draft saved locally. Publication is unavailable.",
        "Черновата на страницата е запазена локално. Публикуването не е достъпно.",
      ),
    );
    router.push(href(`pages/${saved.id}`));
  };
  return (
    <main
      className={s.editor}
      data-studio-part="editor"
      data-studio-builder="page"
    >
      <DraftEditorActions
        dirty={dirty}
        onSave={save}
        onDiscard={() => {
          setEntry(initial.entry);
          setDraft(initial.draft);
          setError("");
          setResetCount((value) => value + 1);
          titleInput.current?.focus();
        }}
      />
      <EditorBreadcrumb
        href={href("pages")}
        title={text("Pages", "Страници")}
        icon="content"
      />
      <Header
        title={
          existing ? entry.title : text("Add page", "Добавяне на страница")
        }
      />
      <div className={s.editorColumns} data-studio-part="editor-layout">
        <div className={s.stack} data-studio-part="editor-main">
          <Panel part="page-core">
            <Field label={text("Title", "Заглавие")}>
              <input
                ref={titleInput}
                maxLength={160}
                aria-label={text("Title", "Заглавие")}
                value={entry.title}
                placeholder={text(
                  "e.g., about us, sizing chart, FAQ",
                  "напр., за нас, таблица с размери, въпроси",
                )}
                onChange={(event) =>
                  setEntry({ ...entry, title: event.target.value })
                }
              />
            </Field>
            <Field label={text("Content", "Съдържание")}>
              <ProductRichEditor
                key={resetCount}
                label={text("Page content", "Съдържание на страницата")}
                value={entry.body}
                html={entry.descriptionHtml}
                onChange={(body, descriptionHtml) =>
                  setEntry({ ...entry, body, descriptionHtml })
                }
              />
            </Field>
          </Panel>
          <EditorSection
            title={text("Search engine listing", "Вид в търсачките")}
            part="page-seo"
            action={
              !seoOpen && (
                <Button
                  plain
                  aria-label={text(
                    "Edit search engine listing",
                    "Редактиране на вида в търсачките",
                  )}
                  aria-expanded={seoOpen}
                  onClick={() => setSeoOpen(true)}
                >
                  <AdminIcon name="edit" />
                </Button>
              )
            }
          >
            {entry.title ? (
              <>
                <strong>{draft.seoTitle || entry.title}</strong>
                <p>{draft.seoDescription || entry.body.slice(0, 160)}</p>
              </>
            ) : (
              <p>
                {text(
                  "Add a title and description to see how this page might appear in a search engine listing.",
                  "Добавете заглавие и описание, за да видите как страницата може да изглежда в търсачка.",
                )}
              </p>
            )}
            {seoOpen && (
              <div
                className={styles.seoFields}
                data-studio-part="page-seo-fields"
              >
                <Field
                  label={text("Page title", "Заглавие на страницата")}
                  help={text(
                    `${draft.seoTitle.length} of 70 characters used`,
                    `${draft.seoTitle.length} от 70 използвани знака`,
                  )}
                >
                  <input
                    ref={seoInput}
                    maxLength={70}
                    aria-label={text("Page title", "Заглавие на страницата")}
                    value={draft.seoTitle}
                    placeholder={entry.title}
                    onChange={(event) =>
                      change({ seoTitle: event.target.value })
                    }
                  />
                </Field>
                <Field
                  label={text("Meta description", "Мета описание")}
                  help={text(
                    `${draft.seoDescription.length} of 160 characters used`,
                    `${draft.seoDescription.length} от 160 използвани знака`,
                  )}
                >
                  <textarea
                    maxLength={160}
                    aria-label={text("Meta description", "Мета описание")}
                    value={draft.seoDescription}
                    onChange={(event) =>
                      change({ seoDescription: event.target.value })
                    }
                  />
                </Field>
                <Field label={text("URL handle", "URL идентификатор")}>
                  <div className={styles.handle}>
                    <span aria-hidden="true">pages/</span>
                    <input
                      maxLength={100}
                      aria-label={text("URL handle", "URL идентификатор")}
                      value={draft.handle}
                      onChange={(event) =>
                        change({
                          handle: event.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9-]/g, ""),
                        })
                      }
                    />
                  </div>
                </Field>
              </div>
            )}
          </EditorSection>
        </div>
        <aside className={s.editorSide} data-studio-part="editor-side">
          <Panel
            title={text("Visibility", "Видимост")}
            part="page-visibility"
            action={
              <Button
                plain
                aria-label={text(
                  "Set visibility date",
                  "Задаване на дата на видимост",
                )}
                aria-expanded={scheduleOpen}
                onClick={() => {
                  setPlanned({
                    date: draft.date || currentDraftDateTime().date,
                    time: draft.time || currentDraftDateTime().time,
                  });
                  setScheduleOpen(true);
                }}
              >
                <AdminIcon name="calendar" />
              </Button>
            }
          >
            <Check
              radio
              name="page-visibility"
              checked={draft.visibility === "Visible"}
              onChange={() => change({ visibility: "Visible" })}
              label={text("Visible", "Видима")}
            />
            <Check
              radio
              name="page-visibility"
              checked={draft.visibility === "Hidden"}
              onChange={() => change({ visibility: "Hidden" })}
              label={text("Hidden", "Скрита")}
            />
            {draft.date && (
              <p className={s.help}>
                {text("Planned locally", "Планирана локално")}: {draft.date}{" "}
                {draft.time}
              </p>
            )}
          </Panel>
          <Panel title={text("Template", "Шаблон")} part="page-template">
            <Button
              className={styles.template}
              aria-haspopup="dialog"
              aria-expanded={templateOpen}
              onClick={() => setTemplateOpen(true)}
            >
              {draft.template === "default"
                ? text("Default page", "Стандартна страница")
                : text("contact", "контакт")}
              <AdminIcon name="back" />
            </Button>
          </Panel>
        </aside>
      </div>
      <p className={s.help} data-studio-part="draft-boundary">
        {text(
          "Visibility, templates, and planned dates are local draft metadata. Publishing requires a content adapter.",
          "Видимостта, шаблонът и планираната дата са локални данни. Публикуването изисква адаптер за съдържание.",
        )}
      </p>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      <div className={s.saveBar} data-studio-part="save-bar">
        <Action href={href("pages")}>{text("Cancel", "Отказ")}</Action>
        <Button primary onClick={save}>
          {text("Save draft", "Запазване на чернова")}
        </Button>
      </div>
      {templateOpen && (
        <Modal
          title={text("Template", "Шаблон")}
          surface="page-template"
          onClose={() => setTemplateOpen(false)}
        >
          <div className={styles.templateChoices}>
            {(["default", "contact"] as const).map((template) => (
              <Button
                key={template}
                plain
                aria-pressed={draft.template === template}
                onClick={() => {
                  change({ template });
                  setTemplateOpen(false);
                }}
              >
                {template === "default"
                  ? text("Default page", "Стандартна страница")
                  : text("contact", "контакт")}
                {draft.template === template && (
                  <span aria-hidden="true">✓</span>
                )}
              </Button>
            ))}
          </div>
        </Modal>
      )}
      {scheduleOpen && (
        <Modal
          title={text("Set visibility date", "Задаване на дата на видимост")}
          surface="blog-schedule"
          onClose={() => setScheduleOpen(false)}
          footer={
            <>
              <Button onClick={() => setScheduleOpen(false)}>
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
                  change(planned);
                  setScheduleOpen(false);
                }}
              >
                {text("Set planned date", "Задаване на планирана дата")}
              </Button>
            </>
          }
        >
          <p className={s.help}>
            {text(
              "Set a planned date in your device time zone. Automatic publication is unavailable.",
              "Задайте планирана дата в часовата зона на устройството. Автоматично публикуване не е достъпно.",
            )}
          </p>
          <DraftDateFields
            presentation="publication"
            date={planned.date}
            time={planned.time}
            minDate={currentDraftDateTime().date}
            onDate={(date) => setPlanned({ ...planned, date })}
            onTime={(time) => setPlanned({ ...planned, time })}
          />
          {draft.date && (
            <Button
              plain
              onClick={() => {
                change({ date: "", time: "" });
                setScheduleOpen(false);
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
