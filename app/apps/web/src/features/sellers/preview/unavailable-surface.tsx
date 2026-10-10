"use client";
import { AdminIcon, type AdminIconName } from "../admin-icons";
import { usePreview } from "./context";
import { labels, type PreviewSection } from "./routes";
import { Action, Button, Header, Panel, s } from "./ui";
import { CapabilitySurface } from "./capability-surfaces";
import { LocalMenuBuilder } from "./local-menu-builder";
import { LocalBlogBuilder } from "./local-blog-builder";
import { LocalCompanyBuilder } from "./company-draft-editor";
import { CatalogDraftEditor } from "./catalog-draft-editor";
import { RolloutDraftEditor } from "./rollout-draft-editor";
import { ProcurementPages } from "./procurement-pages";
import { ProcurementDraftEditor } from "./procurement-draft-editor";
import { GiftCardDraftEditor } from "./gift-card-draft-editor";
import { GiftCardProductEditor } from "./gift-card-product-editor";

const capabilities: Record<
  string,
  { icon: AdminIconName; en: string; bg: string; related: string }
> = {
  payouts: {
    icon: "finance",
    en: "Payouts require a connected payment provider and a verified business account. This preview has no payout balance or schedule.",
    bg: "Изплащанията изискват свързан доставчик за плащания и потвърден бизнес акаунт. Този преглед няма баланс или график за изплащане.",
    related: "settings/payments",
  },
  "purchase-orders": {
    icon: "orders",
    en: "Supplier ordering requires a procurement adapter. No purchase orders or supplier payments are created in this preview.",
    bg: "Поръчките към доставчици изискват адаптер за снабдяване. Прегледът не създава поръчки или плащания към доставчици.",
    related: "inventory",
  },
  transfers: {
    icon: "orders",
    en: "Transfers require authorized locations and atomic stock allocation. Review local quantities in Inventory.",
    bg: "Трансферите изискват разрешени локации и атомарно разпределение на наличността. Прегледайте локалните количества в Наличности.",
    related: "inventory",
  },
  "gift-cards": {
    icon: "discount",
    en: "Gift cards require a verified payment and stored-value provider. This preview cannot issue or redeem gift cards.",
    bg: "Подаръчните карти изискват потвърден доставчик за плащания и парична стойност. Прегледът не издава и не приема подаръчни карти.",
    related: "discounts",
  },
  companies: {
    icon: "customers",
    en: "Business customer accounts require an authorized company adapter. The preview supports fictional individual customer profiles.",
    bg: "Бизнес клиентските акаунти изискват разрешен адаптер за компании. Прегледът поддържа примерни индивидуални клиентски профили.",
    related: "customers",
  },
  menus: {
    icon: "content",
    en: "Custom storefront navigation is not supported by the fixed preview template. Review the available pages and store appearance.",
    bg: "Персонална навигация не се поддържа от фиксирания шаблон на прегледа. Прегледайте страниците и изгледа на магазина.",
    related: "pages",
  },
  "blog-posts": {
    icon: "content",
    en: "The preview supports standalone pages. Blog publication requires a content adapter.",
    bg: "Прегледът поддържа отделни страници. Публикуването в блог изисква адаптер за съдържание.",
    related: "pages",
  },
  catalogs: {
    icon: "product",
    en: "Regional catalog publication requires a marketplace adapter. Review your local product catalog and markets.",
    bg: "Публикуването на регионални каталози изисква адаптер за пазара. Прегледайте локалния каталог и пазарите.",
    related: "products",
  },
  rollouts: {
    icon: "markets",
    en: "Scheduled market rollouts require a publishing adapter. Local market drafts can be reviewed without publishing.",
    bg: "Планираното пускане на пазари изисква адаптер за публикуване. Локалните чернови могат да се преглеждат без публикуване.",
    related: "markets",
  },
  live: {
    icon: "analytics",
    en: "Live visitors and location activity require verified telemetry. Preview reports use saved fictional orders only.",
    bg: "Посетителите и активността на живо изискват потвърдени измервания. Примерните отчети използват само запазени примерни поръчки.",
    related: "analytics",
  },
  attribution: {
    icon: "growth",
    en: "Campaign attribution requires verified traffic and order events. No attribution is calculated in this preview.",
    bg: "Приписването на кампании изисква потвърдени събития за трафик и поръчки. То не се изчислява в този преглед.",
    related: "growth",
  },
  autopilot: {
    icon: "growth",
    en: "Campaign automation requires connected delivery providers. You can prepare local campaign plans without sending anything.",
    bg: "Автоматизацията на кампании изисква свързани доставчици за изпращане. Можете да подготвяте локални планове, без да изпращате нищо.",
    related: "growth/campaigns",
  },
};
export function UnavailableSurface({
  section,
  detail,
}: {
  section: string;
  detail?: string;
}) {
  const { text, href } = usePreview();
  if (
    section === "purchase-orders" ||
    section === "transfers" ||
    section === "gift-cards"
  ) {
    if (!detail) return <ProcurementPages section={section} />;
    if (section === "gift-cards")
      if (detail === "product-new" || detail.startsWith("gift-product-"))
        return <GiftCardProductEditor key={detail} id={detail} />;
    if (section === "gift-cards")
      return <GiftCardDraftEditor key={detail} id={detail} />;
    return (
      <ProcurementDraftEditor key={detail} section={section} id={detail} />
    );
  }
  if (detail && section === "menus")
    return <LocalMenuBuilder key={detail} id={detail} />;
  if (detail && section === "blog-posts")
    return <LocalBlogBuilder key={detail} id={detail} />;
  if (detail && section === "companies")
    return <LocalCompanyBuilder key={detail} id={detail} />;
  if (detail && section === "catalogs")
    return <CatalogDraftEditor key={detail} id={detail} />;
  if (detail && section === "rollouts")
    return <RolloutDraftEditor key={detail} id={detail} />;
  const capability = capabilities[section];
  const title =
    labels[section as PreviewSection] ??
    (section === "attribution"
      ? ["Attribution", "Приписване"]
      : ["Autopilot", "Автопилот"]);
  if (
    [
      "companies",
      "menus",
      "blog-posts",
      "catalogs",
      "rollouts",
      "live",
      "attribution",
      "autopilot",
      "payouts",
    ].includes(section)
  )
    return (
      <CapabilitySurface
        section={section}
        title={text(title[0], title[1])}
        description={text(capability.en, capability.bg)}
        icon={capability.icon}
        related={capability.related}
      />
    );
  return (
    <main className={s.page} data-studio-part="page">
      <Header title={text(title[0], title[1])} icon={capability.icon} />
      <Panel part="unavailable-surface">
        <AdminIcon name={capability.icon} />
        <h2>
          {text(
            "Not connected in this preview",
            "Не е свързано в този преглед",
          )}
        </h2>
        <p>{text(capability.en, capability.bg)}</p>
        <Button disabled title={text(capability.en, capability.bg)}>
          {text("Set up", "Настройване")}
        </Button>
        <Action href={href(capability.related)}>
          {text("Review available tools", "Преглед на достъпните инструменти")}
        </Action>
      </Panel>
    </main>
  );
}
