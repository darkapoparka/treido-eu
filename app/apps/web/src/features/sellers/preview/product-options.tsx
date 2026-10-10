"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { usePreview } from "./context";
import type { Product } from "./model";
import { Button, Field, s } from "./ui";
import styles from "./product-options.module.css";

export function ProductOptions({
  product,
  patch,
}: {
  product: Product;
  patch: (value: Partial<Product>) => void;
}) {
  const { text } = usePreview();
  const root = useRef<HTMLDivElement>(null);
  const editorOpener = useRef<HTMLElement | null>(null);
  const restoreEditorFocus = useRef(false);
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [values, setValues] = useState("");
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState({ left: 16, top: 16 });
  useLayoutEffect(() => {
    if (editing === null && restoreEditorFocus.current) {
      restoreEditorFocus.current = false;
      const opener = editorOpener.current;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
      else
        root.current
          ?.querySelector<HTMLButtonElement>(
            '[data-studio-part="product-option-trigger"]',
          )
          ?.focus({ preventScroll: true });
    }
  }, [editing]);
  const closeEditor = () => {
    restoreEditorFocus.current = true;
    setEditing(null);
  };
  const options = product.options.split("\n").filter(Boolean);
  const normalizedValues = [
    ...new Set(
      values
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
  const valid =
    !!name.trim() &&
    normalizedValues.length > 0 &&
    normalizedValues.length <= 30 &&
    normalizedValues.every((value) => value.length <= 40) &&
    `${name.trim()}: ${normalizedValues.join(", ")}`.length <= 300;
  const start = (preset = "") => {
    editorOpener.current = trigger.current;
    setEditing(options.length);
    setName(preset);
    setValues("");
    menu.current?.hidePopover();
  };
  return (
    <div ref={root} className={styles.root} data-studio-part="product-options">
      {options.map((option, index) => {
        const colon = option.indexOf(":");
        return (
          <div key={index} className={styles.saved}>
            <div>
              <strong>
                {colon < 0
                  ? text("Options", "Варианти")
                  : option.slice(0, colon)}
              </strong>
              <p>{colon < 0 ? option : option.slice(colon + 1)}</p>
            </div>
            <Button
              plain
              onClick={(event) => {
                editorOpener.current = event.currentTarget;
                setEditing(index);
                setName(
                  colon < 0
                    ? text("Options", "Варианти")
                    : option.slice(0, colon),
                );
                setValues(colon < 0 ? option : option.slice(colon + 1));
              }}
            >
              {text("Edit", "Редактиране")}
            </Button>
          </div>
        );
      })}
      {editing === null ? (
        <>
          <Button
            plain
            data-studio-part="product-option-trigger"
            onClick={(event) => {
              trigger.current = event.currentTarget;
              const rect = event.currentTarget.getBoundingClientRect();
              setQuery("");
              setPosition({
                left: Math.max(16, Math.min(rect.left, innerWidth - 292)),
                top: Math.max(
                  16,
                  Math.min(
                    innerWidth >= 768 ? rect.top - 260 : rect.bottom + 4,
                    innerHeight - 260,
                  ),
                ),
              });
              menu.current?.showPopover();
              menu.current
                ?.querySelector("input")
                ?.focus({ preventScroll: true });
            }}
          >
            ＋{" "}
            {text(
              "Add options like size or color",
              "Добавете варианти като размер или цвят",
            )}
          </Button>
          <div
            ref={menu}
            popover="auto"
            className={styles.menu}
            role="dialog"
            aria-label={text("Choose option", "Избор на вариант")}
            data-studio-part="product-option-picker"
            style={position}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                menu.current?.hidePopover();
                trigger.current?.focus({ preventScroll: true });
              }
            }}
          >
            <input
              type="search"
              aria-label={text("Search options", "Търсене на варианти")}
              placeholder={text("Search options", "Търсене на варианти")}
              maxLength={80}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <p>
              {text("Preview option labels", "Етикети на варианти в прегледа")}
            </p>
            {[
              ["Size", "Размер"],
              ["Color", "Цвят"],
              ["Material", "Материал"],
            ]
              .filter(([en, bg]) =>
                text(en, bg).toLowerCase().includes(query.toLowerCase()),
              )
              .map(([en, bg]) => (
                <Button plain key={en} onClick={() => start(text(en, bg))}>
                  {text(en, bg)}
                </Button>
              ))}
            <Button plain onClick={() => start()}>
              {text("Create custom option", "Създаване на собствен вариант")}
            </Button>
          </div>
        </>
      ) : (
        <div className={styles.editor} data-studio-part="product-option-editor">
          <Field label={text("Option name", "Име на варианта")}>
            <input
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field
            label={text("Option values", "Стойности на варианта")}
            help={text(
              "Separate values with commas.",
              "Разделете стойностите със запетаи.",
            )}
          >
            <input
              maxLength={300}
              value={values}
              onChange={(event) => setValues(event.target.value)}
            />
          </Field>
          <div className={s.actions}>
            <Button
              danger
              plain
              onClick={() => {
                patch({
                  options: options
                    .filter((_, index) => index !== editing)
                    .join("\n"),
                });
                closeEditor();
              }}
            >
              {text("Delete", "Изтриване")}
            </Button>
            <Button onClick={closeEditor}>{text("Cancel", "Отказ")}</Button>
            <Button
              primary
              disabled={!valid}
              onClick={() => {
                const next = [...options];
                next[editing] =
                  `${name.trim()}: ${normalizedValues.join(", ")}`;
                patch({ options: next.join("\n") });
                closeEditor();
              }}
            >
              {text("Done", "Готово")}
            </Button>
          </div>
        </div>
      )}
      {options.length > 0 && (
        <p className={s.help}>
          {text(
            "Local option labels only; separate variant stock and prices are unavailable.",
            "Само локални етикети; отделни наличности и цени за вариантите не са достъпни.",
          )}
        </p>
      )}
    </div>
  );
}
