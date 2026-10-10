import {
  validDefinitionDraft,
  type DefinitionDraft,
} from "./metaobject-draft-model";
import {
  validGiftCardProductDraft,
  type GiftCardProductDraft,
} from "./gift-card-product-model";
import {
  validProcurementDraft,
  type ProcurementDraft,
  type GiftCardDraft,
} from "./procurement-draft-model";
export type MenuItemDraft = { id: string; label: string; url: string };
export type CompanyAddress = {
  country: string;
  address: string;
  city: string;
  postcode: string;
  phone: string;
  first?: string;
  last?: string;
  attention?: string;
  apartment?: string;
  phoneCountry?: "BG" | "GR" | "RO" | "DE" | "GB";
};
export type EditorDraft =
  | DefinitionDraft
  | ProcurementDraft
  | GiftCardDraft
  | GiftCardProductDraft
  | {
      kind: "Page";
      visibility: "Hidden" | "Visible";
      date: string;
      time: string;
      template: "default" | "contact";
      seoTitle: string;
      seoDescription: string;
      handle: string;
    }
  | { kind: "Menu"; handle: string; items: MenuItemDraft[] }
  | {
      kind: "Blog";
      excerpt: string;
      author: string;
      blog: string;
      date: string;
      visibility: "Hidden" | "Visible";
      excerptHtml?: string;
      time?: string;
      seoTitle?: string;
      seoDescription?: string;
      handle?: string;
    }
  | {
      kind: "Catalog";
      marketIds: string[];
      currency: "EUR" | "USD" | "GBP";
      adjustment: number;
      direction: "Increase" | "Decrease";
      compareAt: boolean;
      automatic: boolean;
      included: string[];
      excluded: string[];
    }
  | {
      kind: "Rollout";
      rolloutType: "Launch" | "Event";
      start: string;
      startTime: string;
      end: string;
      endTime: string;
      notes: string;
      allocation: number;
    }
  | {
      kind: "Report";
      metrics: ("orders" | "sales" | "customers" | "inventory")[];
      start: string;
      end: string;
      dimension: "None" | "Date" | "Product" | "Customer";
      visualization: "Metric" | "Line" | "Bar" | "Table";
      comparison?:
        | "none"
        | "previous-period"
        | "previous-year"
        | "previous-year-weekday"
        | "custom";
      comparisonStart?: string;
      comparisonEnd?: string;
    }
  | {
      kind: "Company";
      companyId: string;
      contactId: string;
      location: string;
      country: string;
      address: string;
      city: string;
      postcode: string;
      phone: string;
      first?: string;
      last?: string;
      attention?: string;
      apartment?: string;
      phoneCountry?: "BG" | "GR" | "RO" | "DE" | "GB";
      billingSame?: boolean;
      billing?: CompanyAddress;
      paymentTerms?: string;
      oneTimeAddress?: boolean;
      reviewOrders?: boolean;
      taxId?: string;
      taxSetting?: string;
    };

const short = (value: unknown, max = 300): value is string =>
  typeof value === "string" && value.length <= max;
const ids = (value: unknown, max = 100): value is string[] =>
  Array.isArray(value) &&
  value.length <= max &&
  value.every(
    (id) => typeof id === "string" && /^[a-z0-9-]{1,100}$/.test(id),
  ) &&
  new Set(value).size === value.length;
export function validDraftDate(value: unknown): value is string {
  if (value === "") return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export const validDraftTime = (value: unknown): value is string =>
  typeof value === "string" &&
  (value === "" || /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value));
