"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Sheet, consumeSheetHistory } from "../discovery/components";
import { useLocale } from "./provider";
import { saveLocalizationPreferences } from "./preferences-actions";
import {
  languagePromptCookie,
  languageSwitchDestination,
} from "./language-prompt-model";
import type { Locale } from "./locale";
import s from "./language-prompt.module.css";

export function LanguagePicker({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const preference = useLocale();
  const t = useTranslations("languagePrompt");
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const [selected, select] = useState<Locale>(preference.locale);
  const [pending, start] = useTransition();
  const [failed, fail] = useState(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const close = () => {
    active.current = false;
    onClose();
  };
  const apply = () => {
    fail(false);
    const href =
      pathname + (params.size ? "?" + params : "") + window.location.hash;
    start(async () => {
      try {
        const result = await saveLocalizationPreferences({
          ...(preference.savedRegion ?? {
            country: null,
            locality: "",
            timeZone: preference.timeZone ?? "UTC",
          }),
          locale: selected,
        });
        if (!active.current) return;
        if (!result.ok) {
          fail(true);
          return;
        }
        document.cookie =
          languagePromptCookie +
          "=1; Path=/; Max-Age=2592000; SameSite=Lax" +
          (location.protocol === "https:" ? "; Secure" : "");
        const replace = consumeSheetHistory();
        onSaved?.();
        onClose();
        const target = languageSwitchDestination(href, selected);
        if (replace) router.replace(target, { scroll: false });
        else router.push(target, { scroll: false });
        router.refresh();
      } catch {
        if (active.current) fail(true);
      }
    });
  };
  return (
    <Sheet
      open={open}
      title={t("title")}
      onClose={close}
      dragHandle
      className={s.sheet}
    >
      <p className={s.note}>{t("note")}</p>
      <div className={s.options} role="radiogroup" aria-label={t("title")}>
        {(["bg", "en"] as const).map((language) => (
          <label className={s.option} key={language}>
            <span lang={language}>
              {language === "bg" ? "Български" : "English"}
            </span>
            <input
              type="radio"
              name="treido-language"
              value={language}
              checked={selected === language}
              disabled={pending}
              onChange={() => select(language)}
            />
          </label>
        ))}
      </div>
      {failed && (
        <p role="alert" className={s.error}>
          {t("failure")}
        </p>
      )}
      <button
        type="button"
        className={"primary " + s.apply}
        disabled={pending}
        aria-busy={pending}
        onClick={apply}
      >
        {t(pending ? "saving" : "save")}
      </button>
      <Link
        className={s.preferences}
        href={`/account/language?lang=${preference.locale}&returnTo=${encodeURIComponent(pathname + (params.size ? "?" + params : ""))}`}
        onClick={close}
      >
        {t("preferences")}
      </Link>
    </Sheet>
  );
}

/** A permanent entry after the first-visit suggestion has been dismissed. */
export function LanguagePickerButton() {
  const { locale } = useLocale();
  const t = useTranslations("languagePrompt");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="pill"
        aria-label={t("open")}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span lang={locale}>{locale === "bg" ? "Български" : "English"}</span>
        <span aria-hidden="true">⌄</span>
      </button>
      {open && <LanguagePicker open onClose={() => setOpen(false)} />}
    </>
  );
}
