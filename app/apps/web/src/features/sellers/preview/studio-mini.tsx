"use client";
import { useLocale as useIntlLocale } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AdminIcon } from "../admin-icons";
import { usePreview } from "./context";
import { money, put } from "./model";
import {
  MiniIcon,
  StudioMiniContext,
  type MiniMode,
} from "./studio-mini-context";
import {
  MiniAvatar,
  StudioMiniComposer,
  StudioMiniDock,
  StudioMiniLauncher,
} from "./studio-mini-composer";
import {
  miniDraft,
  readMiniRecents,
  runStudioMini,
  type MiniAnswer,
} from "./studio-mini-model";
import s from "./studio-mini.module.css";

export function StudioMiniProvider({ children }: { children: ReactNode }) {
  const { store, storeId, text, href, update, notify, largeText } =
    usePreview();
  const router = useRouter();
  const pathname = usePathname();
  const inSettings = pathname.includes("/settings");
  const panel = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [opened, setOpened] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [mode, setMode] = useState<MiniMode>("chat");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<MiniAnswer | null>(null);
  const [recents, setRecents] = useState<string[]>([]);
  const storageKey = `treido-studio-mini-${storeId}-recents`;
  const close = () => {
    panel.current?.close();
    setOpened(false);
    if (returnFocus.current?.isConnected)
      returnFocus.current.focus({ preventScroll: true });
  };
  useEffect(() => {
    panel.current?.close();
  }, [pathname]);
  useEffect(() => {
    if (!opened) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        panel.current?.close();
        setOpened(false);
      }
    };
    document.addEventListener("keydown", shortcut, true);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", shortcut, true);
    };
  }, [opened]);
  useEffect(() => {
    if (opened && mode === "chat")
      panel.current
        ?.querySelector<HTMLTextAreaElement>("form textarea")
        ?.focus();
  }, [opened, mode]);
  const open = (next: MiniMode = "chat") => {
    if (!panel.current?.open) {
      setExpanded(pathname === "/admin-preview");
      try {
        setRecents(readMiniRecents(sessionStorage.getItem(storageKey)));
      } catch {
        /* Keep mounted-session recents if storage is unavailable. */
      }
      returnFocus.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      panel.current?.showModal();
    }
    setMode(next);
    setOpened(true);
  };
  const ask = (prompt: string) => {
    const bounded = prompt.trim().slice(0, 500);
    if (!bounded) return;
    setQuestion(bounded);
    setAnswer(runStudioMini(bounded, store));
    let previous = recents;
    try {
      previous = readMiniRecents(sessionStorage.getItem(storageKey));
    } catch {
      /* Keep the mounted session useful. */
    }
    const next = [bounded, ...previous.filter((p) => p !== bounded)].slice(
      0,
      8,
    );
    setRecents(next);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* Keep the mounted session useful. */
    }
    open();
  };
  const saveDraft = (title: string, description: string) => {
    const product = miniDraft(
      title,
      description,
      `product-${crypto.randomUUID()}`,
    );
    if (!product) return;
    update({ products: put(store.products, product) });
    notify(
      text(
        "Local draft prepared. Review its fields in the editor.",
        "Локалната чернова е готова. Прегледай полетата в редактора.",
      ),
    );
    close();
    router.push(href(`products/${product.id}`));
  };
  return (
    <StudioMiniContext.Provider value={{ open, ask }}>
      <div
        className={s.frame}
        data-mini-settings={inSettings || undefined}
        data-mini-docked={(opened && !expanded) || undefined}
      >
        {children}
        {pathname !== "/admin-preview" && <StudioMiniDock />}
        {inSettings && (
          <div className={s.settingsPhoneMini}>
            <StudioMiniLauncher phone />
          </div>
        )}
        <dialog
          data-studio-mini=""
          ref={panel}
          className={`${s.surface} ${largeText ? s.large : ""}`}
          aria-label={text("Sell Helper Mini", "Мини помощник за продажби")}
          onClose={() => {
            setOpened(false);
            if (returnFocus.current?.isConnected)
              returnFocus.current.focus({ preventScroll: true });
          }}
        >
          {opened && (
            <>
              <header className={s.header}>
                <button
                  type="button"
                  className={s.recentPill}
                  onClick={() =>
                    setMode(mode === "recents" ? "chat" : "recents")
                  }
                >
                  <MiniIcon name="recent" />
                  {text("Recents", "Скорошни")}
                </button>
                <div className={s.headerActions}>
                  <button
                    type="button"
                    className={s.round}
                    aria-label={text(
                      "About Sell Helper",
                      "За помощника за продажби",
                    )}
                    onClick={() => setMode(mode === "about" ? "chat" : "about")}
                  >
                    <AdminIcon name="settings" />
                  </button>
                  <button
                    type="button"
                    className={`${s.round} ${s.expand}`}
                    aria-label={text(
                      expanded ? "Collapse Sell Helper" : "Expand Sell Helper",
                      expanded
                        ? "Свий помощника за продажби"
                        : "Разгъни помощника за продажби",
                    )}
                    aria-expanded={expanded}
                    onClick={() => setExpanded(!expanded)}
                  >
                    <svg
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      aria-hidden="true"
                    >
                      {expanded ? (
                        <path d="M2.5 7h4.5V2.5M7 7 2.5 2.5m15 10.5H13v4.5M13 13l4.5 4.5" />
                      ) : (
                        <path d="M2.5 7V2.5H7M2.5 2.5 7 7m10.5 6v4.5H13m4.5 0L13 13" />
                      )}
                    </svg>
                  </button>
                  <button
                    type="button"
                    className={s.round}
                    aria-label={text(
                      "Close Sell Helper",
                      "Затвори помощника за продажби",
                    )}
                    onClick={close}
                  >
                    <AdminIcon name="close" />
                  </button>
                </div>
              </header>
              {mode === "recents" ? (
                <section className={s.recentsPage}>
                  <div className={s.sectionHeading}>
                    <h2>{text("Conversations", "Разговори")}</h2>
                    <button
                      type="button"
                      className={s.round}
                      aria-label={text("New conversation", "Нов разговор")}
                      onClick={() => {
                        setQuestion("");
                        setAnswer(null);
                        setMode("chat");
                      }}
                    >
                      <AdminIcon name="plus" />
                    </button>
                  </div>
                  {recents.length ? (
                    recents.map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={s.recentRow}
                        onClick={() => ask(p)}
                      >
                        {p}
                        <AdminIcon name="arrow" />
                      </button>
                    ))
                  ) : (
                    <p>
                      {text("No conversations yet", "Все още няма разговори")}
                    </p>
                  )}
                </section>
              ) : (
                <>
                  <div className={s.body}>
                    {mode === "chat" && !answer ? (
                      <div className={s.greeting}>
                        <MiniAvatar size={36} />
                        <h2>
                          {text(
                            "Where should we begin?",
                            "Откъде да започнем?",
                          )}
                        </h2>
                        <p>
                          {text(
                            "Sell Helper · Treido Mini",
                            "Помощник за продажби · Treido Mini",
                          )}
                        </p>
                      </div>
                    ) : (
                      <div className={s.thread}>
                        {mode !== "chat" ? (
                          <Info
                            mode={mode}
                            onDraft={() =>
                              ask(
                                text(
                                  "Create a product listing",
                                  "Създай обява за продукт",
                                ),
                              )
                            }
                            onNavigate={close}
                          />
                        ) : (
                          <>
                            <p className={s.question}>{question}</p>
                            <div className={s.answer} role="status">
                              <MiniAvatar />
                              <span>
                                {text(
                                  "Local listing tools. AI is not connected in this preview.",
                                  "Локални инструменти за обяви. AI не е свързан в този преглед.",
                                )}
                              </span>
                            </div>
                            {answer && (
                              <Answer
                                key={question}
                                answer={answer}
                                saveDraft={saveDraft}
                                onNavigate={close}
                              />
                            )}
                          </>
                        )}
                      </div>
                    )}
                    {mode === "chat" && !answer && (
                      <div className={s.suggestions}>
                        <button
                          type="button"
                          onClick={() =>
                            ask(
                              text(
                                "Create a product listing",
                                "Създай обява за продукт",
                              ),
                            )
                          }
                        >
                          {text("Create a listing", "Създай обява")}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            ask(
                              text(
                                "Review my products",
                                "Прегледай продуктите ми",
                              ),
                            )
                          }
                        >
                          {text("Review products", "Прегледай продукти")}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className={s.bottom}>
                    <StudioMiniComposer />
                  </div>
                </>
              )}
            </>
          )}
        </dialog>
      </div>
    </StudioMiniContext.Provider>
  );
}

