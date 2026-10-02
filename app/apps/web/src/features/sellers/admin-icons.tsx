export type AdminIconName =
  | "home"
  | "product"
  | "search"
  | "menu"
  | "close"
  | "back"
  | "plus"
  | "settings"
  | "inbox"
  | "orders"
  | "customers"
  | "growth"
  | "discount"
  | "content"
  | "markets"
  | "finance"
  | "analytics"
  | "bell"
  | "sort"
  | "more"
  | "store"
  | "arrow"
  | "check";

const paths: Record<AdminIconName, string> = {
  home: "m3 9 7-6 7 6v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9Zm4 8v-5h6v5",
  product: "M10 3h5l2 6-7 8-7-5 4-8 3-1ZM13 6h.01",
  search: "M8.5 14a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11Zm4-1 4 4",
  menu: "M4 3h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm3 0v14",
  close: "m5 5 10 10M15 5 5 15",
  back: "m11 5-5 5 5 5M6 10h10",
  plus: "M10 4v12M4 10h12",
  settings:
    "m8 3 4 0 .6 2 2 .9 1.9-.5 2 3.4-1.5 1.5v2.3l1.5 1.5-2 3.4-1.9-.5-2 .9-.6 2h-4l-.6-2-2-.9-1.9.5-2-3.4L3 11.6V9.3L1.5 7.8l2-3.4 1.9.5 2-.9L8 3Zm2 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  inbox: "M3 4h14v12H3V4Zm0 6h4l1 3h4l1-3h4",
  orders: "M5 3h10l2 5v9H3V8l2-5Zm-2 5h5v3h4V8h5M7 3l-1 5m7-5 1 5",
  customers:
    "M7.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2 17v-1a5.5 5.5 0 0 1 11 0v1m0-13a3 3 0 0 1 0 6m2 3a4 4 0 0 1 3 4",
  growth: "M3 17V3m0 14h14M6 12l4-4 3 2 4-6m-4 0h4v4",
  discount:
    "m10 2 2 2 3-.3.3 3 2 2-2 2 .3 3-3 .3-2 2-2-2-3 .3-.3-3-2-2 2-2-.3-3 3-.3 2-2Zm-3 5 6 6M7 7h.01M13 13h.01",
  content: "M4 3h9l3 3v11H4V3Zm9 0v4h3M7 10h6m-6 3h6",
  markets:
    "M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM2 10h16M10 2c-4 5-4 11 0 16 4-5 4-11 0-16Z",
  finance: "M3 5h14v12H3V5Zm0 3h14m-3 4h3M4 5l10-3v3",
  analytics: "M3 3v14h14M6 13v-3m4 3V5m4 8V8",
  bell: "M5 8a5 5 0 0 1 10 0v4l2 2H3l2-2V8Zm3 9h4M10 1v2",
  sort: "M5 3v14m-3-3 3 3 3-3M15 17V3m-3 3 3-3 3 3",
  more: "M4 10h.01M10 10h.01M16 10h.01",
  store: "M3 8h14l-2-5H5L3 8Zm1 0v9h12V8M8 17v-5h4v5",
  arrow: "M4 10h12m-5-5 5 5-5 5",
  check: "m4 10 4 4 8-8",
};

export function AdminIcon({
  name,
  className,
}: {
  name: AdminIconName;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
