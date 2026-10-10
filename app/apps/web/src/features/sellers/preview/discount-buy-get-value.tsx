"use client";
import { useState } from "react";
import { usePreview } from "./context";
import { parseMoney, type Discount } from "./model";
import { Check, Field } from "./ui";

export function DiscountBuyGetValue({
  discount,
  patch,
}: {
  discount: Discount;
  patch: (values: Partial<Discount>) => void;
}) {
  const { text } = usePreview();
  const [amount, setAmount] = useState(() =>
    (
      (discount.getValueMinor ?? Math.round(discount.value * 100)) / 100
    ).toFixed(2),
  );
  return (
    <section data-studio-part="discount-get-value">
      <h3>{text("At a discounted value", "С отстъпка")}</h3>
      {(
        [
          ["Percentage", "Процент"],
          ["Fixed amount", "Сума за всеки артикул"],
          ["Free", "Безплатно"],
        ] as const
      ).map(([kind, bg]) => (
        <div key={kind}>
          <Check
            radio
            name="bogo-discounted-value"
            label={text(kind === "Fixed amount" ? "Amount off each" : kind, bg)}
            checked={discount.valueMode === kind}
            onChange={() =>
              patch({
                valueMode: kind,
                value:
                  kind === "Free" || kind === "Fixed amount"
                    ? 0
                    : discount.value,
                ...(kind === "Fixed amount"
                  ? { getValueMinor: parseMoney(amount) ?? -1 }
                  : {}),
              })
            }
          />
          {discount.valueMode === kind && kind !== "Free" && (
            <Field
              label={
                kind === "Percentage"
                  ? text(
                      "Customer gets discount percentage",
                      "Процент отстъпка за клиента",
                    )
                  : text("Amount off each EUR", "Сума за всеки артикул EUR")
              }
            >
              <div data-studio-part="discount-bogo-amount">
                <span aria-hidden="true">
                  {kind === "Percentage" ? "%" : "€"}
                </span>
                <input
                  type="number"
                  min={0}
                  max={kind === "Percentage" ? 100 : 1000000}
                  step={kind === "Percentage" ? 1 : 0.01}
                  value={kind === "Percentage" ? discount.value || "" : amount}
                  onChange={(event) => {
                    if (kind === "Percentage")
                      patch({ value: Number(event.target.value) });
                    else {
                      setAmount(event.target.value);
                      patch({
                        getValueMinor: parseMoney(event.target.value) ?? -1,
                        value: 0,
                      });
                    }
                  }}
                />
              </div>
            </Field>
          )}
        </div>
      ))}
      <div data-studio-part="discount-per-order-limit">
        <Check
          label={text(
            "Set a maximum number of uses per order",
            "Максимален брой използвания на поръчка",
          )}
          checked={!!discount.maximumPerOrderEnabled}
          onChange={() =>
            patch({
              maximumPerOrderEnabled: !discount.maximumPerOrderEnabled,
              maximumPerOrder: discount.maximumPerOrder ?? 1,
            })
          }
        />
        {discount.maximumPerOrderEnabled && (
          <Field
            label={text(
              "Maximum uses per order",
              "Максимален брой използвания на поръчка",
            )}
          >
            <input
              type="number"
              min={1}
              max={999999}
              step={1}
              value={discount.maximumPerOrder ?? 1}
              onChange={(event) =>
                patch({ maximumPerOrder: Number(event.target.value) })
              }
            />
          </Field>
        )}
      </div>
    </section>
  );
}
