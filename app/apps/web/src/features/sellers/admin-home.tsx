import Link from "next/link";
import type { ReactNode } from "react";
import type { SellerContext } from "./persistence.server";
import { AdminArt } from "./admin-art";
import { AdminHomeSearch } from "./admin-search-context";
import styles from "./admin.module.css";

export function AdminHome({
  seller,
  language = "en",
  unavailable = false,
  children,
}: {
  seller?: SellerContext;
  language?: "bg" | "en";
  unavailable?: boolean;
  children?: ReactNode;
}) {
  const bg = language === "bg";
  const base = seller ? `/app/sellers/${seller.sellerId}` : "/app";
  const products = seller ? `${base}/listings` : "/app/products";
  const create = !seller
    ? "/sell"
    : seller.capabilities.includes("listing.write")
      ? `${products}/new?lang=${language}`
      : `${products}?lang=${language}`;
  return (
    <main className={styles.home}>
      <h1 className={styles.welcome}>
        {bg ? "Добре дошъл в Treido" : "Welcome to Treido"}
        <br />
        {seller
          ? bg
            ? `Да подготвим ${seller.name}`
            : `Let's set up ${seller.name}`
          : bg
            ? "Твоето място за продажби"
            : "Your selling workspace"}
      </h1>
      <AdminHomeSearch language={language} />
      <div className={styles.cards}>
        <article className={styles.card}>
          <AdminArt kind="products" />
          <div className={styles.cardContent}>
            <h2>
              {bg ? "Добави първия си продукт" : "Add your first product"}
            </h2>
            <p>
              {bg
                ? "Започни с една чернова. Добави заглавие, снимки и цена, когато си готов."
                : "Start with a draft. Add a title, photos and a price when you're ready."}
            </p>
            <Link
              className={styles.primary}
              href={unavailable ? "/sell" : create}
            >
              {unavailable
                ? bg
                  ? "Подготви артикул"
                  : "Prepare an item"
                : bg
                  ? "Добави продукт"
                  : "Add product"}
            </Link>
          </div>
        </article>
        <article className={styles.card}>
          <AdminArt kind="store" />
          <div className={styles.cardContent}>
            <h2>{bg ? "Представи бизнеса си" : "Make your business yours"}</h2>
            <p>
              {bg
                ? "Попълни публичните данни на бизнеса. Запази напредъка си и продължи по-късно."
                : "Set up your public business details. Save your progress and come back anytime."}
            </p>
            <Link
              className={styles.secondary}
              href={
                seller?.kind === "business"
                  ? `${base}/onboarding?lang=${language}`
                  : `/app/onboarding?lang=${language}`
              }
            >
              {seller?.kind === "business"
                ? bg
                  ? "Продължи настройката"
                  : "Continue setup"
                : bg
                  ? "Добави бизнес"
                  : "Add a business"}
            </Link>
          </div>
        </article>
        <article className={styles.card}>
          <AdminArt kind="review" />
          <div className={styles.cardContent}>
            <h2>
              {bg
                ? "Подготви се за първата продажба"
                : "Get ready for your first sale"}
            </h2>
            <p>
              {bg
                ? "Прегледай запазените продукти и нужните стъпки за публикуване. Всяка стъпка е отделна."
                : "Review your saved products and check what's needed before publication."}
            </p>
            <Link
              className={styles.secondary}
              href={`${products}?lang=${language}`}
            >
              {bg ? "Прегледай продуктите" : "Review products"}
            </Link>
          </div>
        </article>
      </div>
      {unavailable && (
        <section className={styles.homeNotice} role="status">
          <h2>
            {bg
              ? "Продажбите в момента не са достъпни"
              : "Selling is currently unavailable"}
          </h2>
          <p>
            {bg
              ? "Опитай отново по-късно. Запазените ти чернови не се променят."
              : "Try again later. Your saved drafts are unchanged."}
          </p>
        </section>
      )}
      {children}
    </main>
  );
}
