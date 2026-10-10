import { sanitizeDescriptionHtml } from "./rich-text";
import { validEditorDraft, type EditorDraft } from "./local-draft-model";
import { countryOptions, parseCountry } from "../../locale/regions";

export type Product = {
  id: string;
  title: string;
  description: string;
  price: number;
  quantity: number;
  sku: string;
  status: "Active" | "Draft" | "Archived";
  category: string;
  condition: string;
  vendor: string;
  tags: string;
  collection: string;
  image: string;
  options: string;
  shipping: boolean;
  descriptionHtml?: string;
  compareAt?: number;
  cost?: number;
  chargeTax?: boolean;
  unitAmount?: string;
  unitMeasure?: string;
  unitBaseAmount?: string;
  unitBaseMeasure?: string;
  countryOfOrigin?: string;
  hsCode?: string;
  trackInventory?: boolean;
  sellOutOfStock?: boolean;
  barcode?: string;
  weight?: string;
  weightUnit?: string;
  length?: string;
  width?: string;
  height?: string;
  dimensionUnit?: string;
  type?: string;
  disclosures?: string;
  seoTitle?: string;
  seoDescription?: string;
};
export type Customer = {
  id: string;
  first: string;
  last: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  address: string;
  postcode: string;
  notes: string;
  tags: string;
  marketing: boolean;
  language?: "English" | "Bulgarian";
  phoneCountry?: "BG" | "GR" | "RO" | "DE" | "GB";
};
export type Order = {
  id: string;
  kind: "Order" | "Draft";
  customerId: string;
  lines: { productId: string; quantity: number; price: number }[];
  payment: "Paid" | "Pending" | "Refunded";
  fulfillment: "Unfulfilled" | "Fulfilled" | "Cancelled";
  date: string;
  notes: string;
  tracking: string;
  shipping: number;
  refunded: number;
  tags?: string;
};
export type Discount = {
  id: string;
  title: string;
  code: string;
  type: string;
  method: string;
  valueMode: "Percentage" | "Fixed amount" | "Free";
  eligibility: string;
  eligibilityIds?: string[];
  maximumPerOrderEnabled?: boolean;
  maximumPerOrder?: number;
  appliesTo: string;
  buyQuantity: number;
  getQuantity: number;
  buyKind?: "Products" | "Collections";
  getKind?: "Products" | "Collections";
  buyItemIds?: string[];
  getItemIds?: string[];
  buyMinimumKind?: "Quantity" | "Amount";
  buyMinimumAmount?: number;
  buyMinimumAmountMinor?: number;
  getValueMinor?: number;
  targetKind?: "Products" | "Collections";
  targetIds?: string[];
  countryCodes?: string[];
  countriesMode?: "All" | "Selected";
  excludeShippingRate?: boolean;
  maximumShippingRate?: number;
  limitEnabled?: boolean;
  combinations?: { product: boolean; order: boolean; shipping: boolean };
  startTime?: string;
  endTime?: string;
  tags?: string;
  minimumKind: string;
  value: number;
  minimum: number;
  limit: number;
  once: boolean;
  combines: boolean;
  start: string;
  end: string;
  status: string;
};
export type Entry = {
  id: string;
  title: string;
  body: string;
  status: string;
  type: string;
  tags: string;
  image?: string;
  descriptionHtml?: string;
  url?: string;
  editorDraft?: EditorDraft;
};
export type Market = {
  id: string;
  title: string;
  countries: string;
  countryCodes?: string[];
  currency: string;
  status: string;
};
export type Member = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
};
export type Thread = {
  id: string;
  customerId: string;
  subject: string;
  status: string;
  messages: { from: string; body: string; time: string }[];
};
export type StoreState = {
  products: Product[];
  customers: Customer[];
  orders: Order[];
  discounts: Discount[];
  entries: Entry[];
  markets: Market[];
  members: Member[];
  threads: Thread[];
  collections: Entry[];
  campaigns: Entry[];
  settings: Record<string, string>;
};
export type PreviewState = {
  version: 1;
  stores: Record<"studio" | "personal", StoreState>;
};
export const defaultSettings: Record<string, string> = {
  name: "Treido Studio",
  email: "studio@example.com",
  phone: "",
  description: "Everyday objects, thoughtfully selected.",
  country: "Bulgaria",
  currency: "EUR",
  timezone: "Europe/Sofia",
  language: "English",
  city: "Sofia",
  address: "",
  postcode: "",
  handle: "treido-studio",
  accent: "#23734b",
  tax: "20",
  delivery: "Shipping and local pickup",
  shippingRate: "4.90",
  freeShipping: "75",
  returnsDays: "14",
  refundPolicy:
    "Contact the seller within 14 days to discuss a return. This is preview copy.",
  privacyPolicy: "Describe how your business handles customer information.",
  terms: "Add your business terms before publication.",
  orderEmail: "true",
  shippingEmail: "true",
  inboxEmail: "true",
  marketingEmail: "false",
  plan: "Free",
  orderPrefix: "#",
  orderSuffix: "",
  locationName: "Primary location",
  shippingRegions: "Bulgaria",
};
export function emptyStore(): StoreState {
  return {
    products: [],
    customers: [],
    orders: [],
    discounts: [],
    entries: [],
    markets: [
      {
        id: "bulgaria",
        title: "Bulgaria",
        countries: "Bulgaria",
        currency: "EUR",
        status: "Active",
      },
    ],
    members: [
      {
        id: "owner",
        name: "Store owner",
        email: "owner@example.com",
        role: "Owner",
        status: "Active",
      },
    ],
    threads: [],
    collections: [],
    campaigns: [],
    settings: { ...defaultSettings },
  };
}
export function blankProduct(id: string): Product {
  return {
    id,
    title: "",
    description: "",
    price: 0,
    quantity: 0,
    sku: "",
    status: "Draft",
    category: "",
    condition: "",
    vendor: "",
    tags: "",
    collection: "",
    image: "",
    options: "",
    shipping: true,
  };
}
export function demoStore(): StoreState {
  const base = emptyStore();
  base.products = [
    {
      ...blankProduct("linen-shirt"),
      title: "Linen everyday shirt",
      description: "Relaxed fit. Soft linen in warm terracotta.",
      price: 4900,
      quantity: 18,
      sku: "LIN-001",
      status: "Active",
      category: "Clothing",
      vendor: "Treido Studio",
      collection: "Everyday essentials",
      image: "/images/admin/onboarding-products-v1.webp",
      options: "Size: S, M, L",
    },
    {
      ...blankProduct("glass-vase"),
      title: "Iridescent glass vase",
      description: "Sculptural glass for a quieter corner of home.",
      price: 3490,
      quantity: 8,
      sku: "VAS-002",
      status: "Active",
      category: "Home & living",
      collection: "For the home",
      image: "/images/admin/onboarding-store-v1.webp",
    },
    {
      ...blankProduct("headphones"),
      title: "Forest wireless headphones",
      price: 8990,
      quantity: 4,
      sku: "AUD-003",
      status: "Draft",
      category: "Electronics",
    },
  ];
  base.customers = [
    {
      id: "alex",
      first: "Alex",
      last: "Sample",
      email: "alex@example.com",
      phone: "",
      city: "Sofia",
      country: "Bulgaria",
      address: "",
      postcode: "",
      notes: "Synthetic customer for frontend review.",
      tags: "Returning",
      marketing: false,
    },
    {
      id: "mila",
      first: "Mila",
      last: "Example",
      email: "mila@example.com",
      phone: "",
      city: "Plovdiv",
      country: "Bulgaria",
      address: "",
      postcode: "",
      notes: "",
      tags: "",
      marketing: false,
    },
  ];
  base.orders = [
    {
      id: "1002",
      kind: "Order",
      customerId: "alex",
      lines: [{ productId: "linen-shirt", quantity: 1, price: 4900 }],
      payment: "Paid",
      fulfillment: "Unfulfilled",
      date: "2026-10-02",
      notes: "Preview order only",
      tracking: "",
      shipping: 490,
      refunded: 0,
    },
    {
      id: "1001",
      kind: "Order",
      customerId: "mila",
      lines: [{ productId: "glass-vase", quantity: 2, price: 3490 }],
      payment: "Paid",
      fulfillment: "Fulfilled",
      date: "2026-10-01",
      notes: "",
      tracking: "PREVIEW-1001",
      shipping: 490,
      refunded: 0,
    },
  ];
  base.discounts = [
    {
      id: "welcome",
      title: "Welcome offer",
      code: "WELCOME10",
      type: "Amount off order",
      method: "Discount code",
      valueMode: "Percentage",
      eligibility: "All customers",
      appliesTo: "All products",
      buyQuantity: 1,
      getQuantity: 1,
      minimumKind: "None",
      value: 10,
      minimum: 0,
      limit: 100,
      once: true,
      combines: false,
      start: "2026-10-02",
      end: "",
      status: "Active",
    },
  ];
  base.entries = [
    {
      id: "delivery",
      title: "Delivery & returns",
      body: "A simple guide to shipping, local pickup and returns.",
      status: "Visible",
      type: "Page",
      tags: "Information",
    },
  ];
  base.collections = [
    {
      id: "essentials",
      title: "Everyday essentials",
      body: "Thoughtful objects for everyday life.",
      status: "Active",
      type: "Manual",
      tags: "",
    },
  ];
  base.threads = [
    {
      id: "question",
      customerId: "alex",
      subject: "Linen everyday shirt",
      status: "Open",
      messages: [
        {
          from: "Alex Sample",
          body: "Is the medium size available for local pickup?",
          time: "10:24",
        },
      ],
    },
  ];
  return base;
}
export function initialPreviewState(demo = false): PreviewState {
  return {
    version: 1,
    stores: {
      studio: demo ? demoStore() : emptyStore(),
      personal: {
        ...emptyStore(),
        settings: {
          ...defaultSettings,
          name: "My personal selling",
          handle: "personal",
        },
      },
    },
  };
}
export function money(minor: number, locale: "bg" | "en" = "en") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
  }).format(minor / 100);
}
export function parseMoney(input: string): number | null {
  if (!/^\d{1,7}([.,]\d{1,2})?$/.test(input.trim())) return null;
  const [whole, fraction = ""] = input.trim().replace(",", ".").split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
export function orderTotal(order: Order) {
  return order.lines.reduce(
    (sum, line) => sum + line.price * line.quantity,
    order.shipping,
  );
}
export function put<T extends { id: string }>(
  items: readonly T[],
  value: T,
): T[] {
  return items.some((item) => item.id === value.id)
    ? items.map((item) => (item.id === value.id ? value : item))
    : [...items, value];
}
/** Device-local synthetic examples only. Bound reads and reject unexpected persisted shapes. */
export function readPreviewState(raw: string | null): PreviewState | null {
  if (!raw || raw.length > 1_000_000) return null;
  try {
    const value: unknown = JSON.parse(raw);
    const root = record(value);
    if (!root || root.version !== 1) return null;
    const stores = record(root.stores);
    if (!stores) return null;
    for (const key of ["studio", "personal"] as const) {
      const store = record(stores[key]);
      if (!store) return null;
      // Earlier local previews did not separate product eligibility from customer eligibility.
      if (Array.isArray(store.discounts))
        for (const value of store.discounts) {
          const discount = record(value);
          if (discount && discount.appliesTo === undefined)
            discount.appliesTo = "All products";
          if (discount && discount.buyQuantity === undefined)
            discount.buyQuantity = 1;
          if (discount && discount.getQuantity === undefined)
            discount.getQuantity = 1;
        }
      for (const [group, valid] of Object.entries(validators)) {
        const items = store[group];
        if (!Array.isArray(items) || items.length > 500 || !items.every(valid))
          return null;
        if (new Set(items.map((item) => item.id)).size !== items.length)
          return null;
      }
      const settings = record(store.settings);
      if (
        !settings ||
        Object.keys(settings).length > 100 ||
        Object.entries(settings).some(
          ([key, value]) =>
            !/^[a-zA-Z0-9 -]{1,80}$/.test(key) ||
            typeof value !== "string" ||
            value.length > 15000,
        ) ||
        [
          "name",
          "email",
          "country",
          "currency",
          "handle",
          "accent",
          "shippingRate",
          "freeShipping",
          "plan",
        ].some((key) => typeof settings[key] !== "string")
      )
        return null;
      store.settings = { ...defaultSettings, ...settings };
    }
    return value as PreviewState;
  } catch {
    return null;
  }
}
function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function strings(value: Record<string, unknown>, keys: string[]) {
  return keys.every(
    (key) =>
      typeof value[key] === "string" && (value[key] as string).length <= 180000,
  );
}
function integer(value: unknown, max = 999999999) {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= max
  );
}
function identity(value: unknown) {
  const item = record(value);
  return item &&
    typeof item.id === "string" &&
    /^[a-z0-9-]{1,80}$/.test(item.id)
    ? item
    : null;
}
export function safePreviewImage(src: string) {
  return (
    src === "" ||
    /^\/images\/admin\/onboarding-(products|store|review)-v1\.webp$/.test(
      src,
    ) ||
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(src)
  );
}
/** A local external-file bookmark; never fetched or imported by the preview. */
export function normalizePreviewFileUrl(value: string): string | null {
  if (
    value.length > 2048 ||
    /[\u0000-\u0020\u007f]/.test(value) ||
    !/^https?:\/\//i.test(value)
  )
    return null;
  try {
    const url = new URL(value);
    if (
      !url.hostname ||
      url.username ||
      url.password ||
      !["http:", "https:"].includes(url.protocol)
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
const entryValid = (value: unknown) => {
  const e = identity(value);
  return (
    !!e &&
    strings(e, ["title", "body", "status", "type", "tags"]) &&
    (e.editorDraft === undefined ||
      (validEditorDraft(e.editorDraft) &&
        e.type === `${e.editorDraft.kind}Draft`)) &&
    (e.image === undefined ||
      (typeof e.image === "string" &&
        e.image.length <= 180000 &&
        safePreviewImage(e.image))) &&
    (e.descriptionHtml === undefined ||
      (typeof e.descriptionHtml === "string" &&
        e.descriptionHtml.length <= 20000 &&
        sanitizeDescriptionHtml(e.descriptionHtml) === e.descriptionHtml)) &&
    (e.url === undefined ||
      (e.type === "File" &&
        typeof e.url === "string" &&
        normalizePreviewFileUrl(e.url) === e.url &&
        e.body === "")) &&
    (e.type !== "File" ||
      e.url !== undefined ||
      /^data:(image\/(png|jpeg|webp)|application\/pdf|text\/plain);base64,[A-Za-z0-9+/=]+$/.test(
        String(e.body),
      ))
  );
};
const validators: Record<string, (value: unknown) => boolean> = {
  products: (value) => {
    const p = identity(value);
    return (
      !!p &&
      strings(p, [
        "title",
        "description",
        "sku",
        "status",
        "category",
        "condition",
        "vendor",
        "tags",
        "collection",
        "image",
        "options",
      ]) &&
      integer(p.price) &&
      integer(p.quantity, 999999) &&
      typeof p.shipping === "boolean" &&
      ["Active", "Draft", "Archived"].includes(String(p.status)) &&
      safePreviewImage(String(p.image)) &&
      (p.countryOfOrigin === undefined ||
        ["", "BG", "GR", "RO", "DE", "GB"].includes(
          String(p.countryOfOrigin),
        )) &&
      (p.hsCode === undefined ||
        (typeof p.hsCode === "string" && /^[0-9]{0,10}$/.test(p.hsCode))) &&
      ["compareAt", "cost"].every(
        (key) => p[key] === undefined || integer(p[key]),
      ) &&
      ["chargeTax", "trackInventory", "sellOutOfStock"].every(
        (key) => p[key] === undefined || typeof p[key] === "boolean",
      ) &&
      [
        "unitAmount",
        "unitBaseAmount",
        "weight",
        "length",
        "width",
        "height",
      ].every(
        (key) =>
          p[key] === undefined ||
          (typeof p[key] === "string" &&
            /^(?:\d{1,6}(?:\.\d{1,3})?)?$/.test(p[key] as string)),
      ) &&
      [
        "unitMeasure",
        "unitBaseMeasure",
        "weightUnit",
        "dimensionUnit",
        "barcode",
        "type",
        "disclosures",
        "seoTitle",
        "seoDescription",
      ].every(
        (key) =>
          p[key] === undefined ||
          (typeof p[key] === "string" && (p[key] as string).length <= 5000),
      ) &&
      (p.descriptionHtml === undefined ||
        (typeof p.descriptionHtml === "string" &&
          p.descriptionHtml.length <= 20000 &&
          sanitizeDescriptionHtml(p.descriptionHtml) === p.descriptionHtml))
    );
  },
  customers: (value) => {
    const c = identity(value);
    return (
      !!c &&
      strings(c, [
        "first",
        "last",
        "email",
        "phone",
        "city",
        "country",
        "address",
        "postcode",
        "notes",
        "tags",
      ]) &&
      typeof c.marketing === "boolean" &&
      (c.language === undefined ||
        ["English", "Bulgarian"].includes(String(c.language))) &&
      (c.phoneCountry === undefined ||
        ["BG", "GR", "RO", "DE", "GB"].includes(String(c.phoneCountry)))
    );
  },
  orders: (value) => {
    const o = identity(value);
    return (
      !!o &&
      strings(o, [
        "customerId",
        "payment",
        "fulfillment",
        "date",
        "notes",
        "tracking",
        "kind",
      ]) &&
      ["Order", "Draft"].includes(String(o.kind)) &&
      ["Paid", "Pending", "Refunded"].includes(String(o.payment)) &&
      ["Unfulfilled", "Fulfilled", "Cancelled"].includes(
        String(o.fulfillment),
      ) &&
      /^\d{4}-\d{2}-\d{2}$/.test(String(o.date)) &&
      integer(o.shipping) &&
      integer(o.refunded) &&
      (o.tags === undefined ||
        (typeof o.tags === "string" && o.tags.length <= 300)) &&
      Array.isArray(o.lines) &&
      o.lines.length <= 100 &&
      o.lines.every((value) => {
        const l = record(value);
        return (
          !!l &&
          strings(l, ["productId"]) &&
          integer(l.price) &&
          integer(l.quantity, 999) &&
          Number(l.quantity) > 0
        );
      })
    );
  },
  discounts: (value) => {
    const d = identity(value);
    return (
      !!d &&
      strings(d, [
        "title",
        "code",
        "type",
        "method",
        "valueMode",
        "eligibility",
        "appliesTo",
        "minimumKind",
        "start",
        "end",
        "status",
      ]) &&
      integer(d.buyQuantity, 999) &&
      integer(d.getQuantity, 999) &&
      ["buyKind", "getKind", "targetKind"].every(
        (key) =>
          d[key] === undefined ||
          ["Products", "Collections"].includes(String(d[key])),
      ) &&
      ["buyItemIds", "getItemIds", "targetIds", "eligibilityIds"].every(
        (key) =>
          d[key] === undefined ||
          (Array.isArray(d[key]) &&
            d[key].length <= 100 &&
            new Set(d[key]).size === d[key].length &&
            d[key].every(
              (id: unknown) =>
                typeof id === "string" && id.length > 0 && id.length <= 160,
            )),
      ) &&
      (d.countriesMode === undefined ||
        ["All", "Selected"].includes(String(d.countriesMode))) &&
      (d.countryCodes === undefined ||
        (Array.isArray(d.countryCodes) &&
          d.countryCodes.length <= countryOptions("en").length &&
          d.countryCodes.every((code) => parseCountry(code) !== null) &&
          new Set(d.countryCodes).size === d.countryCodes.length)) &&
      (d.excludeShippingRate === undefined ||
        typeof d.excludeShippingRate === "boolean") &&
      (d.limitEnabled === undefined || typeof d.limitEnabled === "boolean") &&
      (d.maximumShippingRate === undefined ||
        integer(d.maximumShippingRate, 100000000)) &&
      (d.combinations === undefined ||
        (record(d.combinations) !== null &&
          ["product", "order", "shipping"].every(
            (key) =>
              typeof (d.combinations as Record<string, unknown>)[key] ===
              "boolean",
          ))) &&
      ["startTime", "endTime"].every(
        (key) =>
          d[key] === undefined ||
          (typeof d[key] === "string" &&
            (d[key] === "" || /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(d[key]))),
      ) &&
      (d.tags === undefined ||
        (typeof d.tags === "string" && d.tags.length <= 500)) &&
      (d.buyMinimumKind === undefined ||
        ["Quantity", "Amount"].includes(String(d.buyMinimumKind))) &&
      (d.buyMinimumAmount === undefined ||
        (typeof d.buyMinimumAmount === "number" &&
          Number.isFinite(d.buyMinimumAmount) &&
          d.buyMinimumAmount >= 0 &&
          d.buyMinimumAmount <= 1000000)) &&
      ["buyMinimumAmountMinor", "getValueMinor"].every(
        (key) => d[key] === undefined || integer(d[key], 100000000),
      ) &&
      ["Percentage", "Fixed amount", "Free"].includes(String(d.valueMode)) &&
      (d.valueMode !== "Free" || (d.type === "Buy X get Y" && d.value === 0)) &&
      (d.maximumPerOrderEnabled === undefined ||
        typeof d.maximumPerOrderEnabled === "boolean") &&
      (d.maximumPerOrder === undefined || integer(d.maximumPerOrder, 999999)) &&
      (!d.maximumPerOrderEnabled ||
        (typeof d.maximumPerOrder === "number" && d.maximumPerOrder > 0)) &&
      ["value", "minimum", "limit"].every(
        (key) =>
          typeof d[key] === "number" &&
          Number.isFinite(d[key]) &&
          Number(d[key]) >= 0,
      ) &&
      typeof d.once === "boolean" &&
      typeof d.combines === "boolean"
    );
  },
  entries: entryValid,
  collections: entryValid,
  campaigns: entryValid,
  markets: (value) => {
    const m = identity(value);
    return (
      !!m &&
      strings(m, ["title", "countries", "currency", "status"]) &&
      (m.countryCodes === undefined ||
        (Array.isArray(m.countryCodes) &&
          m.countryCodes.length <= countryOptions("en").length &&
          m.countryCodes.every((code) => parseCountry(code) !== null) &&
          new Set(m.countryCodes).size === m.countryCodes.length))
    );
  },
  members: (value) => {
    const m = identity(value);
    return !!m && strings(m, ["name", "email", "role", "status"]);
  },
  threads: (value) => {
    const t = identity(value);
    return (
      !!t &&
      strings(t, ["customerId", "subject", "status"]) &&
      Array.isArray(t.messages) &&
      t.messages.length <= 500 &&
      t.messages.every((value) => {
        const m = record(value);
        return !!m && strings(m, ["from", "body", "time"]);
      })
    );
  },
};
