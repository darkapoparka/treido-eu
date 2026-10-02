"use client";
import { useTranslations } from "next-intl";
import Link from "next/link";
import styles from "@/features/sellers/workspace.module.css";
export default function SellerWorkspaceError({ reset }: { reset: () => void }) {
  const ui = useTranslations("accountUI");
  return (
    <main className={`account-page ${styles.page}`}>
      <h1>{ui("couldNotLoadMySelling")}</h1>
      <p>{ui("yourSavedItemsAreUnchangedTryAgain")}</p>
      <div className={styles.actions}>
        <button className={styles.button} onClick={reset}>
          {ui("retry")}
        </button>
        <Link className={styles.link} href="/sell">
          {ui("backToSelling")}
        </Link>
      </div>
    </main>
  );
}
