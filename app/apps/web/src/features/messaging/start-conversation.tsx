"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { startConversationAction } from "./actions";
import { inboxHref } from "./inbox-model";
import s from "./messaging.module.css";
export function StartConversation({ listingId }: { listingId: string }) {
  const t = useTranslations("messaging"),
    locale = useLocale(),
    router = useRouter();
  const [pending, start] = useTransition(),
    [failed, setFailed] = useState(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  return (
    <div>
      <p>{t("startNote")}</p>
      {failed && (
        <p className={s.error} role="alert">
          {t("startFailed")}
        </p>
      )}
      <button
        className={s.button + " " + s.primary}
        disabled={pending}
        onClick={() => {
          setFailed(false);
          start(async () => {
            try {
              const result = await startConversationAction(listingId);
              if (!alive.current) return;
              if (result.ok)
                router.push(
                  inboxHref({ sellerId: null }, locale, result.data.id),
                );
              else setFailed(true);
            } catch {
              if (alive.current) setFailed(true);
            }
          });
        }}
      >
        {t(pending ? "saving" : "start")}
      </button>
    </div>
  );
}
