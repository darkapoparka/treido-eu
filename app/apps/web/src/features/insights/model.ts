import { validId } from "../selling/draft-model";

export const INSIGHT_LIMITS = Object.freeze({
  rows: 2000,
  exportRows: 1000,
  page: 25,
  days: 92,
  exportBytes: 2097152,
});
export const AGE_BANDS = ["lt1", "d1_7", "d7_30", "d30_90", "gte90"] as const;
export const REPORT_REASONS = [
  "unsafe",
  "counterfeit",
  "misleading",
  "abuse",
  "other",
] as const;
export type InsightScope =
  { kind: "seller"; sellerId: string } | { kind: "operator" };
export type InsightBasis = "activity" | "cohort" | "snapshot";
export type ValueKey =
  | "onHand"
  | "held"
  | "available"
  | "totalRows"
  | "createdRows"
  | "failedRows"
  | "invalidRows"
  | "readyRows";
type Definition = {
  basis: InsightBasis;
  statuses: readonly string[];
  kinds: readonly string[];
  values: readonly ValueKey[];
};
export const SELLER_DATASETS = {
  publications: {
    basis: "activity",
    statuses: ["published", "withdrawn"],
    kinds: [],
    values: [],
  },
  listing_status: {
    basis: "snapshot",
    statuses: ["draft", "published", "withdrawn"],
    kinds: ["clear", "restricted", "removed"],
    values: [],
  },
  stock: {
    basis: "snapshot",
    statuses: ["available", "reserved", "out_of_stock", "unknown"],
    kinds: ["unique", "stocked", "unknown"],
    values: ["onHand", "held", "available"],
  },
  offers: {
    basis: "activity",
    statuses: [
      "created",
      "countered",
      "accepted",
      "rejected",
      "withdrawn",
      "cancelled",
      "expired",
      "hold_expired",
    ],
    kinds: ["buyer", "seller"],
    values: [],
  },
  conversations: {
    basis: "cohort",
    statuses: ["open", "closed"],
    kinds: [],
    values: [],
  },
  inquiries: {
    basis: "cohort",
    statuses: ["new", "in_progress", "waiting_buyer", "resolved", "closed"],
    kinds: [],
    values: [],
  },
  inquiry_activity: {
    basis: "activity",
    statuses: ["new", "in_progress", "waiting_buyer", "resolved", "closed"],
    kinds: ["status", "reply"],
    values: [],
  },
  imports: {
    basis: "cohort",
    statuses: [
      "uploading",
      "review",
      "queued",
      "processing",
      "paused",
      "completed",
      "cancelled",
    ],
    kinds: ["with_failed_rows", "with_invalid_rows", "without_row_errors"],
    values: [
      "totalRows",
      "createdRows",
      "failedRows",
      "invalidRows",
      "readyRows",
    ],
  },
} as const satisfies Record<string, Definition>;
export const OPERATOR_DATASETS = {
  report_backlog: {
    basis: "snapshot",
    statuses: ["open", "resolved"],
    kinds: ["listing", "message"],
    values: [],
  },
  reports: {
    basis: "cohort",
    statuses: ["open", "resolved"],
    kinds: ["listing", "message"],
    values: [],
  },
  appeal_backlog: {
    basis: "snapshot",
    statuses: ["open", "resolved"],
    kinds: ["clear", "restricted", "removed"],
    values: [],
  },
  appeals: {
    basis: "cohort",
    statuses: ["open", "resolved", "unknown"],
    kinds: ["clear", "restricted", "removed"],
    values: [],
  },
  case_outcomes: {
    basis: "activity",
    statuses: [
      "no_violation",
      "violation_recorded",
      "message_hidden",
      "upheld",
      "revised",
      "dismissed",
    ],
    kinds: ["message_report", "appeal"],
    values: [],
  },
  listing_decisions: {
    basis: "activity",
    statuses: ["clear", "restricted", "removed"],
    kinds: ["clear", "restricted", "removed"],
    values: [],
  },
} as const satisfies Record<string, Definition>;
export type SellerDataset = keyof typeof SELLER_DATASETS;
export type OperatorDataset = keyof typeof OPERATOR_DATASETS;
export type Dataset = SellerDataset | OperatorDataset;
export const DATASETS: Readonly<Record<Dataset, Definition>> = {
  ...SELLER_DATASETS,
  ...OPERATOR_DATASETS,
};
export class InsightError extends Error {
  constructor(
    public readonly code:
      | "INVALID_INPUT"
      | "SCOPE_TOO_LARGE"
      | "EXPORT_TOO_LARGE"
      | "NOT_AVAILABLE",
  ) {
    super(code);
    this.name = "InsightError";
  }
}
export type InsightQuery = {
  dataset: Dataset;
  from: string;
  to: string;
  status: string;
  kind: string;
  q: string;
  page: number;
  reason: string;
  age: string;
};
export type InsightRow = {
  id: string;
  resourceId: string;
  label: string;
  status: string;
  kind: string;
  at: string;
  href: string;
  reason: string;
  values: Partial<Record<ValueKey, number | null>>;
};
export type InsightReport = {
  scope: InsightScope;
  sellerName: string | null;
  actorKey: string;
  query: InsightQuery;
  observedAt: string;
  basis: InsightBasis;
  availableDatasets: Dataset[];
  formalStorage: boolean;
  rows: InsightRow[];
  total: number;
  pages: number;
  statuses: { key: string; count: number }[];
  kinds: { key: string; count: number }[];
  reasons: { key: string; count: number }[];
  daily: { day: string; count: number }[];
  ages: { key: string; count: number }[];
  values: { key: ValueKey; total: number; known: number; unknown: number }[];
};
export function scopeBase(scope: InsightScope) {
  if (scope.kind === "operator") return "/ops/insights";
  if (!validId(scope.sellerId)) throw new InsightError("INVALID_INPUT");
  return "/app/sellers/" + scope.sellerId + "/insights";
}
function day(value: string) {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(value))
    throw new InsightError("INVALID_INPUT");
  const time = Date.parse(value + "T00:00:00.000Z");
  if (
    !Number.isFinite(time) ||
    new Date(time).toISOString().slice(0, 10) !== value
  )
    throw new InsightError("INVALID_INPUT");
  return time;
}
export function parseInsightQuery(
  raw: Record<string, unknown>,
  scope: InsightScope,
  now: Date,
  defaultDataset?: Dataset,
): InsightQuery {
  scopeBase(scope);
  if (
    Object.keys(raw).some(
      (k) =>
        ![
          "dataset",
          "from",
          "to",
          "status",
          "kind",
          "q",
          "page",
          "lang",
          "reason",
          "age",
        ].includes(k),
    )
  )
    throw new InsightError("INVALID_INPUT");
  for (const value of Object.values(raw))
    if (value !== undefined && typeof value !== "string")
      throw new InsightError("INVALID_INPUT");
  const text = (key: string, fallback: string) =>
    typeof raw[key] === "string" ? raw[key] : fallback;
  const today = now.toISOString().slice(0, 10);
  const from = text(
    "from",
    new Date(day(today) - 29 * 86400000).toISOString().slice(0, 10),
  );
  const to = text("to", today),
    fromTime = day(from),
    toTime = day(to);
  if (
    fromTime > toTime ||
    toTime > day(today) ||
    (toTime - fromTime) / 86400000 >= INSIGHT_LIMITS.days
  )
    throw new InsightError("INVALID_INPUT");
  const dataset = text(
    "dataset",
    defaultDataset ??
      (scope.kind === "seller" ? "publications" : "report_backlog"),
  );
  const allowed = scope.kind === "seller" ? SELLER_DATASETS : OPERATOR_DATASETS;
  if (!Object.hasOwn(allowed, dataset)) throw new InsightError("INVALID_INPUT");
  const definition = DATASETS[dataset as Dataset];
  const status = text("status", dataset.endsWith("_backlog") ? "open" : "all"),
    kind = text("kind", "all"),
    q = text("q", "").trim();
  if (
    (status !== "all" && !definition.statuses.includes(status)) ||
    (kind !== "all" && !definition.kinds.includes(kind)) ||
    q.length > 80 ||
    /[\u0000-\u001f\u007f]/.test(q)
  )
    throw new InsightError("INVALID_INPUT");
  const reason = text("reason", "all"),
    age = text("age", "all");
  if (
    (reason !== "all" &&
      (!["reports", "report_backlog"].includes(dataset) ||
        !REPORT_REASONS.includes(reason as (typeof REPORT_REASONS)[number]))) ||
    (age !== "all" &&
      (!dataset.endsWith("_backlog") ||
        status === "resolved" ||
        !AGE_BANDS.includes(age as (typeof AGE_BANDS)[number])))
  )
    throw new InsightError("INVALID_INPUT");
  const page = text("page", "1");
  if (
    !/^[1-9]\d?$/.test(page) ||
    Number(page) > INSIGHT_LIMITS.rows / INSIGHT_LIMITS.page ||
    (raw.lang !== undefined && !["bg", "en"].includes(String(raw.lang)))
  )
    throw new InsightError("INVALID_INPUT");
  return {
    dataset: dataset as Dataset,
    from,
    to,
    status,
    kind,
    q,
    page: Number(page),
    reason,
    age,
  };
}
export function insightRange(query: Pick<InsightQuery, "from" | "to">) {
  return {
    from: query.from + "T00:00:00.000Z",
    until: new Date(day(query.to) + 86400000).toISOString(),
  };
}
export function insightParams(
  query: InsightQuery,
  language: "bg" | "en",
  patch: Partial<InsightQuery> = {},
) {
  const q = { ...query, ...patch };
  return new URLSearchParams({
    dataset: q.dataset,
    from: q.from,
    to: q.to,
    status: q.status,
    kind: q.kind,
    q: q.q,
    page: String(q.page),
    reason: q.reason,
    age: q.age,
    lang: language,
  });
}
export function parseInsightsContinuation(raw: unknown): string | null {
  if (
    typeof raw !== "string" ||
    raw.length > 1400 ||
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    /[\\#\u0000-\u0020]/.test(raw)
  )
    return null;
  try {
    const url = new URL(raw, "https://continuation.invalid");
    const match = /^\/app\/sellers\/([^/]+)\/insights$/.exec(url.pathname);
    const scope: InsightScope =
      url.pathname === "/ops/insights"
        ? { kind: "operator" }
        : match && validId(match[1])
          ? { kind: "seller", sellerId: match[1] }
          : (() => {
              throw Error();
            })();
    const seen = new Set<string>();
    for (const [key] of url.searchParams) {
      if (seen.has(key)) return null;
      seen.add(key);
    }
    const params = Object.fromEntries(url.searchParams);
    const query = parseInsightQuery(params, scope, new Date());
    return (
      scopeBase(scope) +
      "?" +
      insightParams(query, params.lang === "bg" ? "bg" : "en")
    );
  } catch {
    return null;
  }
}
