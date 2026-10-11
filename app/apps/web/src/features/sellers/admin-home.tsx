import Link from "next/link";
import type { ReactNode } from "react";
import type { SellerContext } from "./persistence.server";
import type { SellerOperationsView } from "./operations-model";
import { AdminHomeOperations } from "./admin-home-operations";
import { AdminArt } from "./admin-art";
import { AdminHomeSearch } from "./admin-search-context";
import styles from "./admin.module.css";
import home from "./admin-home.module.css";

export function AdminHome({
  seller,
  language = "en",
  unavailable = false,
  operations,
  children,
}: {
  seller?: SellerContext;
  language?: "bg" | "en";
  unavailable?: boolean;
  operations?: SellerOperationsView;
  children?: ReactNode;
}) {
  const bg = language === "bg";
  const base = seller ? `/app/sellers/${seller.sellerId}` : "/app";
  const products = seller ? `${base}/listings` : "/app/products";
  const canRead = !seller || seller.capabilities.includes("listing.read");
  const canWrite = !seller || seller.capabilities.includes("listing.write");
  const canProfile = seller?.capabilities.includes("profile.manage") === true;
  const create = !seller
    ? `/sell?lang=${language}`
    : canWrite
      ? `${products}/new?lang=${language}`
      : `${products}?lang=${language}`;
  const hasProducts =
    operations?.milestones.some(
      (item) => item.kind === "product" && item.complete,
    ) === true;
  const operational =
    !unavailable && !!seller && operations?.sellerId === seller.sellerId;
  return (
    <main className={`${styles.home} ${operational ? home.operational : ""}`}>
      {operational ? (
        <header className={home.heading}>
          <div>
            <p>{seller?.name}</p>
            <h1>{bg ? "Твоите продажби" : "Your selling overview"}</h1>
          </div>
          {canRead && (
            <Link
              className={canWrite ? styles.primary : styles.secondary}
              href={create}
            >
              {canWrite
                ? bg
                  ? "Добави продукт"
                  : "Add product"
                : bg
                  ? "Прегледай продуктите"
                  : "Review products"}
            </Link>
          )}
        </header>
      ) : (
        <h1 className={styles.welcome}>
          <span className={home.desktopWelcome}>
            {bg ? "Добре дошъл в Treido" : "Welcome to Treido"}
            <br />
            {seller
              ? seller.name
              : bg
                ? "Твоето място за продажби"
                : "Your selling workspace"}
          </span>
          <span className={home.phoneWelcome}>
            <span className={home.welcomeRow}>
              {bg ? "Добре дошъл!" : "Welcome!"}
            </span>
            {seller ? (
              <span className={home.setupRow}>
                <span className={home.sellerName} title={seller.name}>
                  {seller.name}
                </span>
              </span>
            ) : (
              <span className={home.welcomeRow}>
                {bg ? "Твоите продажби" : "Your workspace"}
              </span>
            )}
          </span>
        </h1>
      )}
      {canRead && (
        <div className={operational ? home.search : undefined}>
          <AdminHomeSearch language={language} />
        </div>
      )}
      {operational && operations && (
        <AdminHomeOperations view={operations} language={language} />
      )}
      <div className={`${styles.cards} ${operational ? home.shortcuts : ""}`}>
        {(canRead || unavailable) && (
          <article className={styles.card}>
            <div className={home.art}>
              <AdminArt kind="products" />
            </div>
            <div className={styles.cardContent}>
              <h2>
                {hasProducts
                  ? bg
                    ? "Продължи с продуктите си"
                    : "Continue with your products"
                  : bg
                    ? "Добави първия си продукт"
                    : "Add your first product"}
              </h2>
              <p>
                {bg
                  ? "Добави снимки, цена и описание. Запази чернова и я публикувай, когато си готов."
                  : "Add photos, a price and a description. Save a draft and publish when you are ready."}
              </p>
              <Link
                className={styles.primary}
                href={unavailable ? `/sell?lang=${language}` : create}
              >
                {unavailable
                  ? bg
                    ? "Подготви артикул"
                    : "Prepare an item"
                  : canWrite
                    ? bg
                      ? "Добави продукт"
                      : "Add product"
                    : bg
                      ? "Прегледай продуктите"
                      : "Review products"}
              </Link>
            </div>
          </article>
        )}
        {(canProfile || !seller) && (
          <article className={styles.card}>
            <div className={home.art}>
              <AdminArt kind="store" />
            </div>
            <div className={styles.cardContent}>
              <h2>
                {seller?.kind === "personal"
                  ? bg
                    ? "Твоят профил на продавач"
                    : "Your seller profile"
                  : seller
                    ? bg
                      ? "Представи бизнеса си"
                      : "Make your business yours"
                    : bg
                      ? "Лични или бизнес продажби"
                      : "Personal or business selling"}
              </h2>
              <p>
                {seller?.kind === "personal"
                  ? bg
                    ? "Продавай собствените си вещи. Поддържай публичното си име и населено място актуални."
                    : "Sell your own items. Keep your public name and locality up to date."
                  : seller
                    ? bg
                      ? "Добави информацията, която помага на купувачите да опознаят бизнеса ти."
                      : "Add the details that help buyers get to know your business."
                    : bg
                      ? "Продай личен артикул директно или създай отделен акаунт за бизнеса си."
                      : "Sell a personal item directly, or create a separate account for your business."}
              </p>
              <Link
                className={styles.secondary}
                href={
                  seller
                    ? `${base}/settings/store?lang=${language}`
                    : `/sell?lang=${language}`
                }
              >
                {seller
                  ? bg
                    ? "Редактирай профила"
                    : "Edit profile"
                  : bg
                    ? "Продай артикул"
                    : "Sell an item"}
              </Link>
            </div>
          </article>
        )}
        {canRead && (
          <article className={styles.card}>
            <div className={home.art}>
              <AdminArt kind="review" />
            </div>
            <div className={styles.cardContent}>
              <h2>{bg ? "Готов за публикуване?" : "Ready to publish?"}</h2>
              <p>
                {bg
                  ? "Прегледай снимките, категорията, цената и наличността, преди продуктът да стане видим за купувачите."
                  : "Review photos, category, price and stock before making a product visible to buyers."}
              </p>
              <Link
                className={styles.secondary}
                href={`${products}?lang=${language}`}
              >
                {bg ? "Прегледай продуктите" : "Review products"}
              </Link>
            </div>
          </article>
        )}
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
