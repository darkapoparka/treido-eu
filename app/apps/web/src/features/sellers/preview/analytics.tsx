"use client";
import { useLocale as useIntlLocale } from "next-intl";
import { useCaption } from "../../locale/use-caption";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { usePreview } from "./context";
import { money, orderTotal, type Order } from "./model";
import { customerName } from "./orders";
import { AdminIcon } from "../admin-icons";
import { ReportDirectory } from "./report-directory";
import { ReportExplorer } from "./report-explorer";
import { UnavailableSurface } from "./unavailable-surface";
import {
  Action,
  Badge,
  Button,
  Chart,
  Field,
  Header,
  Modal,
  Panel,
  TableFooter,
  downloadCsv,
  s,
} from "./ui";
export function ordersInPeriod(
  orders: readonly Order[],
  start: string,
  end: string,
) {
  return orders.filter(
    (o) =>
      o.kind === "Order" &&
      o.date >= start &&
      o.date <= end &&
      o.fulfillment !== "Cancelled",
  );
}
export function Analytics({
  reports = false,
  detail,
}: {
  reports?: boolean;
  detail?: string;
}) {
  const intlLocale = useIntlLocale();
  const ui = useTranslations("merchantUI");
  const { store, href, text } = usePreview();
  const [start, setStart] = useState("2026-09-03");
  const [end, setEnd] = useState("2026-10-02");
  const [dates, setDates] = useState(false);
  const [compare, setCompare] = useState(false);
  const [intro, setIntro] = useState(true);
  const [more, setMore] = useState(false);
  const [report, setReport] = useState(detail ?? "sales");
  const rows = ordersInPeriod(store.orders, start, end);
  const paid = rows.filter((o) => o.payment !== "Pending");
  const total = paid.reduce((v, o) => v + orderTotal(o) - o.refunded, 0);
  const returning = store.customers.filter(
    (c) => rows.filter((o) => o.customerId === c.id).length > 1,
  ).length;
  const daily = Array.from(new Set(paid.map((o) => o.date)))
    .sort()
    .map((date) =>
      paid
        .filter((o) => o.date === date)
        .reduce((v, o) => v + orderTotal(o) - o.refunded, 0),
    );
  const exportReport = () => {
    if (reports && report === "inventory") {
      downloadCsv("treido-inventory-report.csv", [
        ["Product", "SKU", "Available", "Stock value EUR"],
        ...store.products.map((p) => [
          p.title,
          p.sku,
          p.quantity,
          ((p.price * p.quantity) / 100).toFixed(2),
        ]),
      ]);
      return;
    }
    if (reports && report === "products") {
      downloadCsv("treido-product-sales.csv", [
        ["Product", "Units sold", "Gross product sales EUR"],
        ...store.products.map((p) => {
          const lines = paid
            .flatMap((o) => o.lines)
            .filter((l) => l.productId === p.id);
          return [
            p.title,
            lines.reduce((v, l) => v + l.quantity, 0),
            (lines.reduce((v, l) => v + l.quantity * l.price, 0) / 100).toFixed(
              2,
            ),
          ];
        }),
      ]);
      return;
    }
    if (reports && report === "customers") {
      downloadCsv("treido-customer-sales.csv", [
        ["Customer", "Orders", "Sales EUR"],
        ...store.customers.map((c) => {
          const orders = paid.filter((o) => o.customerId === c.id);
          return [
            customerName(c),
            orders.length,
            (
              orders.reduce((v, o) => v + orderTotal(o) - o.refunded, 0) / 100
            ).toFixed(2),
          ];
        }),
      ]);
      return;
    }
    downloadCsv("treido-report.csv", [
      ["Order", "Date", "Customer", "Total EUR", "Payment", "Fulfillment"],
      ...rows.map((o) => [
        o.id,
        o.date,
        customerName(store.customers.find((c) => c.id === o.customerId)),
        ((orderTotal(o) - o.refunded) / 100).toFixed(2),
        o.payment,
        o.fulfillment,
      ]),
    ]);
  };
  const validStart = /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : "2026-09-03";
  const validEnd = /^\d{4}-\d{2}-\d{2}$/.test(end) ? end : validStart;
  const previousEnd = new Date(`${validStart}T12:00:00Z`);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
  const duration = Math.max(
    1,
    Math.round((Date.parse(validEnd) - Date.parse(validStart)) / 86400000) + 1,
  );
  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousStart.getUTCDate() - duration + 1);
  const previous = ordersInPeriod(
    store.orders,
    previousStart.toISOString().slice(0, 10),
    previousEnd.toISOString().slice(0, 10),
  );
  const previousTotal = previous
    .filter((o) => o.payment !== "Pending")
    .reduce((v, o) => v + orderTotal(o) - o.refunded, 0);
  if (reports && !detail) return <ReportDirectory />;
  if (reports && detail) return <ReportExplorer key={detail} id={detail} />;
  return (
    <main className={s.page} data-studio-part="page">
      <Header
        title={reports ? ui("reports") : ui("analytics")}
        icon="analytics"
        actions={
          <>
            <Button data-studio-part="analytics-export" onClick={exportReport}>
              {ui("export")}
            </Button>
            {reports ? (
              <Action href={href("analytics")}>{ui("dashboard")}</Action>
            ) : (
              <Action primary href={href("reports")}>
                {ui("newExploration")}
              </Action>
            )}
            <Button
              plain
              data-studio-part="analytics-more"
              aria-label={text("More actions", "Още действия")}
              aria-haspopup="dialog"
              onClick={() => setMore(true)}
            >
              <AdminIcon name="more" />
            </Button>
          </>
        }
      />
      {!reports && intro && (
        <div className={s.analyticsIntro} data-studio-part="analytics-intro">
          <span aria-hidden="true">ⓘ</span>
          <p>
            {text(
              "Explore store performance using the orders saved in this preview.",
              "Разгледайте представянето на магазина с поръчките, запазени в този преглед.",
            )}
          </p>
          <Button
            plain
            onClick={() => setIntro(false)}
            aria-label={ui("dismissAnalyticsIntroduction")}
            data-ui-label="dismissAnalyticsIntroduction"
          >
            ×
          </Button>
        </div>
      )}
      <div
        className={s.actions}
        data-studio-part="analytics-period"
        style={{ marginBottom: 16 }}
      >
        <Button onClick={() => setDates(true)}>
          {start === end ? start : `${start.slice(5)} – ${end.slice(5)}`}
        </Button>
        <Button onClick={() => setCompare(!compare)}>
          {compare ? ui("comparingPreviousPeriod") : ui("noComparison")}
        </Button>
        <Badge>EUR · preview data</Badge>
      </div>
      {compare && (
        <div
          className={s.success}
          data-studio-part="success"
          style={{ marginBottom: 16 }}
        >
          {ui("previousPeriod")} {money(previousTotal, intlLocale)} ·{" "}
          {previous.length} {ui("ordersCurrentChange")}{" "}
          {previousTotal
            ? `${Math.round(((total - previousTotal) / previousTotal) * 100)}%`
            : ui("noPreviousSales")}
          .
        </div>
      )}
      {reports ? (
        <div className={s.stack} data-studio-part="stack">
          <Panel title={ui("exploreYourData")}>
            <div
              className={s.tabs}
              data-studio-part="list-tabs"
              role="tablist"
              aria-label={ui("report")}
              data-ui-label="report"
            >
              {[
                { id: "sales", title: "Sales over time" },
                { id: "products", title: "Sales by product" },
                { id: "customers", title: "Sales by customer" },
                { id: "inventory", title: "Inventory report" },
              ].map((v) => (
                <button
                  role="tab"
                  key={v.id}
                  className={s.tab}
                  data-studio-part="list-tab"
                  aria-selected={report === v.id}
                  onClick={() => setReport(v.id)}
                >
                  {v.title}
                </button>
              ))}
            </div>
            {report === "sales" ? (
              <>
                <Chart values={daily.map((v) => v / 100)} />
                <div className={s.tableScroll} data-studio-part="table-scroll">
                  <table className={s.table} data-studio-part="table">
                    <thead>
                      <tr>
                        <th>{ui("order_6be090")}</th>
                        <th>{ui("date")}</th>
                        <th>{ui("total")}</th>
                        <th>{ui("payment")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((o) => (
                        <tr key={o.id}>
                          <td>
                            <Link href={href(`orders/${o.id}`)}>#{o.id}</Link>
                          </td>
                          <td>{o.date}</td>
                          <td>
                            {money(orderTotal(o) - o.refunded, intlLocale)}
                          </td>
                          <td>
                            <Badge>{o.payment}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : report === "customers" ? (
              <div className={s.tableScroll} data-studio-part="table-scroll">
                <table className={s.table} data-studio-part="table">
                  <thead>
                    <tr>
                      <th>{ui("customer")}</th>
                      <th>{ui("orders")}</th>
                      <th>{ui("sales")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {store.customers.map((c) => {
                      const orders = paid.filter((o) => o.customerId === c.id);
                      return (
                        <tr key={c.id}>
                          <td>{customerName(c)}</td>
                          <td>{orders.length}</td>
                          <td>
                            {money(
                              orders.reduce(
                                (v, o) => v + orderTotal(o) - o.refunded,
                                0,
                              ),
                              intlLocale,
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={s.tableScroll} data-studio-part="table-scroll">
                <table className={s.table} data-studio-part="table">
                  <thead>
                    <tr>
                      <th>{ui("product")}</th>
                      <th>
                        {report === "inventory"
                          ? ui("available")
                          : ui("unitsSold")}
                      </th>
                      <th>
                        {report === "inventory"
                          ? ui("stockValue")
                          : ui("grossProductSales")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {store.products.map((p) => {
                      const lines = paid
                        .flatMap((o) => o.lines)
                        .filter((l) => l.productId === p.id);
                      return (
                        <tr key={p.id}>
                          <td>{p.title}</td>
                          <td>
                            {report === "inventory"
                              ? p.quantity
                              : lines.reduce((v, l) => v + l.quantity, 0)}
                          </td>
                          <td>
                            {money(
                              report === "inventory"
                                ? p.quantity * p.price
                                : lines.reduce(
                                    (v, l) => v + l.quantity * l.price,
                                    0,
                                  ),
                              intlLocale,
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <TableFooter
              count={
                report === "sales"
                  ? rows.length
                  : report === "customers"
                    ? store.customers.length
                    : store.products.length
              }
            />
          </Panel>
        </div>
      ) : (
        <>
          <div
            className={`${s.metricGrid} ${s.analyticsMetrics}`}
            data-studio-part="analytics-metrics"
          >
            <Panel title={ui("grossSales")}>
              <p className={s.metric} data-studio-part="metric">
                {money(total, intlLocale)}
              </p>
            </Panel>
            <Panel title={ui("returningCustomers")}>
              <p className={s.metric} data-studio-part="metric">
                {returning}
              </p>
            </Panel>
            <Panel title={ui("ordersFulfilled")}>
              <p className={s.metric} data-studio-part="metric">
                {rows.filter((o) => o.fulfillment === "Fulfilled").length}
              </p>
            </Panel>
            <Panel title={ui("orders")}>
              <p className={s.metric} data-studio-part="metric">
                {rows.length}
              </p>
            </Panel>
          </div>
          <div className={s.charts} data-studio-part="charts">
            <section
              className={`${s.panel} ${s.chartWide}`}
              data-studio-part="analytics-chart"
            >
              <Link
                href={href("reports/sales")}
                className={s.reportHeading}
                data-studio-part="report-heading"
              >
                <h2>{ui("totalSalesOverTime")}</h2>
              </Link>
              <p className={s.metric} data-studio-part="metric">
                {money(total, intlLocale)}
              </p>
              <Chart values={daily.map((v) => v / 100)} />
            </section>
            <Panel title={ui("totalSalesBreakdown")}>
              <div className={s.dataRow} data-studio-part="data-row">
                <span>{ui("productSales")}</span>
                <span>
                  {money(
                    paid.reduce(
                      (v, o) =>
                        v +
                        o.lines.reduce((a, l) => a + l.price * l.quantity, 0),
                      0,
                    ),
                    intlLocale,
                  )}
                </span>
              </div>
              <div className={s.dataRow} data-studio-part="data-row">
                <span>{ui("discounts")}</span>
                <span>{money(0, intlLocale)}</span>
              </div>
              <div className={s.dataRow} data-studio-part="data-row">
                <span>{ui("salesReversals")}</span>
                <span>
                  −
                  {money(
                    paid.reduce((v, o) => v + o.refunded, 0),
                    intlLocale,
                  )}
                </span>
              </div>
              <div className={s.dataRow} data-studio-part="data-row">
                <span>{ui("netSales")}</span>
                <span>
                  {money(
                    paid.reduce(
                      (v, o) =>
                        v +
                        o.lines.reduce((a, l) => a + l.price * l.quantity, 0) -
                        o.refunded,
                      0,
                    ),
                    intlLocale,
                  )}
                </span>
              </div>
              <div className={s.dataRow} data-studio-part="data-row">
                <span>{ui("shipping")}</span>
                <span>
                  {money(
                    paid.reduce((v, o) => v + o.shipping, 0),
                    intlLocale,
                  )}
                </span>
              </div>
              <div className={s.dataRow} data-studio-part="data-row">
                <span>{ui("taxes")}</span>
                <span>—</span>
              </div>
              <div className={s.dataRow} data-studio-part="data-row">
                <strong>{ui("totalSales")}</strong>
                <strong>{money(total, intlLocale)}</strong>
              </div>
            </Panel>
            <Panel title={ui("averageOrderValue")}>
              <p className={s.metric} data-studio-part="metric">
                {money(
                  paid.length ? Math.round(total / paid.length) : 0,
                  intlLocale,
                )}
              </p>
              <Chart
                values={paid.map((o) => (orderTotal(o) - o.refunded) / 100)}
              />
            </Panel>
            <Panel title={ui("salesByProduct")}>
              {store.products.slice(0, 4).map((p) => (
                <div
                  key={p.id}
                  className={s.dataRow}
                  data-studio-part="data-row"
                >
                  <span>{p.title}</span>
                  <span>
                    {money(
                      paid
                        .flatMap((o) => o.lines)
                        .filter((l) => l.productId === p.id)
                        .reduce((v, l) => v + l.price * l.quantity, 0),
                      intlLocale,
                    )}
                  </span>
                </div>
              ))}
              {!store.products.length && (
                <p className={s.muted} data-studio-part="muted">
                  {ui("noDataForThisDateRange")}
                </p>
              )}
            </Panel>
            <Panel title={ui("ordersByFulfillment")}>
              <div className={s.dataRow} data-studio-part="data-row">
                <span>{ui("fulfilled")}</span>
                <span>
                  {rows.filter((o) => o.fulfillment === "Fulfilled").length}
                </span>
              </div>
              <div className={s.dataRow} data-studio-part="data-row">
                <span>{ui("unfulfilled")}</span>
                <span>
                  {rows.filter((o) => o.fulfillment === "Unfulfilled").length}
                </span>
              </div>
            </Panel>
          </div>
        </>
      )}
      {more && (
        <Modal
          title={text("More actions", "Още действия")}
          onClose={() => setMore(false)}
        >
          <Button
            onClick={() => {
              exportReport();
              setMore(false);
            }}
          >
            {ui("export")}
          </Button>
        </Modal>
      )}
      {dates && (
        <Modal
          title={ui("dateRange")}
          onClose={() => setDates(false)}
          footer={
            <Button
              primary
              disabled={!start || !end || end < start}
              onClick={() => setDates(false)}
            >
              {ui("apply")}
            </Button>
          }
        >
          <div className={s.actions} data-studio-part="actions">
            {[
              { title: "Today", start: "2026-10-02" },
              { title: "Last 7 days", start: "2026-09-26" },
              { title: "Last 30 days", start: "2026-09-03" },
            ].map((v) => (
              <Button
                key={v.title}
                onClick={() => {
                  setStart(v.start);
                  setEnd("2026-10-02");
                }}
              >
                {v.title}
              </Button>
            ))}
          </div>
          <div className={s.fields} data-studio-part="fields">
            <Field label={ui("startDate")}>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </Field>
            <Field label={ui("endDate")}>
              <input
                type="date"
                min={start}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </Field>
          </div>
        </Modal>
      )}
    </main>
  );
}
export function Finance({
  section,
  detail,
}: {
  section: "finance" | "payouts" | "billing";
  detail?: string;
}) {
  const intlLocale = useIntlLocale();
  const caption = useCaption();
  const ui = useTranslations("merchantUI");
  const { store, href } = usePreview();
  const [documents, setDocuments] = useState(false);
  const [status, setStatus] = useState("All");
  const paid = store.orders.filter(
    (o) =>
      o.kind === "Order" &&
      o.payment !== "Pending" &&
      o.fulfillment !== "Cancelled",
  );
  const balance = paid.reduce((v, o) => v + orderTotal(o) - o.refunded, 0);
  if (section === "payouts" && detail !== "preview")
    return <UnavailableSurface section="payouts" />;
  return (
    <main className={`${s.page} ${section === "finance" ? s.financePage : ""}`}>
      {section === "finance" ? (
        <header className={s.financeActions} data-studio-part="finance-actions">
          <Button onClick={() => setDocuments(true)}>{ui("documents")}</Button>
        </header>
      ) : (
        <Header
          title={section === "payouts" ? ui("payouts") : ui("billing")}
          icon="finance"
          actions={
            <Button onClick={() => setDocuments(true)}>
              {ui("documents_b4e929")}
            </Button>
          }
        />
      )}
      <div
        className={`${s.stack} ${section === "finance" ? s.financeContent : ""}`}
      >
        {section === "finance" ? (
          <>
            <h1 className={s.financeTitle} data-studio-part="finance-title">
              {ui("finance")}
            </h1>
            <div
              className={s.securityBanner}
              data-studio-part="security-banner"
            >
              <div>
                <h2>{ui("reviewYourAccountSecurity")}</h2>
                <p>
                  {ui("checkTeamAccessBeforeConnectingYourBusinessAccounts")}
                </p>
                <Action primary href={href("team")}>
                  {ui("reviewTeamAccess")}
                </Action>
              </div>
              <svg viewBox="0 0 140 88" aria-hidden="true">
                <rect
                  x="8"
                  y="21"
                  width="102"
                  height="60"
                  rx="3"
                  fill="#e8eeee"
                  stroke="#7c8a89"
                  strokeWidth="3"
                />
                <path d="M0 81h117v5H0Z" fill="#a7b3b2" />
                <rect
                  x="87"
                  y="6"
                  width="33"
                  height="61"
                  rx="3"
                  fill="#eef4f4"
                  stroke="#7c8a89"
                  strokeWidth="3"
                />
                <path
                  d="m53 33 9 4v10c0 9-9 15-9 15s-9-6-9-15V37l9-4Z"
                  fill="#a9b8b3"
                />
                <path
                  d="m48 45 4 4 7-8"
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                />
                <rect
                  x="40"
                  y="67"
                  width="26"
                  height="4"
                  rx="2"
                  fill="#23734b"
                />
                <rect
                  x="95"
                  y="54"
                  width="17"
                  height="4"
                  rx="2"
                  fill="#23734b"
                />
              </svg>
            </div>
            <div className={s.financeGrid} data-studio-part="finance-grid">
              <section>
                <h2>{ui("taxes")}</h2>
                <Link
                  href={href("settings/taxes")}
                  className={s.taxLink}
                  data-studio-part="tax-link"
                >
                  <span>{ui("setUpTaxDisplay")}</span>
                  <span>›</span>
                </Link>
              </section>
              <section>
                <h2>{ui("previewPayoutBalance")}</h2>
                <div className={s.payoutPanel} data-studio-part="payout-panel">
                  <div>
                    <strong>{money(balance, intlLocale)}</strong>
                    <Link href={href("payouts")}>{ui("viewPayouts")}</Link>
                  </div>
                  <div
                    className={s.currencyBalance}
                    data-studio-part="currency-balance"
                  >
                    <span>🇪🇺 EUR</span>
                    <span>{money(balance, intlLocale)}</span>
                  </div>
                </div>
                <p className={s.learn} data-studio-part="learn">
                  {ui("fictionalOrders")}{" "}
                  <Link
                    className={s.link}
                    data-studio-part="link"
                    href={href("billing")}
                  >
                    {ui("billingOverview")}
                  </Link>
                </p>
              </section>
            </div>
          </>
        ) : section === "payouts" ? (
          <>
            <Panel title={ui("previewBalance")}>
              <p className={s.metric} data-studio-part="metric">
                {money(balance, intlLocale)}
              </p>
              <p className={s.help} data-studio-part="field-help">
                {ui("simulatedPayoutEntriesForFrontendReview")}
              </p>
            </Panel>
            <div className={s.tablePanel} data-studio-part="table-panel">
              <div className={s.toolbar} data-studio-part="list-toolbar">
                <div
                  className={s.tabs}
                  data-studio-part="list-tabs"
                  role="tablist"
                  aria-label={ui("payoutStatus")}
                  data-ui-label="payoutStatus"
                >
                  {["All", "Pending", "Paid"].map((v) => (
                    <button
                      key={v}
                      role="tab"
                      className={s.tab}
                      data-studio-part="list-tab"
                      aria-selected={status === v}
                      onClick={() => setStatus(v)}
                    >
                      {caption(v)}
                    </button>
                  ))}
                </div>
              </div>
              <table className={s.table} data-studio-part="table">
                <thead>
                  <tr>
                    <th>{ui("reference")}</th>
                    <th>{ui("date")}</th>
                    <th>{ui("status")}</th>
                    <th>{ui("amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {paid
                    .filter(() => status !== "Paid")
                    .map((o) => (
                      <tr key={o.id}>
                        <td>
                          <Link href={href(`orders/${o.id}`)}>
                            {ui("pREVIEW")}
                            {o.id}
                          </Link>
                        </td>
                        <td>{o.date}</td>
                        <td>
                          <Badge>Pending</Badge>
                        </td>
                        <td>{money(orderTotal(o) - o.refunded, intlLocale)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
              <TableFooter count={status === "Paid" ? 0 : paid.length} />
            </div>
          </>
        ) : (
          <>
            <Panel title={ui("currentPlan")}>
              <div className={s.dataRow} data-studio-part="data-row">
                <strong>{store.settings.plan}</strong>
                <Action href={href("settings/plan")}>{ui("managePlan")}</Action>
              </div>
              <p className={s.help} data-studio-part="field-help">
                {ui("planSelectionIsPreviewStateNoSubscriptionIsActivated")}
              </p>
            </Panel>
            <Panel title={ui("billingInformation")}>
              <div className={s.dataRow} data-studio-part="data-row">
                <div>
                  <h3>{store.settings.name}</h3>
                  <p>{store.settings.email}</p>
                </div>
                <Action href={href("settings/billing")}>
                  {ui("editDetails")}
                </Action>
              </div>
            </Panel>
            <Panel title={ui("pastBills")}>
              <p className={s.muted} data-studio-part="muted">
                {ui("noInvoicesThisFrontendPreviewHasNoBillingProvider")}
              </p>
            </Panel>
          </>
        )}
      </div>
      {documents && (
        <Modal
          title={ui("financeDocuments")}
          onClose={() => setDocuments(false)}
          footer={
            <Button onClick={() => setDocuments(false)}>{ui("close")}</Button>
          }
        >
          <p>{ui("exportTheFictionalOrderDataUsedInTheFinancePreview")}</p>
          <Button
            onClick={() =>
              downloadCsv("treido-preview-finance.csv", [
                ["Reference", "Date", "Gross EUR", "Refund EUR", "Net EUR"],
                ...paid.map((o) => [
                  o.id,
                  o.date,
                  (orderTotal(o) / 100).toFixed(2),
                  (o.refunded / 100).toFixed(2),
                  ((orderTotal(o) - o.refunded) / 100).toFixed(2),
                ]),
              ])
            }
          >
            {ui("downloadPreviewStatement")}
          </Button>
        </Modal>
      )}
    </main>
  );
}
