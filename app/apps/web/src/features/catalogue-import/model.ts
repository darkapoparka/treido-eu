import { getCategory } from "@treido/contracts/categories";
import {
  parseDraftPayload,
  parseEuroPrice,
  type DraftPayload,
  validId,
} from "../selling/draft-model";
import { reviewPreparation, type RawFields } from "../selling/form-model";
import {
  onlyKeys,
  plainRecord,
  parseOptions,
  whole,
  type VariantOptions,
} from "../inventory/model";
import { SellerError } from "../sellers/errors";
import { CSV_COLUMNS, CSV_LIMITS, type CsvRow } from "./csv";
export type ImportIssue = {
  field: string;
  code:
    | "required"
    | "invalid"
    | "duplicate_external_id"
    | "already_imported"
    | "quota_exceeded"
    | "unavailable";
};
export type ImportedInventory = {
  mode: "unique" | "stocked";
  quantity: number;
  sku: string;
  options: VariantOptions;
};
export type ParsedImportRow = {
  number: number;
  externalId: string | null;
  raw: CsvRow;
  payload: DraftPayload | null;
  inventory: ImportedInventory | null;
  errors: ImportIssue[];
};
export type ImportState =
  | "uploading"
  | "review"
  | "queued"
  | "processing"
  | "paused"
  | "completed"
  | "cancelled";
