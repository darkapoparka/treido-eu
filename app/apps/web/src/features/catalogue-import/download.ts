"use client";
import { categoryRoots, getChildren } from "@treido/contracts/categories";
import { CSV_COLUMNS, csvDocument } from "./csv";
export function downloadCsv(name: string, csv: string) {
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadTemplate() {
  downloadCsv("treido-catalogue-template.csv", csvDocument(CSV_COLUMNS, []));
}
export function downloadCategoryGuide() {
  const rows = categoryRoots.flatMap((root) =>
    getChildren(root.id).map((leaf) => [
      leaf.id,
      leaf.labels.bg,
      leaf.labels.en,
      leaf.policy.conditions.join("|"),
      leaf.profile.fields
        .filter((field) => field.required)
        .map((field) => field.id)
        .join("|"),
      JSON.stringify(leaf.profile.fields),
    ]),
  );
  downloadCsv(
    "treido-category-fields.csv",
    csvDocument(
      [
        "category_id",
        "name_bg",
        "name_en",
        "conditions",
        "required_attributes",
        "attribute_definitions",
      ],
      rows,
    ),
  );
}
