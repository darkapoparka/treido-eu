"use client";
import { useLocale as useIntlLocale } from "next-intl";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePreview } from "./context";
import { DraftOrderBuilder } from "./draft-order-builder";
import { money, orderTotal, parseMoney, put, type Order } from "./model";
import {
  Action,
  Badge,
  Button,
  Confirm,
  Empty,
  Field,
  Header,
  Modal,
  Panel,
  TableFooter,
  Toolbar,
  downloadCsv,
  listRows,
  useList,
  s,
} from "./ui";
export function Orders({
  detail,
  drafts = false,
}: {
  detail?: string;
  drafts?: boolean;
}) {
  const intlLocale = useIntlLocale();
  const ui = useTranslations("merchantUI");
  const { store, href, update, notify } = usePreview();
  const list = useList();
  const [cancel, setCancel] = useState(false);
  if (detail === "new") return <DraftOrderBuilder drafts={drafts} />;
  if (detail) return <OrderEditor key={detail} id={detail} drafts={drafts} />;
  const source = store.orders.filter(
    (o) => o.kind === (drafts ? "Draft" : "Order"),
  );
  const rows = listRows(
    source.filter(
      (o) =>
        list.tab === "All" ||
        o.payment === list.tab ||
        o.fulfillment === list.tab,
    ),
    list.query,
    list.sort,
    (o) =>
      `#${o.id} ${customerName(store.customers.find((c) => c.id === o.customerId))}`,
  );
  if (list.sort === "newest")
    rows.sort(
      (a, b) => b.date.localeCompare(a.date) || Number(b.id) - Number(a.id),
    );
  return (
    <main className={s.page} data-studio-part="page">
      <Header
        title={drafts ? ui("drafts") : ui("orders")}
        icon="orders"
        actions={
          <>
            <Button
              onClick={() =>
                downloadCsv("treido-orders.csv", [
                  ["Order", "Customer", "Payment", "Fulfillment", "Total EUR"],
                  ...source.map((o) => [
                    o.id,
                    customerName(
                      store.customers.find((c) => c.id === o.customerId),
                    ),
                    o.payment,
                    o.fulfillment,
                    (orderTotal(o) / 100).toFixed(2),
                  ]),
                ])
              }
            >
              {ui("export")}
            </Button>
            <Action primary href={href(`${drafts ? "drafts" : "orders"}/new`)}>
              {drafts ? ui("createDraftOrder") : ui("createOrder")}
            </Action>
          </>
        }
      />
      {!source.length ? (
        <Empty
          title={
            drafts
              ? ui("createOrdersForYourCustomers")
              : ui("yourOrdersWillShowHere")
          }
          body={
            drafts
              ? ui("buildADraftWithProductsACustomerAndDeliveryDetails")
              : ui("managePurchasesPaymentsAndFulfillmentInOnePlaceCreateA")
          }
        >
          <Action primary href={href(`${drafts ? "drafts" : "orders"}/new`)}>
            {drafts ? ui("createDraftOrder") : ui("createOrder")}
          </Action>
        </Empty>
      ) : (
        <div className={s.tablePanel} data-studio-part="table-panel">
          <Toolbar
            {...list}
            tabs={
              drafts ? ["All"] : ["All", "Unfulfilled", "Paid", "Cancelled"]
            }
          />
          {list.selected.length > 0 && (
            <div className={s.bulk} data-studio-part="bulk">
              <strong>
                {list.selected.length} {ui("selected_d7cbbb")}
              </strong>
              <Button
                onClick={() => {
                  update({
                    orders: store.orders.map((o) =>
                      list.selected.includes(o.id) &&
                      o.fulfillment !== "Cancelled"
                        ? { ...o, fulfillment: "Fulfilled" }
                        : o,
                    ),
                  });
                  list.select([]);
                  notify(ui("selectedPreviewOrdersFulfilled"));
                }}
              >
                {ui("markFulfilled")}
              </Button>
              <Button danger onClick={() => setCancel(true)}>
                {ui("cancelOrders")}
              </Button>
            </div>
          )}
          <div className={s.tableScroll} data-studio-part="table-scroll">
            <table className={s.table} data-studio-part="table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label={ui("selectAllOrders")}
                      checked={
                        !!rows.length &&
                        rows.every((o) => list.selected.includes(o.id))
                      }
                      onChange={(e) =>
                        list.select(
                          e.target.checked ? rows.map((o) => o.id) : [],
                        )
                      }
                      data-ui-label="selectAllOrders"
                    />
                  </th>
                  <th>{ui("order_6be090")}</th>
                  <th>{ui("date")}</th>
                  <th>{ui("customer")}</th>
                  <th>{ui("paymentStatus")}</th>
                  <th>{ui("fulfillmentStatus")}</th>
                  <th>{ui("total")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={ui("selectOrderValue1", {
                          value1: o.id ?? "",
                        })}
                        checked={list.selected.includes(o.id)}
                        onChange={() => list.toggle(o.id)}
                      />
                    </td>
                    <td>
                      <Link
                        className={s.cellLink}
                        data-studio-part="cell-link"
                        href={href(`${drafts ? "drafts" : "orders"}/${o.id}`)}
                      >
                        #{o.id}
                      </Link>
                    </td>
                    <td>{o.date}</td>
                    <td>
                      {customerName(
                        store.customers.find((c) => c.id === o.customerId),
                      )}
                    </td>
                    <td>
                      <Badge>{o.payment}</Badge>
                    </td>
                    <td>
                      <Badge>{o.fulfillment}</Badge>
                    </td>
                    <td>{money(orderTotal(o) - o.refunded, intlLocale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TableFooter count={rows.length} />
        </div>
      )}
      <p className={s.learn} data-studio-part="learn">
        {ui("ordersInThisPreviewUseFictionalDeviceLocalData")}
      </p>
      {cancel && (
        <Confirm
          title={ui("cancelPreviewOrders")}
          body={ui("selectedOrdersWillBeMarkedCancelledInThisFrontendPreview")}
          action={ui("cancelOrders")}
          onClose={() => setCancel(false)}
          onConfirm={() => {
            update({
              orders: store.orders.map((o) =>
                list.selected.includes(o.id)
                  ? { ...o, fulfillment: "Cancelled" }
                  : o,
              ),
            });
            list.select([]);
            notify(ui("previewOrdersCancelled"));
          }}
        />
      )}
    </main>
  );
}
export function customerName(c?: { first: string; last: string }) {
  return c ? `${c.first} ${c.last}`.trim() : "No customer";
}
function OrderEditor({ id, drafts }: { id: string; drafts: boolean }) {
  const intlLocale = useIntlLocale();
  const ui = useTranslations("merchantUI");
  const { store, href, update, notify } = usePreview();
  const router = useRouter();
  const existing = store.orders.find((o) => o.id === id);
  const nextId = String(
    Math.max(1000, ...store.orders.map((o) => Number(o.id) || 1000)) + 1,
  );
  const [order, setOrder] = useState<Order>(
    () =>
      existing ?? {
        id: nextId,
        kind: drafts ? "Draft" : "Order",
        customerId: "",
        lines: [],
        payment: "Pending",
        fulfillment: "Unfulfilled",
        date: new Date().toISOString().slice(0, 10),
        notes: "",
        tracking: "",
        shipping: 0,
        refunded: 0,
      },
  );
  const [productId, setProductId] = useState("");
  const [shipping, setShipping] = useState((order.shipping / 100).toFixed(2));
  const [dialog, setDialog] = useState<"fulfill" | "refund" | "cancel" | null>(
    null,
  );
  const [tracking, setTracking] = useState(order.tracking);
  const [refund, setRefund] = useState("");
  const [error, setError] = useState("");
  const base = order.kind === "Draft" ? "drafts" : "orders";
  const customer = store.customers.find((c) => c.id === order.customerId);
  if (id !== "new" && !existing)
    return (
      <main className={s.editor} data-studio-part="editor">
        <Header
          title={ui("orderNotFound")}
          back={href(drafts ? "drafts" : "orders")}
        />
        <Action href={href(drafts ? "drafts" : "orders")}>
          {ui("backToOrders")}
        </Action>
      </main>
    );
  const commit = (next: Order, message: string) => {
    update({ orders: put(store.orders, next) });
    setOrder(next);
    notify(message);
  };
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const minor = parseMoney(shipping);
    if (
      !order.customerId ||
      !order.lines.length ||
      minor === null ||
      order.lines.some(
        (l) =>
          !Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > 999,
      )
    ) {
      setError(ui("selectACustomerAddAProductAndEnterValidQuantities"));
      return;
    }
    commit({ ...order, shipping: minor }, "Preview order saved.");
    router.push(href(`${base}/${order.id}`));
    setError("");
  };
  return (
    <main className={s.editor} data-studio-part="editor">
      <Header
        title={
          id === "new"
            ? drafts
              ? ui("createDraftOrder")
              : ui("createOrder")
            : `#${order.id}`
        }
        back={href(base)}
        actions={
          existing && order.kind === "Order" ? (
            <>
              <Button
                disabled={
                  order.payment !== "Paid" ||
                  order.refunded >= orderTotal(order)
                }
                onClick={() => {
                  setRefund(
                    ((orderTotal(order) - order.refunded) / 100).toFixed(2),
                  );
                  setError("");
                  setDialog("refund");
                }}
              >
                {ui("refund")}
              </Button>
              <Button
                danger
                disabled={order.fulfillment === "Cancelled"}
                onClick={() => setDialog("cancel")}
              >
                {ui("cancelOrder")}
              </Button>
            </>
          ) : undefined
        }
      />
      <form onSubmit={save}>
        {error && (
          <div role="alert" className={s.error} data-studio-part="error">
            {error}
          </div>
        )}
        <div className={s.editorColumns} data-studio-part="editor-layout">
          <div className={s.stack} data-studio-part="stack">
            <Panel
              title={order.fulfillment}
              action={<Badge>{order.fulfillment}</Badge>}
            >
              <div className={s.tableScroll} data-studio-part="table-scroll">
                <table className={s.table} data-studio-part="table">
                  <thead>
                    <tr>
                      <th>{ui("product")}</th>
                      <th>{ui("quantity")}</th>
                      <th>{ui("total")}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {order.lines.map((line) => (
                      <tr key={line.productId}>
                        <td>
                          {store.products.find((p) => p.id === line.productId)
                            ?.title ?? ui("removedProduct")}
                          <p className={s.help} data-studio-part="field-help">
                            {money(line.price, intlLocale)} {ui("each")}
                          </p>
                        </td>
                        <td>
                          <label className={s.field} data-studio-part="field">
                            <input
                              type="number"
                              min={1}
                              max={999}
                              aria-label={ui("quantityForValue1", {
                                value1:
                                  store.products.find(
                                    (p) => p.id === line.productId,
                                  )?.title ?? line.productId,
                              })}
                              value={line.quantity}
                              onChange={(e) =>
                                setOrder({
                                  ...order,
                                  lines: order.lines.map((l) =>
                                    l.productId === line.productId
                                      ? {
                                          ...l,
                                          quantity: Number(e.target.value),
                                        }
                                      : l,
                                  ),
                                })
                              }
                            />
                          </label>
                        </td>
                        <td>{money(line.price * line.quantity, intlLocale)}</td>
                        <td>
                          <Button
                            plain
                            onClick={() =>
                              setOrder({
                                ...order,
                                lines: order.lines.filter(
                                  (l) => l.productId !== line.productId,
                                ),
                              })
                            }
                            aria-label={ui("removeProduct")}
                            data-ui-label="removeProduct"
                          >
                            ×
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={s.fields} data-studio-part="fields">
                <Field label={ui("addProducts")}>
                  <select
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                  >
                    <option value="">{ui("chooseAProduct")}</option>
                    {store.products
                      .filter((p) => p.status !== "Archived")
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} · {money(p.price, intlLocale)}
                        </option>
                      ))}
                  </select>
                </Field>
                <div className={s.actions} data-studio-part="actions">
                  <Button
                    disabled={!productId}
                    onClick={() => {
                      const p = store.products.find((p) => p.id === productId);
                      if (!p) return;
                      const old = order.lines.find((l) => l.productId === p.id);
                      setOrder({
                        ...order,
                        lines: old
                          ? order.lines.map((l) =>
                              l.productId === p.id
                                ? { ...l, quantity: l.quantity + 1 }
                                : l,
                            )
                          : [
                              ...order.lines,
                              { productId: p.id, quantity: 1, price: p.price },
                            ],
                      });
                      setProductId("");
                    }}
                  >
                    {ui("addProduct")}
                  </Button>
                </div>
              </div>
              {!store.products.length && (
                <Action href={href("products/new")}>
                  {ui("createYourFirstProduct")}
                </Action>
              )}
              {existing && order.kind === "Order" && (
                <Button
                  primary
                  disabled={order.fulfillment !== "Unfulfilled"}
                  onClick={() => {
                    setError("");
                    setDialog("fulfill");
                  }}
                >
                  {ui("fulfillItems")}
                </Button>
              )}
              {order.tracking && (
                <p className={s.help} data-studio-part="field-help">
                  {ui("tracking")} {order.tracking}
                </p>
              )}
            </Panel>
            <Panel
              title={ui("payment")}
              action={<Badge>{order.payment}</Badge>}
            >
              <div className={s.dataRow} data-studio-part="data-row">
                <span>{ui("subtotal")}</span>
                <span>
                  {money(
                    order.lines.reduce(
                      (total, l) => total + l.price * l.quantity,
                      0,
                    ),
                    intlLocale,
                  )}
                </span>
              </div>
              <Field label={ui("shippingEUR")}>
                <input
                  inputMode="decimal"
                  value={shipping}
                  onChange={(e) => setShipping(e.target.value)}
                />
              </Field>
              <div className={s.dataRow} data-studio-part="data-row">
                <strong>{ui("total")}</strong>
                <strong>
                  {money(
                    orderTotal({
                      ...order,
                      shipping: parseMoney(shipping) ?? 0,
                    }),
                    intlLocale,
                  )}
                </strong>
              </div>
              {order.refunded > 0 && (
                <div className={s.dataRow} data-studio-part="data-row">
                  <span>{ui("refunded")}</span>
                  <span>{money(order.refunded, intlLocale)}</span>
                </div>
              )}
              {existing && order.payment === "Pending" && (
                <Button
                  onClick={() =>
                    commit(
                      { ...order, payment: "Paid" },
                      "Preview payment marked as paid. No funds moved.",
                    )
                  }
                >
                  {ui("markAsPaid")}
                </Button>
              )}
              {existing && order.kind === "Draft" && (
                <Button
                  primary
                  onClick={() => {
                    commit(
                      { ...order, kind: "Order" },
                      "Draft converted to a preview order.",
                    );
                    router.push(href(`orders/${order.id}`));
                  }}
                >
                  {ui("createOrderFromDraft")}
                </Button>
              )}
            </Panel>
            <Panel title={ui("timeline")}>
              <p className={s.help} data-studio-part="field-help">
                {order.date} ·{" "}
                {existing
                  ? ui("orderSavedInLocalPreview")
                  : ui("orderBeingPrepared")}
              </p>
              {order.fulfillment === "Fulfilled" && (
                <p>
                  {ui("itemsMarkedFulfilled")}{" "}
                  {order.tracking ? `· ${order.tracking}` : ""}
                </p>
              )}
              {order.payment === "Paid" && <p>{ui("paymentStatusPaid")}</p>}
              {order.refunded > 0 && (
                <p>
                  {ui("previewRefundRecorded")}{" "}
                  {money(order.refunded, intlLocale)}
                </p>
              )}
              <Field label={ui("notes")}>
                <textarea
                  maxLength={2000}
                  value={order.notes}
                  onChange={(e) =>
                    setOrder({ ...order, notes: e.target.value })
                  }
                />
              </Field>
            </Panel>
          </div>
          <aside className={s.editorSide} data-studio-part="editor-side">
            <Panel title={ui("customer")}>
              <Field label={ui("selectCustomer")}>
                <select
                  required
                  value={order.customerId}
                  onChange={(e) =>
                    setOrder({ ...order, customerId: e.target.value })
                  }
                >
                  <option value="">{ui("searchCustomers")}</option>
                  {store.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {customerName(c)}
                    </option>
                  ))}
                </select>
              </Field>
              <Action href={href("customers/new")}>{ui("addCustomer")}</Action>
              {customer && (
                <>
                  <Link
                    className={s.link}
                    data-studio-part="link"
                    href={href(`customers/${customer.id}`)}
                  >
                    {customerName(customer)}
                  </Link>
                  <p>{customer.email}</p>
                  <h3>{ui("shippingAddress")}</h3>
                  <p>
                    {customer.address || ui("noStreetAddress")}
                    <br />
                    {customer.postcode} {customer.city}
                    <br />
                    {customer.country}
                  </p>
                </>
              )}
            </Panel>
            <Panel title={ui("orderDetails")}>
              <Field label={ui("orderDate")}>
                <input
                  type="date"
                  required
                  value={order.date}
                  onChange={(e) => setOrder({ ...order, date: e.target.value })}
                />
              </Field>
              <p className={s.help} data-studio-part="field-help">
                {ui("allOrderEffectsAreSimulatedOnThisDevice")}
              </p>
            </Panel>
          </aside>
        </div>
        <div className={s.saveBar} data-studio-part="save-bar">
          <Action href={href(base)}>{ui("cancel")}</Action>
          <Button primary type="submit">
            {ui("saveOrder")}
          </Button>
        </div>
      </form>
      {dialog === "fulfill" && (
        <Modal
          title={ui("fulfillPreviewOrder")}
          onClose={() => setDialog(null)}
          footer={
            <>
              <Button onClick={() => setDialog(null)}>{ui("cancel")}</Button>
              <Button
                primary
                onClick={() => {
                  commit(
                    { ...order, fulfillment: "Fulfilled", tracking },
                    "Preview fulfillment saved. No shipment was booked.",
                  );
                  setDialog(null);
                }}
              >
                {ui("markFulfilled")}
              </Button>
            </>
          }
        >
          <Field label={ui("trackingNumber")}>
            <input
              value={tracking}
              maxLength={120}
              onChange={(e) => setTracking(e.target.value)}
            />
          </Field>
          <p className={s.help} data-studio-part="field-help">
            {ui("reviewTheFulfillmentStateWithoutBookingACarrier")}
          </p>
        </Modal>
      )}
      {dialog === "refund" && (
        <Modal
          title={ui("refundPreviewOrder")}
          onClose={() => setDialog(null)}
          footer={
            <>
              <Button onClick={() => setDialog(null)}>{ui("cancel")}</Button>
              <Button
                primary
                onClick={() => {
                  const amount = parseMoney(refund);
                  if (
                    amount === null ||
                    amount <= 0 ||
                    amount > orderTotal(order) - order.refunded
                  ) {
                    setError(ui("enterARefundWithinTheRemainingOrderBalance"));
                    return;
                  }
                  const refunded = order.refunded + amount;
                  commit(
                    {
                      ...order,
                      refunded,
                      payment:
                        refunded === orderTotal(order) ? "Refunded" : "Paid",
                    },
                    "Preview refund recorded. No funds moved.",
                  );
                  setDialog(null);
                  setError("");
                }}
              >
                {ui("recordRefund")}
              </Button>
            </>
          }
        >
          <Field label={ui("refundAmountEUR")}>
            <input
              inputMode="decimal"
              value={refund}
              onChange={(e) => setRefund(e.target.value)}
            />
          </Field>
          <p>
            {ui("availableToRefund")}{" "}
            {money(orderTotal(order) - order.refunded, intlLocale)}
          </p>
          {error && (
            <p role="alert" className={s.error} data-studio-part="error">
              {error}
            </p>
          )}
        </Modal>
      )}
      {dialog === "cancel" && (
        <Confirm
          title={ui("cancelPreviewOrder")}
          body={ui("thisMarksTheOrderCancelledOnThisDeviceNoCustomers")}
          action={ui("cancelOrder")}
          onClose={() => setDialog(null)}
          onConfirm={() =>
            commit(
              { ...order, fulfillment: "Cancelled" },
              "Preview order cancelled.",
            )
          }
        />
      )}
    </main>
  );
}
