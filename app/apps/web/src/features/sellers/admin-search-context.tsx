"use client";

import { createContext, useContext } from "react";
import { AdminIcon } from "./admin-icons";
import styles from "./admin.module.css";

export const AdminSearchContext = createContext<(() => void) | null>(null);

/** The server-rendered Home opens the shell's existing search dialog. */
export function AdminHomeSearch({
  language = "en",
  largeText = false,
}: {
  language?: "en" | "bg";
  largeText?: boolean;
}) {
  const openSearch = useContext(AdminSearchContext);
  const bg = language === "bg";
  return (
    <button
      type="button"
      className={`${styles.homeSearch} ${largeText ? styles.homeSearchLarge : ""}`}
      onClick={openSearch ?? undefined}
      disabled={!openSearch}
      aria-label={bg ? "Търси в магазина" : "Search your store"}
      aria-haspopup="dialog"
      aria-keyshortcuts="Control+K Meta+K"
    >
      <span className={styles.homeSearchPrompt}>
        {bg ? "Намери нещо в магазина си" : "Find anything in your store"}
      </span>
      <span className={styles.homeSearchBottom}>
        <span className={styles.homeSearchLabel}>
          <AdminIcon name="search" />
          {bg ? "Търси в каталога" : "Search your catalog"}
        </span>
        <span className={styles.homeSearchShortcut} aria-hidden="true">
          Ctrl K
        </span>
        <span className={styles.homeSearchArrow} aria-hidden="true">
          <AdminIcon name="arrow" />
        </span>
      </span>
    </button>
  );
}
