"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { AdminIcon } from "../admin-icons";
import { usePreview } from "./context";
import { validDraftDate } from "./local-draft-model";
import { Button, Check, Field } from "./ui";
import {
  comparisonLabels,
  reportComparisonRange,
  reportRangeLabel,
  type ReportComparison,
} from "./report-range-model";
import styles from "./report-date-picker.module.css";

type Range = { start: string; end: string };
type Preset =
  "today" | "yesterday" | "last" | "period" | "quarters" | "custom" | "all";
const iso = (date: Date) => date.toISOString().slice(0, 10);
const utcDate = (date: string) => new Date(`${date}T12:00:00Z`);

/** Filters saved local records. Applying a range does not run a provider query. */
export function ReportDatePicker({
  range,
  phone,
  anchor,
  onClose,
  onApply,
  comparison,
}: {
  range: Range;
  phone: boolean;
  anchor: { left: number; top: number };
  onClose: () => void;
  onApply: (range: Range, comparison?: ReportComparison) => void;
  comparison?: { mode: ReportComparison; current: Range };
}) {
  const { text, language } = usePreview();
  const [comparisonMode, setComparisonMode] = useState(
    comparison?.mode ?? "none",
  );
  const today = iso(new Date());
  const surface = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(range);
  const [preset, setPreset] = useState<Preset>(
    range.start && range.end
      ? range.end === today &&
        (utcDate(range.end).getTime() - utcDate(range.start).getTime()) /
          86400000 ===
          29
        ? "last"
        : "custom"
      : "all",
  );
  const [count, setCount] = useState(30);
  const [unit, setUnit] = useState("days");
  const [includeToday, setIncludeToday] = useState(true);
  const [awaitingEnd, setAwaitingEnd] = useState(false);
  const locale = language === "bg" ? "bg-BG" : "en-GB";
  const [month, setMonth] = useState(() => {
    const end =
      range.end && validDraftDate(range.end)
        ? utcDate(range.end)
        : utcDate(today);
    return new Date(
      Date.UTC(
        end.getUTCFullYear(),
        end.getUTCMonth() - (phone ? 0 : 1),
        1,
        12,
      ),
    );
  });
  useLayoutEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const node = surface.current;
    node?.showPopover();
    node
      ?.querySelector<HTMLElement>('select, button[aria-pressed="true"]')
      ?.focus({ preventScroll: true });
    return () => {
      node?.hidePopover();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [phone]);
  const lastRange = (amount: number, period: string, include: boolean) => {
    const end = utcDate(today);
    if (!include) end.setUTCDate(end.getUTCDate() - 1);
    const start = new Date(end);
    if (period === "months") start.setUTCMonth(start.getUTCMonth() - amount);
    else if (period === "years")
      start.setUTCFullYear(start.getUTCFullYear() - amount);
    else
      start.setUTCDate(
        start.getUTCDate() - amount * (period === "weeks" ? 7 : 1) + 1,
      );
    return { start: iso(start), end: iso(end) };
  };
  const choosePreset = (value: Preset) => {
    setPreset(value);
    setAwaitingEnd(false);
    if (value === "all") setDraft({ start: "", end: "" });
    else if (value === "custom") return;
    else if (value === "last") setDraft(lastRange(count, unit, includeToday));
    else {
      const end = utcDate(today);
      if (value === "yesterday") end.setUTCDate(end.getUTCDate() - 1);
      const start = new Date(end);
      if (value === "period") start.setUTCDate(1);
      if (value === "quarters")
        start.setUTCMonth(Math.floor(start.getUTCMonth() / 3) * 3, 1);
      setDraft({ start: iso(start), end: iso(end) });
    }
  };
  const valid =
    (!draft.start && !draft.end) ||
    (!!draft.start &&
      !!draft.end &&
      validDraftDate(draft.start) &&
      validDraftDate(draft.end) &&
      draft.start <= draft.end);
  const presets: [Preset | "black-friday" | "cyber-monday", string, string][] =
    [
      ["today", "Today", "Днес"],
      ["yesterday", "Yesterday", "Вчера"],
      ["last", "Last", "Последни"],
      ["period", "Period to date", "Период до днес"],
      ["black-friday", "Black Friday", "Черен петък"],
      ["cyber-monday", "Cyber Monday", "Кибер понеделник"],
      ["quarters", "Quarters", "Тримесечия"],
      ["custom", "Custom range", "Персонализиран период"],
      ["all", "All time", "Цялото време"],
    ];
  const body = (
    <div className={styles.body} data-studio-part="report-date-body">
      {comparison ? (
        <select
          className={styles.phonePreset}
          aria-label={text("Comparison period", "Период за сравнение")}
          value={comparisonMode}
          onChange={(event) => {
            const mode = event.target.value as ReportComparison;
            setComparisonMode(mode);
            const range = reportComparisonRange(comparison.current, mode);
            if (range) setDraft(range);
          }}
        >
          {comparisonLabels.map(([mode, en, bg]) => (
            <option key={mode} value={mode}>
              {text(en, bg)}
            </option>
          ))}
        </select>
      ) : phone ? (
        <select
          className={styles.phonePreset}
          aria-label={text("Date presets", "Готови периоди")}
          value={preset}
          onChange={(event) => choosePreset(event.target.value as Preset)}
        >
          {presets.map(([value, en, bg]) => (
            <option
              key={value}
              value={value}
              disabled={value === "black-friday" || value === "cyber-monday"}
            >
              {value === "last"
                ? text(
                    `Last ${count} ${unit}`,
                    `Последни ${count} ${unit === "days" ? "дни" : unit === "weeks" ? "седмици" : unit === "months" ? "месеци" : "години"}`,
                  )
                : text(en, bg)}
            </option>
          ))}
        </select>
      ) : (
        <nav
          aria-label={text("Date presets", "Готови периоди")}
          className={styles.presets}
        >
          {presets.map(([value, en, bg]) => (
            <button
              type="button"
              key={value}
              aria-pressed={preset === value}
              disabled={value === "black-friday" || value === "cyber-monday"}
              title={
                value === "black-friday" || value === "cyber-monday"
                  ? text(
                      "Event date windows are not configured in this local preview.",
                      "Периодите за събития не са зададени в локалния преглед.",
                    )
                  : undefined
              }
              onClick={() => choosePreset(value as Preset)}
            >
              {text(en, bg)}
            </button>
          ))}
        </nav>
      )}
      <div className={styles.range}>
        {!comparison && preset === "last" ? (
          <div className={styles.last}>
            <span>{text("Last", "Последни")}</span>
            <input
              type="number"
              min={1}
              max={999}
              aria-label={text("Number of periods", "Брой периоди")}
              value={count}
              onChange={(event) => {
                const value = Math.max(
                  1,
                  Math.min(999, Number(event.target.value) || 1),
                );
                setCount(value);
                setDraft(lastRange(value, unit, includeToday));
              }}
            />
            <select
              aria-label={text("Period unit", "Единица за период")}
              value={unit}
              onChange={(event) => {
                setUnit(event.target.value);
                setDraft(lastRange(count, event.target.value, includeToday));
              }}
            >
              <option value="days">{text("Days", "Дни")}</option>
              <option value="weeks">{text("Weeks", "Седмици")}</option>
              <option value="months">{text("Months", "Месеци")}</option>
              <option value="years">{text("Years", "Години")}</option>
            </select>
            <Check
              label={text("Include today", "Включи днес")}
              checked={includeToday}
              onChange={() => {
                setIncludeToday(!includeToday);
                setDraft(lastRange(count, unit, !includeToday));
              }}
            />
          </div>
        ) : (
          <div className={styles.inputs}>
            <Field label={text("Start date", "Начална дата")}>
              <input
                type="date"
                value={draft.start}
                onChange={(event) => {
                  setPreset("custom");
                  if (comparison) setComparisonMode("custom");
                  setDraft({ ...draft, start: event.target.value });
                }}
              />
            </Field>
            <Field label={text("End date", "Крайна дата")}>
              <input
                type="date"
                value={draft.end}
                onChange={(event) => {
                  setPreset("custom");
                  if (comparison) setComparisonMode("custom");
                  setDraft({ ...draft, end: event.target.value });
                }}
              />
            </Field>
          </div>
        )}
        <div className={styles.calendar}>
          <div className={styles.monthNavigation}>
            <Button
              plain
              aria-label={text("Previous month", "Предишен месец")}
              onClick={() =>
                setMonth(
                  new Date(
                    Date.UTC(
                      month.getUTCFullYear(),
                      month.getUTCMonth() - 1,
                      1,
                      12,
                    ),
                  ),
                )
              }
            >
              <AdminIcon name="back" />
            </Button>
            <Button
              plain
              aria-label={text("Next month", "Следващ месец")}
              onClick={() =>
                setMonth(
                  new Date(
                    Date.UTC(
                      month.getUTCFullYear(),
                      month.getUTCMonth() + 1,
                      1,
                      12,
                    ),
                  ),
                )
              }
            >
              <AdminIcon name="back" />
            </Button>
          </div>
          <div className={styles.months}>
            {(phone ? [0] : [0, 1]).map((offset) => {
              const first = new Date(
                Date.UTC(
                  month.getUTCFullYear(),
                  month.getUTCMonth() + offset,
                  1,
                  12,
                ),
              );
              const days = new Date(
                Date.UTC(
                  first.getUTCFullYear(),
                  first.getUTCMonth() + 1,
                  0,
                  12,
                ),
              ).getUTCDate();
              return (
                <section className={styles.month} key={iso(first)}>
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
                    aria-label={text("Select date range", "Избор на период")}
                  >
                    {(language === "bg"
                      ? ["нд", "пн", "вт", "ср", "чт", "пт", "сб"]
                      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
                    ).map((day) => (
                      <span key={day} aria-hidden="true">
                        {day}
                      </span>
                    ))}
                    {Array.from({ length: first.getUTCDay() }, (_, index) => (
                      <span key={`blank-${index}`} />
                    ))}
                    {Array.from({ length: days }, (_, index) => {
                      const date = new Date(
                        Date.UTC(
                          first.getUTCFullYear(),
                          first.getUTCMonth(),
                          index + 1,
                          12,
                        ),
                      );
                      const value = iso(date);
                      return (
                        <button
                          type="button"
                          key={value}
                          aria-label={new Intl.DateTimeFormat(locale, {
                            dateStyle: "long",
                            timeZone: "UTC",
                          }).format(date)}
                          aria-pressed={
                            draft.start === value || draft.end === value
                          }
                          data-in-range={
                            !!draft.start &&
                            !!draft.end &&
                            draft.start < value &&
                            value < draft.end
                          }
                          onClick={() => {
                            setPreset("custom");
                            if (comparison) setComparisonMode("custom");
                            if (!awaitingEnd) {
                              setDraft({ start: value, end: value });
                              setAwaitingEnd(true);
                            } else {
                              setDraft({
                                start:
                                  value < draft.start ? value : draft.start,
                                end: value > draft.start ? value : draft.start,
                              });
                              setAwaitingEnd(false);
                            }
                          }}
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
      </div>
    </div>
  );
  const footer = (
    <>
      <span className={styles.summary}>
        {comparison && comparisonMode === "none"
          ? text("No comparison", "Без сравнение")
          : draft.start || draft.end
            ? reportRangeLabel(draft, language)
            : text("All time", "Цялото време")}
      </span>
      <Button onClick={onClose}>{text("Cancel", "Отказ")}</Button>
      <Button
        primary
        disabled={!valid}
        onClick={() => onApply(draft, comparison ? comparisonMode : undefined)}
      >
        {text("Apply", "Прилагане")}
      </Button>
    </>
  );
  return (
    <div
      ref={surface}
      popover="auto"
      role="dialog"
      aria-label={
        comparison
          ? text("Comparison period", "Период за сравнение")
          : text("Date range", "Период")
      }
      className={styles.popover}
      data-studio-part="report-dates"
      data-comparison={!!comparison}
      style={anchor}
      onToggle={(event) => {
        if (event.newState === "closed") onClose();
      }}
    >
      {body}
      <footer>{footer}</footer>
    </div>
  );
}
