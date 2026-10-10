"use client";
import { useEffect, useRef, useState } from "react";
import { AdminIcon } from "../admin-icons";
import admin from "../admin.module.css";
import { usePreview } from "./context";
import { PreviewSearch } from "./search";

/** The Settings frame has its own rail; reuse the same preview search view. */
export function useSettingsSearch() {
  const { text } = usePreview();
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [opened, setOpened] = useState(false);
  const open = () => {
    if (dialog.current?.open) return;
    opener.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog.current?.showModal();
    setOpened(true);
  };
  const close = () => {
    dialog.current?.close();
    setOpened(false);
  };
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        open();
      }
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => {
    if (!opened) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [opened]);
  return {
    open,
    overlay: (
      <dialog
        ref={dialog}
        data-studio-part="search-dialog"
        className={`${admin.searchDialog} ${admin.previewSearchDialog}`}
        aria-label={text("Search your store", "Търси в магазина")}
        onClose={() => {
          setOpened(false);
          if (opener.current?.isConnected)
            opener.current.focus({ preventScroll: true });
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        {opened && <PreviewSearch onClose={close} onNavigate={close} />}
      </dialog>
    ),
  };
}
export function SettingsSearchButton({
  open,
  className,
}: {
  open: () => void;
  className?: string;
}) {
  const { text } = usePreview();
  return (
    <button
      type="button"
      className={className}
      aria-label={text("Search your store", "Търси в магазина")}
      aria-haspopup="dialog"
      onClick={open}
    >
      <AdminIcon name="search" />
    </button>
  );
}
