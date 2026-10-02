"use client";
import { useLocale as useIntlLocale } from "next-intl";
import { useCaption } from "../../locale/use-caption";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminIcon } from "../admin-icons";
import { usePreview } from "./context";
import { money, orderTotal, put, type Customer, type Entry } from "./model";
import { customerName } from "./orders";
import {
  Action,
  Badge,
  Button,
  Check,
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
    <main className={s.page}>
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
      <div className={s.segmentPrompt}>
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
        <Link className={s.button} href={href("segments")}>
          {ui("manageSegments")}
        </Link>
      </div>
      <div className={`${s.tablePanel} ${s.customerPanel}`}>
        <Toolbar {...list} tabs={["All", "Email subscribers"]} />
        {list.selected.length > 0 && (
          <div className={s.bulk}>
            <strong>
              {list.selected.length} {ui("selected_d7cbbb")}
            </strong>
            <Button danger onClick={() => setRemove(true)}>
              {ui("deleteFromPreview")}
            </Button>
          </div>
        )}
        {!!rows.length && (
          <div className={s.tableScroll}>
            <table className={s.table}>
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
                          href={href(`customers/${c.id}`)}
                        >
                          {customerName(c)}
                        </Link>
                        <p className={s.help}>{c.email}</p>
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
          <div className={s.customersEmpty}>
            <AdminIcon name="search" />
            <h2>
              {store.customers.length
                ? ui("noCustomersFound")
                : ui("noCustomersYet")}
            </h2>
            <p className={s.muted}>
              {ui("yourCustomerProfilesAndPurchaseHistoryWillAppearHere")}
            </p>
          </div>
        )}
        {!!rows.length && <TableFooter count={rows.length} />}
      </div>
      {!rows.length && (
        <p className={s.learn}>
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
            <p className={s.error} role="alert">
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
  const { store, href, update, notify } = usePreview();
  const router = useRouter();
  const existing = store.customers.find((c) => c.id === id);
  const [customer, setCustomer] = useState<Customer>(
    () => existing ?? emptyCustomer("new"),
  );
  const [address, setAddress] = useState(false);
  const [remove, setRemove] = useState(false);
  const [error, setError] = useState("");
  const patch = (change: Partial<Customer>) =>
    setCustomer({ ...customer, ...change });
  const orders = store.orders.filter(
    (o) => o.customerId === id && o.kind === "Order",
  );
  if (id !== "new" && !existing)
    return (
      <main className={s.editor}>
        <Header title={ui("customerNotFound")} back={href("customers")} />
        <Action href={href("customers")}>{ui("backToCustomers")}</Action>
      </main>
    );
  return (
    <main className={s.editor}>
      <Header
        title={existing ? customerName(customer) : ui("newCustomer")}
        back={href("customers")}
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
          <p className={s.error} role="alert">
            {error}
          </p>
        )}
        <div className={s.editorColumns}>
          <div className={s.stack}>
            {existing && (
              <Panel title={ui("customerOverview")}>
                <div className={s.fields}>
                  <div>
                    <h3>{ui("amountSpent")}</h3>
                    <p className={s.metric}>
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
                    <p className={s.metric}>{orders.length}</p>
                  </div>
                </div>
              </Panel>
            )}
            <Panel
              title={
                existing ? ui("contactInformation") : ui("customerOverview")
              }
            >
              <div className={s.fields}>
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
                <input
                  type="tel"
                  value={customer.phone}
                  maxLength={40}
                  onChange={(e) => patch({ phone: e.target.value })}
                />
              </Field>
              <Check
                label={ui("customerAgreedToReceiveMarketingEmails")}
                checked={customer.marketing}
                onChange={() => patch({ marketing: !customer.marketing })}
              />
              <p className={s.help}>
                {ui("previewPreferenceOnlyNoEmailsAreSent")}
              </p>
            </Panel>
            <Panel
              title={ui("defaultAddress")}
              action={
                <Button plain onClick={() => setAddress(true)}>
                  {customer.address ? ui("edit") : ui("addAddress")}
                </Button>
              }
            >
              {customer.address ? (
                <p>
                  {customer.address}
                  <br />
                  {customer.postcode} {customer.city}
                  <br />
                  {customer.country}
                </p>
              ) : (
                <p className={s.muted}>{ui("noAddressProvided")}</p>
              )}
            </Panel>
            {existing && (
              <Panel title={ui("recentOrders")}>
                {orders.length ? (
                  orders.map((o) => (
                    <div className={s.dataRow} key={o.id}>
                      <Link className={s.link} href={href(`orders/${o.id}`)}>
                        #{o.id} · {o.date}
                      </Link>
                      <Badge>{o.fulfillment}</Badge>
                      <span>{money(orderTotal(o), intlLocale)}</span>
                    </div>
                  ))
                ) : (
                  <p className={s.muted}>
                    {ui("thisCustomerHasNoPreviewOrdersYet")}
                  </p>
                )}
                <Action href={href("drafts/new")}>{ui("createOrder")}</Action>
              </Panel>
            )}
          </div>
          <aside className={s.editorSide}>
            <Panel title={ui("notes")}>
              <Field label={ui("customerNotes")}>
                <textarea
                  value={customer.notes}
                  maxLength={2000}
                  onChange={(e) => patch({ notes: e.target.value })}
                />
              </Field>
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
              <p className={s.help}>
                {ui("useFictionalInformationWhileReviewingTheFrontend")}
              </p>
              <Action href={href("settings/privacy")}>
                {ui("privacySettings")}
              </Action>
            </Panel>
          </aside>
        </div>
        <div className={s.saveBar}>
          <Action href={href("customers")}>{ui("cancel")}</Action>
          <Button primary type="submit">
            {ui("save")}
          </Button>
        </div>
      </form>
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
          <div className={s.fields}>
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
          <p className={s.help}>{ui("saveTheCustomerToKeepThisAddress")}</p>
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
  const caption = useCaption();
  const ui = useTranslations("merchantUI");
  const { store, href, update, notify } = usePreview();
  const router = useRouter();
  const list = useList();
  const existing = store.entries.find(
    (e) => e.type === "Segment" && e.id === detail,
  );
  const [title, setTitle] = useState(existing?.title ?? "");
  const [condition, setCondition] = useState(existing?.body ?? "All customers");
  const segments = store.entries.filter((e) => e.type === "Segment");
  const matches = store.customers.filter(
    (c) =>
      condition === "All customers" ||
      (condition === "Email subscribers"
        ? c.marketing
        : condition === "Returning customers"
          ? store.orders.filter(
              (o) => o.kind === "Order" && o.customerId === c.id,
            ).length > 1
          : c.country === condition),
  );
  if (detail)
    return (
      <main className={s.editor}>
        <Header
          title={existing ? ui("editSegment") : ui("createSegment")}
          back={href("segments")}
        />
        <form
          className={s.stack}
          onSubmit={(e) => {
            e.preventDefault();
            const entry: Entry = {
              id: existing?.id ?? `segment-${crypto.randomUUID()}`,
              title: title.trim(),
              body: condition,
              type: "Segment",
              status: "Active",
              tags: "",
            };
            update({ entries: put(store.entries, entry) });
            notify(ui("customerSegmentSaved"));
            router.push(href("segments"));
          }}
        >
          <Panel title={ui("customerSegment")}>
            <Field label={ui("segmentName")}>
              <input
                required
                maxLength={100}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field label={ui("customersMatching")}>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
              >
                {[
                  "All customers",
                  "Email subscribers",
                  "Returning customers",
                  "Bulgaria",
                  "Greece",
                  "Romania",
                ].map((v) => (
                  <option key={v} value={v}>
                    {caption(v)}
                  </option>
                ))}
              </select>
            </Field>
            <p>
              {matches.length} {ui("customersMatchThisSegment")}
            </p>
            {matches.map((c) => (
              <Link
                className={s.link}
                key={c.id}
                href={href(`customers/${c.id}`)}
              >
                {customerName(c)}
              </Link>
            ))}
          </Panel>
          <div className={s.saveBar}>
            <Action href={href("segments")}>{ui("cancel")}</Action>
            <Button primary type="submit">
              {ui("saveSegment")}
            </Button>
          </div>
        </form>
      </main>
    );
  return (
    <main className={s.page}>
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
        <div className={s.tablePanel}>
          <Toolbar {...list} />
          <table className={s.table}>
            <thead>
              <tr>
                <th>{ui("segment")}</th>
                <th>{ui("filter")}</th>
                <th>{ui("status")}</th>
              </tr>
            </thead>
            <tbody>
              {listRows(segments, list.query, list.sort, (e) => e.title).map(
                (e) => (
                  <tr key={e.id}>
                    <td>
                      <Link
                        className={s.cellLink}
                        href={href(`segments/${e.id}`)}
                      >
                        {e.title}
                      </Link>
                    </td>
                    <td>{e.body}</td>
                    <td>
                      <Badge>{e.status}</Badge>
                    </td>
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
