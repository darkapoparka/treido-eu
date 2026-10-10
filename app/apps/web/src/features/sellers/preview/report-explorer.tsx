"use client";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminIcon } from "../admin-icons";
import { usePreview } from "./context";
import { money, put, type Entry } from "./model";
import { validEditorDraft, type EditorDraft } from "./local-draft-model";
import { reportPresets } from "./report-directory";
import {
  explorerMetrics,
  localExplorationRows,
  type ExplorerMetric,
} from "./report-explorer-model";
import { ReportMetricPicker } from "./report-metric-picker";
import { ReportEmptyArtwork } from "./report-empty-artwork";
import { ReportDatePicker } from "./report-date-picker";
import { ReportVisualizationPicker } from "./report-visualization-picker";
import { ReportPageActions } from "./report-page-actions";
import {
  reportRangeLabel,
  comparisonLabels,
  reportComparisonRange,
} from "./report-range-model";
import {
  Button,
  Chart,
  Check,
  Confirm,
  Field,
  Header,
  Modal,
  s,
  downloadCsv,
} from "./ui";
import styles from "./report-explorer.module.css";

type ReportDraft = Extract<EditorDraft, { kind: "Report" }>;
const localDefaults: Partial<
  Record<string, Pick<ReportDraft, "metrics" | "dimension" | "visualization">>
> = {
  sales: { metrics: ["sales"], dimension: "Date", visualization: "Line" },
  products: {
    metrics: ["sales"],
    dimension: "Product",
    visualization: "Table",
  },
  customers: {
    metrics: ["orders", "sales"],
    dimension: "Customer",
    visualization: "Table",
  },
  inventory: {
    metrics: ["inventory"],
    dimension: "Product",
    visualization: "Table",
  },
  "orders-orders-over-time": {
    metrics: ["orders"],
    dimension: "Date",
    visualization: "Line",
  },
};
const supportsDimension = (
  dimension: ReportDraft["dimension"],
  metrics: ExplorerMetric[],
) =>
  dimension === "Date"
    ? !metrics.some(
        (metric) => metric === "customers" || metric === "inventory",
      )
    : dimension === "Product"
      ? !metrics.includes("customers")
      : dimension === "Customer"
        ? !metrics.includes("inventory")
        : true;
