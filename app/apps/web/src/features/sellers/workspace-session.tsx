"use client";
import Link from "next/link";
import { useLocale } from "../locale/provider";
import { parseLocale } from "../locale/locale";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { useWorkspaceAccess } from "./use-workspace-access";
import styles from "./workspace.module.css";
import type { WorkspaceSellerAccess } from "./workspace-access";

/** Restored private views recheck current access before becoming visible again. */
export function WorkspaceSession({
  actorSubject,
  sellerAccess,
  serverFrame,
  children,
}: {
  actorSubject: string;
  sellerAccess: readonly WorkspaceSellerAccess[];
  serverFrame: string;
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const search = useSearchParams();
  const preference = useLocale();
  const bg = (parseLocale(search.get("lang")) ?? preference.locale) === "bg";
  const sellerId = typeof params.sellerId === "string" ? params.sellerId : null;
  const { status, changedActor, isLoaded, retry } = useWorkspaceAccess(
    actorSubject,
    sellerId,
    pathname + (search.size ? "?" + search.toString() : ""),
    sellerAccess,
    serverFrame,
  );
  if (changedActor || status === "denied")
    return (
      <main className={`account-page ${styles.page}`} role="status">
        <h1>{bg ? "Достъпът е променен" : "Access has changed"}</h1>
        <p>
          {bg
            ? "Влезте отново или изберете продавач, до който имате достъп."
            : "Sign in again or choose a seller you can access."}
        </p>
        <div className={styles.actions}>
          <Link
            className={styles.link}
            href={`/sign-in?lang=${bg ? "bg" : "en"}&returnTo=${encodeURIComponent(`/app?lang=${bg ? "bg" : "en"}`)}`}
          >
            {bg ? "Вход" : "Sign in"}
          </Link>
          <Link className={styles.link} href={`/app?lang=${bg ? "bg" : "en"}`}>
            {bg ? "Избери продавач" : "Choose seller"}
          </Link>
        </div>
      </main>
    );
  return (
    <>
      <div hidden={!isLoaded || status !== "ready"}>{children}</div>
      {(!isLoaded || status !== "ready") && (
        <section
          className={`account-panel ${styles.sessionStatus}`}
          role="status"
        >
          <p>
            {!isLoaded || status === "checking"
              ? bg
                ? "Проверка на достъпа…"
                : "Checking access…"
              : bg
                ? "Достъпът не може да бъде проверен. Опитайте отново."
                : "Access could not be checked. Try again."}
          </p>
          {isLoaded && !changedActor && (
            <button type="button" className={styles.button} onClick={retry}>
              {bg ? "Опитай отново" : "Retry"}
            </button>
          )}
        </section>
      )}
    </>
  );
}
