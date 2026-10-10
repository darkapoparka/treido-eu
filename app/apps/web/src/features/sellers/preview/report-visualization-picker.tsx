"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { AdminIcon } from "../admin-icons";
import { usePreview } from "./context";
import { type EditorDraft } from "./local-draft-model";
import { Modal } from "./ui";
import styles from "./report-explorer.module.css";
import picker from "./report-visualization-picker.module.css";
type Report = Extract<EditorDraft, { kind: "Report" }>;
const options = [
  ["Metric", "Display metric", "Показател"],
  ["Treemap", "Treemap", "Дървовидна карта"],
  ["Waterfall", "Waterfall", "Водопад"],
  ["Calendar", "Calendar heatmap", "Календарна топлинна карта"],
  ["Sunburst", "Sunburst", "Слънчева диаграма"],
  ["Bubble", "Bubble chart", "Мехурчеста диаграма"],
  ["Scatter", "Scatter plot", "Точкова диаграма"],
  ["Radar", "Radar", "Радарна диаграма"],
  ["Line", "Line", "Линейна графика"],
  ["Area", "Area chart", "Площна диаграма"],
  ["Bar", "Simple vertical", "Вертикални стълбове"],
  ["StackedVertical", "Stacked vertical", "Натрупани вертикални стълбове"],
  ["GroupedVertical", "Grouped vertical", "Групирани вертикални стълбове"],
  ["Horizontal", "Simple horizontal", "Хоризонтални стълбове"],
  [
    "StackedHorizontal",
    "Stacked horizontal",
    "Натрупани хоризонтални стълбове",
  ],
  [
    "GroupedHorizontal",
    "Grouped horizontal",
    "Групирани хоризонтални стълбове",
  ],
  ["MetricList", "List by metric", "Списък по показател"],
  ["DimensionList", "List by dimension", "Списък по измерение"],
  ["Table", "Display table", "Таблица"],
  ["Gauge", "Target gauge", "Целеви индикатор"],
  ["Donut", "Donut", "Кръгова диаграма"],
  ["Breakdown", "Breakdown bar", "Стълб с разбивка"],
  ["Histogram", "Histogram (frequency)", "Хистограма (честота)"],
  ["Heatmap", "Heatmap", "Топлинна карта"],
] as const;
export function ReportVisualizationPicker({
  phone,
  anchor,
  value,
  dimension,
  onClose,
  onChange,
}: {
  phone: boolean;
  anchor: { left: number; top: number };
  value: Report["visualization"];
  dimension: Report["dimension"];
  onClose: () => void;
  onChange: (value: Report["visualization"]) => void;
}) {
  const { text, language } = usePreview();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [recommended, setRecommended] = useState(true);
  const recommendation = dimension === "Date" ? "Line" : "Metric";
  const rows = options.filter(([, en, bg]) =>
    text(en, bg).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  if (sort === "name")
    rows.sort((a, b) =>
      text(a[1], a[2]).localeCompare(text(b[1], b[2]), language),
    );
  if (recommended)
    rows.sort(
      (a, b) =>
        Number(b[0] === recommendation) - Number(a[0] === recommendation),
    );
  const popover = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (phone) return;
    const opener = document.activeElement as HTMLElement | null;
    const node = popover.current;
    node?.showPopover();
    node
      ?.querySelector<HTMLButtonElement>('button[aria-checked="true"]')
      ?.focus({ preventScroll: true });
    return () => {
      node?.hidePopover();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [phone]);
  const body = (
    <div className={picker.body}>
      <div className={picker.tools}>
        <label className={picker.search}>
          <AdminIcon name="search" />
          <input
            type="search"
            maxLength={100}
            value={query}
            placeholder={text("Search", "Търсене")}
            aria-label={text(
              "Search visualizations",
              "Търсене на визуализации",
            )}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className={picker.sort}>
          {text("Sort by", "Подреждане")}
          <select
            aria-label={text(
              "Sort visualizations",
              "Подреждане на визуализации",
            )}
            value={sort}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="recent">
              {text("Recently added", "Наскоро добавени")}
            </option>
            <option value="name">{text("Name", "Име")}</option>
          </select>
        </label>
        <label className={picker.recommended}>
          <input
            type="checkbox"
            role="switch"
            checked={recommended}
            onChange={(event) => setRecommended(event.target.checked)}
          />
          <span>{text("Recommended", "Препоръчани")}</span>
        </label>
      </div>
      <div className={picker.options}>
        {rows.map(([id, en, bg]) => {
          const supported =
            ["Metric", "Line", "Bar", "Table"].includes(id) &&
            ((id !== "Line" && id !== "Bar") || dimension === "Date");
          return (
            <button
              type="button"
              key={id}
              disabled={!supported}
              role="checkbox"
              aria-checked={id === value}
              title={
                !supported
                  ? text(
                      "This visualization requires a supported date series or connected analytics.",
                      "Тази визуализация изисква поддържан ред по дати или свързан анализ.",
                    )
                  : undefined
              }
              onClick={() => {
                if (supported) onChange(id as Report["visualization"]);
              }}
            >
              <span className={picker.checkbox} aria-hidden="true">
                {id === value ? "✓" : ""}
              </span>
              {text(en, bg)}
            </button>
          );
        })}
        {!rows.length && (
          <p className={picker.empty} role="status">
            {text("No visualizations found", "Няма намерени визуализации")}
          </p>
        )}
      </div>
    </div>
  );
  const explanation = (
    <div className={styles.pickerExplanation}>
      <h3>{text("Visualization", "Визуализация")}</h3>
      <p>
        {text(
          "Choose how to display your local metrics. Line and bar charts need a Date dimension.",
          "Изберете как да показвате локалните показатели. Линейните и стълбовидните графики изискват измерение Дата.",
        )}
      </p>
    </div>
  );
  return phone ? (
    <Modal
      title={text("Change visualization", "Промяна на визуализацията")}
      surface="report-visualization-picker"
      className={picker.phone}
      onClose={onClose}
    >
      {body}
    </Modal>
  ) : (
    <div
      ref={popover}
      popover="auto"
      role="dialog"
      aria-label={text("Visualization", "Визуализация")}
      className={`${styles.desktopPicker} ${picker.desktop}`}
      data-studio-part="report-visualization-picker"
      style={anchor}
      onToggle={(event) => {
        if (event.newState === "closed") onClose();
      }}
    >
      {explanation}
      {body}
    </div>
  );
}
