"use client";
/* eslint-disable @next/next/no-img-element -- Verified native option photographs. */
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
  product: Product;
  selected: ProductVariant;
  onChange: (id: string) => void;
}) {
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
              label={group.name}
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
                  <strong>{group.name}:</strong>{" "}
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
                  aria-label={`View ${choices.length - shown.length} more ${group.name} options`}
                  onClick={() => setExpanded(group.name)}
                >
                  View {choices.length - shown.length} more
                </button>
              )}
            </div>
            <Sheet
              title={group.name}
              open={expanded === group.name}
              onClose={() => setExpanded(null)}
              headerless
              dragHandle
              initialFocus='button[aria-pressed="true"]'
              className="native-color-sheet native-option-sheet"
            >
              <h2 aria-hidden="true">{group.name}</h2>
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
                        {choice.soldOut ? "Sold out" : "Unavailable"}
                      </small>
                    ) : selected.referenceOptions?.[group.name] ===
                      choice.label ? (
                      <Icon name="check" />
                    ) : null}
                  </button>
                ))}
              </div>
              <button className="sr-only" onClick={() => setExpanded(null)}>
                Close {group.name}
              </button>
            </Sheet>
          </fieldset>
        );
      })}
    </>
  );
}
