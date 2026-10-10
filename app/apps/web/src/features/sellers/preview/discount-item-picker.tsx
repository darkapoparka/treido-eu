"use client";
import { useState } from "react";
import { usePreview } from "./context";
import { AdminIcon } from "../admin-icons";
import { Button, Check, Field, Modal, s } from "./ui";
export function DiscountItemPicker({
  kind,
  selected,
  query = "",
  limit = 100,
  onClose,
  onApply,
}: {
  kind: "Products" | "Collections";
  selected: string[];
  query?: string;
  limit?: number;
  onClose: () => void;
  onApply: (ids: string[]) => void;
}) {
  const { store, text } = usePreview();
  const [search, setSearch] = useState(query);
  const [draft, setDraft] = useState(selected);
  const items = (
    kind === "Products"
      ? store.products.filter((item) => item.status !== "Archived")
      : store.collections
  ).filter((item) =>
    item.title.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <Modal
      title={
        kind === "Products"
          ? text("Select products", "Избор на продукти")
          : text("Select collections", "Избор на колекции")
      }
      surface="discount-items"
      onClose={onClose}
      footer={
        <>
          <span>
            {draft.length} {text("selected", "избрани")}
          </span>
          <Button onClick={onClose}>{text("Cancel", "Отказ")}</Button>
          <Button primary onClick={() => onApply(draft)}>
            {text("Add", "Добавяне")}
          </Button>
        </>
      }
    >
      <Field
        label={
          kind === "Products"
            ? text("Search products", "Търсене на продукти")
            : text("Search collections", "Търсене на колекции")
        }
      >
        <input
          data-studio-autofocus
          type="search"
          maxLength={160}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </Field>
      {items.map((item) => (
        <div className={s.dataRow} key={item.id}>
          <AdminIcon name={kind === "Products" ? "product" : "content"} />
          <Check
            label={item.title}
            checked={draft.includes(item.id)}
            disabled={!draft.includes(item.id) && draft.length >= limit}
            onChange={() =>
              setDraft(
                draft.includes(item.id)
                  ? draft.filter((id) => id !== item.id)
                  : draft.length < limit
                    ? [...draft, item.id]
                    : draft,
              )
            }
          />
        </div>
      ))}
      {!items.length && (
        <p className={s.help}>
          {text(
            "No saved local items match this search.",
            "Няма запазени локални артикули за това търсене.",
          )}
        </p>
      )}
    </Modal>
  );
}
