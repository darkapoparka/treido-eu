"use client";
import { AdminIcon } from "../admin-icons";
import { usePreview } from "./context";
import styles from "./draft-editor-actions.module.css";

export function DraftEditorActions({
  dirty,
  onDiscard,
  onSave,
}: {
  dirty: boolean;
  onDiscard: () => void;
  onSave: () => void;
}) {
  const { text } = usePreview();
  if (!dirty) return null;
  return (
    <nav
      className={styles.actions}
      data-studio-part="draft-actions"
      aria-label={text(
        "Unsaved draft changes",
        "Незапазени промени в черновата",
      )}
    >
      <button
        type="button"
        onClick={onDiscard}
        aria-label={text("Discard changes", "Отхвърляне на промените")}
      >
        <AdminIcon name="close" />
      </button>
      <button
        type="button"
        onClick={onSave}
        aria-label={text("Save draft", "Запазване на чернова")}
      >
        <span aria-hidden="true">✓</span>
      </button>
    </nav>
  );
}
