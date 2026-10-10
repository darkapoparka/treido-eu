"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { usePreview } from "./context";
import { currentDraftDateTime, DraftDateFields } from "./draft-date-fields";
import { validDraftDate } from "./local-draft-model";
import { Button } from "./ui";
import styles from "./procurement-drafts.module.css";

export function GiftCardExpiryPicker({
  value,
  anchor,
  onClose,
  onApply,
}: {
  value: string;
  anchor: { top: number; left: number };
  onClose: () => void;
  onApply: (date: string) => void;
}) {
  const { text } = usePreview();
  const [draft, setDraft] = useState(value);
  const [preset, setPreset] = useState(value ? "custom" : "none");
  const ref = useRef<HTMLDivElement>(null);
  const today = currentDraftDateTime().date;
  useLayoutEffect(() => {
    const node = ref.current,
      opener = document.activeElement as HTMLElement | null;
    node?.showPopover();
    return () => {
      node?.hidePopover();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  const select = (value: string) => {
    setPreset(value);
    if (value === "none") {
      setDraft("");
      return;
    }
    const years = Number(value);
    if (!Number.isInteger(years)) return;
    const now = new Date(`${today}T12:00:00Z`),
      year = now.getUTCFullYear() + years,
      month = now.getUTCMonth(),
      last = new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate();
    setDraft(
      new Date(Date.UTC(year, month, Math.min(now.getUTCDate(), last), 12))
        .toISOString()
        .slice(0, 10),
    );
  };
  return (
    <div
      ref={ref}
      popover="auto"
      role="dialog"
      aria-label={text("Expiration date", "Дата на изтичане")}
      data-studio-part="gift-card-expiry-picker"
      className={styles.expiryPopover}
      style={{ top: anchor.top, left: anchor.left }}
      onToggle={(event) => {
        if (event.newState === "closed") onClose();
      }}
    >
      <div>
        <select
          aria-label={text("Expiration date preset", "Предварителен срок")}
          value={preset}
          onChange={(event) => select(event.target.value)}
        >
          <option value="none">{text("No expiration", "Без срок")}</option>
          {[1, 3, 5].map((years) => (
            <option key={years} value={years}>
              {text(
                `${years} ${years === 1 ? "year" : "years"} from now`,
                `След ${years} ${years === 1 ? "година" : "години"}`,
              )}
            </option>
          ))}
          {preset === "custom" && (
            <option value="custom">
              {text("Custom date", "Избрана дата")}
            </option>
          )}
        </select>
        <DraftDateFields
          date={draft}
          time=""
          onDate={(date) => {
            setPreset(date ? "custom" : "none");
            setDraft(date);
          }}
          onTime={() => {}}
          months={1}
          minDate={today}
          presentation="expiry"
          weekStartsOn={0}
        />
      </div>
      <div className={styles.expiryActions}>
        <Button onClick={onClose}>{text("Cancel", "Отказ")}</Button>
        <Button
          primary
          disabled={
            draft === value ||
            !validDraftDate(draft) ||
            (!!draft && draft < today)
          }
          onClick={() => onApply(draft)}
        >
          {text("Done", "Готово")}
        </Button>
      </div>
    </div>
  );
}