export type ImportSummary = {
  id: string;
  name: string;
  state: ImportState;
  revision: number;
  total: number;
  created: number;
  ready: number;
  invalid: number;
  selected: number;
  error: string | null;
  createdAt: string;
};
export type ImportRowView = ParsedImportRow & {
  selected: boolean;
  state: "ready" | "invalid" | "created" | "failed";
  listingId: string | null;
};
export type ImportView = ImportSummary & {
  sellerId: string;
  rows: ImportRowView[];
  after: number;
  nextAfter: number | null;
  rowLimit: number;
  draftsRemaining: number;
  canManage: boolean;
  uploaded: number[];
  sourceBytes: number;
  sourceHash: string;
};
function json(value: string | undefined): unknown {
  if (!value?.trim()) return {};
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
function rawFields(value: unknown): RawFields | null {
  if (!plainRecord(value)) return null;
  const result: RawFields = {};
  for (const [key, v] of Object.entries(value)) {
    if (["__proto__", "prototype", "constructor"].includes(key)) return null;
    if (typeof v === "string") result[key] = v;
    else if (typeof v === "number" && Number.isFinite(v))
      result[key] = String(v);
    else if (typeof v === "boolean") result[key] = v ? "yes" : "no";
    else if (Array.isArray(v) && v.every((x) => typeof x === "string"))
      result[key] = v;
    else if (
      plainRecord(v) &&
      Object.values(v).every(
        (x) =>
          typeof x === "string" ||
          (typeof x === "number" && Number.isFinite(x)),
      )
    )
      result[key] = Object.fromEntries(
        Object.entries(v).map(([k, x]) => [k, String(x)]),
      );
    else return null;
  }
  return result;
}
export function validateImportRow(
  raw: CsvRow,
  number: number,
): ParsedImportRow {
  const errors: ImportIssue[] = [];
  const issue = (field: string, code: ImportIssue["code"] = "invalid") =>
    errors.push({ field, code });
  const text = (key: keyof CsvRow, max: number, required = false) => {
    const value = (raw[key] ?? "").normalize("NFC").trim();
    if (
      (required && !value) ||
      value.length > max ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
    )
      issue(key, !value ? "required" : "invalid");
    return value;
  };
  const externalId = text("external_id", 128, true),
    title = text("title", 160, true),
    description = text("description", 6000),
    locality = text("locality", 100);
  const categoryId = text("category_id", 160, true),
    category = getCategory(categoryId),
    condition = text("condition", 40, true),
    currency = text("currency", 3, true);
  if (category?.kind !== "leaf") issue("category_id");
  if (currency !== "EUR") issue("currency");
  const price = parseEuroPrice(raw.price ?? "");
  if (price === null || price === "invalid" || price > 1000000000)
    issue("price");
  const fields = rawFields(json(raw.attributes_json));
  if (!fields) issue("attributes_json");
  if (category?.kind === "leaf" && fields)
    for (const [field, code] of Object.entries(
      reviewPreparation(category, { condition, fields }).errors,
    ))
      issue(field === "condition" ? field : "attributes." + field, code);
  let inventory: ImportedInventory | null = null;
  const mode = (raw.inventory_mode ?? "").trim(),
    quantityText = (raw.quantity ?? "").trim(),
    sku = text("sku", 64);
  if (mode || quantityText || sku || raw.options_json?.trim()) {
    const quantity = /^\d+$/.test(quantityText) ? Number(quantityText) : -1;
    if (!["unique", "stocked"].includes(mode)) issue("inventory_mode");
    if (!whole(quantity, 0, mode === "unique" ? 1 : 1000000)) issue("quantity");
    let options: VariantOptions = {};
    try {
      options = parseOptions(json(raw.options_json));
    } catch {
      issue("options_json");
    }
    if (mode === "unique" && Object.keys(options).length) issue("options_json");
    inventory = { mode: mode as "unique" | "stocked", quantity, sku, options };
  }
  const payload = parseDraftPayload({
    schemaVersion: 1,
    title,
    description,
    locality,
    categoryId,
    condition,
    currency: "EUR",
    priceMinor: typeof price === "number" ? price : null,
    fields: fields ?? {},
  });
  if (!payload && !errors.length) issue("attributes_json");
  return {
    number,
    externalId: externalId && externalId.length <= 128 ? externalId : null,
    raw,
    payload: errors.length ? null : payload,
    inventory: errors.length ? null : inventory,
    errors,
  };
}
export function parseImportRaw(value: unknown): CsvRow {
  if (
    !onlyKeys(value, CSV_COLUMNS) ||
    Object.values(value).some(
      (v) => typeof v !== "string" || v.length > CSV_LIMITS.cell,
    ) ||
    JSON.stringify(value).length > 48000
  )
    throw new SellerError("INVALID_INPUT");
  return value as CsvRow;
}
export function importScope(value: unknown): {
  sellerId: string;
  importId: string;
  after: number;
} {
  if (
    !onlyKeys(value, ["sellerId", "importId", "after"]) ||
    !validId(value.sellerId) ||
    !validId(value.importId) ||
    (value.after !== undefined && !whole(value.after, 0, CSV_LIMITS.rows))
  )
    throw new SellerError("INVALID_INPUT");
  return {
    sellerId: value.sellerId.toLowerCase(),
    importId: value.importId.toLowerCase(),
    after: (value.after as number) ?? 0,
  };
}
export type ImportCommand = {
  sellerId: string;
  importId: string;
  expectedRevision: number;
  requestId: string;
  operation:
    | { kind: "start" | "cancel" }
    | { kind: "choose_valid"; count: number }
    | { kind: "select"; rows: number[]; selected: boolean }
    | { kind: "edit"; row: number; raw: CsvRow };
};
export function importCommand(value: unknown): ImportCommand {
  if (
    !onlyKeys(value, [
      "sellerId",
      "importId",
      "expectedRevision",
      "requestId",
      "operation",
    ]) ||
    !validId(value.requestId) ||
    !whole(value.expectedRevision, 1, 2147483646) ||
    !plainRecord(value.operation)
  )
    throw new SellerError("INVALID_INPUT");
  const scope = importScope({
      sellerId: value.sellerId,
      importId: value.importId,
    }),
    op = value.operation;
  let operation: ImportCommand["operation"];
  if (["start", "cancel"].includes(String(op.kind)) && onlyKeys(op, ["kind"]))
    operation = { kind: op.kind as "start" | "cancel" };
  else if (
    op.kind === "choose_valid" &&
    onlyKeys(op, ["kind", "count"]) &&
    whole(op.count, 0, CSV_LIMITS.rows)
  )
    operation = { kind: "choose_valid", count: op.count };
  else if (
    op.kind === "select" &&
    onlyKeys(op, ["kind", "rows", "selected"]) &&
    typeof op.selected === "boolean" &&
    Array.isArray(op.rows) &&
    op.rows.length > 0 &&
    op.rows.length <= CSV_LIMITS.rows &&
    op.rows.every((n) => whole(n, 1, CSV_LIMITS.rows)) &&
    new Set(op.rows).size === op.rows.length
  )
    operation = {
      kind: "select",
      rows: [...op.rows].sort((a, b) => a - b),
      selected: op.selected,
    };
  else if (
    op.kind === "edit" &&
    onlyKeys(op, ["kind", "row", "raw"]) &&
    whole(op.row, 1, CSV_LIMITS.rows)
  )
    operation = { kind: "edit", row: op.row, raw: parseImportRaw(op.raw) };
  else throw new SellerError("INVALID_INPUT");
  return {
    sellerId: scope.sellerId,
    importId: scope.importId,
    expectedRevision: value.expectedRevision,
    requestId: value.requestId.toLowerCase(),
    operation,
  };
}
