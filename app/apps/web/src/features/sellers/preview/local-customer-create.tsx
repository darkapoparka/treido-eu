"use client";
import { useState } from "react";
import { usePreview } from "./context";
import { put, type Customer } from "./model";
import { Button, Field, Modal, s } from "./ui";
import styles from "./local-customer-create.module.css";

const phoneCountries = [
  ["BG", "+359"],
  ["GR", "+30"],
  ["RO", "+40"],
  ["DE", "+49"],
  ["GB", "+44"],
] as const;
export function LocalCustomerCreate({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const { store, text, update, notify } = usePreview();
  const [value, setValue] = useState({
    first: "",
    last: "",
    email: "",
    phone: "",
    phoneCountry: "BG" as NonNullable<Customer["phoneCountry"]>,
  });
  const valid =
    !!value.first.trim() &&
    /^\S+@\S+\.\S+$/.test(value.email) &&
    (!value.phone || /^\+?[\d ()-]{5,40}$/.test(value.phone));
  const save = () => {
    if (!valid) return;
    const customer: Customer = {
      ...value,
      first: value.first.trim(),
      last: value.last.trim(),
      email: value.email.trim(),
      id: `customer-${crypto.randomUUID()}`,
      city: "",
      country: "",
      address: "",
      postcode: "",
      notes: "",
      tags: "",
      marketing: false,
    };
    update({ customers: put(store.customers, customer) });
    notify(
      text(
        "Customer saved in this preview. No customer account or marketing subscription was created.",
        "Клиентът е запазен в прегледа. Не е създаден клиентски акаунт или маркетингов абонамент.",
      ),
    );
    onSelect(customer.id);
  };
  return (
    <Modal
      title={text("Create a new customer", "Създаване на нов клиент")}
      surface="gift-card-customer"
      className={styles.modal}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{text("Cancel", "Отказ")}</Button>
          <Button primary disabled={!valid} onClick={save}>
            {text("Save locally", "Запазване локално")}
          </Button>
        </>
      }
    >
      <div className={styles.names}>
        <Field label={text("First Name", "Име")}>
          <input
            data-studio-autofocus
            aria-label={text("First Name", "Име")}
            maxLength={80}
            value={value.first}
            onChange={(event) =>
              setValue({ ...value, first: event.target.value })
            }
          />
        </Field>
        <Field label={text("Last Name", "Фамилия")}>
          <input
            aria-label={text("Last Name", "Фамилия")}
            maxLength={80}
            value={value.last}
            onChange={(event) =>
              setValue({ ...value, last: event.target.value })
            }
          />
        </Field>
      </div>
      <Field label={text("Email", "Имейл")}>
        <input
          type="email"
          aria-label={text("Email", "Имейл")}
          maxLength={180}
          value={value.email}
          onChange={(event) =>
            setValue({ ...value, email: event.target.value })
          }
        />
      </Field>
      <Field label={text("Phone number", "Телефонен номер")}>
        <div className={styles.phone}>
          <div className={styles.phoneCountry}>
            <span aria-hidden="true">{value.phoneCountry}</span>
            <select
              aria-label={text("Country code", "Код на държавата")}
              value={value.phoneCountry}
              onChange={(event) =>
                setValue({
                  ...value,
                  phoneCountry: event.target.value as typeof value.phoneCountry,
                })
              }
            >
              {phoneCountries.map(([code, prefix]) => (
                <option key={code} value={code}>
                  {code} {prefix}
                </option>
              ))}
            </select>
          </div>
          <input
            type="tel"
            aria-label={text("Phone number", "Телефонен номер")}
            maxLength={40}
            value={value.phone}
            onChange={(event) =>
              setValue({ ...value, phone: event.target.value })
            }
          />
        </div>
      </Field>
      {!valid && (value.email || value.phone) && (
        <p className={s.help}>
          {text(
            "Add a first name, a valid email, and a valid optional phone number.",
            "Добавете име, валиден имейл и валиден телефонен номер, ако е въведен.",
          )}
        </p>
      )}
    </Modal>
  );
}
