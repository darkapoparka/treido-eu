import type {
  AttributeDefinition,
  CategoryLeaf,
} from "@treido/contracts/categories";
import { optionLabel, sellingCopy, type SellingLocale } from "./copy";
import styles from "./selling.module.css";

function displayAttribute(
  field: AttributeDefinition,
  value: unknown,
  locale: SellingLocale,
): string {
  if (field.type === "boolean")
    return sellingCopy[locale][value ? "yes" : "no"];
  if (field.type === "enum") return optionLabel(String(value), locale);
  if (field.type === "multi_enum")
    return (value as string[])
      .map((option) => optionLabel(option, locale))
      .join(", ");
  if (field.type === "dimension") {
    const dimension = value as {
      width: number;
      height: number;
      depth: number;
      unit: string;
    };
    return `${dimension.width} × ${dimension.height} × ${dimension.depth} ${dimension.unit}`;
  }
  if (field.type === "decimal") {
    const decimal = value as { value: string; unit: string };
    return `${decimal.value} ${decimal.unit}`;
  }
  return `${String(value)}${field.type === "integer" && field.unit ? ` ${field.unit}` : ""}`;
}

export function PreparationReview({
  category,
  condition,
  attributes,
  locale,
}: {
  category: CategoryLeaf;
  condition: string;
  attributes: Record<string, unknown>;
  locale: SellingLocale;
}) {
  return (
    <dl className={styles.reviewList}>
      <div>
        <dt>{sellingCopy[locale].condition}</dt>
        <dd>{optionLabel(condition, locale)}</dd>
      </div>
      {category.profile.fields
        .filter((field) => attributes[field.id] !== undefined)
        .map((field) => (
          <div key={field.id}>
            <dt>{field.labels[locale]}</dt>
            <dd>{displayAttribute(field, attributes[field.id], locale)}</dd>
          </div>
        ))}
    </dl>
  );
}
