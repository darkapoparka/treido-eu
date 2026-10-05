"use client";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Sheet } from "../discovery/components";
import { Icon } from "../discovery/icons";
import { useBuyerLibrary } from "./provider";
import { LibraryFeedback } from "./feedback";
import { LIBRARY_LIMITS, type LibraryCollection } from "./model";
import s from "./library.module.css";
export type CollectionPanel = "create" | "rename" | "delete" | "options";
export function LibraryCollectionDialog({
  panel,
  collection,
  onClose,
  onPanel,
  onCreated,
  onDeleted,
  onAdd,
}: {
  panel: CollectionPanel;
  collection?: LibraryCollection;
  onClose: () => void;
  onPanel: (value: CollectionPanel) => void;
  onCreated: (id: string) => void;
  onDeleted: () => void;
  onAdd: () => void;
}) {
  const library = useBuyerLibrary(),
    t = useTranslations("library");
  const [name, setName] = useState(
    panel === "rename" ? (collection?.name ?? "") : "",
  );
  const editing = panel === "create" || panel === "rename";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const operation =
      panel === "rename" && collection
        ? {
            kind: "renameCollection" as const,
            collectionId: collection.id,
            name,
          }
        : { kind: "createCollection" as const, name };
    const result = await library.execute(operation);
    if (result) {
      if (panel === "create" && result.resultId) onCreated(result.resultId);
      else onClose();
    }
  }
  const title =
    panel === "create"
      ? "createCollection"
      : panel === "rename"
        ? "renameCollection"
        : panel === "delete"
          ? "deleteQuestion"
          : "collectionOptions";
  return (
    <Sheet
      open
      title={t(title)}
      onClose={onClose}
      className={
        "saved-sheet " +
        (editing
          ? "collection-editor"
          : panel === "delete"
            ? "collection-delete-sheet"
            : "collection-options-sheet")
      }
      initialFocus={editing ? "input" : "button"}
    >
      {editing ? (
        <form onSubmit={submit} className={s.nameEditor}>
          <label>
            {t("name")}
            <input
              className="collection-name-input"
              name="name"
              maxLength={LIBRARY_LIMITS.name}
              required
              autoComplete="off"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <p>{t("privateNote")}</p>
          <div className="sheet-actions">
            <button type="button" className="pill" onClick={onClose}>
              {t("cancel")}
            </button>
            <button
              type="submit"
              className="primary"
              disabled={library.busy || !name.trim()}
            >
              {t(panel === "create" ? "create" : "update")}
            </button>
          </div>
        </form>
      ) : panel === "delete" && collection ? (
        <>
          <p className="collection-confirm-copy">{t("deleteNote")}</p>
          <div className="sheet-actions">
            <button type="button" className="pill" onClick={onClose}>
              {t("cancel")}
            </button>
            <button
              type="button"
              className="primary collection-delete"
              disabled={library.busy}
              onClick={async () => {
                if (
                  await library.execute({
                    kind: "deleteCollection",
                    collectionId: collection.id,
                  })
                )
                  onDeleted();
              }}
            >
              {t("delete")}
            </button>
          </div>
        </>
      ) : collection ? (
        <div className="collection-option-rows">
          <button type="button" onClick={() => onPanel("rename")}>
            <Icon name="edit" />
            {t("renameCollection")}
          </button>
          <button type="button" onClick={onAdd}>
            <Icon name="plus-circle" />
            {t("addFromSaved")}
          </button>
          <button
            type="button"
            className="danger-text"
            onClick={() => onPanel("delete")}
          >
            <Icon name="trash" />
            {t("deleteCollection")}
          </button>
        </div>
      ) : null}
      <LibraryFeedback controller={library} inline />
    </Sheet>
  );
}
