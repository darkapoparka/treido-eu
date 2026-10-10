/** Source-observed schema choices, saved as local planning metadata only. */
export const metaobjectFieldTypes = [
  ["single-line", "Single line text", "Едноредов текст", "Text"],
  ["multi-line", "Multi-line text", "Многоредов текст", "Text"],
  ["rich-text", "Rich text", "Форматиран текст", "Text"],
  [
    "choice",
    "Choice list (Single line text)",
    "Списък с текстови стойности",
    "Text",
  ],
  ["email", "Email (Single line text)", "Имейл", "Text"],
  ["file", "File", "Файл", "Media"],
  ["image", "Image (File)", "Изображение", "Media"],
  ["video", "Video (File)", "Видео", "Media"],
  ["blog", "Blog post", "Публикация в блог", "Reference"],
  ["collection", "Collection", "Колекция", "Reference"],
  ["company", "Company", "Фирма", "Reference"],
  ["customer", "Customer", "Клиент", "Reference"],
  ["metaobject", "Metaobject", "Метаобект", "Reference"],
  ["order", "Order", "Поръчка", "Reference"],
  ["page", "Page", "Страница", "Reference"],
  ["product", "Product", "Продукт", "Reference"],
  ["variant", "Product variant", "Вариант на продукт", "Reference"],
  ["id", "ID", "Идентификатор", "Number"],
  ["money", "Money", "Парична сума", "Number"],
  ["decimal", "Decimal", "Десетично число", "Number"],
  ["integer", "Integer", "Цяло число", "Number"],
  ["rating", "Rating", "Оценка", "Number"],
  ["measurement", "Measurement", "Измерване", "Number"],
  ["link", "Link", "Връзка", "Link"],
  ["url", "URL", "URL адрес", "Link"],
  ["date", "Date", "Дата", "Date and time"],
  ["date-time", "Date and time", "Дата и час", "Date and time"],
  ["boolean", "True or false", "Вярно или невярно", "Other"],
  ["color", "Color", "Цвят", "Other"],
  ["language", "Language", "Език", "Other"],
  ["json", "JSON", "JSON", "Advanced"],
  ["mixed-reference", "Mixed reference", "Смесена връзка", "Advanced"],
] as const;
export type MetaobjectFieldType = (typeof metaobjectFieldTypes)[number][0];
export type MetaobjectFieldDraft = {
  id: string;
  label: string;
  key: string;
  type: MetaobjectFieldType | "";
  list: boolean;
  required: boolean;
  description: string;
  minimum: string;
  maximum: string;
  pattern: string;
};
export type DefinitionDraft = {
  kind: "Definition";
  handle: string;
  description: string;
  fields: MetaobjectFieldDraft[];
  activeDraft: boolean;
  translations: boolean;
  displayField: string;
  filterFields: string[];
};
export const schemaKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
export const blankMetaobjectField = (id: string): MetaobjectFieldDraft => ({
  id,
  label: "",
  key: "",
  type: "",
  list: false,
  required: false,
  description: "",
  minimum: "",
  maximum: "",
  pattern: "",
});
const bounded = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length <= max;
const bound = (value: unknown): value is string =>
  value === "" ||
  (typeof value === "string" &&
    /^\d{1,5}$/.test(value) &&
    Number(value) <= 10000);
export function validDefinitionDraft(value: unknown): value is DefinitionDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Record<string, unknown>;
  if (
    draft.kind !== "Definition" ||
    !bounded(draft.handle, 64) ||
    !/^[a-z][a-z0-9_-]{0,63}$/.test(draft.handle) ||
    !bounded(draft.description, 2000) ||
    typeof draft.activeDraft !== "boolean" ||
    typeof draft.translations !== "boolean" ||
    !Array.isArray(draft.fields) ||
    draft.fields.length < 1 ||
    draft.fields.length > 50
  )
    return false;
  const fields = draft.fields;
  if (
    !fields.every((field: unknown) => {
      if (!field || typeof field !== "object") return false;
      const f = field as Record<string, unknown>;
      return (
        bounded(f.id, 100) &&
        /^[a-z0-9-]{1,100}$/.test(f.id) &&
        bounded(f.label, 160) &&
        !!f.label.trim() &&
        bounded(f.key, 64) &&
        /^[a-z][a-z0-9_-]{0,63}$/.test(f.key) &&
        metaobjectFieldTypes.some(([type]) => type === f.type) &&
        typeof f.list === "boolean" &&
        typeof f.required === "boolean" &&
        bounded(f.description, 2000) &&
        bound(f.minimum) &&
        bound(f.maximum) &&
        (!f.minimum || !f.maximum || Number(f.minimum) <= Number(f.maximum)) &&
        bounded(f.pattern, 400) &&
        ((
          [
            "single-line",
            "multi-line",
            "rich-text",
            "choice",
            "email",
          ] as unknown[]
        ).includes(f.type) ||
          (f.minimum === "" && f.maximum === "" && f.pattern === ""))
      );
    })
  )
    return false;
  const typed = fields as MetaobjectFieldDraft[];
  const ids = typed.map((field) => field.id);
  const keys = typed.map((field) => field.key);
  return (
    new Set(ids).size === ids.length &&
    new Set(keys).size === keys.length &&
    bounded(draft.displayField, 100) &&
    (draft.displayField === "" || ids.includes(draft.displayField)) &&
    Array.isArray(draft.filterFields) &&
    draft.filterFields.length <= 10 &&
    draft.filterFields.every(
      (id) => typeof id === "string" && ids.includes(id),
    ) &&
    new Set(draft.filterFields).size === draft.filterFields.length
  );
}
