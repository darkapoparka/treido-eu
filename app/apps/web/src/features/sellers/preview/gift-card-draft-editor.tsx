"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminIcon } from "../admin-icons";
import { usePreview } from "./context";
import { currentDraftDateTime } from "./draft-date-fields";
import { GiftCardExpiryPicker } from "./gift-card-expiry-picker";
import { DraftEditorActions } from "./draft-editor-actions";
import { LocalCustomerCreate } from "./local-customer-create";
import {
  validProcurementDraft,
  type GiftCardDraft,
} from "./procurement-draft-model";
import { parseMoney, put, type Entry } from "./model";
import {
  Action,
  Button,
  EditorBreadcrumb,
  EditorSection,
  Field,
  Header,
  Modal,
  s,
} from "./ui";
import styles from "./procurement-drafts.module.css";

export function GiftCardDraftEditor({ id }: { id: string }) {
  const { store, text, href, language, update, notify } = usePreview();
  const router = useRouter();
  const existing = store.entries.find(
    (entry) => entry.id === id && entry.type === "GiftCardDraft",
  );
  const [draft, setDraft] = useState<GiftCardDraft>(() =>
    existing?.editorDraft?.kind === "GiftCard"
      ? existing.editorDraft
      : {
          kind: "GiftCard",
          code: `DRAFT-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`,
          value: 1000,
          expiry: "",
          customerId: "",
          notes: "",
        },
  );
  const [amount, setAmount] = useState(() => (draft.value / 100).toFixed(2));
  const [expiry, setExpiry] = useState<{ top: number; left: number }>();
  const [notes, setNotes] = useState<string>();
  const [query, setQuery] = useState("");
  const [customersOpen, setCustomersOpen] = useState(false);
  const [customerCreate, setCustomerCreate] = useState(false);
  const customerInput = useRef<HTMLInputElement>(null);
  const returnCustomerFocus = useRef(false);
  useLayoutEffect(() => {
    if (!customerCreate && returnCustomerFocus.current) {
      returnCustomerFocus.current = false;
      customerInput.current?.focus({ preventScroll: true });
    }
  }, [customerCreate]);
  const [error, setError] = useState("");
  const [initial] = useState(() => ({ draft, amount }));
  const dirty =
    id === "new" ||
    JSON.stringify({ draft, amount }) !== JSON.stringify(initial);
  const selected = store.customers.find(
    (customer) => customer.id === draft.customerId,
  );
  if (id !== "new" && !existing)
    return (
      <main className={s.editor}>
        <Header
          title={text("Draft not found", "Черновата не е намерена")}
          back={href("gift-cards")}
        />
      </main>
    );
  const save = () => {
    if (
      !validProcurementDraft(draft) ||
      (draft.expiry && draft.expiry < currentDraftDateTime().date) ||
      (draft.customerId && !selected)
    ) {
      setError(
        text(
          "Enter a valid local draft code, positive EUR amount, and future expiry date. Review the selected local customer.",
          "Въведете валиден код на чернова, положителна сума в EUR и бъдеща крайна дата. Проверете избрания локален клиент.",
        ),
      );
      return;
    }
    const saved: Entry = {
      id: existing?.id ?? `gift-card-${crypto.randomUUID()}`,
      title: `${text("Gift card draft", "Чернова на подаръчна карта")} · ${draft.code.slice(-4)}`,
      type: "GiftCardDraft",
      status: "Draft",
      body: draft.notes,
      tags: "",
      editorDraft: draft,
    };
    update({ entries: put(store.entries, saved) });
    notify(
      text(
        "Local draft saved. No gift card was issued, funded, or sent.",
        "Локалната чернова е запазена. Няма издадена, финансирана или изпратена подаръчна карта.",
      ),
    );
    router.push(href(`gift-cards/${saved.id}`));
  };
  return (
    <main
      className={`${s.editor} ${styles.giftCard}`}
      data-studio-part="editor"
      data-studio-builder="gift-card"
    >
      <DraftEditorActions
        dirty={dirty}
        onSave={save}
        onDiscard={() => {
          if (id === "new") {
            router.push(href("gift-cards"));
            return;
          }
          setDraft(initial.draft);
          setAmount(initial.amount);
          setError("");
        }}
      />
      <EditorBreadcrumb
        href={href("gift-cards")}
        title={text("Gift cards", "Подаръчни карти")}
        icon="discount"
      />
      <Header
        title={text("Create gift card", "Създаване на подаръчна карта")}
      />
      <div className={s.editorColumns} data-studio-part="editor-layout">
        <div className={s.stack} data-studio-part="editor-main">
          <EditorSection
            title={text(
              "Gift card details",
              "Подробности за подаръчната карта",
            )}
            part="gift-card-details"
          >
            <Field label={text("Gift card code", "Код на подаръчната карта")}>
              <input
                maxLength={32}
                value={draft.code}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    code: event.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9-]/g, ""),
                  })
                }
              />
            </Field>
            <Field label={text("Initial value", "Начална стойност")}>
              <div className={styles.currencyInput}>
                <span aria-hidden="true">€</span>
                <input
                  aria-label={text("Initial value EUR", "Начална стойност EUR")}
                  inputMode="decimal"
                  maxLength={12}
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value);
                    setDraft({
                      ...draft,
                      value: parseMoney(event.target.value) ?? -1,
                    });
                  }}
                />
              </div>
            </Field>
            <Field label={text("Expiry date", "Дата на изтичане")}>
              <Button
                plain
                className={styles.giftExpiry}
                aria-expanded={!!expiry}
                aria-haspopup="dialog"
                aria-label={
                  draft.expiry
                    ? text("Edit expiry date", "Промяна на крайната дата")
                    : text("Doesn't expire", "Без срок")
                }
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  setExpiry({
                    top: Math.max(
                      16,
                      Math.min(rect.bottom + 4, window.innerHeight - 420),
                    ),
                    left: Math.max(
                      16,
                      Math.min(rect.left, window.innerWidth - 306),
                    ),
                  });
                }}
              >
                <AdminIcon name="calendar" />
                {draft.expiry
                  ? new Intl.DateTimeFormat(
                      language === "bg" ? "bg-BG" : "en-US",
                      { dateStyle: "long", timeZone: "UTC" },
                    ).format(new Date(`${draft.expiry}T12:00:00Z`))
                  : text("Doesn't expire", "Без срок")}
              </Button>
            </Field>
            <p
              className={s.help}
              data-studio-part="draft-boundary"
              title={text(
                "Issuance, balances, and delivery require a verified stored-value adapter.",
                "Издаването, балансите и изпращането изискват потвърден адаптер за парична стойност.",
              )}
            >
              {text(
                "Local draft · Cannot be redeemed",
                "Локална чернова · Не може да се използва",
              )}
            </p>
          </EditorSection>
        </div>
        <aside className={s.editorSide} data-studio-part="editor-side">
          <div
            className={styles.giftCustomer}
            data-studio-part="gift-card-customer"
          >
            <h2>{text("Customer", "Клиент")}</h2>
            <div className={styles.customerSearch}>
              <AdminIcon name="search" />
              <Field
                label={text(
                  "Search or create customer",
                  "Търсене или създаване на клиент",
                )}
              >
                <input
                  ref={customerInput}
                  role="combobox"
                  aria-expanded={customersOpen}
                  aria-controls="gift-card-customer-options"
                  type="search"
                  maxLength={160}
                  placeholder={text(
                    "Search or create customer",
                    "Търсене или създаване на клиент",
                  )}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setCustomersOpen(true);
                  }}
                  onFocus={() => setCustomersOpen(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.stopPropagation();
                      setCustomersOpen(false);
                    }
                  }}
                />
              </Field>
            </div>
            {selected && (
              <div className={s.dataRow}>
                <span>
                  {selected.first} {selected.last}
                </span>
                <Button
                  plain
                  aria-label={text("Remove customer", "Премахване на клиент")}
                  onClick={() => setDraft({ ...draft, customerId: "" })}
                >
                  ×
                </Button>
              </div>
            )}
            {customersOpen && (
              <div
                id="gift-card-customer-options"
                role="listbox"
                aria-label={text("Local customers", "Локални клиенти")}
              >
                {store.customers
                  .filter((customer) =>
                    `${customer.first} ${customer.last} ${customer.email}`
                      .toLocaleLowerCase()
                      .includes(query.trim().toLocaleLowerCase()),
                  )
                  .slice(0, 50)
                  .map((customer) => (
                    <Button
                      plain
                      role="option"
                      aria-selected={draft.customerId === customer.id}
                      key={customer.id}
                      onClick={() => {
                        setDraft({ ...draft, customerId: customer.id });
                        setCustomersOpen(false);
                        setQuery("");
                      }}
                    >
                      {customer.first} {customer.last}
                    </Button>
                  ))}
                <Button
                  onClick={() => {
                    setCustomerCreate(true);
                    setCustomersOpen(false);
                  }}
                >
                  {text("Create a new customer", "Създаване на нов клиент")}
                </Button>
              </div>
            )}
          </div>
          <EditorSection
            title={text("Notes", "Бележки")}
            part="gift-card-notes"
            action={
              <Button
                plain
                aria-label={text("Edit notes", "Редактиране на бележки")}
                onClick={() => setNotes(draft.notes)}
              >
                <AdminIcon name="edit" />
              </Button>
            }
          >
            <p className={styles.notes}>
              {draft.notes || text("No notes", "Няма бележки")}
            </p>
          </EditorSection>
        </aside>
      </div>
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      <div className={s.saveBar} data-studio-part="save-bar">
        <Action href={href("gift-cards")}>{text("Cancel", "Отказ")}</Action>
        <Button primary onClick={save}>
          {text("Save draft", "Запазване на чернова")}
        </Button>
      </div>
      {expiry && (
        <GiftCardExpiryPicker
          value={draft.expiry}
          anchor={expiry}
          onClose={() => setExpiry(undefined)}
          onApply={(date) => {
            setDraft({ ...draft, expiry: date });
            setExpiry(undefined);
          }}
        />
      )}
      {notes !== undefined && (
        <Modal
          title={text("Add note", "Добавяне на бележка")}
          surface="gift-card-notes"
          className={styles.giftNotesModal}
          onClose={() => setNotes(undefined)}
          footer={
            <>
              <Button onClick={() => setNotes(undefined)}>
                {text("Cancel", "Отказ")}
              </Button>
              <Button
                primary
                disabled={notes === draft.notes}
                onClick={() => {
                  setDraft({ ...draft, notes });
                  setNotes(undefined);
                }}
              >
                {text("Done", "Готово")}
              </Button>
            </>
          }
        >
          <Field label={text("Notes", "Бележки")}>
            <div className={`${styles.countedInput} ${styles.countedNotes}`}>
              <textarea
                aria-label={text("Notes", "Бележки")}
                maxLength={5000}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
              <span aria-hidden="true">{notes.length}/5000</span>
            </div>
          </Field>
        </Modal>
      )}
      {customerCreate && (
        <LocalCustomerCreate
          onClose={() => {
            returnCustomerFocus.current = true;
            setCustomerCreate(false);
          }}
          onSelect={(customerId) => {
            setDraft({ ...draft, customerId });
            returnCustomerFocus.current = true;
            setCustomerCreate(false);
            setQuery("");
          }}
        />
      )}
    </main>
  );
}
