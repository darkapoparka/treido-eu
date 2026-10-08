"use client";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { ShopSurface } from "./hydration-boundary";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FloatingNav } from "./components";
import "./notifications.css";
import "./buyer-surface.css";

export function Notifications({
  publicData = false,
  state = "empty",
  children,
}: {
  publicData?: boolean;
  state?: "empty" | "guest" | "unavailable";
  children?: ReactNode;
} = {}) {
  const ui = useTranslations("discoveryUI");
  const router = useRouter();
  return (
    <ShopSurface
      className={`shop-page notifications-page${publicData ? " buyer-public" : ""}`}
    >
      <h1>{ui("notifications")}</h1>
      {children ?? <NotificationsEmpty state={state} />}
      <FloatingNav back cart={() => router.push("/cart")} showCartWhenEmpty />
    </ShopSurface>
  );
}
export function NotificationsEmpty({
  state = "empty",
}: { state?: "empty" | "guest" | "unavailable" } = {}) {
  const ui = useTranslations("discoveryUI"),
    t = useTranslations("notifications"),
    bg = useLocale() === "bg",
    router = useRouter();
  return (
    <section
      className="notifications-empty"
      role={state === "empty" ? undefined : "status"}
    >
      <h2>
        {state === "empty"
          ? ui("nothingToSeeYet")
          : state === "guest"
            ? bg
              ? "Влезте в профила си"
              : "Sign in to your account"
            : bg
              ? "Не са достъпни"
              : "Temporarily unavailable"}
      </h2>
      <p>
        {state === "empty"
          ? ui("youLlGetUpdatesOnYourAccountAndShoppingActivity")
          : state === "guest"
            ? bg
              ? "Влезте, за да видите известията за съобщения, оферти и запазени търсения."
              : "Sign in to see messages, offers and saved-search updates."
            : t("unavailable")}
      </p>
      {state === "unavailable" ? (
        <button
          className="primary notifications-shopping"
          onClick={() => router.refresh()}
        >
          {t("reload")}
        </button>
      ) : (
        <Link
          href={state === "guest" ? "/sign-in?returnTo=%2Fnotifications" : "/"}
          className="primary notifications-shopping"
        >
          {state === "guest" ? t("signIn") : ui("startShopping")}
        </Link>
      )}
    </section>
  );
}
