"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useLocale } from "./provider";
import {
  languagePromptCookie,
  languagePromptEligible,
} from "./language-prompt-model";
import { LanguagePicker } from "./language-picker";
import s from "./language-prompt.module.css";

export function LanguagePrompt() {
  const pathname = usePathname();
  return <PageLanguagePrompt key={pathname} pathname={pathname} />;
}

function PageLanguagePrompt({ pathname }: { pathname: string }) {
  const { locale, savedLocale } = useLocale();
  const t = useTranslations("languagePrompt");
  const [show, setShow] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const [open, setOpen] = useState(false);
  const [bottom, setBottom] = useState(112);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      const dismissed = document.cookie
        .split(";")
        .some((part) => part.trim() === languagePromptCookie + "=1");
      const dock = document.querySelector<HTMLElement>(".floating-dock");
      const hiddenByModal = !!document.querySelector("dialog[open]");
      const rect = dock?.getBoundingClientRect();
      const focused = document.activeElement;
      const editing =
        focused instanceof HTMLElement &&
        (focused.matches(
          'textarea, input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="tel"], input[type="url"], input[type="password"], input[type="number"]',
        ) ||
          focused.isContentEditable);
      const dockVisible =
        !!rect &&
        rect.width > 0 &&
        rect.height > 0 &&
        rect.top < window.innerHeight &&
        rect.bottom > 0;
      setBottom(rect ? Math.max(16, window.innerHeight - rect.top + 12) : 24);
      setShow(
        languagePromptEligible(pathname, savedLocale, dismissed) &&
          dockVisible &&
          !editing &&
          !hiddenByModal &&
          document.visibilityState === "visible",
      );
    };
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(update, 50);
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["open", "hidden"],
    });
    timer = setTimeout(update, 800);
    const afterFocus = () => {
      clearTimeout(timer);
      timer = setTimeout(update, 0);
    };
    document.addEventListener("focusin", afterFocus);
    document.addEventListener("focusout", afterFocus);
    window.visualViewport?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      document.removeEventListener("focusin", afterFocus);
      document.removeEventListener("focusout", afterFocus);
      window.visualViewport?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [pathname, savedLocale]);
  useEffect(() => {
    if (show && !open && restoreFocus.current) {
      trigger.current?.focus();
      restoreFocus.current = false;
    }
  }, [show, open]);
  const closePicker = () => {
    restoreFocus.current = true;
    setOpen(false);
  };
  const dismiss = () => {
    document.cookie =
      languagePromptCookie +
      "=1; Path=/; Max-Age=2592000; SameSite=Lax" +
      (location.protocol === "https:" ? "; Secure" : "");
    setShow(false);
  };
  return (
    <>
      {show && !open && (
        <div className={s.prompt} style={{ bottom }} data-language-prompt>
          <button
            type="button"
            ref={trigger}
            className={s.trigger}
            aria-label={t("open")}
            aria-haspopup="dialog"
            onClick={() => setOpen(true)}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <ellipse cx="12" cy="12" rx="4" ry="9" />
              <path d="M3 12h18M5 7h14M5 17h14" />
            </svg>
            <span>
              {t("prompt")}
              <small lang={locale}>
                {locale === "bg" ? "Български" : "English"}
              </small>
            </span>
            <span aria-hidden="true">⌄</span>
          </button>
          <button
            type="button"
            className={s.dismiss}
            aria-label={t("dismiss")}
            onClick={dismiss}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="m4 4 8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
      )}
      {open && <LanguagePicker open onClose={closePicker} onSaved={dismiss} />}
    </>
  );
}
