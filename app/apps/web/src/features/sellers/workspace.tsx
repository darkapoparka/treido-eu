import Link from "next/link";
import styles from "./workspace.module.css";

export function Workspace({
  title,
  children,
  back,
  language = "en",
}: {
  title: string;
  children: React.ReactNode;
  back?: string;
  language?: "bg" | "en";
}) {
  return (
    <main lang={language} className={`account-page ${styles.page}`}>
      <header className={styles.header}>
        <Link href={back ?? `/app?lang=${language}`} className={styles.link}>
          {language === "bg" ? "Назад" : "Back"}
        </Link>
        <Link href={`/?lang=${language}`} className={styles.link}>
          Treido
        </Link>
      </header>
      <h1>{title}</h1>
      {children}
    </main>
  );
}

export function BackendUnavailable({
  language = "en",
}: {
  language?: "bg" | "en";
}) {
  return (
    <Workspace
      title={language === "bg" ? "Продажби" : "My selling"}
      back={`/sell?lang=${language}`}
      language={language}
    >
      <section className="account-panel" role="status">
        <h2>
          {language === "bg"
            ? "Продажбите в момента не са достъпни"
            : "Selling is currently unavailable"}
        </h2>
        <p>
          {language === "bg"
            ? "Опитайте отново по-късно. Запазените чернови не се променят."
            : "Try again later. Your saved drafts are unchanged."}
        </p>
      </section>
      <Link href={`/sell?lang=${language}`} className={styles.link}>
        {language === "bg" ? "Към подготовката на артикул" : "Prepare an item"}
      </Link>
    </Workspace>
  );
}
