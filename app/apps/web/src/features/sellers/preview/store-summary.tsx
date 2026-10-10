"use client";
import Image from "next/image";
import { usePreview } from "./context";
import { money } from "./model";
import { Action, Badge, Button, Header, s } from "./ui";
import styles from "./store-summary.module.css";

export function StoreSummary({ onPreview }: { onPreview: () => void }) {
  const { store, href, text, language } = usePreview();
  const products = store.products
    .filter((product) => product.status === "Active")
    .slice(0, 4);
  return (
    <main className={`${s.page} ${styles.root}`} data-studio-part="page">
      <Header
        title={text("Online Store", "Онлайн магазин")}
        icon="store"
        actions={
          <Button onClick={onPreview}>
            {text("Preview store", "Преглед на магазина")}
          </Button>
        }
      />
      <section className={styles.card} data-studio-part="store-summary">
        <button
          type="button"
          className={styles.preview}
          data-studio-part="store-summary-preview"
          onClick={onPreview}
          aria-label={text(
            "Preview storefront appearance",
            "Преглед на изгледа на магазина",
          )}
        >
          <span className={styles.browserBar}>
            <span>● ● ●</span>
            <span>{store.settings.handle}.treido.eu</span>
          </span>
          <span
            className={styles.storeHeader}
            style={{ borderBottomColor: store.settings.accent }}
          >
            <strong>{store.settings.name}</strong>
            <span>
              {text("Shop", "Магазин")}　{text("About", "За нас")}
            </span>
          </span>
          <span className={styles.intro}>
            <strong>{store.settings.description || store.settings.name}</strong>
            <span>
              {text(
                "A preview of your store using local product records.",
                "Преглед на магазина с локалните продуктови записи.",
              )}
            </span>
          </span>
          <span className={styles.products}>
            {products.map((product) => (
              <span key={product.id}>
                {product.image ? (
                  <Image
                    src={product.image}
                    unoptimized
                    width={220}
                    height={160}
                    alt=""
                  />
                ) : (
                  <span className={styles.placeholder}>
                    {text("Product image", "Снимка на продукта")}
                  </span>
                )}
                <strong>{product.title}</strong>
                <span>{money(product.price, language)}</span>
              </span>
            ))}
          </span>
          {!products.length && (
            <span className={styles.noProducts}>
              {text("No active products yet", "Все още няма активни продукти")}
            </span>
          )}
        </button>
        <div className={styles.footer}>
          <div>
            <h2>{store.settings.handle}.treido.eu</h2>
            <p>
              {text(
                "Treido storefront · device-local appearance",
                "Магазин Treido · локален изглед",
              )}
            </p>
            <Badge>{text("Frontend preview", "Преглед на интерфейса")}</Badge>
          </div>
          <Action primary href={href("store/appearance")}>
            {text("Edit appearance", "Редактиране на изгледа")}
          </Action>
        </div>
      </section>
      <div className={styles.lower} data-studio-part="store-summary-options">
        <h2>{text("Store preferences", "Предпочитания на магазина")}</h2>
        <p>
          {text(
            "Review branding, products, and storefront content before connecting a real store.",
            "Прегледайте брандирането, продуктите и съдържанието преди свързването на реален магазин.",
          )}
        </p>
        <div>
          <Action href={href("products")}>
            {text("Products", "Продукти")}
          </Action>
          <Action href={href("pages")}>{text("Pages", "Страници")}</Action>
          <Action href={href("settings/domains")}>
            {text("Domain preferences", "Предпочитания за домейна")}
          </Action>
        </div>
      </div>
    </main>
  );
}
