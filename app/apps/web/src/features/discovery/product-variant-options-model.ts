import { variantSelectionLimit, type ProductVariant } from "../catalog/types";

export function nativeOptionChoices(
  variants: readonly ProductVariant[],
  selected: ProductVariant,
  name: string,
) {
  const labels = [
    ...new Set(
      variants.flatMap((variant) => variant.referenceOptions?.[name] ?? []),
    ),
  ];
  return labels.map((label) => {
    const matching = variants.find(
      (variant) =>
        variant.referenceOptions?.[name] === label &&
        Object.entries(selected.referenceOptions ?? {}).every(
          ([key, value]) =>
            key === name || variant.referenceOptions?.[key] === value,
        ),
    );
    const variant =
      matching ??
      variants.find((option) => option.referenceOptions?.[name] === label)!;
    return {
      label,
      variant,
      available: Boolean(matching && variantSelectionLimit(matching) > 0),
      selectable: Boolean(matching),
      soldOut: Boolean(
        matching?.referenceUnavailable ||
        matching?.referenceColor?.unavailable ||
        matching?.availableQuantity === 0,
      ),
    };
  });
}

/** Keep a selected option visible when the native row is collapsed. */
export function visibleNativeOptions<T>(
  options: readonly T[],
  limit: number | undefined,
  selected: (option: T) => boolean,
): readonly T[] {
  if (!limit || limit < 1 || options.length <= limit) return options;
  const shown = options.slice(0, limit);
  const current = options.find(selected);
  if (current !== undefined && !shown.some(selected))
    shown[limit - 1] = current;
  return shown;
}
