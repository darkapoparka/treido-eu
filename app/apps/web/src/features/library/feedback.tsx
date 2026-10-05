"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { LibraryController } from "./use-library";
import s from "./library.module.css";
export function LibrarySignIn() {
  const pathname = usePathname(),
    params = useSearchParams(),
    locale = useLocale(),
    t = useTranslations("library");
  const target = pathname + (params.size ? "?" + params.toString() : "");
  return (
    <Link
      className="primary"
      prefetch={false}
      href={
        "/sign-in?lang=" + locale + "&returnTo=" + encodeURIComponent(target)
      }
    >
      {t("signIn")}
    </Link>
  );
}
export function LibraryFeedback({
  controller,
  inline = false,
}: {
  controller: LibraryController;
  inline?: boolean;
}) {
  const t = useTranslations("library");
  if (!controller.error && !controller.notice) return null;
  return (
    <div
      className={inline ? s.inlineFeedback : "local-toast " + s.feedback}
      role={controller.error ? "alert" : "status"}
    >
      <span>{controller.error ? t(controller.error) : t("updated")}</span>
      {controller.error === "UNAUTHENTICATED" && <LibrarySignIn />}
      <button type="button" onClick={controller.dismiss}>
        {t("done")}
      </button>
    </div>
  );
}
export function LibraryLoadState({
  controller,
}: {
  controller: LibraryController;
}) {
  const t = useTranslations("library");
  return (
    <div className="empty-state" role="status">
      <p>
        {t(
          controller.status === "guest"
            ? "signInNote"
            : controller.status === "loading"
              ? "loading"
              : "loadUnavailable",
        )}
      </p>
      {controller.status === "guest" ? (
        <LibrarySignIn />
      ) : controller.status === "error" ? (
        <button
          className="primary"
          type="button"
          onClick={() => void controller.refresh()}
        >
          {t("retry")}
        </button>
      ) : null}
    </div>
  );
}
