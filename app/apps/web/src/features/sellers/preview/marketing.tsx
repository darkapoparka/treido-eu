"use client";
import { useLocale as useIntlLocale } from "next-intl";
import { useCaption } from "../../locale/use-caption";
import { useTranslations } from "next-intl";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminIcon } from "../admin-icons";
import { usePreview } from "./context";
import {
  money,
  orderTotal,
  parseMoney,
  put,
  type Discount,
  type Entry,
} from "./model";
import {
  Action,
  Badge,
  Button,
  Chart,
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
const discountTypes = [
  {
    slug: "products",
    title: "Amount off products",
    body: "Discount specific products or collections.",
  },
  {
    slug: "buy-get",
    title: "Buy X get Y",
    body: "Reward customers with an additional product.",
  },
  {
    slug: "order",
    title: "Amount off order",
    body: "Discount the total amount of an order.",
  },
  {
    slug: "shipping",
    title: "Free shipping",
    body: "Offer free shipping on qualifying orders.",
  },
];
export function Discounts({ detail }: { detail?: string }) {
  const ui = useTranslations("merchantUI");
  const { store, href, update, notify } = usePreview();
  const list = useList();
  const [create, setCreate] = useState(false);
  const [remove, setRemove] = useState(false);
  if (detail) return <DiscountEditor key={detail} id={detail} />;
  const rows = listRows(
    store.discounts.filter((d) => list.tab === "All" || d.status === list.tab),
    list.query,
    list.sort,
    (d) => `${d.title} ${d.code}`,
  );
  return (
    <main className={s.page}>
      <Header
        title={ui("discounts")}
        icon="discount"
        actions={
          <>
            <Button
              onClick={() =>
                downloadCsv("treido-discounts.csv", [
                  ["Title", "Code", "Type", "Status"],
                  ...store.discounts.map((d) => [
                    d.title,
                    d.code,
                    d.type,
                    d.status,
                  ]),
                ])
              }
            >
              {ui("export")}
            </Button>
            <Button primary onClick={() => setCreate(true)}>
              {ui("createDiscount")}
            </Button>
          </>
        }
      />
      {!store.discounts.length ? (
        <Empty
          kind="discount"
          title={ui("manageDiscountsAndPromotions")}
          body={ui("createDiscountCodesAndAutomaticDiscountsToGiveCustomersAn")}
        >
          <Button primary onClick={() => setCreate(true)}>
            {ui("createDiscount")}
          </Button>
        </Empty>
      ) : (
        <div className={s.tablePanel}>
          <Toolbar
            {...list}
            tabs={["All", "Active", "Scheduled", "Expired", "Disabled"]}
          />
          {list.selected.length > 0 && (
            <div className={s.bulk}>
              <strong>
                {list.selected.length} {ui("selected_d7cbbb")}
              </strong>
              <Button
                onClick={() => {
                  update({
                    discounts: store.discounts.map((d) =>
                      list.selected.includes(d.id)
                        ? { ...d, status: "Disabled" }
                        : d,
                    ),
                  });
                  list.select([]);
                  notify(ui("previewDiscountsDisabled"));
                }}
              >
                {ui("deactivate")}
              </Button>
              <Button danger onClick={() => setRemove(true)}>
                {ui("delete")}
              </Button>
            </div>
          )}
          <div className={s.tableScroll}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label={ui("selectAllDiscounts")}
                      checked={
                        !!rows.length &&
                        rows.every((d) => list.selected.includes(d.id))
                      }
                      onChange={(e) =>
                        list.select(
                          e.target.checked ? rows.map((d) => d.id) : [],
                        )
                      }
                      data-ui-label="selectAllDiscounts"
                    />
                  </th>
                  <th>{ui("discount")}</th>
                  <th>{ui("status")}</th>
                  <th>{ui("method")}</th>
                  <th>{ui("type")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={ui("selectValue1", {
                          value1: d.title ?? "",
                        })}
                        checked={list.selected.includes(d.id)}
                        onChange={() => list.toggle(d.id)}
                      />
                    </td>
                    <td>
                      <Link
                        className={s.cellLink}
                        href={href(`discounts/${d.id}`)}
                      >
                        {d.method === "Discount code" ? d.code : d.title}
                      </Link>
                    </td>
                    <td>
                      <Badge>{d.status}</Badge>
                    </td>
                    <td>{d.method}</td>
                    <td>{d.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TableFooter count={rows.length} />
        </div>
      )}
      {create && (
        <Modal
          title={ui("selectDiscountType")}
          onClose={() => setCreate(false)}
        >
          {discountTypes.map((d) => (
            <Link
              className={s.choice}
              key={d.slug}
              href={href(`discounts/new-${d.slug}`)}
            >
              <AdminIcon name="discount" />
              <span>
                <strong>{d.title}</strong>
                <span className={s.muted}>{d.body}</span>
              </span>
              <AdminIcon name="arrow" />
            </Link>
          ))}
        </Modal>
      )}
      {remove && (
        <Confirm
          title={ui("deletePreviewDiscounts")}
          body={ui("removeTheSelectedLocalDiscountDrafts")}
          action={ui("delete")}
          onClose={() => setRemove(false)}
          onConfirm={() => {
            update({
              discounts: store.discounts.filter(
                (d) => !list.selected.includes(d.id),
              ),
            });
            list.select([]);
            notify(ui("previewDiscountsDeleted"));
          }}
        />
      )}
    </main>
  );
}
function DiscountEditor({ id }: { id: string }) {
  const intlLocale = useIntlLocale();
  const caption = useCaption();
  const ui = useTranslations("merchantUI");
  const { store, href, update, notify } = usePreview();
  const router = useRouter();
  const existing = store.discounts.find((d) => d.id === id);
  const kind =
    discountTypes.find((t) => id === `new-${t.slug}`) ?? discountTypes[2];
  const [discount, setDiscount] = useState<Discount>(
    () =>
      existing ?? {
        id: "new",
        title: "",
        code: "",
        type: kind.title,
        method: "Discount code",
        valueMode: "Percentage",
        eligibility: "All customers",
        appliesTo: "All products",
        buyQuantity: 1,
        getQuantity: 1,
        minimumKind: "None",
        value: 10,
        minimum: 0,
        limit: 0,
        once: false,
        combines: false,
        start: "2026-10-02",
        end: "",
        status: "Active",
      },
  );
  const [error, setError] = useState("");
  const patch = (change: Partial<Discount>) =>
    setDiscount({ ...discount, ...change });
  if (!existing && !id.startsWith("new"))
    return (
      <main className={s.editor}>
        <Header title={ui("discountNotFound")} back={href("discounts")} />
      </main>
    );
  return (
    <main className={s.editor}>
      <Header
        title={existing ? discount.title : ui("createDiscount")}
        back={href("discounts")}
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (
            !discount.title.trim() ||
            (discount.method === "Discount code" &&
              !/^[A-Z0-9_-]{2,40}$/.test(discount.code)) ||
            !Number.isFinite(discount.value) ||
            discount.value < 0 ||
            (discount.valueMode === "Percentage" && discount.value > 100) ||
            discount.limit < 0 ||
            discount.minimum < 0 ||
            (discount.end && discount.end < discount.start)
          ) {
            setError(ui("enterATitleAValidCodeValueAndAnEnd"));
            return;
          }
          if (
            discount.code &&
            store.discounts.some((d) => d.id !== id && d.code === discount.code)
          ) {
            setError(ui("thatCodeIsAlreadyUsedInThisPreview"));
            return;
          }
          const saved = {
            ...discount,
            id: existing ? id : `discount-${crypto.randomUUID()}`,
          };
          update({ discounts: put(store.discounts, saved) });
          notify(ui("discountSavedInTheFrontendPreview"));
          router.push(href(`discounts/${saved.id}`));
        }}
      >
        {error && (
          <p className={s.error} role="alert">
            {error}
          </p>
        )}
        <div className={s.editorColumns}>
          <div className={s.stack}>
            <Panel title={discount.type}>
              <div
                className={s.tabs}
                role="tablist"
                aria-label={ui("discountMethod")}
                data-ui-label="discountMethod"
              >
                {["Discount code", "Automatic discount"].map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="tab"
                    className={s.tab}
                    aria-selected={discount.method === v}
                    onClick={() => patch({ method: v })}
                  >
                    {caption(v)}
                  </button>
                ))}
              </div>
              <Field label={ui("discountTitle")}>
                <input
                  required
                  maxLength={100}
                  value={discount.title}
                  onChange={(e) => patch({ title: e.target.value })}
                />
              </Field>
              {discount.method === "Discount code" && (
                <>
                  <Field label={ui("discountCode")}>
                    <input
                      required
                      maxLength={40}
                      value={discount.code}
                      onChange={(e) =>
                        patch({
                          code: e.target.value
                            .toUpperCase()
                            .replaceAll(" ", ""),
                        })
                      }
                    />
                  </Field>
                  <Button
                    plain
                    onClick={() =>
                      patch({
                        code: `TREIDO${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
                      })
                    }
                  >
                    {ui("generateRandomCode")}
                  </Button>
                  <p className={s.help}>
                    {ui("customersEnterThisCodeAtCheckout")}
                  </p>
                </>
              )}
            </Panel>
            {discount.type !== "Free shipping" && (
              <Panel
                title={
                  discount.type === "Buy X get Y"
                    ? ui("customerBuysGets")
                    : ui("discountValue")
                }
              >
                <div className={s.fields}>
                  <Field label={ui("valueType")}>
                    <select
                      value={discount.valueMode}
                      onChange={(e) =>
                        patch({
                          valueMode: e.target.value as Discount["valueMode"],
                        })
                      }
                    >
                      <option value="Percentage">{ui("percentage")}</option>
                      <option value="Fixed amount">{ui("fixedAmount")}</option>
                    </select>
                  </Field>
                  <Field
                    label={
                      discount.valueMode === "Percentage"
                        ? ui("percentage_91d63b")
                        : ui("amountEUR")
                    }
                  >
                    <input
                      type="number"
                      min={0}
                      max={discount.valueMode === "Percentage" ? 100 : 1000000}
                      step={discount.valueMode === "Percentage" ? 1 : 0.01}
                      value={discount.value}
                      onChange={(e) => patch({ value: Number(e.target.value) })}
                    />
                  </Field>
                </div>
                {["Amount off products", "Buy X get Y"].includes(
                  discount.type,
                ) && (
                  <Field label={ui("appliesTo")}>
                    <select
                      value={discount.appliesTo}
                      onChange={(e) => patch({ appliesTo: e.target.value })}
                    >
                      <option value="All products">{ui("allProducts")}</option>
                      {store.collections.map((c) => (
                        <option key={c.id}>{c.title}</option>
                      ))}
                      {store.products.map((p) => (
                        <option key={p.id}>{p.title}</option>
                      ))}
                    </select>
                  </Field>
                )}
                {discount.type === "Buy X get Y" && (
                  <div className={s.fields}>
                    <Field label={ui("customerBuysQuantity")}>
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={discount.buyQuantity}
                        onChange={(e) =>
                          patch({ buyQuantity: Number(e.target.value) })
                        }
                      />
                    </Field>
                    <Field label={ui("customerGetsQuantity")}>
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={discount.getQuantity}
                        onChange={(e) =>
                          patch({ getQuantity: Number(e.target.value) })
                        }
                      />
                    </Field>
                  </div>
                )}
              </Panel>
            )}
            <Panel title={ui("eligibility")}>
              <Field label={ui("customerEligibility")}>
                <select
                  value={discount.eligibility}
                  onChange={(e) => patch({ eligibility: e.target.value })}
                >
                  <option value="All customers">{ui("allCustomers")}</option>
                  <option value="Specific customer segments">
                    {ui("specificCustomerSegments")}
                  </option>
                  <option value="Specific customers">
                    {ui("specificCustomers")}
                  </option>
                  {store.entries
                    .filter((e) => e.type === "Segment")
                    .map((e) => (
                      <option key={e.id}>{e.title}</option>
                    ))}
                </select>
              </Field>
            </Panel>
            <Panel title={ui("minimumPurchaseRequirements")}>
              {[
                "None",
                "Minimum purchase amount",
                "Minimum quantity of items",
              ].map((v) => (
                <Check
                  key={v}
                  radio
                  name="minimum"
                  label={caption(v)}
                  checked={discount.minimumKind === v}
                  onChange={() => patch({ minimumKind: v })}
                />
              ))}
              {discount.minimumKind !== "None" && (
                <Field
                  label={
                    discount.minimumKind === "Minimum purchase amount"
                      ? ui("minimumAmountEUR")
                      : ui("minimumQuantity")
                  }
                >
                  <input
                    type="number"
                    min={0}
                    value={discount.minimum}
                    onChange={(e) => patch({ minimum: Number(e.target.value) })}
                  />
                </Field>
              )}
            </Panel>
            <Panel title={ui("maximumDiscountUses")}>
              <Field
                label={ui("totalUsageLimit")}
                help={ui("text0MeansNoLimitInThisPreview")}
              >
                <input
                  type="number"
                  min={0}
                  max={999999}
                  value={discount.limit}
                  onChange={(e) => patch({ limit: Number(e.target.value) })}
                />
              </Field>
              <Check
                label={ui("limitToOneUsePerCustomer")}
                checked={discount.once}
                onChange={() => patch({ once: !discount.once })}
              />
            </Panel>
            <Panel title={ui("combinations")}>
              <Check
                label={ui("combineWithOtherProductOrderOrShippingDiscounts")}
                checked={discount.combines}
                onChange={() => patch({ combines: !discount.combines })}
              />
            </Panel>
            <Panel title={ui("activeDates")}>
              <div className={s.fields}>
                <Field label={ui("startDate")}>
                  <input
                    type="date"
                    required
                    value={discount.start}
                    onChange={(e) => patch({ start: e.target.value })}
                  />
                </Field>
                <Field label={ui("endDateOptional")}>
                  <input
                    type="date"
                    min={discount.start}
                    value={discount.end}
                    onChange={(e) => patch({ end: e.target.value })}
                  />
                </Field>
              </div>
            </Panel>
          </div>
          <aside className={s.editorSide}>
            <Panel title={discount.title || ui("noTitleYet")}>
              <h3>{discount.type}</h3>
              <Badge>{discount.method}</Badge>
              <ul>
                <li>
                  {discount.type === "Free shipping"
                    ? ui("freeShipping")
                    : discount.valueMode === "Percentage"
                      ? `${discount.value}% off`
                      : `${money(parseMoney(String(discount.value)) ?? 0, intlLocale)} off`}
                </li>
                <li>{discount.eligibility}</li>
                <li>{discount.minimumKind}</li>
                <li>
                  {discount.once
                    ? ui("oneUsePerCustomer")
                    : ui("multipleUsesPerCustomer")}
                </li>
                <li>
                  {discount.combines
                    ? ui("combinesWithOtherDiscounts")
                    : ui("doesNotCombine")}
                </li>
              </ul>
              <Field label={ui("status")}>
                <select
                  value={discount.status}
                  onChange={(e) => patch({ status: e.target.value })}
                >
                  {["Active", "Scheduled", "Expired", "Disabled"].map((v) => (
                    <option key={v} value={v}>
                      {caption(v)}
                    </option>
                  ))}
                </select>
              </Field>
              <p className={s.help}>
                {ui("localPreviewOnlyThisDoesNotAffectCheckout")}
              </p>
            </Panel>
          </aside>
        </div>
        <div className={s.saveBar}>
          <Action href={href("discounts")}>{ui("cancel")}</Action>
          <Button primary type="submit">
            {ui("saveDiscount")}
          </Button>
        </div>
      </form>
    </main>
  );
}
export function Growth({ detail }: { detail?: string }) {
  const intlLocale = useIntlLocale();
  const caption = useCaption();
  const ui = useTranslations("merchantUI");
  const { store, href, update, notify } = usePreview();
  const [dialog, setDialog] = useState(false);
  const [title, setTitle] = useState("");
  const [channel, setChannel] = useState("Email");
  const [status, setStatus] = useState("Draft");
  const [schedule, setSchedule] = useState("");
  const [view, setView] = useState("Last 30 days");
  const [intro, setIntro] = useState(true);
  const paid = store.orders.filter(
    (o) =>
      o.kind === "Order" &&
      o.payment !== "Pending" &&
      o.fulfillment !== "Cancelled" &&
      o.date >=
        (view === "Today"
          ? "2026-10-02"
          : view === "Last 7 days"
            ? "2026-09-26"
            : "2026-09-03") &&
      o.date <= "2026-10-02",
  );
  const campaigns = detail
    ? store.campaigns.filter((c) => c.id === detail)
    : store.campaigns;
  return (
    <main className={s.growthPage}>
      <Header title={ui("growth")} />
      <div className={s.stack}>
        {intro && (
          <div className={s.hero}>
            <div className={s.heroCopy}>
              <Badge>Treido marketing</Badge>
              <h2>{ui("makeYourNextIdeaACampaign")}</h2>
              <p className={s.muted}>
                {ui("planOffersChooseAnAudienceAndReviewPerformanceFromOne")}
              </p>
              <Button primary onClick={() => setDialog(true)}>
                {ui("createCampaign")}
              </Button>
            </div>
            <Image
              unoptimized
              width={960}
              height={472}
              className={s.heroImage}
              src="/images/admin/onboarding-review-v1.webp"
              alt={ui("treidoCampaignIllustration")}
            />
            <Button
              plain
              className={s.growthDismiss}
              onClick={() => setIntro(false)}
            >
              {ui("dismiss_d7633b")}
            </Button>
          </div>
        )}
        <div className={s.sectionHeading}>
          <h2>{ui("performance")}</h2>
          <div className={s.actions}>
            <select
              className={s.button}
              aria-label={ui("performancePeriod")}
              value={view}
              onChange={(e) => setView(e.target.value)}
              data-ui-label="performancePeriod"
            >
              {["Last 30 days", "Last 7 days", "Today"].map((v) => (
                <option key={v} value={v}>
                  {caption(v)}
                </option>
              ))}
            </select>
            <Action href={href("analytics")}>{ui("viewDetails")}</Action>
          </div>
        </div>
        <div className={s.metricGrid}>
          <Panel title={ui("totalSales")}>
            <p className={s.metric}>
              {money(
                paid.reduce((v, o) => v + orderTotal(o) - o.refunded, 0),
                intlLocale,
              )}
            </p>
            <Chart values={paid.map(orderTotal)} compact />
          </Panel>
          <Panel title={ui("orders")}>
            <p className={s.metric}>{paid.length}</p>
            {paid.length ? (
              <Chart values={paid.map(() => 1)} compact />
            ) : (
              <p className={s.growthNoData}>{ui("noOrdersForThisDateRange")}</p>
            )}
          </Panel>
        </div>
        <Panel
          title={ui("recentCampaigns")}
          action={
            <Button onClick={() => setDialog(true)}>
              {ui("createCampaign")}
            </Button>
          }
        >
          {campaigns.length ? (
            campaigns.map((c) => (
              <div key={c.id} className={s.dataRow}>
                <div>
                  <strong>{c.title}</strong>
                  <p className={s.help}>
                    {c.type} · {c.body}
                  </p>
                </div>
                <Badge>{c.status}</Badge>
                <Button
                  onClick={() => {
                    update({
                      campaigns: store.campaigns.map((v) =>
                        v.id === c.id
                          ? {
                              ...v,
                              status:
                                v.status === "Draft" ? "Scheduled" : "Draft",
                            }
                          : v,
                      ),
                    });
                    notify(ui("campaignStatusSavedLocallyNothingWasSent"));
                  }}
                >
                  {c.status === "Draft" ? ui("schedule") : ui("moveToDraft")}
                </Button>
              </div>
            ))
          ) : (
            <p className={s.muted}>{ui("yourCampaignPlansWillAppearHere")}</p>
          )}
        </Panel>
        <Panel title={ui("campaignChannels")}>
          <div className={s.dataRow}>
            <div>
              <h3>{ui("email")}</h3>
              <p className={s.help}>
                {ui("chooseAnAudienceBeforePreparingACampaign")}
              </p>
            </div>
            <Action href={href("segments")}>{ui("setUpAudience")}</Action>
          </div>
          <div className={s.dataRow}>
            <div>
              <h3>{ui("treidoMarketplace")}</h3>
              <p className={s.help}>
                {ui("prepareProductsAndOffersForYourPublicStore")}
              </p>
            </div>
            <Action href={href("store")}>{ui("manageStore")}</Action>
          </div>
        </Panel>
      </div>
      {dialog && (
        <Modal
          title={ui("createCampaign")}
          onClose={() => setDialog(false)}
          footer={
            <>
              <Button onClick={() => setDialog(false)}>{ui("cancel")}</Button>
              <Button
                primary
                disabled={
                  !title.trim() || (status === "Scheduled" && !schedule)
                }
                onClick={() => {
                  const entry: Entry = {
                    id: `campaign-${crypto.randomUUID()}`,
                    title: title.trim(),
                    body: schedule
                      ? `Scheduled for ${schedule}`
                      : "Campaign draft",
                    status,
                    type: channel,
                    tags: "",
                  };
                  update({ campaigns: [...store.campaigns, entry] });
                  notify(ui("campaignPlanSavedLocallyNothingWasSent"));
                  setDialog(false);
                  setTitle("");
                }}
              >
                {ui("saveCampaign")}
              </Button>
            </>
          }
        >
          <Field label={ui("campaignName")}>
            <input
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <div className={s.fields}>
            <Field label={ui("channel")}>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
              >
                <option value="Email">{ui("email")}</option>
                <option value="Marketplace">{ui("marketplace")}</option>
                <option value="Social">{ui("social")}</option>
              </select>
            </Field>
            <Field label={ui("status")}>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="Draft">{ui("draft")}</option>
                <option value="Scheduled">{ui("scheduled")}</option>
              </select>
            </Field>
          </div>
          {status === "Scheduled" && (
            <Field label={ui("schedule")}>
              <input
                type="datetime-local"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
              />
            </Field>
          )}
          <p className={s.help}>{ui("reviewTheCampaignFlowWithLocalData")}</p>
        </Modal>
      )}
    </main>
  );
}
