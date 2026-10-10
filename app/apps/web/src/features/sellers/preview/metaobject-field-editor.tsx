"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { AdminIcon } from "../admin-icons";
import { usePreview } from "./context";
import {
  metaobjectFieldTypes,
  schemaKey,
  type MetaobjectFieldDraft,
  type MetaobjectFieldType,
} from "./metaobject-draft-model";
import { Button, Field, Modal } from "./ui";
import styles from "./metaobject-draft-editor.module.css";

export function MetaobjectFieldEditor({
  field,
  index,
  count,
  onChange,
  onDelete,
  onMove,
}: {
  field: MetaobjectFieldDraft;
  index: number;
  count: number;
  onChange: (field: MetaobjectFieldDraft) => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const { text } = usePreview();
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState("Validation");
  const [types, setTypes] = useState<{ top: number; left: number }>();
  const [keyOpen, setKeyOpen] = useState(false);
  const [editedKey, setEditedKey] = useState("");
  const [customKey, setCustomKey] = useState(!!field.label);
  const label = metaobjectFieldTypes.find(([type]) => type === field.type);
  const patch = (values: Partial<MetaobjectFieldDraft>) =>
    onChange({ ...field, ...values });
  const textual = [
    "single-line",
    "multi-line",
    "rich-text",
    "choice",
    "email",
  ].includes(field.type);
  return (
    <div className={styles.field} data-studio-part="definition-field">
      <div className={styles.fieldRow}>
        <span className={styles.drag} aria-hidden="true">
          ⠿
        </span>
        <div className={styles.labelInput}>
          <input
            maxLength={160}
            placeholder={text("Field label", "Име на полето")}
            aria-label={text(
              `Field ${index + 1} label`,
              `Име на поле ${index + 1}`,
            )}
            value={field.label}
            onChange={(event) =>
              patch({
                label: event.target.value,
                key: customKey
                  ? field.key
                  : schemaKey(event.target.value) || `field_${index + 1}`,
              })
            }
          />
          <label
            className={styles.required}
            title={
              field.required
                ? text("Required field", "Задължително поле")
                : text("Optional field", "Незадължително поле")
            }
          >
            <input
              type="checkbox"
              checked={field.required}
              aria-label={
                field.required
                  ? text(
                      `Required field ${index + 1}`,
                      `Задължително поле ${index + 1}`,
                    )
                  : text(
                      `Optional field ${index + 1}`,
                      `Незадължително поле ${index + 1}`,
                    )
              }
              onChange={() => patch({ required: !field.required })}
            />
            <span aria-hidden="true">✱</span>
          </label>
        </div>
        <div
          className={styles.typeRow}
          data-studio-part="definition-field-type"
        >
          <select
            aria-label={text(
              `Field ${index + 1} value count`,
              `Брой стойности за поле ${index + 1}`,
            )}
            value={field.list ? "List" : "One"}
            onChange={(event) => patch({ list: event.target.value === "List" })}
          >
            <option value="One">{text("One", "Една")}</option>
            <option value="List">{text("List", "Списък")}</option>
          </select>
          <Button
            plain
            role="combobox"
            aria-label={text(
              `Field ${index + 1} type`,
              `Тип на поле ${index + 1}`,
            )}
            aria-haspopup="listbox"
            aria-expanded={!!types}
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setTypes({
                top: Math.min(rect.bottom + 4, window.innerHeight - 180),
                left: Math.max(
                  16,
                  Math.min(rect.left - 50, window.innerWidth - 376),
                ),
              });
            }}
          >
            {label
              ? text(label[1], label[2])
              : text("Select field type", "Избор на тип")}
            <AdminIcon name="sort" />
          </Button>
        </div>
        <Button
          plain
          aria-label={text(
            `Expand field ${index + 1} options`,
            `Разгъване на опциите на поле ${index + 1}`,
          )}
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          <AdminIcon name="chevron" />
        </Button>
      </div>
      {expanded && (
        <div className={styles.expanded}>
          <div
            className={styles.tabs}
            role="tablist"
            aria-label={text(
              `Field ${index + 1} options`,
              `Опции на поле ${index + 1}`,
            )}
          >
            {(["Validation", "Description"] as const).map((value) => (
              <Button
                key={value}
                plain
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
              >
                {value === "Validation"
                  ? text("Validation", "Проверка")
                  : text("Description", "Описание")}
              </Button>
            ))}
          </div>
          <div
            role="tabpanel"
            aria-label={
              tab === "Validation"
                ? text("Validation", "Проверка")
                : text("Description", "Описание")
            }
          >
            {tab === "Description" ? (
              <textarea
                maxLength={2000}
                aria-label={text(
                  `Field ${index + 1} description`,
                  `Описание на поле ${index + 1}`,
                )}
                value={field.description}
                onChange={(event) => patch({ description: event.target.value })}
              />
            ) : textual ? (
              <div className={styles.validationGroup}>
                <p>{text("Character limit", "Ограничение на знаците")}</p>
                <div className={styles.bounds}>
                  <Field
                    label={text(
                      "Minimum character count",
                      "Минимален брой знаци",
                    )}
                  >
                    <input
                      inputMode="numeric"
                      maxLength={5}
                      placeholder={text("Min", "Мин.")}
                      value={field.minimum}
                      onChange={(event) =>
                        patch({
                          minimum: event.target.value.replace(/\D/g, ""),
                        })
                      }
                    />
                  </Field>
                  <Field
                    label={text(
                      "Maximum character count",
                      "Максимален брой знаци",
                    )}
                  >
                    <input
                      inputMode="numeric"
                      maxLength={5}
                      placeholder={text("Max", "Макс.")}
                      value={field.maximum}
                      onChange={(event) =>
                        patch({
                          maximum: event.target.value.replace(/\D/g, ""),
                        })
                      }
                    />
                  </Field>
                </div>
                <Field label={text("Regular expression", "Регулярен израз")}>
                  <input
                    maxLength={400}
                    value={field.pattern}
                    onChange={(event) => patch({ pattern: event.target.value })}
                  />
                </Field>
              </div>
            ) : (
              <p className={styles.help}>
                {text(
                  "Type-specific validation needs a connected schema adapter.",
                  "Проверката за този тип изисква свързан адаптер за схема.",
                )}
              </p>
            )}
          </div>
          <div className={styles.fieldActions}>
            <Button plain danger onClick={onDelete}>
              {text("Delete field", "Изтриване на поле")}
            </Button>
            <Button
              plain
              onClick={() => {
                setEditedKey(field.key);
                setKeyOpen(true);
              }}
              aria-haspopup="dialog"
              aria-expanded={keyOpen}
            >
              {text("Key", "Ключ")}: {field.key}
            </Button>
          </div>
          {count > 1 && (
            <div className={styles.fieldActions}>
              <Button plain disabled={index === 0} onClick={() => onMove(-1)}>
                {text("Move up", "Преместване нагоре")}
              </Button>
              <Button
                plain
                disabled={index === count - 1}
                onClick={() => onMove(1)}
              >
                {text("Move down", "Преместване надолу")}
              </Button>
            </div>
          )}
        </div>
      )}
      {types && (
        <FieldTypePicker
          anchor={types}
          onClose={() => setTypes(undefined)}
          onSelect={(type) => {
            patch({ type, minimum: "", maximum: "", pattern: "" });
            setTypes(undefined);
          }}
        />
      )}
      {keyOpen && (
        <Modal
          title={text("Edit key", "Редактиране на ключ")}
          surface="definition-key"
          className={styles.keyModal}
          onClose={() => setKeyOpen(false)}
          footer={
            <>
              <Button onClick={() => setKeyOpen(false)}>
                {text("Cancel", "Отказ")}
              </Button>
              <Button
                primary
                disabled={!/^[a-z][a-z0-9_-]{0,63}$/.test(editedKey)}
                onClick={() => {
                  setCustomKey(true);
                  patch({ key: editedKey });
                  setKeyOpen(false);
                }}
              >
                {text("Done", "Готово")}
              </Button>
            </>
          }
        >
          <Field label={text("Key", "Ключ")}>
            <input
              data-studio-autofocus
              maxLength={64}
              value={editedKey}
              onChange={(event) =>
                setEditedKey(
                  event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""),
                )
              }
            />
          </Field>
          <p className={styles.help}>
            {text(
              "Use letters, numbers, underscores, and dashes",
              "Използвайте букви, цифри, долни черти и тирета",
            )}
          </p>
        </Modal>
      )}
    </div>
  );
}

