"use client";
import { useRef, useState } from "react";
import { AdminIcon } from "../admin-icons";
import { usePreview } from "./context";
import type { Product } from "./model";
import { Button, Field } from "./ui";
import styles from "./product-unit-price.module.css";

const units = ["g", "kg", "ml", "l", "mm", "cm", "m", "m²", "m³"];
const validAmount = (value: string) =>
  /^\d{1,6}(?:\.\d{1,3})?$/.test(value) && Number(value) > 0;

export function ProductUnitPrice({
  product,
  patch,
}: {
  product: Product;
  patch: (value: Partial<Product>) => void;
}) {
  const { text } = usePreview();
  const popover = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [amount, setAmount] = useState("0");
  const [measure, setMeasure] = useState("g");
  const [base, setBase] = useState("1");
  const [baseMeasure, setBaseMeasure] = useState("kg");
  const [position, setPosition] = useState({ left: 16, top: 16 });
  const close = () => {
    popover.current?.hidePopover();
    trigger.current?.focus({ preventScroll: true });
  };
  const amountField = (
    label: string,
    value: string,
    unit: string,
    change: (value: string) => void,
    changeUnit: (value: string) => void,
  ) => (
    <Field label={label}>
      <div className={styles.measure}>
        <input
          aria-label={label}
          inputMode="decimal"
          maxLength={10}
          value={value}
          aria-invalid={!validAmount(value)}
          onChange={(event) => change(event.target.value)}
        />
        <select
          aria-label={`${label} ${text("unit", "единица")}`}
          value={unit}
          onChange={(event) => changeUnit(event.target.value)}
        >
          {units.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </div>
    </Field>
  );
  return (
    <div className={styles.root} data-studio-part="unit-price">
      <span>{text("Unit price", "Единична цена")}</span>
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        data-studio-part="unit-price-trigger"
        aria-label={text("Edit unit price", "Редактиране на единичната цена")}
        aria-haspopup="dialog"
        onClick={() => {
          const rect = trigger.current?.getBoundingClientRect();
          if (!rect) return;
          setAmount(product.unitAmount || "0");
          setMeasure(product.unitMeasure || "g");
          setBase(product.unitBaseAmount || "1");
          setBaseMeasure(product.unitBaseMeasure || "kg");
          const width = Math.min(296, window.innerWidth - 32);
          setPosition({
            left: Math.max(
              16,
              Math.min(rect.left, window.innerWidth - width - 16),
            ),
            top: Math.max(
              16,
              Math.min(rect.bottom + 4, window.innerHeight - 234),
            ),
          });
          popover.current?.showPopover();
          popover.current
            ?.querySelector("input")
            ?.focus({ preventScroll: true });
        }}
      >
        <span>
          {product.unitAmount
            ? `${product.unitAmount} ${product.unitMeasure || "g"} / ${product.unitBaseAmount || "1"} ${product.unitBaseMeasure || "kg"}`
            : "--"}
        </span>
        <AdminIcon name="chevron" />
      </button>
      <div
        ref={popover}
        popover="auto"
        role="dialog"
        aria-label={text("Edit unit price", "Редактиране на единичната цена")}
        data-studio-part="unit-price-popover"
        className={styles.popover}
        style={position}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            close();
          }
        }}
      >
        <div className={styles.body}>
          {amountField(
            text("Total amount", "Общо количество"),
            amount,
            measure,
            setAmount,
            setMeasure,
          )}
          {amountField(
            text("Base measure", "Базова мярка"),
            base,
            baseMeasure,
            setBase,
            setBaseMeasure,
          )}
        </div>
        <footer>
          <Button
            plain
            danger
            onClick={() => {
              patch({
                unitAmount: undefined,
                unitMeasure: undefined,
                unitBaseAmount: undefined,
                unitBaseMeasure: undefined,
              });
              close();
            }}
          >
            {text("Clear", "Изчистване")}
          </Button>
          <div>
            <Button onClick={close}>{text("Cancel", "Отказ")}</Button>
            <Button
              primary
              disabled={!validAmount(amount) || !validAmount(base)}
              onClick={() => {
                patch({
                  unitAmount: amount,
                  unitMeasure: measure,
                  unitBaseAmount: base,
                  unitBaseMeasure: baseMeasure,
                });
                close();
              }}
            >
              {text("Done", "Готово")}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
