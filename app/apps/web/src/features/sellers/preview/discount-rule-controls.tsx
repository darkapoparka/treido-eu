"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { usePreview } from "./context";
import { type Discount } from "./model";
import { Button, Check, EditorSection, Field, s } from "./ui";
import styles from "./discount-planning.module.css";

type Props = { discount: Discount; patch: (values: Partial<Discount>) => void };
export function DiscountLimits({ discount, patch }: Props) {
  const { text } = usePreview();
  const enabled = discount.limitEnabled ?? discount.limit > 0;
  return (
    <EditorSection
      title={text("Maximum discount uses", "Максимални използвания")}
      part="discount-limits"
    >
      <Check
        label={text(
          "Limit number of times this discount can be used in total",
          "Ограничаване на общия брой използвания на отстъпката",
        )}
        checked={enabled}
        onChange={() =>
          patch({ limitEnabled: !enabled, limit: enabled ? 0 : discount.limit })
        }
      />
      {enabled && (
        <Field label={text("Total usage limit", "Общ лимит на използванията")}>
          <input
            type="number"
            min={1}
            max={999999}
            value={discount.limit || ""}
            onChange={(event) => patch({ limit: Number(event.target.value) })}
          />
        </Field>
      )}
      <Check
        label={text(
          "Limit to one use per customer",
          "Ограничаване до едно използване на клиент",
        )}
        checked={discount.once}
        onChange={() => patch({ once: !discount.once })}
      />
    </EditorSection>
  );
}

export function DiscountCombinations({ discount, patch }: Props) {
  const { text } = usePreview();
  const [anchor, setAnchor] = useState<{ top: number; left: number }>();
  const values = discount.combinations ?? {
    product: discount.combines,
    order: discount.combines,
    shipping: discount.combines,
  };
  return (
    <EditorSection
      title={text("Combinations", "Комбиниране")}
      part="discount-combinations"
      action={
        <Button
          plain
          aria-label={text("Edit combinations", "Редактиране на комбинации")}
          aria-expanded={!!anchor}
          onClick={(event) => {
            const r = event.currentTarget.getBoundingClientRect();
            setAnchor({
              top: Math.min(r.bottom + 4, window.innerHeight - 230),
              left: Math.max(
                16,
                Math.min(r.right - 350, window.innerWidth - 366),
              ),
            });
          }}
        >
          ⊕
        </Button>
      }
    >
      <p className={styles.combinationText}>
        {Object.values(values).some(Boolean)
          ? text(
              "Can combine with selected product, order, or shipping discounts.",
              "Може да се комбинира с избраните отстъпки за продукти, поръчки или доставка.",
            )
          : text(
              "This discount won't combine with other product, order, or shipping discounts in the customer's cart.",
              "Тази отстъпка няма да се комбинира с други отстъпки за продукти, поръчки или доставка в количката.",
            )}
      </p>
      {anchor && (
        <CombinationPicker
          anchor={anchor}
          onClose={() => setAnchor(undefined)}
          values={values}
          onChange={(key) => {
            const combinations = { ...values, [key]: !values[key] };
            patch({
              combinations,
              combines: Object.values(combinations).some(Boolean),
            });
          }}
        />
      )}
    </EditorSection>
  );
}

