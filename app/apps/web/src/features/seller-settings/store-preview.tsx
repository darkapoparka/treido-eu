import "server-only";
import Link from "next/link";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { PublicServiceInfo } from "./public-info";
import messages from "./messages.json";
import {
  storePreviewPaths,
  type SavedStorePreview,
} from "./store-preview-model";
import a from "../sellers/admin.module.css";
import s from "../team/team.module.css";
import buyer from "../discovery/marketplace.module.css";

export async function SavedBusinessStorePreview({
  view,
  language,
}: {
  view: SavedStorePreview;
  language: "bg" | "en";
}) {
  const t = await getTranslations({
    locale: language,
    namespace: "sellerSettings",
  });
  const paths = storePreviewPaths(view.sellerId, language);
  return (
    <main>
      <header className={a.pageBar}>
        <h1>{t("savedStorePreviewTitle")}</h1>
        <Link className={a.secondary} href={paths.settings} prefetch={false}>
          {t("backToStoreSettings")}
        </Link>
      </header>
      <div className={a.pageBody}>
        <div className={s.stack}>
          <section className={s.card}>
            <p>{t("savedStorePreviewNotice")}</p>
          </section>
          <section className={s.card} aria-label={t("profileOnly")}>
            <div className={buyer.sellerHeader}>
              <span
                className={"store-logo-fallback " + buyer.monogram}
                aria-hidden="true"
              >
                {Array.from(view.name)[0]}
              </span>
              <h2>{view.name}</h2>
              <p>
                {t("previewBusiness")}
                {view.locality ? " · " + view.locality : ""}
              </p>
              {view.description && (
                <p className={buyer.description}>{view.description}</p>
              )}
            </div>
            {view.services.contact || view.services.delivery ? (
              <NextIntlClientProvider
                locale={language}
                messages={{ sellerSettings: messages[language] }}
              >
                <PublicServiceInfo services={view.services} />
              </NextIntlClientProvider>
            ) : (
              <p className={s.muted}>{t("previewNoPublicServices")}</p>
            )}
          </section>
          <section className={s.card}>
            <p>
              {t(
                view.publicStoreAvailable
                  ? "previewEligibleInventory"
                  : "previewEmptyInventory",
              )}
            </p>
            {view.publicStoreAvailable && (
              <Link
                className={a.secondary}
                href={paths.publicStore}
                prefetch={false}
              >
                {t("openStore")}
              </Link>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

export async function StorePreviewUnavailable({
  sellerId,
  language,
}: {
  sellerId: string;
  language: "bg" | "en";
}) {
  const t = await getTranslations({
    locale: language,
    namespace: "sellerSettings",
  });
  const paths = storePreviewPaths(sellerId, language);
  return (
    <main>
      <header className={a.pageBar}>
        <h1>{t("savedStorePreviewTitle")}</h1>
      </header>
      <div className={a.pageBody}>
        <section className={s.card}>
          <p role="status">{t("previewUnavailable")}</p>
          <div className={s.actions}>
            <form method="get" action={paths.preview}>
              <input type="hidden" name="lang" value={language} />
              <button className={a.secondary} type="submit">
                {t("previewRetry")}
              </button>
            </form>
            <Link
              className={a.secondary}
              href={paths.settings}
              prefetch={false}
            >
              {t("backToStoreSettings")}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
