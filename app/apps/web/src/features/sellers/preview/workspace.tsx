"use client";

import { useLocale as useIntlLocale } from "next-intl";
import { useCaption } from "../../locale/use-caption";
import { useTranslations } from "next-intl";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePreview } from "./context";
import { money, put, type Member } from "./model";
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
  listRows,
  useList,
  s,
} from "./ui";
export function Team({ embedded = false }: { embedded?: boolean }) {
  const t = useTranslations("studioTeam");
  const { store, update, notify } = usePreview();
  const roleKeys = {
    Admin: "admin",
    Staff: "staff",
    "Catalog manager": "catalogManager",
    Support: "support",
    Analyst: "analyst",
    Owner: "owner",
  } as const;
  const roleText = (role: string) =>
    roleKeys[role as keyof typeof roleKeys]
      ? t(roleKeys[role as keyof typeof roleKeys])
      : role;
  const list = useList();
  const [member, setMember] = useState<Member | null>(null);
  const [remove, setRemove] = useState<Member | null>(null);
  const [error, setError] = useState("");
  const rows = listRows(
    store.members,
    list.query,
    list.sort,
    (m) => `${m.name} ${m.email}`,
  );
  return (
    <div className={embedded ? s.stack : s.page}>
      {!embedded && (
        <Header
          title={t("team")}
          icon="customers"
          actions={
            <Button
              primary
              onClick={() =>
                setMember({
                  id: "new",
                  name: "",
                  email: "",
                  role: "Staff",
                  status: "Invited",
                })
              }
            >
              {t("inviteMember")}
            </Button>
          }
        />
      )}
      <Panel
        title={t("users")}
        action={
          embedded && (
            <Button
              onClick={() =>
                setMember({
                  id: "new",
                  name: "",
                  email: "",
                  role: "Staff",
                  status: "Invited",
                })
              }
            >
              {t("inviteMember")}
            </Button>
          )
        }
      >
        <p className={s.help}>
          {t(
            "reviewRolesAndInvitationsUsingFictionalUsersNoInvitationEmailsOrRealPermissionsAreIssued",
          )}
        </p>
        <div className={s.tablePanel}>
          <Toolbar {...list} />
          <div className={s.tableScroll}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>{t("user")}</th>
                  <th>{t("role")}</th>
                  <th>{t("status")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <strong>{m.name}</strong>
                      <p className={s.help}>{m.email}</p>
                    </td>
                    <td>{roleText(m.role)}</td>
                    <td>
                      <Badge>{m.status}</Badge>
                    </td>
                    <td>
                      {m.role !== "Owner" && (
                        <div className={s.actions}>
                          <Button
                            onClick={() => {
                              setMember(m);
                              setError("");
                            }}
                          >
                            {t("edit")}
                          </Button>
                          <Button danger onClick={() => setRemove(m)}>
                            {t("remove")}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TableFooter count={rows.length} />
        </div>
      </Panel>
      {member && (
        <Modal
          title={
            member.id === "new"
              ? t("invitePreviewMember")
              : t("editPreviewMember")
          }
          onClose={() => setMember(null)}
          footer={
            <>
              <Button onClick={() => setMember(null)}>{t("cancel")}</Button>
              <Button
                primary
                onClick={() => {
                  if (
                    !member.name.trim() ||
                    !/^\S+@\S+\.\S+$/.test(member.email)
                  ) {
                    setError(t("enterANameAndAValidFictionalEmail"));
                    return;
                  }
                  if (
                    store.members.some(
                      (m) => m.id !== member.id && m.email === member.email,
                    )
                  ) {
                    setError(t("thatEmailIsAlreadyInThePreviewTeam"));
                    return;
                  }
                  update({
                    members: put(store.members, {
                      ...member,
                      id:
                        member.id === "new"
                          ? `member-${crypto.randomUUID()}`
                          : member.id,
                    }),
                  });
                  notify(t("previewMemberSavedNoInvitationWasSent"));
                  setMember(null);
                }}
              >
                {t("savePreviewMember")}
              </Button>
            </>
          }
        >
          <Field label={t("fullName")}>
            <input
              value={member.name}
              maxLength={100}
              onChange={(e) => setMember({ ...member, name: e.target.value })}
            />
          </Field>
          <Field label={t("email")}>
            <input
              type="email"
              value={member.email}
              maxLength={160}
              onChange={(e) => setMember({ ...member, email: e.target.value })}
            />
          </Field>
          <Field label={t("role")}>
            <select
              value={member.role}
              onChange={(e) => setMember({ ...member, role: e.target.value })}
            >
              {["Admin", "Staff", "Catalog manager", "Support", "Analyst"].map(
                (v) => (
                  <option key={v} value={v}>
                    {roleText(v)}
                  </option>
                ),
              )}
            </select>
          </Field>
          <Field label={t("status")}>
            <select
              value={member.status}
              onChange={(e) => setMember({ ...member, status: e.target.value })}
            >
              <option value="Invited">{t("invited")}</option>
              <option value="Active">{t("active")}</option>
              <option value="Suspended">{t("suspended")}</option>
            </select>
          </Field>
          <Panel title={t("rolePreview")}>
            <p>
              {member.role === "Admin"
                ? t("manageStoreSettingsCatalogAndCustomerOperations")
                : member.role === "Catalog manager"
                  ? t("manageProductsCollectionsAndInventory")
                  : member.role === "Support"
                    ? t("reviewOrdersCustomersAndConversations")
                    : member.role === "Analyst"
                      ? t("reviewReportingAndPerformance")
                      : t("reviewProductsAndOrders")}
            </p>
          </Panel>
          {error && (
            <p className={s.error} role="alert">
              {error}
            </p>
          )}
        </Modal>
      )}
      {remove && (
        <Confirm
          title={t("removePreviewMember")}
          body={t("thisRemovesTheFictionalUserFromTheLocalTeam")}
          action={t("remove")}
          onClose={() => setRemove(null)}
          onConfirm={() => {
            update({
              members: store.members.filter((m) => m.id !== remove.id),
            });
            notify(t("previewMemberRemoved"));
          }}
        />
      )}
    </div>
  );
}
export function Inbox({ detail }: { detail?: string }) {
  const caption = useCaption();
  const ui = useTranslations("merchantUI");
  const { store, href, update, notify } = usePreview();
  const [status, setStatus] = useState("Open");
  const [message, setMessage] = useState("");
  const [newThread, setNewThread] = useState(false);
  const [customer, setCustomer] = useState("");
  const [subject, setSubject] = useState("");
  const threads = store.threads.filter(
    (t) => status === "All" || t.status === status,
  );
  const current = store.threads.find((t) => t.id === detail) ?? threads[0];
  return (
    <main className={s.page}>
      <Header
        title={ui("inbox")}
        icon="inbox"
        actions={
          <Button primary onClick={() => setNewThread(true)}>
            {ui("newConversation")}
          </Button>
        }
      />
      <div className={s.actions} style={{ marginBottom: 16 }}>
        {["Open", "Closed", "All"].map((v) => (
          <Button key={v} onClick={() => setStatus(v)} primary={v === status}>
            {caption(v)}
          </Button>
        ))}
      </div>
      {!store.threads.length ? (
        <Empty
          kind="inbox"
          title={ui("yourConversationsStartHere")}
          body={ui(
            "reviewCustomerMessagesAndReplyFromOneWorkspacePreviewReplies",
          )}
        >
          <Button primary onClick={() => setNewThread(true)}>
            {ui("newConversation")}
          </Button>
        </Empty>
      ) : (
        <div className={s.inbox}>
          <aside className={s.threads}>
            {threads.map((t) => (
              <Link
                key={t.id}
                href={href(`inbox/${t.id}`)}
                aria-current={t.id === current?.id ? "page" : undefined}
              >
                <strong>
                  {customerName(
                    store.customers.find((c) => c.id === t.customerId),
                  )}
                </strong>
                <p>{t.subject}</p>
                <p className={s.help}>{t.messages.at(-1)?.body.slice(0, 70)}</p>
              </Link>
            ))}
            {!threads.length && (
              <p style={{ padding: 16 }}>{ui("noConversationsInThisView")}</p>
            )}
          </aside>
          <section className={s.conversation}>
            {current ? (
              <>
                <div className={s.sectionHeading}>
                  <h2>{current.subject}</h2>
                  <Button
                    onClick={() => {
                      update({
                        threads: store.threads.map((t) =>
                          t.id === current.id
                            ? {
                                ...t,
                                status: t.status === "Open" ? "Closed" : "Open",
                              }
                            : t,
                        ),
                      });
                      notify(ui("conversationStatusSavedLocally"));
                    }}
                  >
                    {current.status === "Open"
                      ? ui("closeConversation")
                      : ui("reopen")}
                  </Button>
                </div>
                <div className={s.messages}>
                  {current.messages.map((m, i) => (
                    <div
                      key={i}
                      className={`${s.bubble} ${m.from === "You" ? s.bubbleSelf : ""}`}
                    >
                      <p className={s.help}>
                        {m.from} · {m.time}
                      </p>
                      <p>{m.body}</p>
                    </div>
                  ))}
                </div>
                <form
                  className={s.stack}
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!message.trim()) return;
                    update({
                      threads: store.threads.map((t) =>
                        t.id === current.id
                          ? {
                              ...t,
                              status: "Open",
                              messages: [
                                ...t.messages,
                                {
                                  from: "You",
                                  body: message.trim(),
                                  time: new Date().toLocaleTimeString("en", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }),
                                },
                              ],
                            }
                          : t,
                      ),
                    });
                    setMessage("");
                    notify(ui("replySavedInPreviewNothingWasSent"));
                  }}
                >
                  <Field label={ui("reply")}>
                    <textarea
                      value={message}
                      maxLength={2000}
                      placeholder={ui("writeYourReply")}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </Field>
                  <Button primary type="submit" disabled={!message.trim()}>
                    {ui("savePreviewReply")}
                  </Button>
                </form>
              </>
            ) : (
              <p>{ui("selectAConversation")}</p>
            )}
          </section>
        </div>
      )}
      {newThread && (
        <Modal
          title={ui("newPreviewConversation")}
          onClose={() => setNewThread(false)}
          footer={
            <>
              <Button onClick={() => setNewThread(false)}>
                {ui("cancel")}
              </Button>
              <Button
                primary
                disabled={!customer || !subject.trim()}
                onClick={() => {
                  update({
                    threads: [
                      ...store.threads,
                      {
                        id: `thread-${crypto.randomUUID()}`,
                        customerId: customer,
                        subject: subject.trim(),
                        status: "Open",
                        messages: [],
                      },
                    ],
                  });
                  notify(ui("previewConversationCreated"));
                  setNewThread(false);
                  setSubject("");
                }}
              >
                {ui("createConversation")}
              </Button>
            </>
          }
        >
          <Field label={ui("customer")}>
            <select
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
            >
              <option value="">{ui("selectCustomer")}</option>
              {store.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {customerName(c)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={ui("subject")}>
            <input
              maxLength={160}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </Field>
          <Action href={href("customers/new")}>{ui("addCustomer")}</Action>
        </Modal>
      )}
    </main>
  );
}
export function Store({ standalone = false }: { standalone?: boolean }) {
  const intlLocale = useIntlLocale();
  const ui = useTranslations("merchantUI");
  const { store, href, language, text, update, notify } = usePreview();
  const [settings, setSettings] = useState({ ...store.settings });
  const [preview, setPreview] = useState(standalone);
  const [showDrafts, setShowDrafts] = useState(false);
  const products = store.products.filter(
    (p) => showDrafts || p.status === "Active",
  );
  return (
    <main className={`${s.page} ${standalone ? s.standaloneStore : ""}`}>
      <Header
        title={
          standalone
            ? text("Store preview", "Преглед на магазина")
            : ui("onlineStore")
        }
        icon="store"
        actions={
          standalone ? (
            <>
              <Action href={href()}>
                {text("Back to admin", "Към панела")}
              </Action>
              <Action href={`/?lang=${language}`}>
                {text("Go to Treido", "Към Treido")}
              </Action>
            </>
          ) : (
            <Button onClick={() => setPreview(!preview)}>
              {preview ? ui("editStore") : ui("previewStore")}
            </Button>
          )
        }
      />
      {preview ? (
        <div className={s.storePreview}>
          <header
            className={s.storeCover}
            style={{ borderBottom: `4px solid ${settings.accent}` }}
          >
            <span
              style={{
                background: settings.accent,
                color: "white",
                borderRadius: 12,
                padding: "12px 18px",
                fontSize: 24,
                fontWeight: 600,
              }}
            >
              {settings.name.slice(0, 1)}
            </span>
            <div>
              <h2>{settings.name}</h2>
              <p>{settings.description}</p>
            </div>
          </header>
          <div style={{ padding: 16 }}>
            <Check
              label={text(
                "Include draft products in this preview",
                "Покажи и черновите",
              )}
              checked={showDrafts}
              onChange={() => setShowDrafts(!showDrafts)}
            />
          </div>
          <div className={s.storeGrid}>
            {products.map((p) => (
              <Link key={p.id} href={href(`products/${p.id}`)}>
                {p.image ? (
                  <Image
                    unoptimized
                    width={960}
                    height={472}
                    src={p.image}
                    className={s.thumb}
                    alt={p.title}
                  />
                ) : (
                  <div className={s.thumb}>
                    {text("Product image", "Снимка на продукта")}
                  </div>
                )}
                <h3>{p.title}</h3>
                <p>{money(p.price, intlLocale)}</p>
              </Link>
            ))}
          </div>
          {!products.length && (
            <p className={s.learn}>
              {text(
                "No active products. Add products or include drafts.",
                "Няма активни продукти. Добави продукт или покажи черновите.",
              )}
            </p>
          )}
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update({ settings });
            notify(ui("storeAppearanceSavedLocallyNothingWasPublished"));
          }}
        >
          <div className={s.editorColumns}>
            <div className={s.stack}>
              <Panel title={ui("storeIdentity")}>
                <Field label={ui("storeName")}>
                  <input
                    required
                    maxLength={100}
                    value={settings.name}
                    onChange={(e) =>
                      setSettings({ ...settings, name: e.target.value })
                    }
                  />
                </Field>
                <Field label={ui("storeDescription")}>
                  <textarea
                    maxLength={500}
                    value={settings.description}
                    onChange={(e) =>
                      setSettings({ ...settings, description: e.target.value })
                    }
                  />
                </Field>
                <div className={s.fields}>
                  <Field label={ui("storeHandle")}>
                    <input
                      required
                      pattern="[a-z0-9-]+"
                      maxLength={60}
                      value={settings.handle}
                      onChange={(e) =>
                        setSettings({ ...settings, handle: e.target.value })
                      }
                    />
                  </Field>
                  <Field label={ui("accentColor")}>
                    <input
                      type="color"
                      value={settings.accent}
                      onChange={(e) =>
                        setSettings({ ...settings, accent: e.target.value })
                      }
                    />
                  </Field>
                </div>
              </Panel>
              <Panel title={ui("storeContent")}>
                <div className={s.dataRow}>
                  <span>{ui("collections")}</span>
                  <Action href={href("collections")}>
                    {ui("manageCollections")}
                  </Action>
                </div>
                <div className={s.dataRow}>
                  <span>{ui("pages")}</span>
                  <Action href={href("pages")}>{ui("managePages")}</Action>
                </div>
                <div className={s.dataRow}>
                  <span>{ui("imagesAndFiles")}</span>
                  <Action href={href("files")}>{ui("manageFiles")}</Action>
                </div>
              </Panel>
            </div>
            <aside className={s.editorSide}>
              <Panel title={ui("publishing")}>
                <Badge>Frontend preview</Badge>
                <p>
                  {ui(
                    "reviewTheStorefrontUsingYourLocalProductsAndBrandDetails",
                  )}
                </p>
                <Button onClick={() => setPreview(true)}>
                  {ui("previewStore")}
                </Button>
              </Panel>
              <Panel title={ui("domains")}>
                <p>{settings.handle}.treido.eu</p>
                <Action href={href("settings/domains")}>
                  {ui("manageDomains")}
                </Action>
              </Panel>
            </aside>
          </div>
          <div className={s.saveBar}>
            <Button primary type="submit">
              {ui("saveAppearance")}
            </Button>
          </div>
        </form>
      )}
    </main>
  );
}
export function Notifications() {
  const ui = useTranslations("merchantUI");
  const { store, href } = usePreview();
  const [read, setRead] = useState<string[]>([]);
  const items = [
    ...store.orders
      .filter((o) => o.kind === "Order" && o.fulfillment === "Unfulfilled")
      .map((o) => ({
        id: `order-${o.id}`,
        title: `Order #${o.id} is ready for review`,
        body: "Review the order and fulfillment details.",
        href: href(`orders/${o.id}`),
      })),
    ...store.products
      .filter((p) => p.quantity < 5)
      .map((p) => ({
        id: `stock-${p.id}`,
        title: `Low stock: ${p.title}`,
        body: `${p.quantity} available.`,
        href: href("inventory"),
      })),
    ...store.threads
      .filter((t) => t.status === "Open")
      .map((t) => ({
        id: `thread-${t.id}`,
        title: `Conversation: ${t.subject}`,
        body: "Review the customer conversation.",
        href: href(`inbox/${t.id}`),
      })),
  ];
  return (
    <main className={s.page}>
      <Header
        title={ui("notifications")}
        icon="bell"
        actions={
          <Button onClick={() => setRead(items.map((i) => i.id))}>
            {ui("markAllRead")}
          </Button>
        }
      />
      <Panel title={ui("storeUpdates")}>
        {items.length ? (
          items.map((i) => (
            <div key={i.id} className={s.dataRow}>
              <Link href={i.href}>
                <strong>{i.title}</strong>
                <p className={s.help}>{i.body}</p>
              </Link>
              <Button
                plain
                onClick={() =>
                  setRead(
                    read.includes(i.id)
                      ? read.filter((v) => v !== i.id)
                      : [...read, i.id],
                  )
                }
              >
                {read.includes(i.id) ? ui("read") : ui("markRead")}
              </Button>
            </div>
          ))
        ) : (
          <p className={s.muted}>
            {ui("youReAllCaughtUpUpdatesFromPreviewOrdersAnd")}
          </p>
        )}
      </Panel>
    </main>
  );
}
