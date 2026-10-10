"use client";
import { useState } from "react";
import { AdminIcon } from "../admin-icons";
import { usePreview } from "./context";
import { Button, Field } from "./ui";
import { validDraftDate } from "./local-draft-model";
import styles from "./draft-date-fields.module.css";

export function currentDraftDateTime() {
  const now = new Date();
  return {
    date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
    time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
  };
}

/** A local planned date. This component never schedules publication. */
export function DraftDateFields({
  date,
  time,
  onDate,
  onTime,
  months = 2,
  minDate,
  presentation,
  weekStartsOn = 1,
}: {
  date: string;
  time: string;
  onDate: (date: string) => void;
  onTime: (time: string) => void;
  months?: 1 | 2;
  minDate?: string;
  presentation?: "publication" | "expiry";
  weekStartsOn?: 0 | 1;
}) {
  const { language, text } = usePreview();
  const locale = language === "bg" ? "bg-BG" : "en-GB";
  const [month, setMonth] = useState(() => {
    const value =
      date && validDraftDate(date) ? new Date(`${date}T12:00:00Z`) : new Date();
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1, 12),
    );
  });
  const shift = (amount: number) =>
    setMonth(
      new Date(
        Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + amount, 1, 12),
      ),
    );
  return (
    <div
      data-studio-part="draft-date-fields"
      data-month-count={months}
      data-presentation={presentation}
    >
      <div className={styles.fields}>
        <Field label={text("Date", "Дата")}>
          <div className={presentation ? styles.publicationInput : undefined}>
            {presentation && (
              <span aria-hidden="true">
                {presentation === "expiry" && <AdminIcon name="calendar" />}
                {presentation === "expiry"
                  ? date || "YYYY-MM-DD"
                  : date && validDraftDate(date)
                    ? new Intl.DateTimeFormat(
                        language === "bg" ? "bg-BG" : "en-US",
                        { dateStyle: "long", timeZone: "UTC" },
                      ).format(new Date(`${date}T12:00:00Z`))
                    : text("Date", "Дата")}
              </span>
            )}
            <input
              type="date"
              min={minDate}
              aria-label={text("Date", "Дата")}
              value={date}
              onChange={(event) => onDate(event.target.value)}
            />
          </div>
        </Field>
        <Field label={text("Time", "Час")}>
          <div className={presentation ? styles.publicationInput : undefined}>
            {presentation && (
              <span aria-hidden="true">
                {time && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)
                  ? new Intl.DateTimeFormat(
                      language === "bg" ? "bg-BG" : "en-US",
                      {
                        hour: "numeric",
                        minute: "2-digit",
                        timeZoneName: "short",
                      },
                    ).format(
                      new Date(
                        `${date && validDraftDate(date) ? date : currentDraftDateTime().date}T${time}:00`,
                      ),
                    )
                  : text("Time", "Час")}
              </span>
            )}
            <input
              type="time"
              aria-label={text("Time", "Час")}
              value={time}
              onChange={(event) => onTime(event.target.value)}
            />
          </div>
        </Field>
      </div>
      <div className={styles.calendarNav} data-studio-part="date-calendar-nav">
        <Button
          plain
          aria-label={text("Previous month", "Предишен месец")}
          onClick={() => shift(-1)}
        >
          <AdminIcon name="back" />
        </Button>
        <Button
          plain
          aria-label={text("Next month", "Следващ месец")}
          onClick={() => shift(1)}
        >
          <AdminIcon name="back" />
        </Button>
      </div>
      <div
        className={styles.months}
        data-studio-part="date-calendar-months"
        data-month-count={months}
      >
        {Array.from({ length: months }, (_, offset) => {
          const first = new Date(
            Date.UTC(
              month.getUTCFullYear(),
              month.getUTCMonth() + offset,
              1,
              12,
            ),
          );
          const count = new Date(
            Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 12),
          ).getUTCDate();
          const blanks = (first.getUTCDay() + 7 - weekStartsOn) % 7;
          return (
            <section key={first.toISOString()} className={styles.month}>
              <h3>
                {new Intl.DateTimeFormat(locale, {
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                }).format(first)}
              </h3>
              <div
                className={styles.days}
                role="group"
                aria-label={text(
                  "Select planned date",
                  "Избор на планирана дата",
                )}
              >
                {(weekStartsOn === 0
                  ? language === "bg"
                    ? ["нд", "пн", "вт", "ср", "чт", "пт", "сб"]
                    : ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
                  : language === "bg"
                    ? ["пн", "вт", "ср", "чт", "пт", "сб", "нд"]
                    : ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
                ).map((day, index) => (
                  <span key={index} aria-hidden="true">
                    {day}
                  </span>
                ))}
                {Array.from({ length: blanks }, (_, index) => (
                  <span key={`blank-${index}`} />
                ))}
                {Array.from({ length: count }, (_, index) => {
                  const value = new Date(
                    Date.UTC(
                      first.getUTCFullYear(),
                      first.getUTCMonth(),
                      index + 1,
                      12,
                    ),
                  );
                  const iso = value.toISOString().slice(0, 10);
                  return (
                    <button
                      key={iso}
                      type="button"
                      aria-pressed={date === iso}
                      disabled={!!minDate && iso < minDate}
                      aria-label={new Intl.DateTimeFormat(locale, {
                        dateStyle: "long",
                        timeZone: "UTC",
                      }).format(value)}
                      onClick={() => onDate(iso)}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