function CombinationPicker({
  anchor,
  values,
  onChange,
  onClose,
}: {
  anchor: { top: number; left: number };
  values: NonNullable<Discount["combinations"]>;
  onChange: (key: keyof NonNullable<Discount["combinations"]>) => void;
  onClose: () => void;
}) {
  const { text } = usePreview();
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = ref.current,
      opener = document.activeElement as HTMLElement | null;
    node?.showPopover();
    return () => {
      node?.hidePopover();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  return (
    <div
      ref={ref}
      popover="auto"
      role="dialog"
      aria-label={text(
        "Allow this discount to combine with other discounts",
        "Разрешаване на комбиниране с други отстъпки",
      )}
      data-studio-part="discount-combination-picker"
      className={styles.combinationPicker}
      style={anchor}
      onToggle={(event) => {
        if (event.newState === "closed") onClose();
      }}
    >
      <h3>
        {text(
          "Allow this discount to combine with other discounts",
          "Разрешаване на комбиниране с други отстъпки",
        )}
      </h3>
      {(
        [
          ["product", "Product discounts", "Отстъпки за продукти"],
          ["order", "Order discounts", "Отстъпки за поръчки"],
          ["shipping", "Shipping discounts", "Отстъпки за доставка"],
        ] as const
      ).map(([key, en, bg]) => (
        <div key={key}>
          <Check
            label={text(en, bg)}
            checked={values[key]}
            onChange={() => onChange(key)}
          />
          <p className={s.help}>
            {key === "shipping"
              ? text(
                  "Only one can apply per order (best value wins)",
                  "Само една за поръчка (най-добрата стойност)",
                )
              : text(
                  "Multiple can apply per order",
                  "Може да се приложат няколко за поръчка",
                )}
          </p>
        </div>
      ))}
    </div>
  );
}

export function DiscountSummary({ discount, patch }: Props) {
  const { text } = usePreview();
  const canCombine = discount.combinations
    ? Object.values(discount.combinations).some(Boolean)
    : discount.combines;
  return (
    <>
      <div data-studio-panel="discount-summary" className={styles.summary}>
        <div>
          <strong>
            {(discount.method === "Discount code"
              ? discount.code
              : discount.title) ||
              text("No discount code yet", "Все още няма код")}
          </strong>
          <p>
            {discount.method === "Discount code"
              ? text("Code", "Код")
              : text("Automatic", "Автоматична")}
          </p>
        </div>
        <section>
          <h3>{text("Type", "Тип")}</h3>
          <p>
            {discount.type === "Free shipping"
              ? text("Free shipping", "Безплатна доставка")
              : discount.type === "Amount off products"
                ? text("Amount off products", "Отстъпка за продукти")
                : discount.type === "Buy X get Y"
                  ? text("Buy X get Y", "Купи X, получи Y")
                  : text("Amount off order", "Отстъпка за поръчка")}
          </p>
        </section>
        <section>
          <h3>{text("Details", "Подробности")}</h3>
          <ul>
            <li>{text("Local draft", "Локална чернова")}</li>
            <li>
              {discount.eligibility === "All customers"
                ? text("All customers", "Всички клиенти")
                : text("Selected eligibility", "Избрани условия")}
            </li>
            <li>
              {discount.type === "Free shipping" &&
              discount.countriesMode === "Selected"
                ? text(
                    `${discount.countryCodes?.length ?? 0} selected countries`,
                    `${discount.countryCodes?.length ?? 0} избрани държави`,
                  )
                : discount.type === "Free shipping"
                  ? text("For all countries", "За всички държави")
                  : discount.minimumKind === "None"
                    ? text(
                        "No minimum purchase requirement",
                        "Без минимална покупка",
                      )
                    : text(
                        "Minimum purchase requirement",
                        "Условие за минимална покупка",
                      )}
            </li>
            <li>
              {discount.limit
                ? text(
                    `${discount.limit} total uses`,
                    `${discount.limit} използвания общо`,
                  )
                : text("No usage limits", "Без лимит на използванията")}
            </li>
            <li>
              {canCombine
                ? text(
                    "Can combine with selected discounts",
                    "Комбинира се с избрани отстъпки",
                  )
                : text(
                    "Can't combine with other discounts",
                    "Не се комбинира с други отстъпки",
                  )}
            </li>
            <li>
              {text("Planned start", "Планирано начало")}: {discount.start}
            </li>
          </ul>
        </section>
      </div>
      <EditorSection title={text("Tags", "Тагове")} part="discount-tags">
        <Field label={text("Tags", "Тагове")}>
          <input
            maxLength={500}
            value={discount.tags ?? ""}
            onChange={(event) => patch({ tags: event.target.value })}
          />
        </Field>
      </EditorSection>
      <p className={s.help} data-studio-part="draft-boundary">
        {text(
          "Local planning only. Checkout, usage limits, channel delivery, and automatic scheduling require connected adapters.",
          "Само локално планиране. Поръчването, лимитите, каналите и автоматичното планиране изискват свързани адаптери.",
        )}
      </p>
    </>
  );
}
