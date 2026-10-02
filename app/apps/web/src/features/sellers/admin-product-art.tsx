import styles from "./admin.module.css";

/** Original decorative product tiles; no store data or captured reference assets. */
export function AdminProductArt() {
  return (
    <svg className={styles.emptyArt} viewBox="0 0 180 180" aria-hidden="true">
      <rect x="0" y="0" width="84" height="84" rx="12" fill="#fafafa" />
      <rect x="96" y="0" width="84" height="84" rx="12" fill="#f8f8f8" />
      <rect x="0" y="96" width="84" height="84" rx="12" fill="#f8f8f8" />
      <rect x="96" y="96" width="84" height="84" rx="12" fill="#fafafa" />
      <g transform="rotate(-8 42 42)">
        <rect x="21" y="16" width="41" height="53" rx="3" fill="#d3bdf4" />
        <rect x="24" y="16" width="3" height="53" fill="#b89ddd" />
        <path d="M32 27h22m-22 5h17" stroke="#fff" strokeWidth="2" />
      </g>
      <path
        d="M131 20h14v16c0 7 10 11 10 23 0 8-7 12-17 12s-17-4-17-12c0-12 10-16 10-23V20Z"
        fill="#dad8cc"
      />
      <path
        d="M133 21v18c-1 7-8 13-8 21"
        fill="none"
        stroke="#edede5"
        strokeWidth="3"
      />
      <path
        d="M19 138v-9a23 23 0 0 1 46 0v9"
        fill="none"
        stroke="#42614c"
        strokeWidth="7"
      />
      <rect x="15" y="131" width="14" height="25" rx="7" fill="#1e3929" />
      <rect x="55" y="131" width="14" height="25" rx="7" fill="#1e3929" />
      <path
        d="m116 125 12-8 4 5h12l4-5 12 8 7 16-12 5-4-8v25h-26v-25l-4 8-12-5 7-16Z"
        fill="#be765b"
      />
      <path
        d="M132 122c0 6 12 6 12 0"
        fill="none"
        stroke="#9e5745"
        strokeWidth="2"
      />
    </svg>
  );
}
