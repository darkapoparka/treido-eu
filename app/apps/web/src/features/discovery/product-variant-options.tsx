"use client";
/* eslint-disable @next/next/no-img-element -- Verified native option photographs. */
import { useCaption } from "../locale/use-caption";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { Product, ProductVariant } from "../catalog/types";
import { Sheet } from "./components";
import { Icon } from "./icons";
import { ProductColorOptions } from "./product-color-options";
import {
  nativeOptionChoices,
  visibleNativeOptions,
} from "./product-variant-options-model";
import "./product-color-options.css";

export function ProductVariantOptions({
  product,
  selected,
  onChange,
}: {
  product: Pick<Product, "variants" | "detail">;
  selected: ProductVariant;
  onChange: (id: string) => void;
}) {
  const caption = useCaption();
  const ui = useTranslations("discoveryUI");
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <>
      {product.detail?.optionGroups?.map((group) => {
        const choices = nativeOptionChoices(
          product.variants,
          selected,
          group.name,
        );
        if (group.colors)
          return (
            <ProductColorOptions
              key={group.name}
              label={caption(group.name)}
              variants={choices.map((choice) => ({
                ...choice.variant,
                label: choice.label,
                referenceOptionDisabled: !choice.selectable,
                referenceColor: choice.variant.referenceColor
                  ? {
                      ...choice.variant.referenceColor,
                      unavailable: choice.soldOut || undefined,
                    }
                  : undefined,
              }))}
              value={selected.id}
              onChange={onChange}
            />
          );
        const shown = visibleNativeOptions(
          choices,
          group.limit,
          (choice) => selected.referenceOptions?.[group.name] === choice.label,
        );
        const choose = (variant: ProductVariant) => {
          onChange(variant.id);
          setExpanded(null);
        };
        return (
          <fieldset
            className="native-product-options"
            data-option-name={group.name}
            data-option-limit={group.limit}
            key={group.name}
          >
            <legend>
              {group.showSelection ? (
                <>
                  <strong>{caption(group.name)}:</strong>{" "}
                  {selected.referenceOptions?.[group.name]}
                </>
              ) : (
                group.name
              )}
            </legend>
            <div className="native-options-pills">
              {shown.map((choice) => (
                <button
                  key={choice.label}
                  type="button"
                  disabled={!choice.selectable}
                  data-unavailable={
                    choice.soldOut || !choice.selectable || undefined
                  }
                  aria-label={`${group.name}: ${choice.label}`}
                  aria-pressed={
                    selected.referenceOptions?.[group.name] === choice.label
                  }
                  onClick={() => choose(choice.variant)}
                >
                  {choice.label}
                </button>
              ))}
              {shown.length < choices.length && (
                <button
                  type="button"
                  aria-label={ui("viewValue1MoreValue2Options", {
                    value1: choices.length - shown.length,
                    value2: group.name ?? "",
                  })}
                  onClick={() => setExpanded(group.name)}
                >
                  {ui("view")} {choices.length - shown.length} {ui("more")}
                </button>
              )}
            </div>
            <Sheet
              title={caption(group.name)}
              open={expanded === group.name}
              onClose={() => setExpanded(null)}
              headerless
              dragHandle
              initialFocus='button[aria-pressed="true"]'
              className="native-color-sheet native-option-sheet"
            >
              <h2 aria-hidden="true">{caption(group.name)}</h2>
              <div className="native-color-list">
                {choices.map((choice) => (
                  <button
                    key={choice.label}
                    type="button"
                    disabled={!choice.selectable}
                    data-unavailable={
                      choice.soldOut || !choice.selectable || undefined
                    }
                    aria-pressed={
                      selected.referenceOptions?.[group.name] === choice.label
                    }
                    onClick={() => choose(choice.variant)}
                  >
                    {(choice.variant.referenceImage ||
                      choice.variant.referenceColor?.photo) && (
                      <img
                        src={
                          choice.variant.referenceImage ??
                          choice.variant.referenceColor?.photo
                        }
                        alt=""
                      />
                    )}
                    <span>{choice.label}</span>
                    {choice.soldOut || !choice.selectable ? (
                      <small>
                        {choice.soldOut ? ui("soldOut") : ui("unavailable")}
                      </small>
                    ) : selected.referenceOptions?.[group.name] ===
                      choice.label ? (
                      <Icon name="check" />
                    ) : null}
                  </button>
                ))}
              </div>
              <button className="sr-only" onClick={() => setExpanded(null)}>
                {ui("close")} {caption(group.name)}
              </button>
            </Sheet>
          </fieldset>
        );
      })}
    </>
  );
}
