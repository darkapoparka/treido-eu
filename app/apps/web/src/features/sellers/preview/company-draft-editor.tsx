"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminIcon } from "../admin-icons";
import { usePreview } from "./context";
import { put, type Entry } from "./model";
import type { EditorDraft, CompanyAddress } from "./local-draft-model";
import { CompanyAddressFields } from "./company-address-fields";
import { customerName } from "./orders";
import {
  Action,
  Button,
  Check,
  EditorBreadcrumb,
  EditorSection,
  Field,
  Header,
  Modal,
  Panel,
  s,
} from "./ui";
import styles from "./local-draft-editors.module.css";

type CompanyDraft = Extract<EditorDraft, { kind: "Company" }>;
const emptyAddress: CompanyAddress = {
  country: "Bulgaria",
  address: "",
  city: "",
  postcode: "",
  phone: "",
};
export function LocalCompanyBuilder({ id }: { id: string }) {
  const { store, href, text, update, notify } = usePreview();
  const router = useRouter();
  const existing = store.entries.find(
    (entry) => entry.id === id && entry.type === "CompanyDraft",
  );
  const [name, setName] = useState(existing?.title ?? "");
  const [draft, setDraft] = useState<CompanyDraft>(
    existing?.editorDraft?.kind === "Company"
      ? existing.editorDraft
      : {
          kind: "Company",
          companyId: "",
          contactId: "",
          location: "",
          ...emptyAddress,
        },
  );
  const [dialog, setDialog] = useState<
    "contact" | "shipping" | "billing" | null
  >(null);
  const [addressDraft, setAddressDraft] =
    useState<CompanyAddress>(emptyAddress);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const patch = (values: Partial<CompanyDraft>) =>
    setDraft({ ...draft, ...values });
  const contact = store.customers.find(
    (customer) => customer.id === draft.contactId,
  );
  const addressPresent = !!(draft.address || draft.city || draft.postcode);
  if (id !== "new" && !existing)
    return (
      <main className={s.editor}>
        <Header
          title={text("Company not found", "Компанията не е намерена")}
          back={href("companies")}
        />
      </main>
    );
  const save = () => {
    if (!name.trim() || (draft.contactId && !contact)) {
      setError(
        text(
          "Add a company name and select an available local contact.",
          "Добавете име на компанията и изберете достъпен локален контакт.",
        ),
      );
      return;
    }
    const entry: Entry = {
      id: existing?.id ?? `company-${crypto.randomUUID()}`,
      title: name.trim(),
      body: "",
      status: "Draft",
      type: "CompanyDraft",
      tags: "",
      editorDraft: draft,
    };
    update({ entries: put(store.entries, entry) });
    notify(
      text(
        "Company draft saved locally. No business account or checkout rules are created.",
        "Черновата на компанията е запазена локално. Не е създаден бизнес акаунт или правила за поръчване.",
      ),
    );
    router.push(href(`companies/${entry.id}`));
  };
  const openAddress = (kind: "shipping" | "billing") => {
    setAddressDraft(
      kind === "billing"
        ? (draft.billing ?? emptyAddress)
        : {
            country: draft.country,
            address: draft.address,
            city: draft.city,
            postcode: draft.postcode,
            phone: draft.phone,
            first: draft.first ?? "",
            last: draft.last ?? "",
            attention: draft.attention ?? "",
            apartment: draft.apartment ?? "",
            phoneCountry: draft.phoneCountry ?? "BG",
          },
    );
    setDialog(kind);
  };
  return (
    <main
      className={`${s.editor} ${styles.centered}`}
      data-studio-part="editor"
      data-studio-builder="company"
    >
      <EditorBreadcrumb
        href={href("companies")}
        title={text("Companies", "Компании")}
        icon="customers"
      />
      <Header title={text("New company", "Нова компания")} />
      <Panel part="company-name">
        <Field
          label={text("Company name", "Име на компанията")}
          help={text(
            "Saved in this local draft for your review.",
            "Запазва се в тази локална чернова за вашия преглед.",
          )}
        >
          <input
            value={name}
            maxLength={160}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field
          label={text("Company ID", "Идентификатор на компанията")}
          help={text(
            "Add an existing external ID or a local reference.",
            "Добавете съществуващ външен идентификатор или локален запис.",
          )}
        >
          <input
            maxLength={300}
            value={draft.companyId}
            onChange={(event) => patch({ companyId: event.target.value })}
          />
        </Field>
      </Panel>
      <EditorSection
        title={text("Main contact", "Основен контакт")}
        part="company-contact"
      >
        <Button
          className={styles.contactSearch}
          aria-label={text(
            "Search local customer contacts",
            "Търсене на локални контакти на клиенти",
          )}
          onClick={() => {
            setQuery("");
            setDialog("contact");
          }}
        >
          <AdminIcon name="search" />
          {contact ? customerName(contact) : text("Search", "Търсене")}
        </Button>
      </EditorSection>
      <section data-studio-part="company-location">
        <h2>{text("Location", "Локация")}</h2>
        <p>
          {text(
            "Add a shipping location to this company draft. Address and settings are saved as local planning notes. You can review them before connecting business accounts.",
            "Добавете локация за доставка към черновата на компанията. Адресът и настройките се запазват като локални бележки. Можете да ги прегледате преди свързване на бизнес акаунти.",
          )}
        </p>
      </section>
      <Panel
        title={text("Shipping address", "Адрес за доставка")}
        part="company-address"
        action={
          <Button
            plain
            onClick={() =>
              patch({
                ...emptyAddress,
                first: "",
                last: "",
                attention: "",
                apartment: "",
              })
            }
          >
            {text("Clear", "Изчисти")}
          </Button>
        }
      >
        {addressPresent && (
          <p>
            {[
              draft.first,
              draft.last,
              draft.address,
              draft.city,
              draft.postcode,
              draft.country,
            ]
              .filter(Boolean)
              .join(", ")}
          </p>
        )}
        <Button
          className={styles.addAddress}
          onClick={() => openAddress("shipping")}
        >
          ⊕{" "}
          {text(
            addressPresent ? "Edit address" : "Add address",
            addressPresent ? "Редактиране на адрес" : "Добавяне на адрес",
          )}
          <AdminIcon name="chevron" />
        </Button>
        <Check
          label={text(
            "Billing address same as shipping address",
            "Адресът за фактуриране е същият като за доставка",
          )}
          checked={draft.billingSame !== false}
          onChange={() => patch({ billingSame: draft.billingSame === false })}
        />
        {draft.billingSame === false && (
          <Button onClick={() => openAddress("billing")}>
            {text(
              draft.billing ? "Edit billing address" : "Add billing address",
              draft.billing
                ? "Редактиране на адреса за фактуриране"
                : "Добавяне на адрес за фактуриране",
            )}
          </Button>
        )}
        <Field
          label={text("Location ID", "Идентификатор на локацията")}
          help={text(
            "Add an existing external ID or a local reference.",
            "Добавете съществуващ външен идентификатор или локален запис.",
          )}
        >
          <input
            maxLength={300}
            value={draft.location}
            onChange={(event) => patch({ location: event.target.value })}
          />
        </Field>
      </Panel>
      <EditorSection title={text("Markets", "Пазари")} part="company-markets">
        <Action plain href={href("markets")}>
          {text("Review local markets", "Преглед на локалните пазари")}
        </Action>
      </EditorSection>
      <EditorSection
        title={text("Catalogs", "Каталози")}
        part="company-catalogs"
      >
        <p>
          {text(
            "No connected company catalogs. Review your local products and markets.",
            "Няма свързани каталози за компании. Прегледайте локалните продукти и пазари.",
          )}
        </p>
      </EditorSection>
      <EditorSection
        title={text("Payment terms", "Условия за плащане")}
        part="company-payment"
      >
        <select
          value={draft.paymentTerms ?? "None"}
          aria-label={text(
            "Planned payment terms",
            "Планирани условия за плащане",
          )}
          onChange={(event) => patch({ paymentTerms: event.target.value })}
        >
          {[
            ["None", "No payment terms", "Без условия за плащане"],
            ["Fulfillment", "Due on fulfillment", "Дължимо при изпълнение"],
            ...[7, 15, 30, 45, 60, 90].map((day) => [
              String(day),
              `Net ${day}`,
              `${day} дни`,
            ]),
          ].map(([value, en, bg]) => (
            <option key={value} value={value}>
              {text(en, bg)}
            </option>
          ))}
        </select>
      </EditorSection>
      <EditorSection
        title={text("Checkout", "Поръчване")}
        part="company-checkout"
      >
        <strong>{text("Ship to address", "Доставка до адрес")}</strong>
        <Check
          label={text(
            "Allow a one-time shipping address",
            "Разрешаване на еднократен адрес за доставка",
          )}
          checked={!!draft.oneTimeAddress}
          onChange={() => patch({ oneTimeAddress: !draft.oneTimeAddress })}
        />
        <strong>{text("Order submission", "Подаване на поръчки")}</strong>
        <Check
          radio
          name="company-review"
          label={text(
            "Automatically submit orders",
            "Автоматично подаване на поръчки",
          )}
          checked={!draft.reviewOrders}
          onChange={() => patch({ reviewOrders: false })}
        />
        <Check
          radio
          name="company-review"
          label={text(
            "Submit all orders as drafts for review",
            "Всички поръчки като чернови за преглед",
          )}
          checked={!!draft.reviewOrders}
          onChange={() => patch({ reviewOrders: true })}
        />
      </EditorSection>
      <EditorSection
        title={text("Tax details", "Данъчни данни")}
        part="company-tax"
      >
        <Field label={text("Tax ID", "Данъчен идентификатор")}>
          <input
            maxLength={300}
            value={draft.taxId ?? ""}
            onChange={(event) => patch({ taxId: event.target.value })}
          />
        </Field>
        <Field label={text("Tax settings", "Данъчни настройки")}>
          <select
            value={draft.taxSetting ?? "Collect"}
            onChange={(event) => patch({ taxSetting: event.target.value })}
          >
            {[
              ["Collect", "Collect tax", "Начисляване на данък"],
              [
                "Exemptions",
                "Collect tax unless exemptions apply",
                "Начисляване на данък освен при освобождаване",
              ],
              [
                "Do not collect",
                "Do not collect tax",
                "Без начисляване на данък",
              ],
            ].map(([value, en, bg]) => (
              <option key={value} value={value}>
                {text(en, bg)}
              </option>
            ))}
          </select>
        </Field>
      </EditorSection>
      <p className={s.help}>
        {text(
          "Local planning notes only. No accounts, permissions, credit, checkout or tax rules are applied.",
          "Само локални бележки. Не се прилагат акаунти, разрешения, кредит, поръчване или данъчни правила.",
        )}
      </p>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      <div className={s.saveBar} data-studio-part="save-bar">
        <Action href={href("companies")}>{text("Cancel", "Отказ")}</Action>
        <Button primary onClick={save}>
          {text("Save draft", "Запазване на чернова")}
        </Button>
      </div>
      {dialog && (
        <Modal
          title={
            dialog === "contact"
              ? text("Select customer", "Избор на клиент")
              : dialog === "shipping"
                ? text("Add shipping address", "Добавяне на адрес за доставка")
                : text(
                    "Add billing address",
                    "Добавяне на адрес за фактуриране",
                  )
          }
          surface={`company-${dialog}`}
          onClose={() => setDialog(null)}
          footer={
            <>
              <Button onClick={() => setDialog(null)}>
                {text("Cancel", "Отказ")}
              </Button>
              {dialog !== "contact" && (
                <Button
                  primary
                  onClick={() => {
                    if (dialog === "shipping") patch(addressDraft);
                    else patch({ billing: addressDraft });
                    setDialog(null);
                  }}
                >
                  {text("Done", "Готово")}
                </Button>
              )}
            </>
          }
        >
          {dialog === "contact" ? (
            <>
              <Field label={text("Search customers", "Търсене на клиенти")}>
                <input
                  type="search"
                  maxLength={160}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  data-studio-autofocus
                />
              </Field>
              {store.customers
                .filter((customer) =>
                  `${customerName(customer)} ${customer.email}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((customer) => (
                  <Button
                    key={customer.id}
                    onClick={() => {
                      patch({ contactId: customer.id });
                      setDialog(null);
                    }}
                  >
                    {customerName(customer)} · {customer.email}
                  </Button>
                ))}
            </>
          ) : (
            <CompanyAddressFields
              address={addressDraft}
              onChange={setAddressDraft}
            />
          )}
        </Modal>
      )}
    </main>
  );
}
