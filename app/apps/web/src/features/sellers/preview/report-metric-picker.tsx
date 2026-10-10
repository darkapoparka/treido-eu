"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { AdminIcon } from "../admin-icons";
import { usePreview } from "./context";
import { Button, Check, Modal, s } from "./ui";
import { explorerMetrics, type ExplorerMetric } from "./report-explorer-model";
import { ReportEmptyArtwork } from "./report-empty-artwork";
import { reportMetricReference } from "./report-metric-reference";
import styles from "./report-explorer.module.css";

const categories = [
  ["App Events", "Събития в приложения"],
  ["Customers", "Клиенти"],
  ["Finance and payments", "Финанси и плащания"],
  ["Fraud prevention", "Предотвратяване на измами"],
  ["Inventory", "Наличности"],
  ["Marketing", "Маркетинг"],
  ["Orders", "Поръчки"],
  ["Products", "Продукти"],
  ["Sales revenue", "Приходи от продажби"],
  ["Sessions and behavior", "Сесии и поведение"],
  ["Stores", "Магазини"],
  ["Time", "Време"],
] as const;
export function ReportMetricPicker({
  selected,
  phone,
  anchor,
  onClose,
  onApply,
}: {
  selected: ExplorerMetric[];
  phone: boolean;
  anchor: { left: number; top: number };
  onClose: () => void;
  onApply: (metrics: ExplorerMetric[]) => void;
}) {
  const { text } = usePreview();
  const popover = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [draft, setDraft] = useState(selected);
  useLayoutEffect(() => {
    if (phone) return;
    const opener = document.activeElement as HTMLElement | null;
    const surface = popover.current;
    surface?.showPopover();
    surface
      ?.querySelector<HTMLInputElement>('input[type="search"]')
      ?.focus({ preventScroll: true });
    return () => {
      surface?.hidePopover();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [phone]);
  const filtered = explorerMetrics.filter(
    (metric) =>
      (!category || metric.category === category) &&
      `${metric.en} ${metric.bg}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const categoryLabels = categories.find(([en]) => en === category);
  const unavailable = reportMetricReference.flatMap(
    ({ category: group, labels }) =>
      !category || group === category
        ? labels
            .filter(
              (label) =>
                !explorerMetrics.some(
                  (metric) => metric.category === group && metric.en === label,
                ) && label.toLowerCase().includes(query.trim().toLowerCase()),
            )
            .map((label) => ({ category: group, label }))
        : [],
  );
  const choices = [
    ...filtered.map((metric) => ({
      key: metric.id,
      label: text(metric.en, metric.bg),
      metric,
    })),
    ...unavailable.map((item) => ({
      key: `${item.category}:${item.label}`,
      label: item.label,
      metric: undefined,
    })),
  ].sort((a, b) => a.label.localeCompare(b.label));
  const body = (
    <div className={styles.pickerBody} data-studio-part="report-picker-body">
      <label
        className={styles.pickerSearch}
        data-studio-part="report-picker-search"
      >
        <AdminIcon name="search" />
        <input
          data-studio-autofocus
          type="search"
          aria-label={text("Search metrics", "Търсене на показатели")}
          value={query}
          maxLength={160}
          onChange={(event) => {
            setQuery(event.target.value);
            if (event.target.value) setCategory("");
          }}
          placeholder={text("Search metrics", "Търсене на показатели")}
        />
      </label>
      {!category && !query ? (
        <>
          <h3>{text("Categories", "Категории")}</h3>
          {categories.map(([en, bg]) => (
            <button
              type="button"
              key={en}
              className={styles.categoryRow}
              onClick={() => setCategory(en)}
            >
              <AdminIcon
                name={
                  en === "Orders"
                    ? "orders"
                    : en === "Inventory" || en === "Products"
                      ? "product"
                      : "analytics"
                }
              />
              {text(en, bg)}
              <span aria-hidden="true">›</span>
            </button>
          ))}
        </>
      ) : (
        <>
          {category && (
            <Button
              plain
              aria-label={text(
                `Back to ${categoryLabels?.[0] ?? category}`,
                `Назад към ${categoryLabels?.[1] ?? category}`,
              )}
              onClick={() => setCategory("")}
            >
              <AdminIcon name="back" />
              {text(
                categoryLabels?.[0] ?? category,
                categoryLabels?.[1] ?? category,
              )}
            </Button>
          )}
          {choices.map(({ key, label, metric }) => (
            <div
              key={key}
              title={
                !metric
                  ? text(
                      "Requires connected analytics. This metric is unavailable.",
                      "Изисква свързан анализ. Този показател не е достъпен.",
                    )
                  : undefined
              }
              data-metric-available={!!metric}
            >
              <Check
                label={label}
                disabled={!metric}
                checked={!!metric && draft.includes(metric.id)}
                onChange={() =>
                  metric &&
                  setDraft(
                    draft.includes(metric.id)
                      ? draft.filter((id) => id !== metric.id)
                      : [...draft, metric.id],
                  )
                }
              />
            </div>
          ))}
          <p className={s.help}>
            {filtered.length
              ? text(
                  "Enabled metrics use saved local records. Other reference metrics require connected analytics.",
                  "Активните показатели използват локални записи. Останалите показатели от примера изискват свързан анализ.",
                )
              : text(
                  "No connected data for this category. Local orders, sales, customers and inventory are available.",
                  "Няма свързани данни за тази категория. Достъпни са локалните поръчки, продажби, клиенти и наличности.",
                )}
          </p>
          <p className={s.help}>
            {text(
              "Reference metric names are shown in English.",
              "Имената на показателите от примера са на английски.",
            )}
          </p>
        </>
      )}
    </div>
  );
  const footer = (
    <>
      <Button plain disabled={!draft.length} onClick={() => setDraft([])}>
        {text("Clear", "Изчистване")}
      </Button>
      <Button primary disabled={!draft.length} onClick={() => onApply(draft)}>
        {text("Apply", "Прилагане")}
      </Button>
    </>
  );
  return phone ? (
    <Modal
      className={styles.phonePicker}
      title={text("Add metric", "Добавяне на показател")}
      surface="report-metric-picker"
      onClose={onClose}
      footer={footer}
    >
      {body}
    </Modal>
  ) : (
    <div
      popover="auto"
      ref={popover}
      role="dialog"
      aria-label={text("Add metric", "Добавяне на показател")}
      className={styles.desktopPicker}
      data-studio-part="report-metric-picker"
      style={anchor}
      onToggle={(event) => {
        if (event.newState === "closed") onClose();
      }}
    >
      <div
        className={styles.pickerExplanation}
        data-studio-part="report-picker-explanation"
      >
        <ReportEmptyArtwork />
        <h3>{text("Metrics", "Показатели")}</h3>
        <p>
          {text(
            "Counts and calculations that track your saved local orders, sales, customers and inventory.",
            "Брой и изчисления за запазените локални поръчки, продажби, клиенти и наличности.",
          )}
        </p>
      </div>
      <div>
        {body}
        <footer>{footer}</footer>
      </div>
    </div>
  );
}
