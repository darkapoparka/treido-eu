"use client";
import Link from "next/link";
import { AdminIcon, type AdminIconName } from "../admin-icons";
import admin from "../admin.module.css";
import { usePreview } from "./context";
import { labels, type PreviewSection } from "./routes";
import { WorkspaceLinks } from "./workspace-links";
import { s } from "./ui";
export function PreviewNavigation({
  section,
  detail,
}: {
  section: PreviewSection;
  detail?: string;
}) {
  const { href, text } = usePreview();
  const groups: {
    section: PreviewSection;
    icon: AdminIconName;
    children?: string[];
  }[] = [
    { section: "home", icon: "home" },
    { section: "orders", icon: "orders", children: ["drafts"] },
    {
      section: "products",
      icon: "product",
      children: [
        "collections",
        "inventory",
        "purchase-orders",
        "transfers",
        "gift-cards",
        "imports",
      ],
    },
    {
      section: "customers",
      icon: "customers",
      children: ["segments", "companies"],
    },
    {
      section: "growth",
      icon: "growth",
      children: ["growth/attribution", "growth/autopilot", "growth/campaigns"],
    },
    { section: "discounts", icon: "discount" },
    {
      section: "content",
      icon: "content",
      children: ["content", "files", "menus", "blog-posts"],
    },
    { section: "markets", icon: "markets", children: ["catalogs", "rollouts"] },
    { section: "finance", icon: "finance", children: ["payouts"] },
    { section: "analytics", icon: "analytics", children: ["reports", "live"] },
  ];
  return (
    <>
      <div data-studio-part="navigation-exits">
        <WorkspaceLinks />
      </div>
      {groups.map((g) => {
        const active = section === g.section || g.children?.includes(section);
        return (
          <div
            className={s.navGroup}
            data-studio-part="nav-group"
            key={g.section}
          >
            <Link
              href={href(g.section)}
              aria-label={text(...labels[g.section])}
              aria-current={section === g.section ? "page" : undefined}
            >
              <AdminIcon name={g.icon} />
              <span>{text(...labels[g.section])}</span>
            </Link>
            {active && g.children && (
              <div className={s.subnav} data-studio-part="subnav">
                {g.children.map((child) => {
                  const names =
                    child === "content"
                      ? ["Metaobjects", "Метаобекти"]
                      : child === "growth/attribution"
                        ? ["Attribution", "Приписване"]
                        : child === "growth/autopilot"
                          ? ["Autopilot", "Автопилот"]
                          : child === "growth/campaigns"
                            ? ["Campaigns", "Кампании"]
                            : labels[child as PreviewSection];
                  return (
                    <Link
                      key={child}
                      href={href(child)}
                      aria-label={text(names[0], names[1])}
                      aria-current={
                        section === child ||
                        `${section}${detail ? `/${detail}` : ""}` === child
                          ? "page"
                          : undefined
                      }
                    >
                      {text(names[0], names[1])}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      <p className={admin.navHeading} data-studio-part="nav-heading">
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
      {(section === "store" || section === "pages") && (
        <div className={s.subnav} data-studio-part="subnav">
          <Link href={href("pages")}>{text("Pages", "Страници")}</Link>
          <Link href={href("store/preferences")}>
            {text("Preferences", "Предпочитания")}
          </Link>
        </div>
      )}
      <Link
        href={href("agentic")}
        aria-label={text("Agentic", "AI канали")}
        aria-current={section === "agentic" ? "page" : undefined}
      >
        <AdminIcon name="store" />
        <span>{text("Agentic", "AI канали")}</span>
      </Link>
      <p className={admin.navHeading} data-studio-part="nav-heading">
        {text("Apps", "Приложения")}
      </p>
      <Link
        href={href("inbox")}
        aria-label={text("Inbox", "Съобщения")}
        aria-current={section === "inbox" ? "page" : undefined}
      >
        <AdminIcon name="inbox" />
        <span>{text("Inbox", "Съобщения")}</span>
      </Link>
    </>
  );
}
