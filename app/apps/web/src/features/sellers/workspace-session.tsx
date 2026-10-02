"use client";
import Link from "next/link";
import { useLocale } from "../locale/provider";
import { parseLocale } from "../locale/locale";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { refreshSellerAccessAction } from "./setup-actions";
import { clearPrivateBuffers } from "./private-recovery";
import styles from "./workspace.module.css";

/** Restored private views recheck current access before becoming visible again. */
export function WorkspaceSession({
  actorSubject,
  children,
}: {
  actorSubject: string;
  children: React.ReactNode;
}) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const params = useParams();
  const pathname = usePathname();
  const search = useSearchParams();
  const preference = useLocale();
  const bg = (parseLocale(search.get("lang")) ?? preference.locale) === "bg";
  const sellerId = typeof params.sellerId === "string" ? params.sellerId : null;
  const router = useRouter();
  const [status, setStatus] = useState<
    "ready" | "checking" | "denied" | "unavailable"
  >("ready");
  const retry = useRef<() => void>(() => {});
  const changedActor = isLoaded && (!isSignedIn || userId !== actorSubject);
  useEffect(() => {
    if (changedActor) clearPrivateBuffers(actorSubject);
  }, [changedActor, actorSubject]);
  useEffect(() => {
    if (!isLoaded || changedActor) return;
    let cancelled = false;
    let sequence = 0;
    const verify = async (refresh: boolean) => {
      const current = ++sequence;
      setStatus("checking");
      try {
        const result = await refreshSellerAccessAction(sellerId);
        if (cancelled || current !== sequence) return;
        if (!result.ok) {
          const denied = [
            "FORBIDDEN",
            "UNAUTHENTICATED",
            "NOT_FOUND",
            "INVALID_INPUT",
          ].includes(result.code);
          if (denied) clearPrivateBuffers(actorSubject, sellerId ?? undefined);
          setStatus(denied ? "denied" : "unavailable");
          return;
        }
        setStatus("ready");
        if (refresh) router.refresh();
      } catch {
        if (!cancelled && current === sequence) setStatus("unavailable");
      }
    };
    const visible = () => {
      if (document.visibilityState === "visible") void verify(true);
    };
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) void verify(true);
    };
    const lostFocus = () => {
      ++sequence;
      setStatus("checking");
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") lostFocus();
      else visible();
    };
    retry.current = () => {
      void verify(true);
    };
    void verify(false);
    window.addEventListener("focus", visible);
    window.addEventListener("blur", lostFocus);
    window.addEventListener("pageshow", restore);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", visible);
      window.removeEventListener("blur", lostFocus);
      window.removeEventListener("pageshow", restore);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [isLoaded, changedActor, actorSubject, sellerId, pathname, router]);
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
          {status === "unavailable" && (
            <button
              type="button"
              className={styles.button}
              onClick={() => retry.current()}
            >
              {bg ? "Опитай отново" : "Retry"}
            </button>
          )}
        </section>
      )}
    </>
  );
}
