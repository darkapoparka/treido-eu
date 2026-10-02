"use client";
import Link from "next/link";
import { AdminIcon } from "../admin-icons";
import { usePreview } from "./context";
import { s } from "./ui";

export function WorkspaceLinks({ className }: { className?: string }) {
  const { href, language, text } = usePreview();
  const homeLabel = text("Go to Treido", "Към Treido");
  const storeLabel = text("View store", "Виж магазина");
  return (
    <div
      className={s.workspaceLinks}
      role="group"
      aria-label={text("Website links", "Връзки към сайта")}
    >
      <Link
        href={`/?lang=${language}`}
        className={className}
        aria-label={homeLabel}
        title={homeLabel}
      >
        <AdminIcon name="back" />
        <span>{homeLabel}</span>
      </Link>
      <Link
        href={href("store/preview")}
        className={className}
        aria-label={storeLabel}
        title={storeLabel}
      >
        <AdminIcon name="store" />
        <span>{storeLabel}</span>
      </Link>
    </div>
  );
}
