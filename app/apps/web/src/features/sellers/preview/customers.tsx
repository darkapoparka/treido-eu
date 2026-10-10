"use client";
import { useLocale as useIntlLocale } from "next-intl";
import { useCaption } from "../../locale/use-caption";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminIcon } from "../admin-icons";
import { usePreview } from "./context";
import { money, orderTotal, put, type Customer } from "./model";
import { customerName } from "./orders";
import { SegmentBuilder } from "./segment-builder";
import draftStyles from "./local-draft-editors.module.css";
import { customerMatchesSegment } from "./segments-model";
import {
  Action,
  Badge,
  Button,
  Check,
  Confirm,
  Empty,
  Field,
  EditorSection,
  Header,
  EditorBreadcrumb,
  Modal,
  Panel,
  TableFooter,
  Toolbar,
  downloadCsv,
  listRows,
  useList,
  s,
} from "./ui";
export function Customers({ detail }: { detail?: string }) {
  const intlLocale = useIntlLocale();
  const ui = useTranslations("merchantUI");
  const { store, href, update, notify } = usePreview();
  const list = useList();
  const [remove, setRemove] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [guide, setGuide] = useState(false);
  if (detail) return <CustomerEditor key={detail} id={detail} />;
  const rows = listRows(
    store.customers.filter((c) => {
      const condition = store.entries.find(
        (e) => e.id === list.tab && e.type === "Segment",
      )?.body;
      return (
        list.tab === "All" ||
        (list.tab === "Email subscribers"
          ? c.marketing
          : condition === "All customers"
            ? true
            : condition === "Returning customers"
              ? store.orders.filter(
                  (o) => o.kind === "Order" && o.customerId === c.id,
                ).length > 1
              : condition === "Email subscribers"
                ? c.marketing
                : c.country === condition)
      );
    }),
    list.query,
    list.sort,
    (c) => `${customerName(c)} ${c.email}`,
  );
  return (
    <main className={s.page} data-studio-part="page">
      <Header
        title={ui("customers")}
        icon="customers"
        actions={
          <>
            <Button
              onClick={() =>
                downloadCsv("treido-customers.csv", [
                  ["First name", "Last name", "Email", "City", "Country"],
                  ...store.customers.map((c) => [
                    c.first,
                    c.last,
                    c.email,
                    c.city,
                    c.country,
                  ]),
                ])
              }
            >
              {ui("export")}
            </Button>
            <Button onClick={() => setImportOpen(true)}>{ui("import")}</Button>
            <Action primary href={href("customers/new")}>
              {ui("addCustomer")}
            </Action>
          </>
        }
      />
      <div className={s.segmentPrompt} data-studio-part="segment-prompt">
        <select
          aria-label={ui("customerSegment")}
          value={list.tab}
          onChange={(e) => list.onTab(e.target.value)}
          data-ui-label="customerSegment"
        >
          <option value="All">{ui("allCustomers")}</option>
          <option value="Email subscribers">{ui("emailSubscribers")}</option>
          {store.entries
            .filter((e) => e.type === "Segment")
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
        </select>
        <Link
          className={s.button}
          data-studio-part="button"
          href={href("segments")}
        >
          {ui("manageSegments")}
        </Link>
      </div>
      <div className={`${s.tablePanel} ${s.customerPanel}`}>
        <Toolbar {...list} tabs={["All", "Email subscribers"]} />
        {list.selected.length > 0 && (
          <div className={s.bulk} data-studio-part="bulk">
            <strong>
              {list.selected.length} {ui("selected_d7cbbb")}
            </strong>
            <Button danger onClick={() => setRemove(true)}>
              {ui("deleteFromPreview")}
            </Button>
          </div>
        )}
        {!!rows.length && (
          <div className={s.tableScroll} data-studio-part="table-scroll">
            <table className={s.table} data-studio-part="table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label={ui("selectAllCustomers")}
                      checked={
                        !!rows.length &&
                        rows.every((c) => list.selected.includes(c.id))
                      }
                      onChange={(e) =>
                        list.select(
                          e.target.checked ? rows.map((c) => c.id) : [],
                        )
                      }
                      data-ui-label="selectAllCustomers"
                    />
                  </th>
                  <th>{ui("customerName")}</th>
                  <th>{ui("emailSubscription")}</th>
                  <th>{ui("location")}</th>
                  <th>{ui("orders")}</th>
                  <th>{ui("amountSpent")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const orders = store.orders.filter(
                    (o) => o.customerId === c.id && o.kind === "Order",
                  );
                  return (
                    <tr key={c.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={ui("selectValue1", {
                            value1: customerName(c),
                          })}
                          checked={list.selected.includes(c.id)}
                          onChange={() => list.toggle(c.id)}
                        />
                      </td>
                      <td>
                        <Link
                          className={s.cellLink}
                          data-studio-part="cell-link"
                          href={href(`customers/${c.id}`)}
                        >
                          {customerName(c)}
                        </Link>
                        <p className={s.help} data-studio-part="field-help">
                          {c.email}
                        </p>
                      </td>
                      <td>
                        <Badge>
                          {c.marketing ? ui("subscribed") : ui("notSubscribed")}
                        </Badge>
                      </td>
                      <td>{[c.city, c.country].filter(Boolean).join(", ")}</td>
                      <td>{orders.length}</td>
                      <td>
                        {money(
                          orders
                            .filter((o) => o.payment !== "Pending")
                            .reduce(
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
        )}
        {!rows.length && (
          <div className={s.customersEmpty} data-studio-part="customers-empty">
            <AdminIcon name="search" />
            <h2>
              {store.customers.length
                ? ui("noCustomersFound")
                : ui("noCustomersYet")}
            </h2>
            <p className={s.muted} data-studio-part="muted">
              {ui("yourCustomerProfilesAndPurchaseHistoryWillAppearHere")}
            </p>
          </div>
        )}
        {!!rows.length && <TableFooter count={rows.length} />}
      </div>
      {!rows.length && (
        <p className={s.learn} data-studio-part="learn">
          <Button plain onClick={() => setGuide(true)}>
            {ui("learnMoreAboutCustomers")}
          </Button>
        </p>
      )}
      {guide && (
        <Modal
          title={ui("customers")}
          onClose={() => setGuide(false)}
          footer={
            <Action primary href={href("customers/new")}>
              {ui("addCustomer")}
            </Action>
          }
        >
          <p>
            {ui("customerProfilesKeepContactDetailsOrderHistoryNotesAndTags")}
          </p>
          <p>
            {ui("useSegmentsToFilterYourAudienceByLocationPurchaseHistory")}
          </p>
        </Modal>
      )}
      {remove && (
        <Confirm
          title={ui("deletePreviewCustomers")}
          body={ui(
            "thisRemovesTheSelectedProfilesFromThisDeviceExistingOrders",
          )}
          action={ui("delete")}
          onClose={() => setRemove(false)}
          onConfirm={() => {
            update({
              customers: store.customers.filter(
                (c) => !list.selected.includes(c.id),
              ),
            });
            list.select([]);
            notify(ui("previewCustomersRemoved"));
          }}
        />
      )}
      {importOpen && (
        <Modal
          title={ui("importPreviewCustomers")}
          onClose={() => setImportOpen(false)}
          footer={
            <>
              <Button onClick={() => setImportOpen(false)}>
                {ui("cancel")}
              </Button>
              <Button
                primary
                onClick={() => {
                  const lines = input.trim().split(/\r?\n/);
                  if (!input.trim() || lines.length > 100) {
                    setError(ui("enterBetween1And100Customers"));
                    return;
                  }
                  const values = lines.map((v) =>
                    v.split(",").map((c) => c.trim()),
                  );
                  if (
                    values.some(
                      (v) =>
                        v.length !== 3 || !v[0] || !/^\S+@\S+\.\S+$/.test(v[2]),
                    )
                  ) {
                    setError(ui("useFirstNameLastNameEmailOnEachLine"));
                    return;
                  }
                  const customers = values.map((v) => ({
                    ...emptyCustomer(`customer-${crypto.randomUUID()}`),
                    first: v[0],
                    last: v[1],
                    email: v[2],
                  }));
                  update({ customers: [...store.customers, ...customers] });
                  notify(
                    ui("value1FictionalCustomerProfilesImported", {
                      value1: customers.length ?? "",
                    }),
                  );
                  setImportOpen(false);
                  setInput("");
                }}
              >
                {ui("importToPreview")}
              </Button>
            </>
          }
        >
          <p>{ui("pasteFictionalContactsForReviewUseFirstNameLastName")}</p>
          <Field label={ui("customerRows")}>
            <textarea
              value={input}
              maxLength={25000}
              placeholder="Alex,Sample,alex@example.com"
              onChange={(e) => {
                setInput(e.target.value);
                setError("");
              }}
            />
          </Field>
          {error && (
            <p className={s.error} data-studio-part="error" role="alert">
              {error}
            </p>
          )}
        </Modal>
      )}
    </main>
  );
}
function emptyCustomer(id: string): Customer {
  return {
    id,
    first: "",
    last: "",
    email: "",
    phone: "",
    city: "",
    country: "Bulgaria",
    address: "",
    postcode: "",
    notes: "",
    tags: "",
    marketing: false,
  };
}
function CustomerEditor({ id }: { id: string }) {
  const intlLocale = useIntlLocale();
  const caption = useCaption();
  const ui = useTranslations("merchantUI");
  const { store, href, update, notify, text } = usePreview();
  const router = useRouter();
  const existing = store.customers.find((c) => c.id === id);
  const [customer, setCustomer] = useState<Customer>(
    () => existing ?? emptyCustomer("new"),
  );
  const [address, setAddress] = useState(false);
  const [notes, setNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [remove, setRemove] = useState(false);
  const [error, setError] = useState("");
  const patch = (change: Partial<Customer>) =>
    setCustomer({ ...customer, ...change });
  const orders = store.orders.filter(
    (o) => o.customerId === id && o.kind === "Order",
  );
  if (id !== "new" && !existing)
    return (
      <main className={s.editor} data-studio-part="editor">
        <Header title={ui("customerNotFound")} back={href("customers")} />
        <Action href={href("customers")}>{ui("backToCustomers")}</Action>
      </main>
    );
  return (
    <main
      className={s.editor}
      data-studio-part="editor"
      data-studio-builder="customer"
    >
      <EditorBreadcrumb
        href={href("customers")}
        title={ui("customers")}
        icon="customers"
      />
      <Header
        title={existing ? customerName(customer) : ui("newCustomer")}
        actions={
          existing && (
            <Button danger onClick={() => setRemove(true)}>
              {ui("deleteCustomer")}
            </Button>
          )
        }
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (
            !customer.first.trim() ||
            !/^\S+@\S+\.\S+$/.test(customer.email)
          ) {
            setError(ui("enterAFirstNameAndAValidEmailAddress"));
            return;
          }
          const saved = {
            ...customer,
            id: existing ? id : `customer-${crypto.randomUUID()}`,
          };
          update({ customers: put(store.customers, saved) });
          notify(ui("customerSavedInThisPreview"));
          router.push(href(`customers/${saved.id}`));
        }}
      >
        {error && (
          <p className={s.error} data-studio-part="error" role="alert">
            {error}
          </p>
        )}
        <div className={s.editorColumns} data-studio-part="editor-layout">
          <div className={s.stack} data-studio-part="editor-main">
            {existing && (
              <Panel title={ui("customerOverview")}>
                <div className={s.fields} data-studio-part="fields">
                  <div>
                    <h3>{ui("amountSpent")}</h3>
                    <p className={s.metric} data-studio-part="metric">
                      {money(
                        orders
                          .filter((o) => o.payment !== "Pending")
                          .reduce((v, o) => v + orderTotal(o) - o.refunded, 0),
                        intlLocale,
                      )}
                    </p>
                  </div>
                  <div>
                    <h3>{ui("orders")}</h3>
                    <p className={s.metric} data-studio-part="metric">
                      {orders.length}
                    </p>
                  </div>
                </div>
              </Panel>
            )}
            <EditorSection
              part="customer-overview"
              title={
                existing ? ui("contactInformation") : ui("customerOverview")
              }
            >
              <div className={s.fields} data-studio-part="fields">
                <Field label={ui("firstName")}>
                  <input
                    required
                    value={customer.first}
                    maxLength={80}
                    onChange={(e) => patch({ first: e.target.value })}
                  />
                </Field>
                <Field label={ui("lastName")}>
                  <input
                    value={customer.last}
                    maxLength={80}
                    onChange={(e) => patch({ last: e.target.value })}
                  />
                </Field>
              </div>
              <Field
                label={text("Language", "Език")}
                help={text(
                  "The language used for this customer's preview preferences.",
                  "Езикът за предпочитанията на клиента в прегледа.",
                )}
              >
                <select
                  value={customer.language ?? "English"}
                  onChange={(event) =>
                    patch({
                      language: event.target.value as "English" | "Bulgarian",
                    })
                  }
                >
                  <option value="English">
                    {text("English", "Английски")}
                  </option>
                  <option value="Bulgarian">
                    {text("Bulgarian", "Български")}
                  </option>
                </select>
              </Field>
              <Field label={ui("email")}>
                <input
                  type="email"
                  required
                  value={customer.email}
                  maxLength={160}
                  onChange={(e) => patch({ email: e.target.value })}
                />
              </Field>
              <Field label={ui("phoneNumber")}>
                <div
                  className={s.phoneField}
                  data-studio-part="customer-phone-field"
                >
                  <div
                    className={draftStyles.phoneCountry}
                    data-studio-part="customer-phone-country"
                  >
                    <span aria-hidden="true">
                      {customer.phoneCountry ??
                        (customer.country === "Greece"
                          ? "GR"
                          : customer.country === "Romania"
                            ? "RO"
                            : "BG")}
                    </span>
                    <select
                      aria-label={text(
                        "Phone country",
                        "Държава за телефонния номер",
                      )}
                      value={
                        customer.phoneCountry ??
                        (customer.country === "Greece"
                          ? "GR"
                          : customer.country === "Romania"
                            ? "RO"
                            : "BG")
                      }
                      onChange={(event) =>
                        patch({
                          phoneCountry: event.target
                            .value as Customer["phoneCountry"],
                        })
                      }
                    >
                      <option value="BG">🇧🇬 +359</option>
                      <option value="GR">🇬🇷 +30</option>
                      <option value="RO">🇷🇴 +40</option>
                      <option value="DE">🇩🇪 +49</option>
                      <option value="GB">🇬🇧 +44</option>
                    </select>
                  </div>
                  <input
                    type="tel"
                    aria-label={ui("phoneNumber")}
                    value={customer.phone}
                    maxLength={40}
                    onChange={(e) => patch({ phone: e.target.value })}
                  />
                </div>
              </Field>
              <Check
                label={ui("customerAgreedToReceiveMarketingEmails")}
                checked={customer.marketing}
                onChange={() => patch({ marketing: !customer.marketing })}
              />
              <Check
                label={text(
                  "Customer agreed to receive SMS marketing text messages.",
                  "Клиентът е съгласен да получава маркетингови SMS съобщения.",
                )}
                checked={false}
                disabled
                onChange={() => {}}
              />
              <Check
                label={text(
                  "Customer agreed to receive WhatsApp marketing messages.",
                  "Клиентът е съгласен да получава маркетингови WhatsApp съобщения.",
                )}
                checked={false}
                disabled
                onChange={() => {}}
              />
              <p className={s.help} data-studio-part="customer-footer">
                {ui("previewPreferenceOnlyNoEmailsAreSent")}
              </p>
            </EditorSection>
            <EditorSection
              title={ui("defaultAddress")}
              part="customer-address"
              description={text(
                "The primary address of this customer",
                "Основният адрес на този клиент",
              )}
            >
              {customer.address && (
                <p>
                  {customer.address}
                  <br />
                  {customer.postcode} {customer.city}
                  <br />
                  {customer.country}
                </p>
              )}
              <Button
                plain
                data-studio-part="customer-address-button"
                onClick={() => setAddress(true)}
              >
                <AdminIcon name="plus" />
                {customer.address ? ui("edit") : ui("addAddress")}
                <AdminIcon name="chevron" />
              </Button>
            </EditorSection>
            {existing && (
              <Panel title={ui("recentOrders")}>
                {orders.length ? (
                  orders.map((o) => (
                    <div
                      className={s.dataRow}
                      data-studio-part="data-row"
                      key={o.id}
                    >
                      <Link
                        className={s.link}
                        data-studio-part="link"
                        href={href(`orders/${o.id}`)}
                      >
                        #{o.id} · {o.date}
                      </Link>
                      <Badge>{o.fulfillment}</Badge>
                      <span>{money(orderTotal(o), intlLocale)}</span>
                    </div>
                  ))
                ) : (
                  <p className={s.muted} data-studio-part="muted">
                    {ui("thisCustomerHasNoPreviewOrdersYet")}
                  </p>
                )}
                <Action href={href("drafts/new")}>{ui("createOrder")}</Action>
              </Panel>
            )}
          </div>
          <aside className={s.editorSide} data-studio-part="editor-side">
            <Panel
              title={ui("notes")}
              part="customer-notes"
              action={
                <Button
                  plain
                  aria-label={text("Edit notes", "Редактиране на бележките")}
                  onClick={() => {
                    setNotesDraft(customer.notes);
                    setNotes(true);
                  }}
                >
                  <AdminIcon name="plus" />
                </Button>
              }
            >
              <p className={s.muted}>
                {customer.notes || text("No notes", "Няма бележки")}
              </p>
            </Panel>
            <Panel title={ui("tags")}>
              <Field label={ui("customerTags")}>
                <input
                  value={customer.tags}
                  maxLength={300}
                  onChange={(e) => patch({ tags: e.target.value })}
                />
              </Field>
            </Panel>
            <Panel title={ui("customerPrivacy")}>
              <p className={s.help} data-studio-part="field-help">
                {ui("useFictionalInformationWhileReviewingTheFrontend")}
              </p>
              <Action href={href("settings/privacy")}>
                {ui("privacySettings")}
              </Action>
            </Panel>
          </aside>
        </div>
        <div className={s.saveBar} data-studio-part="save-bar">
          <Action href={href("customers")}>{ui("cancel")}</Action>
          <Button primary type="submit">
            {ui("save")}
          </Button>
        </div>
      </form>
      {notes && (
        <Modal
          title={ui("notes")}
          onClose={() => setNotes(false)}
          footer={
            <Button
              primary
              onClick={() => {
                patch({ notes: notesDraft });
                setNotes(false);
              }}
            >
              {ui("done")}
            </Button>
          }
        >
          <Field label={ui("customerNotes")}>
            <textarea
              maxLength={2000}
              value={notesDraft}
              onChange={(event) => setNotesDraft(event.target.value)}
            />
          </Field>
        </Modal>
      )}
      {address && (
        <Modal
          title={ui("defaultAddress")}
          onClose={() => setAddress(false)}
          footer={
            <Button primary onClick={() => setAddress(false)}>
              {ui("done")}
            </Button>
          }
        >
          <Field label={ui("address")}>
            <input
              value={customer.address}
              maxLength={200}
              onChange={(e) => patch({ address: e.target.value })}
            />
          </Field>
          <div className={s.fields} data-studio-part="fields">
            <Field label={ui("city")}>
              <input
                value={customer.city}
                maxLength={100}
                onChange={(e) => patch({ city: e.target.value })}
              />
            </Field>
            <Field label={ui("postalCode")}>
              <input
                value={customer.postcode}
                maxLength={20}
                onChange={(e) => patch({ postcode: e.target.value })}
              />
            </Field>
          </div>
          <Field label={ui("country")}>
            <select
              value={customer.country}
              onChange={(e) => patch({ country: e.target.value })}
            >
              {["Bulgaria", "Greece", "Romania", "Germany", "Other"].map(
                (v) => (
                  <option key={v} value={v}>
                    {caption(v)}
                  </option>
                ),
              )}
            </select>
          </Field>
          <p className={s.help} data-studio-part="field-help">
            {ui("saveTheCustomerToKeepThisAddress")}
          </p>
        </Modal>
      )}
      {remove && (
        <Confirm
          title={ui("deletePreviewCustomer")}
          body={ui("thisRemovesOnlyTheLocalFictionalCustomerProfile")}
          action={ui("delete")}
          onClose={() => setRemove(false)}
          onConfirm={() => {
            update({ customers: store.customers.filter((c) => c.id !== id) });
            notify(ui("previewCustomerDeleted"));
            router.push(href("customers"));
          }}
        />
      )}
    </main>
  );
}
export function Segments({ detail }: { detail?: string }) {
  const ui = useTranslations("merchantUI");
  const { store, href, text } = usePreview();
  const list = useList();
  const segments = store.entries.filter((e) => e.type === "Segment");
  if (detail) return <SegmentBuilder key={detail} id={detail} />;
  return (
    <main className={s.page} data-studio-part="page">
      <Header
        title={ui("segments")}
        icon="customers"
        actions={
          <Action primary href={href("segments/new")}>
            {ui("createSegment")}
          </Action>
        }
      />
      {!segments.length ? (
        <Empty
          kind="customers"
          title={ui("bringTheRightCustomersTogether")}
          body={ui(
            "createReusableCustomerGroupsByLocationPurchaseHistoryOrEmail",
          )}
        >
          <Action primary href={href("segments/new")}>
            {ui("createSegment")}
          </Action>
        </Empty>
      ) : (
        <div className={s.tablePanel} data-studio-part="table-panel">
          <Toolbar {...list} />
          <table className={s.table} data-studio-part="table">
            <thead>
              <tr>
                <th>{ui("segment")}</th>
                <th>{text("% of customers", "% от клиентите")}</th>
                <th>{text("Last activity", "Последна активност")}</th>
                <th>{text("Created by", "Създаден от")}</th>
              </tr>
            </thead>
            <tbody>
              {listRows(segments, list.query, list.sort, (e) => e.title).map(
                (e) => (
                  <tr key={e.id}>
                    <td>
                      <Link
                        className={s.cellLink}
                        data-studio-part="cell-link"
                        href={href(`segments/${e.id}`)}
                      >
                        {e.title}
                      </Link>
                    </td>
                    <td>
                      {store.customers.length
                        ? Math.round(
                            (store.customers.filter((customer) =>
                              customerMatchesSegment(store, customer, e.body),
                            ).length /
                              store.customers.length) *
                              100,
                          )
                        : 0}
                      %
                    </td>
                    <td>—</td>
                    <td>{text("Local preview", "Локален преглед")}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
          <TableFooter count={segments.length} />
        </div>
      )}
    </main>
  );
}
