import type { CSSProperties } from "react";
const paths = {
  history: "M4 6a9 9 0 1 1-1 10M4 2v5H1M12 6v6l4 3",
  globe:
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18",
  location:
    "M12 22s8-7.4 8-13A8 8 0 0 0 4 9c0 5.6 8 13 8 13ZM15 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  truck:
    "M3 5h11v12H3V5Zm11 5h4l3 4v3h-7M7 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm13 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z",
  calendar: "M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2ZM3 9h18M7 2v4m10-4v4",
  link: "m9 15 6-6M8 11l-2 2a4 4 0 0 0 6 6l2-2M10 7l2-2a4 4 0 0 1 6 6l-2 2",
  chat: "M3 4h18v13H8l-5 4V4Z",
  "chat-round":
    "M21 11c0 5-4 8-9 8-2 0-3-.3-4-1l-5 2 1-5a8 8 0 0 1-1-4c0-5 4-8 9-8s9 3 9 8Z",
  website:
    "M10 19H5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h13a3 3 0 0 1 3 3v4M6 7h.01M10 7h.01M14 7h.01m-2 6 9 3-4 2-2 4-3-9Z",
  "facebook-circle":
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM13 21v-9h3m-6 0h3V9c0-2 1-3 3-3",
  "return-package":
    "M4 8h16l-2-5H6L4 8Zm0 0v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 3v5h4V3M9 12l-3 3 3 3m-3-3h8a3 3 0 0 1 3 3",
  package:
    "M4 8h16l-2-5H6L4 8Zm0 0v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 3v5h4V3",
  "shield-check": "M12 3 3 7v6c0 4 4 7 9 9 5-2 9-5 9-9V7l-9-4ZM8 12l3 3 5-6",
  info: "M12 10v7m0-11h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  "question-circle":
    "M9 9a3 3 0 1 1 5 2.2c-1.3.8-2 1.3-2 2.8m0 3h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  "external-link": "M6 18 18 6M7 6h11v11",
  "open-in-browser":
    "M14 3h7v7m0-7L10 14M10 4H6a3 3 0 0 0-3 3v11a3 3 0 0 0 3 3h11a3 3 0 0 0 3-3v-4",
  alert: "M12 8v5m0 4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  mail: "M3 5h18v14H3zM3 5l9 7 9-7",
  phone: "M5 3h4l2 5-3 2a15 15 0 0 0 6 6l2-3 5 2v4c-9 3-19-7-16-16Z",
  copy: "M8 8h13v13H8zM16 8V3H3v13h5",
  instagram:
    "M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0M17 7h.01",
  facebook: "M14 22V12h4l1-4h-5V6c0-2 2-2 5-2V1h-5c-4 0-5 3-5 6v1H6v4h3v10",
  storefront:
    "M3 9h18l-2-6H5L3 9Zm1 5v7h16v-7M9 21v-7h6v7M3 9v2a3 3 0 0 0 6 0V9m0 2a3 3 0 0 0 6 0V9m0 2a3 3 0 0 0 6 0V9",
  minis:
    "M15 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0M9 17a3 3 0 1 1-6 0 3 3 0 0 1 6 0M21 17a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  lock: "M6 10h12v11H6zM8 10V6a4 4 0 0 1 8 0v4",
  "badge-check":
    "m12 2 3 2 4 1 1 4 2 3-2 3-1 4-4 1-3 2-3-2-4-1-1-4-2-3 2-3 1-4 4-1ZM8 12l3 3 5-6",
  "eye-off":
    "m3 3 18 18M10 5c5-1 9 4 11 7-1 2-2 3-4 4M6 6C4 8 2 10 1 12c3 5 7 8 13 6M9 9a4 4 0 0 0 6 6",
  "thumb-up": "M7 10H3v11h4V10Zm0 10h11l3-10h-8l1-6-2-2-5 8",
  "thumb-down": "M7 14H3V3h4v11Zm0-10h11l3 10h-8l1 6-2 2-5-8",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7",
  edit: "M4 16 16 4l4 4L8 20H4zM14 6l4 4",
  "type-input":
    "M12 4v16M9 4h6M9 20h6M9 8H6a3 3 0 0 0-3 3v2a3 3 0 0 0 3 3h3M15 8h3a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3h-3",
  "edit-search": "M6 9v9h9M10 14 18 6M12 6h6v6",
  mic: "M9 4a3 3 0 0 1 6 0v8a3 3 0 0 1-6 0ZM5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8",
  "mic-off":
    "M9 4a3 3 0 0 1 6 0v8a3 3 0 0 1-6 0ZM5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8M4 20 20 4",
  camera: "M3 7h4l2-3h6l2 3h4v14H3ZM16 14a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  "photo-library": "M3 5h18v14H3zM6 15l4-4 3 3 2-2 4 4M8 9h.01",
  "face-scan":
    "M8 3H6a3 3 0 0 0-3 3v2M16 3h2a3 3 0 0 1 3 3v2M21 16v2a3 3 0 0 1-3 3h-2M8 21H6a3 3 0 0 1-3-3v-2M8.5 9.5h.01M15.5 9.5h.01M8 15q4 4 8 0",
  "shopping-bag":
    "M4 7 7 3h10l3 4v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7Zm0 0h16M8 11v1a4 4 0 0 0 8 0v-1",
  "bag-add": "M7 8h14l-2 12H8L6 5H3M10 8V6a3.5 3.5 0 0 1 7 0v2M4 10v6M1 13h6",
  sparkles:
    "M10 3 12.2 9.8 19 12 12.2 14.2 10 21 7.8 14.2 1 12 7.8 9.8ZM19 2v4M17 4h4M3 18v3M1.5 19.5h3",
  gift: "M3 8h18v5H3zM5 13v8h14v-8M12 8v13M12 8S4 7 6 3s6 5 6 5 8-1 6-5-6 5-6 5",
  reset: "M4 4v6h6M4 10a8 8 0 1 1 0 6",
  home: "M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  explore: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  orders: "M3 8h18v13H3zM8 8V5a4 4 0 0 1 8 0v3",
  heart:
    "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
  back: "m15 4-8 8 8 8",
  chevron: "m9 5 7 7-7 7",
  close: "m6 6 12 12M6 18 18 6",
  arrow: "M4 12h16m-7-7 7 7-7 7",
  share: "M12 14V3m-4 4 4-4 4 4M5 11v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6",
  "share-android":
    "M21 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM9 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM21 19a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM8.6 10.5l6.8-4M8.6 13.5l6.8 4",
  "plus-circle": "M12 8v8M8 12h8M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  plus: "M12 4v16M4 12h16",
  minus: "M4 12h16",
  "filter-circles":
    "M4 7h7m6 0h3M4 17h3m6 0h7M17 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM13 17a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  filter: "M3 6h18M3 18h18M8 3v6M16 15v6",
  menu: "M3 5h18M3 12h18M3 19h18",
  bell: "M5 17h14l-2-4V9A5 5 0 0 0 7 9v4ZM10 21h4",
  tag: "M3 3h8l10 10-8 8L3 11ZM7 7h.01",
  "price-tag":
    "M19 2.5h-4.6a2 2 0 0 0-1.4.6L2.6 13.5a1.5 1.5 0 0 0 0 2.1l5.8 5.8a1.5 1.5 0 0 0 2.1 0L20.9 11a2 2 0 0 0 .6-1.4V5A2.5 2.5 0 0 0 19 2.5ZM17 7h.01",
  "price-tags":
    "M16 2.5h-3.4a2 2 0 0 0-1.4.6l-9 9a1.5 1.5 0 0 0 0 2.1l5.6 5.6a1.5 1.5 0 0 0 2.1 0l9-9a2 2 0 0 0 .6-1.4V5A2.5 2.5 0 0 0 16 2.5ZM15 6.5h.01M22 7.5v4.3a2 2 0 0 1-.6 1.4l-9.2 9.2",
  check: "m4 12 5 5L20 6",
  more: "M4 12h.01M12 12h.01M20 12h.01",
  cart: "M2 3h3l3 13h11l3-10H6M9 21h.01M18 21h.01",
  star: "m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z",
} as const;
export type IconName = keyof typeof paths;
export function Icon({
  name,
  filled = false,
  style,
}: {
  name: IconName;
  filled?: boolean;
  style?: CSSProperties;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      style={style}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === "location" ? (
        <path
          d={paths.location}
          fill="currentColor"
          fillRule="evenodd"
          stroke="none"
        />
      ) : name === "filter-circles" ? (
        <>
          <path d="M4.5 8h5.5m5.5 0h4M4.5 16h2.5m5 0h7.5" fill="none" />
          <circle cx="12.75" cy="8" r="2.25" fill="none" />
          <circle cx="9.5" cy="16" r="2.25" fill="none" />
        </>
      ) : name === "edit-search" ? (
        <>
          <path
            d="M11 5.5H6.5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V13"
            fill="none"
            strokeWidth="2"
          />
          <path
            d="m9 15 1-4 7.5-7.5a1.8 1.8 0 0 1 2.55 0l.45.45a1.8 1.8 0 0 1 0 2.55L13 14l-4 1Z"
            fill="currentColor"
            stroke="none"
          />
        </>
      ) : filled && name === "home" ? (
        <path
          d="M2.4 10.4 10.9 3.5a1.75 1.75 0 0 1 2.2 0l8.5 6.9c.95.77.4 2.3-.82 2.3h-1.03v6.5A2.8 2.8 0 0 1 16.95 22h-9.9a2.8 2.8 0 0 1-2.8-2.8v-6.5H3.22c-1.22 0-1.77-1.53-.82-2.3Z"
          stroke="none"
        />
      ) : filled && name === "explore" ? (
        <g stroke="none">
          <rect x="2.5" y="1.5" width="8.5" height="9.5" rx="1.2" />
          <rect x="13" y="1.5" width="8.5" height="9.5" rx="1.2" />
          <rect x="2.5" y="13" width="8.5" height="9.5" rx="1.2" />
          <rect x="13" y="13" width="8.5" height="9.5" rx="1.2" />
        </g>
      ) : filled && name === "cart" ? (
        <g stroke="none">
          <path
            d="M2.5 1.6h3.1c.8 0 1.5.55 1.66 1.34l.48 2.28h12.52c1.05 0 1.82 1 1.54 2.02l-1.75 8a2.65 2.65 0 0 1-2.56 1.95h-6.74a2.65 2.65 0 0 1-2.58-2.05L5.6 3.75H2.5V1.6Z"
            transform="translate(0 .9)"
          />
          <circle cx="10" cy="21.1" r="1.75" />
          <circle cx="18.9" cy="21.1" r="1.75" />
        </g>
      ) : filled && name === "orders" ? (
        <g stroke="none">
          <path d="M7.4 3.5h9.2c1.1 0 2.1.65 2.55 1.66l1.57 3.5c.19.41.28.85.28 1.3V18a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 3 18V9.96c0-.45.09-.89.28-1.3l1.57-3.5A2.8 2.8 0 0 1 7.4 3.5Z" />
          <path d="M11.2 4.2h1.6v4.3h6.7v1.6h-15V8.5h6.7V4.2Z" fill="white" />
        </g>
      ) : filled && name === "badge-check" ? (
        <>
          <path d="m12 2 3 2 4 1 1 4 2 3-2 3-1 4-4 1-3 2-3-2-4-1-1-4-2-3 2-3 1-4 4-1Z" />
          <path d="m8 12 3 3 5-6" fill="none" stroke="white" strokeWidth="2" />
        </>
      ) : (
        <path d={paths[name]} />
      )}
    </svg>
  );
}
