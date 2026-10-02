"use client";
import { useTranslations } from "next-intl";
import { LanguagePickerButton } from "../locale/language-picker";
import Link from "next/link";
import { SourceLink } from "../discovery/return-navigation";
import { AccountIcon } from "./icons";

/** Display-only source app version; never the version of Treido's services. */
export function ProfileFooter({ native = false }: { native?: boolean }) {
  const t = useTranslations("account");
  return (
    <footer className="profile-footer">
      <div>
        <LanguagePickerButton />
      </div>
      <p>
        {t("referenceVersion", {
          version: native ? "3.4.0 (493466)" : "2.266.0-release.377556",
        })}
      </p>
      <p>
        <Link href="https://shop.app/terms-of-service">{t("terms")}</Link>
        <SourceLink href="/about">{t("licenses")}</SourceLink>
      </p>
      <p className="profile-powered">
        {t("poweredBy")}{" "}
        <b>
          <AccountIcon name="clipboard" />
          shopify
        </b>
        <span aria-hidden="true">|</span>
        <Link href="https://www.shopify.com">{t("startSelling")}</Link>
      </p>
    </footer>
  );
}
