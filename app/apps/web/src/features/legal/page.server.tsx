import "server-only";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { pageLocale } from "../locale/page-locale.server";
import { legalDocuments, type LegalKind } from "./documents";
import { legalReviewAllowed } from "./review-policy";
import s from "../selling/selling.module.css";

export type LegalPageProps = {
  searchParams: Promise<{
    lang?: string | string[];
    review?: string | string[];
  }>;
};
const copy = {
  en: {
    home: "Home",
    draft: "Draft for review — not approved or published",
    intro:
      "This local review is not an accepted privacy notice or agreement. Decisions below must be resolved before publication.",
    pending: "Requires review",
  },
  bg: {
    home: "Начало",
    draft: "Проект за преглед — не е одобрен или публикуван",
    intro:
      "Този локален преглед не е прието уведомление или споразумение. Решенията по-долу трябва да се уточнят преди публикуване.",
    pending: "Изисква преглед",
  },
} as const;

export async function LegalPage({
  kind,
  searchParams,
}: LegalPageProps & { kind: LegalKind }) {
  const query = await searchParams;
  const requestHeaders = await headers();
  if (
    !legalReviewAllowed(query.review, requestHeaders.get("host"), process.env)
  )
    notFound();
  const language = await pageLocale(query.lang);
  const document = legalDocuments[language][kind];
  const t = copy[language];
  const other = kind === "privacy" ? "terms" : "privacy";
  const reviewHref = (route: LegalKind, lang = language) =>
    `/${route}?lang=${lang}&review=1`;
  // Reuse Support's buyer composition. Plain server links remain usable without
  // client hydration; no catalogue, account or provider reads are needed here.
  return (
    <main
      className={"account-page " + s.page}
      lang={language}
      data-legal-review={document.status}
    >
      <header className={s.toolbar}>
        <Link className={s.textButton} href={`/?lang=${language}`}>
          {t.home}
        </Link>
        <Link
          className={s.textButton}
          href={reviewHref(kind, language === "en" ? "bg" : "en")}
        >
          {language === "en" ? "Български" : "English"}
        </Link>
      </header>
      <h1>{document.title}</h1>
      <p role="status" className={s.intro}>
        <strong>{t.draft}</strong>
      </p>
      <p className={s.intro}>{t.intro}</p>
      {document.sections.map((section) => (
        <section className="account-panel" key={section.title}>
          <h2>{section.title}</h2>
          {section.paragraphs.map((paragraph) => (
            <p className={s.intro} key={paragraph}>
              {paragraph}
            </p>
          ))}
          <p className={s.intro}>
            <strong>{t.pending}: </strong>
            {section.pending}
          </p>
        </section>
      ))}
      <Link className={s.textButton} href={reviewHref(other)}>
        {legalDocuments[language][other].title}
      </Link>
    </main>
  );
}
