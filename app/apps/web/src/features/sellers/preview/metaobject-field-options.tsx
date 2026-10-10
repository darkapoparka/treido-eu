"use client";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AdminIcon } from "../admin-icons";
import { usePreview } from "./context";
import type { DefinitionDraft } from "./metaobject-draft-model";
import { Button, Check } from "./ui";
import styles from "./metaobject-draft-editor.module.css";

type Anchor = { top: number; left: number };
export function MetaobjectFieldOptions({
  draft,
  onDisplay,
  onFilters,
}: {
  draft: DefinitionDraft;
  onDisplay: (id: string) => void;
  onFilters: (ids: string[]) => void;
}) {
  const { text } = usePreview();
  const [picker, setPicker] = useState<{
    kind: "display" | "filters";
    anchor: Anchor;
  }>();
  const fields = draft.fields.filter(
    (field) => field.label.trim() && field.type,
  );
  const selected = fields.find((field) => field.id === draft.displayField);
  const open = (kind: "display" | "filters", button: HTMLButtonElement) => {
    const rect = button.getBoundingClientRect();
    setPicker({
      kind,
      anchor: {
        top: Math.min(rect.bottom + 4, window.innerHeight - 100),
        left: Math.max(16, Math.min(rect.right - 200, window.innerWidth - 216)),
      },
    });
  };
  return (
    <>
      <div
        className={styles.optionRow}
        data-studio-part="definition-display-name"
      >
        <span>{text("Display name", "Показвано име")}</span>
        <Button
          plain
          role="combobox"
          aria-label={text("Display name", "Показвано име")}
          aria-haspopup="listbox"
          aria-expanded={picker?.kind === "display"}
          onClick={(event) => open("display", event.currentTarget)}
        >
          <span aria-hidden="true">{selected ? "A" : "‹/›"}</span>
          <span>
            {selected?.label || text("Auto-generated", "Автоматично")}
          </span>
          <AdminIcon name="sort" />
        </Button>
      </div>
      <div
        className={styles.optionRow}
        data-studio-part="definition-filter-fields"
      >
        <span>{text("Fields used as filters", "Полета за филтриране")}</span>
        <div className={styles.filterControls}>
          <Button
            plain
            disabled={!fields.length}
            aria-haspopup="dialog"
            aria-expanded={picker?.kind === "filters"}
            onClick={(event) => open("filters", event.currentTarget)}
          >
            ⊕ {text("Add fields", "Добавяне на полета")}
          </Button>
          {draft.filterFields.length > 0 && (
            <div className={styles.filterChips}>
              {fields
                .filter((field) => draft.filterFields.includes(field.id))
                .map((field) => (
                  <span key={field.id}>
                    <span aria-hidden="true">A</span> {field.label}
                    <Button
                      plain
                      aria-label={text(
                        `Remove ${field.label}`,
                        `Премахване на ${field.label}`,
                      )}
                      onClick={() =>
                        onFilters(
                          draft.filterFields.filter((id) => id !== field.id),
                        )
                      }
                    >
                      <AdminIcon name="close" />
                    </Button>
                  </span>
                ))}
            </div>
          )}
        </div>
      </div>
      {picker && (
        <OptionPopover
          anchor={picker.anchor}
          label={
            picker.kind === "display"
              ? text("Display name", "Показвано име")
              : text("Fields used as filters", "Полета за филтриране")
          }
          onClose={() => setPicker(undefined)}
        >
          {picker.kind === "display" ? (
            <div
              role="listbox"
              aria-label={text("Display name", "Показвано име")}
            >
              {[
                { id: "", label: text("Auto-generated", "Автоматично") },
                ...fields,
              ].map((field) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={draft.displayField === field.id}
                  key={field.id}
                  onClick={() => {
                    onDisplay(field.id);
                    setPicker(undefined);
                  }}
                >
                  <span aria-hidden="true">{field.id ? "A" : "‹/›"}</span>
                  {field.label}
                  {draft.displayField === field.id && (
                    <span aria-hidden="true">✓</span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            fields.map((field) => (
              <Check
                key={field.id}
                label={field.label}
                checked={draft.filterFields.includes(field.id)}
                disabled={
                  !draft.filterFields.includes(field.id) &&
                  draft.filterFields.length >= 10
                }
                onChange={() =>
                  onFilters(
                    draft.filterFields.includes(field.id)
                      ? draft.filterFields.filter((id) => id !== field.id)
                      : [...draft.filterFields, field.id],
                  )
                }
              />
            ))
          )}
        </OptionPopover>
      )}
    </>
  );
}

function OptionPopover({
  anchor,
  label,
  onClose,
  children,
}: {
  anchor: Anchor;
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const node = ref.current;
    node?.showPopover();
    node
      ?.querySelector<HTMLElement>("button,input")
      ?.focus({ preventScroll: true });
    return () => {
      node?.hidePopover();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  return (
    <div
      ref={ref}
      popover="auto"
      role="dialog"
      aria-label={label}
      className={styles.optionPopover}
      data-studio-part="definition-option-picker"
      style={{
        top: anchor.top,
        left: anchor.left,
        maxHeight: `calc(100dvh - ${anchor.top + 16}px)`,
      }}
      onToggle={(event) => {
        if (event.newState === "closed") onClose();
      }}
    >
      {children}
    </div>
  );
}
