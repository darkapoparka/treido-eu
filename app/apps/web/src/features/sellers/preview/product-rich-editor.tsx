"use client";
import { useId, useRef, useState, type CSSProperties } from "react";
import { usePreview } from "./context";
import {
  plainTextHtml,
  safeDescriptionColor,
  sanitizeDescriptionHtml,
} from "./rich-text";
import { normalizePreviewFileUrl } from "./model";
import { Button, Field, Modal, s } from "./ui";
import styles from "./product-rich-editor.module.css";

export function ProductRichEditor({
  value,
  html,
  onChange,
  label,
  generation = true,
}: {
  value: string;
  html?: string;
  onChange: (text: string, html: string) => void;
  label?: string;
  generation?: boolean;
}) {
  const { text } = usePreview();
  const editor = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [initialHtml] = useState(() =>
    sanitizeDescriptionHtml(html ?? plainTextHtml(value)),
  );
  const [expanded, setExpanded] = useState(false);
  const [source, setSource] = useState(false);
  const [sourceValue, setSourceValue] = useState(initialHtml);
  const [linkEditor, setLinkEditor] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [linkError, setLinkError] = useState("");
  const id = useId().replace(/[^a-z0-9]/gi, "");
  const [colorMode, setColorMode] = useState<"color" | "background-color">(
    "color",
  );
  const [color, setColor] = useState("#000000");
  const [tableSelected, setTableSelected] = useState(false);
  const remember = () => {
    const selection = window.getSelection();
    if (
      selection?.rangeCount &&
      editor.current?.contains(selection.anchorNode)
    ) {
      savedRange.current = selection.getRangeAt(0).cloneRange();
      const node =
        selection.anchorNode instanceof Element
          ? selection.anchorNode
          : selection.anchorNode?.parentElement;
      setTableSelected(!!node?.closest("table"));
    }
  };
  const changed = () => {
    const field = editor.current;
    if (!field) return;
    onChange(
      field.innerText.slice(0, 5000),
      sanitizeDescriptionHtml(field.innerHTML),
    );
  };
  const command = (name: string, value?: string) => {
    const field = editor.current;
    if (!field) return;
    field.focus();
    const selection = window.getSelection();
    if (
      savedRange.current &&
      field.contains(savedRange.current.commonAncestorContainer)
    ) {
      selection?.removeAllRanges();
      selection?.addRange(savedRange.current);
    }
    document.execCommand(name, false, value);
    changed();
    remember();
  };
  const applyColor = (next: string) => {
    const safe = safeDescriptionColor(next);
    setColor(next);
    if (!safe) return;
    document.execCommand("styleWithCSS", false, "true");
    command(colorMode === "color" ? "foreColor" : "hiliteColor", safe);
  };
  const tableCommand = (name: string) => {
    if (name === "insert") {
      command(
        "insertHTML",
        "<table><tbody><tr><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td></tr></tbody></table>",
      );
      return;
    }
    const node = savedRange.current?.commonAncestorContainer;
    const element = node instanceof Element ? node : node?.parentElement;
    const cell = element?.closest("td,th");
    const row = cell?.closest("tr");
    const table = cell?.closest("table");
    if (!cell || !row || !table || !editor.current?.contains(table)) return;
    const cellIndex = Array.from(row.children).indexOf(cell);
    const rows = Array.from(table.querySelectorAll("tr"));
    if (name === "delete-table") table.remove();
    else if (name === "delete-row") row.remove();
    else if (name === "delete-column")
      rows.forEach((item) => item.children[cellIndex]?.remove());
    else if (name.startsWith("row") && rows.length < 20) {
      const next = row.cloneNode(true) as HTMLElement;
      for (const item of next.children) item.innerHTML = "<br>";
      row.insertAdjacentElement(
        name === "row-before" ? "beforebegin" : "afterend",
        next,
      );
    } else if (name.startsWith("column") && row.children.length < 10)
      rows.forEach((item) => {
        const next = document.createElement("td");
        next.innerHTML = "<br>";
        item.children[cellIndex]?.insertAdjacentElement(
          name === "column-before" ? "beforebegin" : "afterend",
          next,
        );
      });
    if (!table.querySelector("td,th")) table.remove();
    changed();
  };
  const tools = [
    ["bold", "B", "Bold", "Удебелен"],
    ["italic", "I", "Italic", "Курсив"],
    ["underline", "U", "Underline", "Подчертан"],
    ["insertUnorderedList", "☷", "Bulleted list", "Списък с точки"],
    ["insertOrderedList", "≣", "Numbered list", "Номериран списък"],
    ["outdent", "⇤", "Outdent", "Намали отстъпа"],
    ["indent", "⇥", "Indent", "Увеличи отстъпа"],
    ["removeFormat", "⊘", "Clear formatting", "Изчисти форматирането"],
  ];
  return (
    <div className={styles.root} data-studio-part="rich-editor">
      <div
        className={styles.toolbar}
        data-studio-part="rich-tools"
        onPointerDown={remember}
      >
        {generation && (
          <button
            type="button"
            disabled
            aria-label={text(
              "Generate text unavailable",
              "Генерирането на текст не е достъпно",
            )}
            title={text(
              "Text generation requires a connected content assistant.",
              "Генерирането на текст изисква свързан помощник за съдържание.",
            )}
          >
            <svg
              viewBox="0 0 20 20"
              width="16"
              height="16"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="m8 3 2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4Zm7 9 1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2Z" />
            </svg>
          </button>
        )}
        <select
          aria-label={text("Formatting options", "Форматиране")}
          defaultValue="p"
          onChange={(event) => command("formatBlock", event.target.value)}
        >
          <option value="p">{text("Paragraph", "Абзац")}</option>
          <option value="h2">{text("Heading", "Заглавие")}</option>
          <option value="h3">{text("Subheading", "Подзаглавие")}</option>
        </select>
        <button
          type="button"
          className={styles.more}
          aria-label={text("Additional controls", "Още контроли")}
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          ···
        </button>
        <div
          className={styles.controls}
          data-studio-part="format-controls"
          hidden={!expanded}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setExpanded(false);
              event.stopPropagation();
            }
          }}
        >
          {tools.map(([name, symbol, en, bg]) => (
            <button
              type="button"
              key={name}
              aria-label={text(en, bg)}
              title={text(en, bg)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => command(name)}
            >
              {symbol}
            </button>
          ))}
          <button
            type="button"
            aria-label={text("Color", "Цвят")}
            style={{ anchorName: `--${id}-color` } as CSSProperties}
            popoverTarget={`${id}-color`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={remember}
          >
            A⌄
          </button>
          <div
            id={`${id}-color`}
            popover="auto"
            className={styles.colorPopover}
            style={{ positionAnchor: `--${id}-color` } as CSSProperties}
            data-studio-part="description-color"
          >
            <div
              role="tablist"
              aria-label={text("Color style", "Вид на цвета")}
            >
              <button
                type="button"
                role="tab"
                aria-selected={colorMode === "color"}
                onClick={() => setColorMode("color")}
              >
                {text("Text", "Текст")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={colorMode === "background-color"}
                onClick={() => setColorMode("background-color")}
              >
                {text("Background", "Фон")}
              </button>
            </div>
            <input
              type="color"
              value={safeDescriptionColor(color) ?? "#000000"}
              aria-label={text("Color picker", "Избор на цвят")}
              onChange={(event) => applyColor(event.target.value)}
            />
            <Field label={text("Color value", "Стойност на цвета")}>
              <input
                value={color}
                maxLength={7}
                aria-invalid={!safeDescriptionColor(color)}
                onChange={(event) => applyColor(event.target.value)}
              />
            </Field>
            <div className={styles.colorGrid}>
              {[
                "#ff0000",
                "#ff8800",
                "#ffff00",
                "#22cc44",
                "#33aaff",
                "#2222ff",
                "#ee00ee",
                "#000000",
                "#333333",
                "#666666",
                "#999999",
                "#bbbbbb",
                "#eeeeee",
                "#ffffff",
              ].map((value) => (
                <button
                  type="button"
                  key={value}
                  style={{ backgroundColor: value }}
                  aria-label={`${text("Set color", "Задаване на цвят")} ${value}`}
                  onClick={() => applyColor(value)}
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            aria-label={text("Alignment", "Подравняване")}
            style={{ anchorName: `--${id}-alignment` } as CSSProperties}
            popoverTarget={`${id}-alignment`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={remember}
          >
            ≡⌄
          </button>
          <div
            id={`${id}-alignment`}
            popover="auto"
            className={styles.toolPopover}
            data-studio-part="description-alignment"
            style={{ positionAnchor: `--${id}-alignment` } as CSSProperties}
          >
            {[
              ["justifyLeft", "Align left", "Подравни вляво"],
              ["justifyCenter", "Align center", "Центрирай"],
              ["justifyRight", "Align right", "Подравни вдясно"],
            ].map(([name, en, bg]) => (
              <button type="button" key={name} onClick={() => command(name)}>
                {text(en, bg)}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label={text("Insert table", "Добавяне на таблица")}
            style={{ anchorName: `--${id}-table` } as CSSProperties}
            popoverTarget={`${id}-table`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={remember}
          >
            ▦⌄
          </button>
          <div
            id={`${id}-table`}
            popover="auto"
            className={styles.toolPopover}
            data-studio-part="description-table"
            style={{ positionAnchor: `--${id}-table` } as CSSProperties}
          >
            {[
              ["insert", "Insert table", "Добавяне на таблица"],
              ["row-before", "Insert row above", "Добавяне на ред отгоре"],
              ["row-after", "Insert row below", "Добавяне на ред отдолу"],
              [
                "column-before",
                "Insert column before",
                "Добавяне на колона преди",
              ],
              [
                "column-after",
                "Insert column after",
                "Добавяне на колона след",
              ],
              ["delete-row", "Delete row", "Изтриване на ред"],
              ["delete-column", "Delete column", "Изтриване на колона"],
              ["delete-table", "Delete table", "Изтриване на таблица"],
            ].map(([name, en, bg]) => (
              <button
                key={name}
                type="button"
                disabled={name !== "insert" && !tableSelected}
                onClick={() => tableCommand(name)}
              >
                {text(en, bg)}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label={text("Insert link", "Добави връзка")}
            title={text(
              "Select text to add a link",
              "Маркирай текст за връзка",
            )}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              remember();
              setLinkText(savedRange.current?.toString() ?? "");
              setLinkUrl("");
              setLinkError("");
              setLinkEditor(true);
            }}
          >
            ↗
          </button>
          <button
            type="button"
            disabled
            title={text(
              "Description images and video are unavailable in this preview",
              "Снимки и видео в описанието не са достъпни в прегледа",
            )}
            aria-label={text(
              "Insert media unavailable",
              "Медията не е достъпна",
            )}
          >
            ▧
          </button>
          <button
            type="button"
            aria-label={text("Show HTML", "Покажи HTML")}
            data-studio-part="description-html"
            onClick={() => {
              if (source) {
                if (editor.current)
                  editor.current.innerHTML =
                    sanitizeDescriptionHtml(sourceValue);
                changed();
              } else
                setSourceValue(
                  sanitizeDescriptionHtml(editor.current?.innerHTML ?? ""),
                );
              setSource(!source);
            }}
          >
            &lt;/&gt;
          </button>
        </div>
      </div>
      {linkEditor && (
        <Modal
          title={text("Insert link", "Добавяне на връзка")}
          surface="description-link"
          onClose={() => setLinkEditor(false)}
          footer={
            <>
              <Button onClick={() => setLinkEditor(false)}>
                {text("Cancel", "Отказ")}
              </Button>
              <Button
                primary
                onClick={() => {
                  const url = normalizePreviewFileUrl(linkUrl.trim());
                  if (!url) {
                    setLinkError(
                      text(
                        "Enter a valid HTTP or HTTPS URL.",
                        "Въведете валиден HTTP или HTTPS URL.",
                      ),
                    );
                    return;
                  }
                  command(
                    "insertHTML",
                    sanitizeDescriptionHtml(
                      `<a href="${url}">${plainTextHtml(linkText.trim() || url)}</a>`,
                    ),
                  );
                  setLinkEditor(false);
                }}
              >
                {text("Insert link", "Добавяне на връзка")}
              </Button>
            </>
          }
        >
          <Field label={text("Link to", "Адрес на връзката")}>
            <input
              type="url"
              value={linkUrl}
              maxLength={2048}
              onChange={(event) => {
                setLinkUrl(event.target.value);
                setLinkError("");
              }}
              placeholder="https://"
            />
          </Field>
          <Field label={text("Text to display", "Текст за показване")}>
            <input
              value={linkText}
              maxLength={300}
              onChange={(event) => setLinkText(event.target.value)}
            />
          </Field>
          {linkError && (
            <p className={s.error} role="alert">
              {linkError}
            </p>
          )}
        </Modal>
      )}
      <div
        ref={editor}
        className={styles.editor}
        role="textbox"
        aria-label={label ?? text("Description", "Описание")}
        aria-multiline="true"
        data-studio-part="rich-editor-content"
        contentEditable={!source}
        suppressContentEditableWarning
        hidden={source}
        dangerouslySetInnerHTML={{ __html: initialHtml }}
        onInput={changed}
        onKeyUp={remember}
        onMouseUp={remember}
        onPaste={(event) => {
          event.preventDefault();
          document.execCommand(
            "insertText",
            false,
            event.clipboardData.getData("text/plain").slice(0, 5000),
          );
          changed();
        }}
      />
      {source && (
        <textarea
          className={styles.editor}
          aria-label={
            label
              ? `${label} HTML`
              : text("Description HTML", "HTML на описанието")
          }
          value={sourceValue}
          maxLength={20000}
          onChange={(event) => {
            setSourceValue(event.target.value);
            const safe = sanitizeDescriptionHtml(event.target.value);
            if (editor.current) editor.current.innerHTML = safe;
            const plain = document.createElement("div");
            plain.innerHTML = safe.replace(
              /<br>|<\/(?:p|div|h2|h3|li|tr)>/g,
              "\n",
            );
            onChange((plain.textContent ?? "").slice(0, 5000), safe);
          }}
        />
      )}
    </div>
  );
}
