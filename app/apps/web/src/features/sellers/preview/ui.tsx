"use client";
import { useCaption } from "../../locale/use-caption";
import Link from "next/link";
import { useTranslations, useFormatter } from "next-intl";
import { studioStateKeys } from "./studio-state-keys";
import Image from "next/image";
import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";
import { AdminIcon, type AdminIconName } from "../admin-icons";
import s from "./preview.module.css";
export { s };
export function Button({
  children,
  primary,
  danger,
  plain,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  primary?: boolean;
  danger?: boolean;
  plain?: boolean;
}) {
  return (
    <button
      type="button"
      data-studio-part="button"
      {...props}
      className={`${s.button} ${primary ? s.primary : ""} ${danger ? s.danger : ""} ${plain ? s.plain : ""} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}
export function Action({
  href,
  children,
  primary = false,
  plain = false,
}: {
  href: string;
  children: ReactNode;
  primary?: boolean;
  plain?: boolean;
}) {
  return (
    <Link
      data-studio-part="button"
      className={`${s.button} ${primary ? s.primary : ""} ${plain ? s.plain : ""}`}
      href={href}
    >
      {children}
    </Link>
  );
}
export function Header({
  title,
  icon,
  actions,
  back,
  backIcon = "back",
}: {
  title: string;
  icon?: AdminIconName;
  actions?: ReactNode;
  back?: string;
  backIcon?: AdminIconName;
}) {
  const t = useTranslations("studioUi");
  return (
    <header className={s.header} data-studio-part="page-header">
      <h1 className={s.title} data-studio-part="page-title">
        {back ? (
          <Link href={back} aria-label={t("back")}>
            <AdminIcon name={backIcon} />
          </Link>
        ) : icon ? (
          <AdminIcon name={icon} />
        ) : null}
        {title}
      </h1>
      <div className={s.actions} data-studio-part="actions">
        {actions}
      </div>
    </header>
  );
}
export function EditorBreadcrumb({
  href,
  title,
  icon,
  current,
  backIcon = "back",
}: {
  href: string;
  title: string;
  icon: AdminIconName;
  current?: string;
  backIcon?: AdminIconName;
}) {
  const t = useTranslations("studioUi");
  return (
    <nav
      className={s.editorBreadcrumb}
      data-studio-part="editor-breadcrumb"
      aria-label={title}
    >
      <Link href={href} aria-label={t("back")}>
        <AdminIcon name={backIcon} />
      </Link>
      <Link href={href}>
        <AdminIcon name={icon} />
        {title}
      </Link>
      {current && (
        <>
          <span aria-hidden="true">/</span>
          <h1 className={s.breadcrumbTitle}>{current}</h1>
        </>
      )}
    </nav>
  );
}
export function Panel({
  title,
  children,
  action,
  part,
}: {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  part?: string;
}) {
  return (
    <section
      className={s.panel}
      data-studio-part="panel"
      data-studio-panel={part}
    >
      {title && (
        <div className={s.sectionHeading} data-studio-part="panel-heading">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      <div className={s.stack} data-studio-part="stack">
        {children}
      </div>
    </section>
  );
}
export function Field({
  label,
  children,
  help,
}: {
  label: string;
  children: ReactNode;
  help?: string;
}) {
  return (
    <label className={s.field} data-studio-part="field">
      <span>{label}</span>
      {children}
      {help && (
        <span className={s.help} data-studio-part="field-help">
          {help}
        </span>
      )}
    </label>
  );
}
export function EditorSection({
  title,
  children,
  action,
  part,
  description,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  part?: string;
  description?: ReactNode;
}) {
  return (
    <section data-studio-part="editor-section" data-editor-section={part}>
      <header data-studio-part="editor-section-heading">
        <h2>{title}</h2>
        {action}
      </header>
      {description && (
        <p data-studio-part="editor-section-description" className={s.help}>
          {description}
        </p>
      )}
      <Panel part={part}>{children}</Panel>
    </section>
  );
}
export function Check({
  label,
  checked,
  onChange,
  name,
  radio = false,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  name?: string;
  radio?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className={s.check} data-studio-part="check">
      <input
        disabled={disabled}
        type={radio ? "radio" : "checkbox"}
        name={name}
        checked={checked}
        onChange={onChange}
      />
      <span>{label}</span>
    </label>
  );
}
export function Badge({ children }: { children: string }) {
  const caption = useCaption();
  const t = useTranslations("studioStates");
  const key = studioStateKeys[children as keyof typeof studioStateKeys];
  return (
    <span
      className={`${s.badge} ${["Active", "Paid", "Fulfilled", "Visible", "Owner"].includes(children) ? s.active : ["Pending", "Unfulfilled", "Draft", "Invited"].includes(children) ? s.warning : ""}`}
    >
      {key ? t(key) : caption(children)}
    </span>
  );
}
export function Empty({
  title,
  body,
  children,
  kind = "orders",
  art,
}: {
  title: string;
  body: string;
  children?: ReactNode;
  kind?: AdminIconName;
  art?: ReactNode;
}) {
  return (
    <div className={s.empty} data-studio-part="empty" data-empty-kind={kind}>
      <div className={s.emptyArt} data-studio-part="empty-art">
        {art ??
          (kind === "orders" || kind === "discount" ? (
            <Image
              src={`/merchant-admin/empty-${kind === "orders" ? "orders" : "discounts"}-v1.png`}
              alt=""
              width={190}
              height={190}
              sizes="190px"
              loading="eager"
            />
          ) : (
            <svg viewBox="0 0 150 150" fill="none" aria-hidden="true">
              <ellipse cx="75" cy="130" rx="51" ry="8" fill="#ececec" />
              <path
                d="M31 47 75 27l44 20v69l-44 19-44-19V47Z"
                fill="#f3f3f3"
                stroke="#c9c9c9"
              />
              <path d="m31 47 44 20 44-20M75 67v68" stroke="#c9c9c9" />
              <path d="m54 37 43 20v24l-16-7V50" fill="#ddd" />
              <g transform="translate(52 83)">
                <AdminIcon name={kind} />
              </g>
            </svg>
          ))}
      </div>
      <h2>{title}</h2>
      <p className={s.muted} data-studio-part="muted">
        {body}
      </p>
      <div className={s.actions} data-studio-part="actions">
        {children}
      </div>
    </div>
  );
}
export function Modal({
  title,
  children,
  footer,
  onClose,
  surface,
  className = "",
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  surface?: string;
  className?: string;
}) {
  const t = useTranslations("studioUi");
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previous = document.body.style.overflow;
    const scrollPositions: { element: Element; top: number; left: number }[] =
      [];
    const seen = new Set<Element>();
    for (const start of [opener?.parentElement, dialog?.parentElement]) {
      for (let element = start; element; element = element.parentElement) {
        if (!seen.has(element)) {
          seen.add(element);
          if (
            element.scrollHeight > element.clientHeight ||
            element.scrollWidth > element.clientWidth
          ) {
            scrollPositions.push({
              element,
              top: element.scrollTop,
              left: element.scrollLeft,
            });
          }
        }
      }
    }
    const restoreScroll = () => {
      for (const { element, top, left } of scrollPositions) {
        element.scrollTop = top;
        element.scrollLeft = left;
      }
    };
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    dialog
      ?.querySelector<HTMLElement>("[data-studio-autofocus]")
      ?.focus({ preventScroll: true });
    restoreScroll();
    const restoreFrame = requestAnimationFrame(restoreScroll);
    return () => {
      cancelAnimationFrame(restoreFrame);
      dialog?.close();
      document.body.style.overflow = previous;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
      restoreScroll();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`${s.modal} ${className}`}
      data-studio-part="modal"
      aria-label={title}
      data-studio-surface={surface}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <header className={s.modalHeader} data-studio-part="modal-header">
        <h2>{title}</h2>
        <Button plain onClick={onClose} aria-label={t("closeDialog")}>
          <AdminIcon name="close" />
        </Button>
      </header>
      <div className={s.modalBody} data-studio-part="modal-body">
        {children}
      </div>
      {footer && (
        <footer className={s.modalFooter} data-studio-part="modal-footer">
          {footer}
        </footer>
      )}
    </dialog>
  );
}
export function Confirm({
  title,
  body,
  action,
  onClose,
  onConfirm,
}: {
  title: string;
  body: string;
  action: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("studioUi");
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t("cancel")}</Button>
          <Button
            primary
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {action}
          </Button>
        </>
      }
    >
      <p>{body}</p>
    </Modal>
  );
}
export function Toolbar({
  query,
  onQuery,
  tabs = ["All"],
  tab,
  onTab,
  sort,
  onSort,
  extra,
}: {
  query: string;
  onQuery: (value: string) => void;
  tabs?: string[];
  tab: string;
  onTab: (value: string) => void;
  sort: string;
  onSort: (value: string) => void;
  extra?: ReactNode;
}) {
  const caption = useCaption();
  const t = useTranslations("studioUi");
  const stateText = useTranslations("studioStates");
  return (
    <div className={s.toolbar} data-studio-part="list-toolbar">
      <div
        className={s.tabs}
        data-studio-part="list-tabs"
        role="tablist"
        aria-label={t("views")}
      >
        {tabs.map((value) => (
          <button
            key={value}
            role="tab"
            className={s.tab}
            data-studio-part="list-tab"
            aria-selected={value === tab}
            onClick={() => onTab(value)}
          >
            {studioStateKeys[value as keyof typeof studioStateKeys]
              ? stateText(
                  studioStateKeys[value as keyof typeof studioStateKeys],
                )
              : caption(value)}
          </button>
        ))}
      </div>
      <div className={s.searchWrap} data-studio-part="list-search">
        <AdminIcon name="search" />
        <input
          className={s.search}
          data-studio-part="search"
          type="search"
          aria-label={t("searchList")}
          placeholder={t("search")}
          value={query}
          onChange={(event) => onQuery(event.target.value)}
        />
      </div>
      {extra}
      <select
        aria-label={t("sort")}
        value={sort}
        onChange={(event) => onSort(event.target.value)}
      >
        <option value="newest">{t("newest")}</option>
        <option value="az">{t("az")}</option>
        <option value="za">{t("za")}</option>
      </select>
    </div>
  );
}
export function useList(initial = "") {
  const [query, onQuery] = useState(initial);
  const [tab, onTab] = useState("All");
  const [sort, onSort] = useState("newest");
  const [selected, select] = useState<string[]>([]);
  return {
    query,
    onQuery,
    tab,
    onTab,
    sort,
    onSort,
    selected,
    select,
    toggle: (id: string) =>
      select(
        selected.includes(id)
          ? selected.filter((value) => value !== id)
          : [...selected, id],
      ),
  };
}
export function listRows<T>(
  rows: readonly T[],
  query: string,
  sort: string,
  title: (row: T) => string,
) {
  const values = rows.filter((row) =>
    title(row).toLowerCase().includes(query.trim().toLowerCase()),
  );
  if (sort !== "newest")
    values.sort(
      (a, b) => title(a).localeCompare(title(b)) * (sort === "za" ? -1 : 1),
    );
  else values.reverse();
  return values;
}
export function TableFooter({ count }: { count: number }) {
  const t = useTranslations("studioUi");
  return (
    <div className={s.tableFooter} data-studio-part="table-footer">
      <span>{t("results", { count })}</span>
      <span>{t("allResults")}</span>
    </div>
  );
}
export function Chart({
  values = [],
  compact = false,
}: {
  values?: number[];
  compact?: boolean;
}) {
  const t = useTranslations("studioUi");
  const format = useFormatter();
  const max = Math.max(1, ...values);
  const points = (values.length ? values : Array.from({ length: 7 }, () => 0))
    .map(
      (value, i, all) =>
        `${i === 0 ? "M" : "L"}${35 + (i * 340) / Math.max(1, all.length - 1)},${120 - (value / max) * 95}`,
    )
    .join(" ");
  return (
    <div
      className={`${s.chart} ${compact ? s.chartCompact : ""}`}
      role="img"
      aria-label={t("sales")}
    >
      <svg viewBox="0 0 400 150" preserveAspectRatio="none" aria-hidden="true">
        <line x1="35" x2="380" y1="25" y2="25" />
        <line x1="35" x2="380" y1="72" y2="72" />
        <line x1="35" x2="380" y1="120" y2="120" />
        <path d={points} />
      </svg>
      {!compact && (
        <>
          <span className={s.chartMax} data-studio-part="chart-max">
            {format.number(max)}
          </span>
          <span className={s.chartZero} data-studio-part="chart-zero">
            0
          </span>
          <span className={s.chartStart} data-studio-part="chart-start">
            {t("start")}
          </span>
          <span className={s.chartEnd} data-studio-part="chart-end">
            {t("today")}
          </span>
        </>
      )}
    </div>
  );
}
export function downloadCsv(
  name: string,
  rows: readonly (readonly (string | number)[])[],
) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell);
          return `"${/^[=+@-]/.test(value) ? "'" : ""}${value.replaceAll('"', '""')}"`;
        })
        .join(","),
    )
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
