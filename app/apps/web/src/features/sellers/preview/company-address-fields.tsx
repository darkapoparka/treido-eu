"use client";
import { usePreview } from "./context";
import type { CompanyAddress } from "./local-draft-model";
import { Field, s } from "./ui";
import styles from "./local-draft-editors.module.css";

export function CompanyAddressFields({
  address,
  onChange,
}: {
  address: CompanyAddress;
  onChange: (address: CompanyAddress) => void;
}) {
  const { text } = usePreview();
  const patch = (values: Partial<CompanyAddress>) =>
    onChange({ ...address, ...values });
  return (
    <div className={s.stack} data-studio-part="company-address-fields">
      <Field label={text("Country/region", "Държава/регион")}>
        <select
          value={address.country}
          onChange={(event) => patch({ country: event.target.value })}
        >
          {["Bulgaria", "Greece", "Romania", "Germany", "United Kingdom"].map(
            (country, index) => (
              <option key={country} value={country}>
                {text(
                  country,
                  [
                    "България",
                    "Гърция",
                    "Румъния",
                    "Германия",
                    "Обединено кралство",
                  ][index],
                )}
              </option>
            ),
          )}
        </select>
      </Field>
      <div
        className={styles.addressNameRow}
        data-studio-part="company-name-row"
      >
        <Field label={text("First name", "Име")}>
          <input
            value={address.first ?? ""}
            maxLength={300}
            onChange={(event) => patch({ first: event.target.value })}
          />
        </Field>
        <Field label={text("Last name", "Фамилия")}>
          <input
            value={address.last ?? ""}
            maxLength={300}
            onChange={(event) => patch({ last: event.target.value })}
          />
        </Field>
      </div>
      {[
        ["attention", "Company/attention", "Компания/получател"],
        ["address", "Address", "Адрес"],
        ["apartment", "Apartment, suite, etc", "Апартамент, офис и др."],
      ].map(([key, en, bg]) => (
        <Field key={key} label={text(en, bg)}>
          <input
            value={address[key as keyof CompanyAddress] ?? ""}
            maxLength={300}
            onChange={(event) => patch({ [key]: event.target.value })}
          />
        </Field>
      ))}
      <div
        className={styles.addressPostalRow}
        data-studio-part="company-postal-row"
      >
        {[
          ["postcode", "Postal code", "Пощенски код"],
          ["city", "City", "Град"],
        ].map(([key, en, bg]) => (
          <Field key={key} label={text(en, bg)}>
            <input
              value={address[key as keyof CompanyAddress] ?? ""}
              maxLength={300}
              onChange={(event) => patch({ [key]: event.target.value })}
            />
          </Field>
        ))}
      </div>
      <Field label={text("Phone", "Телефон")}>
        <div
          className={styles.addressPhoneRow}
          data-studio-part="company-phone-row"
        >
          <div className={styles.phoneCountry}>
            <span aria-hidden="true">{address.phoneCountry ?? "BG"}</span>
            <select
              value={address.phoneCountry ?? "BG"}
              aria-label={text(
                "Phone country code",
                "Код на държавата за телефона",
              )}
              onChange={(event) =>
                patch({
                  phoneCountry: event.target
                    .value as CompanyAddress["phoneCountry"],
                })
              }
            >
              {[
                ["BG", "+359"],
                ["GR", "+30"],
                ["RO", "+40"],
                ["DE", "+49"],
                ["GB", "+44"],
              ].map(([code, prefix]) => (
                <option key={code} value={code}>
                  {code} {prefix}
                </option>
              ))}
            </select>
          </div>
          <input
            type="tel"
            aria-label={text("Phone", "Телефон")}
            value={address.phone}
            maxLength={300}
            onChange={(event) => patch({ phone: event.target.value })}
          />
        </div>
      </Field>
    </div>
  );
}
