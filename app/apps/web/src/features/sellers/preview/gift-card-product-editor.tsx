"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminIcon } from "../admin-icons";
import { usePreview } from "./context";
import { DraftEditorActions } from "./draft-editor-actions";
import { DiscountItemPicker } from "./discount-item-picker";
import { MediaLibrary } from "./media-library";
import { ProductRichEditor } from "./product-rich-editor";
import {
  validGiftCardProductDraft,
  type GiftCardProductDraft,
} from "./gift-card-product-model";
import { parseMoney, put, type Entry } from "./model";
import {
  Action,
  Button,
  EditorBreadcrumb,
  EditorSection,
  Field,
  Header,
  Modal,
  Panel,
  s,
} from "./ui";
import styles from "./gift-card-product-editor.module.css";

export function GiftCardProductEditor({ id }: { id: string }) {
  const { store, text, href, update, notify } = usePreview();
  const router = useRouter();
  const existing = store.entries.find(
    (e) => e.id === id && e.type === "GiftCardProductDraft",
  );
  const [entry, setEntry] = useState<Entry>(
    existing ?? {
      id: "new",
      title: "",
      type: "GiftCardProductDraft",
      status: "Draft",
      body: "",
      tags: "",
    },
  );
  const [draft, setDraft] = useState<GiftCardProductDraft>(
    existing?.editorDraft?.kind === "GiftCardProduct"
      ? existing.editorDraft
      : {
          kind: "GiftCardProduct",
          denominations: [1000, 2500, 5000, 10000],
          mediaIds: [],
          productType: "",
          vendor: "",
          collectionIds: [],
          disclosures: "",
          seoTitle: "",
          seoDescription: "",
          handle: "",
        },
  );
  const [amounts, setAmounts] = useState(() =>
    draft.denominations.map((amount) => ({
      id: crypto.randomUUID(),
      amount: (amount / 100).toFixed(2),
    })),
  );
  const [initial] = useState(() => ({ entry, draft, amounts }));
  const [resetCount, setResetCount] = useState(0);
  const titleInput = useRef<HTMLInputElement>(null);
  const amountInputs = useRef(new Map<string, HTMLInputElement>());
  const [seoOpen, setSeoOpen] = useState(false);
  const [newAmountId, setNewAmountId] = useState("");
  const [mediaOpen, setMediaOpen] = useState(false);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [editing, setEditing] = useState<{
    key: "productType" | "vendor" | "disclosures" | "tags";
    value: string;
  }>();
  const [error, setError] = useState("");
  const dirty =
    JSON.stringify({ entry, draft, amounts }) !== JSON.stringify(initial);
  const changeAmounts = (values: typeof amounts) => {
    setAmounts(values);
    setDraft({
      ...draft,
      denominations: values.map(({ amount }) => parseMoney(amount) ?? -1),
    });
  };
  const unavailable = text(
    "Selling and redemption require a verified stored-value adapter.",
    "Продажбата и използването изискват потвърден адаптер за парична стойност.",
  );
  const save = () => {
    if (
      !entry.title.trim() ||
      !validGiftCardProductDraft(draft) ||
      draft.mediaIds.some(
        (id) =>
          !store.entries.some(
            (e) =>
              e.id === id &&
              e.type === "File" &&
              e.body.startsWith("data:image/"),
          ),
      ) ||
      draft.collectionIds.some(
        (id) => !store.collections.some((c) => c.id === id),
      )
    ) {
      setError(
        text(
          "Add a title and unique positive EUR denominations. Review local media and collections.",
          "Добавете заглавие и уникални положителни номинали в EUR. Проверете локалните изображения и колекции.",
        ),
      );
      if (!entry.title.trim()) titleInput.current?.focus();
      else {
        const index = draft.denominations.findIndex(
          (amount, i, values) =>
            !Number.isSafeInteger(amount) ||
            amount <= 0 ||
            amount > 100000000 ||
            values.indexOf(amount) !== i,
        );
        amountInputs.current.get(amounts[index]?.id)?.focus();
      }
      return;
    }
    const saved: Entry = {
      ...entry,
      id: existing?.id ?? `gift-product-${crypto.randomUUID()}`,
      title: entry.title.trim(),
      type: "GiftCardProductDraft",
      status: "Draft",
      editorDraft: draft,
    };
    update({ entries: put(store.entries, saved) });
    notify(
      text(
        "Gift card product draft saved locally. No product was published or gift card issued.",
        "Черновата е запазена локално. Не е публикуван продукт или издадена подаръчна карта.",
      ),
    );
    router.push(href(`gift-cards/${saved.id}`));
  };
  if (id !== "product-new" && !existing)
    return (
      <main className={s.editor}>
        <Header
          title={text("Draft not found", "Черновата не е намерена")}
          back={href("gift-cards")}
        />
      </main>
    );
  return (
    <main
      className={`${s.editor} ${styles.editor}`}
      data-studio-part="editor"
      data-studio-builder="gift-card-product"
    >
      <DraftEditorActions
        dirty={dirty}
        onSave={save}
        onDiscard={() => {
          setEntry(initial.entry);
          setDraft(initial.draft);
          setAmounts(initial.amounts);
          setError("");
          setResetCount((value) => value + 1);
          titleInput.current?.focus();
        }}
      />
      <EditorBreadcrumb
        href={href("gift-cards")}
        title={text("Gift cards", "Подаръчни карти")}
        icon="discount"
      />
      <Header
        title={
          existing
            ? entry.title
            : text(
                "Create gift card product",
                "Създаване на продукт за подаръчна карта",
              )
        }
      />
      {error && (
        <p role="alert" className={s.error} id="gift-product-error">
          {error}
        </p>
      )}
      <div className={s.editorColumns} data-studio-part="editor-layout">
        <div className={s.stack} data-studio-part="editor-main">
          <Panel part="gift-product-core">
            <Field label={text("Title", "Заглавие")}>
              <input
                ref={titleInput}
                aria-invalid={!!error && !entry.title.trim()}
                aria-describedby={error ? "gift-product-error" : undefined}
                maxLength={160}
                value={entry.title}
                placeholder={`${store.settings.name} ${text("gift card", "подаръчна карта")}`}
                onChange={(event) =>
                  setEntry({ ...entry, title: event.target.value })
                }
              />
            </Field>
            <Field label={text("Description", "Описание")}>
              <ProductRichEditor
                key={resetCount}
                generation={false}
                label={text(
                  "Gift card product description",
                  "Описание на продукта за подаръчна карта",
                )}
                value={entry.body}
                html={entry.descriptionHtml}
                onChange={(body, descriptionHtml) =>
                  setEntry({ ...entry, body, descriptionHtml })
                }
              />
            </Field>
            <Field label={text("Media", "Медия")}>
              <div className={styles.media}>
                {draft.mediaIds.map((id) => {
                  const file = store.entries.find(
                    (e) => e.id === id && e.type === "File",
                  );
                  return file?.body.startsWith("data:image/") ? (
                    <div key={id}>
                      <Image
                        src={file.body}
                        alt={file.title}
                        unoptimized
                        width={120}
                        height={90}
                      />
                      <Button
                        plain
                        aria-label={text(
                          "Remove image",
                          "Премахване на изображение",
                        )}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            mediaIds: draft.mediaIds.filter(
                              (key) => key !== id,
                            ),
                          })
                        }
                      >
                        ×
                      </Button>
                    </div>
                  ) : null;
                })}
                <Button onClick={() => setMediaOpen(true)}>
                  {text("Upload new", "Ново качване")}
                </Button>
                <Button plain onClick={() => setMediaOpen(true)}>
                  {text("Select existing", "Избор на съществуващо")}
                </Button>
                <p className={s.help}>
                  {text(
                    "JPEG, PNG, WebP · up to 120 KB",
                    "JPEG, PNG, WebP · до 120 KB",
                  )}
                </p>
              </div>
            </Field>
            <Field label={text("Category", "Категория")}>
              <input
                value={text("Gift Cards", "Подаръчни карти")}
                readOnly
                disabled
              />
            </Field>
            <p className={s.help}>
              {text(
                "Local planning category. Tax and cross-channel metadata require connected adapters.",
                "Категория за локално планиране. Данъците и данните за канали изискват свързани адаптери.",
              )}
            </p>
          </Panel>
          <Panel part="gift-product-denominations">
            <Field label={text("Currency", "Валута")}>
              <input
                readOnly
                disabled
                value={text(
                  "Store currency (EUR €)",
                  "Валута на магазина (EUR €)",
                )}
              />
            </Field>
            <Field label={text("Redemption in", "Използване във")}>
              <input
                readOnly
                disabled
                value={text("Unavailable", "Недостъпно")}
                title={unavailable}
              />
            </Field>
            <p className={styles.boundary}>
              {text(
                "These EUR amounts are local draft denominations. No balance, exchange rate, or redemption is created.",
                "Сумите в EUR са номинали на локална чернова. Не се създава баланс, обменен курс или използване.",
              )}
            </p>
            <div className={styles.denominations}>
              <span>{text("Denominations", "Номинали")}</span>
              {amounts.map((row, index) => (
                <div key={row.id}>
                  <span aria-hidden="true">€</span>
                  <input
                    ref={(element) => {
                      if (element) amountInputs.current.set(row.id, element);
                      else amountInputs.current.delete(row.id);
                    }}
                    aria-invalid={
                      !!error &&
                      (draft.denominations[index] <= 0 ||
                        draft.denominations[index] > 100000000 ||
                        draft.denominations.indexOf(
                          draft.denominations[index],
                        ) !== index)
                    }
                    aria-describedby={error ? "gift-product-error" : undefined}
                    data-studio-autofocus={
                      index === amounts.length - 1 ? true : undefined
                    }
                    aria-label={text(
                      `Denomination amount ${index + 1} EUR`,
                      `Номинал ${index + 1} EUR`,
                    )}
                    inputMode="decimal"
                    maxLength={12}
                    placeholder="0.00"
                    autoFocus={row.id === newAmountId}
                    value={row.amount}
                    onChange={(event) =>
                      changeAmounts(
                        amounts.map((r) =>
                          r.id === row.id
                            ? { ...r, amount: event.target.value }
                            : r,
                        ),
                      )
                    }
                  />
                  <Button
                    plain
                    aria-label={text(
                      `Delete denomination ${index + 1}`,
                      `Премахване на номинал ${index + 1}`,
                    )}
                    onClick={() =>
                      changeAmounts(amounts.filter((r) => r.id !== row.id))
                    }
                  >
                    <AdminIcon name="delete" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              className={styles.addDenomination}
              disabled={amounts.length >= 20}
              onClick={() => {
                const id = crypto.randomUUID();
                setNewAmountId(id);
                changeAmounts([...amounts, { id, amount: "" }]);
              }}
            >
              {text("Add denomination", "Добавяне на номинал")}
            </Button>
          </Panel>
          <EditorSection
            title={text("Product metafields", "Метаполета на продукта")}
            part="gift-product-metafields"
          >
            <Button
              plain
              onClick={() =>
                setEditing({ key: "disclosures", value: draft.disclosures })
              }
            >
              + {text("Disclosures", "Допълнителна информация")}
            </Button>
            {draft.disclosures && <p>{draft.disclosures}</p>}
          </EditorSection>
          <EditorSection
            title={text("Search engine listing", "Вид в търсачките")}
            part="gift-product-seo"
            action={
              !seoOpen && (
                <Button
                  plain
                  aria-label={text(
                    "Edit search engine listing",
                    "Редактиране на вида в търсачките",
                  )}
                  onClick={() => setSeoOpen(true)}
                >
                  <AdminIcon name="edit" />
                </Button>
              )
            }
          >
            <p>
              {entry.title ||
                text(
                  "Add a title and description to see how this product might appear in a search engine listing",
                  "Добавете заглавие и описание, за да видите как продуктът може да изглежда в търсачка",
                )}
            </p>
            {seoOpen && (
              <>
                <Field label={text("Page title", "Заглавие на страницата")}>
                  <input
                    maxLength={70}
                    value={draft.seoTitle}
                    onChange={(event) =>
                      setDraft({ ...draft, seoTitle: event.target.value })
                    }
                  />
                </Field>
                <Field label={text("Meta description", "Мета описание")}>
                  <textarea
                    maxLength={160}
                    value={draft.seoDescription}
                    onChange={(event) =>
                      setDraft({ ...draft, seoDescription: event.target.value })
                    }
                  />
                </Field>
                <Field label={text("URL handle", "URL идентификатор")}>
                  <input
                    maxLength={100}
                    value={draft.handle}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        handle: event.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, ""),
                      })
                    }
                  />
                </Field>
              </>
            )}
          </EditorSection>
        </div>
        <aside className={s.editorSide} data-studio-part="editor-side">
          <Panel title={text("Status", "Статус")} part="gift-product-status">
            <span>{text("Draft", "Чернова")}</span>
          </Panel>
          <Panel
            title={text("Publishing", "Публикуване")}
            part="gift-product-publishing"
          >
            <Button plain disabled title={unavailable}>
              {text("All channels", "Всички канали")}
            </Button>
            <p className={s.help}>
              {text("Publication is unavailable", "Публикуването е недостъпно")}
            </p>
          </Panel>
          <Panel
            title={text("Product organization", "Организация на продукта")}
            part="gift-product-organization"
          >
            {(["productType", "vendor"] as const).map((key) => (
              <div key={key}>
                <Button
                  plain
                  onClick={() => setEditing({ key, value: draft[key] })}
                >
                  {key === "vendor"
                    ? text("Vendor", "Доставчик")
                    : text("Type", "Тип")}{" "}
                  <AdminIcon name="chevron" />
                </Button>
                <p>{draft[key] || text("None", "Няма")}</p>
              </div>
            ))}
            <div>
              <span>{text("Collections", "Колекции")}</span>
              <Button plain onClick={() => setCollectionsOpen(true)}>
                {text("Add collections", "Добавяне на колекции")}
              </Button>
              {draft.collectionIds.map((id) => (
                <p key={id}>
                  {store.collections.find((c) => c.id === id)?.title}
                </p>
              ))}
            </div>
            <div>
              <span>{text("Tags", "Тагове")}</span>
              <Button
                plain
                onClick={() => setEditing({ key: "tags", value: entry.tags })}
              >
                {entry.tags || text("Add tags", "Добавяне на тагове")}
              </Button>
            </div>
          </Panel>
          <Panel
            title={text("Theme templates", "Шаблони на темата")}
            part="gift-product-templates"
          >
            <div>
              <h3>{text("Theme template", "Шаблон на темата")}</h3>
              <Button plain disabled title={unavailable}>
                {text("Default product", "Стандартен продукт")}
              </Button>
            </div>
            <div>
              <h3>{text("Gift card template", "Шаблон за подаръчна карта")}</h3>
              <Button plain disabled title={unavailable}>
                gift_card
              </Button>
            </div>
          </Panel>
        </aside>
      </div>
      <div className={s.saveBar} data-studio-part="save-bar">
        <Action href={href("gift-cards")}>{text("Cancel", "Отказ")}</Action>
        <Button primary onClick={save}>
          {text("Save draft", "Запазване на чернова")}
        </Button>
      </div>
      {mediaOpen && (
        <MediaLibrary
          onClose={() => setMediaOpen(false)}
          onSelect={(image) => {
            const file = store.entries.find(
              (e) => e.type === "File" && e.body === image,
            );
            if (
              file &&
              draft.mediaIds.length < 20 &&
              !draft.mediaIds.includes(file.id)
            )
              setDraft({ ...draft, mediaIds: [...draft.mediaIds, file.id] });
            setMediaOpen(false);
          }}
        />
      )}
      {collectionsOpen && (
        <DiscountItemPicker
          kind="Collections"
          limit={20}
          selected={draft.collectionIds}
          onClose={() => setCollectionsOpen(false)}
          onApply={(collectionIds) => {
            setDraft({ ...draft, collectionIds });
            setCollectionsOpen(false);
          }}
        />
      )}
      {editing && (
        <Modal
          title={
            editing.key === "vendor"
              ? text("Vendor", "Доставчик")
              : editing.key === "productType"
                ? text("Type", "Тип")
                : editing.key === "tags"
                  ? text("Tags", "Тагове")
                  : text("Disclosures", "Допълнителна информация")
          }
          surface="gift-product-field"
          onClose={() => setEditing(undefined)}
          footer={
            <>
              <Button onClick={() => setEditing(undefined)}>
                {text("Cancel", "Отказ")}
              </Button>
              <Button
                primary
                onClick={() => {
                  if (editing.key === "tags")
                    setEntry({ ...entry, tags: editing.value });
                  else setDraft({ ...draft, [editing.key]: editing.value });
                  setEditing(undefined);
                }}
              >
                {text("Done", "Готово")}
              </Button>
            </>
          }
        >
          <Field label={text("Value", "Стойност")}>
            {editing.key === "disclosures" ? (
              <textarea
                data-studio-autofocus
                maxLength={5000}
                value={editing.value}
                onChange={(event) =>
                  setEditing({ ...editing, value: event.target.value })
                }
              />
            ) : (
              <input
                data-studio-autofocus
                maxLength={editing.key === "tags" ? 500 : 160}
                value={editing.value}
                onChange={(event) =>
                  setEditing({ ...editing, value: event.target.value })
                }
              />
            )}
          </Field>
        </Modal>
      )}
    </main>
  );
}