export function ReportExplorer({ id }: { id: string }) {
  const { store, href, text, language, update, notify } = usePreview();
  const router = useRouter();
  const existing = store.entries.find(
    (entry) => entry.id === id && entry.type === "ReportDraft",
  );
  const preset = reportPresets.find((report) => report.id === id);
  const initial =
    existing?.editorDraft?.kind === "Report" ? existing.editorDraft : undefined;
  const [draft, setDraft] = useState<ReportDraft>(
    initial ?? {
      kind: "Report",
      metrics: [],
      start: "",
      end: "",
      dimension: "None",
      visualization: "Metric",
      ...localDefaults[id],
    },
  );
  const [controls, setControls] = useState(true);
  const [phoneLayout, setPhoneLayout] = useState(false);
  useEffect(() => {
    const viewport = window.matchMedia("(max-width: 767px)");
    const changed = () => setPhoneLayout(viewport.matches);
    changed();
    viewport.addEventListener("change", changed);
    return () => viewport.removeEventListener("change", changed);
  }, []);
  const [dimensionOpen, setDimensionOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visualPicker, setVisualPicker] = useState<{
    phone: boolean;
    left: number;
    top: number;
  } | null>(null);
  const [picker, setPicker] = useState<{
    phone: boolean;
    left: number;
    top: number;
  } | null>(null);
  const [dates, setDates] = useState<null | {
    start: string;
    end: string;
    phone: boolean;
    left: number;
    top: number;
  }>(null);
  const [annotations, setAnnotations] = useState(!!existing?.body);
  const [notes, setNotes] = useState(existing?.body ?? "");
  const [baseline] = useState({ draft, notes });
  const changed =
    JSON.stringify(draft) !== JSON.stringify(baseline.draft) ||
    notes !== baseline.notes;
  const [tableVisible, setTableVisible] = useState(true);
  const [queryOpen, setQueryOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const returnConfigureFocus = useRef(false);
  useLayoutEffect(() => {
    if (!more && returnConfigureFocus.current) {
      returnConfigureFocus.current = false;
      toolbarRef.current
        ?.querySelector<HTMLButtonElement>('[data-studio-control="configure"]')
        ?.focus({ preventScroll: true });
    }
  }, [more]);
  const [pageActions, setPageActions] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [comparisonOpen, setComparisonOpen] = useState<{
    top: number;
    left: number;
    phone: boolean;
  } | null>(null);
  const [remove, setRemove] = useState(false);
  const [error, setError] = useState("");
  const title =
    existing?.title ??
    (preset
      ? text(preset.en, preset.bg)
      : draft.metrics.length
        ? draft.metrics
            .map((id) => {
              const metric = explorerMetrics.find((value) => value.id === id)!;
              return text(metric.en, metric.bg);
            })
            .join(", ")
        : text("New exploration", "Нов анализ"));
  const selected = draft.metrics.map((id) =>
    explorerMetrics.find((metric) => metric.id === id)!,
  );
  const metricText = (metric: (typeof explorerMetrics)[number]) =>
    metric.id === "sales" && draft.dimension === "Product"
      ? text("Gross product sales", "Брутни продажби на продукти")
      : text(metric.en, metric.bg);
  const rows = localExplorationRows(
    store,
    draft.metrics,
    draft.start,
    draft.end,
    draft.dimension,
  );
  const totals = localExplorationRows(
    store,
    draft.metrics,
    draft.start,
    draft.end,
    "None",
  )[0].values;
  const comparisonTotals =
    draft.comparison &&
    draft.comparison !== "none" &&
    draft.comparisonStart &&
    draft.comparisonEnd
      ? localExplorationRows(
          store,
          draft.metrics,
          draft.comparisonStart,
          draft.comparisonEnd,
          "None",
        )[0].values
      : undefined;
  const canCompare =
    selected.length > 0 &&
    draft.metrics.every(
      (metric) => metric === "orders" || metric === "sales",
    ) &&
    !!draft.start &&
    !!draft.end;
  const comparisonLabel = comparisonLabels.find(
    ([mode]) => mode === (draft.comparison ?? "none"),
  )!;
  const discard = () => {
    setDraft(baseline.draft);
    setNotes(baseline.notes);
    setQueryOpen(false);
  };
  const dateAnchor = (rect: DOMRect) => {
    const phone = window.innerWidth < 768;
    return {
      phone,
      left: phone
        ? 16
        : Math.max(16, Math.min(rect.left, window.innerWidth - 716)),
      top: Math.max(
        16,
        Math.min(rect.bottom + 4, window.innerHeight - (phone ? 456 : 408)),
      ),
    };
  };
  const format = (value: number, metric: ExplorerMetric) =>
    metric === "sales"
      ? money(value, language)
      : new Intl.NumberFormat(language).format(value);
  const patch = (values: Partial<ReportDraft>) =>
    setDraft({ ...draft, ...values });
  const addMetric = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (window.innerWidth < 768) setMore(true);
    setPicker({
      phone: window.innerWidth < 768,
      left: Math.max(16, Math.min(rect.right - 492, window.innerWidth - 508)),
      top: Math.max(16, Math.min(rect.bottom + 4, window.innerHeight - 700)),
    });
  };
  const dimensionLabel =
    draft.dimension === "Product"
      ? text("Product", "Продукт")
      : draft.dimension === "Customer"
        ? text("Customer", "Клиент")
        : text("Date", "Дата");
  const exportRows = () =>
    downloadCsv("treido-local-exploration.csv", [
      [
        ...(draft.dimension === "None" ? [] : [dimensionLabel]),
        ...selected.map(
          (metric) => `${metricText(metric)}${metric.currency ? " EUR" : ""}`,
        ),
      ],
      ...rows.map((row) => [
        ...(draft.dimension === "None" ? [] : [row.label]),
        ...row.values.map((value, index) =>
          selected[index]?.currency ? (value / 100).toFixed(2) : value,
        ),
      ]),
    ]);
  const save = () => {
    if (!saveTitle?.trim() || !validEditorDraft(draft)) {
      setError(
        text(
          "Add a name and valid report settings.",
          "Добавете име и валидни настройки за отчета.",
        ),
      );
      return;
    }
    const entry: Entry = {
      id: existing?.id ?? `report-${crypto.randomUUID()}`,
      title: saveTitle.trim(),
      body: notes,
      tags: "",
      type: "ReportDraft",
      status: "Draft",
      editorDraft: draft,
    };
    update({ entries: put(store.entries, entry) });
    setSaveTitle(null);
    notify(
      text(
        "Report draft saved locally.",
        "Черновата на отчета е запазена локално.",
      ),
    );
    router.push(href(`reports/${entry.id}`));
  };
  if (id !== "explore" && !existing && !preset)
    return (
      <main className={s.page}>
        <Header
          title={text("Report not found", "Отчетът не е намерен")}
          back={href("reports")}
        />
      </main>
    );
  return (
    <main
      className={styles.root}
      data-studio-part="report-explorer"
      data-studio-builder="report"
    >
      <header
        className={styles.header}
        data-studio-part="report-header"
        data-unsaved={changed}
      >
        {changed && (
          <Button
            className={styles.phoneDiscard}
            plain
            aria-label={text("Discard changes", "Отхвърляне на промените")}
            onClick={discard}
          >
            <AdminIcon name="close" />
          </Button>
        )}
        <Link
          className={styles.back}
          aria-label={text("Back to reports", "Назад към отчетите")}
          href={href("reports")}
        >
          <AdminIcon name="back" />
        </Link>
        <Link className={styles.reportsLink} href={href("reports")}>
          <AdminIcon name="content" />
          {text("Reports", "Отчети")}
          <span>/</span>
        </Link>
        <h1>{title}</h1>
        <div className={styles.headerActions}>
          {changed && (
            <div className={styles.unsaved} data-studio-part="report-unsaved">
              <span>{text("Unsaved changes", "Незапазени промени")}</span>
              <Button onClick={discard}>{text("Discard", "Отхвърляне")}</Button>
            </div>
          )}
          <Button
            disabled
            title={text(
              "Live refresh needs connected analytics.",
              "Обновяването на живо изисква свързан анализ.",
            )}
          >
            {text("Enable auto refresh", "Автоматично обновяване")}
          </Button>
          <Button disabled={!selected.length} onClick={exportRows}>
            {text("Export", "Експорт")}
          </Button>
          {selected.length ? (
            <Button
              primary
              onClick={() =>
                setSaveTitle(
                  existing?.title ??
                    selected
                      .map((metric) => text(metric.en, metric.bg))
                      .join(", "),
                )
              }
            >
              {text("Save draft", "Запази чернова")}
            </Button>
          ) : (
            <Button disabled>{text("Print", "Печат")}</Button>
          )}
        </div>
        <Button
          plain
          aria-label={text("Page actions", "Действия на страницата")}
          aria-expanded={!!pageActions}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setPageActions({
              left: Math.max(16, rect.right - 140),
              top: rect.bottom + 4,
            });
          }}
          className={styles.pageActions}
        >
          <AdminIcon name="more" />
        </Button>
        {changed && (
          <Button
            className={styles.phoneSave}
            plain
            aria-label={text(
              "Save report draft",
              "Запазване на чернова на отчета",
            )}
            onClick={() => setSaveTitle(existing?.title ?? title)}
          >
            <AdminIcon name="check" />
          </Button>
        )}
      </header>
      <div
        ref={toolbarRef}
        className={styles.toolbar}
        data-studio-part="report-toolbar"
      >
        <div className={styles.rangeControls}>
          <Button
            disabled={!selected.length}
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setDates({
                start: draft.start,
                end: draft.end,
                ...dateAnchor(rect),
              });
            }}
          >
            <AdminIcon name="orders" />
            {reportRangeLabel(draft, language)}
            <AdminIcon name="chevron" />
          </Button>
          {!!selected.length && (
            <Button
              disabled={!canCompare}
              onClick={(event) =>
                setComparisonOpen(
                  dateAnchor(event.currentTarget.getBoundingClientRect()),
                )
              }
              title={text(
                "Compares dated local orders and sales. Snapshot metrics cannot be compared.",
                "Сравнява локални поръчки и продажби с дата. Показателите за текущо състояние не могат да се сравняват.",
              )}
            >
              {text(comparisonLabel[1], comparisonLabel[2])}
              <AdminIcon name="chevron" />
            </Button>
          )}
          <Button
            disabled
            title={text(
              "Local money records use EUR.",
              "Локалните парични записи използват EUR.",
            )}
          >
            EUR €
          </Button>
        </div>
        <span />
        <Button
          plain
          disabled={!selected.length}
          aria-label={text("Open annotations panel", "Отваряне на бележките")}
          aria-pressed={annotations}
          onClick={() => setAnnotations(!annotations)}
        >
          <AdminIcon name="content" />
          <span className={styles.controlLabel}>
            {text("Annotations", "Бележки")}
          </span>
        </Button>
        <Button
          plain
          data-studio-control="configure"
          aria-label={text(
            "Toggle exploration panel",
            "Показване на панела за анализ",
          )}
          aria-pressed={phoneLayout ? more : controls}
          onClick={() => {
            if (window.innerWidth < 768) setMore(true);
            else setControls(!controls);
          }}
        >
          <AdminIcon name="filter" />
          <span className={styles.controlLabel}>
            {text("Controls", "Настройки")}
          </span>
        </Button>
      </div>
      <div
        className={styles.layout}
        data-studio-part="report-layout"
        data-controls-open={controls}
      >
        <section
          className={styles.content}
          aria-label={text("Report content", "Съдържание на отчета")}
        >
          <div className={styles.query} data-studio-part="report-query">
            <Button
              plain
              aria-expanded={queryOpen}
              onClick={() => setQueryOpen(!queryOpen)}
            >
              {text(
                "What do you want to explore?",
                "Какво искате да анализирате?",
              )}
              <AdminIcon name="chevron" />
            </Button>
            {queryOpen && (
              <pre>
                {draft.metrics.length
                  ? `${text("Local metrics", "Локални показатели")}: ${draft.metrics.join(", ")}\n${text("Period", "Период")}: ${draft.start || "all"} – ${draft.end || "all"}`
                  : text(
                      "Choose metrics using Controls.",
                      "Изберете показатели от Настройки.",
                    )}
              </pre>
            )}
          </div>
          <div
            className={styles.visual}
            data-studio-part="report-visualization"
            data-has-metrics={!!selected.length}
          >
            {!selected.length ? (
              <div className={styles.empty} data-studio-part="report-empty">
                <ReportEmptyArtwork />
                <p className={styles.desktopEmptyText}>
                  {text(
                    "Start by adding a metric",
                    "Започнете с добавяне на показател",
                  )}
                </p>
                <Button
                  primary
                  onClick={addMetric}
                  className={styles.emptyMetric}
                >
                  {text("Add Metric", "Добави показател")}
                </Button>
                {preset && (
                  <p className={styles.availability}>
                    {text(
                      "This preset needs connected analytics. Choose a local metric to explore saved records.",
                      "Този шаблон изисква свързан анализ. Изберете локален показател за запазените записи.",
                    )}
                  </p>
                )}
              </div>
            ) : (
              <>
                <div
                  className={styles.results}
                  data-studio-part="report-results"
                >
                  <div
                    className={styles.metrics}
                    data-studio-part="report-metrics"
                  >
                    {selected.map((metric, index) => (
                      <div key={metric.id}>
                        <span>{metricText(metric)}</span>
                        <strong>
                          {format(
                            metric.id === "sales" &&
                              draft.dimension === "Product"
                              ? rows.reduce(
                                  (sum, row) => sum + row.values[index],
                                  0,
                                )
                              : totals[index],
                            metric.id,
                          )}
                        </strong>
                        {comparisonTotals && (
                          <small className={styles.comparisonValue}>
                            {text("Previous", "Предишен")}:{" "}
                            {format(comparisonTotals[index], metric.id)}
                            {comparisonTotals[index] !== 0
                              ? ` · ${new Intl.NumberFormat(language, { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" }).format((totals[index] - comparisonTotals[index]) / comparisonTotals[index])}`
                              : ` · ${text("No prior value", "Няма предишна стойност")}`}
                          </small>
                        )}
                      </div>
                    ))}
                  </div>
                  {draft.visualization === "Line" &&
                    draft.dimension === "Date" && (
                      <Chart
                        values={rows.map(
                          (row) =>
                            row.values[0] / (selected[0].currency ? 100 : 1),
                        )}
                      />
                    )}
                  {draft.visualization === "Bar" &&
                    draft.dimension === "Date" && (
                      <div
                        className={styles.barGraph}
                        role="img"
                        aria-label={text(
                          "Local report bar chart",
                          "Стълбовидна графика на локалния отчет",
                        )}
                      >
                        {rows.map((row) => (
                          <div key={row.label}>
                            <span
                              style={{
                                height: `${(row.values[0] / Math.max(1, ...rows.map((value) => value.values[0]))) * 150}px`,
                              }}
                              title={format(row.values[0], selected[0].id)}
                            />
                            <small>{row.label.slice(5)}</small>
                          </div>
                        ))}
                      </div>
                    )}
                  {(draft.visualization === "Table" ||
                    draft.dimension === "Date" ||
                    draft.dimension === "None") && (
                    <div
                      className={styles.tableScroll}
                      data-studio-part="report-table"
                      data-dimension={draft.dimension}
                      data-metric-count={selected.length}
                    >
                      <div
                        className={styles.tableToolbar}
                        data-studio-part="report-table-toolbar"
                      >
                        <Button
                          plain
                          aria-label={
                            tableVisible
                              ? text("Hide table", "Скриване на таблицата")
                              : text("Show table", "Показване на таблицата")
                          }
                          aria-pressed={tableVisible}
                          onClick={() => setTableVisible(!tableVisible)}
                        >
                          <AdminIcon name="content" />
                        </Button>
                      </div>
                      {(phoneLayout || tableVisible) && (
                        <>
                          <table className={s.table}>
                            <thead>
                              <tr>
                                {draft.dimension !== "None" && (
                                  <th>{dimensionLabel}</th>
                                )}
                                {selected.map((metric) => (
                                  <th key={metric.id}>{metricText(metric)}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((row) => (
                                <tr key={row.id}>
                                  {draft.dimension !== "None" && (
                                    <td>
                                      {row.label === "Total"
                                        ? text("Total", "Общо")
                                        : row.label}
                                    </td>
                                  )}
                                  {row.values.map((value, index) => (
                                    <td key={selected[index].id}>
                                      {format(value, selected[index].id)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <footer
                            className={styles.tableFooter}
                            data-studio-part="report-table-footer"
                          >
                            {rows.length}{" "}
                            {rows.length === 1
                              ? text("row", "ред")
                              : text("rows", "реда")}
                          </footer>
                        </>
                      )}
                      {!rows.length && (
                        <p className={styles.noData}>
                          {text(
                            "No local records match this exploration.",
                            "Няма локални записи за този анализ.",
                          )}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <p className={styles.availability}>
                  {text(
                    "Saved local records · customers and inventory show the current snapshot.",
                    "Запазени локални записи · клиентите и наличността показват текущото състояние.",
                  )}
                </p>
              </>
            )}
          </div>
          {annotations && (
            <Field
              label={text("Local report notes", "Локални бележки за отчета")}
            >
              <textarea
                maxLength={2000}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </Field>
          )}
        </section>
        {controls && (
          <aside
            className={styles.controls}
            data-studio-part="report-controls"
            data-has-metrics={!!selected.length}
          >
            {controlBody()}
          </aside>
        )}
      </div>
      {more && (
        <Modal
          title={text("Configure", "Настройки")}
          surface="report-controls"
          onClose={() => {
            returnConfigureFocus.current = true;
            setMore(false);
          }}
        >
          {controlBody(true)}
        </Modal>
      )}
      {pageActions && (
        <ReportPageActions
          anchor={pageActions}
          selected={!!selected.length}
          saved={!!existing}
          onClose={() => setPageActions(null)}
          onExport={exportRows}
          onDelete={() => setRemove(true)}
        />
      )}
      {comparisonOpen && (
        <ReportDatePicker
          range={{
            start: draft.comparisonStart ?? "",
            end: draft.comparisonEnd ?? "",
          }}
          phone={comparisonOpen.phone}
          anchor={comparisonOpen}
          comparison={{ mode: draft.comparison ?? "none", current: draft }}
          onClose={() => setComparisonOpen(null)}
          onApply={(range, mode) => {
            patch({
              comparison: mode ?? "custom",
              comparisonStart: range.start,
              comparisonEnd: range.end,
            });
            setComparisonOpen(null);
          }}
        />
      )}
      {picker && (
        <ReportMetricPicker
          selected={draft.metrics}
          phone={picker.phone}
          anchor={{ left: picker.left, top: picker.top }}
          onClose={() => setPicker(null)}
          onApply={(metrics) => {
            const firstSelection =
              !draft.metrics.length &&
              id === "explore" &&
              !draft.start &&
              !draft.end;
            const today = new Date();
            const start = new Date(
              Date.UTC(
                today.getUTCFullYear(),
                today.getUTCMonth(),
                today.getUTCDate() - 29,
                12,
              ),
            )
              .toISOString()
              .slice(0, 10);
            patch({
              metrics,
              ...(!metrics.every(
                (metric) => metric === "orders" || metric === "sales",
              ) || !metrics.length
                ? { comparison: "none", comparisonStart: "", comparisonEnd: "" }
                : {}),
              ...(firstSelection
                ? { start, end: today.toISOString().slice(0, 10) }
                : {}),
              dimension: supportsDimension(draft.dimension, metrics)
                ? draft.dimension
                : "None",
              visualization: supportsDimension(draft.dimension, metrics)
                ? draft.visualization
                : "Metric",
            });
            setQueryOpen(true);
            setPicker(null);
          }}
        />
      )}
      {dates && (
        <ReportDatePicker
          range={dates}
          anchor={dates}
          phone={dates.phone}
          onClose={() => setDates(null)}
          onApply={(range) => {
            const compared =
              draft.comparison && draft.comparison !== "custom"
                ? reportComparisonRange(range, draft.comparison)
                : undefined;
            patch({
              ...range,
              ...(!range.start || !range.end
                ? { comparison: "none", comparisonStart: "", comparisonEnd: "" }
                : {}),
              ...(compared
                ? {
                    comparisonStart: compared.start,
                    comparisonEnd: compared.end,
                  }
                : {}),
            });
            setDates(null);
          }}
        />
      )}
      {visualPicker && (
        <ReportVisualizationPicker
          phone={visualPicker.phone}
          anchor={visualPicker}
          value={draft.visualization}
          dimension={draft.dimension}
          onClose={() => setVisualPicker(null)}
          onChange={(visualization) => {
            patch({ visualization });
            setVisualPicker(null);
          }}
        />
      )}
      {saveTitle !== null && (
        <Modal
          title={text("Save report draft", "Запазване на чернова на отчета")}
          onClose={() => setSaveTitle(null)}
          footer={
            <Button primary onClick={save}>
              {text("Save draft", "Запази чернова")}
            </Button>
          }
        >
          <Field label={text("Name", "Име")}>
            <input
              data-studio-autofocus
              maxLength={160}
              value={saveTitle}
              onChange={(event) => setSaveTitle(event.target.value)}
            />
          </Field>
          {error && (
            <p role="alert" className={s.error}>
              {error}
            </p>
          )}
        </Modal>
      )}
      {remove && (
        <Confirm
          title={text(
            "Delete local report draft?",
            "Изтриване на локалната чернова?",
          )}
          body={text(
            "This removes this report from the local preview.",
            "Това премахва отчета от локалния преглед.",
          )}
          action={text("Delete draft", "Изтриване на черновата")}
          onClose={() => setRemove(false)}
          onConfirm={() => {
            update({
              entries: store.entries.filter((entry) => entry.id !== id),
            });
            router.push(href("reports"));
          }}
        />
      )}
    </main>
  );
  function controlBody(phone = false) {
    return (
      <>
        {phone ? (
          <section className={styles.method}>
            <h2>{text("Exploration method", "Метод на анализа")}</h2>
            <details>
              <summary>
                {text("Freeform", "Свободен анализ")}
                <AdminIcon name="chevron" />
              </summary>
              <p className={s.help}>
                {text(
                  "Cohorts require connected customer history.",
                  "Кохортите изискват свързана история на клиентите.",
                )}
              </p>
            </details>
          </section>
        ) : (
          <div className={styles.tabs} data-studio-part="report-controls-tabs">
            <button type="button" aria-pressed="true">
              {text("Freeform", "Свободен анализ")}
            </button>
            <button
              type="button"
              disabled
              title={text(
                "Cohorts need customer history.",
                "Кохортите изискват история на клиентите.",
              )}
            >
              {text("Cohorts", "Кохорти")}
            </button>
          </div>
        )}
        <section>
          <h2>
            {text("Metrics", "Показатели")}
            <Button
              plain
              aria-label={text("Add metric", "Добавяне на показател")}
              onClick={addMetric}
            >
              {phone && !selected.length ? (
                text("Add", "Добавяне")
              ) : (
                <AdminIcon name="plus" />
              )}
            </Button>
          </h2>
          {selected.map((metric) => (
            <div className={styles.selectedMetric} key={metric.id}>
              {phone && <span aria-hidden="true">✓</span>}
              <span>{metricText(metric)}</span>
              <Button
                plain
                aria-label={`${text("Remove", "Премахване")} ${text(metric.en, metric.bg)}`}
                onClick={() =>
                  patch({
                    metrics: draft.metrics.filter((id) => id !== metric.id),
                  })
                }
              >
                <AdminIcon name="close" />
              </Button>
            </div>
          ))}
        </section>
        <section>
          <h2>
            {text("Dimensions", "Измерения")}
            <Button
              plain
              aria-label={text("Add dimension", "Добавяне на измерение")}
              disabled={!selected.length}
              aria-expanded={dimensionOpen}
              onClick={() => setDimensionOpen(!dimensionOpen)}
            >
              <AdminIcon name="plus" />
            </Button>
          </h2>
          {(dimensionOpen || draft.dimension !== "None") && (
            <>
              <select
                aria-label={text("Dimension", "Измерение")}
                value={draft.dimension}
                disabled={!selected.length}
                onChange={(event) =>
                  patch({
                    dimension: event.target.value as ReportDraft["dimension"],
                    visualization:
                      event.target.value === "Date"
                        ? draft.visualization
                        : "Table",
                  })
                }
              >
                <option value="None">{text("None", "Без")}</option>
                <option
                  value="Date"
                  disabled={!supportsDimension("Date", draft.metrics)}
                >
                  {text("Date", "Дата")}
                </option>
                <option
                  value="Product"
                  disabled={!supportsDimension("Product", draft.metrics)}
                >
                  {text("Product", "Продукт")}
                </option>
                <option
                  value="Customer"
                  disabled={!supportsDimension("Customer", draft.metrics)}
                >
                  {text("Customer", "Клиент")}
                </option>
              </select>
            </>
          )}
        </section>
        <section>
          <h2>
            {text("Visualization", "Визуализация")}
            {!selected.length && !phone && (
              <Button
                plain
                disabled
                aria-label={text(
                  "Choose visualization",
                  "Избор на визуализация",
                )}
              >
                <AdminIcon name="plus" />
              </Button>
            )}
          </h2>
          {!!selected.length && (
            <Button
              className={styles.visualizationTrigger}
              aria-label={text("Visualization", "Визуализация")}
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                setVisualPicker({
                  phone: window.innerWidth < 768,
                  left: Math.max(
                    16,
                    Math.min(rect.right - 492, window.innerWidth - 508),
                  ),
                  top: Math.max(
                    16,
                    Math.min(rect.bottom + 4, window.innerHeight - 376),
                  ),
                });
              }}
            >
              <span>
                {draft.visualization === "Metric"
                  ? text("Display metric", "Показател")
                  : draft.visualization === "Line"
                    ? text("Line chart", "Линейна графика")
                    : draft.visualization === "Bar"
                      ? text("Bar chart", "Стълбовидна графика")
                      : text("Table", "Таблица")}
              </span>
              {phone &&
                draft.visualization === "Metric" &&
                draft.dimension === "None" && (
                  <small className={styles.recommended}>
                    {text("Recommended", "Препоръчано")}
                  </small>
                )}
              <AdminIcon name="chevron" />
            </Button>
          )}
        </section>
        <section>
          <h2>
            {text("Filters", "Филтри")}
            <Button
              plain
              aria-label={text("Add filter", "Добавяне на филтър")}
              disabled={!selected.length}
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              <AdminIcon name="plus" />
            </Button>
          </h2>
          {filtersOpen && (
            <>
              <Check
                label={text("Saved local records", "Запазени локални записи")}
                checked
                onChange={() => {}}
                disabled
              />
              <p className={s.help}>
                {text(
                  "External event filters require connected analytics.",
                  "Филтрите за външни събития изискват свързан анализ.",
                )}
              </p>
            </>
          )}
        </section>
      </>
    );
  }
}
