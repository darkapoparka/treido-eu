"use client";

import Link from "next/link";
import { useEffect, useRef, type KeyboardEvent } from "react";
import type { SellerContext } from "./persistence.server";
import { AdminIcon } from "./admin-icons";
import styles from "./admin-account-switcher.module.css";

type Account = Pick<SellerContext, "sellerId" | "name" | "kind">;

/** Presentation only: these accounts come from the current authorized shell. */
export function AdminAccountSwitcher({ accounts, current, language, onNavigate }: {
  accounts: readonly Account[];
  current?: Account;
  language: "bg" | "en";
  onNavigate: () => void;
}) {
  const root = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  const bg = language === "bg";
  const name = current?.name ?? (bg ? "Избери продавач" : "Select seller");
  const kind = (account: Account) => account.kind === "business"
    ? bg ? "Бизнес" : "Business"
    : bg ? "Личен продавач" : "Personal seller";
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target) && root.current)
        root.current.open = false;
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);
  function navigate() {
    if (root.current) root.current.open = false;
    onNavigate();
  }
  function keys(event: KeyboardEvent<HTMLDetailsElement>) {
    const element = root.current;
    if (!element) return;
    if (event.key === "Escape" && element.open) {
      event.preventDefault();
      event.stopPropagation();
      element.open = false;
      summary.current?.focus({ preventScroll: true });
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    if (!element.open && !["ArrowDown", "ArrowUp"].includes(event.key)) return;
    event.preventDefault();
    element.open = true;
    const links = Array.from(element.querySelectorAll<HTMLAnchorElement>("a[href]"));
    const index = links.indexOf(document.activeElement as HTMLAnchorElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? links.length - 1
      : event.key === "ArrowDown" ? (index + 1) % links.length
      : index <= 0 ? links.length - 1 : index - 1;
    links[next]?.focus({ preventScroll: true });
  }
  return (
    <details ref={root} className={styles.root} data-studio-part="account-switcher" onKeyDown={keys}
      onBlur={(event) => {
        if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget))
          event.currentTarget.open = false;
      }}>
      <summary ref={summary} aria-label={`${bg ? "Избери акаунт на продавач" : "Choose seller account"}: ${name}`} title={name}>
        <span className={styles.avatar} aria-hidden="true">{name.slice(0, 2).toLocaleUpperCase(language)}</span>
        <span className={styles.identity}><strong>{name}</strong><small>{current ? kind(current) : "Treido Studio"}</small></span>
        <span className={styles.chevron} aria-hidden="true"><AdminIcon name="chevron" /></span>
      </summary>
      <div className={styles.menu}>
        <p>{bg ? "Твоите акаунти" : "Your accounts"}</p>
        <nav aria-label={bg ? "Акаунти на продавача" : "Seller accounts"}>
          {accounts.map((account) => <Link key={account.sellerId}
            href={`/app/sellers/${account.sellerId}?lang=${language}`}
            aria-current={account.sellerId === current?.sellerId ? "page" : undefined} onClick={navigate}>
            <span className={styles.accountAvatar} aria-hidden="true">{account.name.slice(0, 2).toLocaleUpperCase(language)}</span>
            <span><strong>{account.name}</strong><small>{kind(account)}</small></span>
            {account.sellerId === current?.sellerId && <span className={styles.check} aria-hidden="true">✓</span>}
          </Link>)}
        </nav>
        <div className={styles.actions}>
          <Link href={`/sell?lang=${language}`} onClick={navigate}><AdminIcon name="plus" />{bg ? "Продай личен артикул" : "Sell a personal item"}</Link>
          <Link href={`/app/onboarding?lang=${language}`} onClick={navigate}><AdminIcon name="store" />{bg ? "Добави бизнес" : "Add a business"}</Link>
        </div>
      </div>
    </details>
  );
}
