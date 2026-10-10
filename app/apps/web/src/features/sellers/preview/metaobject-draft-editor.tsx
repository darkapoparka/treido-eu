"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePreview } from "./context";
import { put, type Entry } from "./model";
import {
  blankMetaobjectField,
  schemaKey,
  validDefinitionDraft,
  type DefinitionDraft,
} from "./metaobject-draft-model";
import { MetaobjectFieldEditor } from "./metaobject-field-editor";
import { MetaobjectFieldOptions } from "./metaobject-field-options";
import { DraftEditorActions } from "./draft-editor-actions";
import {
  Action,
  Button,
  EditorBreadcrumb,
  EditorSection,
  Field,
  Header,
  Panel,
  s,
} from "./ui";
import styles from "./metaobject-draft-editor.module.css";

export function MetaobjectDraftEditor({ id }: { id: string }) {
  const { store, href, update, notify, text } = usePreview();
  const router = useRouter();
  const existing = store.entries.find(
    (entry) =>
      entry.id === id && ["Definition", "DefinitionDraft"].includes(entry.type),
  );
  const prior =
    existing?.editorDraft?.kind === "Definition"
      ? existing.editorDraft
      : undefined;
  const [entry, setEntry] = useState<Entry>(
    existing ?? {
      id: "new",
      title: "",
      type: "DefinitionDraft",
      status: "Draft",
      tags: "",
      body: "",
    },
  );
  const [draft, setDraft] = useState<DefinitionDraft>(
    prior ?? {
      kind: "Definition",
      handle: schemaKey(existing?.title ?? ""),
      description: "",
      fields: [blankMetaobjectField("field-1")],
      activeDraft: true,
      translations: true,
      displayField: "",
      filterFields: [],
    },
  );
  const [descriptionOpen, setDescriptionOpen] = useState(!!draft.description);
  const [customHandle, setCustomHandle] = useState(false);
  const [handleOpen, setHandleOpen] = useState(false);
  const [customDisplay, setCustomDisplay] = useState(!!prior);
  const [error, setError] = useState("");
  const [initial] = useState(() => ({ entry, draft }));
  const [resetCount, setResetCount] = useState(0);
  const dirty = JSON.stringify({ entry, draft }) !== JSON.stringify(initial);
  const patch = (values: Partial<DefinitionDraft>) =>
    setDraft({ ...draft, ...values });
  if (id !== "new" && !existing)
    return (
      <main className={s.editor}>
        <Header
          title={text("Definition not found", "Дефиницията не е намерена")}
          back={href("content")}
        />
      </main>
    );
  const save = () => {
    if (!entry.title.trim() || !validDefinitionDraft(draft)) {
      setError(
        text(
          "Add a name, a valid type key, and uniquely named fields with selected types. Check validation limits and field keys.",
          "Добавете име, валиден ключ на типа и полета с уникални ключове и избрани типове. Проверете ограниченията.",
        ),
      );
      return;
    }
    const saved: Entry = {
      ...entry,
      id: existing?.id ?? `definition-${crypto.randomUUID()}`,
      title: entry.title.trim(),
      type: "DefinitionDraft",
      status: "Draft",
      editorDraft: draft,
    };
    update({ entries: put(store.entries, saved) });
    notify(
      text(
        "Definition draft saved locally. No API schema was created.",
        "Черновата на дефиницията е запазена локално. Не е създадена API схема.",
      ),
    );
    router.push(href(`content/${saved.id}`));
  };
  const provider = text(
    "Requires a connected custom-data adapter.",
    "Изисква свързан адаптер за потребителски данни.",
  );
  return (
    <main
      className={`${s.editor} ${styles.editor}`}
      data-studio-part="editor"
      data-studio-builder="definition"
    >
      <DraftEditorActions
        dirty={dirty}
        onSave={save}
        onDiscard={() => {
          setEntry(initial.entry);
          setDraft(initial.draft);
          setDescriptionOpen(!!initial.draft.description);
          setCustomHandle(!!prior);
          setCustomDisplay(!!prior);
          setHandleOpen(false);
          setResetCount((count) => count + 1);
          setError("");
        }}
      />
      <EditorBreadcrumb
        href={href("settings/custom-data")}
        title={text("Metafields and metaobjects", "Метаполета и метаобекти")}
        icon="content"
      />
      <Header
        title={
          existing
            ? entry.title
            : text(
                "Add metaobject definition",
                "Добавяне на дефиниция за метаобект",
              )
        }
      />
      <Panel part="definition-core">
        <Field label={text("Name", "Име")}>
          <input
            maxLength={160}
            aria-label={text("Name", "Име")}
            placeholder={text(
              "Examples: Cart upsell, Fabric colors, Product highlights",
              "Например: Цветове на плат, Акценти на продукт",
            )}
            value={entry.title}
            onChange={(event) => {
              setEntry({ ...entry, title: event.target.value });
              if (!prior && !customHandle)
                patch({ handle: schemaKey(event.target.value) });
            }}
          />
        </Field>
        {!handleOpen && (
          <Button
            plain
            disabled={!entry.title}
            aria-expanded={handleOpen}
            onClick={() => setHandleOpen(!handleOpen)}
          >
            {text("Type", "Тип")}: {draft.handle}
          </Button>
        )}
        {handleOpen && (
          <Field
            label={text("Type", "Тип")}
            help={text(
              "Use letters, numbers, underscores, and dashes",
              "Използвайте букви, цифри, долни черти и тирета",
            )}
          >
            <input
              aria-label={text("Type", "Тип")}
              maxLength={64}
              value={draft.handle}
              onChange={(event) => {
                setCustomHandle(true);
                patch({
                  handle: event.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9_-]/g, ""),
                });
              }}
            />
          </Field>
        )}
        {descriptionOpen ? (
          <Field label={text("Description", "Описание")}>
            <textarea
              maxLength={2000}
              value={draft.description}
              onChange={(event) => patch({ description: event.target.value })}
            />
          </Field>
        ) : (
          <Button plain onClick={() => setDescriptionOpen(true)}>
            {text("Add description", "Добавяне на описание")}
          </Button>
        )}
        {existing?.body && !prior && (
          <p className={styles.legacy}>
            {text("Previous definition notes", "Предишни бележки")}:{" "}
            {existing.body}
          </p>
        )}
      </Panel>
      <EditorSection title={text("Fields", "Полета")} part="definition-fields">
        <div className={styles.fields}>
          {draft.fields.map((field, index) => (
            <MetaobjectFieldEditor
              key={`${resetCount}:${field.id}`}
              field={field}
              index={index}
              count={draft.fields.length}
              onChange={(value) => {
                const fields = draft.fields.map((item) =>
                  item.id === field.id ? value : item,
                );
                const automatic = fields.find(
                  (item) => item.label.trim() && item.type === "single-line",
                );
                patch({
                  fields,
                  displayField:
                    !customDisplay && automatic
                      ? automatic.id
                      : draft.displayField,
                });
              }}
              onDelete={() =>
                patch({
                  fields: draft.fields.filter((item) => item.id !== field.id),
                  displayField:
                    draft.displayField === field.id ? "" : draft.displayField,
                  filterFields: draft.filterFields.filter(
                    (id) => id !== field.id,
                  ),
                })
              }
              onMove={(direction) => {
                const fields = [...draft.fields];
                [fields[index], fields[index + direction]] = [
                  fields[index + direction],
                  fields[index],
                ];
                patch({ fields });
              }}
            />
          ))}
        </div>
        <Button
          plain
          disabled={draft.fields.length >= 50}
          onClick={() =>
            patch({
              fields: [
                ...draft.fields,
                blankMetaobjectField(`field-${crypto.randomUUID()}`),
              ],
            })
          }
        >
          ⊕ {text("Add field", "Добавяне на поле")}
        </Button>
      </EditorSection>
      <EditorSection
        title={text("Metaobject options", "Опции на метаобекта")}
        part="definition-options"
      >
        <div className={styles.options}>
          <Toggle
            label={text("Active-draft status", "Статус активен–чернова")}
            checked={draft.activeDraft}
            onChange={() => patch({ activeDraft: !draft.activeDraft })}
          />
          <Toggle
            label={text("Translations", "Преводи")}
            checked={draft.translations}
            onChange={() => patch({ translations: !draft.translations })}
          />
          <Toggle
            label={text(
              "Publish entries as web pages",
              "Публикуване като уеб страници",
            )}
            checked={false}
            disabled
            title={provider}
          />
          <Toggle
            label={text("Storefronts API access", "Достъп до Storefront API")}
            checked={false}
            disabled
            title={provider}
          />
          <Toggle
            label={text(
              "Customer Account API access",
              "Достъп до Customer Account API",
            )}
            checked={false}
            disabled
            title={provider}
          />
          {draft.fields.some((field) => field.type) && (
            <Toggle
              label={text(
                "Filter or group data in Analytics",
                "Филтриране или групиране в анализите",
              )}
              checked={false}
              disabled
              title={provider}
            />
          )}
        </div>
      </EditorSection>
      <EditorSection
        title={text("Field options", "Опции на полетата")}
        part="definition-field-options"
      >
        <MetaobjectFieldOptions
          draft={draft}
          onDisplay={(displayField) => {
            setCustomDisplay(true);
            patch({ displayField });
          }}
          onFilters={(filterFields) => patch({ filterFields })}
        />
      </EditorSection>
      <p className={s.help} data-studio-part="draft-boundary">
        {text(
          "Definition options are local planning metadata. API access, entry publication, translations, and schema validation require a connected adapter.",
          "Опциите са локални данни за планиране. API достъпът, публикуването, преводите и проверката на схемата изискват свързан адаптер.",
        )}
      </p>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      <div className={s.saveBar} data-studio-part="save-bar">
        <Action href={href("content")}>{text("Cancel", "Отказ")}</Action>
        <Button primary onClick={save}>
          {text("Save draft", "Запазване на чернова")}
        </Button>
      </div>
    </main>
  );
}

function Toggle({
  label,
  checked,
  disabled,
  title,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  title?: string;
  onChange?: () => void;
}) {
  return (
    <label className={styles.toggle} title={title}>
      <span>{label}</span>
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
      <span aria-hidden="true" />
    </label>
  );
}
