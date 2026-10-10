export type GiftCardProductDraft = {
  kind: "GiftCardProduct";
  denominations: number[];
  mediaIds: string[];
  productType: string;
  vendor: string;
  collectionIds: string[];
  disclosures: string;
  seoTitle: string;
  seoDescription: string;
  handle: string;
};
export function validGiftCardProductDraft(
  value: unknown,
): value is GiftCardProductDraft {
  if (!value || typeof value !== "object") return false;
  const d = value as Record<string, unknown>;
  const short = (v: unknown, max: number) =>
    typeof v === "string" && v.length <= max;
  const ids = (v: unknown) =>
    Array.isArray(v) &&
    v.length <= 20 &&
    new Set(v).size === v.length &&
    v.every((id) => short(id, 100) && id);
  return (
    d.kind === "GiftCardProduct" &&
    Array.isArray(d.denominations) &&
    d.denominations.length > 0 &&
    d.denominations.length <= 20 &&
    new Set(d.denominations).size === d.denominations.length &&
    d.denominations.every(
      (amount) =>
        typeof amount === "number" &&
        Number.isSafeInteger(amount) &&
        amount > 0 &&
        amount <= 100000000,
    ) &&
    ids(d.mediaIds) &&
    ids(d.collectionIds) &&
    short(d.productType, 160) &&
    short(d.vendor, 160) &&
    short(d.disclosures, 5000) &&
    short(d.seoTitle, 70) &&
    short(d.seoDescription, 160) &&
    short(d.handle, 100) &&
    /^[a-z0-9-]*$/.test(d.handle as string)
  );
}
