"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminIcon } from "../admin-icons";
import { usePreview } from "./context";
import { money, orderTotal, parseMoney, put, type Order } from "./model";
import { customerName } from "./orders";
import {
  Action,
  Button,
  Check,
  EditorSection,
  EditorBreadcrumb,
  Field,
  Header,
  Modal,
  Panel,
  s,
} from "./ui";
import styles from "./draft-order-builder.module.css";

export function DraftOrderBuilder({ drafts }: { drafts: boolean }) {
  const { store, href, text, update, notify, language } = usePreview();
  const router = useRouter();
  const [order, setOrder] = useState<Order>({
    id: "new",
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
    tags: "",
  });
  const [dialog, setDialog] = useState<
    "products" | "customer" | "notes" | "shipping" | null
  >(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [shipping, setShipping] = useState("0.00");
  const [notesDraft, setNotesDraft] = useState("");
  const [error, setError] = useState("");
  const customer = store.customers.find(
    (value) => value.id === order.customerId,
  );
  const products = store.products.filter(
    (product) =>
      product.status !== "Archived" &&
      product.title.toLowerCase().includes(query.toLowerCase()),
  );
  const hasCatalog = store.products.some(
    (product) => product.status !== "Archived",
  );
  const subtotal = order.lines.reduce(
    (value, line) => value + line.price * line.quantity,
    0,
  );
  const openProducts = () => {
    setQuery("");
    setSelected(order.lines.map((line) => line.productId));
    setDialog("products");
  };
  const save = () => {
    if (
      !order.customerId ||
      !order.lines.length ||
      order.lines.some(
        (line) =>
          !Number.isInteger(line.quantity) ||
          line.quantity < 1 ||
          line.quantity > 999,
      )
    ) {
      setError(
        text(
          "Select a customer and add products with valid quantities.",
          "Изберете клиент и добавете продукти с валидни количества.",
        ),
      );
      return;
    }
    const id = String(
      Math.max(1000, ...store.orders.map((value) => Number(value.id) || 1000)) +
        1,
    );
    update({ orders: put(store.orders, { ...order, id }) });
    notify(
      text(
        "Order saved in this device's preview. No payment is created.",
        "Поръчката е запазена в прегледа на устройството. Не е създадено плащане.",
      ),
    );
    router.push(href(`${drafts ? "drafts" : "orders"}/${id}`));
  };
  return (
    <main
      className={s.editor}
      data-studio-part="editor"
      data-studio-builder="draft"
    >
      <EditorBreadcrumb
        href={href(drafts ? "drafts" : "orders")}
        title={drafts ? text("Drafts", "Чернови") : text("Orders", "Поръчки")}
        icon="orders"
      />
      <Header title={text("Create order", "Създаване на поръчка")} />
      <div className={s.editorColumns} data-studio-part="editor-layout">
        <div className={s.stack} data-studio-part="editor-main">
          <section data-studio-part="draft-products">
            <h2 className={styles.heading}>{text("Products", "Продукти")}</h2>
            {order.lines.length > 0 && (
              <Panel>
                <div className={styles.lines}>
                  {order.lines.map((line) => (
                    <div key={line.productId}>
                      <div>
                        <strong>
                          {store.products.find(
                            (product) => product.id === line.productId,
                          )?.title ||
                            text("Removed product", "Премахнат продукт")}
                        </strong>
                        <p className={s.help}>
                          {money(line.price, language)}{" "}
                          {text("each", "за брой")}
                        </p>
                      </div>
                      <input
                        type="number"
                        aria-label={`${text("Quantity for", "Количество за")} ${store.products.find((product) => product.id === line.productId)?.title}`}
                        min={1}
                        max={999}
                        value={line.quantity}
                        onChange={(event) =>
                          setOrder({
                            ...order,
                            lines: order.lines.map((value) =>
                              value.productId === line.productId
                                ? {
                                    ...value,
                                    quantity: Number(event.target.value),
                                  }
                                : value,
                            ),
                          })
                        }
                      />
                      <span>{money(line.price * line.quantity, language)}</span>
                      <Button
                        plain
                        aria-label={text(
                          "Remove product",
                          "Премахване на продукт",
                        )}
                        onClick={() =>
                          setOrder({
                            ...order,
                            lines: order.lines.filter(
                              (value) => value.productId !== line.productId,
                            ),
                          })
                        }
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              </Panel>
            )}
            <div className={styles.addProducts}>
              <Button
                disabled
                title={text(
                  "Custom order items are not supported by this preview.",
                  "Персонални артикули не се поддържат в този преглед.",
                )}
              >
                {text("Custom item", "Персонален артикул")}
              </Button>
              <Button onClick={openProducts}>
                <AdminIcon name="plus" />
                {text("Product", "Продукт")}
              </Button>
            </div>
          </section>
          <EditorSection
            title={text("Payment", "Плащане")}
            part="draft-payment"
          >
            <div className={styles.payment} data-studio-part="draft-payment">
              <div>
                <span>{text("Subtotal", "Междинна сума")}</span>
                <span>{money(subtotal, language)}</span>
              </div>
              <div>
                <Button
                  plain
                  disabled
                  title={text(
                    "Order discounts are not calculated in this preview.",
                    "Отстъпки за поръчки не се изчисляват в този преглед.",
                  )}
                >
                  {text("Add discount", "Добавяне на отстъпка")}
                </Button>
                <span>—</span>
              </div>
              <div>
                <Button
                  plain
                  onClick={() => {
                    setShipping((order.shipping / 100).toFixed(2));
                    setDialog("shipping");
                  }}
                >
                  {text("Add shipping or delivery", "Добавяне на доставка")}
                </Button>
                <span>{money(order.shipping, language)}</span>
              </div>
              <div>
                <span>{text("Estimated tax", "Прогнозен данък")}</span>
                <span>—</span>
              </div>
              <div>
                <strong>{text("Total", "Общо")}</strong>
                <strong>{money(orderTotal(order), language)}</strong>
              </div>
            </div>
            <p className={styles.paymentFooter}>
              {text(
                "Device-local order. No payment or customer notification is created.",
                "Локална поръчка. Не се създава плащане или известие до клиента.",
              )}
            </p>
          </EditorSection>
        </div>
        <aside className={s.editorSide} data-studio-part="editor-side">
          <Panel
            title={text("Notes", "Бележки")}
            part="draft-notes"
            action={
              <Button
                plain
                aria-label={text("Edit notes", "Редактиране на бележки")}
                onClick={() => {
                  setNotesDraft(order.notes);
                  setDialog("notes");
                }}
              >
                <AdminIcon name="plus" />
              </Button>
            }
          >
            {order.notes && <p className={s.muted}>{order.notes}</p>}
          </Panel>
          <Panel title={text("Customer", "Клиент")} part="draft-customer">
            {customer ? (
              <>
                <strong>{customerName(customer)}</strong>
                <p className={s.help}>{customer.email}</p>
                <Button
                  onClick={() => {
                    setQuery("");
                    setDialog("customer");
                  }}
                >
                  {text("Change customer", "Промяна на клиента")}
                </Button>
              </>
            ) : (
              <Button
                className={styles.customerTrigger}
                data-studio-part="draft-customer-trigger"
                aria-label={text(
                  "Search or create a customer",
                  "Търсене или създаване на клиент",
                )}
                onClick={() => {
                  setQuery("");
                  setDialog("customer");
                }}
              >
                <AdminIcon name="search" />
                <span>
                  {text(
                    "Search or create a customer",
                    "Търсене или създаване на клиент",
                  )}
                </span>
              </Button>
            )}
          </Panel>
          <Panel title={text("Markets", "Пазари")} part="draft-markets">
            <p>{store.settings.country} · EUR</p>
            <p className={s.help}>
              {text(
                "Product prices stay in EUR in this preview.",
                "Цените на продуктите остават в EUR в този преглед.",
              )}
            </p>
          </Panel>
          <Panel title={text("Tags", "Етикети")} part="draft-tags">
            <Field label={text("Order tags", "Етикети на поръчката")}>
              <input
                maxLength={300}
                value={order.tags}
                onChange={(event) =>
                  setOrder({ ...order, tags: event.target.value })
                }
              />
            </Field>
          </Panel>
        </aside>
      </div>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      <div className={s.saveBar} data-studio-part="save-bar">
        <Action href={href(drafts ? "drafts" : "orders")}>
          {text("Cancel", "Отказ")}
        </Action>
        <Button primary onClick={save}>
          {text("Save order", "Запазване на поръчката")}
        </Button>
      </div>
      {dialog && (
        <Modal
          title={
            dialog === "products"
              ? text("Select products", "Избор на продукти")
              : dialog === "customer"
                ? text("Select customer", "Избор на клиент")
                : dialog === "notes"
                  ? text("Notes", "Бележки")
                  : text("Shipping and delivery", "Доставка")
          }
          onClose={() => {
            setDialog(null);
            setError("");
          }}
          surface={`draft-${dialog}`}
          footer={
            <>
              {dialog === "products" && (
                <span
                  className={styles.selectionCount}
                  data-studio-part="draft-selection-count"
                >
                  {selected.length}{" "}
                  {text("products selected", "избрани продукта")}
                </span>
              )}
              <Button
                onClick={() => {
                  setDialog(null);
                  setError("");
                }}
              >
                {text("Cancel", "Отказ")}
              </Button>
              <Button
                primary
                disabled={dialog === "products" && !selected.length}
                onClick={() => {
                  if (dialog === "products")
                    setOrder({
                      ...order,
                      lines: selected.map((productId) => {
                        const existing = order.lines.find(
                          (line) => line.productId === productId,
                        );
                        const product = store.products.find(
                          (value) => value.id === productId,
                        );
                        return (
                          existing ?? {
                            productId,
                            quantity: 1,
                            price: product?.price ?? 0,
                          }
                        );
                      }),
                    });
                  if (dialog === "notes")
                    setOrder({ ...order, notes: notesDraft });
                  if (dialog === "shipping") {
                    const minor = parseMoney(shipping);
                    if (minor === null) {
                      setError(
                        text(
                          "Enter a valid shipping amount.",
                          "Въведете валидна сума за доставка.",
                        ),
                      );
                      return;
                    }
                    setOrder({ ...order, shipping: minor });
                  }
                  setDialog(null);
                  setError("");
                }}
              >
                {dialog === "products"
                  ? text("Add", "Добавяне")
                  : text("Done", "Готово")}
              </Button>
            </>
          }
        >
          {dialog === "products" && (
            <>
              {hasCatalog && (
                <Field label={text("Search products", "Търсене на продукти")}>
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    maxLength={160}
                  />
                </Field>
              )}
              {products.map((product) => (
                <Check
                  key={product.id}
                  label={`${product.title} · ${money(product.price, language)}`}
                  checked={selected.includes(product.id)}
                  onChange={() =>
                    setSelected(
                      selected.includes(product.id)
                        ? selected.filter((value) => value !== product.id)
                        : [...selected, product.id],
                    )
                  }
                />
              ))}
              {!products.length && (
                <div className={styles.empty}>
                  <span aria-hidden="true">∅</span>
                  {text("No products found", "Няма намерени продукти")}
                </div>
              )}
            </>
          )}
          {dialog === "customer" && (
            <>
              <Field label={text("Search customers", "Търсене на клиенти")}>
                <input
                  type="search"
                  maxLength={160}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </Field>
              {store.customers
                .filter((value) =>
                  `${customerName(value)} ${value.email}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((value) => (
                  <Button
                    key={value.id}
                    onClick={() => {
                      setOrder({ ...order, customerId: value.id });
                      setDialog(null);
                    }}
                  >
                    {customerName(value)} · {value.email}
                  </Button>
                ))}
              <Action href={href("customers/new")}>
                {text("Create customer", "Създаване на клиент")}
              </Action>
            </>
          )}
          {dialog === "notes" && (
            <Field label={text("Order notes", "Бележки за поръчката")}>
              <textarea
                maxLength={2000}
                value={notesDraft}
                onChange={(event) => setNotesDraft(event.target.value)}
              />
            </Field>
          )}
          {dialog === "shipping" && (
            <Field
              label={text("Shipping amount (EUR)", "Сума за доставка (EUR)")}
            >
              <input
                inputMode="decimal"
                value={shipping}
                maxLength={12}
                onChange={(event) => setShipping(event.target.value)}
              />
            </Field>
          )}
          {error && (
            <p className={s.error} role="alert">
              {error}
            </p>
          )}
        </Modal>
      )}
    </main>
  );
}
