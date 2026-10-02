"use client";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Icon } from "../discovery/icons";
export function MessagesEntry({ native = false }: { native?: boolean }) {
  const t = useTranslations("messaging"),
    locale = useLocale();
  return (
    <Link className="account-row" href={"/messages?lang=" + locale}>
      <span>{t("title")}</span>
      {native ? <Icon name="chevron" /> : <span aria-hidden="true">›</span>}
    </Link>
  );
}
