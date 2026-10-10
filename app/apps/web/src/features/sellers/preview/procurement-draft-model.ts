export const purchaseTerms = [
  ["None", "None", "Няма"],
  ["7", "Net 7", "7 дни"],
  ["15", "Net 15", "15 дни"],
  ["30", "Net 30", "30 дни"],
  ["45", "Net 45", "45 дни"],
  ["60", "Net 60", "60 дни"],
  ["Delivery", "Cash on delivery", "Наложен платеж"],
  ["Receipt", "Payment on receipt", "Плащане при получаване"],
  ["Advance", "Payment in advance", "Предварително плащане"],
] as const;
export const purchaseAdjustments = [
  ["Shipping", "Shipping amount", "Доставка"],
  ["Customs", "Customs duties", "Мита"],
  ["Discount", "Discount", "Отстъпка"],
  ["Foreign", "Foreign transaction fee", "Такса за чуждестранна трансакция"],
  ["Freight", "Freight fee", "Такса за превоз"],
  ["Insurance", "Insurance", "Застраховка"],
  ["Rush", "Rush fee", "Експресна такса"],
  ["Surcharge", "Surcharge", "Допълнителна такса"],
  ["Tariffs", "Tariffs", "Тарифи"],
  ["Other", "Other", "Друго"],
] as const;
export type ProcurementDraft = {
  kind: "PurchaseOrder" | "Transfer";
  date: string;
  reference: string;
  notes: string;
  terms: (typeof purchaseTerms)[number][0];
  currency: "EUR";
  purchaseOrderId: string;
  lines: { productId: string; quantity: number; cost: number }[];
  adjustments: {
    id: string;
    kind: (typeof purchaseAdjustments)[number][0];
    amount: number;
  }[];
};
export type GiftCardDraft = {
  kind: "GiftCard";
  code: string;
  value: number;
  expiry: string;
  customerId: string;
  notes: string;
};
const short = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length <= max;
const minor = (value: unknown, max = 100000000): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= max;
const date = (value: unknown) =>
  value === "" ||
  (typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T12:00:00Z`)) &&
    new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value);
export function validProcurementDraft(
  value: unknown,
): value is ProcurementDraft | GiftCardDraft {
  if (!value || typeof value !== "object") return false;
  const d = value as Record<string, unknown>;
  if (d.kind === "GiftCard")
    return (
      short(d.code, 32) &&
      /^[A-Z0-9-]{8,32}$/.test(d.code) &&
      minor(d.value) &&
      Number(d.value) > 0 &&
      date(d.expiry) &&
      short(d.customerId, 100) &&
      short(d.notes, 5000)
    );
  if (d.kind !== "PurchaseOrder" && d.kind !== "Transfer") return false;
  if (
    !date(d.date) ||
    !d.date ||
    !short(d.reference, 255) ||
    !short(d.notes, 5000) ||
    d.currency !== "EUR" ||
    !purchaseTerms.some(([id]) => id === d.terms) ||
    !short(d.purchaseOrderId, 100) ||
    !Array.isArray(d.lines) ||
    d.lines.length > 100 ||
    !Array.isArray(d.adjustments) ||
    d.adjustments.length > 20
  )
    return false;
  if (
    !d.lines.every(
      (line) =>
        line &&
        typeof line === "object" &&
        short(line.productId, 100) &&
        /^[a-z0-9-]{1,100}$/.test(line.productId) &&
        minor(line.quantity, 9999) &&
        line.quantity > 0 &&
        minor(line.cost),
    )
  )
    return false;
  if (
    !d.adjustments.every(
      (item) =>
        item &&
        typeof item === "object" &&
        short(item.id, 100) &&
        /^[a-z0-9-]{1,100}$/.test(item.id) &&
        purchaseAdjustments.some(([id]) => id === item.kind) &&
        minor(item.amount),
    )
  )
    return false;
  const total = procurementTotal(d as unknown as ProcurementDraft).total;
  return (
    new Set(d.lines.map((line) => line.productId)).size === d.lines.length &&
    new Set(d.adjustments.map((item) => item.id)).size ===
      d.adjustments.length &&
    (d.kind !== "Transfer" ||
      (d.terms === "None" && d.adjustments.length === 0)) &&
    Number.isSafeInteger(total) &&
    total >= 0
  );
}
export function procurementTotal(draft: ProcurementDraft) {
  const subtotal = draft.lines.reduce(
    (sum, line) => sum + line.cost * line.quantity,
    0,
  );
  const adjustments = draft.adjustments.reduce(
    (sum, item) =>
      sum + (item.kind === "Discount" ? -item.amount : item.amount),
    0,
  );
  return { subtotal, adjustments, total: subtotal + adjustments };
}
