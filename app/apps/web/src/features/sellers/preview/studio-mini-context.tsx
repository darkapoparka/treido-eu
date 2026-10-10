"use client";
import { createContext, useContext } from "react";

export type MiniMode = "chat" | "recents" | "about" | "attachments" | "voice";
export const StudioMiniContext = createContext<{
  open: (mode?: MiniMode) => void;
  ask: (prompt: string) => void;
  docked: boolean;
} | null>(null);
export function useStudioMini() {
  const context = useContext(StudioMiniContext);
  if (!context) throw new Error("Studio Mini context required");
  return context;
}
export function MiniIcon({ name }: { name: "recent" | "voice" }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "recent" ? (
        <path d="M3 7a7 7 0 1 1-1 5M2 3v5h5m3-3v5l3 2" />
      ) : (
        <path d="M3 8v4m4-7v10m3-12v14m3-11v8m4-6v4" />
      )}
    </svg>
  );
}
