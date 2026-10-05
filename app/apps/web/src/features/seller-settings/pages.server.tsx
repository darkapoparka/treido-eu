import "server-only";
import type messages from "./messages.json";
type SettingsMessageKey = keyof typeof messages.en;
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { getTranslations } from "next-intl/server";
import { pageLocale } from "../locale/page-locale.server";
import { backendConfigured } from "../sellers/backend-status.server";
import { BackendUnavailable } from "../sellers/workspace";
import {
  requirePageIdentity,
  readPrivatePage,
} from "../sellers/page-context.server";
import { readSellerContext } from "../sellers/persistence.server";
import { readSellerSetup } from "../sellers/setup.server";
import { BusinessSetupForm } from "../sellers/setup-form";
import { getDatabase } from "../../server/db/database";
import { readServiceSettings } from "./persistence.server";
import { ServiceSettingsForm } from "./form";
import { PersonalProfileForm } from "./personal-profile-form";
import { readPersonalProfile } from "./personal-profile.server";
import type { ServiceSection } from "./model";
import a from "../sellers/admin.module.css";
import s from "../team/team.module.css";
export type SettingsPageProps = {
  params: Promise<{ sellerId: string }>;
  searchParams: Promise<{ lang?: string }>;
};
async function context(props: SettingsPageProps, path: string) {
  const { sellerId } = await props.params;
  const language = await pageLocale((await props.searchParams).lang);
  const identity = await requirePageIdentity(
    "/app/sellers/" + sellerId + "/settings" + path + "?lang=" + language,
  );
  return { sellerId, language, identity };
}
export async function SettingsHome(props: SettingsPageProps) {
  if (!backendConfigured())
    return (
      <BackendUnavailable
        language={await pageLocale((await props.searchParams).lang)}
      />
    );
  const { sellerId, language, identity } = await context(props, "");
  const seller = await readPrivatePage(() =>
    readSellerContext(getDatabase(), identity, sellerId),
  );
  const t = await getTranslations({
      locale: language,
      namespace: "sellerSettings",
    }),
    base = "/app/sellers/" + sellerId;
  const cards: {
    href: string;
    title: SettingsMessageKey;
    note: SettingsMessageKey;
  }[] = [
    ...(seller.capabilities.includes("billing.manage")
      ? [
          {
            href: base + "/settings/payments",
            title: "payments" as const,
            note: "paymentsNote" as const,
          },
        ]
      : []),
    ...(seller.capabilities.includes("profile.manage")
      ? [
          {
            href: base + "/settings/store",
            title:
              seller.kind === "personal"
                ? ("personalProfile" as const)
                : ("store" as const),
            note:
              seller.kind === "personal"
                ? ("personalProfileNote" as const)
                : ("storeNote" as const),
          },
        ]
      : []),
    ...(seller.capabilities.includes("profile.manage")
      ? [
          {
            href: base + "/settings/contact",
            title: "contact" as const,
            note: "contactNote" as const,
          },
        ]
      : []),
    ...(seller.capabilities.includes("delivery.manage")
      ? [
          {
            href: base + "/settings/delivery",
            title: "delivery" as const,
            note: "deliveryDescription" as const,
          },
        ]
      : []),
    ...(seller.kind === "business" &&
    seller.capabilities.includes("declaration.manage")
      ? [
          {
            href: base + "/onboarding?step=declaration",
            title: "declaration" as const,
            note: "declarationNote" as const,
          },
        ]
      : []),
    ...(seller.kind === "business" &&
    seller.capabilities.includes("team.manage")
      ? [
          {
            href: base + "/team",
            title: "team" as const,
            note: "teamNote" as const,
          },
        ]
      : []),
  ];
  return (
    <main>
      <header className={a.pageBar}>
        <h1>{t("title")}</h1>
      </header>
      <div className={a.pageBody}>
        <div className={s.stack}>
          <section className={s.card}>
            <h2>{seller.name}</h2>
            <p>{t("privateNote")}</p>
          </section>
          <div className={s.links}>
            {cards.map((card) => (
              <Link
                className={s.card}
                key={card.title}
                href={
                  card.href +
                  (card.href.includes("?") ? "&" : "?") +
                  "lang=" +
                  language
                }
              >
                <h2>{t(card.title)}</h2>
                <p className={s.muted}>{t(card.note)}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
export async function StoreSettings(props: SettingsPageProps) {
  if (!backendConfigured())
    return (
      <BackendUnavailable
        language={await pageLocale((await props.searchParams).lang)}
      />
    );
  const { sellerId, language, identity } = await context(props, "/store");
  const seller = await readPrivatePage(() =>
    readSellerContext(getDatabase(), identity, sellerId, "profile.manage"),
  );
  if (seller.kind === "personal") {
    const initial = await readPrivatePage(() =>
      readPersonalProfile(getDatabase(), identity, sellerId),
    );
    return (
      <PersonalProfileForm
        key={sellerId + "/" + identity.subject}
        initial={initial}
        actorSubject={identity.subject}
        language={language}
      />
    );
  }
  const initial = await readPrivatePage(() =>
    readSellerSetup(getDatabase(), identity, sellerId),
  );
  const t = await getTranslations({
    locale: language,
    namespace: "sellerSettings",
  });
  return (
    <main>
      <header className={a.pageBar}>
        <h1>{t("store")}</h1>
        <Link
          className={a.secondary}
          href={"/app/sellers/" + sellerId + "/settings?lang=" + language}
        >
          {t("back")}
        </Link>
      </header>
      <div className={a.pageBody}>
        <section className={s.card}>
          <h2>{t("profileOnly")}</h2>
          <BusinessSetupForm
            key={sellerId + "/" + identity.subject}
            initial={{ ...initial, declaration: null }}
            section="details"
            stayOnPage
            requestId={randomUUID()}
            actorSubject={identity.subject}
            language={language}
          />
        </section>
        <section className={s.card}>
          <p>{t("savedStorePreviewNote")}</p>
          <Link
            className={a.secondary}
            href={
              "/app/sellers/" +
              sellerId +
              "/settings/store/preview?lang=" +
              language
            }
            prefetch={false}
          >
            {t("savedStorePreview")}
          </Link>
          <p>{t("storeAvailability")}</p>
          <Link
            className={a.secondary}
            href={"/stores/" + sellerId + "?lang=" + language}
          >
            {t("openStore")}
          </Link>
        </section>
      </div>
    </main>
  );
}
export async function ServiceSettingsPage(
  props: SettingsPageProps & { section: ServiceSection },
) {
  if (!backendConfigured())
    return (
      <BackendUnavailable
        language={await pageLocale((await props.searchParams).lang)}
      />
    );
  const { sellerId, language, identity } = await context(
    props,
    "/" + props.section,
  );
  const initial = await readPrivatePage(() =>
    readServiceSettings(getDatabase(), identity, sellerId, props.section),
  );
  return (
    <ServiceSettingsForm
      key={sellerId + "/" + identity.subject + "/" + props.section}
      initial={initial}
      actorSubject={identity.subject}
      language={language}
    />
  );
}
