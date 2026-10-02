"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { Row } from "../account/forms";
import { useLocale } from "./provider";
export function LanguagePreferenceRow({
  native = false,
}: {
  native?: boolean;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const { locale, messages } = useLocale();
  const returnTo = `${pathname}${params.size ? `?${params}` : ""}`;
  return (
    <Row
      native={native}
      label={messages.preferences.title}
      value={locale === "bg" ? "Български" : "English"}
      href={`/account/language?returnTo=${encodeURIComponent(returnTo)}`}
    />
  );
}
