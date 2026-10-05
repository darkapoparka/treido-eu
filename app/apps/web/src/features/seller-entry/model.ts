export type SellerEntryKind = "personal" | "business";
export type SellerEntry = {
  kind: SellerEntryKind | null;
  language: "bg" | "en" | null;
};

/** Public guide choices are display context, never ownership or signup consent. */
export function parseSellerEntry(
  params: Record<string, string | string[] | undefined>,
): SellerEntry | null {
  if (Object.keys(params).some((key) => key !== "kind" && key !== "lang"))
    return null;
  if (
    (params.kind !== undefined &&
      params.kind !== "personal" &&
      params.kind !== "business") ||
    (params.lang !== undefined && params.lang !== "bg" && params.lang !== "en")
  )
    return null;
  return {
    kind: (params.kind as SellerEntryKind | undefined) ?? null,
    language: (params.lang as SellerEntry["language"]) ?? null,
  };
}

export function sellerEntryHref(
  kind: SellerEntryKind | null,
  language: "bg" | "en",
): string {
  return (
    "/sell/start?" + (kind ? "kind=" + kind + "&" : "") + "lang=" + language
  );
}
