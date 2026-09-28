"use client";
import { ShopSurface } from "./hydration-boundary";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FloatingNav } from "./components";
import "./notifications.css";

export function Notifications() {
  const router = useRouter();
  return (
    <ShopSurface className="shop-page notifications-page">
      <h1>Notifications</h1>
      <section className="notifications-empty">
        <h2>Nothing to see yet</h2>
        <p>You’ll get updates on your account and shopping activity here.</p>
        <Link href="/" className="primary notifications-shopping">
          Start shopping
        </Link>
      </section>
      <FloatingNav back cart={() => router.push("/cart")} showCartWhenEmpty />
    </ShopSurface>
  );
}
