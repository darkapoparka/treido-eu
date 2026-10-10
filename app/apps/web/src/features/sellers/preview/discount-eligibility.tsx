"use client";
import { useState } from "react";
import { AdminIcon } from "../admin-icons";
import { usePreview } from "./context";
import { type Discount } from "./model";
import {
  discountEligibilityItems,
  discountEligibilityOptions,
} from "./discount-eligibility-model";
import { Action, Button, Check, EditorSection, Field, Modal, s } from "./ui";
import styles from "./discount-eligibility.module.css";

export function DiscountEligibility({
  discount,
  patch,
}: {
  discount: Discount;
  patch: (value: Partial<Discount>) => void;
}) {
  const { store, text, href } = usePreview();
  const [typeOpen, setTypeOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>();
  const [query, setQuery] = useState("");
  const choices = discountEligibilityOptions.find(
    ([kind]) => kind === discount.eligibility,
  );
  const label = choices
    ? text(
        choices[0] === "Specific customer segments"
          ? "Customer segments"
          : choices[0],
        choices[1],
      )
    : discount.eligibility;
  const items = discountEligibilityItems(store, discount.eligibility);
  const ids = discount.eligibilityIds ?? [];
  const customer = discount.eligibility === "Specific customers";
  const addLabel = customer
    ? text("Add customers", "Добавяне на клиенти")
    : discount.eligibility === "Markets"
      ? text("Add markets", "Добавяне на пазари")
      : text("Add customer segments", "Добавяне на клиентски сегменти");
  return (
    <EditorSection
      title={text("Eligibility", "Допустимост")}
      part="discount-eligibility"
    >
      <Button
        className={styles.trigger}
        aria-label={text("Eligibility", "Допустимост")}
        aria-haspopup="dialog"
        onClick={() => setTypeOpen(true)}
      >
        {label}
        <AdminIcon name="chevron" />
      </Button>
      {discount.eligibility !== "All customers" && (
        <>
          <Button
            className={styles.add}
            onClick={() => {
              setSelected([...ids]);
              setQuery("");
            }}
          >
            <AdminIcon name="plus" />
            {addLabel}
          </Button>
          {ids.map((id) => (
            <div className={s.dataRow} key={id}>
              <span>
                {items.find((item) => item.id === id)?.title ??
                  text("Unavailable local record", "Недостъпен локален запис")}
              </span>
              <Button
                plain
                aria-label={`${text("Remove", "Премахване")} ${items.find((item) => item.id === id)?.title ?? id}`}
                onClick={() =>
                  patch({ eligibilityIds: ids.filter((value) => value !== id) })
                }
              >
                <AdminIcon name="close" />
              </Button>
            </div>
          ))}
        </>
      )}
      {typeOpen && (
        <Modal
          title={text("Eligibility", "Допустимост")}
          surface="discount-eligibility-type"
          className={styles.types}
          onClose={() => setTypeOpen(false)}
        >
          <div
            role="listbox"
            aria-label={text("Customer eligibility", "Допустимост на клиенти")}
          >
            {discountEligibilityOptions.map(([kind, bg]) => (
              <button
                type="button"
                role="option"
                aria-selected={discount.eligibility === kind}
                key={kind}
                onClick={() => {
                  patch({ eligibility: kind, eligibilityIds: [] });
                  setTypeOpen(false);
                }}
              >
                <span aria-hidden="true">
                  {discount.eligibility === kind ? "✓" : ""}
                </span>
                {text(
                  kind === "Specific customer segments"
                    ? "Customer segments"
                    : kind,
                  bg,
                )}
              </button>
            ))}
          </div>
        </Modal>
      )}
      {selected && (
        <Modal
          title={addLabel}
          surface="discount-eligibility-items"
          className={styles.items}
          onClose={() => setSelected(undefined)}
          footer={
            <>
              <span>
                {selected.length} {text("selected", "избрани")}
              </span>
              <Button onClick={() => setSelected(undefined)}>
                {text("Cancel", "Отказ")}
              </Button>
              <Button
                primary
                disabled={!selected.length}
                onClick={() => {
                  patch({ eligibilityIds: selected });
                  setSelected(undefined);
                }}
              >
                {text("Add", "Добавяне")}
              </Button>
            </>
          }
        >
          {customer && (
            <p className={s.help}>
              {text(
                "Create a local customer from the",
                "Създайте локален клиент от",
              )}{" "}
              <Action href={href("customers/new")}>
                {text("Customers page", "страницата за клиенти")}
              </Action>
            </p>
          )}
          <Field
            label={text("Search local records", "Търсене на локални записи")}
          >
            <input
              data-studio-autofocus
              type="search"
              maxLength={160}
              value={query}
              placeholder={text("Search", "Търсене")}
              onChange={(event) => setQuery(event.target.value)}
            />
          </Field>
          <div
            className={styles.options}
            data-studio-part="discount-eligibility-options"
          >
            {items
              .filter((item) =>
                item.title
                  .toLocaleLowerCase()
                  .includes(query.trim().toLocaleLowerCase()),
              )
              .map((item) => (
                <Check
                  key={item.id}
                  label={item.title}
                  checked={selected.includes(item.id)}
                  disabled={
                    selected.length >= 100 && !selected.includes(item.id)
                  }
                  onChange={() =>
                    setSelected(
                      selected.includes(item.id)
                        ? selected.filter((id) => id !== item.id)
                        : [...selected, item.id],
                    )
                  }
                />
              ))}
            {!items.length && (
              <div className={styles.empty}>
                <AdminIcon name="search" />
                <h3>
                  {text(
                    "No saved local records yet",
                    "Все още няма запазени локални записи",
                  )}
                </h3>
              </div>
            )}
            {!!items.length &&
              !items.some((item) =>
                item.title
                  .toLocaleLowerCase()
                  .includes(query.trim().toLocaleLowerCase()),
              ) && (
                <p>
                  {text(
                    "No matching local records",
                    "Няма съвпадащи локални записи",
                  )}
                </p>
              )}
          </div>
        </Modal>
      )}
    </EditorSection>
  );
}
