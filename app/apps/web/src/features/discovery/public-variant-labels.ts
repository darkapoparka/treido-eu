import { variantCaption, type PublicSku } from "../inventory/model";
/** Single-dimension inventory uses the source's Size/Color row. Uneven or
 * multi-dimensional inventory names complete combinations, not a fictitious
 * Cartesian product. Identity remains the SKU ID even when labels are equal. */
export function publicVariantLabels(
  skus: readonly Pick<PublicSku, "options">[],
  fallback: string,
  defaultLabel: string,
) {
  const key = Object.keys(skus[0]?.options ?? {})[0];
  const single =
    !!key &&
    skus.every(
      (sku) =>
        Object.keys(sku.options).length === 1 &&
        Object.hasOwn(sku.options, key),
    );
  return {
    legend: single ? key : fallback,
    values: skus.map((sku) =>
      single ? sku.options[key] : variantCaption(sku.options) || defaultLabel,
    ),
  };
}
