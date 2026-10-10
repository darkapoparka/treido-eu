"use client";
import { useAuth } from "@clerk/nextjs";
import { StudioHelper } from "./studio-helper";
import { useAssistantLocale } from "../assistant-tools/common-ui";

/** Mounted only inside an already-authorized real Studio frame, never preview. */
export function StudioHelperPanel({ sellerId, draftId }: { sellerId: string; draftId?: string }) {
  const { isLoaded, userId } = useAuth(), locale = useAssistantLocale();
  if (!isLoaded || !userId) return <p role="status">{locale === "bg" ? "Проверка на достъпа…" : "Checking access…"}</p>;
  return <StudioHelper key={`${userId}:${sellerId}`} actorSubject={userId} sellerId={sellerId} initialDraft={draftId} />;
}
