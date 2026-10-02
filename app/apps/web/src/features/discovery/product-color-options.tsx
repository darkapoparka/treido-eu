"use client";
/* eslint-disable @next/next/no-img-element -- Verified native product photography. */
import { useCaption } from "../locale/use-caption";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ProductVariant } from "../catalog/types";
import { Sheet } from "./components";
import { Icon } from "./icons";
import { visibleNativeOptions } from "./product-variant-options-model";
import "./product-color-options.css";

export function ProductColorOptions({
  variants,
  label = "Color",
  value,
  onChange,
}: {
  variants: readonly (ProductVariant & { referenceOptionDisabled?: boolean })[];
  label?: string;
  value: string;
  onChange: (id: string) => void;
}) {
  const caption = useCaption();
  const ui = useTranslations("discoveryUI");
  const [open, setOpen] = useState(false);
  const selected = variants.find((option) => option.id === value);
  const shown = visibleNativeOptions(
    variants,
    variants.length > 16 ? 15 : undefined,
    (option) => option.id === value,
  );
  const choose = (
    option: ProductVariant & { referenceOptionDisabled?: boolean },
  ) => {
    if (option.referenceOptionDisabled) return;
    onChange(option.id);
    setOpen(false);
  };
  return (
    <>
      <fieldset className="pdp-color-choice native-product-colors">
        <legend>
          <strong>{caption(label)}:</strong> {selected?.label}
        </legend>
        <div className="native-color-grid">
          {shown.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-label={`${label}: ${option.label}`}
              aria-pressed={value === option.id}
              disabled={option.referenceOptionDisabled}
              onClick={() => choose(option)}
            >
              <span
                style={{
                  background: option.referenceColor?.swatch,
                  backgroundOrigin: "content-box",
                  backgroundPosition: "center",
                  backgroundSize: option.referenceColor?.swatch.startsWith(
                    "url(",
                  )
                    ? "contain"
                    : undefined,
                  backgroundRepeat: "no-repeat",
                }}
                data-unavailable={
                  option.referenceColor?.unavailable || undefined
                }
              />
            </button>
          ))}
          {shown.length < variants.length && (
            <button
              type="button"
              aria-label={ui("viewValue1MoreColors", {
                value1: variants.length - shown.length,
              })}
              onClick={() => setOpen(true)}
            >
              <span className="native-color-more">
                +{variants.length - shown.length}
              </span>
            </button>
          )}
        </div>
      </fieldset>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={caption(label)}
        headerless
        dragHandle
        initialFocus='button[aria-pressed="true"]'
        className="native-color-sheet"
      >
        <h2 aria-hidden="true">{caption(label)}</h2>
        <div className="native-color-list">
          {variants.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={value === option.id}
              data-unavailable={option.referenceColor?.unavailable || undefined}
              disabled={option.referenceOptionDisabled}
              onClick={() => choose(option)}
            >
              <img src={option.referenceColor?.photo} alt="" />
              <span>{option.label}</span>
              {option.referenceColor?.unavailable ? (
                <small>{ui("soldOut")}</small>
              ) : value === option.id ? (
                <Icon name="check" />
              ) : null}
            </button>
          ))}
        </div>
        <button
          className="sr-only"
          type="button"
          onClick={() => setOpen(false)}
        >
          {ui("close")} {caption(label)}
        </button>
      </Sheet>
    </>
  );
}
