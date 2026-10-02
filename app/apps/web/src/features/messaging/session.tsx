"use client";
import { useAuth } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
export function MessagingSession({
  actorSubject,
  children,
}: {
  actorSubject: string;
  children: ReactNode;
}) {
  const { isLoaded, isSignedIn, userId } = useAuth(),
    t = useTranslations("messaging");
  if (!isLoaded) return <p role="status">{t("checking")}</p>;
  if (!isSignedIn || userId !== actorSubject)
    return <p role="status">{t("denied")}</p>;
  return children;
}
