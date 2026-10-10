"use client";
import { createContext, useContext } from "react";
import { AdminIcon } from "./admin-icons";
import styles from "./admin.module.css";
export const AdminSearchContext = createContext<(() => void) | null>(null);
export const AdminHelperContext = createContext<(() => void) | null>(null);

/** Home owns the seller helper composer; global catalogue Search stays in the
 * shell. A read-only seller receives Search, never an implied write action. */
export function AdminHomeSearch({ language = "en", largeText = false }: { language?: "en" | "bg"; largeText?: boolean }) {
  const openSearch = useContext(AdminSearchContext), openHelper = useContext(AdminHelperContext), bg = language === "bg";
  const action = openHelper ?? openSearch, helper = !!openHelper;
  return <button type="button" className={`${styles.homeSearch} ${largeText ? styles.homeSearchLarge : ""}`} onClick={action ?? undefined} disabled={!action}
    aria-label={helper ? bg ? "Отвори помощника за продажби" : "Open Sell Helper" : bg ? "Търси в магазина" : "Search your store"}
    aria-haspopup={helper ? undefined : "dialog"} aria-keyshortcuts={helper ? undefined : "Control+K Meta+K"}>
    <span className={styles.homeSearchPrompt}>{helper ? bg ? "Какво искаш да подобриш в черновата си?" : "What would you like to improve in your draft?" : bg ? "Намери нещо в магазина си" : "Find anything in your store"}</span>
    <span className={styles.homeSearchBottom}><span className={styles.homeSearchLabel}><AdminIcon name={helper ? "edit" : "search"} />{helper ? bg ? "Прегледай с помощника" : "Review with Sell Helper" : bg ? "Търси в каталога" : "Search your catalog"}</span>
      {!helper && <span className={styles.homeSearchShortcut} aria-hidden="true">Ctrl K</span>}
      <span className={styles.homeSearchArrow} aria-hidden="true"><AdminIcon name="arrow" /></span>
    </span>
  </button>;
}
