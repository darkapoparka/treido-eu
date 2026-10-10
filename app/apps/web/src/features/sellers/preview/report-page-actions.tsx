"use client";
import { useLayoutEffect, useRef } from "react";
import { usePreview } from "./context";
import { Button } from "./ui";
import styles from "./report-explorer.module.css";

export function ReportPageActions({
  anchor,
  selected,
  saved,
  onClose,
  onExport,
  onDelete,
}: {
  anchor: { left: number; top: number };
  selected: boolean;
  saved: boolean;
  onClose: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  const { text } = usePreview();
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const node = ref.current;
    node?.showPopover();
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
      aria-label={text("Page actions", "Действия на страницата")}
      className={styles.actionsPopover}
      data-studio-part="report-page-actions"
      style={anchor}
      onToggle={(event) => {
        if (event.newState === "closed") onClose();
      }}
    >
      <Button
        plain
        disabled={!selected}
        onClick={() => {
          onClose();
          onExport();
        }}
      >
        {text("Export", "Експорт")}
      </Button>
      <Button
        plain
        disabled={!selected}
        onClick={() => {
          onClose();
          window.print();
        }}
      >
        {text("Print", "Печат")}
      </Button>
      <Button
        plain
        danger
        disabled={!saved}
        onClick={() => {
          onClose();
          onDelete();
        }}
      >
        {text("Delete draft", "Изтриване на чернова")}
      </Button>
    </div>
  );
}