function FieldTypePicker({
  anchor,
  onClose,
  onSelect,
}: {
  anchor: { top: number; left: number };
  onClose: () => void;
  onSelect: (type: MetaobjectFieldType) => void;
}) {
  const { text } = usePreview();
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  useLayoutEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const node = ref.current;
    node?.showPopover();
    node?.querySelector("input")?.focus({ preventScroll: true });
    return () => {
      node?.hidePopover();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  const groups = [
    ["Recommended", "Препоръчани"],
    ["Text", "Текст"],
    ["Media", "Медия"],
    ["Reference", "Връзка към запис"],
    ["Number", "Число"],
    ["Link", "Връзка"],
    ["Date and time", "Дата и час"],
    ["Other", "Други"],
    ["Advanced", "Разширени"],
  ];
  return (
    <div
      ref={ref}
      popover="auto"
      role="dialog"
      aria-label={text("Select field type", "Избор на тип")}
      className={styles.typePicker}
      data-studio-part="definition-type-picker"
      style={{
        top: anchor.top,
        left: anchor.left,
        maxHeight: `calc(100dvh - ${anchor.top + 16}px)`,
      }}
      onToggle={(event) => {
        if (event.newState === "closed") onClose();
      }}
    >
      <div className={styles.search}>
        <AdminIcon name="search" />
        <input
          type="search"
          maxLength={160}
          aria-label={text("Search field types", "Търсене на типове полета")}
          placeholder={text("Search", "Търсене")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div
        className={styles.typeChoices}
        role="listbox"
        aria-label={text("Field types", "Типове полета")}
      >
        {groups.map(([group, bg]) => {
          const options = metaobjectFieldTypes
            .filter(
              ([type, en, label, category]) =>
                (group === "Recommended"
                  ? [
                      "single-line",
                      "multi-line",
                      "integer",
                      "image",
                      "metaobject",
                    ].includes(type)
                  : category === group) &&
                `${en} ${label}`
                  .toLocaleLowerCase()
                  .includes(query.toLocaleLowerCase()),
            )
            .sort((a, b) => {
              const order =
                group === "Recommended"
                  ? [
                      "single-line",
                      "multi-line",
                      "integer",
                      "image",
                      "metaobject",
                    ]
                  : group === "Text"
                    ? [
                        "multi-line",
                        "rich-text",
                        "single-line",
                        "choice",
                        "email",
                      ]
                    : [];
              return order.length
                ? order.indexOf(a[0]) - order.indexOf(b[0])
                : 0;
            });
          return (
            options.length > 0 && (
              <section key={group}>
                <h3>{text(group, bg)}</h3>
                {options.map(([type, en, label]) => (
                  <button
                    type="button"
                    key={type}
                    role="option"
                    aria-selected={false}
                    onClick={() => onSelect(type)}
                  >
                    <span aria-hidden="true">
                      {type === "integer"
                        ? "#"
                        : type.includes("line")
                          ? "A"
                          : "◇"}
                    </span>
                    {text(en, label)}
                  </button>
                ))}
              </section>
            )
          );
        })}
        {!metaobjectFieldTypes.some(([, en, bg]) =>
          `${en} ${bg}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
        ) && <p>{text("No matching field types", "Няма съвпадащи типове")}</p>}
      </div>
    </div>
  );
}
