"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCaption } from "../../locale/use-caption";
import { AdminIcon } from "../admin-icons";
import { usePreview } from "./context";
import { money, orderTotal, put } from "./model";
import { customerName } from "./orders";
import { customerMatchesSegment, segmentConditions } from "./segments-model";
import { Action, Button, Check, Field, Header, Modal, s } from "./ui";
import styles from "./segment-builder.module.css";

export function SegmentBuilder({ id }: { id: string }) {
  const { store, href, text, language, update, notify } = usePreview();
  const router = useRouter();
  const caption = useCaption();
  const existing = store.entries.find(
    (entry) => entry.type === "Segment" && entry.id === id,
  );
  const [title, setTitle] = useState(existing?.title ?? "");
  const [condition, setCondition] = useState(existing?.body ?? "");
  const [editor, setEditor] = useState(false);
  useEffect(() => {
    const breakpoint = window.matchMedia("(min-width: 768px)");
    const updateEditor = () => setEditor(breakpoint.matches);
    updateEditor();
    breakpoint.addEventListener("change", updateEditor);
    return () => breakpoint.removeEventListener("change", updateEditor);
  }, []);
  const [query, setQuery] = useState("");
  const [display, setDisplay] = useState(false);
  const [email, setEmail] = useState(true);
  const [location, setLocation] = useState(true);
  const [sort, setSort] = useState("name");
  const [error, setError] = useState("");
  const rows = store.customers
    .filter(
      (customer) =>
        customerMatchesSegment(store, customer, condition) &&
        `${customerName(customer)} ${customer.email}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    )
    .sort((a, b) =>
      sort === "name"
        ? customerName(a).localeCompare(customerName(b))
        : customerName(b).localeCompare(customerName(a)),
    );
  if (id !== "new" && !existing)
    return (
      <main className={s.page}>
        <Header
          title={text("Segment not found", "Сегментът не е намерен")}
          back={href("segments")}
        />
      </main>
    );
  return (
    <main
      className={`${s.page} ${styles.root}`}
      data-studio-part="page"
      data-studio-builder="segment"
    >
      <Header
        title={existing?.title ?? text("New segment", "Нов сегмент")}
        back={href("segments")}
        actions={
          <Button
            primary
            disabled={!title.trim()}
            onClick={() => {
              if (
                !title.trim() ||
                !segmentConditions.some((value) => value === condition)
              ) {
                setError(
                  text(
                    "Choose a supported filter and enter a name.",
                    "Изберете поддържан филтър и въведете име.",
                  ),
                );
                return;
              }
              update({
                entries: put(store.entries, {
                  id: existing?.id ?? `segment-${crypto.randomUUID()}`,
                  title: title.trim(),
                  body: condition,
                  type: "Segment",
                  status: "Active",
                  tags: "",
                }),
              });
              notify(
                text(
                  "Customer segment saved locally.",
                  "Клиентският сегмент е запазен локално.",
                ),
              );
              router.push(href("segments"));
            }}
          >
            {text("Save", "Запазване")}
          </Button>
        }
      />
      <div className={styles.editor} data-studio-part="segment-editor">
        {editor && (
          <div className={styles.summary}>
            <strong>
              {rows.length} {text("customers", "клиенти")}
            </strong>
            <span>
              {store.customers.length
                ? Math.round((rows.length / store.customers.length) * 100)
                : 0}
              % {text("of preview customers", "от примерните клиенти")}
            </span>
          </div>
        )}
        {editor && (
          <div className={styles.fields}>
            <Field label={text("Segment name", "Име на сегмента")}>
              <input
                value={title}
                maxLength={100}
                onChange={(event) => setTitle(event.target.value)}
              />
            </Field>
            <Field label={text("Customers matching", "Клиенти, отговарящи на")}>
              <select
                value={condition}
                onChange={(event) => setCondition(event.target.value)}
              >
                <option value="">
                  {text("Choose a filter", "Изберете филтър")}
                </option>
                {segmentConditions.map((value) => (
                  <option key={value} value={value}>
                    {caption(value)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
        <div className={styles.describe}>
          <span>
            {condition
              ? caption(condition)
              : text("Describe your segment", "Опишете сегмента")}
          </span>
          <Button
            plain
            aria-label={text(
              "Toggle Editor",
              "Показване или скриване на редактора",
            )}
            aria-expanded={editor}
            onClick={() => setEditor(!editor)}
          >
            <span aria-hidden="true">⌄</span>
          </Button>
        </div>
      </div>
      <div className={styles.results} data-studio-part="segment-results">
        <div className={styles.search}>
          <AdminIcon name="search" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={text("Search customers", "Търсене на клиенти")}
            aria-label={text("Search customers", "Търсене на клиенти")}
          />
          <Button onClick={() => setDisplay(true)}>
            {text("Display options", "Опции за изгледа")}
          </Button>
        </div>
        {rows.length ? (
          <table className={s.table} data-studio-part="table">
            <thead>
              <tr>
                <th>{text("Customer", "Клиент")}</th>
                {email && (
                  <th>{text("Email subscription", "Абонамент по имейл")}</th>
                )}
                {location && <th>{text("Location", "Местоположение")}</th>}
                <th>{text("Orders", "Поръчки")}</th>
                <th>{text("Amount spent", "Похарчена сума")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((customer) => {
                const orders = store.orders.filter(
                  (order) =>
                    order.kind === "Order" &&
                    order.fulfillment !== "Cancelled" &&
                    order.customerId === customer.id,
                );
                return (
                  <tr key={customer.id}>
                    <td>
                      <Link href={href(`customers/${customer.id}`)}>
                        {customerName(customer)}
                      </Link>
                      <small>{customer.email}</small>
                    </td>
                    {email && (
                      <td>
                        {customer.marketing
                          ? text("Subscribed", "Абониран")
                          : text("Not subscribed", "Не е абониран")}
                      </td>
                    )}
                    {location && (
                      <td>
                        {customer.city}, {caption(customer.country)}
                      </td>
                    )}
                    <td>{orders.length}</td>
                    <td>
                      {money(
                        orders
                          .filter((order) => order.payment !== "Pending")
                          .reduce(
                            (sum, order) =>
                              sum + orderTotal(order) - order.refunded,
                            0,
                          ),
                        language,
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className={styles.empty}>
            <strong>
              {text(
                "No customers match this segment criteria",
                "Няма клиенти, отговарящи на условията на сегмента",
              )}
            </strong>
            <p>
              {text(
                "Try editing the segment to view matching customers.",
                "Редактирайте сегмента, за да видите отговарящите клиенти.",
              )}
            </p>
          </div>
        )}
      </div>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      <p className={s.learn}>
        {text(
          "Segments filter fictional records on this device. No customer communication is sent.",
          "Сегментите филтрират примерните записи на това устройство. Не се изпращат съобщения на клиенти.",
        )}
      </p>
      {display && (
        <Modal
          title={text("Display options", "Опции за изгледа")}
          surface="segment-display"
          onClose={() => setDisplay(false)}
        >
          <Field label={text("Sort by", "Подреждане")}>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="name">{text("Name A–Z", "Име А–Я")}</option>
              <option value="reverse">{text("Name Z–A", "Име Я–А")}</option>
            </select>
          </Field>
          <Check
            label={text("Email subscription", "Абонамент по имейл")}
            checked={email}
            onChange={() => setEmail(!email)}
          />
          <Check
            label={text("Location", "Местоположение")}
            checked={location}
            onChange={() => setLocation(!location)}
          />
          <Action href={href("customers")}>
            {text("All customers", "Всички клиенти")}
          </Action>
        </Modal>
      )}
    </main>
  );
}
