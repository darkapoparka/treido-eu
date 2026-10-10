"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatMoney } from "../catalog/types";
import { variantCaption, type PublicSku } from "../inventory/model";
import { Sheet } from "./components";
import { Icon } from "./icons";
import { publicVariantLabels } from "./public-variant-labels";
import { visibleNativeOptions } from "./product-variant-options-model";
import "./product-color-options.css";
import styles from "./public-variant-options.module.css";

/** The Shop option-pill owner renders complete, current SKUs. Choosing a pill
 * never manufactures a color/size combination or changes availability authority. */
export function PublicVariantOptions({
  skus,
  selectedId,
  onChange,
}: {
  skus: readonly PublicSku[];
  selectedId: string;
  onChange: (id: string) => void;
}) {
  const t = useTranslations("inventory"),
    ui = useTranslations("discoveryUI"),
    locale = useLocale();
  const [expanded, setExpanded] = useState(false);
  const labels = publicVariantLabels(
    skus,
    t("selectVariant"),
    t("defaultVariant"),
  );
  const shown = visibleNativeOptions(skus, 6, (sku) => sku.id === selectedId);
  const label = (sku: PublicSku) => labels.values[skus.indexOf(sku)];
  const price = (sku: PublicSku) =>
    formatMoney({ amount: sku.priceMinor, currency: "EUR" }, locale);
  const caption = (sku: PublicSku) =>
    (variantCaption(sku.options) || t("defaultVariant")) +
    " · " +
    price(sku) +
    (sku.available === 0 ? " · " + t("out_of_stock") : "");
  const choose = (id: string) => {
    onChange(id);
    setExpanded(false);
  };
  return (
    <fieldset className={"native-product-options " + styles.selector}>
      <legend>{labels.legend}</legend>
      <div className={"native-options-pills " + styles.choices}>
        {shown.map((sku) => (
          <button
            key={sku.id}
            type="button"
            data-public-sku={sku.id}
            aria-pressed={selectedId === sku.id}
            data-unavailable={sku.available === 0 || undefined}
            aria-label={caption(sku)}
            title={variantCaption(sku.options) || t("defaultVariant")}
            onClick={() => choose(sku.id)}
          >
            <span>{label(sku)}</span>
          </button>
        ))}
        {shown.length < skus.length && (
          <button
            type="button"
            aria-label={ui("viewValue1MoreValue2Options", {
              value1: skus.length - shown.length,
              value2: labels.legend,
            })}
            onClick={() => setExpanded(true)}
          >
            {ui("view")} {skus.length - shown.length} {ui("more")}
          </button>
        )}
      </div>
      <Sheet
        title={labels.legend}
        open={expanded}
        onClose={() => setExpanded(false)}
        headerless
        dragHandle
        initialFocus='button[aria-pressed="true"]'
        className={"native-color-sheet native-option-sheet " + styles.optionsSheet}
      >
        <h2 aria-hidden="true">{labels.legend}</h2>
        <div className="native-color-list">
          {skus.map((sku) => (
            <button
              key={sku.id}
              type="button"
              data-public-sku={sku.id}
              aria-pressed={selectedId === sku.id}
              data-unavailable={sku.available === 0 || undefined}
              aria-label={caption(sku)}
              onClick={() => choose(sku.id)}
            >
              <span>{label(sku)}</span>
              <small>{sku.available === 0 ? t("out_of_stock") : price(sku)}</small>
              {selectedId === sku.id && <Icon name="check" />}
            </button>
          ))}
        </div>
        <button className="sr-only" onClick={() => setExpanded(false)}>
          {ui("close")} {labels.legend}
        </button>
      </Sheet>
    </fieldset>
  );
}
