"use client";
import { useState } from "react";
import { usePreview } from "./context";
import { AdminIcon } from "../admin-icons";
import { validDraftDate } from "./local-draft-model";
import { parseMoney } from "./model";
import {
  purchaseAdjustments,
  purchaseTerms,
  type ProcurementDraft,
} from "./procurement-draft-model";
import { Button, Field, Modal } from "./ui";
import styles from "./procurement-drafts.module.css";

export function ProcurementDetails({
  draft,
  onClose,
  onApply,
}: {
  draft: ProcurementDraft;
  onClose: () => void;
  onApply: (value: ProcurementDraft) => void;
}) {
  const { text, language } = usePreview();
  const [value, setValue] = useState(draft);
  const transfer = draft.kind === "Transfer";
  return (
    <Modal
      title={
        transfer
          ? text("Edit transfer details", "Редактиране на трансфер")
          : text("Purchase order details", "Подробности за поръчката")
      }
      surface="procurement-details"
      className={`${styles.detailsModal} ${transfer ? styles.transferModal : ""}`}
      onClose={onClose}
      footer={
        <>
          {transfer && (
            <Button onClick={onClose}>{text("Cancel", "Отказ")}</Button>
          )}
          <Button
            primary
            disabled={!validDraftDate(value.date) || !value.date}
            onClick={() => onApply(value)}
          >
            {transfer ? text("Save", "Запазване") : text("Done", "Готово")}
          </Button>
        </>
      }
    >
      {transfer && (
        <Field label={text("Created at", "Дата на създаване")}>
          <div className={styles.createdDate}>
            <AdminIcon name="calendar" />
            <span aria-hidden="true">
              {validDraftDate(value.date) && value.date
                ? new Intl.DateTimeFormat(
                    language === "bg" ? "bg-BG" : "en-US",
                    { dateStyle: "long", timeZone: "UTC" },
                  ).format(new Date(`${value.date}T12:00:00Z`))
                : text("Choose date", "Избор на дата")}
            </span>
            <input
              type="date"
              aria-label={text("Created at", "Дата на създаване")}
              value={value.date}
              onChange={(event) =>
                setValue({ ...value, date: event.target.value })
              }
            />
          </div>
        </Field>
      )}
      <Field
        label={
          transfer
            ? text("Reference name", "Референтно име")
            : text("Reference number", "Референтен номер")
        }
      >
        <div className={styles.countedInput}>
          <input
            data-studio-autofocus
            aria-label={
              transfer
                ? text("Reference name", "Референтно име")
                : text("Reference number", "Референтен номер")
            }
            maxLength={255}
            value={value.reference}
            onChange={(event) =>
              setValue({ ...value, reference: event.target.value })
            }
          />
          <span aria-hidden="true">{value.reference.length}/255</span>
        </div>
      </Field>
      <Field
        label={
          transfer
            ? text("Note", "Бележка")
            : text("Note to supplier", "Бележка към доставчика")
        }
      >
        <div className={`${styles.countedInput} ${styles.countedNotes}`}>
          <textarea
            aria-label={
              transfer
                ? text("Note", "Бележка")
                : text("Note to supplier", "Бележка към доставчика")
            }
            maxLength={5000}
            value={value.notes}
            onChange={(event) =>
              setValue({ ...value, notes: event.target.value })
            }
          />
          <span aria-hidden="true">{value.notes.length}/5000</span>
        </div>
      </Field>
      {!transfer && (
        <>
          <Field label={text("Payment terms", "Условия за плащане")}>
            <select
              value={value.terms}
              onChange={(event) =>
                setValue({
                  ...value,
                  terms: event.target.value as ProcurementDraft["terms"],
                })
              }
            >
              {purchaseTerms.map(([id, en, bg]) => (
                <option key={id} value={id}>
                  {text(en, bg)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={text("Supplier currency", "Валута на доставчика")}>
            <select
              value="EUR"
              disabled
              title={text(
                "Local calculations support EUR. Other currencies require a procurement adapter.",
                "Локалните изчисления поддържат EUR. Другите валути изискват адаптер за снабдяване.",
              )}
            >
              <option>Euro (EUR €)</option>
            </select>
          </Field>
        </>
      )}
    </Modal>
  );
}

export function ProcurementCosts({
  draft,
  onClose,
  onApply,
}: {
  draft: ProcurementDraft;
  onClose: () => void;
  onApply: (value: ProcurementDraft["adjustments"]) => void;
}) {
  const { text } = usePreview();
  const blank = () => ({
    id: `adjustment-${crypto.randomUUID()}`,
    kind: "" as "" | ProcurementDraft["adjustments"][number]["kind"],
    amount: "0.00",
  });
  const [values, setValues] = useState(() =>
    draft.adjustments.length
      ? draft.adjustments.map((item) => ({
          ...item,
          amount: (item.amount / 100).toFixed(2),
        }))
      : [blank()],
  );
  const valid = values.every(
    (item) =>
      item.kind &&
      parseMoney(item.amount) !== null &&
      (parseMoney(item.amount) ?? 0) <= 100000000,
  );
  return (
    <Modal
      title={text("Manage cost summary", "Управление на разходите")}
      surface="procurement-costs"
      className={styles.costsModal}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{text("Cancel", "Отказ")}</Button>
          <Button
            primary
            disabled={!valid}
            onClick={() =>
              onApply(
                values.map((item) => ({
                  id: item.id,
                  kind: item.kind as ProcurementDraft["adjustments"][number]["kind"],
                  amount: parseMoney(item.amount) ?? 0,
                })),
              )
            }
          >
            {text("Save", "Запазване")}
          </Button>
        </>
      }
    >
      <div className={styles.costRows}>
        {values.map((item) => (
          <div key={item.id}>
            <Field label={text("Adjustment", "Корекция")}>
              <select
                value={item.kind}
                onChange={(event) =>
                  setValues(
                    values.map((row) =>
                      row.id === item.id
                        ? {
                            ...row,
                            kind: event.target.value as typeof item.kind,
                          }
                        : row,
                    ),
                  )
                }
              >
                <option value="">{text("Select", "Избор")}</option>
                {purchaseAdjustments.map(([id, en, bg]) => (
                  <option key={id} value={id}>
                    {text(en, bg)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={text("Amount", "Сума")}>
              <div className={styles.currencyInput}>
                <span aria-hidden="true">€</span>
                <input
                  aria-label={text("Amount EUR", "Сума EUR")}
                  inputMode="decimal"
                  maxLength={12}
                  value={item.amount}
                  onChange={(event) =>
                    setValues(
                      values.map((row) =>
                        row.id === item.id
                          ? { ...row, amount: event.target.value }
                          : row,
                      ),
                    )
                  }
                />
              </div>
            </Field>
            <Button
              plain
              aria-label={text("Remove adjustment", "Премахване на корекция")}
              onClick={() =>
                setValues(values.filter((row) => row.id !== item.id))
              }
            >
              ×
            </Button>
          </div>
        ))}
      </div>
      <Button
        plain
        className={styles.addAdjustment}
        disabled={!valid || values.length >= 20}
        onClick={() => setValues([...values, blank()])}
      >
        ⊕ {text("Add adjustment", "Добавяне на корекция")}
      </Button>
    </Modal>
  );
}
