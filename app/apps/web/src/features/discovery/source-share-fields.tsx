"use client";
import { useTranslations } from "next-intl";
import "./source-share.css";

/** Browser fallback for a native sharing surface. Copy happens only on request. */
export function SourceShareFields({
  id,
  label,
  url,
  status,
  onStatus,
}: {
  id: string;
  label: string;
  url: string;
  status: string;
  onStatus: (status: string) => void;
}) {
  const ui = useTranslations("discoveryUI");
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={url}
        readOnly
        onFocus={(event) => event.currentTarget.select()}
      />
      <button
        type="button"
        className="primary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            onStatus("Link copied");
          } catch {
            onStatus("Select the link above to copy it manually.");
          }
        }}
      >
        {ui("copyLink")}
      </button>
      <p role="status">{status}</p>
    </>
  );
}
