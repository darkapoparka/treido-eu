"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminIcon } from "../admin-icons";
import { usePreview } from "./context";
import { currentDraftDateTime } from "./draft-date-fields";
import { DiscountItemPicker } from "./discount-item-picker";
import { DraftEditorActions } from "./draft-editor-actions";
import { ProcurementDetails, ProcurementCosts } from "./procurement-details";
import {
  procurementTotal,
  purchaseTerms,
  purchaseAdjustments,
  validProcurementDraft,
  type ProcurementDraft,
} from "./procurement-draft-model";
import { money, parseMoney, put, type Entry } from "./model";
import {
  Action,
  Button,
  EditorBreadcrumb,
  EditorSection,
  Field,
  Header,
  Panel,
  s,
} from "./ui";
import styles from "./procurement-drafts.module.css";

export function ProcurementDraftEditor({
  section,
  id,
}: {
  section: "purchase-orders" | "transfers";
  id: string;
}) {
  const { store, text, href, language, update, notify } = usePreview();
  const router = useRouter();
  const transfer = section === "transfers";
  const kind = transfer ? "Transfer" : "PurchaseOrder";
  const existing = store.entries.find(
    (entry) => entry.id === id && entry.type === `${kind}Draft`,
  );
  const [draft, setDraft] = useState<ProcurementDraft>(() =>
    existing?.editorDraft?.kind === kind
      ? (existing.editorDraft as ProcurementDraft)
      : {
          kind,
          date: currentDraftDateTime().date,
          reference: "",
          notes: "",
          terms: "None",
          currency: "EUR",
          purchaseOrderId: "",
          lines: [],
          adjustments: [],
        },
  );
  const [tags, setTags] = useState(existing?.tags ?? "");
  const [dialog, setDialog] = useState<"details" | "costs" | "items" | null>(
    null,
  );
  const [error, setError] = useState("");
  const [costInputs, setCostInputs] = useState<Record<string, string>>({});
  const [initial] = useState(() => ({ draft, tags }));
  const dirty = JSON.stringify({ draft, tags }) !== JSON.stringify(initial);
  const totals = procurementTotal(draft);
  const unavailable = text(
    "Requires authorized supplier and location adapters. This is local planning only.",
    "Изисква разрешени адаптери за доставчици и локации. Това е само локално планиране.",
  );
  if (id !== "new" && !existing)
    return (
      <main className={s.editor}>
        <Header
          title={text("Draft not found", "Черновата не е намерена")}
          back={href(section)}
        />
      </main>
    );
  const title = transfer
    ? text("Create transfer", "Създаване на трансфер")
    : text("Create purchase order", "Създаване на поръчка към доставчик");
  const save = () => {
    if (
      !validProcurementDraft(draft) ||
      totals.total < 0 ||
      !Number.isSafeInteger(totals.total) ||
      draft.lines.some(
        (line) =>
          !store.products.some(
            (product) =>
              product.id === line.productId && product.status !== "Archived",
          ),
      ) ||
      (draft.purchaseOrderId &&
        !store.entries.some(
          (entry) =>
            entry.id === draft.purchaseOrderId &&
            entry.type === "PurchaseOrderDraft",
        ))
    ) {
      setError(
        text(
          "Review the dates, item quantities, costs, and linked local draft. The total cannot be negative.",
          "Проверете датите, количествата, разходите и свързаната чернова. Общата сума не може да е отрицателна.",
        ),
      );
      return;
    }
    const saved: Entry = {
      id:
        existing?.id ??
        `${transfer ? "transfer" : "purchase-order"}-${crypto.randomUUID()}`,
      title:
        draft.reference.trim() ||
        text(
          transfer ? "Transfer draft" : "Purchase order draft",
          transfer ? "Чернова на трансфер" : "Чернова на поръчка",
        ),
      type: `${kind}Draft`,
      status: "Draft",
      body: draft.notes,
      tags,
      editorDraft: draft,
    };
    update({ entries: put(store.entries, saved) });
    notify(
      text(
        "Draft saved locally. No supplier order, payment, or stock movement was created.",
        "Черновата е запазена локално. Не е създадена поръчка, плащане или движение на наличности.",
      ),
    );
    router.push(href(`${section}/${saved.id}`));
  };
  const termLabel = purchaseTerms.find(([id]) => id === draft.terms);
  const details = (
    <EditorSection
      title={
        transfer
          ? text("Transfer details", "Подробности за трансфера")
          : text("Purchase order details", "Подробности за поръчката")
      }
      part="procurement-details"
      action={
        <Button
          plain
          aria-label={
            transfer
              ? text(
                  "Edit transfer details",
                  "Редактиране на подробностите за трансфера",
                )
              : text(
                  "Edit purchase order details",
                  "Редактиране на подробностите за поръчката",
                )
          }
          onClick={() => setDialog("details")}
        >
          <AdminIcon name="edit" />
        </Button>
      }
    >
      <div className={styles.detailGroups}>
        {transfer && (
          <div>
            <span className={s.muted}>
              {text("Created at", "Дата на създаване")}
            </span>
            <span>
              {new Intl.DateTimeFormat(language === "bg" ? "bg-BG" : "en-US", {
                dateStyle: "long",
                timeZone: "UTC",
              }).format(new Date(`${draft.date}T12:00:00Z`))}
            </span>
          </div>
        )}
        <div>
          <span className={s.muted}>
            {transfer
              ? text("Reference name", "Референтно име")
              : text("Reference number", "Референтен номер")}
          </span>
          <span>{draft.reference || text("None", "Няма")}</span>
        </div>
        <div>
          <span className={s.muted}>
            {transfer
              ? text("Note", "Бележка")
              : text("Note to supplier", "Бележка към доставчика")}
          </span>
          <span className={styles.notes}>
            {draft.notes || text("None", "Няма")}
          </span>
        </div>
        {!transfer && (
          <>
            <div>
              <span className={s.muted}>{text("Terms", "Условия")}</span>
              <span>
                {termLabel
                  ? text(termLabel[1], termLabel[2])
                  : text("None", "Няма")}
              </span>
            </div>
            <div>
              <span className={s.muted}>{text("Currency", "Валута")}</span>
              <span>EUR €</span>
            </div>
          </>
        )}
      </div>
    </EditorSection>
  );
  const origin = (
    <div className={transfer ? styles.timeline : styles.origin}>
      <div>
        {!transfer && <h3>{text("Supplier", "Доставчик")}</h3>}
        <Button plain disabled title={unavailable}>
          {transfer ? <AdminIcon name="markets" /> : null}
          {transfer
            ? text("Select origin", "Избор на източник")
            : text("Select supplier", "Избор на доставчик")}
          <AdminIcon name="chevron" />
        </Button>
      </div>
      {transfer && (
        <p>
          <AdminIcon name="orders" /> {text("In transit", "В транзит")}
        </p>
      )}
      <div>
        {!transfer && <h3>{text("Destination", "Дестинация")}</h3>}
        <Button plain disabled title={unavailable}>
          {transfer ? <AdminIcon name="markets" /> : null}
          {text("Select destination", "Избор на дестинация")}
          <AdminIcon name="chevron" />
        </Button>
      </div>
    </div>
  );
  return (
    <main
      className={`${s.editor} ${styles.editor}`}
      data-studio-part="editor"
      data-studio-builder={transfer ? "transfer" : "purchase-order"}
    >
      <DraftEditorActions
        dirty={dirty}
        onSave={save}
        onDiscard={() => {
          setDraft(initial.draft);
          setTags(initial.tags);
          setCostInputs({});
          setError("");
        }}
      />
      <EditorBreadcrumb
        href={href(section)}
        title={
          transfer
            ? text("Transfers", "Трансфери")
            : text("Purchase orders", "Поръчки към доставчици")
        }
        icon="orders"
      />
      <Header title={existing ? existing.title : title} />
      <div className={s.editorColumns} data-studio-part="editor-layout">
        <div className={s.stack} data-studio-part="editor-main">
          {!transfer && <Panel part="procurement-origin">{origin}</Panel>}
          <Panel part={transfer ? "procurement-origin" : "procurement-items"}>
            {transfer && origin}
            <div className={styles.itemSearch}>
              <Button plain onClick={() => setDialog("items")}>
                <AdminIcon name="search" />
                {text(
                  "Search products to add",
                  "Търсене на продукти за добавяне",
                )}
              </Button>
              <Button
                plain
                disabled
                title={text(
                  "Import requires a procurement adapter",
                  "Импортът изисква адаптер за снабдяване",
                )}
                aria-label={text("Import", "Импорт")}
              >
                ↓
              </Button>
              <Button
                plain
                disabled
                title={text(
                  "Barcode scanning is unavailable",
                  "Сканирането на баркод е недостъпно",
                )}
                aria-label={text(
                  "Use a barcode scanner to scan products",
                  "Сканиране на продукти с баркод",
                )}
              >
                ▥
              </Button>
            </div>
            {draft.lines.length > 0 && (
              <div className={s.tableScroll}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>{text("Product", "Продукт")}</th>
                      <th>{text("Quantity", "Брой")}</th>
                      {!transfer && (
                        <th>{text("Unit cost EUR", "Единичен разход EUR")}</th>
                      )}
                      <th>
                        <span className={s.help}>
                          {text("Remove", "Премахване")}
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.lines.map((line) => (
                      <tr key={line.productId}>
                        <td>
                          {store.products.find(
                            (product) => product.id === line.productId,
                          )?.title ??
                            text(
                              "Unavailable local product",
                              "Недостъпен локален продукт",
                            )}
                        </td>
                        <td>
                          <input
                            className={styles.quantity}
                            type="number"
                            min={1}
                            max={9999}
                            aria-label={text("Item quantity", "Брой артикули")}
                            value={line.quantity}
                            onChange={(event) =>
                              setDraft({
                                ...draft,
                                lines: draft.lines.map((item) =>
                                  item.productId === line.productId
                                    ? {
                                        ...item,
                                        quantity: Number(event.target.value),
                                      }
                                    : item,
                                ),
                              })
                            }
                          />
                        </td>
                        {!transfer && (
                          <td>
                            <input
                              className={styles.cost}
                              inputMode="decimal"
                              maxLength={12}
                              aria-label={text(
                                "Unit cost EUR",
                                "Единичен разход EUR",
                              )}
                              value={
                                costInputs[line.productId] ??
                                (line.cost < 0
                                  ? ""
                                  : (line.cost / 100).toFixed(2))
                              }
                              onChange={(event) => {
                                setCostInputs({
                                  ...costInputs,
                                  [line.productId]: event.target.value,
                                });
                                setDraft({
                                  ...draft,
                                  lines: draft.lines.map((item) =>
                                    item.productId === line.productId
                                      ? {
                                          ...item,
                                          cost:
                                            parseMoney(event.target.value) ??
                                            -1,
                                        }
                                      : item,
                                  ),
                                });
                              }}
                            />
                          </td>
                        )}
                        <td>
                          <Button
                            plain
                            aria-label={text(
                              "Remove product",
                              "Премахване на продукт",
                            )}
                            onClick={() =>
                              setDraft({
                                ...draft,
                                lines: draft.lines.filter(
                                  (item) => item.productId !== line.productId,
                                ),
                              })
                            }
                          >
                            ×
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
          {transfer && details}
        </div>
        <aside className={s.editorSide} data-studio-part="editor-side">
          {!transfer && (
            <>
              <EditorSection
                title={text("Cost summary", "Обобщение на разходите")}
                part="procurement-cost-summary"
                action={
                  <Button
                    plain
                    aria-label={text(
                      "Edit cost summary",
                      "Редактиране на разходите",
                    )}
                    onClick={() => setDialog("costs")}
                  >
                    <AdminIcon name="edit" />
                  </Button>
                }
              >
                <h3>{text("Order details", "Подробности за поръчката")}</h3>
                <div className={s.dataRow}>
                  <span>
                    {draft.lines.length} {text("variants", "варианта")} (
                    {draft.lines.reduce((sum, line) => sum + line.quantity, 0)}{" "}
                    {text("items", "артикула")})
                  </span>
                  <span>{money(totals.subtotal, language)}</span>
                </div>
                <div className={s.dataRow}>
                  <span>{text("Taxes (Included)", "Данъци (включени)")}</span>
                  <span>{text("Not calculated", "Не са изчислени")}</span>
                </div>
                {draft.adjustments.map((item) => (
                  <div className={s.dataRow} key={item.id}>
                    <span>{purchaseAdjustmentsLabel(item.kind)}</span>
                    <span>
                      {money(
                        item.kind === "Discount" ? -item.amount : item.amount,
                        language,
                      )}
                    </span>
                  </div>
                ))}
                <div className={s.dataRow}>
                  <strong>{text("Total", "Общо")}</strong>
                  <strong>{money(totals.total, language)}</strong>
                </div>
              </EditorSection>
              {details}
            </>
          )}
          {transfer && (
            <Panel part="procurement-link">
              <div className={styles.linkPurchaseOrder}>
                <select
                  aria-label={text(
                    "Link purchase order",
                    "Свързване с поръчка",
                  )}
                  value={draft.purchaseOrderId}
                  onChange={(event) =>
                    setDraft({ ...draft, purchaseOrderId: event.target.value })
                  }
                >
                  <option value="">
                    {text("Link purchase order", "Свързване с поръчка")}
                  </option>
                  {store.entries
                    .filter((entry) => entry.type === "PurchaseOrderDraft")
                    .map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.title}
                      </option>
                    ))}
                </select>
              </div>
            </Panel>
          )}
          <EditorSection title={text("Tags", "Тагове")} part="procurement-tags">
            <Field
              label={text(
                "Find or create tags",
                "Намиране или създаване на тагове",
              )}
            >
              <input
                maxLength={500}
                value={tags}
                onChange={(event) => setTags(event.target.value)}
              />
            </Field>
          </EditorSection>
        </aside>
      </div>
      <p className={s.help} data-studio-part="draft-boundary">
        {unavailable}
      </p>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      <div className={s.saveBar} data-studio-part="save-bar">
        <Action href={href(section)}>{text("Cancel", "Отказ")}</Action>
        <Button primary onClick={save}>
          {text("Save draft", "Запазване на чернова")}
        </Button>
      </div>
      {dialog === "details" && (
        <ProcurementDetails
          draft={draft}
          onClose={() => setDialog(null)}
          onApply={(value) => {
            setDraft(value);
            setDialog(null);
          }}
        />
      )}
      {dialog === "costs" && (
        <ProcurementCosts
          draft={draft}
          onClose={() => setDialog(null)}
          onApply={(adjustments) => {
            setDraft({ ...draft, adjustments });
            setDialog(null);
          }}
        />
      )}
      {dialog === "items" && (
        <DiscountItemPicker
          kind="Products"
          selected={draft.lines.map((line) => line.productId)}
          onClose={() => setDialog(null)}
          onApply={(ids) => {
            setDraft({
              ...draft,
              lines: ids.map(
                (productId) =>
                  draft.lines.find((line) => line.productId === productId) ?? {
                    productId,
                    quantity: 1,
                    cost:
                      store.products.find((product) => product.id === productId)
                        ?.cost ?? 0,
                  },
              ),
            });
            setDialog(null);
          }}
        />
      )}
    </main>
  );
  function purchaseAdjustmentsLabel(kind: string) {
    const row = purchaseAdjustments.find(([id]) => id === kind);
    return row ? text(row[1], row[2]) : kind;
  }
}
