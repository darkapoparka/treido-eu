import Link from "next/link";
import type { ReactNode } from "react";
import type { SellerContext } from "./persistence.server";
import type { SellerOperationsView } from "./operations-model";
import { SellerOperations } from "./operations";
import { AdminArt } from "./admin-art";
import { AdminHomeSearch } from "./admin-search-context";
import styles from "./admin.module.css";
import home from "./admin-home.module.css";

export function AdminHome({ seller, language = "en", unavailable = false, operations, children }: {
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
  const create = !seller ? `/sell?lang=${language}` : canWrite ? `${products}/new?lang=${language}` : `${products}?lang=${language}`;
  const hasProducts = operations?.milestones.some((item) => item.kind === "product" && item.complete) === true;
  return (
    <main className={styles.home}>
      <h1 className={styles.welcome}>
        <span className={home.desktopWelcome}>
          {bg ? "Добре дошъл в Treido" : "Welcome to Treido"}<br />
          {seller ? seller.name : bg ? "Твоето място за продажби" : "Your selling workspace"}
        </span>
        <span className={home.phoneWelcome}>
          <span className={home.welcomeRow}>{bg ? "Добре дошъл!" : "Welcome!"}</span>
          {seller ? <span className={home.setupRow}><span className={home.sellerName} title={seller.name}>{seller.name}</span></span> : <span className={home.welcomeRow}>{bg ? "Твоите продажби" : "Your workspace"}</span>}
        </span>
      </h1>
      {canRead && <AdminHomeSearch language={language} />}
      {!unavailable && operations?.sellerId === seller?.sellerId && operations && <SellerOperations view={operations} language={language} />}
      <div className={styles.cards}>
        {(canRead || unavailable) && <article className={styles.card}>
          <AdminArt kind="products" />
          <div className={styles.cardContent}>
            <h2>{hasProducts ? bg ? "Продължи с продуктите си" : "Continue with your products" : bg ? "Добави първия си продукт" : "Add your first product"}</h2>
            <p>{bg ? "Черновите, снимките и публикуваните версии се пазят отделно. Продължи от действително запазеното състояние." : "Drafts, photos and accepted publications stay separate. Continue from the actual saved state."}</p>
            <Link className={styles.primary} href={unavailable ? `/sell?lang=${language}` : create}>
              {unavailable ? bg ? "Подготви артикул" : "Prepare an item" : canWrite ? bg ? "Добави продукт" : "Add product" : bg ? "Прегледай продуктите" : "Review products"}
            </Link>
          </div>
        </article>}
        {(canProfile || !seller) && <article className={styles.card}>
          <AdminArt kind="store" />
          <div className={styles.cardContent}>
            <h2>{seller?.kind === "personal" ? bg ? "Твоят профил на продавач" : "Your seller profile" : seller ? bg ? "Представи бизнеса си" : "Make your business yours" : bg ? "Лични или бизнес продажби" : "Personal or business selling"}</h2>
            <p>{seller?.kind === "personal" ? bg ? "Продавай собствените си вещи без регистрация на бизнес. Поддържай публичното си име и населено място." : "Sell your own items without business setup. Keep your public name and locality up to date." : seller ? bg ? "Поддържай публичните данни и прегледай отделните изисквания за декларации." : "Maintain your public details and review the separate declaration requirements." : bg ? "Личните продажби започват директно с артикул. Бизнес акаунтът е отделен избор." : "Personal selling starts directly with an item. A business account is a separate choice."}</p>
            <Link className={styles.secondary} href={seller ? `${base}/settings/store?lang=${language}` : `/sell?lang=${language}`}>
              {seller ? bg ? "Редактирай профила" : "Edit profile" : bg ? "Продай артикул" : "Sell an item"}
            </Link>
          </div>
        </article>}
        {canRead && <article className={styles.card}>
          <AdminArt kind="review" />
          <div className={styles.cardContent}>
            <h2>{bg ? "Прегледай преди публикуване" : "Review before publication"}</h2>
            <p>{bg ? "Провери категорията, снимките, наличността и приетите условия. Платен план не замества разрешение или преглед." : "Check category, photos, availability and accepted terms. A paid plan never replaces permission or review."}</p>
            <Link className={styles.secondary} href={`${products}?lang=${language}`}>{bg ? "Прегледай продуктите" : "Review products"}</Link>
          </div>
        </article>}
      </div>
      {unavailable && <section className={styles.homeNotice} role="status">
        <h2>{bg ? "Продажбите в момента не са достъпни" : "Selling is currently unavailable"}</h2>
        <p>{bg ? "Опитай отново по-късно. Запазените ти чернови не се променят." : "Try again later. Your saved drafts are unchanged."}</p>
      </section>}
      {children}
    </main>
  );
}
