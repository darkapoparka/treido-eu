"use client";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import type { ProductDetailProduct } from "../catalog/product-detail-model";
import { formatMoney } from "../catalog/types";
import { ProductPriceSummary } from "../discovery/product-price-summary";
import { CartMutationButton } from "../buyer-cart/mutation-button";
import { readPublicInventoryAction } from "./actions";
import {
  INVENTORY_LIMITS,
  variantCaption,
  type PublicInventory,
} from "./model";
import s from "./public.module.css";
export function PublicInventoryPanel({
  product,
  revision,
  initial,
  allowCart = true,
}: {
  product: ProductDetailProduct;
  revision: number;
  initial: PublicInventory | null;
  allowCart?: boolean;
}) {
  const t = useTranslations("inventory"),
    cart = useTranslations("buyerCart"),
    locale = useLocale();
  const [inventory, setInventory] = useState(initial),
    [failed, setFailed] = useState(initial === null);
  const [selectedId, setSelectedId] = useState(
      initial?.skus.length === 1 ? initial.skus[0].id : "",
    ),
    [quantity, setQuantity] = useState("1");
  const life = useRef({ mounted: false, epoch: 0 });
  useEffect(() => {
    const current = life.current;
    current.mounted = true;
    const reload = async () => {
      if (document.visibilityState !== "visible") return;
      const ticket = ++current.epoch;
      try {
        const result = await readPublicInventoryAction(product.id, revision);
        if (!current.mounted || ticket !== current.epoch) return;
        if (result.ok) {
          setInventory(result.data);
          setFailed(false);
        } else {
          setInventory(null);
          setFailed(true);
        }
      } catch {
        if (current.mounted && ticket === current.epoch) {
          setInventory(null);
          setFailed(true);
        }
      }
    };
    const update = () => {
        void reload();
      },
      timer = setInterval(update, 15000);
    window.addEventListener("focus", update);
    window.addEventListener("online", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      current.mounted = false;
      ++current.epoch;
      clearInterval(timer);
      window.removeEventListener("focus", update);
      window.removeEventListener("online", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [product.id, revision]);
  const selected = inventory?.skus.find((sku) => sku.id === selectedId),
    count = /^\d+$/.test(quantity) ? Number(quantity) : 0;
  const maximum = selected
    ? Math.min(
        selected.available,
        inventory?.mode === "unique" ? 1 : INVENTORY_LIMITS.quantity,
      )
    : 0;
  const lowest = inventory?.skus.length
    ? Math.min(...inventory.skus.map((sku) => sku.priceMinor))
    : product.price.amount;
  const price = {
    amount: selected?.priceMinor ?? lowest,
    currency: "EUR" as const,
  };
  return (
    <section className={s.root} data-public-inventory>
      {failed && !allowCart && (
        <ProductPriceSummary
          product={product}
          variant=""
          price={product.price}
          capturedSpendOffer=""
          onDetails={() => {}}
        />
      )}
      {!failed && (
        <>
          {inventory?.skus.length &&
          !selected &&
          new Set(inventory.skus.map((sku) => sku.priceMinor)).size > 1 ? (
            <p className={s.from}>
              {t("from", { price: formatMoney(price, locale) })}
            </p>
          ) : (
            <ProductPriceSummary
              product={product}
              variant={selected ? variantCaption(selected.options) : ""}
              price={inventory?.mode === "unknown" ? product.price : price}
              capturedSpendOffer=""
              onDetails={() => {}}
            />
          )}
        </>
      )}
      <p className={s.status} role="status">
        {failed ? t("unavailablePublic") : t(inventory?.state ?? "unknown")}
      </p>
      {!!inventory?.skus.length && (
        <>
          {inventory.skus.length > 1 && (
            <label className="form-field">
              {t("selectVariant")}
              <select
                aria-label={t("selectVariant")}
                value={selectedId}
                onChange={(event) => {
                  setSelectedId(event.target.value);
                  setQuantity("1");
                }}
              >
                <option value="">{t("selectVariant")}</option>
                {inventory.skus.map((sku) => (
                  <option key={sku.id} value={sku.id}>
                    {variantCaption(sku.options) || t("defaultVariant")} ·{" "}
                    {formatMoney(
                      { amount: sku.priceMinor, currency: "EUR" },
                      locale,
                    )}
                    {sku.available === 0 ? " · " + t("out_of_stock") : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          {selected && (
            <p>{t("unitsAvailable", { count: selected.available })}</p>
          )}
          {allowCart && selected && inventory.mode === "stocked" && (
            <label className="form-field">
              {t("quantity")}
              <input
                type="number"
                min={1}
                max={Math.max(1, maximum)}
                step={1}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </label>
          )}
          {allowCart && selected && (
            <CartMutationButton
              className="primary"
              operation={{
                kind: "add",
                listingId: product.id,
                skuId: selected.id,
                publicationRevision: revision,
                quantity: count,
              }}
              label={cart("add")}
              disabled={
                failed ||
                !Number.isSafeInteger(count) ||
                count < 1 ||
                count > maximum
              }
            />
          )}
          {allowCart && <p className={s.note}>{t("stockNote")}</p>}
        </>
      )}
      {allowCart && (
        <Link href={"/cart?lang=" + locale} className="pill">
          {cart("open")}
        </Link>
      )}
    </section>
  );
}
