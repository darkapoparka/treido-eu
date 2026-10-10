"use client";
import Link from "next/link";
import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { AdminIcon, type AdminIconName } from "./admin-icons";
import { searchStudioAction } from "./studio-search-actions";
import type {
  StudioSearchGroup,
  StudioSearchView,
} from "./studio-search-model";
import s from "./studio-search.module.css";
const labels = {
  en: {
    all: "All",
    products: "Products",
    orders: "Orders",
    customers: "Customers",
    navigation: "Navigation",
  },
  bg: {
    all: "Всички",
    products: "Продукти",
    orders: "Поръчки",
    customers: "Клиенти",
    navigation: "Навигация",
  },
};
const icons: Record<Exclude<StudioSearchGroup, "all">, AdminIconName> = {
  products: "product",
  orders: "orders",
  customers: "customers",
  navigation: "arrow",
};
export function StudioSearch({
  sellerId,
  language,
  onClose,
  onNavigate,
}: {
  sellerId: string;
  language: "bg" | "en";
  onClose: () => void;
  onNavigate: () => void;
}) {
  const { isLoaded, user } = useUser(),
    router = useRouter(),
    subject = user?.id,
    bg = language === "bg";
  const [q, setQuery] = useState(""),
    [group, setGroup] = useState<StudioSearchGroup>("all"),
    [retry, setRetry] = useState(0);
  const [state, setState] = useState<{
    scope: string;
    data?: StudioSearchView;
    error?: string;
  } | null>(null);
  const input = useRef<HTMLInputElement>(null),
    list = useRef<HTMLUListElement>(null),
    sequence = useRef({ value: 0 });
  const scope = JSON.stringify([
    subject,
    sellerId,
    q.trim(),
    group,
    language,
    retry,
  ]);
  useEffect(() => {
    const owner = sequence.current,
      request = ++owner.value;
    if (!isLoaded || !subject) return;
    const timer = setTimeout(
      () => {
        void searchStudioAction({
          sellerId,
          actorSubject: subject,
          q,
          group,
          language,
        })
          .then((result) => {
            if (owner.value !== request) return;
            if (!result.ok) {
              setState({ scope, error: result.code });
              return;
            }
            if (
              result.data.actorSubject !== subject ||
              result.data.sellerId !== sellerId ||
              result.data.q !== q.trim() ||
              result.data.group !== group
            )
              return;
            setState({ scope, data: result.data });
          })
          .catch(() => {
            if (owner.value === request)
              setState({ scope, error: "NOT_AVAILABLE" });
          });
      },
      q.trim() ? 250 : 0,
    );
    return () => {
      clearTimeout(timer);
      owner.value++;
    };
  }, [isLoaded, subject, sellerId, q, group, language, scope]);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible")
        startTransition(() => setRetry((value) => value + 1));
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const current = state?.scope === scope ? state : null,
    data = isLoaded && subject ? current?.data : undefined;
  const checking = !isLoaded || (!!subject && !current),
    denied =
      isLoaded &&
      (!subject || ["FORBIDDEN", "NOT_FOUND"].includes(current?.error ?? ""));
  const focus = (index: number) => {
    const links = list.current?.querySelectorAll<HTMLAnchorElement>("a");
    if (index < 0) input.current?.focus();
    else if (links?.length) links[Math.min(index, links.length - 1)].focus();
  };
  const resultKey = (
    event: KeyboardEvent<HTMLAnchorElement>,
    index: number,
  ) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focus(index + 1);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      focus(index - 1);
    }
    if (event.key === "Home") {
      event.preventDefault();
      focus(0);
    }
    if (event.key === "End") {
      event.preventDefault();
      focus((data?.items.length ?? 1) - 1);
    }
  };
  return (
    <div className={s.panel} data-studio-part="search-panel">
      <div className={s.header}>
        <AdminIcon name="search" />
        <input
          ref={input}
          autoFocus
          type="search"
          maxLength={160}
          value={q}
          placeholder={
            bg ? "Търси в този акаунт" : "Search this seller account"
          }
          aria-label={bg ? "Търси в този акаунт" : "Search this seller account"}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              focus(0);
            }
            if (event.key === "Enter" && data?.items[0]) {
              event.preventDefault();
              onNavigate();
              router.push(data.items[0].href);
            }
          }}
        />
        {q && (
          <button
            type="button"
            className={s.iconButton}
            onClick={() => {
              setQuery("");
              input.current?.focus();
            }}
            aria-label={bg ? "Изчисти търсенето" : "Clear search"}
          >
            <AdminIcon name="close" />
          </button>
        )}
        <button type="button" className={s.close} onClick={onClose}>
          {bg ? "Затвори" : "Close"}
        </button>
      </div>
      <nav
        className={s.groups}
        aria-label={bg ? "Обхват на търсенето" : "Search scope"}
      >
        {(data?.groups ?? (["all", "navigation"] as StudioSearchGroup[])).map(
          (key) => (
            <button
              type="button"
              key={key}
              aria-pressed={group === key}
              onClick={() => {
                setGroup(key);
                input.current?.focus();
              }}
            >
              {labels[language][key]}
            </button>
          ),
        )}
      </nav>
      <div className={s.results} aria-busy={checking}>
        {checking && (
          <p role="status">
            {bg
              ? "Проверка на текущите данни и достъп…"
              : "Checking current data and access…"}
          </p>
        )}
        {denied && (
          <p role="alert">
            {bg
              ? "Достъпът е променен. Избери разрешен акаунт."
              : "Access has changed. Choose an authorized seller account."}
          </p>
        )}
        {!denied && current?.error && (
          <div role="alert">
            <p>
              {bg
                ? "Търсенето не е достъпно. Не са показани остарели резултати."
                : "Search is unavailable. Stale results have not been shown."}
            </p>
            <button
              type="button"
              className={s.close}
              onClick={() => setRetry((value) => value + 1)}
            >
              {bg ? "Опитай отново" : "Retry"}
            </button>
          </div>
        )}
        {data && !data.items.length && (
          <p role="status">
            {bg
              ? "Няма съвпадения в избрания обхват."
              : "No matches in the selected scope."}
          </p>
        )}
        {data && (
          <ul ref={list} className={s.list}>
            {data.items.map((item, index) => (
              <li key={item.id}>
                <Link
                  prefetch={false}
                  href={item.href}
                  onClick={onNavigate}
                  onKeyDown={(event) => resultKey(event, index)}
                >
                  <span className={s.icon}>
                    <AdminIcon name={icons[item.group]} />
                  </span>
                  <span className={s.caption}>
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                  </span>
                  <span className={s.category}>
                    {labels[language][item.group]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <footer className={s.footer}>
        <span>
          {bg
            ? "↑ ↓ за навигация · Enter за отваряне"
            : "↑ ↓ to navigate · Enter to open"}
        </span>
        {data?.groups.includes("customers") && (
          <span>
            {bg
              ? "Клиенти: последните 30, по локален номер"
              : "Customers: latest 30, by seller-local reference"}
          </span>
        )}
      </footer>
    </div>
  );
}
