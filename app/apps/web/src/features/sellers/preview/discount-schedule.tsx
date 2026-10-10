"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { usePreview } from "./context";
import { currentDraftDateTime, DraftDateFields } from "./draft-date-fields";
import { validDraftDate } from "./local-draft-model";
import { type Discount } from "./model";
import { Button, EditorSection } from "./ui";
import styles from "./discount-planning.module.css";

export function DiscountSchedule({
  discount,
  patch,
}: {
  discount: Discount;
  patch: (value: Partial<Discount>) => void;
}) {
  const { text, language } = usePreview();
  const [picker, setPicker] = useState<{
    kind: "start" | "end";
    top: number;
    left: number;
  }>();
  const label = (date: string, time: string | undefined) =>
    date && validDraftDate(date)
      ? new Intl.DateTimeFormat(language === "bg" ? "bg-BG" : "en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short",
        }).format(new Date(`${date}T${time || "00:00"}:00`))
      : text("Choose date", "Избор на дата");
  const open = (kind: "start" | "end", button: HTMLButtonElement) => {
    const rect = button.getBoundingClientRect();
    setPicker({
      kind,
      top: Math.max(16, Math.min(rect.bottom + 4, window.innerHeight - 390)),
      left: Math.max(16, Math.min(rect.left, window.innerWidth - 302)),
    });
  };
  return (
    <EditorSection title={text("Schedule", "График")} part="discount-dates">
      <Button
        plain
        className={styles.scheduleButton}
        aria-label={`${text("Start date", "Начална дата")}: ${label(discount.start, discount.startTime)}`}
        aria-expanded={picker?.kind === "start"}
        onClick={(event) => open("start", event.currentTarget)}
      >
        {label(discount.start, discount.startTime)}
      </Button>
      {discount.end ? (
        <div className={styles.scheduleActions}>
          <Button
            plain
            className={styles.scheduleButton}
            aria-label={`${text("End date", "Крайна дата")}: ${label(discount.end, discount.endTime)}`}
            onClick={(event) => open("end", event.currentTarget)}
          >
            {label(discount.end, discount.endTime)}
          </Button>
          <Button
            plain
            aria-label={text("Remove end date", "Премахване на крайна дата")}
            onClick={() => patch({ end: "", endTime: "" })}
          >
            ×
          </Button>
        </div>
      ) : (
        <Button
          plain
          onClick={(event) => {
            const value = currentDraftDateTime();
            patch({
              end: discount.start || value.date,
              endTime: discount.startTime || value.time,
            });
            open("end", event.currentTarget);
          }}
        >
          ＋ {text("Set end date", "Задаване на крайна дата")}
        </Button>
      )}
      {picker && (
        <SchedulePopover
          anchor={picker}
          date={picker.kind === "start" ? discount.start : discount.end}
          time={
            (picker.kind === "start" ? discount.startTime : discount.endTime) ||
            "00:00"
          }
          minDate={picker.kind === "end" ? discount.start : undefined}
          onDate={(date) =>
            patch(picker.kind === "start" ? { start: date } : { end: date })
          }
          onTime={(time) =>
            patch(
              picker.kind === "start" ? { startTime: time } : { endTime: time },
            )
          }
          onClose={() => setPicker(undefined)}
        />
      )}
    </EditorSection>
  );
}
function SchedulePopover({
  anchor,
  date,
  time,
  minDate,
  onDate,
  onTime,
  onClose,
}: {
  anchor: { top: number; left: number };
  date: string;
  time: string;
  minDate?: string;
  onDate: (value: string) => void;
  onTime: (value: string) => void;
  onClose: () => void;
}) {
  const { text } = usePreview();
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = ref.current,
      opener = document.activeElement as HTMLElement | null;
    node?.showPopover();
    return () => {
      node?.hidePopover();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  return (
    <div
      ref={ref}
      popover="auto"
      role="dialog"
      aria-label={text("Discount planned date", "Планирана дата за отстъпка")}
      data-studio-part="discount-date-picker"
      className={styles.schedulePopover}
      style={{ top: anchor.top, left: anchor.left }}
      onToggle={(event) => {
        if (event.newState === "closed") onClose();
      }}
    >
      <DraftDateFields
        date={date}
        time={time}
        onDate={onDate}
        onTime={onTime}
        months={1}
        minDate={minDate}
        presentation="publication"
        weekStartsOn={0}
      />
    </div>
  );
}
