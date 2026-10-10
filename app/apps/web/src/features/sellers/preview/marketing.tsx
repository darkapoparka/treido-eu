"use client";
import { useLocale as useIntlLocale } from "next-intl";
import { useCaption } from "../../locale/use-caption";
import { useTranslations } from "next-intl";
import Link from "next/link";
import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminIcon } from "../admin-icons";
import { usePreview } from "./context";
import { UnavailableSurface } from "./unavailable-surface";
import { CampaignIntroduction } from "./campaign-introduction";
import { DiscountItemPicker } from "./discount-item-picker";
import { validDraftDate, validDraftTime } from "./local-draft-model";
import { currentDraftDateTime } from "./draft-date-fields";
import { DiscountTargets, DiscountShippingCountries } from "./discount-targets";
import {
  DiscountLimits,
  DiscountCombinations,
  DiscountSummary,
} from "./discount-rule-controls";
import { DiscountSchedule } from "./discount-schedule";
import { DiscountEligibility } from "./discount-eligibility";
import { DiscountBuyGetValue } from "./discount-buy-get-value";
import {
  validDiscountBuyRequirement,
  validDiscountPlanningTargets,
} from "./discount-eligibility-model";
import { DraftEditorActions } from "./draft-editor-actions";
import {
  money,
  parseMoney,
  orderTotal,
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
  EditorSection,
  EditorBreadcrumb,
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
    <main className={s.page} data-studio-part="page">
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
        <div className={s.tablePanel} data-studio-part="table-panel">
          <Toolbar
            {...list}
            tabs={["All", "Active", "Scheduled", "Expired", "Disabled"]}
          />
          {list.selected.length > 0 && (
            <div className={s.bulk} data-studio-part="bulk">
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
          <div className={s.tableScroll} data-studio-part="table-scroll">
            <table className={s.table} data-studio-part="table">
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
                        data-studio-part="cell-link"
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
          surface="discount-type"
          onClose={() => setCreate(false)}
          footer={
            <Button onClick={() => setCreate(false)}>{ui("cancel")}</Button>
          }
        >
          {discountTypes.map((d) => (
            <Link
              className={s.choice}
              data-studio-part="choice"
              key={d.slug}
              href={href(`discounts/new-${d.slug}`)}
            >
              <AdminIcon name="discount" />
              <span>
                <strong>{d.title}</strong>
                <span className={s.muted} data-studio-part="muted">
                  {d.body}
                </span>
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
  const caption = useCaption();
  const ui = useTranslations("merchantUI");
  const { store, href, update, notify, text } = usePreview();
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
        targetKind: "Collections",
        targetIds: [],
        buyQuantity: kind.title === "Buy X get Y" ? 0 : 1,
        getQuantity: kind.title === "Buy X get Y" ? 0 : 1,
        minimumKind: "None",
        value: kind.title === "Buy X get Y" ? 0 : 10,
        minimum: 0,
        limit: 0,
        once: false,
        combines: false,
        start: currentDraftDateTime().date,
        startTime: currentDraftDateTime().time,
        end: "",
        status: "Draft",
      },
  );
  const [error, setError] = useState("");
  const [itemPicker, setItemPicker] = useState<"buy" | "get" | null>(null);
  const [buyQuery, setBuyQuery] = useState("");
  const [getQuery, setGetQuery] = useState("");
  const [buyAmount, setBuyAmount] = useState(() =>
    (
      (discount.buyMinimumAmountMinor ??
        Math.round((discount.buyMinimumAmount ?? 0) * 100)) / 100
    ).toFixed(2),
  );
  const [initial] = useState(discount);
  const [resetCount, setResetCount] = useState(0);
  const form = useRef<HTMLFormElement>(null);
  const dirty = JSON.stringify(discount) !== JSON.stringify(initial);
  const patch = (change: Partial<Discount>) =>
    setDiscount({ ...discount, ...change });
  if (!existing && !id.startsWith("new"))
    return (
      <main className={s.editor} data-studio-part="editor">
        <Header title={ui("discountNotFound")} back={href("discounts")} />
      </main>
    );
  return (
    <main
      className={s.editor}
      data-studio-part="editor"
      data-studio-builder="discount"
    >
      <DraftEditorActions
        dirty={dirty}
        onSave={() => form.current?.requestSubmit()}
        onDiscard={() => {
          setDiscount(initial);
          setError("");
          setBuyQuery("");
          setGetQuery("");
          setBuyAmount(
            (
              (initial.buyMinimumAmountMinor ??
                Math.round((initial.buyMinimumAmount ?? 0) * 100)) / 100
            ).toFixed(2),
          );
          setItemPicker(null);
          setResetCount((value) => value + 1);
        }}
      />
      <EditorBreadcrumb
        href={href("discounts")}
        title={ui("discounts")}
        icon="discount"
      />
      <Header title={existing ? discount.title : ui("createDiscount")} />
      <form
        ref={form}
        onSubmit={(e) => {
          e.preventDefault();
          const title =
            discount.method === "Discount code"
              ? discount.code.trim()
              : discount.title.trim();
          if (!validDiscountPlanningTargets(discount, store)) {
            setError(
              text(
                "Review local eligibility records, discount value, and the per-order limit.",
                "Проверете локалните записи, стойността на отстъпката и лимита на поръчка.",
              ),
            );
            return;
          }
          if (discount.type === "Buy X get Y") {
            const validItems = (
              kind: "Products" | "Collections" | undefined,
              ids: string[] | undefined,
            ) =>
              !!ids?.length &&
              ids.every((id) =>
                kind === "Collections"
                  ? store.collections.some((item) => item.id === id)
                  : store.products.some(
                      (item) => item.id === id && item.status !== "Archived",
                    ),
              );
            if (
              !validDiscountBuyRequirement(discount) ||
              !Number.isInteger(discount.getQuantity) ||
              discount.getQuantity < 1 ||
              discount.getQuantity > 999 ||
              !validItems(discount.buyKind, discount.buyItemIds) ||
              !validItems(discount.getKind, discount.getItemIds)
            ) {
              setError(
                text(
                  "Select saved items for both Customer buys and Customer gets, and enter positive quantities or a purchase amount.",
                  "Изберете запазени артикули за двете групи и въведете положителен брой или сума на покупката.",
                ),
              );
              return;
            }
          }
          if (
            (discount.type === "Amount off products" &&
              discount.targetKind &&
              (!discount.targetIds?.length ||
                discount.targetIds.some((id) =>
                  discount.targetKind === "Collections"
                    ? !store.collections.some((item) => item.id === id)
                    : !store.products.some(
                        (item) => item.id === id && item.status !== "Archived",
                      ),
                ))) ||
            (discount.type === "Free shipping" &&
              discount.countriesMode === "Selected" &&
              !discount.countryCodes?.length) ||
            (discount.excludeShippingRate &&
              (!Number.isSafeInteger(discount.maximumShippingRate) ||
                (discount.maximumShippingRate ?? -1) < 0 ||
                (discount.maximumShippingRate ?? 0) > 100000000)) ||
            (discount.limitEnabled && discount.limit < 1) ||
            !validDraftTime(discount.startTime ?? "") ||
            !validDraftTime(discount.endTime ?? "") ||
            (discount.end &&
              `${discount.end}T${discount.endTime || "23:59"}` <
                `${discount.start}T${discount.startTime || "00:00"}`) ||
            !title ||
            (discount.method === "Discount code" &&
              !/^[A-Z0-9_-]{2,40}$/.test(discount.code)) ||
            !Number.isFinite(discount.value) ||
            discount.value < 0 ||
            (discount.valueMode === "Percentage" && discount.value > 100) ||
            discount.limit < 0 ||
            discount.minimum < 0 ||
            !Number.isFinite(discount.minimum) ||
            !Number.isInteger(discount.limit) ||
            discount.limit > 999999 ||
            !validDraftDate(discount.start) ||
            (discount.end && !validDraftDate(discount.end)) ||
            (discount.end && discount.end < discount.start)
          ) {
            setError(
              text(
                "Enter a valid code or automatic title, discount value, and date range.",
                "Въведете валиден код или автоматично заглавие, стойност на отстъпката и период.",
              ),
            );
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
            title,
            status: "Draft",
            id: existing ? id : `discount-${crypto.randomUUID()}`,
          };
          update({ discounts: put(store.discounts, saved) });
          notify(ui("discountSavedInTheFrontendPreview"));
          router.push(href(`discounts/${saved.id}`));
        }}
      >
        {error && (
          <p className={s.error} data-studio-part="error" role="alert">
            {error}
          </p>
        )}
        <div className={s.editorColumns} data-studio-part="editor-layout">
          <div className={s.stack} data-studio-part="editor-main">
            <EditorSection
              title={caption(discount.type)}
              part="discount-method"
            >
              <p data-studio-part="discount-method-label">
                {text("Method", "Метод")}
              </p>
              <div
                className={s.tabs}
                data-studio-part="list-tabs"
                role="tablist"
                aria-label={ui("discountMethod")}
                data-ui-label="discountMethod"
                data-discount-part="method-control"
              >
                {["Discount code", "Automatic discount"].map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="tab"
                    className={s.tab}
                    data-studio-part="list-tab"
                    aria-selected={discount.method === v}
                    onClick={() => patch({ method: v })}
                  >
                    {caption(v)}
                  </button>
                ))}
              </div>
              {discount.method !== "Discount code" && (
                <Field label={ui("discountTitle")}>
                  <input
                    required
                    maxLength={100}
                    value={discount.title}
                    onChange={(e) => patch({ title: e.target.value })}
                  />
                </Field>
              )}
              {discount.method === "Discount code" && (
                <>
                  <div data-studio-part="discount-code-heading">
                    <span>{ui("discountCode")}</span>
                    <Button
                      plain
                      data-studio-part="discount-code-generate-desktop"
                      onClick={() =>
                        patch({
                          code: `TREIDO${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
                        })
                      }
                    >
                      {ui("generateRandomCode")}
                    </Button>
                  </div>
                  <div data-studio-part="discount-code-row">
                    <input
                      aria-label={ui("discountCode")}
                      required
                      maxLength={40}
                      value={discount.code}
                      onChange={(event) =>
                        patch({
                          code: event.target.value
                            .toUpperCase()
                            .replaceAll(" ", ""),
                        })
                      }
                    />
                    <Button
                      plain
                      data-studio-part="discount-code-generate-phone"
                      aria-label={ui("generateRandomCode")}
                      onClick={() =>
                        patch({
                          code: `TREIDO${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
                        })
                      }
                    >
                      <svg viewBox="0 0 20 20" aria-hidden="true" fill="none">
                        <path
                          d="M5 7h10l-3-3m3 3-3 3M15 13H5l3 3m-3-3 3-3"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </Button>
                  </div>
                  <p className={s.help} data-studio-part="field-help">
                    {ui("customersEnterThisCodeAtCheckout")}
                  </p>
                </>
              )}
            </EditorSection>
            {discount.type !== "Free shipping" && (
              <EditorSection title={ui("discountValue")} part="discount-value">
                {discount.type === "Buy X get Y" && (
                  <>
                    {bogoGroup("buy")}
                    {bogoGroup("get")}
                  </>
                )}
                {discount.type === "Buy X get Y" ? (
                  <DiscountBuyGetValue
                    key={`value-${resetCount}`}
                    discount={discount}
                    patch={patch}
                  />
                ) : (
                  <div className={s.fields} data-studio-part="fields">
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
                        <option value="Fixed amount">
                          {ui("fixedAmount")}
                        </option>
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
                        max={
                          discount.valueMode === "Percentage" ? 100 : 1000000
                        }
                        step={discount.valueMode === "Percentage" ? 1 : 0.01}
                        value={discount.value}
                        onChange={(e) =>
                          patch({ value: Number(e.target.value) })
                        }
                      />
                    </Field>
                  </div>
                )}
                {discount.type === "Amount off products" && (
                  <DiscountTargets discount={discount} patch={patch} />
                )}
              </EditorSection>
            )}
            {discount.type === "Free shipping" && (
              <DiscountShippingCountries
                key={`countries-${resetCount}`}
                discount={discount}
                patch={patch}
              />
            )}
            <DiscountEligibility
              key={`eligibility-${resetCount}`}
              discount={discount}
              patch={patch}
            />
            {discount.type !== "Buy X get Y" && (
              <EditorSection
                title={ui("minimumPurchaseRequirements")}
                part="discount-minimum"
              >
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
                      onChange={(e) =>
                        patch({ minimum: Number(e.target.value) })
                      }
                    />
                  </Field>
                )}
              </EditorSection>
            )}
            <DiscountLimits discount={discount} patch={patch} />
            <DiscountCombinations discount={discount} patch={patch} />
            <DiscountSchedule discount={discount} patch={patch} />
            <EditorSection
              title={text(
                "Sales channel access",
                "Достъп до канали за продажба",
              )}
              part="discount-channel-access"
            >
              <Check
                disabled
                checked={false}
                label={text(
                  "Allow discount to be featured on selected channels",
                  "Показване на отстъпката в избрани канали",
                )}
                onChange={() => {}}
              />
              <p className={s.help}>
                {text(
                  "Requires connected sales channels",
                  "Изисква свързани канали за продажба",
                )}
              </p>
            </EditorSection>
          </div>
          <aside className={s.editorSide} data-studio-part="editor-side">
            <DiscountSummary discount={discount} patch={patch} />
          </aside>
        </div>
        <div className={s.saveBar} data-studio-part="save-bar">
          <Action href={href("discounts")}>{ui("cancel")}</Action>
          <Button primary type="submit">
            {text("Save draft", "Запазване на чернова")}
          </Button>
        </div>
      </form>
      {itemPicker && (
        <DiscountItemPicker
          kind={
            (itemPicker === "buy" ? discount.buyKind : discount.getKind) ??
            "Products"
          }
          selected={
            (itemPicker === "buy"
              ? discount.buyItemIds
              : discount.getItemIds) ?? []
          }
          query={itemPicker === "buy" ? buyQuery : getQuery}
          onClose={() => setItemPicker(null)}
          onApply={(ids) => {
            patch(
              itemPicker === "buy" ? { buyItemIds: ids } : { getItemIds: ids },
            );
            setItemPicker(null);
          }}
        />
      )}
    </main>
  );
  function bogoGroup(side: "buy" | "get") {
    const buy = side === "buy";
    const selectedKind =
      (buy ? discount.buyKind : discount.getKind) ?? "Products";
    const selectedIds = (buy ? discount.buyItemIds : discount.getItemIds) ?? [];
    const items =
      selectedKind === "Products" ? store.products : store.collections;
    const amount = buy && discount.buyMinimumKind === "Amount";
    return (
      <section data-studio-part={`discount-${side}-group`}>
        <h3>
          {buy
            ? text("Customer buys", "Клиентът купува")
            : text("Customer gets", "Клиентът получава")}
        </h3>
        {buy ? (
          <>
            <Check
              radio
              name="buy-minimum"
              label={text(
                "Minimum quantity of items",
                "Минимален брой артикули",
              )}
              checked={!amount}
              onChange={() => patch({ buyMinimumKind: "Quantity" })}
            />
            <Check
              radio
              name="buy-minimum"
              label={text(
                "Minimum purchase amount",
                "Минимална сума на покупката",
              )}
              checked={amount}
              onChange={() => patch({ buyMinimumKind: "Amount" })}
            />
          </>
        ) : (
          <p className={s.help}>
            {text(
              "Customers must add the quantity of items specified below to their cart.",
              "Клиентите трябва да добавят посочения по-долу брой артикули в количката си.",
            )}
          </p>
        )}
        <div className={s.fields} data-studio-part="discount-quantity-from">
          <Field
            label={
              amount ? text("Amount EUR", "Сума EUR") : text("Quantity", "Брой")
            }
          >
            <input
              type="number"
              min={amount ? 0.01 : 1}
              max={amount ? 1000000 : 999}
              step={amount ? 0.01 : 1}
              value={
                amount
                  ? buyAmount
                  : buy
                    ? discount.buyQuantity || ""
                    : discount.getQuantity || ""
              }
              onChange={(event) => {
                if (amount) {
                  setBuyAmount(event.target.value);
                  patch({
                    buyMinimumAmountMinor: parseMoney(event.target.value) ?? -1,
                  });
                } else
                  patch(
                    buy
                      ? { buyQuantity: Number(event.target.value) }
                      : { getQuantity: Number(event.target.value) },
                  );
              }}
            />
          </Field>
          <Field label={text("Any items from", "Артикули от")}>
            <select
              value={selectedKind}
              onChange={(event) =>
                patch(
                  buy
                    ? {
                        buyKind: event.target.value as
                          "Products" | "Collections",
                        buyItemIds: [],
                      }
                    : {
                        getKind: event.target.value as
                          "Products" | "Collections",
                        getItemIds: [],
                      },
                )
              }
            >
              <option value="Products">
                {text("Specific products", "Конкретни продукти")}
              </option>
              <option value="Collections">
                {text("Specific collections", "Конкретни колекции")}
              </option>
            </select>
          </Field>
        </div>
        <div data-studio-part="discount-item-search" data-bogo-search>
          <AdminIcon name="search" />
          <input
            aria-label={`${buy ? text("Customer buys", "Клиентът купува") : text("Customer gets", "Клиентът получава")} ${selectedKind === "Products" ? text("search products", "търсене на продукти") : text("search collections", "търсене на колекции")}`}
            type="search"
            placeholder={
              selectedKind === "Products"
                ? text("Search products", "Търсене на продукти")
                : text("Search collections", "Търсене на колекции")
            }
            value={buy ? buyQuery : getQuery}
            maxLength={160}
            onChange={(event) =>
              buy
                ? setBuyQuery(event.target.value)
                : setGetQuery(event.target.value)
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                setItemPicker(side);
              }
            }}
          />
          <Button onClick={() => setItemPicker(side)}>
            {text("Browse", "Преглед")}
          </Button>
        </div>
        <Button
          data-studio-part="discount-bogo-add"
          onClick={() => setItemPicker(side)}
        >
          <AdminIcon name="plus" />
          {selectedKind === "Products"
            ? text("Add products", "Добавяне на продукти")
            : text("Add collections", "Добавяне на колекции")}
        </Button>
        {selectedIds.map((id) => (
          <div className={s.dataRow} key={id}>
            <span>
              {items.find((item) => item.id === id)?.title ??
                text("Unavailable local item", "Недостъпен локален артикул")}
            </span>
            <Button
              plain
              aria-label={`${text("Remove", "Премахване")} ${id}`}
              onClick={() =>
                patch(
                  buy
                    ? {
                        buyItemIds: selectedIds.filter((value) => value !== id),
                      }
                    : {
                        getItemIds: selectedIds.filter((value) => value !== id),
                      },
                )
              }
            >
              <AdminIcon name="close" />
            </Button>
          </div>
        ))}
      </section>
    );
  }
}
export function Growth({ detail }: { detail?: string }) {
  const intlLocale = useIntlLocale();
  const caption = useCaption();
  const ui = useTranslations("merchantUI");
  const { store, href, update, notify, text } = usePreview();
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
  if (detail === "attribution" || detail === "autopilot")
    return <UnavailableSurface section={detail} />;
  const campaigns =
    detail && detail !== "campaigns"
      ? store.campaigns.filter((c) => c.id === detail)
      : store.campaigns;
  return (
    <main
      className={detail === "campaigns" ? s.page : s.growthPage}
      data-studio-part={detail === "campaigns" ? "page" : "growth-page"}
    >
      <Header
        title={
          detail === "campaigns" ? text("Campaigns", "Кампании") : ui("growth")
        }
        icon={detail === "campaigns" ? "growth" : undefined}
        actions={
          detail === "campaigns" ? (
            <Button primary onClick={() => setDialog(true)}>
              {ui("createCampaign")}
            </Button>
          ) : undefined
        }
      />
      <div className={s.stack} data-studio-part="stack">
        {detail === "campaigns" && !campaigns.length && (
          <CampaignIntroduction create={() => setDialog(true)} />
        )}
        {intro && detail !== "campaigns" && (
          <div className={s.hero} data-studio-part="hero">
            <div className={s.heroCopy} data-studio-part="hero-copy">
              <Badge>Treido marketing</Badge>
              <h2>{ui("makeYourNextIdeaACampaign")}</h2>
              <p className={s.muted} data-studio-part="muted">
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
              data-studio-part="hero-image"
              src="/images/admin/onboarding-review-v1.webp"
              alt={ui("treidoCampaignIllustration")}
            />
            <Button
              plain
              className={s.growthDismiss}
              data-studio-part="growth-dismiss"
              onClick={() => setIntro(false)}
            >
              {ui("dismiss_d7633b")}
            </Button>
          </div>
        )}
        {detail !== "campaigns" && (
          <>
            <div className={s.sectionHeading} data-studio-part="panel-heading">
              <h2>{ui("performance")}</h2>
              <div className={s.actions} data-studio-part="actions">
                <select
                  className={s.button}
                  data-studio-part="button"
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
            <div className={s.metricGrid} data-studio-part="metric-grid">
              <Panel title={ui("totalSales")}>
                <p className={s.metric} data-studio-part="metric">
                  {money(
                    paid.reduce((v, o) => v + orderTotal(o) - o.refunded, 0),
                    intlLocale,
                  )}
                </p>
                <Chart values={paid.map(orderTotal)} compact />
              </Panel>
              <Panel title={ui("orders")}>
                <p className={s.metric} data-studio-part="metric">
                  {paid.length}
                </p>
                {paid.length ? (
                  <Chart values={paid.map(() => 1)} compact />
                ) : (
                  <p
                    className={s.growthNoData}
                    data-studio-part="growth-no-data"
                  >
                    {ui("noOrdersForThisDateRange")}
                  </p>
                )}
              </Panel>
              <Panel title={ui("emailSubscribers")}>
                <p className={s.metric} data-studio-part="metric">
                  {
                    store.customers.filter((customer) => customer.marketing)
                      .length
                  }
                </p>
                <p className={s.growthNoData} data-studio-part="growth-no-data">
                  {text(
                    "Saved customer preferences in this preview",
                    "Запазени клиентски предпочитания в прегледа",
                  )}
                </p>
              </Panel>
            </div>
          </>
        )}
        {detail !== "campaigns" && (
          <EditorSection title={ui("campaignChannels")} part="growth-planning">
            <div className={s.dataRow} data-studio-part="data-row">
              <div>
                <h3>{ui("email")}</h3>
                <p className={s.help} data-studio-part="field-help">
                  {ui("chooseAnAudienceBeforePreparingACampaign")}
                </p>
              </div>
              <Action href={href("segments")}>{ui("setUpAudience")}</Action>
            </div>
            <div className={s.dataRow} data-studio-part="data-row">
              <div>
                <h3>{ui("treidoMarketplace")}</h3>
                <p className={s.help} data-studio-part="field-help">
                  {ui("prepareProductsAndOffersForYourPublicStore")}
                </p>
              </div>
              <Action href={href("store")}>{ui("manageStore")}</Action>
            </div>
          </EditorSection>
        )}
        {(detail !== "campaigns" || campaigns.length > 0) && (
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
                <div
                  key={c.id}
                  className={s.dataRow}
                  data-studio-part="data-row"
                >
                  <div>
                    <strong>{c.title}</strong>
                    <p className={s.help} data-studio-part="field-help">
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
              <p className={s.muted} data-studio-part="muted">
                {ui("yourCampaignPlansWillAppearHere")}
              </p>
            )}
          </Panel>
        )}
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
          <div className={s.fields} data-studio-part="fields">
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
          <p className={s.help} data-studio-part="field-help">
            {ui("reviewTheCampaignFlowWithLocalData")}
          </p>
        </Modal>
      )}
    </main>
  );
}
