"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminIcon } from "../admin-icons";
import { usePreview } from "./context";
import { put, type Entry } from "./model";
import { validMenuLink, type MenuItemDraft } from "./local-draft-model";
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
import styles from "./local-draft-editors.module.css";

export function LocalMenuBuilder({ id }: { id: string }) {
  const { store, href, text, update, notify } = usePreview();
  const router = useRouter();
  const existing = store.entries.find(
    (entry) => entry.id === id && entry.type === "MenuDraft",
  );
  const draft =
    existing?.editorDraft?.kind === "Menu" ? existing.editorDraft : undefined;
  const [name, setName] = useState(existing?.title ?? "");
  const [handle, setHandle] = useState(draft?.handle ?? "");
  const [items, setItems] = useState<MenuItemDraft[]>(draft?.items ?? []);
  const [editing, setEditing] = useState<MenuItemDraft | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [error, setError] = useState("");
  const root = useRef<HTMLElement>(null);
  const itemOpener = useRef<HTMLButtonElement | null>(null);
  useLayoutEffect(() => {
    if (editing || !itemOpener.current) return;
    const target = itemOpener.current.isConnected
      ? itemOpener.current
      : root.current?.querySelector<HTMLButtonElement>(
          '[data-studio-part="menu-add-item"]',
        );
    target?.focus({ preventScroll: true });
  }, [editing]);
  if (id !== "new" && !existing)
    return (
      <main className={s.editor}>
        <Header
          title={text("Menu not found", "Менюто не е намерено")}
          back={href("menus")}
        />
      </main>
    );
  const confirmItem = () => {
    if (!editing?.label.trim() || !validMenuLink(editing.url)) {
      setError(
        text(
          "Add a label and a valid relative, HTTP or HTTPS link.",
          "Добавете име и валидна относителна, HTTP или HTTPS връзка.",
        ),
      );
      return;
    }
    setItems(put(items, { ...editing, label: editing.label.trim() }));
    setEditing(null);
    setError("");
  };
  const save = () => {
    if (!name.trim() || editing || !/^[a-z0-9-]*$/.test(handle)) {
      setError(
        text(
          "Add a name, use a lowercase handle, and finish editing the menu item.",
          "Добавете име, използвайте малки букви в идентификатора и завършете редакцията на елемента.",
        ),
      );
      return;
    }
    const entry: Entry = {
      id: existing?.id ?? `menu-${crypto.randomUUID()}`,
      title: name.trim(),
      body: "",
      type: "MenuDraft",
      status: "Draft",
      tags: "",
      editorDraft: { kind: "Menu", handle, items },
    };
    update({ entries: put(store.entries, entry) });
    notify(
      text(
        "Menu draft saved locally. Store navigation is unchanged.",
        "Черновата на менюто е запазена локално. Навигацията на магазина не е променена.",
      ),
    );
    router.push(href(`menus/${entry.id}`));
  };
  return (
    <main
      ref={root}
      className={`${s.editor} ${styles.centered}`}
      data-studio-part="editor"
      data-studio-builder="menu"
    >
      <EditorBreadcrumb
        href={href("menus")}
        title={text("Menus", "Менюта")}
        icon="content"
        backIcon="close"
      />
      <Header
        title={text("Add menu", "Добавяне на меню")}
        actions={
          <Button
            primary
            className={styles.menuSave}
            aria-label={text("Save menu draft", "Запазване на чернова на меню")}
            onClick={save}
          >
            <AdminIcon name="check" />
          </Button>
        }
      />
      <Panel part="menu-name">
        <Field label={text("Name", "Име")}>
          <input
            value={name}
            maxLength={160}
            onChange={(event) => {
              setName(event.target.value);
              setHandle(
                event.target.value
                  .toLowerCase()
                  .normalize("NFKD")
                  .replace(/[\u0300-\u036f]/g, "")
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-|-$/g, "")
                  .slice(0, 100),
              );
            }}
            autoComplete="off"
            placeholder={text(
              "e.g., Sidebar menu",
              "напр., Меню в страничната лента",
            )}
          />
        </Field>
        <p data-studio-part="menu-handle">
          {text("Handle", "Идентификатор")}: {handle}
        </p>
      </Panel>
      <EditorSection
        title={text("Menu items", "Елементи в менюто")}
        part="menu-items"
      >
        <div className={styles.menuItems}>
          {items
            .filter((item) => item.id !== editing?.id)
            .map((item) => (
              <div
                key={item.id}
                className={styles.menuRow}
                onDragOver={(event) => {
                  if (dragging && !editing) event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (!dragging || editing || dragging === item.id) return;
                  const moved = items.find((value) => value.id === dragging);
                  if (!moved) return;
                  const next = items.filter((value) => value.id !== dragging);
                  next.splice(
                    next.findIndex((value) => value.id === item.id),
                    0,
                    moved,
                  );
                  setItems(next);
                  setDragging(null);
                }}
              >
                <span
                  aria-hidden="true"
                  draggable={!editing}
                  onDragStart={() => setDragging(item.id)}
                  onDragEnd={() => setDragging(null)}
                >
                  ⠿
                </span>
                <Button
                  plain
                  onClick={(event) => {
                    itemOpener.current = event.currentTarget;
                    setEditing({ ...item });
                    setError("");
                  }}
                >
                  {item.label}
                </Button>
                <span>{item.url}</span>
                <Button
                  plain
                  disabled={!!editing || items[0]?.id === item.id}
                  aria-label={text("Move item up", "Премести елемента нагоре")}
                  onClick={() => {
                    const next = [...items];
                    const index = next.findIndex(
                      (value) => value.id === item.id,
                    );
                    [next[index - 1], next[index]] = [
                      next[index],
                      next[index - 1],
                    ];
                    setItems(next);
                  }}
                >
                  ↑
                </Button>
                <Button
                  plain
                  disabled={!!editing || items.at(-1)?.id === item.id}
                  aria-label={text(
                    "Move item down",
                    "Премести елемента надолу",
                  )}
                  onClick={() => {
                    const next = [...items];
                    const index = next.findIndex(
                      (value) => value.id === item.id,
                    );
                    [next[index], next[index + 1]] = [
                      next[index + 1],
                      next[index],
                    ];
                    setItems(next);
                  }}
                >
                  ↓
                </Button>
                <Button
                  plain
                  aria-label={text(
                    "Remove menu item",
                    "Премахване на елемент от менюто",
                  )}
                  onClick={() =>
                    setItems(items.filter((value) => value.id !== item.id))
                  }
                >
                  <AdminIcon name="delete" />
                </Button>
              </div>
            ))}
          {editing && (
            <div
              className={styles.menuEdit}
              data-studio-part="menu-item-editor"
            >
              <span aria-hidden="true">⠿</span>
              <Field label={text("Label", "Име на елемента")}>
                <input
                  value={editing.label}
                  maxLength={160}
                  onChange={(event) =>
                    setEditing({ ...editing, label: event.target.value })
                  }
                  autoFocus
                />
              </Field>
              <Field label={text("Link", "Връзка")}>
                <input
                  value={editing.url}
                  maxLength={2048}
                  placeholder={text(
                    "Search or paste a link",
                    "Потърсете или поставете връзка",
                  )}
                  onChange={(event) =>
                    setEditing({ ...editing, url: event.target.value })
                  }
                />
              </Field>
              <Button
                aria-label={text(
                  "Confirm menu item",
                  "Потвърждаване на елемента",
                )}
                onClick={confirmItem}
              >
                ✓
              </Button>
              <Button
                aria-label={text("Cancel menu item", "Отказ на елемента")}
                onClick={() => {
                  setEditing(null);
                  setError("");
                }}
              >
                ×
              </Button>
              <Button
                plain
                aria-label={text("Delete menu item", "Изтриване на елемента")}
                onClick={() => {
                  setItems(items.filter((item) => item.id !== editing.id));
                  setEditing(null);
                }}
              >
                <AdminIcon name="delete" />
              </Button>
            </div>
          )}
          <Button
            plain
            data-studio-part="menu-add-item"
            disabled={!!editing || items.length >= 50}
            onClick={(event) => {
              itemOpener.current = event.currentTarget;
              setEditing({
                id: `item-${crypto.randomUUID()}`,
                label: "",
                url: "",
              });
              setError("");
            }}
          >
            ＋ {text("Add menu item", "Добавяне на елемент")}
          </Button>
        </div>
      </EditorSection>
      <p className={s.help}>
        {text(
          "Local draft only. The fixed storefront does not publish custom menus.",
          "Само локална чернова. Фиксираният магазин не публикува персонални менюта.",
        )}
      </p>
      {error && (
        <p role="alert" className={s.error}>
          {error}
        </p>
      )}
      <div className={s.saveBar} data-studio-part="save-bar">
        <Action href={href("menus")}>{text("Cancel", "Отказ")}</Action>
        <Button primary onClick={save}>
          {text("Save draft", "Запазване на чернова")}
        </Button>
      </div>
    </main>
  );
}
