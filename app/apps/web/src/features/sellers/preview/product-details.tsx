"use client";
import { useState } from "react";
import { usePreview } from "./context";
import { parseMoney, type Product } from "./model";
import { Check, Field, Panel, s } from "./ui";
import { AdminIcon } from "../admin-icons";
import { ProductUnitPrice } from "./product-unit-price";
type Props = { product: Product; patch: (value: Partial<Product>) => void };

function MoneyProperty({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: number;
  onChange: (value: number | undefined) => void;
}) {
  const [draft, setDraft] = useState(
    value === undefined ? "" : (value / 100).toFixed(2),
  );
  const valid = draft === "" || parseMoney(draft) !== null;
  return (
    <Field label={label}>
      <input
        inputMode="decimal"
        pattern="[0-9]{1,7}([.,][0-9]{1,2})?"
        value={draft}
        aria-invalid={!valid}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          const minor = parseMoney(next);
          if (next === "" || minor !== null)
            onChange(next === "" ? undefined : minor!);
        }}
      />
    </Field>
  );
}

export function ProductPrice({
  product,
  patch,
  price,
  setPrice,
}: Props & { price: string; setPrice: (value: string) => void }) {
  const { text } = usePreview();
  const [expanded, setExpanded] = useState(
    product.compareAt !== undefined ||
      product.cost !== undefined ||
      !!product.unitAmount,
  );
  const [costDraft, setCostDraft] = useState(
    product.cost === undefined ? "" : (product.cost / 100).toFixed(2),
  );
  return (
    <section data-studio-part="product-price-group">
      <h2>{text("Price", "Цена")}</h2>
      <Panel part="product-price">
        <Field label={text("Price", "Цена")}>
          <div data-studio-part="money-input">
            <span aria-hidden="true">€</span>
            <input
              inputMode="decimal"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              required
              aria-label={text("Price EUR", "Цена EUR")}
            />
          </div>
        </Field>
        {expanded ? (
          <>
            <div data-studio-part="price-extra">
              <button
                type="button"
                data-studio-part="price-extra-heading"
                aria-expanded="true"
                onClick={() => setExpanded(false)}
              >
                {text(
                  "Additional display prices",
                  "Допълнителни цени за показване",
                )}
                <AdminIcon name="chevron" />
              </button>
              <div className={s.fields} data-studio-part="fields">
                <MoneyProperty
                  label={text("Compare-at price EUR", "Сравнителна цена EUR")}
                  value={product.compareAt}
                  onChange={(compareAt) => patch({ compareAt })}
                />
                <ProductUnitPrice product={product} patch={patch} />
              </div>
              <Check
                label={text(
                  "Charge tax on this product",
                  "Начислявай данък за този продукт",
                )}
                checked={product.chargeTax !== false}
                onChange={() =>
                  patch({ chargeTax: product.chargeTax === false })
                }
              />
            </div>
            <label data-studio-part="price-cost">
              <span>{text("Cost", "Разход")}</span>
              <input
                aria-label={text("Cost per item EUR", "Разход за брой EUR")}
                placeholder="—"
                inputMode="decimal"
                maxLength={12}
                pattern="[0-9]{1,7}([.,][0-9]{1,2})?"
                value={costDraft}
                aria-invalid={
                  costDraft !== "" && parseMoney(costDraft) === null
                }
                onChange={(event) => {
                  const value = event.target.value;
                  setCostDraft(value);
                  const minor = parseMoney(value);
                  if (value === "" || minor !== null)
                    patch({ cost: value === "" ? undefined : minor! });
                }}
              />
            </label>
          </>
        ) : (
          <div data-studio-part="product-properties">
            {[
              text("Compare-at", "Сравнителна цена"),
              text("Unit price", "Единична цена"),
              `${text("Charge tax", "Начислявай данък")} ${product.chargeTax === false ? text("No", "Не") : text("Yes", "Да")}`,
              text("Cost per item", "Разход за брой"),
            ].map((label) => (
              <button
                type="button"
                data-studio-part="price-chip"
                key={label}
                aria-expanded="false"
                onClick={() => setExpanded(true)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </Panel>
    </section>
  );
}

export function ProductInventory({ product, patch }: Props) {
  const { text, store } = usePreview();
  const [expanded, setExpanded] = useState(
    !!product.sku || !!product.barcode || product.sellOutOfStock === true,
  );
  return (
    <Panel
      title={text("Inventory", "Наличност")}
      part="product-inventory"
      action={
        <label data-studio-part="product-switch">
          {text("Inventory tracked", "Следи наличността")}
          <input
            type="checkbox"
            role="switch"
            checked={product.trackInventory !== false}
            onChange={() =>
              patch({ trackInventory: product.trackInventory === false })
            }
          />
        </label>
      }
    >
      {product.trackInventory !== false && (
        <div data-studio-part="quantity-card">
          <div>
            <span>{text("Quantity", "Количество")}</span>
            <span>{text("Available", "Налични")}</span>
          </div>
          <div>
            <span>
              {store.settings.locationName ||
                text("Store location", "Локация на магазина")}
            </span>
            <input
              type="number"
              min={0}
              max={999999}
              step={1}
              value={product.quantity}
              aria-label={text("Available quantity", "Налично количество")}
              onChange={(event) =>
                patch({ quantity: Number(event.target.value) })
              }
            />
          </div>
        </div>
      )}
      {expanded ? (
        <div data-studio-part="product-more-details">
          <button
            type="button"
            data-studio-part="price-extra-heading"
            aria-expanded="true"
            onClick={() => setExpanded(false)}
          >
            {text("More details", "Още подробности")}
            <AdminIcon name="chevron" />
          </button>
          <div className={s.fields} data-studio-part="fields">
            <Field
              label={text("SKU (stock keeping unit)", "SKU (складова единица)")}
            >
              <input
                maxLength={80}
                value={product.sku}
                onChange={(event) => patch({ sku: event.target.value })}
              />
            </Field>
            <Field label={text("Barcode", "Баркод")}>
              <input
                value={product.barcode ?? ""}
                maxLength={80}
                onChange={(event) => patch({ barcode: event.target.value })}
              />
            </Field>
          </div>
          <Check
            label={text(
              "Continue selling when out of stock (preview)",
              "Продължи продажбите без наличност (преглед)",
            )}
            checked={product.sellOutOfStock === true}
            onChange={() => patch({ sellOutOfStock: !product.sellOutOfStock })}
          />
        </div>
      ) : (
        <div data-studio-part="product-properties">
          {[
            "SKU",
            text("Barcodes", "Баркодове"),
            `${text("Sell when out of stock", "Продажби без наличност")} ${product.sellOutOfStock ? text("On", "Вкл.") : text("Off", "Изкл.")}`,
          ].map((label) => (
            <button
              type="button"
              key={label}
              data-studio-part="price-chip"
              aria-expanded="false"
              onClick={() => setExpanded(true)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function ProductShipping({ product, patch }: Props) {
  const { text } = usePreview();
  const [expanded, setExpanded] = useState(
    !!product.countryOfOrigin || !!product.hsCode,
  );
  return (
    <Panel
      title={text("Shipping", "Доставка")}
      part="product-shipping"
      action={
        <label data-studio-part="product-switch">
          {text("Physical product", "Физически продукт")}
          <input
            type="checkbox"
            role="switch"
            checked={product.shipping}
            onChange={() => patch({ shipping: !product.shipping })}
          />
        </label>
      }
    >
      {product.shipping && (
        <>
          <Field
            label={text(
              "Package when shipped alone",
              "Опаковка при самостоятелна доставка",
            )}
          >
            <select
              aria-label={text(
                "Package when shipped alone",
                "Опаковка при самостоятелна доставка",
              )}
            >
              <option>
                {text(
                  "Custom package · preview dimensions",
                  "Собствена опаковка · размери в прегледа",
                )}
              </option>
            </select>
          </Field>
          <div data-studio-part="product-dimensions">
            <span>
              {text("Packed product size", "Размер на опакования продукт")}
            </span>
            <div>
              {(
                [
                  ["length", "L", "Length", "Дължина"],
                  ["width", "W", "Width", "Ширина"],
                  ["height", "H", "Height", "Височина"],
                ] as const
              ).map(([key, symbol, en, bg]) => (
                <label key={key}>
                  <span aria-hidden="true">{symbol}</span>
                  <input
                    aria-label={text(en, bg)}
                    type="number"
                    min="0"
                    max="999999"
                    step="0.001"
                    placeholder="0.0"
                    value={product[key] ?? ""}
                    onChange={(event) => patch({ [key]: event.target.value })}
                  />
                </label>
              ))}
              <select
                aria-label={text("Dimension unit", "Мерна единица за размер")}
                value={product.dimensionUnit ?? "cm"}
                onChange={(event) =>
                  patch({ dimensionUnit: event.target.value })
                }
              >
                <option>cm</option>
                <option>in</option>
              </select>
            </div>
          </div>
          <div className={s.fields} data-studio-part="product-weight">
            <Field label={text("Weight", "Тегло")}>
              <input
                type="number"
                aria-label={text("Weight", "Тегло")}
                min="0"
                max="999999"
                step="0.001"
                placeholder="0.0"
                value={product.weight ?? ""}
                onChange={(event) => patch({ weight: event.target.value })}
              />
            </Field>
            <Field label={text("Weight unit", "Мерна единица за тегло")}>
              <select
                value={product.weightUnit ?? "kg"}
                onChange={(event) => patch({ weightUnit: event.target.value })}
              >
                <option>kg</option>
                <option>g</option>
                <option>lb</option>
                <option>oz</option>
              </select>
            </Field>
          </div>
          <p className={s.help} data-studio-part="field-help">
            {text(
              "Device-local package facts. Shipping rates and labels are not connected.",
              "Данни за опаковката само на това устройство. Тарифите и товарителниците не са свързани.",
            )}
          </p>
          {expanded ? (
            <div data-studio-part="product-more-details">
              <button
                type="button"
                data-studio-part="price-extra-heading"
                aria-expanded="true"
                onClick={() => setExpanded(false)}
              >
                {text("More details", "Още подробности")}
                <AdminIcon name="chevron" />
              </button>
              <div className={s.fields} data-studio-part="fields">
                <Field
                  label={text(
                    "Country/region of origin",
                    "Държава/регион на произход",
                  )}
                >
                  <select
                    value={product.countryOfOrigin || ""}
                    onChange={(event) =>
                      patch({ countryOfOrigin: event.target.value })
                    }
                  >
                    <option value="">
                      {text("Choose country/region", "Изберете държава/регион")}
                    </option>
                    {[
                      ["BG", "Bulgaria", "България"],
                      ["GR", "Greece", "Гърция"],
                      ["RO", "Romania", "Румъния"],
                      ["DE", "Germany", "Германия"],
                      ["GB", "United Kingdom", "Обединено кралство"],
                    ].map(([code, en, bg]) => (
                      <option key={code} value={code}>
                        {text(en, bg)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label={text("HS code", "HS код")}
                  help={text(
                    "Local product note; no customs calculation.",
                    "Локална бележка; няма митническо изчисление.",
                  )}
                >
                  <input
                    inputMode="numeric"
                    maxLength={10}
                    pattern="[0-9]{0,10}"
                    value={product.hsCode || ""}
                    onChange={(event) => patch({ hsCode: event.target.value })}
                  />
                </Field>
              </div>
            </div>
          ) : (
            <div data-studio-part="product-properties">
              {[
                text("Country of origin", "Държава на произход"),
                text("HS Code", "HS код"),
              ].map((label) => (
                <button
                  type="button"
                  key={label}
                  data-studio-part="price-chip"
                  aria-expanded="false"
                  onClick={() => setExpanded(true)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
