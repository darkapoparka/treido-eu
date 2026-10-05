import "server-only";
import Link from "next/link";
import { pageLocale } from "../locale/page-locale.server";
import { backendConfigured } from "../sellers/backend-status.server";
import { ShopSurface } from "../discovery/hydration-boundary";
import { sellerEntryCopy } from "./copy";
import { parseSellerEntry, sellerEntryHref } from "./model";
import { SellerTemplateControls } from "./template-controls";
import { SellerCsvPreflight } from "./preflight-controls";
import s from "../selling/selling.module.css";

export async function SellerEntryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const parsed = parseSellerEntry(params);
  const language = parsed?.language ?? (await pageLocale(params.lang));
  const t = sellerEntryCopy[language];
  const kind = parsed?.kind ?? null;
  const online = backendConfigured();
  return (
    <ShopSurface className={`account-page ${s.page}`}>
      <header className={s.toolbar}>
        <Link className={s.textButton} href={`/?lang=${language}`}>
          {t.home}
        </Link>
        <Link
          className={s.textButton}
          href={sellerEntryHref(kind, language === "bg" ? "en" : "bg")}
          hrefLang={language === "bg" ? "en" : "bg"}
        >
          {language === "bg" ? "English" : "Български"}
        </Link>
      </header>
      <h1>
        {kind === "business"
          ? t.business
          : kind === "personal"
            ? t.personal
            : t.title}
      </h1>
      <p className={s.intro}>{t.intro}</p>
      {!parsed && <p role="alert">{t.invalid}</p>}
      {!online && <p role="status">{t.unavailable}</p>}
      {kind === null ? (
        <section className="account-panel" aria-label={t.choose}>
          <h2>{t.choose}</h2>
          <h3>{t.personal}</h3>
          <p>{t.personalNote}</p>
          <Link
            className={s.textButton}
            href={sellerEntryHref("personal", language)}
          >
            {t.readPersonal}
          </Link>
          <h3>{t.business}</h3>
          <p>{t.businessNote}</p>
          <Link
            className={s.textButton}
            href={sellerEntryHref("business", language)}
          >
            {t.readBusiness}
          </Link>
        </section>
      ) : (
        <>
          <ol>
            {kind === "business" && (
              <li>
                <h2>{t.accountTitle}</h2>
                <p>{t.accountNote}</p>
              </li>
            )}
            <li>
              <h2>{t.goodsTitle}</h2>
              <p>{t.goodsNote}</p>
            </li>
            <li>
              <h2>{t.mediaTitle}</h2>
              <p>{t.mediaNote}</p>
            </li>
            <li>
              <h2>{t.stockTitle}</h2>
              <p>{t.stockNote}</p>
            </li>
            <li>
              <h2>{t.serviceTitle}</h2>
              <p>{t.serviceNote}</p>
            </li>
            <li>
              <h2>{t.reviewTitle}</h2>
              <p>{t.reviewNote}</p>
            </li>
          </ol>
          {kind === "business" && (
            <section className="account-panel">
              <h2>{t.templatesTitle}</h2>
              <p>{t.templatesNote}</p>
              <SellerTemplateControls language={language} />
              <p>{t.importNote}</p>
              <p>{t.businessSession}</p>
              <SellerCsvPreflight language={language} />
            </section>
          )}
          <section className="account-panel">
            <h2>{t.commercialTitle}</h2>
            <p>{t.commercialNote}</p>
            <p>{t.paymentNote}</p>
          </section>
          {online && (
            <Link
              className={s.textButton}
              href={
                kind === "business"
                  ? `/sell?intent=business&lang=${language}`
                  : `/sell?lang=${language}`
              }
            >
              {kind === "business" ? t.startBusiness : t.startPersonal}
            </Link>
          )}
          <p>
            <Link href={sellerEntryHref(null, language)}>{t.back}</Link>
          </p>
        </>
      )}
      <p>{t.choicesNote}</p>
      <p>
        <Link href={"/support?lang=" + language}>
          {language === "bg"
            ? "Помощ за продажби и акаунта"
            : "Selling and account help"}
        </Link>
      </p>
      {online && <Link href={`/app?lang=${language}`}>{t.chooseSeller}</Link>}
    </ShopSurface>
  );
}
