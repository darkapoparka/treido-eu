export const productStatuses = [
  "all",
  "draft",
  "published",
  "withdrawn",
  "restricted",
] as const;
export type ProductStatus = (typeof productStatuses)[number];
export type ProductQuery = {
  q: string;
  status: ProductStatus;
  sort: "newest" | "oldest";
  cursor: string | null;
};
export type AdminProduct = {
  id: string;
  title: string;
  priceMinor: number | null;
  currency: "EUR";
  status: Exclude<ProductStatus, "all">;
  revision: number;
  updatedAt: string;
  mediaId: string | null;
};
export type AdminProducts = {
  items: AdminProduct[];
  counts: Record<ProductStatus, number>;
  nextCursor: string | null;
  query: ProductQuery;
};

export function parseProductQuery(
  input: Record<string, unknown>,
): ProductQuery | null {
  if (
    Object.keys(input).some(
      (key) => !["q", "status", "sort", "cursor", "lang"].includes(key),
    )
  )
    return null;
  const q = input.q ?? "",
    status = input.status ?? "all",
    sort = input.sort ?? "newest",
    cursor = input.cursor ?? null;
  if (
    typeof q !== "string" ||
    q.length > 160 ||
    /[\u0000-\u001f\u007f]/.test(q) ||
    !productStatuses.includes(status as ProductStatus) ||
    !["newest", "oldest"].includes(sort as string) ||
    (cursor !== null &&
      (typeof cursor !== "string" ||
        cursor.length > 2048 ||
        !/^[A-Za-z0-9_-]+$/.test(cursor)))
  )
    return null;
  if (input.lang !== undefined && !["bg", "en"].includes(input.lang as string))
    return null;
  return {
    q: q.trim(),
    status: status as ProductStatus,
    sort: sort as ProductQuery["sort"],
    cursor: cursor as string | null,
  };
}

export function productHref(
  base: string,
  language: "bg" | "en",
  query: ProductQuery,
  change: Partial<ProductQuery> = {},
) {
  const next = { ...query, cursor: null, ...change };
  const params = new URLSearchParams({ lang: language });
  if (next.q) params.set("q", next.q);
  if (next.status !== "all") params.set("status", next.status);
  if (next.sort !== "newest") params.set("sort", next.sort);
  if (next.cursor) params.set("cursor", next.cursor);
  return `${base}?${params}`;
}

export function productStatusLabel(
  status: ProductStatus,
  language: "bg" | "en",
) {
  return (
    {
      all: ["All", "Всички"],
      draft: ["Draft", "Чернова"],
      published: ["Published", "Публикуван"],
      withdrawn: ["Withdrawn", "Оттеглен"],
      restricted: ["Restricted", "Ограничен"],
    } as const
  )[status][language === "bg" ? 1 : 0];
}
