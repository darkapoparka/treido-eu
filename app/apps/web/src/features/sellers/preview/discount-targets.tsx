"use client";
import { useState } from "react";
import { AdminIcon } from "../admin-icons";
import { countryName, countryOptions } from "../../locale/regions";
import { usePreview } from "./context";
import { money, parseMoney, type Discount } from "./model";
import { DiscountItemPicker } from "./discount-item-picker";
import { Button, Check, EditorSection, Field, Modal, s } from "./ui";

export function DiscountTargets({
  discount,
  patch,
}: {
  discount: Discount;
  patch: (value: Partial<Discount>) => void;
}) {
  const { store, text } = usePreview();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const kind = discount.targetKind ?? "Collections";
  const selected = discount.targetIds ?? [];
  const items = kind === "Products" ? store.products : store.collections;
  return (
    <>
      <Field label={text("Applies to", "Прилага се за")}>
        <select
          value={kind}
          onChange={(event) =>
            patch({
              targetKind: event.target.value as "Products" | "Collections",
              targetIds: [],
            })
          }
        >
          <option value="Collections">
            {text("Specific collections", "Конкретни колекции")}
          </option>
          <option value="Products">
            {text("Specific products", "Конкретни продукти")}
          </option>
        </select>
      </Field>
      <div data-studio-part="discount-item-search">
        <AdminIcon name="search" />
        <input
          type="search"
          maxLength={160}
          aria-label={
            kind === "Products"
              ? text("Search products", "Търсене на продукти")
              : text("Search collections", "Търсене на колекции")
          }
          placeholder={text("Search", "Търсене")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              setOpen(true);
            }
          }}
        />
        <Button onClick={() => setOpen(true)}>
          {text("Browse", "Преглед")}
        </Button>
      </div>
      {selected.map((id) => (
        <div className={s.dataRow} key={id}>
          <span>
            {items.find((item) => item.id === id)?.title ??
              text("Unavailable local item", "Недостъпен локален артикул")}
          </span>
          <Button
            plain
            aria-label={text("Remove item", "Премахване на артикул")}
            onClick={() =>
              patch({ targetIds: selected.filter((value) => value !== id) })
            }
          >
            <AdminIcon name="close" />
          </Button>
        </div>
      ))}
      {open && (
        <DiscountItemPicker
          kind={kind}
          selected={selected}
          query={query}
          onClose={() => setOpen(false)}
          onApply={(targetIds) => {
            patch({ targetIds, targetKind: kind });
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

export function DiscountShippingCountries({
  discount,
  patch,
}: {
  discount: Discount;
  patch: (value: Partial<Discount>) => void;
}) {
  const { text, language } = usePreview();
  const [picker, setPicker] = useState<string[]>();
  const [query, setQuery] = useState("");
  const [rate, setRate] = useState(() =>
    ((discount.maximumShippingRate ?? 0) / 100).toFixed(2),
  );
  const selected = discount.countryCodes ?? [];
  return (
    <EditorSection
      title={text("Countries", "Държави")}
      part="discount-countries"
    >
      <Check
        radio
        name="discount-countries"
        label={text("All countries", "Всички държави")}
        checked={discount.countriesMode !== "Selected"}
        onChange={() => patch({ countriesMode: "All" })}
      />
      <Check
        radio
        name="discount-countries"
        label={text("Selected countries", "Избрани държави")}
        checked={discount.countriesMode === "Selected"}
        onChange={() => patch({ countriesMode: "Selected" })}
      />
      {discount.countriesMode === "Selected" && (
        <>
          <Button
            onClick={() => {
              setPicker([...selected]);
              setQuery("");
            }}
          >
            {text("Add countries", "Добавяне на държави")}
          </Button>
          {selected.map((code) => (
            <div className={s.dataRow} key={code}>
              <span>{countryName(code, language)}</span>
              <Button
                plain
                aria-label={text(
                  `Remove ${countryName(code, language)}`,
                  `Премахване на ${countryName(code, language)}`,
                )}
                onClick={() =>
                  patch({
                    countryCodes: selected.filter((value) => value !== code),
                  })
                }
              >
                <AdminIcon name="close" />
              </Button>
            </div>
          ))}
        </>
      )}
      <h3>{text("Shipping rates", "Цени за доставка")}</h3>
      <Check
        label={text(
          "Exclude shipping rates over a certain amount",
          "Изключване на доставки над определена сума",
        )}
        checked={!!discount.excludeShippingRate}
        onChange={() =>
          patch({ excludeShippingRate: !discount.excludeShippingRate })
        }
      />
      {discount.excludeShippingRate && (
        <Field
          label={text(
            "Exclude shipping rates over EUR",
            "Изключване на доставки над EUR",
          )}
        >
          <input
            inputMode="decimal"
            maxLength={12}
            value={rate}
            onChange={(event) => {
              setRate(event.target.value);
              patch({
                maximumShippingRate: parseMoney(event.target.value) ?? -1,
              });
            }}
          />
          {parseMoney(rate) === null && (
            <span role="alert">
              {text("Enter a valid amount", "Въведете валидна сума")}
            </span>
          )}
        </Field>
      )}
      {picker && (
        <Modal
          title={text("Add countries", "Добавяне на държави")}
          surface="discount-countries"
          onClose={() => setPicker(undefined)}
          footer={
            <>
              <Button onClick={() => setPicker(undefined)}>
                {text("Cancel", "Отказ")}
              </Button>
              <Button
                primary
                disabled={!picker.length}
                onClick={() => {
                  patch({ countryCodes: picker });
                  setPicker(undefined);
                }}
              >
                {text("Add", "Добавяне")}
              </Button>
            </>
          }
        >
          <Field label={text("Search countries", "Търсене на държави")}>
            <input
              data-studio-autofocus
              type="search"
              maxLength={160}
              placeholder={text("Search countries", "Търсене на държави")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </Field>
          <div data-studio-part="discount-country-options">
            {countryOptions(language)
              .filter((region) =>
                region.name
                  .toLocaleLowerCase()
                  .includes(query.trim().toLocaleLowerCase()),
              )
              .map((region) => (
                <div className={s.dataRow} key={region.code}>
                  <Check
                    label={region.name}
                    checked={picker.includes(region.code)}
                    onChange={() =>
                      setPicker(
                        picker.includes(region.code)
                          ? picker.filter((code) => code !== region.code)
                          : [...picker, region.code],
                      )
                    }
                  />
                </div>
              ))}
          </div>
          <p className={s.help}>
            {text(
              "Local country planning; no shipping settings are changed.",
              "Локално планиране на държави; настройките за доставка не се променят.",
            )}
          </p>
        </Modal>
      )}
      {discount.excludeShippingRate && parseMoney(rate) !== null && (
        <p className={s.help}>{money(parseMoney(rate) ?? 0, language)}</p>
      )}
    </EditorSection>
  );
}
