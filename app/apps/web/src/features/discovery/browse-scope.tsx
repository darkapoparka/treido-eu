"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  readDiscoveryInput,
  type BrowseScope,
} from "../catalog/discovery-input";
import { browseScopeHref } from "./browse-scope-route";
import { consumeSheetHistory, Sheet } from "./components";
import { Icon } from "./icons";
import { rememberSourcePosition, SourceLink } from "./return-navigation";
import styles from "./browse-scope.module.css";
import { useLocale } from "../locale/provider";

export function BrowseScopeControl() {
  const pathname = usePathname();
  const params = useSearchParams();
  const { locale, messages } = useLocale();
  const { input } = readDiscoveryInput(new URLSearchParams(params));
  const text = messages.scope;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const requested = useRef<{ href: string; scope: BrowseScope } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const current = `${pathname}${params.size ? `?${params}` : ""}`;
  useEffect(() => {
    const request = requested.current;
    if (!request || current !== request.href) return;
    requested.current = null;
    window.scrollTo({ top: 0, behavior: "instant" });
    trigger.current?.focus({ preventScroll: true });
  }, [current, pending]);

  function select(scope: BrowseScope) {
    if (scope === input.seller && !pending) {
      setOpen(false);
      return;
    }
    const source = new URLSearchParams(params);
    source.set("lang", locale);
    const href = browseScopeHref(pathname, source, scope);
    requested.current = { href, scope };
    // Replace the chooser's temporary entry with the selection. Back then
    // restores the previous scope, without racing Sheet's deferred dismissal.
    const replace = consumeSheetHistory();
    setOpen(false);
    startTransition(() =>
      replace
        ? router.replace(href, { scroll: false })
        : router.push(href, { scroll: false }),
    );
  }
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={`pill ${styles.trigger}`}
        data-browse-scope-trigger
        data-selected-scope={input.seller}
        data-focus-return="browse-scope"
        aria-label={`${text.label}: ${text[input.seller]}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-busy={pending}
        onClick={() => {
          rememberSourcePosition("[data-browse-scope-trigger]");
          setOpen(true);
        }}
      >
        <span>
          {input.seller === "all" ? text.compactAll : text[input.seller]}
        </span>
        <Icon name="chevron" style={{ transform: "rotate(90deg)" }} />
      </button>
      <Sheet
        open={open}
        title={text.title}
        onClose={() => setOpen(false)}
        className={styles.sheet}
        initialFocus='[data-browse-scope][aria-pressed="true"]'
      >
        <div role="group" aria-label={text.label} className={styles.options}>
          {(["all", "personal", "business"] as const).map((scope) => (
            <button
              key={scope}
              type="button"
              data-browse-scope={scope}
              aria-pressed={input.seller === scope}
              onClick={() => select(scope)}
            >
              <span>{text[scope]}</span>
              {input.seller === scope && <Icon name="check" />}
            </button>
          ))}
        </div>
      </Sheet>
      <span className={styles.status} role="status">
        {pending ? text.pending : ""}
      </span>
    </>
  );
}

export function BrowseScopeUnavailable({
  storefront = false,
}: {
  storefront?: boolean;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const { locale, messages } = useLocale();
  const { input } = readDiscoveryInput(new URLSearchParams(params));
  if (input.seller === "all") return null;
  const text = messages.scope;
  const source = new URLSearchParams(params);
  source.set("lang", locale);
  return (
    <section
      className={styles.unavailable}
      data-browse-scope-unavailable
      aria-live="polite"
    >
      <p>{storefront ? text.store : text.unavailable}</p>
      {!storefront && <p className={styles.explanation}>{text.explanation}</p>}
      <SourceLink
        className="pill"
        href={browseScopeHref(pathname, source, "all")}
        preserveDiscoveryContext={false}
        startAtTop
      >
        {text.reset}
      </SourceLink>
    </section>
  );
}