export function validMenuLink(value: string) {
  if (/^\/(?!\/)[^\s<>"\\]*$/.test(value)) return true;
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !/[\s<>"\\]/.test(value) &&
      value.length <= 2048
    );
  } catch {
    return false;
  }
}
export function validEditorDraft(value: unknown): value is EditorDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Record<string, unknown>;
  if (draft.kind === "GiftCardProduct") return validGiftCardProductDraft(value);
  if (["PurchaseOrder", "Transfer", "GiftCard"].includes(String(draft.kind)))
    return validProcurementDraft(value);
  if (draft.kind === "Definition") return validDefinitionDraft(draft);
  if (draft.kind === "Page")
    return (
      ["Hidden", "Visible"].includes(String(draft.visibility)) &&
      validDraftDate(draft.date) &&
      validDraftTime(draft.time) &&
      ["default", "contact"].includes(String(draft.template)) &&
      short(draft.seoTitle, 70) &&
      short(draft.seoDescription, 160) &&
      short(draft.handle, 100) &&
      /^[a-z0-9-]*$/.test(draft.handle)
    );
  if (draft.kind === "Menu")
    return (
      short(draft.handle, 100) &&
      /^[a-z0-9-]*$/.test(draft.handle) &&
      Array.isArray(draft.items) &&
      draft.items.length <= 50 &&
      draft.items.every(
        (item) =>
          item &&
          typeof item === "object" &&
          short(item.id, 100) &&
          short(item.label, 160) &&
          short(item.url, 2048) &&
          validMenuLink(item.url),
      ) &&
      new Set(draft.items.map((item) => item.id)).size === draft.items.length
    );
  if (draft.kind === "Blog")
    return (
      short(draft.excerpt, 2000) &&
      short(draft.author, 160) &&
      short(draft.blog, 160) &&
      validDraftDate(draft.date) &&
      (draft.time === undefined || validDraftTime(draft.time)) &&
      (draft.excerptHtml === undefined || short(draft.excerptHtml, 6000)) &&
      (draft.seoTitle === undefined || short(draft.seoTitle, 70)) &&
      (draft.seoDescription === undefined ||
        short(draft.seoDescription, 160)) &&
      (draft.handle === undefined ||
        (short(draft.handle, 100) && /^[a-z0-9-]*$/.test(draft.handle))) &&
      ["Hidden", "Visible"].includes(String(draft.visibility))
    );
  if (draft.kind === "Catalog")
    return (
      ids(draft.marketIds, 50) &&
      ids(draft.included) &&
      ids(draft.excluded) &&
      !draft.included.some((id) => (draft.excluded as string[]).includes(id)) &&
      ["EUR", "USD", "GBP"].includes(String(draft.currency)) &&
      ["Increase", "Decrease"].includes(String(draft.direction)) &&
      Number.isSafeInteger(draft.adjustment) &&
      Number(draft.adjustment) >= 0 &&
      Number(draft.adjustment) <=
        (draft.direction === "Decrease" ? 10000 : 100000) &&
      typeof draft.compareAt === "boolean" &&
      typeof draft.automatic === "boolean"
    );
  if (draft.kind === "Rollout")
    return (
      ["Launch", "Event"].includes(String(draft.rolloutType)) &&
      validDraftDate(draft.start) &&
      validDraftDate(draft.end) &&
      validDraftTime(draft.startTime) &&
      validDraftTime(draft.endTime) &&
      (!(draft.start && draft.end) ||
        `${draft.end}T${draft.endTime || "23:59"}` >=
          `${draft.start}T${draft.startTime || "00:00"}`) &&
      short(draft.notes, 2000) &&
      Number.isSafeInteger(draft.allocation) &&
      Number(draft.allocation) >= 0 &&
      Number(draft.allocation) <= 100
    );
  if (draft.kind === "Report")
    return (
      Array.isArray(draft.metrics) &&
      draft.metrics.length <= 4 &&
      draft.metrics.every((metric) =>
        ["orders", "sales", "customers", "inventory"].includes(metric),
      ) &&
      new Set(draft.metrics).size === draft.metrics.length &&
      (draft.comparison === undefined
        ? draft.comparisonStart === undefined &&
          draft.comparisonEnd === undefined
        : [
            "none",
            "previous-period",
            "previous-year",
            "previous-year-weekday",
            "custom",
          ].includes(String(draft.comparison)) &&
          validDraftDate(draft.comparisonStart) &&
          validDraftDate(draft.comparisonEnd) &&
          (draft.comparison === "none"
            ? draft.comparisonStart === "" && draft.comparisonEnd === ""
            : !!draft.comparisonStart &&
              !!draft.comparisonEnd &&
              !!draft.start &&
              !!draft.end &&
              String(draft.comparisonStart) <= String(draft.comparisonEnd) &&
              draft.metrics.length > 0 &&
              draft.metrics.every((metric) =>
                ["orders", "sales"].includes(metric),
              ))) &&
      validDraftDate(draft.start) &&
      validDraftDate(draft.end) &&
      (!(draft.start && draft.end) || draft.start <= draft.end) &&
      ["None", "Date", "Product", "Customer"].includes(
        String(draft.dimension),
      ) &&
      !(
        draft.dimension === "Date" &&
        draft.metrics.some((metric) =>
          ["customers", "inventory"].includes(metric),
        )
      ) &&
      !(draft.dimension === "Product" && draft.metrics.includes("customers")) &&
      !(
        draft.dimension === "Customer" && draft.metrics.includes("inventory")
      ) &&
      ["Metric", "Line", "Bar", "Table"].includes(
        String(draft.visualization),
      ) &&
      (!["Line", "Bar"].includes(String(draft.visualization)) ||
        draft.dimension === "Date")
    );
  if (draft.kind === "Company")
    return (
      [
        "companyId",
        "contactId",
        "location",
        "country",
        "address",
        "city",
        "postcode",
        "phone",
      ].every((key) => short(draft[key])) &&
      (draft.billing === undefined || validCompanyAddress(draft.billing)) &&
      ["billingSame", "oneTimeAddress", "reviewOrders"].every(
        (key) => draft[key] === undefined || typeof draft[key] === "boolean",
      ) &&
      (draft.paymentTerms === undefined ||
        ["None", "Fulfillment", "7", "15", "30", "45", "60", "90"].includes(
          String(draft.paymentTerms),
        )) &&
      (draft.taxId === undefined || short(draft.taxId)) &&
      (draft.taxSetting === undefined ||
        ["Collect", "Exemptions", "Do not collect"].includes(
          String(draft.taxSetting),
        )) &&
      validCompanyAddress(draft)
    );
  return false;
}
export function validCompanyAddress(value: unknown): value is CompanyAddress {
  if (!value || typeof value !== "object") return false;
  const address = value as Record<string, unknown>;
  return (
    ["country", "address", "city", "postcode", "phone"].every((key) =>
      short(address[key]),
    ) &&
    ["first", "last", "attention", "apartment"].every(
      (key) => address[key] === undefined || short(address[key]),
    ) &&
    ["Bulgaria", "Greece", "Romania", "Germany", "United Kingdom"].includes(
      String(address.country),
    ) &&
    (address.phoneCountry === undefined ||
      ["BG", "GR", "RO", "DE", "GB"].includes(String(address.phoneCountry)))
  );
}