function Info({
  mode,
  onDraft,
  onNavigate,
}: {
  mode: MiniMode;
  onDraft: () => void;
  onNavigate: () => void;
}) {
  const { text, href } = usePreview();
  return (
    <div className={s.info}>
      <MiniAvatar size={36} />
      <h2>
        {mode === "voice"
          ? text("Type your request for now", "Засега напиши заявката си")
          : mode === "attachments"
            ? text(
                "Start with your product facts",
                "Започни с данните за продукта",
              )
            : text("Meet Sell Helper", "Запознай се с помощника за продажби")}
      </h2>
      <p>
        {mode === "voice"
          ? text(
              "Voice transcription is not connected in this preview. You can type below; no microphone is activated.",
              "Гласовото разпознаване не е свързано в този преглед. Можеш да пишеш долу; микрофонът не се включва.",
            )
          : text(
              "Find a product by name or SKU, review missing listing fields, or prepare an editable draft from facts you provide. This Mini uses only the selected local preview store; it does not call an AI provider or publish products.",
              "Намери продукт по име или SKU, прегледай липсващи полета или подготви чернова от въведени от теб данни. Мини използва само избрания локален магазин; не извиква AI и не публикува продукти.",
            )}
      </p>
      {mode === "attachments" ? (
        <Link
          className={s.action}
          href={href("products/new")}
          onClick={onNavigate}
        >
          {text(
            "Add photos in the product editor",
            "Добави снимки в редактора",
          )}
        </Link>
      ) : (
        <button type="button" className={s.action} onClick={onDraft}>
          {text("Prepare a listing draft", "Подготви чернова за обява")}
        </button>
      )}
      <p className={s.muted}>
        {text(
          "Recent prompts stay in this browser session, separately for each store.",
          "Скорошните заявки остават в тази сесия на браузъра, отделно за всеки магазин.",
        )}
      </p>
    </div>
  );
}
function Answer({
  answer,
  saveDraft,
  onNavigate,
}: {
  answer: MiniAnswer;
  saveDraft: (title: string, description: string) => void;
  onNavigate: () => void;
}) {
  const intlLocale = useIntlLocale();
  const { href, text } = usePreview();
  const [title, setTitle] = useState(
    answer.kind === "draft" ? answer.title : "",
  );
  const [description, setDescription] = useState(
    answer.kind === "draft" ? answer.description : "",
  );
  if (answer.kind === "draft")
    return (
      <form
        className={s.draft}
        onSubmit={(e) => {
          e.preventDefault();
          saveDraft(title, description);
        }}
      >
        <h2>{text("Prepare your listing", "Подготви обявата си")}</h2>
        <p>
          {text(
            "Enter facts you know. Review photos, category, condition and price in the editor before saving or publishing.",
            "Въведи известните данни. Прегледай снимките, категорията, състоянието и цената в редактора преди запазване или публикуване.",
          )}
        </p>
        <label>
          {text("Product title", "Заглавие на продукта")}
          <input
            required
            maxLength={160}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          {text("Seller-provided description", "Описание от продавача")}
          <textarea
            rows={4}
            maxLength={5000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <button type="submit" disabled={!title.trim()} className={s.action}>
          {text("Review draft in editor", "Прегледай черновата в редактора")}
        </button>
      </form>
    );
  if (answer.kind === "review")
    return (
      <div className={s.results}>
        <h2>{text("Listing checklist", "Проверка на обявите")}</h2>
        <p>
          {text(
            "Checks title, description, photo and price. This is not publication approval.",
            "Проверява заглавие, описание, снимка и цена. Това не е одобрение за публикуване.",
          )}
        </p>
        {answer.products.length ? (
          answer.products.map((p) => (
            <Link
              key={p.id}
              href={href(`products/${p.id}`)}
              onClick={onNavigate}
              className={s.result}
            >
              <strong>
                {p.title || text("Untitled product", "Продукт без заглавие")}
              </strong>
              <span>
                {p.missing.length
                  ? `${text("To review", "За преглед")}: ${p.missing.map((field) => text(field, ({ title: "заглавие", description: "описание", photo: "снимка", price: "цена" } as Record<string, string>)[field])).join(", ")}`
                  : text(
                      "Basic fields are present. Confirm accuracy in the editor.",
                      "Основните полета са попълнени. Потвърди данните в редактора.",
                    )}
              </span>
            </Link>
          ))
        ) : (
          <p>
            {text(
              "Your store has no products yet.",
              "В магазина все още няма продукти.",
            )}
          </p>
        )}
      </div>
    );
  if (answer.kind === "catalog")
    return (
      <div className={s.results}>
        <h2>{text("Matching products", "Намерени продукти")}</h2>
        <p>
          {text(
            "Matches names, SKUs, categories and tags in this store.",
            "Търси по имена, SKU, категории и тагове в този магазин.",
          )}
        </p>
        {answer.products.length ? (
          answer.products.map((p) => (
            <Link
              key={p.id}
              href={href(`products/${p.id}`)}
              onClick={onNavigate}
              className={s.result}
            >
              <strong>{p.title}</strong>
              <span>
                {money(p.price, intlLocale)} · {p.status}
                {p.sku ? ` · ${p.sku}` : ""}
              </span>
            </Link>
          ))
        ) : (
          <p>
            {text("No products match", "Няма продукти за")} “{answer.query}”.
          </p>
        )}
      </div>
    );
  return (
    <div className={s.info}>
      <h2>{text("AI is not connected yet", "AI все още не е свързан")}</h2>
      <p>
        {text(
          "Try “Find linen”, “Review my products” or “Create a product listing”. Free-form AI advice will be available after the provider is connected.",
          "Опитай „Намери LIN-001“, „Прегледай продуктите ми“ или „Създай обява за продукт“. Свободни AI съвети ще са достъпни след свързване на доставчика.",
        )}
      </p>
    </div>
  );
}
