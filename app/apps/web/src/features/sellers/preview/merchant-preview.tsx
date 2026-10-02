"use client";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "../admin-shell";
import { AdminArt } from "../admin-art";
import { AdminIcon, type AdminIconName } from "../admin-icons";
import admin from "../admin.module.css";
import { PreviewProvider, usePreview } from "./context";
import {
  labels,
  type PreviewRoute,
  type PreviewSection,
  type SettingsSection,
} from "./routes";
import { Products, Inventory, Imports } from "./products";
import { Orders } from "./orders";
import { Customers, Segments } from "./customers";
import { Discounts, Growth } from "./marketing";
import { Content, Markets } from "./content";
import { Analytics, Finance } from "./analytics";
import { Inbox, Store, Team, Notifications } from "./workspace";
import { Settings } from "./settings";
import { WorkspaceLinks } from "./workspace-links";
import { PreviewSearch } from "./search";
import { StudioMiniProvider } from "./studio-mini";
import { StudioMiniComposer, StudioMiniLauncher } from "./studio-mini-composer";
import { Button, Confirm, s } from "./ui";
export function MerchantPreview({
  route,
  storeId,
  language,
  search,
}: {
  route: PreviewRoute;
  storeId: "studio" | "personal";
  language: "en" | "bg";
  search: string;
}) {
  return (
    <PreviewProvider storeId={storeId} language={language}>
      <Workspace route={route} search={search} />
    </PreviewProvider>
  );
}
function Workspace({ route, search }: { route: PreviewRoute; search: string }) {
  const ui = useTranslations("merchantUI");
  const { store, storeId, ready, language, notice, notify, largeText } =
    usePreview();
  const key = `${storeId}/${route.section}/${route.detail ?? ""}`;
  return (
    <div
      className={`${s.root} ${largeText ? s.largeText : ""}`}
      lang={language}
    >
      {route.section === "store" && route.detail === "preview" ? (
        ready ? (
          <Store key={key} standalone />
        ) : (
          <main className={s.page} aria-busy="true">
            {ui("loadingPreview")}
          </main>
        )
      ) : (
        <StudioMiniProvider key={storeId}>
          {route.section === "settings" ? (
            ready ? (
              <Settings
                key={key}
                section={(route.detail ?? "general") as SettingsSection}
              />
            ) : (
              <div className={s.page}>{ui("loadingPreview")}</div>
            )
          ) : (
            <AdminShell
              sellers={[]}
              preview={{
                storeId,
                name: store.settings.name,
                navigation: <Navigation section={route.section} />,
                Search: PreviewSearch,
                AssistantButton: <StudioMiniLauncher phone />,
              }}
            >
              {ready ? (
                <Screen key={key} route={route} search={search} />
              ) : (
                <main className={s.page} aria-busy="true">
                  {ui("loadingPreview")}
                </main>
              )}
            </AdminShell>
          )}
        </StudioMiniProvider>
      )}
      <PreviewTools route={route} search={search} />
      {notice && (
        <div className={s.toast} role="status">
          <span>{notice}</span>
          <button
            type="button"
            aria-label={ui("dismissNotification")}
            onClick={() => notify("")}
            data-ui-label="dismissNotification"
          >
            <AdminIcon name="close" />
          </button>
        </div>
      )}
    </div>
  );
}
function Screen({ route, search }: { route: PreviewRoute; search: string }) {
  const { section, detail } = route;
  switch (section) {
    case "home":
      return <Home />;
    case "products":
      return <Products detail={detail} search={search} />;
    case "inventory":
      return <Inventory />;
    case "imports":
      return <Imports />;
    case "orders":
      return <Orders detail={detail} />;
    case "drafts":
      return <Orders detail={detail} drafts />;
    case "customers":
      return <Customers detail={detail} />;
    case "segments":
      return <Segments detail={detail} />;
    case "growth":
      return <Growth detail={detail} />;
    case "discounts":
      return <Discounts detail={detail} />;
    case "content":
    case "files":
    case "pages":
    case "collections":
      return <Content section={section} detail={detail} />;
    case "markets":
      return <Markets detail={detail} />;
    case "finance":
    case "payouts":
    case "billing":
      return <Finance section={section} />;
    case "analytics":
      return <Analytics />;
    case "reports":
      return <Analytics reports detail={detail} />;
    case "inbox":
      return <Inbox detail={detail} />;
    case "store":
      return <Store />;
    case "team":
      return <Team />;
    case "notifications":
      return <Notifications />;
    default:
      return null;
  }
}
function Navigation({ section }: { section: PreviewSection }) {
  const { href, text } = usePreview();
  const groups: {
    section: PreviewSection;
    icon: AdminIconName;
    children?: PreviewSection[];
  }[] = [
    { section: "home", icon: "home" },
    { section: "orders", icon: "orders", children: ["drafts"] },
    {
      section: "products",
      icon: "product",
      children: ["collections", "inventory", "imports"],
    },
    { section: "customers", icon: "customers", children: ["segments"] },
    { section: "growth", icon: "growth" },
    { section: "discounts", icon: "discount" },
    { section: "content", icon: "content", children: ["files", "pages"] },
    { section: "markets", icon: "markets" },
    { section: "finance", icon: "finance", children: ["payouts", "billing"] },
    { section: "analytics", icon: "analytics", children: ["reports"] },
  ];
  return (
    <>
      <WorkspaceLinks />
      {groups.map((g) => {
        const active = section === g.section || g.children?.includes(section);
        return (
          <div className={s.navGroup} key={g.section}>
            <Link
              href={href(g.section)}
              aria-label={text(...labels[g.section])}
              aria-current={section === g.section ? "page" : undefined}
            >
              <AdminIcon name={g.icon} />
              <span>{text(...labels[g.section])}</span>
            </Link>
            {active && g.children && (
              <div className={s.subnav}>
                {g.children.map((child) => (
                  <Link
                    key={child}
                    href={href(child)}
                    aria-label={text(...labels[child])}
                    aria-current={section === child ? "page" : undefined}
                  >
                    {text(...labels[child])}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <p className={admin.navHeading}>
        {text("Sales channels", "Канали за продажба")}
      </p>
      <Link
        href={href("store")}
        aria-label={text("Online store", "Магазин")}
        aria-current={section === "store" ? "page" : undefined}
      >
        <AdminIcon name="store" />
        <span>{text("Online store", "Магазин")}</span>
      </Link>
      <p className={admin.navHeading}>{text("Apps", "Приложения")}</p>
      <Link
        href={href("inbox")}
        aria-label={text("Inbox", "Съобщения")}
        aria-current={section === "inbox" ? "page" : undefined}
      >
        <AdminIcon name="inbox" />
        <span>{text("Inbox", "Съобщения")}</span>
      </Link>
      <Link
        href={href("team")}
        aria-label={text("Team", "Екип")}
        aria-current={section === "team" ? "page" : undefined}
      >
        <AdminIcon name="customers" />
        <span>{text("Team", "Екип")}</span>
      </Link>
    </>
  );
}
function Home() {
  const { store, href, text, largeText, update } = usePreview();
  const dismissed = (store.settings.previewHiddenHomeCards ?? "")
    .split(",")
    .filter(Boolean);
  return (
    <>
      <div className={`${s.homePlanBar} ${largeText ? s.homePlanLarge : ""}`}>
        <div className={s.homePlan}>
          <span>
            <i aria-hidden="true" />
            <span className={s.homeFullCopy}>
              {text("Grow with Treido", "Развивай се с Treido")}
            </span>
            <span className={s.homeCompactCopy}>
              {text("Treido plans", "Планове за Treido")}
            </span>
          </span>
          <Link href={href("settings/plan")}>
            {text("Select a plan", "Избери план")}
          </Link>
        </div>
      </div>
      <main className={admin.home}>
        <h1 className={`${admin.welcome} ${s.homeWelcome}`}>
          <span className={s.homeWelcomeRow}>
            <span className={s.homeFullCopy}>
              {text("Welcome to Treido", "Добре дошъл в Treido")}
            </span>
            <span className={s.homeCompactCopy}>
              {text("Welcome!", "Добре дошъл!")}
            </span>
          </span>
          <span className={`${s.homeWelcomeRow} ${s.homeSetupLine}`}>
            <span className={s.homeFullCopy}>
              {text("Let’s set up ", "Да подготвим ")}
            </span>
            <span className={s.homeCompactCopy}>
              {text("Set up ", "Настрой ")}
            </span>
            <Link
              className={s.homeStoreName}
              href={href("store")}
              title={store.settings.name}
            >
              {store.settings.name}
            </Link>
          </span>
        </h1>
        <StudioMiniComposer home />
        <div className={admin.cards}>
          {(
            [
              {
                kind: "products",
                title: text(
                  "Add your first product",
                  "Добави първия си продукт",
                ),
                body: text(
                  "Start with a draft. Add a title, photos and a price when you're ready.",
                  "Започни с чернова. Добави заглавие, снимки и цена, когато си готов.",
                ),
                action: text("Add product", "Добави продукт"),
                to: "products/new",
              },
              {
                kind: "store",
                title: text("Make your business yours", "Представи бизнеса си"),
                body: text(
                  "Set up your public business details. Save your progress and come back anytime.",
                  "Попълни публичните данни на бизнеса. Запази напредъка си и продължи по-късно.",
                ),
                action: text("Continue setup", "Продължи настройката"),
                to: "store",
              },
              {
                kind: "review",
                title: text(
                  "Get ready for your first sale",
                  "Подготви се за първата продажба",
                ),
                body: text(
                  "Review your saved products and check what's needed before publication.",
                  "Прегледай запазените продукти и стъпките преди публикуване.",
                ),
                action: text("Review products", "Прегледай продуктите"),
                to: "products",
              },
              {
                kind: "profile",
                title: text(
                  "Complete your store details",
                  "Попълни данните на магазина",
                ),
                body: text(
                  "Add the contact and business details customers need to know.",
                  "Добави контактите и бизнес данните, нужни на клиентите.",
                ),
                action: text("Review details", "Прегледай данните"),
                to: "settings/general",
              },
              {
                kind: "shipping",
                title: text("Review delivery options", "Прегледай доставката"),
                body: text(
                  "Set up your shipping and local pickup preferences for this store.",
                  "Настрой предпочитанията за доставка и лично получаване.",
                ),
                action: text("Review delivery", "Прегледай доставката"),
                to: "settings/shipping",
              },
              {
                kind: "markets",
                title: text(
                  "Choose your selling markets",
                  "Избери пазарите си",
                ),
                body: text(
                  "Review countries, currencies and the markets you want to serve.",
                  "Прегледай държавите, валутите и пазарите, на които ще продаваш.",
                ),
                action: text("Review markets", "Прегледай пазарите"),
                to: "markets",
              },
              {
                kind: "policies",
                title: text(
                  "Prepare your store policies",
                  "Подготви правилата на магазина",
                ),
                body: text(
                  "Review your return, privacy and sales terms before opening your store.",
                  "Прегледай правилата за връщане, поверителност и продажби.",
                ),
                action: text("Review policies", "Прегледай правилата"),
                to: "settings/policies",
              },
            ] as const
          )
            .filter((card) => !dismissed.includes(card.kind))
            .map((card) => (
              <article
                className={`${admin.card} ${s.previewHomeCard}`}
                key={card.kind}
                data-home-card={card.kind}
              >
                <AdminArt kind={card.kind} />
                <div className={admin.cardContent}>
                  <h2>{card.title}</h2>
                  <p>{card.body}</p>
                  <Link
                    className={
                      card.kind === "products" ? admin.primary : admin.secondary
                    }
                    href={href(card.to)}
                  >
                    {card.action}
                  </Link>
                </div>
                <button
                  type="button"
                  className={s.dismissHomeCard}
                  aria-label={`${text("Dismiss", "Скрий")}: ${card.title}`}
                  onClick={() =>
                    update({
                      settings: {
                        ...store.settings,
                        previewHiddenHomeCards: [...dismissed, card.kind].join(
                          ",",
                        ),
                      },
                    })
                  }
                >
                  <AdminIcon name="close" />
                </button>
              </article>
            ))}
        </div>
        {dismissed.length > 0 && (
          <button
            type="button"
            className={s.restoreHomeCards}
            onClick={() =>
              update({
                settings: { ...store.settings, previewHiddenHomeCards: "" },
              })
            }
          >
            {text("Restore setup cards", "Възстанови картите за настройка")}
          </button>
        )}
      </main>
    </>
  );
}
function PreviewTools({
  route,
  search,
}: {
  route: PreviewRoute;
  search: string;
}) {
  const ui = useTranslations("merchantUI");
  const { reset, text, href, largeText, setLargeText } = usePreview();
  const [mode, setMode] = useState<"example" | "empty" | null>(null);
  const router = useRouter();
  const destination =
    route.section === "home"
      ? "home"
      : `${route.section}${route.detail ? `/${route.detail}` : ""}`;
  const languageHref =
    href(destination) + (search ? `&q=${encodeURIComponent(search)}` : "");
  return (
    <>
      <details className={s.previewTools}>
        <summary>{text("Frontend preview", "Преглед на интерфейса")}</summary>
        <div className={s.previewPopover}>
          <strong>{ui("deviceLocalPreview")}</strong>
          <p className={s.muted}>
            {ui("tryEveryScreenWithFictionalDataSavesStayInThis")}
          </p>
          <Button onClick={() => setMode("example")}>
            {ui("loadExampleStore")}
          </Button>
          <Button onClick={() => setMode("empty")}>
            {ui("resetToEmptyStore")}
          </Button>
          <label className={s.check}>
            <input
              type="checkbox"
              checked={largeText}
              onChange={(e) => setLargeText(e.target.checked)}
            />
            <span>{ui("reviewWithDoubledText")}</span>
          </label>
          <Link
            className={s.link}
            href={languageHref.replace("lang=en", "lang=bg")}
          >
            Български
          </Link>
          <Link
            className={s.link}
            href={languageHref.replace("lang=bg", "lang=en")}
          >
            English
          </Link>
        </div>
      </details>
      {mode && (
        <Confirm
          title={
            mode === "example"
              ? ui("loadExampleStore_17795e")
              : ui("resetFrontendPreview")
          }
          body={ui("thisReplacesTheLocalPreviewForBothFictionalSellerAccounts")}
          action={mode === "example" ? ui("loadExamples") : ui("resetPreview")}
          onClose={() => setMode(null)}
          onConfirm={() => {
            reset(mode === "example");
            router.push(href());
          }}
        />
      )}
    </>
  );
}
