"use client";
import { useTranslations } from "next-intl";
import { ShopSurface } from "./hydration-boundary";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FloatingNav } from "./components";
import "./notifications.css";

export function Notifications() {
  const ui = useTranslations("discoveryUI");
  const router = useRouter();
  return (
    <ShopSurface className="shop-page notifications-page">
      <h1>{ui("notifications")}</h1>
      <section className="notifications-empty">
        <h2>{ui("nothingToSeeYet")}</h2>
        <p>{ui("youLlGetUpdatesOnYourAccountAndShoppingActivity")}</p>
        <Link href="/" className="primary notifications-shopping">
          {ui("startShopping")}
        </Link>
      </section>
      <FloatingNav back cart={() => router.push("/cart")} showCartWhenEmpty />
    </ShopSurface>
  );
}
